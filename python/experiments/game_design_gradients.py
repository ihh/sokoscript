"""Gradient-based game design: backprop through learned world models.

Trains a world model from game episodes, then optimizes grammar rate
parameters to maximize desired outcomes (score, survival, action usage).

This is "contrived spontaneity" — finding rate settings where interesting
events feel emergent but are actually likely by design.

Usage:
    cd python && python -m experiments.game_design_gradients \
        --game predator_prey --outcome survival --model lowrank
"""

import argparse
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


def train_world_model(game, model_type='tensor', board_size=16, n_episodes=200,
                      seed=42, rank=32, embed_dim=32):
    """Train a world model from random episodes."""
    from rl.train_ppo import make_env
    from rl.world_models import (TransitionTensor, WorldModelTrainer)

    env = make_env(game, board_size, seed)
    n_types = len(env._setup_board.grammar['types'])
    type_names = list(env._setup_board.grammar['types'])
    env.close()

    if model_type == 'tensor':
        model = TransitionTensor(n_types)
    elif model_type == 'lowrank':
        from rl.world_models import LowRankWorldModel
        model = LowRankWorldModel(n_types, rank=rank)
    elif model_type == 'embedding':
        from rl.world_models import EmbeddingWorldModel
        model = EmbeddingWorldModel(n_types, embed_dim=embed_dim)
    else:
        raise ValueError(f"Unknown model type: {model_type}")

    # Train from random episodes
    trainer = WorldModelTrainer(model)
    env = make_env(game, board_size, seed)
    t0 = time.time()
    loss = trainer.train_from_episodes(env, n_episodes=n_episodes, seed=seed)
    elapsed = time.time() - t0
    env.close()

    # Evaluate accuracy
    env = make_env(game, board_size, seed + 9999)
    obs, _ = env.reset()
    correct = 0
    total = 0
    for _ in range(100):
        prev = obs
        obs, _, term, trunc, _ = env.step(env.action_space.sample())

        if model_type == 'tensor':
            acc = model.accuracy(prev, obs)
            correct += acc * 100  # approximate
            total += 100
        else:
            # For torch models, compute accuracy manually
            from rl.world_models import obs_to_types
            t_prev = obs_to_types(prev)
            t_next = obs_to_types(obs)
            H, W = t_prev.shape
            for y in range(H):
                for x in range(W):
                    if t_prev[y, x] < 0 or t_next[y, x] < 0:
                        continue
                    neighbors = (
                        t_prev[(y-1) % H, x],
                        t_prev[y, (x+1) % W],
                        t_prev[(y+1) % H, x],
                        t_prev[y, (x-1) % W],
                    )
                    if any(n < 0 for n in neighbors):
                        continue
                    pred = model.predict_numpy(t_prev[y, x], neighbors)
                    if np.argmax(pred) == t_next[y, x]:
                        correct += 1
                    total += 1

        if term or trunc:
            obs, _ = env.reset()
    env.close()

    accuracy = correct / max(total, 1)
    print(f"  World model ({model_type}): trained {n_episodes} eps in {elapsed:.1f}s, "
          f"loss={loss:.4f}, accuracy={accuracy:.3f}")

    return model, type_names, n_types


class DifferentiableSimulator(nn.Module):
    """Soft board evolution using a learned transition model.

    Board state is a (H, W, K) probability distribution. Each step:
    1. For each cell, gather neighbor distributions
    2. Compute expected transition using the world model
    3. Mix with current state weighted by rates (higher rate = more change)
    """

    def __init__(self, world_model, num_types, board_size, n_rules=None):
        super().__init__()
        self.world_model = world_model
        self.num_types = num_types
        self.board_size = board_size

        # Learnable rate multipliers (one per type)
        self.log_rates = nn.Parameter(torch.zeros(num_types))

    def _precompute_transition_table(self):
        """Precompute T[x, n, y] from world model (frozen, no grad needed)."""
        K = self.num_types
        T = torch.zeros(K, K, K)
        with torch.no_grad():
            for x in range(K):
                for n in range(K):
                    c_t = torch.tensor([x], dtype=torch.long)
                    n_t = torch.tensor([n], dtype=torch.long)
                    if hasattr(self.world_model, 'forward'):
                        log_p = self.world_model(c_t, n_t)
                        T[x, n] = torch.exp(log_p[0])
                    else:
                        T[x, n] = torch.tensor(
                            self.world_model.predict(x, (n, n, n, n)),
                            dtype=torch.float32)
        return T

    def simulate_step(self, board_probs, T, dt=0.1):
        """One step of soft evolution.

        board_probs: (H, W, K) probability tensor
        T: (K, K, K) frozen transition table from world model
        Returns: (H, W, K) next-step probabilities

        Gradients flow through board_probs and self.log_rates only.
        """
        H, W, K = board_probs.shape
        rates = F.softplus(self.log_rates)  # positive rates per type

        next_probs = torch.zeros_like(board_probs)

        shifts = [
            torch.roll(board_probs, 1, dims=0),
            torch.roll(board_probs, -1, dims=1),
            torch.roll(board_probs, -1, dims=0),
            torch.roll(board_probs, 1, dims=1),
        ]

        for d, neighbor_probs in enumerate(shifts):
            for x in range(K):
                for n in range(K):
                    joint = board_probs[:, :, x] * neighbor_probs[:, :, n]
                    trans = T[x, n]  # (K,) — frozen, no grad
                    # Gradients flow through: joint (from board_probs) and rates[x]
                    contribution = joint.unsqueeze(-1) * rates[x] * trans.unsqueeze(0).unsqueeze(0) * dt
                    next_probs = next_probs + contribution

        total_change = next_probs.sum(dim=-1, keepdim=True).clamp(max=1.0)
        result = (1 - total_change) * board_probs + next_probs
        return result / result.sum(dim=-1, keepdim=True).clamp(min=1e-8)

    def simulate_trajectory(self, initial_board, n_steps=50, dt=0.1):
        """Roll out n_steps of soft evolution."""
        T = self._precompute_transition_table()
        trajectory = [initial_board]
        state = initial_board
        for _ in range(n_steps):
            state = self.simulate_step(state, T, dt)
            trajectory.append(state)
        return trajectory


