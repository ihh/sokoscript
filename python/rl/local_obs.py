"""Local observation wrapper — crops board to NxN window around player.

Toroidal cropping: the window wraps around board edges, matching the
game's toroidal topology. This gives the agent a local receptive field
without losing information about nearby wrap-around neighbors.

Usage:
    env = LocalObsWrapper(env, window_size=11, player_type='player')
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np


class LocalObsWrapper(gym.ObservationWrapper):
    """Crop observation to a local window around the player.

    Args:
        env: SokoScriptEnv instance.
        window_size: Side length of the square crop (must be odd).
        player_type: Name of the player type to center on.
    """

    def __init__(self, env, window_size=11, player_type='player'):
        super().__init__(env)
        assert window_size % 2 == 1, "window_size must be odd"
        self.window_size = window_size
        self.half = window_size // 2

        # Find player type index
        type_names = env._setup_board.grammar['types']
        self.player_idx = next(i for i, n in enumerate(type_names) if n == player_type)
        self.num_types = len(type_names)
        self.board_size = env.board_size

        # Override observation space
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(window_size, window_size, self.num_types),
            dtype=np.float32,
        )

    def observation(self, obs):
        """Crop obs to window centered on player, with toroidal wrapping."""
        # Find player position
        ys, xs = np.where(obs[:, :, self.player_idx] > 0.5)
        if len(ys) == 0:
            # Player dead — return zeros
            return np.zeros(self.observation_space.shape, dtype=np.float32)

        py, px = ys[0], xs[0]

        # Extract window with toroidal wrapping using np.take (handles wrap)
        rows = np.arange(py - self.half, py + self.half + 1) % self.board_size
        cols = np.arange(px - self.half, px + self.half + 1) % self.board_size

        # Advanced indexing: obs[rows][:, cols] with proper broadcasting
        return obs[np.ix_(rows, cols)]
