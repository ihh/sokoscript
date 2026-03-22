"""World models for SokoScript RL agents.

Three architectures for learning the game's transition dynamics:
  A. TransitionTensor — count-based, per-direction T[x,n,y] tables
  B. LowRankWorldModel — factored T ≈ U·V with R latent rule slots
  C. EmbeddingWorldModel — types in shared embedding space, MLP rules

All can be trained from (obs_t, obs_{t+1}) pairs or from divine action
observations (cleaner single-rule signal).
"""

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


# ---------------------------------------------------------------------------
# Shared utilities
# ---------------------------------------------------------------------------

def obs_to_types(obs):
    """Convert one-hot observation (H, W, C) to type index array (H, W).

    Handles mask channel: if a cell is all zeros (masked), returns -1.
    """
    if obs.ndim == 3:
        types = np.argmax(obs, axis=2)
        # Mark masked cells (where no channel is active)
        masked = obs.max(axis=2) < 0.5
        types[masked] = -1
        return types
    return obs


def extract_transitions(obs_t, obs_tp1):
    """Extract (cell_type, neighbor_types_NESW, next_type) from a board pair.

    Returns list of (cell, (n_N, n_E, n_S, n_W), next_cell) tuples.
    Skips masked cells (type == -1) and cells that didn't change type.
    """
    types_t = obs_to_types(obs_t)
    types_tp1 = obs_to_types(obs_tp1)
    H, W = types_t.shape

    transitions = []
    for y in range(H):
        for x in range(W):
            cell = types_t[y, x]
            next_cell = types_tp1[y, x]
            if cell < 0 or next_cell < 0:
                continue
            neighbors = (
                types_t[(y - 1) % H, x],   # N
                types_t[y, (x + 1) % W],   # E
                types_t[(y + 1) % H, x],   # S
                types_t[y, (x - 1) % W],   # W
            )
            if any(n < 0 for n in neighbors):
                continue
            transitions.append((cell, neighbors, next_cell))

    return transitions


# ---------------------------------------------------------------------------
# Model A: Transition Tensor (count-based, numpy)
# ---------------------------------------------------------------------------

class TransitionTensor:
    """Per-direction transition count table T[dir, cell, neighbor, next].

    Simple Bayesian update: counts + Dirichlet smoothing.
    """

    def __init__(self, num_types, smoothing=1e-2):
        self.num_types = num_types
        self.smoothing = smoothing
        # (4 directions, K source types, K neighbor types, K target types)
        self.counts = np.zeros((4, num_types, num_types, num_types),
                               dtype=np.float64)

    def update(self, obs_t, obs_tp1):
        """Update counts from an observation pair."""
        types_t = obs_to_types(obs_t)
        types_tp1 = obs_to_types(obs_tp1)
        H, W = types_t.shape

        # Vectorized: for each direction, shift the board and count transitions
        shifts = [
            np.roll(types_t, 1, axis=0),   # N neighbor (row above)
            np.roll(types_t, -1, axis=1),   # E neighbor (col right)
            np.roll(types_t, -1, axis=0),   # S neighbor (row below)
            np.roll(types_t, 1, axis=1),    # W neighbor (col left)
        ]

        valid = (types_t >= 0) & (types_tp1 >= 0)
        for d, neighbor in enumerate(shifts):
            mask = valid & (neighbor >= 0)
            c = types_t[mask]
            n = neighbor[mask]
            t = types_tp1[mask]
            np.add.at(self.counts[d], (c, n, t), 1)

    def predict(self, cell_type, neighbor_types):
        """P(next_type | cell, neighbors) averaged over directions."""
        probs = np.zeros(self.num_types)
        for d, n in enumerate(neighbor_types):
            row = self.counts[d, cell_type, n] + self.smoothing
            probs += row / row.sum()
        return probs / 4

    def predict_board(self, obs):
        """Predict next type distribution for each cell."""
        types = obs_to_types(obs)
        H, W = types.shape
        pred = np.zeros((H, W, self.num_types))

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
                for d in range(4):
                    n = shifts[d][y, x]
                    if n < 0:
                        continue
                    row = self.counts[d, c, n] + self.smoothing
                    pred[y, x] += row / row.sum()
                pred[y, x] /= 4

        return pred

    def accuracy(self, obs_t, obs_tp1):
        """Fraction of cells where argmax prediction matches actual next type."""
        pred = self.predict_board(obs_t)
        types_tp1 = obs_to_types(obs_tp1)
        pred_types = np.argmax(pred, axis=2)
        valid = types_tp1 >= 0
        return (pred_types[valid] == types_tp1[valid]).mean()

    def save(self, path):
        np.save(path, self.counts)

    def load(self, path):
        self.counts = np.load(path)


