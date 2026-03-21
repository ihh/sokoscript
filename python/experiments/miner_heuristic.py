"""Heuristic baseline for the Treasure Miner game.

Strategy: dig horizontally first, avoid digging below rocks.
Prioritize nearby gems reachable without passing under rocks.

Usage:
    cd python && python -m experiments.miner_heuristic [--episodes 100]
"""

import argparse
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rl.train_ppo import make_treasure_miner_env


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


def find_cell(obs, type_idx):
    ys, xs = np.where(obs[:, :, type_idx] > 0.5)
    if len(ys) == 0:
        return None
    return (xs[0], ys[0])


def find_cells(obs, type_indices):
    positions = []
    for idx in type_indices:
        ys, xs = np.where(obs[:, :, idx] > 0.5)
        for y, x in zip(ys, xs):
            positions.append((x, y))
    return positions


def has_rock_above(obs, x, y, rock_idx, board_size):
    """Check if there's a rock directly above position (y-1)."""
    above_y = (y - 1) % board_size
    return obs[above_y, x, rock_idx] > 0.5


def heuristic_action(obs, player_pos, gem_indices, rock_idx, board_size, key_to_action):
    """Move toward nearest safe gem (no rock directly above)."""
    if player_pos is None:
        return np.random.randint(len(key_to_action))

    px, py = player_pos
    gems = find_cells(obs, gem_indices)

    # Filter out gems that have a rock directly above
    safe_gems = [(gx, gy) for gx, gy in gems
                 if not has_rock_above(obs, gx, gy, rock_idx, board_size)]

    # If no safe gems, try all gems
    targets = safe_gems if safe_gems else gems

    if not targets:
        # No gems — prefer horizontal movement
        return key_to_action['d'] if np.random.random() < 0.5 else key_to_action['a']

    # Find nearest target
    best_dist = float('inf')
    best_target = None
    for gx, gy in targets:
        d = toroidal_distance(px, py, gx, gy, board_size)
        if d < best_dist:
            best_dist = d
            best_target = (gx, gy)

    if best_target is None:
        return np.random.randint(len(key_to_action))

    # Prefer horizontal movement when target is diagonal (safer)
    dx = (best_target[0] - px) % board_size
    if dx > board_size // 2:
        dx -= board_size
    dy = (best_target[1] - py) % board_size
    if dy > board_size // 2:
        dy -= board_size

    # Check if moving up would put us under a rock
    if dy < 0:
        above_y = (py - 1) % board_size
        if obs[above_y, px, rock_idx] > 0.5:
            # Dangerous to move up — go horizontal instead
            if dx != 0:
                return key_to_action['d'] if dx > 0 else key_to_action['a']

    return toroidal_direction(px, py, best_target[0], best_target[1],
                             board_size, key_to_action)


def run_heuristic(episodes=100, max_steps=500, board_size=16, seed=42, verbose=False):
    rewards = []
    scores = []

    env = make_treasure_miner_env(board_size, seed)
    type_names = env._setup_board.grammar['types']
    gem_indices = [i for i, name in enumerate(type_names) if name == 'gem']
    rock_idx = next(i for i, name in enumerate(type_names) if name == 'rock')
    player_idx = next(i for i, name in enumerate(type_names) if name == 'player')
    key_to_action = {k: i for i, k in enumerate(env.keys)}
    env.close()

    t0 = time.time()
    for ep in range(episodes):
        env = make_treasure_miner_env(board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False

        while not done:
            player_pos = find_cell(obs, player_idx)
            action = heuristic_action(obs, player_pos, gem_indices, rock_idx,
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

    print(f"\nTreasure Miner Heuristic ({episodes} episodes):")
    print(f"  Reward: {np.mean(rewards):.2f} +/- {np.std(rewards):.2f}")
    print(f"  Score:  {np.mean(scores):.1f} +/- {np.std(scores):.1f}")
    print(f"  Min/Max reward: {np.min(rewards):.2f} / {np.max(rewards):.2f}")
    print(f"  Time: {elapsed:.1f}s ({elapsed/episodes*1000:.1f}ms/episode)")

    return rewards, scores


def run_random(episodes=100, board_size=16, seed=42):
    rewards = []
    scores = []

    for ep in range(episodes):
        env = make_treasure_miner_env(board_size, seed + ep)
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
    parser = argparse.ArgumentParser(description='Treasure Miner heuristic baseline')
    parser.add_argument('--episodes', type=int, default=100)
    parser.add_argument('--board-size', type=int, default=12)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    print("=" * 60)
    print("Treasure Miner — Heuristic vs Random Baseline")
    print("=" * 60)

    h_rewards, _ = run_heuristic(episodes=args.episodes, board_size=args.board_size,
                                 seed=args.seed, verbose=args.verbose)
    r_rewards, _ = run_random(episodes=args.episodes, board_size=args.board_size,
                              seed=args.seed)
    print(f"\nHeuristic vs Random improvement: {np.mean(h_rewards) - np.mean(r_rewards):+.2f} reward")


if __name__ == '__main__':
    main()
