"""Local observation wrapper — crops board to NxN window around player.

Toroidal cropping: the window wraps around board edges, matching the
game's toroidal topology. This gives the agent a local receptive field
without losing information about nearby wrap-around neighbors.

The MaskedLocalObsWrapper adds a "look" action that temporarily unmasks
a 4x-area (2x-linear) field of view for the next observation, at the
cost of a configurable time penalty (the agent's next turn is delayed).

Usage:
    env = LocalObsWrapper(env, window_size=11, player_type='player')
    env = MaskedLocalObsWrapper(env, window_size=11, look_penalty_dt=0.3)
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


def _find_player(obs, player_idx):
    """Find player (y, x) from full-board observation."""
    ys, xs = np.where(obs[:, :, player_idx] > 0.5)
    if len(ys) == 0:
        return None
    return ys[0], xs[0]


def _extract_window(obs, py, px, half, board_size):
    """Extract a (2*half+1) x (2*half+1) window with toroidal wrapping."""
    rows = np.arange(py - half, py + half + 1) % board_size
    cols = np.arange(px - half, px + half + 1) % board_size
    return obs[np.ix_(rows, cols)]


class MaskedLocalObsWrapper(gym.Wrapper):
    """Local observation with a masked outer ring and a 'look' action.

    The observation is always big_window x big_window (the unmasked size).
    Channels: num_types + 1 (the last channel is a mask indicator).

    Normal observation:
        Inner window_size x window_size: actual cell types, mask=0
        Outer ring: all type channels=0, mask=1

    After the 'look' action:
        Full big_window x big_window: actual cell types, mask=0
        The agent does NOT move. A time penalty is applied (extra board
        evolution without player input, simulating the agent pausing to
        survey the area). The unmasked view is returned as the next obs.

    Args:
        env: SokoScriptEnv instance.
        window_size: Side length of the normal (inner) view (must be odd).
        player_type: Name of the player type to center on.
        look_penalty_dt: Extra time (seconds) the board evolves when looking.
            Higher = more costly to look (more things happen while you stand still).
    """

    def __init__(self, env, window_size=11, player_type='player',
                 look_penalty_dt=0.2):
        super().__init__(env)
        assert window_size % 2 == 1, "window_size must be odd"
        self.window_size = window_size
        self.half = window_size // 2

        # Big window is 2x linear (4x area)
        self.big_window = window_size * 2 - 1  # keeps it odd
        self.big_half = self.big_window // 2

        # Find player type index
        type_names = env._setup_board.grammar['types']
        self.player_idx = next(i for i, n in enumerate(type_names)
                               if n == player_type)
        self.num_types = len(type_names)
        self.board_size = env.board_size
        self.look_penalty_dt = look_penalty_dt
        self.look_penalty_ticks = int(look_penalty_dt * (1 << 32))

        # Observation: big_window x big_window x (num_types + 1 mask channel)
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(self.big_window, self.big_window, self.num_types + 1),
            dtype=np.float32,
        )

        # Action: original actions + 1 look action (last index)
        self.orig_n_actions = env.action_space.n
        self.action_space = spaces.Discrete(self.orig_n_actions + 1)
        self.look_action = self.orig_n_actions

        self._unmasked_next = False
        self._last_full_obs = None

    def _make_obs(self, full_obs, unmasked=False):
        """Build the masked/unmasked observation from full board obs."""
        pos = _find_player(full_obs, self.player_idx)
        bw = self.big_window
        out = np.zeros((bw, bw, self.num_types + 1), dtype=np.float32)

        if pos is None:
            # Player dead — all masked
            out[:, :, -1] = 1.0
            return out

        py, px = pos

        # Always extract the big window
        big_patch = _extract_window(full_obs, py, px, self.big_half,
                                    self.board_size)

        if unmasked:
            # Full big window visible
            out[:, :, :self.num_types] = big_patch
            # mask channel = 0 everywhere
        else:
            # Only inner window visible, outer ring masked
            margin = self.big_half - self.half
            # Fill everything with mask first
            out[:, :, -1] = 1.0
            # Unmask the inner window
            inner = big_patch[margin:margin + self.window_size,
                              margin:margin + self.window_size]
            out[margin:margin + self.window_size,
                margin:margin + self.window_size, :self.num_types] = inner
            out[margin:margin + self.window_size,
                margin:margin + self.window_size, -1] = 0.0

        return out

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self._unmasked_next = False
        self._last_full_obs = obs
        return self._make_obs(obs, unmasked=False), info

    def step(self, action):
        if action == self.look_action:
            # Look action: don't move, pay time penalty, get unmasked view
            board = self.env.board
            target_time = board.time + self.look_penalty_ticks
            board.evolve_to_time(target_time, True)

            # Update step count and check truncation
            self.env.step_count += 1
            truncated = self.env.step_count >= self.env.max_steps

            # Recompute score for time penalty
            new_score = self.env._get_score()
            score_delta = new_score - self.env._last_score
            reward = score_delta * self.env.score_reward_scale - self.env.time_penalty
            self.env._last_score = new_score

            # Check if player still exists
            terminated = self.env.board.by_id.get(self.env.player_id) is None

            from sokoscript.env import _board_to_observation
            full_obs = _board_to_observation(board, self.num_types)
            self._last_full_obs = full_obs

            info = {
                'score': new_score,
                'step': self.env.step_count,
                'looked': True,
            }

            return self._make_obs(full_obs, unmasked=True), reward, terminated, truncated, info
        else:
            # Normal action: pass through to env
            obs, reward, terminated, truncated, info = self.env.step(action)
            self._last_full_obs = obs
            info['looked'] = False
            return self._make_obs(obs, unmasked=False), reward, terminated, truncated, info
