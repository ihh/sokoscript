"""World model observation wrapper — feeds transition predictions as extra channels.

The world model is a separate network that predicts next-state distributions
for each cell. Its predictions are appended as extra channels to the
observation, giving the policy a "what I think will happen next" signal.

The world model trains on (obs_t, obs_{t+1}) pairs from a replay buffer,
completely independent of the policy gradient.

Usage:
    env = LocalObsWrapper(env, window_size=11)
    env = WorldModelObsWrapper(env, model_type='lowrank', train_interval=10)
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from collections import deque

try:
    import torch
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


class WorldModelObsWrapper(gym.Wrapper):
    """Appends world model predictions as extra observation channels.

    The observation gains K extra channels (one per type) representing
    P(next_type = k) for each cell, as predicted by the world model.

    The world model is trained from a small replay buffer of recent
    (obs_t, obs_{t+1}) transitions, updated every train_interval steps.

    Args:
        env: Gymnasium environment (should already be wrapped with LocalObsWrapper).
        model_type: 'tensor', 'lowrank', or 'embedding'.
        train_interval: Train world model every N steps.
        buffer_size: Max transitions to store for training.
        rank: Latent rank for lowrank model.
        embed_dim: Embedding dimension for embedding model.
    """

    def __init__(self, env, model_type='tensor', train_interval=50,
                 buffer_size=2000, rank=16, embed_dim=16):
        super().__init__(env)

        # Discover num_types from the underlying SokoScript env
        inner = env
        while hasattr(inner, 'env'):
            inner = inner.env
        type_names = inner._setup_board.grammar['types']
        self.n_types = len(type_names)

        inner_shape = env.observation_space.shape
        self.inner_h = inner_shape[0]
        self.inner_w = inner_shape[1]
        self.inner_c = inner_shape[2]

        # Observation: original channels + K prediction channels
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(self.inner_h, self.inner_w, self.inner_c + self.n_types),
            dtype=np.float32,
        )

        # Build world model
        self.model_type = model_type
        from rl.world_models import TransitionTensor
        if model_type == 'tensor':
            self.world_model = TransitionTensor(self.n_types)
        elif model_type == 'lowrank' and HAS_TORCH:
            from rl.world_models import LowRankWorldModel
            self.world_model = LowRankWorldModel(self.n_types, rank=rank)
        elif model_type == 'embedding' and HAS_TORCH:
            from rl.world_models import EmbeddingWorldModel
            self.world_model = EmbeddingWorldModel(
                self.n_types, embed_dim=embed_dim)
        else:
            self.world_model = TransitionTensor(self.n_types)

        # Replay buffer for world model training
        self.buffer = deque(maxlen=buffer_size)
        self.train_interval = train_interval
        self.step_count = 0
        self._last_obs = None

    def _predict_channels(self, obs):
        """Generate K prediction channels from the world model."""
        if self.model_type == 'tensor':
            pred = self.world_model.predict_board(obs[:, :, :self.n_types])
            return pred.astype(np.float32)
        else:
            # PyTorch models: predict per-cell
            from rl.world_models import obs_to_types
            types = obs_to_types(obs[:, :, :self.n_types])
            H, W = types.shape
            pred = np.zeros((H, W, self.n_types), dtype=np.float32)

            shifts = [
                np.roll(types, 1, axis=0),
                np.roll(types, -1, axis=1),
                np.roll(types, -1, axis=0),
                np.roll(types, 1, axis=1),
            ]

            for y in range(H):
                for x in range(W):
                    c = types[y, x]
                    if c < 0:
                        continue
                    neighbors = tuple(shifts[d][y, x] for d in range(4))
                    if any(n < 0 for n in neighbors):
                        continue
                    pred[y, x] = self.world_model.predict_numpy(c, neighbors)

            return pred

    def _augment_obs(self, obs):
        """Append prediction channels to observation."""
        pred = self._predict_channels(obs)
        # Ensure spatial dims match (pred is based on type channels only)
        if pred.shape[0] != obs.shape[0] or pred.shape[1] != obs.shape[1]:
            pred = pred[:obs.shape[0], :obs.shape[1]]
        return np.concatenate([obs, pred], axis=2)

    def _train_world_model(self):
        """Train world model from replay buffer."""
        if len(self.buffer) < 10:
            return

        # Sample a batch
        batch_size = min(len(self.buffer), 200)
        indices = np.random.choice(len(self.buffer), batch_size, replace=False)

        for idx in indices:
            obs_t, obs_tp1 = self.buffer[idx]
            self.world_model.update(
                obs_t[:, :, :self.n_types],
                obs_tp1[:, :, :self.n_types],
            )

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self._last_obs = obs
        self.step_count = 0
        return self._augment_obs(obs), info

    def step(self, action):
        obs, reward, terminated, truncated, info = self.env.step(action)

        # Store transition in replay buffer
        if self._last_obs is not None:
            self.buffer.append((self._last_obs, obs))
        self._last_obs = obs

        # Periodically train world model
        self.step_count += 1
        if self.step_count % self.train_interval == 0:
            self._train_world_model()

        return self._augment_obs(obs), reward, terminated, truncated, info
