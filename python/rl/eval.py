"""Evaluation and visualization for trained agents.

Usage:
    python -m rl.eval --model logs/forest_fire_ppo_final --game forest_fire --episodes 100
"""

import argparse
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def evaluate(model_path, game='forest_fire', episodes=100, board_size=16,
             seed=42, render=False, verbose=False):
    """Evaluate a trained model against random baseline."""
    try:
        from stable_baselines3 import PPO
    except ImportError:
        print("stable-baselines3 not installed")
        return

    from rl.train_ppo import make_env

    # Load model
    model = PPO.load(model_path)

    # Evaluate trained agent
    trained_rewards = []
    for ep in range(episodes):
        env = make_env(game, board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False
        step = 0
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(int(action))
            total_reward += reward
            done = terminated or truncated
            step += 1
            if render and ep == 0:
                print(f"\nStep {step}, action={env.keys[int(action)]}, reward={reward:.2f}")
                print(env.render())
        trained_rewards.append(total_reward)
        if verbose:
            print(f"Episode {ep+1}: reward={total_reward:.2f}, steps={step}, score={info.get('score', 0)}")

    # Evaluate random agent
    random_rewards = []
    for ep in range(episodes):
        env = make_env(game, board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False
        while not done:
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            done = terminated or truncated
        random_rewards.append(total_reward)

    trained_mean = np.mean(trained_rewards)
    trained_std = np.std(trained_rewards)
    random_mean = np.mean(random_rewards)
    random_std = np.std(random_rewards)

    print(f"\n{'='*50}")
    print(f"Evaluation over {episodes} episodes:")
    print(f"  Trained agent: {trained_mean:.2f} +/- {trained_std:.2f}")
    print(f"  Random agent:  {random_mean:.2f} +/- {random_std:.2f}")
    print(f"  Improvement:   {trained_mean - random_mean:+.2f}")

    # Statistical significance (Welch's t-test)
    if episodes >= 10:
        from scipy import stats
        t_stat, p_value = stats.ttest_ind(trained_rewards, random_rewards, equal_var=False)
        print(f"  Welch's t-test: t={t_stat:.3f}, p={p_value:.6f}")
        if p_value < 0.01:
            print(f"  Result: Statistically significant (p < 0.01)")
        else:
            print(f"  Result: Not statistically significant (p >= 0.01)")

    return trained_rewards, random_rewards


def main():
    parser = argparse.ArgumentParser(description='Evaluate trained SokoScript agent')
    parser.add_argument('--model', required=True, help='Path to trained model')
    parser.add_argument('--game', default='forest_fire', help='Game name')
    parser.add_argument('--episodes', type=int, default=100, help='Number of episodes')
    parser.add_argument('--board-size', type=int, default=16, help='Board size')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--render', action='store_true', help='Render first episode')
    parser.add_argument('--verbose', action='store_true', help='Print per-episode results')
    args = parser.parse_args()

    evaluate(
        model_path=args.model,
        game=args.game,
        episodes=args.episodes,
        board_size=args.board_size,
        seed=args.seed,
        render=args.render,
        verbose=args.verbose,
    )


if __name__ == '__main__':
    main()
