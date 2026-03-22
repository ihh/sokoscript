"""Hyperparameter screening using Successive Rejects philosophy.

Tests observation window size, gamma, and board size on the games
that showed learning signal. Short runs (50k steps) to identify
which factors matter before investing in long runs.

Usage:
    cd python && python -m experiments.hyperparam_screen [--steps 50000]
"""

import argparse
import itertools
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


PLAYER_TYPES = {
    'apple_collector': 'player',
    'predator_prey': 'player',
    'forest_fire': 'fireman',
    'treasure_miner': 'player',
    'key_door': 'player',
    'plague_doctor': 'player',
    'minefield': 'player',
    'scout': 'player',
    'dominion': 'herald',
    'phosphor': 'spark',
    'mycelium': 'gardener',
}


def make_env_with_obs(game, board_size, seed, window_size=None,
                      masked=False, look_penalty_dt=0.2):
    """Create env, optionally wrapped with local observation.

    Args:
        window_size: If set, crop observation to this size (must be odd).
        masked: If True, use MaskedLocalObsWrapper with look action.
            The observation is (2*window-1)x(2*window-1) with mask channel;
            inner window_size is visible, outer ring is masked.
            An extra 'look' action unmasks the full view for one step.
        look_penalty_dt: Time cost of the look action (seconds of board
            evolution without player input).
    """
    from rl.train_ppo import make_env
    env = make_env(game, board_size, seed)
    player_type = PLAYER_TYPES.get(game, 'player')
    if window_size is not None:
        if masked:
            from rl.local_obs import MaskedLocalObsWrapper
            env = MaskedLocalObsWrapper(
                env, window_size=window_size, player_type=player_type,
                look_penalty_dt=look_penalty_dt,
            )
        else:
            from rl.local_obs import LocalObsWrapper
            env = LocalObsWrapper(
                env, window_size=window_size, player_type=player_type,
            )
    return env


def screen_config(game, board_size, gamma, window_size, steps, seed=42, n_envs=4):
    """Train one configuration and return eval reward."""
    try:
        import torch
        torch.cuda.empty_cache()
    except Exception:
        pass

    from stable_baselines3 import PPO
    from stable_baselines3.common.vec_env import DummyVecEnv

    try:
        from rl.networks import ToroidalCNN
        policy_kwargs = dict(
            features_extractor_class=ToroidalCNN,
            features_extractor_kwargs=dict(features_dim=256),
        )
    except ImportError:
        policy_kwargs = {}

    def factory(s):
        def _init():
            return make_env_with_obs(game, board_size, s, window_size)
        return _init

    env = DummyVecEnv([factory(seed + i) for i in range(n_envs)])

    model = PPO(
        'CnnPolicy', env, policy_kwargs=policy_kwargs,
        verbose=0, seed=seed, learning_rate=3e-4,
        n_steps=1024, batch_size=64, n_epochs=5,
        gamma=gamma, gae_lambda=0.95, clip_range=0.2, ent_coef=0.01,
    )

    t0 = time.time()
    model.learn(total_timesteps=steps)
    elapsed = time.time() - t0

    # Eval (10 episodes)
    ppo_rewards = []
    for ep in range(10):
        e = make_env_with_obs(game, board_size, seed + 2000 + ep, window_size)
        obs, _ = e.reset()
        total_r = 0
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, r, term, trunc, info = e.step(int(action))
            total_r += r
            done = term or trunc
        ppo_rewards.append(total_r)
        e.close()

    # Random baseline (10 episodes)
    rand_rewards = []
    for ep in range(10):
        e = make_env_with_obs(game, board_size, seed + 3000 + ep, window_size)
        obs, _ = e.reset()
        total_r = 0
        done = False
        while not done:
            action = e.action_space.sample()
            obs, r, term, trunc, info = e.step(action)
            total_r += r
            done = term or trunc
        rand_rewards.append(total_r)
        e.close()

    env.close()

    return {
        'ppo_mean': np.mean(ppo_rewards),
        'ppo_std': np.std(ppo_rewards),
        'rand_mean': np.mean(rand_rewards),
        'delta': np.mean(ppo_rewards) - np.mean(rand_rewards),
        'elapsed': elapsed,
    }