# ---------------------------------------------------------------------------
# Model B: Low-Rank Factored (PyTorch, differentiable)
# ---------------------------------------------------------------------------

if HAS_TORCH:
    class LowRankWorldModel(nn.Module):
        """T[x, n, y] ≈ Σ_r softmax(U[x,n,r]) · softmax(V[r,y]).

        R latent "rule slots" — each learns to represent one grammar rule.
        """

        def __init__(self, num_types, rank=32, lr=1e-3):
            super().__init__()
            self.num_types = num_types
            self.rank = rank

            # U: (K, K, R) — which rule slot activates for (cell, neighbor) pair
            self.U = nn.Parameter(torch.randn(num_types, num_types, rank) * 0.1)
            # V: (R, K) — what each rule slot produces
            self.V = nn.Parameter(torch.randn(rank, num_types) * 0.1)

            self.optimizer = torch.optim.Adam(self.parameters(), lr=lr)

        def forward(self, cell_types, neighbor_types):
            """Predict P(next_type | cell, neighbor).

            cell_types, neighbor_types: (batch,) long tensors
            Returns: (batch, K) log-probabilities
            """
            u = self.U[cell_types, neighbor_types]  # (batch, R)
            slot_weights = F.softmax(u, dim=-1)     # (batch, R)
            v = F.softmax(self.V, dim=-1)           # (R, K)
            probs = slot_weights @ v                 # (batch, K)
            return torch.log(probs + 1e-8)

        def update(self, obs_t, obs_tp1):
            """Train from an observation pair."""
            transitions = extract_transitions(obs_t, obs_tp1)
            if not transitions:
                return 0.0

            cells = torch.tensor([t[0] for t in transitions], dtype=torch.long)
            # Average over 4 directions for simplicity
            all_loss = 0.0
            count = 0
            for d in range(4):
                neighbors = torch.tensor([t[1][d] for t in transitions], dtype=torch.long)
                targets = torch.tensor([t[2] for t in transitions], dtype=torch.long)

                log_probs = self.forward(cells, neighbors)
                loss = F.nll_loss(log_probs, targets)

                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                all_loss += loss.item()
                count += 1

            return all_loss / max(count, 1)

        def predict_numpy(self, cell_type, neighbor_types):
            """Numpy-compatible predict for single cell."""
            with torch.no_grad():
                probs = torch.zeros(self.num_types)
                for d, n in enumerate(neighbor_types):
                    c = torch.tensor([cell_type], dtype=torch.long)
                    nb = torch.tensor([n], dtype=torch.long)
                    log_p = self.forward(c, nb)
                    probs += torch.exp(log_p[0])
                return (probs / 4).numpy()

    class EmbeddingWorldModel(nn.Module):
        """Types share an embedding space; rules are learned linear maps.

        rule_mlp([e_cell; e_neighbor]) → e_output
        P(next_type) = softmax(E^T · e_output)
        """

        def __init__(self, num_types, embed_dim=32, hidden_dim=64, lr=1e-3):
            super().__init__()
            self.num_types = num_types
            self.embed_dim = embed_dim

            self.embeddings = nn.Embedding(num_types, embed_dim)
            self.rule_mlp = nn.Sequential(
                nn.Linear(embed_dim * 2, hidden_dim),
                nn.ReLU(),
                nn.Linear(hidden_dim, hidden_dim),
                nn.ReLU(),
            )
            self.type_head = nn.Linear(hidden_dim, embed_dim)
            self.reward_head = nn.Linear(hidden_dim, 1)

            self.optimizer = torch.optim.Adam(self.parameters(), lr=lr)

        def forward(self, cell_types, neighbor_types):
            """Predict P(next_type | cell, neighbor).

            Returns: (batch, K) log-probabilities
            """
            e_cell = self.embeddings(cell_types)         # (batch, d)
            e_neighbor = self.embeddings(neighbor_types)  # (batch, d)
            h = self.rule_mlp(torch.cat([e_cell, e_neighbor], dim=-1))
            e_out = self.type_head(h)                    # (batch, d)
            E = self.embeddings.weight                   # (K, d)
            logits = e_out @ E.T                         # (batch, K)
            return F.log_softmax(logits, dim=-1)

        def predict_reward(self, cell_types, neighbor_types):
            """Predict expected reward for a transition."""
            e_cell = self.embeddings(cell_types)
            e_neighbor = self.embeddings(neighbor_types)
            h = self.rule_mlp(torch.cat([e_cell, e_neighbor], dim=-1))
            return self.reward_head(h).squeeze(-1)

        def update(self, obs_t, obs_tp1):
            """Train from an observation pair."""
            transitions = extract_transitions(obs_t, obs_tp1)
            if not transitions:
                return 0.0

            cells = torch.tensor([t[0] for t in transitions], dtype=torch.long)
            all_loss = 0.0
            count = 0
            for d in range(4):
                neighbors = torch.tensor([t[1][d] for t in transitions], dtype=torch.long)
                targets = torch.tensor([t[2] for t in transitions], dtype=torch.long)

                log_probs = self.forward(cells, neighbors)
                loss = F.nll_loss(log_probs, targets)

                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                all_loss += loss.item()
                count += 1

            return all_loss / max(count, 1)

        def predict_numpy(self, cell_type, neighbor_types):
            with torch.no_grad():
                probs = torch.zeros(self.num_types)
                for d, n in enumerate(neighbor_types):
                    c = torch.tensor([cell_type], dtype=torch.long)
                    nb = torch.tensor([n], dtype=torch.long)
                    log_p = self.forward(c, nb)
                    probs += torch.exp(log_p[0])
                return (probs / 4).numpy()