def outcome_type_abundance(trajectory, type_idx):
    """Average abundance of a type over trajectory."""
    total = 0
    for state in trajectory:
        total += state[:, :, type_idx].mean()
    return total / len(trajectory)


def outcome_diversity(trajectory):
    """Average entropy of type distribution."""
    total = 0
    for state in trajectory:
        p = state.mean(dim=(0, 1))  # (K,) average over spatial
        entropy = -(p * torch.log(p + 1e-8)).sum()
        total += entropy
    return total / len(trajectory)


def outcome_type_survival(trajectory, type_idx, threshold=0.01):
    """Fraction of steps where type exists above threshold."""
    alive = 0
    for state in trajectory:
        if state[:, :, type_idx].mean() > threshold:
            alive += 1
    return alive / len(trajectory)


def optimize_rates(world_model, num_types, type_names, board_size=16,
                   outcome_fn=None, n_iters=100, lr=0.01, n_sim_steps=50):
    """Optimize rate parameters to maximize an outcome function."""
    sim = DifferentiableSimulator(world_model, num_types, board_size)
    optimizer = torch.optim.Adam([sim.log_rates], lr=lr)

    print(f"\n  Optimizing rates for {n_iters} iterations...")
    initial_rates = F.softplus(sim.log_rates).detach().clone()

    history = []
    for i in range(n_iters):
        # Random initial board (soft one-hot)
        board = torch.zeros(board_size, board_size, num_types)
        # Start with mostly empty/ground (type 0)
        board[:, :, 0] = 0.8
        for k in range(1, num_types):
            board[:, :, k] = 0.2 / (num_types - 1)
        board = board + torch.randn_like(board) * 0.01
        board = board / board.sum(dim=-1, keepdim=True)

        trajectory = sim.simulate_trajectory(board, n_steps=n_sim_steps)
        outcome = outcome_fn(trajectory)

        if not isinstance(outcome, torch.Tensor):
            outcome = torch.tensor(outcome, dtype=torch.float32, requires_grad=True)

        loss = -outcome
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        history.append(float(outcome.item() if hasattr(outcome, 'item') else outcome))
        if (i + 1) % 20 == 0:
            print(f"    iter {i+1}: outcome={outcome.item():.4f}")

    final_rates = F.softplus(sim.log_rates).detach()

    print(f"\n  Rate changes:")
    for k in range(num_types):
        init = initial_rates[k].item()
        final = final_rates[k].item()
        change = final - init
        if abs(change) > 0.01:
            direction = "+" if change > 0 else ""
            print(f"    {type_names[k]:<20} {init:.3f} → {final:.3f} ({direction}{change:.3f})")

    return {
        'initial_rates': initial_rates.numpy(),
        'final_rates': final_rates.numpy(),
        'type_names': type_names,
        'history': history,
    }


def main():
    parser = argparse.ArgumentParser(description='Gradient-based game design')
    parser.add_argument('--game', default='predator_prey')
    parser.add_argument('--model', choices=['tensor', 'lowrank', 'embedding'],
                        default='lowrank')
    parser.add_argument('--outcome', default='diversity',
                        choices=['diversity', 'survival', 'abundance'])
    parser.add_argument('--target-type', default=None,
                        help='Type name for abundance/survival outcomes')
    parser.add_argument('--board-size', type=int, default=16)
    parser.add_argument('--train-episodes', type=int, default=200)
    parser.add_argument('--opt-iters', type=int, default=100)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    print("=" * 60)
    print(f"Gradient-Based Game Design: {args.game}")
    print(f"Model: {args.model}, Outcome: {args.outcome}")
    print("=" * 60)

    # Step 1: Train world model
    print("\n--- Training World Model ---")
    model, type_names, n_types = train_world_model(
        args.game, args.model, args.board_size, args.train_episodes, args.seed)

    # Step 2: Set up outcome function
    if args.outcome == 'diversity':
        outcome_fn = outcome_diversity
    elif args.outcome == 'survival':
        if args.target_type:
            tidx = type_names.index(args.target_type)
        else:
            # Default: player survival
            tidx = next(i for i, n in enumerate(type_names) if n == 'player')
        outcome_fn = lambda traj: outcome_type_survival(traj, tidx)
    elif args.outcome == 'abundance':
        if args.target_type:
            tidx = type_names.index(args.target_type)
        else:
            tidx = 0
        outcome_fn = lambda traj: outcome_type_abundance(traj, tidx)

    # Step 3: Optimize rates
    print("\n--- Optimizing Rates ---")
    if args.model == 'tensor':
        print("  Note: tensor model is not differentiable. Use --model lowrank or embedding.")
        return

    results = optimize_rates(
        model, n_types, type_names, args.board_size,
        outcome_fn=outcome_fn, n_iters=args.opt_iters)

    print(f"\n  Outcome improvement: {results['history'][0]:.4f} → {results['history'][-1]:.4f}")


if __name__ == '__main__':
    main()