def main():
    parser = argparse.ArgumentParser(description='Hyperparameter screening')
    parser.add_argument('--steps', type=int, default=50_000, help='Steps per config')
    parser.add_argument('--games', nargs='+',
                        default=['apple_collector', 'predator_prey'],
                        help='Games to screen')
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    # Screening matrix — fractional factorial
    # Don't test all combos; test each factor against the baseline
    configs = []

    # Baseline: board=16, gamma=0.99, window=full
    configs.append({'board_size': 16, 'gamma': 0.99, 'window': None, 'label': 'baseline'})

    # Vary gamma (fix board=16, window=full)
    configs.append({'board_size': 16, 'gamma': 0.995, 'window': None, 'label': 'gamma=0.995'})
    configs.append({'board_size': 16, 'gamma': 0.999, 'window': None, 'label': 'gamma=0.999'})
    configs.append({'board_size': 16, 'gamma': 0.95, 'window': None, 'label': 'gamma=0.95'})

    # Vary window (fix board=16, gamma=0.99)
    configs.append({'board_size': 16, 'gamma': 0.99, 'window': 11, 'label': 'window=11'})
    configs.append({'board_size': 16, 'gamma': 0.99, 'window': 7, 'label': 'window=7'})

    # Vary board size (fix gamma=0.99, window=full)
    configs.append({'board_size': 32, 'gamma': 0.99, 'window': None, 'label': 'board=32'})

    # Interaction: board=32 + local window (the hypothesis: local obs helps on bigger boards)
    configs.append({'board_size': 32, 'gamma': 0.99, 'window': 11, 'label': 'board=32+win=11'})

    all_results = []

    for game in args.games:
        print(f"\n{'='*70}")
        print(f"SCREENING: {game}")
        print(f"{'='*70}")

        game_results = []
        for cfg in configs:
            label = cfg['label']
            print(f"\n  [{game}] {label} ({args.steps//1000}k steps)...", end=' ', flush=True)

            try:
                result = screen_config(
                    game=game,
                    board_size=cfg['board_size'],
                    gamma=cfg['gamma'],
                    window_size=cfg['window'],
                    steps=args.steps,
                    seed=args.seed,
                )
                print(f"PPO={result['ppo_mean']:.1f} Rand={result['rand_mean']:.1f} "
                      f"Delta={result['delta']:+.1f} ({result['elapsed']:.0f}s)")
                game_results.append({**cfg, **result, 'game': game})
            except Exception as e:
                print(f"ERROR: {e}")
                game_results.append({**cfg, 'game': game, 'error': str(e)})

        all_results.extend(game_results)

        # Print game summary sorted by delta
        print(f"\n  {'Config':<25} {'PPO':>8} {'Random':>8} {'Delta':>8}")
        print(f"  {'-'*49}")
        valid = [r for r in game_results if 'error' not in r]
        for r in sorted(valid, key=lambda x: x['delta'], reverse=True):
            marker = ' ***' if r['delta'] == max(x['delta'] for x in valid) else ''
            print(f"  {r['label']:<25} {r['ppo_mean']:>8.1f} {r['rand_mean']:>8.1f} {r['delta']:>+8.1f}{marker}")

    # Cross-game summary
    print(f"\n{'='*70}")
    print("CROSS-GAME FACTOR ANALYSIS")
    print(f"{'='*70}")

    # Compute marginal effect of each factor
    factors = {
        'gamma': {'0.95': 'gamma=0.95', '0.99': 'baseline', '0.995': 'gamma=0.995', '0.999': 'gamma=0.999'},
        'window': {'full': 'baseline', '11': 'window=11', '7': 'window=7'},
        'board': {'16': 'baseline', '32': 'board=32'},
    }

    for factor_name, levels in factors.items():
        print(f"\n  Factor: {factor_name}")
        print(f"  {'Level':<12}", end='')
        for game in args.games:
            print(f"  {game:>20}", end='')
        print()

        for level, label in levels.items():
            print(f"  {level:<12}", end='')
            for game in args.games:
                matches = [r for r in all_results if r.get('label') == label and r['game'] == game and 'error' not in r]
                if matches:
                    print(f"  {matches[0]['delta']:>+20.1f}", end='')
                else:
                    print(f"  {'ERR':>20}", end='')
            print()


if __name__ == '__main__':
    main()
