"""Two-player wrapper for SokoScript RL environments.

Two PPO agents share a board, each controlling their own player.
Actions alternate: player 1 acts, board evolves dt, player 2 acts,
board evolves dt, repeat. Each player has their own local observation
window centered on their own position.

The wrapper presents as a single-agent env from each player's perspective.
Use TwoPlayerTrainer to train both agents via self-play.

Usage:
    env1, env2 = make_two_player_dominion(board_size=16, seed=42)
    # env1 is player 1's view, env2 is player 2's view
    # They share the same underlying board
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np

from .local_obs import _find_player, _extract_window


class TwoPlayerBoard:
    """Shared board state for two players.

    Manages turn alternation and observation generation for both players.
    """

    def __init__(self, grammar, board_size, player1_id, player2_id,
                 dt=1.0, max_steps=500, board_init_fn=None,
                 score_reward_scale=1.0, time_penalty=0.005, seed=None):
        from sokoscript.board import Board
        from sokoscript.env import _board_to_observation

        self.grammar = grammar
        self.board_size = board_size
        self.player1_id = player1_id
        self.player2_id = player2_id
        self.dt = dt
        self.dt_ticks = int(dt * (1 << 32))
        self.max_steps = max_steps
        self.board_init_fn = board_init_fn
        self.score_reward_scale = score_reward_scale
        self.time_penalty = time_penalty
        self._seed = seed
        self._board_to_obs = _board_to_observation

        # Discover types
        self._setup_board = Board({'size': board_size, 'grammar': grammar})
        self.num_types = len(self._setup_board.grammar['types'])

        # Discover keys
        keys = set()
        for type_keys in self._setup_board.grammar['key']:
            keys.update(type_keys.keys())
        self.keys = sorted(keys) or ['w', 'a', 's', 'd']
        self.key_to_dir = {'w': 'N', 'a': 'W', 's': 'S', 'd': 'E'}

        self.board = None
        self.step_count = 0
        self._scores = {player1_id: 0, player2_id: 0}

    def reset(self, seed=None):
        from sokoscript.board import Board
        rng_seed = seed if seed is not None else self._seed
        self.board = Board({
            'size': self.board_size,
            'grammar': self.grammar,
            'seed': rng_seed or 42,
        })
        if self.board_init_fn:
            self.board_init_fn(self.board)
        self.step_count = 0
        self._scores = {self.player1_id: 0, self.player2_id: 0}
        return self._board_to_obs(self.board, self.num_types)

    def get_score(self, player_id):
        index = self.board.by_id.get(player_id)
        if index is None:
            return self._scores.get(player_id, 0)
        cell = self.board.cell[index]
        score = cell.get('meta', {}).get('score', 0)
        self._scores[player_id] = score
        return score

    def player_alive(self, player_id):
        return self.board.by_id.get(player_id) is not None

    def player_position(self, player_id):
        """Return (y, x) of player, or None."""
        index = self.board.by_id.get(player_id)
        if index is None:
            return None
        x, y = divmod(index, self.board.size)
        # board stores row-major: index = y * size + x
        return (index // self.board.size, index % self.board.size)

    def act(self, player_id, key):
        """Execute one action for a player, then evolve the board."""
        index = self.board.by_id.get(player_id)
        if index is not None:
            direction = self.key_to_dir.get(key, 'N')
            move = {
                'type': 'command',
                'time': self.board.time + 1,
                'id': player_id,
                'dir': direction,
                'key': key,
            }
            self.board.process_move(move)

        # Evolve board
        target_time = self.board.time + self.dt_ticks
        self.board.evolve_to_time(target_time, True)
        self.step_count += 1

    def get_obs(self):
        return self._board_to_obs(self.board, self.num_types)

    @property
    def done(self):
        return self.step_count >= self.max_steps


class TwoPlayerEnv(gym.Env):
    """Single-player view of a two-player game.

    Wraps a TwoPlayerBoard, presenting it as a standard Gymnasium env
    from one player's perspective. The opponent acts via a provided
    policy function (or does nothing if None).

    Args:
        shared_board: TwoPlayerBoard instance.
        my_id: This player's ID.
        opponent_id: The other player's ID.
        opponent_policy: Callable(obs) -> action_idx, or None (opponent skips).
        window_size: Local observation window (must be odd).
        player_type: Type name of this player (for finding position).
        divine_penalty_dt: If > 0, adds a divine action.
    """

    metadata = {'render_modes': ['ansi']}

    def __init__(self, shared_board, my_id, opponent_id,
                 opponent_policy=None, window_size=11,
                 player_type='herald', divine_penalty_dt=0.2):
        super().__init__()
        self.board = shared_board
        self.my_id = my_id
        self.opponent_id = opponent_id
        self.opponent_policy = opponent_policy
        self.window_size = window_size
        self.half = window_size // 2
        self.divine_penalty_dt = divine_penalty_dt
        self.divine_ticks = int(divine_penalty_dt * (1 << 32))

        # Find player type index
        type_names = shared_board._setup_board.grammar['types']
        self.player_type_idx = next(
            i for i, n in enumerate(type_names) if n == player_type)
        self.num_types = shared_board.num_types

        # Observation: local window with type channels
        n_channels = self.num_types
        self.observation_space = spaces.Box(
            low=0, high=1,
            shape=(window_size, window_size, n_channels),
            dtype=np.float32,
        )

        # Actions: WASD + optional divine
        n_actions = len(shared_board.keys)
        if divine_penalty_dt > 0:
            n_actions += 1
        self.action_space = spaces.Discrete(n_actions)
        self.divine_action = len(shared_board.keys) if divine_penalty_dt > 0 else None

        self._last_score = 0

    def _get_local_obs(self, full_obs):
        """Crop observation to local window around this player."""
        pos = self.board.player_position(self.my_id)
        if pos is None:
            return np.zeros(self.observation_space.shape, dtype=np.float32)
        py, px = pos
        return _extract_window(full_obs, py, px, self.half, self.board.board_size)

    def reset(self, seed=None, options=None):
        full_obs = self.board.reset(seed=seed)
        self._last_score = self.board.get_score(self.my_id)
        obs = self._get_local_obs(full_obs)
        return obs, {}

    def step(self, action):
        if action == self.divine_action:
            # Divine: pay time, don't move, get observation
            self.board.board.evolve_to_time(
                self.board.board.time + self.divine_ticks, True)
            self.board.step_count += 1
        else:
            # Normal move
            key = self.board.keys[action]
            self.board.act(self.my_id, key)

        # Opponent acts
        if self.opponent_policy is not None and self.board.player_alive(self.opponent_id):
            full_obs = self.board.get_obs()
            opp_pos = self.board.player_position(self.opponent_id)
            if opp_pos is not None:
                opp_obs = _extract_window(full_obs, opp_pos[0], opp_pos[1],
                                          self.half, self.board.board_size)
                opp_action = self.opponent_policy(opp_obs)
                if opp_action == self.divine_action:
                    # Opponent divines
                    self.board.board.evolve_to_time(
                        self.board.board.time + self.divine_ticks, True)
                    self.board.step_count += 1
                else:
                    opp_key = self.board.keys[opp_action]
                    self.board.act(self.opponent_id, opp_key)

        # Compute reward
        new_score = self.board.get_score(self.my_id)
        score_delta = new_score - self._last_score
        reward = score_delta * self.board.score_reward_scale - self.board.time_penalty
        self._last_score = new_score

        # Check termination
        terminated = not self.board.player_alive(self.my_id)
        truncated = self.board.done

        full_obs = self.board.get_obs()
        obs = self._get_local_obs(full_obs)
        info = {
            'score': new_score,
            'opponent_score': self.board.get_score(self.opponent_id),
            'opponent_alive': self.board.player_alive(self.opponent_id),
            'step': self.board.step_count,
        }

        return obs, reward, terminated, truncated, info


def make_two_player_dominion(board_size=16, seed=None, dt=1.0,
                             window_size=11, divine_penalty_dt=0.2):
    """Create a two-player Dominion environment.

    Returns (env1, env2, shared_board) where env1 and env2 are
    TwoPlayerEnv instances sharing the same board.
    Initially both opponents do nothing (opponent_policy=None).
    Set env1.opponent_policy or env2.opponent_policy to a trained model's
    predict function for self-play.
    """
    import os
    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')

    # Modified grammar: two heralds, two blight factions
    # For simplicity: both players are 'herald' type, distinguished by ID
    with open(os.path.join(grammars_dir, 'dominion.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        import random
        rng = random.Random(seed)
        for y in range(board.size):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'neutral')
        # Player 1: top-left quadrant
        board.set_cell_type_by_name(
            board.size // 4, board.size // 4,
            'herald', '', {'id': 'p1'})
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                if dx == 0 and dy == 0:
                    continue
                board.set_cell_type_by_name(
                    (board.size // 4 + dx) % board.size,
                    (board.size // 4 + dy) % board.size, 'claimed')
        # Player 2: bottom-right quadrant
        board.set_cell_type_by_name(
            3 * board.size // 4, 3 * board.size // 4,
            'herald', '', {'id': 'p2'})
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                if dx == 0 and dy == 0:
                    continue
                board.set_cell_type_by_name(
                    (3 * board.size // 4 + dx) % board.size,
                    (3 * board.size // 4 + dy) % board.size, 'claimed')
        # Blight at edges
        for pos in [(0, 0), (board.size - 1, board.size - 1)]:
            board.set_cell_type_by_name(pos[0], pos[1], 'blight')

    shared = TwoPlayerBoard(
        grammar=grammar, board_size=board_size,
        player1_id='p1', player2_id='p2',
        dt=dt, max_steps=500, board_init_fn=init_fn,
        score_reward_scale=1.0, time_penalty=0.005, seed=seed,
    )

    env1 = TwoPlayerEnv(shared, 'p1', 'p2', opponent_policy=None,
                         window_size=window_size, player_type='herald',
                         divine_penalty_dt=divine_penalty_dt)
    env2 = TwoPlayerEnv(shared, 'p2', 'p1', opponent_policy=None,
                         window_size=window_size, player_type='herald',
                         divine_penalty_dt=divine_penalty_dt)

    return env1, env2, shared


class SelfPlayCallback:
    """Updates opponent policy periodically during training.

    Every update_interval steps, copies the current policy as the
    opponent for the next round of training.
    """

    def __init__(self, env, model, update_interval=50_000):
        self.env = env
        self.model = model
        self.update_interval = update_interval
        self._step_count = 0

    def __call__(self):
        self._step_count += 1
        if self._step_count % self.update_interval == 0:
            # Copy current policy as opponent
            def opponent_policy(obs):
                action, _ = self.model.predict(obs, deterministic=False)
                return int(action)
            # Update all envs in the DummyVecEnv
            for env in self.env.envs:
                inner = env
                while hasattr(inner, 'env'):
                    if isinstance(inner, TwoPlayerEnv):
                        inner.opponent_policy = opponent_policy
                        break
                    inner = inner.env
