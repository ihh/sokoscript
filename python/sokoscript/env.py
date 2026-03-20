"""Gymnasium environment for SokoScript games.

Wraps a Board with Gymnasium API for RL training.
"""

try:
    import gymnasium as gym
    from gymnasium import spaces
    HAS_GYM = True
except ImportError:
    HAS_GYM = False

import numpy as np
from .board import Board
from . import lookups


def _board_to_observation(board, num_types):
    """Convert board cell types to one-hot observation array."""
    size = board.size
    obs = np.zeros((size, size, num_types), dtype=np.float32)
    for idx, cell in enumerate(board.cell):
        y, x = divmod(idx, size)
        obs[y, x, cell['type']] = 1.0
    return obs


class SokoScriptEnv(gym.Env if HAS_GYM else object):
    """Gymnasium environment for SokoScript games.

    Args:
        grammar: Grammar text string.
        board_size: Size of the board (square).
        player_id: ID of the player-controlled cell.
        dt: Time step per action (in seconds, converted to ticks).
        max_steps: Maximum steps per episode.
        board_init_fn: Callable(board) to initialize board state on reset.
        score_reward_scale: Multiplier for score-based reward.
        time_penalty: Penalty per time step.
        custom_reward_fn: Optional callable(old_board_json, new_board_json, action) -> float.
    """

    metadata = {'render_modes': ['ansi']}

    def __init__(self, grammar, board_size=16, player_id='p1',
                 dt=0.1, max_steps=1000, board_init_fn=None,
                 score_reward_scale=1.0, time_penalty=0.0,
                 custom_reward_fn=None, render_mode=None, seed=None):
        if not HAS_GYM:
            raise ImportError("gymnasium not installed. Install with: pip install gymnasium")

        super().__init__()
        self.grammar = grammar
        self.board_size = board_size
        self.player_id = player_id
        self.dt = dt
        self.dt_ticks = int(dt * (1 << 32))
        self.max_steps = max_steps
        self.board_init_fn = board_init_fn
        self.score_reward_scale = score_reward_scale
        self.time_penalty = time_penalty
        self.custom_reward_fn = custom_reward_fn
        self.render_mode = render_mode
        self._seed = seed

        # Create a temporary board to discover types and key bindings
        self._setup_board = Board({'size': board_size, 'grammar': grammar})
        self.num_types = len(self._setup_board.grammar['types'])

        # Discover available key bindings
        self.keys = self._discover_keys()
        if not self.keys:
            # If no key bindings, use NESW as default actions
            self.keys = ['w', 'a', 's', 'd']

        # Spaces
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(board_size, board_size, self.num_types),
            dtype=np.float32
        )
        self.action_space = spaces.Discrete(len(self.keys))

        self.board = None
        self.step_count = 0

    def _discover_keys(self):
        """Scan compiled grammar for key bindings."""
        keys = set()
        for type_keys in self._setup_board.grammar['key']:
            keys.update(type_keys.keys())
        return sorted(keys)

    def _get_score(self):
        index = self.board.by_id.get(self.player_id)
        if index is None:
            return 0
        cell = self.board.cell[index]
        return cell.get('meta', {}).get('score', 0)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        rng_seed = seed if seed is not None else self._seed
        self.board = Board({
            'size': self.board_size,
            'grammar': self.grammar,
            'seed': rng_seed or 42,
        })
        if self.board_init_fn:
            self.board_init_fn(self.board)
        self.step_count = 0
        self._last_score = self._get_score()
        obs = _board_to_observation(self.board, self.num_types)
        info = {'type_counts': self.board.type_counts_including_unknowns()}
        return obs, info

    def step(self, action):
        assert self.board is not None, "Must call reset() before step()"

        key = self.keys[action]
        index = self.board.by_id.get(self.player_id)
        if index is not None:
            cell = self.board.cell[index]
            # Determine direction based on key
            key_to_dir = {'w': 'N', 'a': 'W', 's': 'S', 'd': 'E'}
            direction = key_to_dir.get(key, 'N')
            move = {
                'type': 'command',
                'time': self.board.time + 1,
                'id': self.player_id,
                'dir': direction,
                'key': key,
            }
            self.board.process_move(move)

        # Evolve board
        target_time = self.board.time + self.dt_ticks
        self.board.evolve_to_time(target_time, True)

        # Compute reward
        new_score = self._get_score()
        score_delta = new_score - self._last_score
        reward = score_delta * self.score_reward_scale - self.time_penalty

        if self.custom_reward_fn:
            reward += self.custom_reward_fn(self.board, action)

        self._last_score = new_score
        self.step_count += 1

        # Check termination
        terminated = False
        truncated = self.step_count >= self.max_steps

        # Check if player still exists
        if self.board.by_id.get(self.player_id) is None:
            terminated = True

        obs = _board_to_observation(self.board, self.num_types)
        info = {
            'score': new_score,
            'type_counts': self.board.type_counts_including_unknowns(),
            'step': self.step_count,
        }

        return obs, reward, terminated, truncated, info

    def render(self):
        if self.render_mode == 'ansi':
            return self._render_ansi()
        return None

    def _render_ansi(self):
        if self.board is None:
            return ''
        lines = []
        for y in range(self.board.size):
            row = ''
            for x in range(self.board.size):
                cell = self.board.get_cell(x, y)
                type_name = self.board.grammar['types'][cell['type']]
                if type_name == '_':
                    row += '.'
                else:
                    row += type_name[0].upper()
            lines.append(row)
        return '\n'.join(lines)
