"""Heuristic baseline for the Key & Door game.

Strategy: BFS to key first, then BFS to door.

Usage:
    cd python && python -m experiments.keydoor_heuristic [--episodes 100]
"""

import argparse
import os
import sys
import time
from collections import deque

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rl.train_ppo import make_key_door_env


def find_cell(obs, type_idx):
    """Find first cell of given type. Returns (x, y) or None."""
    ys, xs = np.where(obs[:, :, type_idx] > 0.5)
    if len(ys) == 0:
        return None
    return (xs[0], ys[0])


def bfs_next_action(obs, start, goal, walkable_indices, board_size, key_to_action):
    """BFS on toroidal grid to find next action toward goal.

    walkable_indices: list of type indices the agent can walk on.
    """
    if start is None or goal is None:
        return np.random.randint(len(key_to_action))

    if start == goal:
        return np.random.randint(len(key_to_action))

    # Build walkable set
    walkable = set()
    for idx in walkable_indices:
        ys, xs = np.where(obs[:, :, idx] > 0.5)
        for y, x in zip(ys, xs):
            walkable.add((x, y))
    walkable.add(goal)  # Goal is always reachable
    walkable.add(start)

    # BFS
    visited = {start}
    queue = deque()
    # (position, first_action)
    directions = [
        ('w', 0, -1),  # N
        ('s', 0, 1),   # S
        ('d', 1, 0),   # E
        ('a', -1, 0),  # W
    ]

    for key, dx, dy in directions:
        nx = (start[0] + dx) % board_size
        ny = (start[1] + dy) % board_size
        if (nx, ny) in walkable and (nx, ny) not in visited:
            if (nx, ny) == goal:
                return key_to_action[key]
            visited.add((nx, ny))
            queue.append(((nx, ny), key_to_action[key]))

    while queue:
        pos, first_action = queue.popleft()
        for _, dx, dy in directions:
            nx = (pos[0] + dx) % board_size
            ny = (pos[1] + dy) % board_size
            if (nx, ny) in walkable and (nx, ny) not in visited:
                if (nx, ny) == goal:
                    return first_action
                visited.add((nx, ny))
                queue.append(((nx, ny), first_action))

    # No path found — random
    return np.random.randint(len(key_to_action))


def run_heuristic(episodes=100, max_steps=200, board_size=8, seed=42, verbose=False):
    rewards = []
    scores = []

    env = make_key_door_env(board_size, seed)
    type_names = env._setup_board.grammar['types']
    player_idx = next(i for i, name in enumerate(type_names) if name == 'player')
    key_idx = next(i for i, name in enumerate(type_names) if name == 'key')
    door_idx = next(i for i, name in enumerate(type_names) if name == 'door')
    ground_idx = next(i for i, name in enumerate(type_names) if name == 'ground')
    # Walkable: ground, key, door (depending on state)
    walkable_to_key = [ground_idx, key_idx]
    walkable_to_door = [ground_idx, door_idx]
    key_to_action = {k: i for i, k in enumerate(env.keys)}
    env.close()

    t0 = time.time()
    for ep in range(episodes):
        env = make_key_door_env(board_size, seed + ep)
        obs, _ = env.reset()
        total_reward = 0
        done = False
        has_key = False

        while not done:
            player_pos = find_cell(obs, player_idx)
            key_pos = find_cell(obs, key_idx)
            door_pos = find_cell(obs, door_idx)

            if not has_key and key_pos is not None:
                # Go to key
                action = bfs_next_action(obs, player_pos, key_pos,
                                        walkable_to_key, board_size, key_to_action)
            elif door_pos is not None:
                # Go to door
                action = bfs_next_action(obs, player_pos, door_pos,
                                        walkable_to_door, board_size, key_to_action)
            else:
                action = np.random.randint(len(key_to_action))

            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += reward
            done = terminated or truncated

            # Check if key was picked up (key disappears from obs)
            if key_pos is not None and find_cell(obs, key_idx) is None:
                has_key = True

        rewards.append(total_reward)
        scores.append(info.get('score', 0))
        if verbose:
            print(f"Episode {ep+1}: reward={total_reward:.2f}, score={info.get('score', 0)}")
        env.close()

    elapsed = time.time() - t0

    print(f"\nKey-Door Heuristic ({episodes} episodes):")
    print(f"  Reward: {np.mean(rewards):.2f} +/- {np.std(rewards):.2f}")
    print(f"  Score:  {np.mean(scores):.1f} +/- {np.std(scores):.1f}")
    print(f"  Min/Max reward: {np.min(rewards):.2f} / {np.max(rewards):.2f}")
    print(f"  Time: {elapsed:.1f}s ({elapsed/episodes*1000:.1f}ms/episode)")

    return rewards, scores


def run_random(episodes=100, board_size=8, seed=42):
    rewards = []
    scores = []

    for ep in range(episodes):
        env = make_key_door_env(board_size, seed + ep)
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
    parser = argparse.ArgumentParser(description='Key-Door heuristic baseline')
    parser.add_argument('--episodes', type=int, default=100)
    parser.add_argument('--board-size', type=int, default=8)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    print("=" * 60)
    print("Key & Door — Heuristic vs Random Baseline")
    print("=" * 60)

    h_rewards, _ = run_heuristic(episodes=args.episodes, board_size=args.board_size,
                                 seed=args.seed, verbose=args.verbose)
    r_rewards, _ = run_random(episodes=args.episodes, board_size=args.board_size,
                              seed=args.seed)
    print(f"\nHeuristic vs Random improvement: {np.mean(h_rewards) - np.mean(r_rewards):+.2f} reward")


if __name__ == '__main__':
    main()
