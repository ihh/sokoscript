"""Run all RL experiments sequentially and collect results.

Usage:
    cd python && python -m experiments.run_all [--timesteps 200000] [--eval-episodes 50]
"""

import argparse
import csv
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


EXPERIMENTS = [
    {
        'name': 'Apple Collector',
        'game': 'apple_collector',
        'module': 'experiments.apple_rl',
        'heuristic_module': 'experiments.apple_heuristic',
        'default_timesteps': 200_000,
        'board_size': 16,
    },
    {
        'name': 'Forest Fire',
        'game': 'forest_fire',
        'module': 'experiments.fire_rl',
        'heuristic_module': 'experiments.fire_heuristic',
        'default_timesteps': 500_000,
        'board_size': 16,
    },
    {
        'name': 'Predator-Prey',
        'game': 'predator_prey',
        'module': 'experiments.predator_rl',
        'heuristic_module': 'experiments.predator_heuristic',
        'default_timesteps': 500_000,
        'board_size': 16,
    },
    {
        'name': 'Plague Doctor',
        'game': 'plague_doctor',
        'module': 'experiments.plague_rl',
        'heuristic_module': 'experiments.plague_heuristic',
        'default_timesteps': 500_000,
        'board_size': 16,
    },
    {
        'name': 'Key & Door',
        'game': 'key_door',
        'module': 'experiments.keydoor_rl',
        'heuristic_module': 'experiments.keydoor_heuristic',
        'default_timesteps': 1_000_000,
        'board_size': 8,
    },
    {
        'name': 'Treasure Miner',
        'game': 'treasure_miner',
        'module': 'experiments.miner_rl',
        'heuristic_module': 'experiments.miner_heuristic',
        'default_timesteps': 1_000_000,
        'board_size': 16,
    },
]


def run_experiment(exp, timesteps_override=None, eval_episodes=50,
                   n_envs=4, seed=42, skip_train=False):
    """Run a single experiment and return results dict."""
    import importlib

    rl_mod = importlib.import_module(exp['module'])
    h_mod = importlib.import_module(exp['heuristic_module'])

    timesteps = timesteps_override or exp['default_timesteps']
    board_size = exp['board_size']
    log_dir = f"./logs/{exp['game']}"

    result = {'name': exp['name'], 'game': exp['game'], 'timesteps': timesteps}

    # Benchmark
    t0 = time.time()
    if hasattr(rl_mod, 'benchmark_sim_perf'):
        ms = rl_mod.benchmark_sim_perf(n_steps=50, board_size=board_size)
        result['ms_per_step'] = ms

    # Train
    if not skip_train:
        model_path = rl_mod.train_agent(
            timesteps=timesteps, board_size=board_size,
            n_envs=n_envs, seed=seed, log_dir=log_dir,
        )
        if model_path is None:
            result['error'] = 'Training failed'
            return result
    else:
        model_path = os.path.join(log_dir, f'{exp["game"]}_ppo_final')

    # Evaluate PPO
    rl_rewards, rl_scores = rl_mod.evaluate_trained(
        model_path, eval_episodes, board_size, seed,
    )

    # Heuristic
    h_rewards, h_scores = h_mod.run_heuristic(
        episodes=eval_episodes, board_size=board_size, seed=seed,
    )

    # Random
    r_rewards, r_scores = h_mod.run_random(
        episodes=eval_episodes, board_size=board_size, seed=seed,
    )

    elapsed = time.time() - t0

    result.update({
        'ppo_reward_mean': np.mean(rl_rewards),
        'ppo_reward_std': np.std(rl_rewards),
        'ppo_score_mean': np.mean(rl_scores),
        'heuristic_reward_mean': np.mean(h_rewards),
        'heuristic_reward_std': np.std(h_rewards),
        'heuristic_score_mean': np.mean(h_scores),
        'random_reward_mean': np.mean(r_rewards),
        'random_reward_std': np.std(r_rewards),
        'random_score_mean': np.mean(r_scores),
        'elapsed_s': elapsed,
    })

    # Statistical test
    try:
        from scipy import stats
        t_stat, p_val = stats.ttest_ind(rl_rewards, h_rewards, equal_var=False)
        result['ppo_vs_heuristic_p'] = p_val
        result['ppo_vs_heuristic_t'] = t_stat
    except ImportError:
        pass

    return result


def print_summary(results):
    """Print comparison matrix."""
    print("\n" + "=" * 80)
    print("EXPERIMENT SUMMARY")
    print("=" * 80)

    header = f"  {'Game':<20} {'PPO':>14} {'Heuristic':>14} {'Random':>14} {'p-value':>10}"
    print(header)
    print("  " + "-" * 76)

    for r in results:
        if 'error' in r:
            print(f"  {r['name']:<20} ERROR: {r['error']}")
            continue

        ppo = f"{r['ppo_reward_mean']:>7.1f}±{r['ppo_reward_std']:>4.1f}"
        heur = f"{r['heuristic_reward_mean']:>7.1f}±{r['heuristic_reward_std']:>4.1f}"
        rand = f"{r['random_reward_mean']:>7.1f}±{r['random_reward_std']:>4.1f}"
        p = f"{r.get('ppo_vs_heuristic_p', float('nan')):>10.6f}"
        print(f"  {r['name']:<20} {ppo} {heur} {rand} {p}")

    print()


def save_csv(results, path):
    """Save results to CSV."""
    if not results:
        return
    keys = results[0].keys()
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(results)
    print(f"Results saved to {path}")


def main():
    parser = argparse.ArgumentParser(description='Run all RL experiments')
    parser.add_argument('--timesteps', type=int, default=None,
                        help='Override timesteps for all experiments')
    parser.add_argument('--eval-episodes', type=int, default=50)
    parser.add_argument('--n-envs', type=int, default=4)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--skip-train', action='store_true',
                        help='Skip training, evaluate existing models')
    parser.add_argument('--games', nargs='+', default=None,
                        help='Only run specific games (by game key)')
    parser.add_argument('--output', default='./logs/experiment_results.csv',
                        help='Output CSV path')
    args = parser.parse_args()

    experiments = EXPERIMENTS
    if args.games:
        experiments = [e for e in EXPERIMENTS if e['game'] in args.games]

    print("=" * 80)
    print(f"Running {len(experiments)} experiments")
    print("=" * 80)

    results = []
    for i, exp in enumerate(experiments):
        print(f"\n{'='*80}")
        print(f"[{i+1}/{len(experiments)}] {exp['name']}")
        print(f"{'='*80}")

        try:
            result = run_experiment(
                exp,
                timesteps_override=args.timesteps,
                eval_episodes=args.eval_episodes,
                n_envs=args.n_envs,
                seed=args.seed,
                skip_train=args.skip_train,
            )
            results.append(result)
        except Exception as e:
            print(f"ERROR in {exp['name']}: {e}")
            results.append({'name': exp['name'], 'game': exp['game'], 'error': str(e)})

    print_summary(results)

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    save_csv(results, args.output)


if __name__ == '__main__':
    main()
