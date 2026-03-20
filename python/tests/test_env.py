"""Tests for Gymnasium environment."""

import pytest
import numpy as np

try:
    import gymnasium
    HAS_GYM = True
except ImportError:
    HAS_GYM = False

from tests.conftest import load_grammar


@pytest.mark.skipif(not HAS_GYM, reason="gymnasium not installed")
class TestSokoScriptEnv:

    def _make_forest_fire_env(self, seed=42):
        from sokoscript.env import SokoScriptEnv
        grammar = load_grammar('forest_fire.txt')

        def init_fn(board):
            # Place fireman and some trees/fires
            board.set_cell_type_by_name(8, 8, 'fireman', '', {'id': 'p1'})
            for x in range(3, 13):
                board.set_cell_type_by_name(x, 4, 'tree')
            board.set_cell_type_by_name(5, 4, 'fire')

        return SokoScriptEnv(
            grammar=grammar,
            board_size=16,
            player_id='p1',
            dt=0.1,
            max_steps=100,
            board_init_fn=init_fn,
            score_reward_scale=1.0,
            time_penalty=0.01,
            seed=seed,
        )

    def test_env_creation(self):
        env = self._make_forest_fire_env()
        assert env.observation_space.shape == (16, 16, env.num_types)
        assert env.action_space.n == len(env.keys)

    def test_reset(self):
        env = self._make_forest_fire_env()
        obs, info = env.reset()
        assert obs.shape == (16, 16, env.num_types)
        assert obs.dtype == np.float32
        assert 'type_counts' in info
        assert info['type_counts']['fireman'] == 1

    def test_step(self):
        env = self._make_forest_fire_env()
        obs, info = env.reset()
        for _ in range(10):
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            assert obs.shape == (16, 16, env.num_types)
            assert isinstance(reward, float)
            assert isinstance(terminated, bool)
            assert isinstance(truncated, bool)
            if terminated or truncated:
                break

    def test_truncation_at_max_steps(self):
        env = self._make_forest_fire_env()
        env.max_steps = 5
        obs, _ = env.reset()
        for _ in range(10):
            obs, reward, terminated, truncated, info = env.step(0)
            if truncated:
                assert info['step'] >= 5
                break
        else:
            assert False, "Should have truncated"

    def test_random_agent(self):
        env = self._make_forest_fire_env()
        obs, _ = env.reset(seed=42)
        total_reward = 0
        for _ in range(50):
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            if terminated or truncated:
                break
        # Just verify it runs without error

    def test_render_ansi(self):
        from sokoscript.env import SokoScriptEnv
        grammar = load_grammar('forest_fire.txt')

        def init_fn(board):
            board.set_cell_type_by_name(4, 4, 'fireman', '', {'id': 'p1'})

        env = SokoScriptEnv(
            grammar=grammar,
            board_size=8,
            player_id='p1',
            board_init_fn=init_fn,
            render_mode='ansi',
        )
        env.reset()
        rendered = env.render()
        assert isinstance(rendered, str)
        assert len(rendered.split('\n')) == 8

    def test_env_checker(self):
        """Run Gymnasium's env_checker for compliance."""
        env = self._make_forest_fire_env()
        from gymnasium.utils.env_checker import check_env
        # check_env will raise on failures
        check_env(env.unwrapped, skip_render_check=True)