# ---------------------------------------------------------------------------
# World Model Trainer — works with any model + env
# ---------------------------------------------------------------------------

class WorldModelTrainer:
    """Trains a world model from environment episodes or PPO rollout data."""

    def __init__(self, model):
        self.model = model

    def train_from_episodes(self, env, n_episodes=100, seed=42):
        """Collect random episodes and train the world model."""
        losses = []
        for ep in range(n_episodes):
            obs, _ = env.reset(seed=seed + ep)
            done = False
            while not done:
                prev_obs = obs
                action = env.action_space.sample()
                obs, _, terminated, truncated, _ = env.step(action)
                loss = self.model.update(prev_obs, obs)
                if loss:
                    losses.append(loss)
                done = terminated or truncated
        return np.mean(losses) if losses else 0.0

    def train_from_rollout_buffer(self, observations, episode_starts):
        """Train from SB3 rollout buffer data.

        observations: (n_steps, n_envs, H, W, C) float32
        episode_starts: (n_steps, n_envs) bool
        """
        n_steps, n_envs = observations.shape[:2]
        losses = []

        for t in range(n_steps - 1):
            for e in range(n_envs):
                # Skip episode boundaries
                if episode_starts[t + 1, e]:
                    continue
                obs_t = observations[t, e]
                obs_tp1 = observations[t + 1, e]
                loss = self.model.update(obs_t, obs_tp1)
                if loss:
                    losses.append(loss)

        return np.mean(losses) if losses else 0.0


# ---------------------------------------------------------------------------
# SB3 Callback for world model training alongside PPO
# ---------------------------------------------------------------------------

if HAS_TORCH:
    from stable_baselines3.common.callbacks import BaseCallback

    class WorldModelCallback(BaseCallback):
        """Train a world model from PPO rollout data after each collection."""

        def __init__(self, world_model, verbose=0):
            super().__init__(verbose)
            self.trainer = WorldModelTrainer(world_model)
            self.losses = []

        def _on_rollout_end(self):
            obs = self.model.rollout_buffer.observations
            starts = self.model.rollout_buffer.episode_starts
            loss = self.trainer.train_from_rollout_buffer(obs, starts)
            self.losses.append(loss)
            if self.verbose > 0 and len(self.losses) % 10 == 0:
                print(f"  [WorldModel] loss={loss:.4f} (avg={np.mean(self.losses[-10:]):.4f})")
            return True
