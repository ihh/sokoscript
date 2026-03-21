"""Special action wrappers — penalized capabilities that extend agent perception.

Each wrapper adds one or more extra actions to the action space, each with
a time penalty (board evolves without player input). The agent must learn
when the information gain justifies the cost.

Wrappers can be stacked: LocalObs → Look → Stats → Reveal → ...
Each adds its actions after the previous wrapper's action space.

Design principle: the agent should be able to solve the game without these
actions (they're never required), but using them wisely should help.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np


class BoardStatsAction(gym.Wrapper):
    """Adds a 'survey' action that appends board-level type counts to obs.

    Normal observation: whatever the inner env produces, plus a zeroed stats row.
    After 'survey' action: stats row filled with normalized type counts.
    The stats persist for `stats_duration` steps then fade back to zero.

    The observation gains an extra row (1 x obs_width x obs_channels) at the
    bottom, or alternatively stats are appended as extra channels. We use
    extra channels to keep spatial dims consistent for the CNN.

    Args:
        env: Gymnasium environment.
        penalty_dt: Time cost of survey action (seconds).
        stats_duration: Number of steps the stats remain visible after survey.
    """

    def __init__(self, env, penalty_dt=0.2, stats_duration=5):
        super().__init__(env)
        self.penalty_dt = penalty_dt
        self.penalty_ticks = int(penalty_dt * (1 << 32))
        self.stats_duration = stats_duration

        inner_shape = env.observation_space.shape
        self.inner_h, self.inner_w = inner_shape[0], inner_shape[1]
        self.inner_c = inner_shape[2]

        # Add 1 extra channel: normalized type-count heatmap
        # Channel value at each cell = count of that cell's type / total_cells
        # This gives a "density" overlay — bright = common type
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(self.inner_h, self.inner_w, self.inner_c + 1),
            dtype=np.float32,
        )

        # Add survey action
        self.orig_n_actions = env.action_space.n
        self.action_space = spaces.Discrete(self.orig_n_actions + 1)
        self.survey_action = self.orig_n_actions

        self._stats_remaining = 0
        self._last_stats = None

    def _compute_stats_channel(self, obs):
        """Compute density overlay from observation.

        For each cell, the stats channel = (count of that type) / total_cells.
        This tells the agent how common each visible type is board-wide.
        """
        # Get type counts from the underlying SokoScript env
        board = self.env
        while hasattr(board, 'env'):
            board = board.env
        counts = board.board.type_counts_including_unknowns()
        total = sum(counts.values()) or 1

        # Build density channel: for each cell in obs, look up its type's frequency
        stats = np.zeros((self.inner_h, self.inner_w), dtype=np.float32)
        type_names = board._setup_board.grammar['types']

        # Convert counts dict to array indexed by type
        freq = np.zeros(len(type_names), dtype=np.float32)
        for name, count in counts.items():
            idx = next((i for i, n in enumerate(type_names) if n == name), None)
            if idx is not None:
                freq[idx] = count / total

        # For each cell, find which type is active and use its frequency
        inner_obs = obs[:, :, :self.inner_c]
        type_indices = np.argmax(inner_obs, axis=2)
        for y in range(self.inner_h):
            for x in range(self.inner_w):
                if inner_obs[y, x].max() > 0.5:  # not masked
                    stats[y, x] = freq[type_indices[y, x]]

        return stats

    def _augment_obs(self, obs):
        """Add stats channel to observation."""
        if self._stats_remaining > 0 and self._last_stats is not None:
            stats = self._last_stats
            self._stats_remaining -= 1
        else:
            stats = np.zeros((self.inner_h, self.inner_w), dtype=np.float32)

        return np.concatenate([obs, stats[:, :, np.newaxis]], axis=2)

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self._stats_remaining = 0
        self._last_stats = None
        return self._augment_obs(obs), info

    def step(self, action):
        if action == self.survey_action:
            # Survey: don't move, pay time, compute stats
            board = self.env
            while hasattr(board, 'env'):
                board = board.env

            target_time = board.board.time + self.penalty_ticks
            board.board.evolve_to_time(target_time, True)
            board.step_count += 1

            new_score = board._get_score()
            score_delta = new_score - board._last_score
            reward = score_delta * board.score_reward_scale - board.time_penalty
            board._last_score = new_score

            terminated = board.board.by_id.get(board.player_id) is None
            truncated = board.step_count >= board.max_steps

            from sokoscript.env import _board_to_observation
            full_obs = _board_to_observation(board.board, board.num_types)

            # Recompute through any inner wrappers (e.g. LocalObs)
            inner_env = self.env
            if hasattr(inner_env, 'observation'):
                obs = inner_env.observation(full_obs)
            else:
                obs = full_obs

            self._last_stats = self._compute_stats_channel(obs)
            self._stats_remaining = self.stats_duration

            info = {'score': new_score, 'step': board.step_count, 'surveyed': True}
            return self._augment_obs(obs), reward, terminated, truncated, info
        else:
            obs, reward, terminated, truncated, info = self.env.step(action)
            info['surveyed'] = False
            return self._augment_obs(obs), reward, terminated, truncated, info


class RuleRevealAction(gym.Wrapper):
    """Adds a 'divine' action that reveals which grammar rule would fire next.

    After the 'divine' action, an extra channel in the observation highlights
    cells that are involved in the next pending rule application. This gives
    the agent a one-step lookahead into the simulation — "what's about to
    happen?" — at the cost of a time penalty.

    The highlight persists for 1 step only.

    Args:
        env: Gymnasium environment.
        penalty_dt: Time cost of divine action (seconds).
    """

    def __init__(self, env, penalty_dt=0.3):
        super().__init__(env)
        self.penalty_dt = penalty_dt
        self.penalty_ticks = int(penalty_dt * (1 << 32))

        inner_shape = env.observation_space.shape
        self.inner_h, self.inner_w = inner_shape[0], inner_shape[1]
        self.inner_c = inner_shape[2]

        # Add 1 extra channel: rule-highlight overlay
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(self.inner_h, self.inner_w, self.inner_c + 1),
            dtype=np.float32,
        )

        self.orig_n_actions = env.action_space.n
        self.action_space = spaces.Discrete(self.orig_n_actions + 1)
        self.divine_action = self.orig_n_actions

        self._highlight = None

    def _compute_highlight(self):
        """Ask the board what rule fires next, highlight involved cells."""
        board_env = self.env
        while hasattr(board_env, 'env'):
            board_env = board_env.env
        board = board_env.board

        highlight = np.zeros((board.size, board.size), dtype=np.float32)

        # Peek at the next rule that would fire
        result = board.next_rule(max_wait=1000000)
        if result is not None:
            x, y = result.get('x', -1), result.get('y', -1)
            if 0 <= x < board.size and 0 <= y < board.size:
                highlight[y, x] = 1.0
            # Also highlight neighbor cells involved
            nx, ny = result.get('nx', -1), result.get('ny', -1)
            if 0 <= nx < board.size and 0 <= ny < board.size:
                highlight[ny, nx] = 1.0

        return highlight

    def _get_player_pos(self, obs):
        """Try to find player position for windowing the highlight."""
        board_env = self.env
        while hasattr(board_env, 'env'):
            board_env = board_env.env
        idx = board_env.board.by_id.get(board_env.player_id)
        if idx is None:
            return None
        return divmod(idx, board_env.board.size)  # (y, x)

    def _window_highlight(self, full_highlight):
        """Crop highlight to match the observation dimensions."""
        if self.inner_h >= full_highlight.shape[0]:
            # Obs is full-board or larger — just return as-is or pad
            return full_highlight[:self.inner_h, :self.inner_w]

        # Obs is windowed — find player and crop the highlight to match
        pos = self._get_player_pos(None)
        if pos is None:
            return np.zeros((self.inner_h, self.inner_w), dtype=np.float32)

        py, px = pos
        board_size = full_highlight.shape[0]
        half_h = self.inner_h // 2
        half_w = self.inner_w // 2
        rows = np.arange(py - half_h, py + half_h + 1) % board_size
        cols = np.arange(px - half_w, px + half_w + 1) % board_size
        return full_highlight[np.ix_(rows, cols)]

    def _augment_obs(self, obs):
        # obs may have more channels than inner_c if other wrappers added channels
        obs_h, obs_w = obs.shape[0], obs.shape[1]
        if self._highlight is not None:
            h = self._window_highlight(self._highlight)
            # Ensure highlight matches obs spatial dims
            if h.shape[0] != obs_h or h.shape[1] != obs_w:
                h = h[:obs_h, :obs_w] if h.shape[0] >= obs_h else np.pad(
                    h, ((0, obs_h - h.shape[0]), (0, obs_w - h.shape[1])))
            self._highlight = None  # One-shot
        else:
            h = np.zeros((obs_h, obs_w), dtype=np.float32)
        return np.concatenate([obs, h[:, :, np.newaxis]], axis=2)

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self._highlight = None
        return self._augment_obs(obs), info

    def step(self, action):
        if action == self.divine_action:
            board_env = self.env
            while hasattr(board_env, 'env'):
                board_env = board_env.env

            # Compute highlight BEFORE evolving (show what's about to happen)
            self._highlight = self._compute_highlight()

            # Pay time penalty
            target_time = board_env.board.time + self.penalty_ticks
            board_env.board.evolve_to_time(target_time, True)
            board_env.step_count += 1

            new_score = board_env._get_score()
            score_delta = new_score - board_env._last_score
            reward = score_delta * board_env.score_reward_scale - board_env.time_penalty
            board_env._last_score = new_score

            terminated = board_env.board.by_id.get(board_env.player_id) is None
            truncated = board_env.step_count >= board_env.max_steps

            from sokoscript.env import _board_to_observation
            full_obs = _board_to_observation(board_env.board, board_env.num_types)
            inner_env = self.env
            if hasattr(inner_env, 'observation'):
                obs = inner_env.observation(full_obs)
            else:
                obs = full_obs

            info = {'score': new_score, 'step': board_env.step_count, 'divined': True}
            return self._augment_obs(obs), reward, terminated, truncated, info
        else:
            obs, reward, terminated, truncated, info = self.env.step(action)
            info['divined'] = False
            return self._augment_obs(obs), reward, terminated, truncated, info
