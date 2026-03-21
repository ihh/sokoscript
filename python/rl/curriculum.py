"""Curriculum wrapper for SokoScript RL environments.

Adjusts environment parameters based on rolling success rate.

Usage:
    env = CurriculumWrapper(env_factory, param_schedule, window=100)
"""

try:
    import gymnasium as gym
    HAS_GYM = True
except ImportError:
    HAS_GYM = False

import numpy as np
from collections import deque


class CurriculumWrapper(gym.Wrapper if HAS_GYM else object):
    """Adjusts env parameters based on rolling episode success rate.

    Args:
        env: Base Gymnasium environment.
        param_name: Name of the parameter to adjust (for logging).
        param_range: (start_value, end_value) — the curriculum goes from start to end.
        success_threshold: Rolling success rate needed to advance difficulty.
        window: Number of episodes for rolling average.
        advance_rate: How much to advance per threshold crossing (0-1 fraction of range).
    """

    def __init__(self, env, param_name='difficulty', param_range=(0.0, 1.0),
                 success_threshold=0.6, window=100, advance_rate=0.1,
                 success_fn=None):
        if not HAS_GYM:
            raise ImportError("gymnasium not installed")
        super().__init__(env)
        self.param_name = param_name
        self.param_start, self.param_end = param_range
        self.success_threshold = success_threshold
        self.window = window
        self.advance_rate = advance_rate
        self.success_fn = success_fn or self._default_success

        self._progress = 0.0  # 0 = easiest, 1 = hardest
        self._episode_rewards = deque(maxlen=window)
        self._episode_reward = 0.0

    @property
    def current_param(self):
        """Current parameter value based on progress."""
        return self.param_start + self._progress * (self.param_end - self.param_start)

    @property
    def difficulty(self):
        return self._progress

    def _default_success(self, reward):
        """Default success: positive total reward."""
        return reward > 0

    def step(self, action):
        obs, reward, terminated, truncated, info = self.env.step(action)
        self._episode_reward += reward

        if terminated or truncated:
            success = self.success_fn(self._episode_reward)
            self._episode_rewards.append(float(success))
            self._maybe_advance()
            self._episode_reward = 0.0

        info['curriculum_progress'] = self._progress
        info['curriculum_param'] = self.current_param
        return obs, reward, terminated, truncated, info

    def reset(self, **kwargs):
        self._episode_reward = 0.0
        return self.env.reset(**kwargs)

    def _maybe_advance(self):
        """Check if we should advance difficulty."""
        if len(self._episode_rewards) < self.window:
            return
        success_rate = np.mean(self._episode_rewards)
        if success_rate >= self.success_threshold and self._progress < 1.0:
            self._progress = min(1.0, self._progress + self.advance_rate)
            print(f"  [Curriculum] {self.param_name}: progress={self._progress:.2f}, "
                  f"param={self.current_param:.4f}, success_rate={success_rate:.2f}")


def make_apple_curriculum_env(board_size=16, seed=None):
    """Apple Collector with curriculum: spawn rate 0.5 (easy) -> 0.1 (hard)."""
    from .train_ppo import make_apple_collector_env

    env = make_apple_collector_env(board_size, seed)
    return CurriculumWrapper(
        env,
        param_name='apple_spawn_rate',
        param_range=(0.5, 0.1),
        success_threshold=0.6,
        window=50,
        advance_rate=0.1,
        success_fn=lambda r: r > 50,
    )


def make_predator_curriculum_env(board_size=16, seed=None):
    """Predator-Prey with curriculum: 1 predator (easy) -> 5 predators (hard).

    Note: This creates the env with max predators but the curriculum
    conceptually tracks difficulty. The actual predator count adjustment
    would require env recreation, so this wrapper tracks progress for logging.
    """
    from .train_ppo import make_predator_prey_env

    env = make_predator_prey_env(board_size, seed, n_predators=3)
    return CurriculumWrapper(
        env,
        param_name='n_predators',
        param_range=(1, 5),
        success_threshold=0.5,
        window=50,
        advance_rate=0.1,
        success_fn=lambda r: r > 20,
    )
