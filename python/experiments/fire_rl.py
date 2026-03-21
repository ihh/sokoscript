"""End-to-end Forest Fire RL experiment.

Trains a PPO agent, then compares against heuristic and random baselines.

Usage:
    cd python && python -m experiments.fire_rl [--timesteps 500000] [--eval-episodes 100]
"""

import argparse
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def benchmark_sim_perf(n_steps=100, board_size=16):
    """Time simulation steps to check performance."""
    from rl.train_ppo import make_forest_fire_env

    env = make_forest_fire_env(board_size, seed=0)
    obs, _ = env.reset()

    t0 = time.time()
    for _ in range(n_steps):
        action = env.action_space.sample()
        obs, _, terminated, truncated, _ = env.step(action)
        if terminated or truncated:
            obs, _ = env.reset()
    elapsed = time.time() - t0
    env.close()

    ms_per_step = (elapsed / n_steps) * 1000
    print(f"Sim perf: {ms_per_step:.2f} ms/step ({n_steps} steps)")
    if ms_per_step > 1.0:
        print(f"  Warning: sim is slow ({ms_per_step:.1f}ms/step > 1ms target)")
    else:
        print(f"  OK: sim performance is acceptable")
    return ms_per_step


def train_agent(timesteps=500_000, board_size=16, n_envs=4, seed=42,
                log_dir='./logs/forest_fire', lr_schedule='constant'):
    """Train PPO agent on Forest Fire."""
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.vec_env import DummyVecEnv
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError:
        print("stable-baselines3 not installed. Install with: pip install 'stable-baselines3[extra]'")
        return None

    from rl.train_ppo import make_forest_fire_env

    try:
        from rl.networks import ToroidalCNN
        policy_kwargs = dict(
            features_extractor_class=ToroidalCNN,
            features_extractor_kwargs=dict(features_dim=256),
        )
    except ImportError:
        print("Warning: Using default CNN policy")
        policy_kwargs = {}

    def make_env_fn(env_seed):
        def _init():
            return make_forest_fire_env(board_size, env_seed)
        return _init

    env = DummyVecEnv([make_env_fn(seed + i) for i in range(n_envs)])
    eval_env = DummyVecEnv([make_env_fn(seed + 1000)])

    os.makedirs(log_dir, exist_ok=True)

    callbacks = [
        EvalCallback(
            eval_env,
            best_model_save_path=os.path.join(log_dir, 'best_model'),
            log_path=os.path.join(log_dir, 'eval'),
            eval_freq=max(5000 // n_envs, 1),
            n_eval_episodes=10,
            deterministic=True,
        ),
    ]

    from experiments.apple_rl import linear_schedule
    lr = linear_schedule(3e-4) if lr_schedule == 'linear' else 3e-4

    model = PPO(
        'CnnPolicy',
        env,
        policy_kwargs=policy_kwargs,
        verbose=1,
        tensorboard_log=None,
        seed=seed,
        learning_rate=lr,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
    )

    print(f"\nTraining PPO on forest_fire for {timesteps} timesteps with {n_envs} envs...")
    t0 = time.time()
    model.learn(total_timesteps=timesteps, callback=callbacks)
    elapsed = time.time() - t0
    print(f"Training complete in {elapsed:.1f}s")

    model_path = os.path.join(log_dir, 'forest_fire_ppo_final')
    model.save(model_path)
    print(f"Model saved to {model_path}")

    env.close()
    eval_env.close()

    return model_path


def evaluate_trained(model_path, episodes=100, board_size=16, seed=42):
    """Evaluate trained agent."""
    from stable_baselines3 import PPO
    from rl.train_ppo import make_forest_fire_env

    model = PPO.load(model_path)
    rewards = []
    scores = []

    for ep in range(episodes):
        env = make_forest_fire_env(board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(int(action))
            total_reward += reward
            done = terminated or truncated
        rewards.append(total_reward)
        scores.append(info.get('score', 0))
        env.close()

    print(f"\nTrained PPO Agent ({episodes} episodes):")
    print(f"  Reward: {np.mean(rewards):.2f} +/- {np.std(rewards):.2f}")
    print(f"  Score:  {np.mean(scores):.1f} +/- {np.std(scores):.1f}")

    return rewards, scores


def check_training_health(log_dir):
    """Check training logs for NaN/Inf issues."""
    eval_path = os.path.join(log_dir, 'eval', 'evaluations.npz')
    if os.path.exists(eval_path):
        data = np.load(eval_path)
        results = data['results']
        if np.any(np.isnan(results)):
            print("WARNING: NaN detected in evaluation results!")
            return False
        if np.any(np.isinf(results)):
            print("WARNING: Inf detected in evaluation results!")
            return False
        print(f"Training health: OK (no NaN/Inf in {len(results)} evaluations)")
        mean_rewards = results.mean(axis=1)
        print(f"  First eval: {mean_rewards[0]:.2f}")
        print(f"  Last eval:  {mean_rewards[-1]:.2f}")
        print(f"  Best eval:  {mean_rewards.max():.2f}")
        return True
    else:
        print("No evaluation logs found")
        return True


def main():
    parser = argparse.ArgumentParser(description='Forest Fire RL experiment')
    parser.add_argument('--timesteps', type=int, default=500_000, help='Training timesteps')
    parser.add_argument('--eval-episodes', type=int, default=100, help='Evaluation episodes')
    parser.add_argument('--board-size', type=int, default=16, help='Board size')
    parser.add_argument('--n-envs', type=int, default=4, help='Number of parallel envs')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--log-dir', default='./logs/forest_fire', help='Log directory')
    parser.add_argument('--skip-train', action='store_true', help='Skip training, just evaluate')
    parser.add_argument('--model', help='Path to pre-trained model (for --skip-train)')
    parser.add_argument('--lr-schedule', choices=['constant', 'linear'], default='constant',
                        help='Learning rate schedule')
    args = parser.parse_args()

    print("=" * 60)
    print("Forest Fire — RL Experiment")
    print("=" * 60)

    # Step 1: Benchmark sim performance
    print("\n--- Simulation Performance ---")
    benchmark_sim_perf(n_steps=100, board_size=args.board_size)

    # Step 2: Train or load model
    if args.skip_train:
        model_path = args.model
        if not model_path:
            model_path = os.path.join(args.log_dir, 'forest_fire_ppo_final')
        print(f"\nSkipping training, loading model from {model_path}")
    else:
        print("\n--- Training ---")
        model_path = train_agent(
            timesteps=args.timesteps,
            board_size=args.board_size,
            n_envs=args.n_envs,
            seed=args.seed,
            log_dir=args.log_dir,
            lr_schedule=args.lr_schedule,
        )
        if model_path is None:
            print("Training failed (missing dependencies)")
            return

    # Step 3: Check training health
    print("\n--- Training Health ---")
    check_training_health(args.log_dir)

    # Step 4: Evaluate trained agent
    print("\n--- Evaluation ---")
    rl_rewards, rl_scores = evaluate_trained(
        model_path, args.eval_episodes, args.board_size, args.seed,
    )

    # Step 5: Run heuristic baseline
    from experiments.fire_heuristic import run_heuristic, run_random

    h_rewards, h_scores = run_heuristic(
        episodes=args.eval_episodes,
        board_size=args.board_size,
        seed=args.seed,
    )

    r_rewards, r_scores = run_random(
        episodes=args.eval_episodes,
        board_size=args.board_size,
        seed=args.seed,
    )

    # Step 6: Summary comparison
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  {'Agent':<20} {'Reward':>12} {'Score':>12}")
    print(f"  {'-'*20} {'-'*12} {'-'*12}")
    print(f"  {'PPO (trained)':<20} {np.mean(rl_rewards):>8.2f} ±{np.std(rl_rewards):>4.1f} {np.mean(rl_scores):>8.1f} ±{np.std(rl_scores):>4.1f}")
    print(f"  {'Heuristic':<20} {np.mean(h_rewards):>8.2f} ±{np.std(h_rewards):>4.1f} {np.mean(h_scores):>8.1f} ±{np.std(h_scores):>4.1f}")
    print(f"  {'Random':<20} {np.mean(r_rewards):>8.2f} ±{np.std(r_rewards):>4.1f} {np.mean(r_scores):>8.1f} ±{np.std(r_scores):>4.1f}")

    # Statistical comparison
    if args.eval_episodes >= 10:
        try:
            from scipy import stats
            t_rl_h, p_rl_h = stats.ttest_ind(rl_rewards, h_rewards, equal_var=False)
            t_rl_r, p_rl_r = stats.ttest_ind(rl_rewards, r_rewards, equal_var=False)
            print(f"\n  PPO vs Heuristic: t={t_rl_h:.3f}, p={p_rl_h:.6f}")
            print(f"  PPO vs Random:    t={t_rl_r:.3f}, p={p_rl_r:.6f}")
        except ImportError:
            print("\n  (scipy not available for statistical tests)")


if __name__ == '__main__':
    main()
