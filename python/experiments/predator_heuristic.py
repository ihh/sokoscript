"""Heuristic baseline for the Predator-Prey game.

Strategy: move toward nearest apple, but flee if a predator is within distance 3.

Usage:
    cd python && python -m experiments.predator_heuristic [--episodes 100]
"""

import argparse
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rl.train_ppo import make_predator_prey_env


def toroidal_distance(x1, y1, x2, y2, size):
    dx = min(abs(x2 - x1), size - abs(x2 - x1))
    dy = min(abs(y2 - y1), size - abs(y2 - y1))
    return dx + dy


def toroidal_direction(x1, y1, x2, y2, size, key_to_action):
    dx = (x2 - x1) % size
    if dx > size // 2:
        dx -= size
    dy = (y2 - y1) % size
    if dy > size // 2:
        dy -= size

    if abs(dx) > abs(dy):
        return key_to_action['d'] if dx > 0 else key_to_action['a']
    elif abs(dy) > abs(dx):
        return key_to_action['s'] if dy > 0 else key_to_action['w']
    else:
        if np.random.random() < 0.5:
            return key_to_action['d'] if dx > 0 else key_to_action['a']
        else:
            return key_to_action['s'] if dy > 0 else key_to_action['w']


def flee_direction(x1, y1, x2, y2, size, key_to_action):
    """Move AWAY from (x2,y2)."""
    dx = (x2 - x1) % size
    if dx > size // 2:
        dx -= size
    dy = (y2 - y1) % size
    if dy > size // 2:
        dy -= size

    # Reverse: move opposite direction
    if abs(dx) > abs(dy):
        return key_to_action['a'] if dx > 0 else key_to_action['d']
    elif abs(dy) > abs(dx):
        return key_to_action['w'] if dy > 0 else key_to_action['s']
    else:
        if np.random.random() < 0.5:
            return key_to_action['a'] if dx > 0 else key_to_action['d']
        else:
            return key_to_action['w'] if dy > 0 else key_to_action['s']


def find_cells(obs, type_indices):
    positions = []
    for idx in type_indices:
        ys, xs = np.where(obs[:, :, idx] > 0.5)
        for y, x in zip(ys, xs):
            positions.append((x, y))
    return positions


def find_player(obs, player_type_idx):
    ys, xs = np.where(obs[:, :, player_type_idx] > 0.5)
    if len(ys) == 0:
        return None
    return (xs[0], ys[0])


def heuristic_action(obs, player_pos, apple_indices, predator_indices,
                     board_size, key_to_action, flee_radius=3):
    if player_pos is None:
        return np.random.randint(len(key_to_action))

    px, py = player_pos

    # Check for nearby predators — flee if within radius
    predators = find_cells(obs, predator_indices)
    nearest_pred_dist = float('inf')
    nearest_pred = None
    for prx, pry in predators:
        d = toroidal_distance(px, py, prx, pry, board_size)
        if d < nearest_pred_dist:
            nearest_pred_dist = d
            nearest_pred = (prx, pry)

    if nearest_pred is not None and nearest_pred_dist <= flee_radius:
        return flee_direction(px, py, nearest_pred[0], nearest_pred[1],
                            board_size, key_to_action)

    # Otherwise move toward nearest apple
    apples = find_cells(obs, apple_indices)
    if not apples:
        return np.random.randint(len(key_to_action))

    best_dist = float('inf')
    best_apple = None
    for ax, ay in apples:
        d = toroidal_distance(px, py, ax, ay, board_size)
        if d < best_dist:
            best_dist = d
            best_apple = (ax, ay)

    if best_apple is None:
        return np.random.randint(len(key_to_action))

    return toroidal_direction(px, py, best_apple[0], best_apple[1],
                             board_size, key_to_action)


def run_heuristic(episodes=100, max_steps=500, board_size=16, seed=42, verbose=False):
    rewards = []
    scores = []

    env = make_predator_prey_env(board_size, seed)
    type_names = env._setup_board.grammar['types']
    apple_indices = [i for i, name in enumerate(type_names) if name == 'apple']
    predator_indices = [i for i, name in enumerate(type_names) if name == 'predator']
    player_idx = next(i for i, name in enumerate(type_names) if name == 'player')
    key_to_action = {k: i for i, k in enumerate(env.keys)}
    env.close()

    t0 = time.time()
    for ep in range(episodes):
        env = make_predator_prey_env(board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False

        while not done:
            player_pos = find_player(obs, player_idx)
            action = heuristic_action(obs, player_pos, apple_indices, predator_indices,
                                     board_size, key_to_action)
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            done = terminated or truncated

        rewards.append(total_reward)
        scores.append(info.get('score', 0))
        if verbose:
            print(f"Episode {ep+1}: reward={total_reward:.2f}, score={info.get('score', 0)}")
        env.close()

    elapsed = time.time() - t0

    print(f"\nPredator-Prey Heuristic ({episodes} episodes):")
    print(f"  Reward: {np.mean(rewards):.2f} +/- {np.std(rewards):.2f}")
    print(f"  Score:  {np.mean(scores):.1f} +/- {np.std(scores):.1f}")
    print(f"  Min/Max reward: {np.min(rewards):.2f} / {np.max(rewards):.2f}")
    print(f"  Time: {elapsed:.1f}s ({elapsed/episodes*1000:.1f}ms/episode)")

    return rewards, scores


def run_random(episodes=100, board_size=16, seed=42):
    rewards = []
    scores = []

    for ep in range(episodes):
        env = make_predator_prey_env(board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False

        while not done:
            action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            done = terminated or truncated

        rewards.append(total_reward)
        scores.append(info.get('score', 0))
        env.close()

    print(f"\nRandom Baseline ({episodes} episodes):")
    print(f"  Reward: {np.mean(rewards):.2f} +/- {np.std(rewards):.2f}")
    print(f"  Score:  {np.mean(scores):.1f} +/- {np.std(scores):.1f}")

    return rewards, scores


def main():
    parser = argparse.ArgumentParser(description='Predator-Prey heuristic baseline')
    parser.add_argument('--episodes', type=int, default=100)
    parser.add_argument('--board-size', type=int, default=16)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    print("=" * 60)
    print("Predator-Prey — Heuristic vs Random Baseline")
    print("=" * 60)

    h_rewards, _ = run_heuristic(episodes=args.episodes, board_size=args.board_size,
                                 seed=args.seed, verbose=args.verbose)
    r_rewards, _ = run_random(episodes=args.episodes, board_size=args.board_size,
                              seed=args.seed)
    print(f"\nHeuristic vs Random improvement: {np.mean(h_rewards) - np.mean(r_rewards):+.2f} reward")


if __name__ == '__main__':
    main()
