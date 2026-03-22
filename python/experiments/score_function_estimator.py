"""Score function estimator for CTBN rate sensitivity analysis.

Computes ∂E[outcome]/∂θ_k for each rate parameter θ_k in the grammar,
where outcome can be total score, survival time, divine action usage, etc.

The key identity: for a Gillespie trajectory with log-probability log p(τ|θ),
    ∂/∂θ_k log p = (n_k / θ_k) − T_k
where n_k = times rule k fired, T_k = total cell-seconds rule k was eligible.

Usage:
    cd python && python -m experiments.score_function_estimator \
        --game predator_prey --episodes 200 --metric score
"""

import argparse
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class RuleFireLogger:
    """Wraps a Board to log which rules fire and compute exposure."""

    def __init__(self, board):
        self.board = board
        self.fire_counts = {}   # rule_id -> count
        self.last_snapshot_time = None
        self.exposure = {}      # rule_id -> total cell-seconds eligible
        self._rule_index = self._build_rule_index()

    def _build_rule_index(self):
        """Build a mapping from (cell_type, rule_index) -> rule_id with metadata."""
        index = {}
        grammar = self.board.grammar
        rule_id = 0
        for cell_type in range(len(grammar['types'])):
            rules = grammar['transform'][cell_type]
            for ri, rule in enumerate(rules):
                rate_hz = rule.get('rate_Hz', 0)
                if rate_hz > 0:
                    name = grammar['types'][cell_type]
                    # rate_hz is approximately events/second (the human-readable rate)
                    # The actual per-second rate needs the acceptProb correction
                    accept_prob = rule.get('acceptProb_leftShift30', 0x3FFFFFFF) / 0x3FFFFFFF
                    effective_rate = rate_hz * accept_prob  # true events/sec/cell
                    index[(cell_type, ri)] = {
                        'id': rule_id,
                        'type': cell_type,
                        'type_name': name,
                        'rule_index': ri,
                        'rate_hz': rate_hz,
                        'effective_rate': effective_rate,
                    }
                    self.fire_counts[rule_id] = 0
                    self.exposure[rule_id] = 0.0
                    rule_id += 1
        return index

    @property
    def rules(self):
        """Return list of rule metadata, sorted by id."""
        return sorted(self._rule_index.values(), key=lambda r: r['id'])

    def snapshot_exposure(self, current_time_ticks):
        """Accumulate exposure since last snapshot."""
        if self.last_snapshot_time is None:
            self.last_snapshot_time = current_time_ticks
            return

        dt_seconds = (current_time_ticks - self.last_snapshot_time) / (1 << 32)
        if dt_seconds <= 0:
            return

        # For each rule, exposure = count_of_eligible_cells * dt
        for (cell_type, ri), meta in self._rule_index.items():
            n_cells = self.board.by_type[cell_type].total()
            self.exposure[meta['id']] += n_cells * dt_seconds

        self.last_snapshot_time = current_time_ticks

    def record_fire(self, cell_type, rule):
        """Record that a rule fired. Called from patched _apply_rule."""
        # Find which rule index this is
        rules = self.board.grammar['transform'][cell_type]
        for ri, r in enumerate(rules):
            if r is rule:
                key = (cell_type, ri)
                if key in self._rule_index:
                    self.fire_counts[self._rule_index[key]['id']] += 1
                break

    def score_function_gradient(self, outcome):
        """Compute ∂/∂θ_k log p * outcome for each rule k.

        The gradient is with respect to the effective rate (events/sec/cell).
        Returns dict: rule_id -> gradient component.
        """
        grads = {}
        for meta in self.rules:
            rid = meta['id']
            theta_k = meta['effective_rate']
            n_k = self.fire_counts[rid]
            t_k = self.exposure[rid]

            if theta_k > 0:
                grad_log_p = (n_k / theta_k) - t_k
            else:
                grad_log_p = 0.0

            grads[rid] = grad_log_p * outcome

        return grads


def run_episode_with_logging(game, board_size, seed, max_steps=500):
    """Run one episode, logging rule fires and exposure.

    Returns (outcome_dict, logger) where outcome_dict has
    score, survival_steps, total_reward.
    """
    from rl.train_ppo import make_env

    env = make_env(game, board_size, seed)
    obs, info = env.reset()

    board = env.board
    logger = RuleFireLogger(board)

    # Monkey-patch _apply_rule to log fires
    original_apply = board._apply_rule

    def patched_apply(x, y, direction, rule):
        # Figure out cell type at (x, y) before the rule fires
        idx = board.xy2index(x, y)
        cell_type = board.cell[idx]['type']
        result = original_apply(x, y, direction, rule)
        if result:
            logger.record_fire(cell_type, rule)
        return result

    board._apply_rule = patched_apply

    total_reward = 0
    step = 0
    done = False

    while not done:
        # Snapshot exposure before step
        logger.snapshot_exposure(board.time)

        action = env.action_space.sample()  # random policy for gradient estimation
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        step += 1
        done = terminated or truncated

    # Final exposure snapshot
    logger.snapshot_exposure(board.time)

    env.close()

    outcomes = {
        'score': info.get('score', 0),
        'survival_steps': step,
        'total_reward': total_reward,
    }

    return outcomes, logger


def estimate_gradients(game, board_size=16, n_episodes=200, seed=42, metric='score'):
    """Estimate ∂E[metric]/∂θ_k for all rate parameters using score function estimator."""

    all_grads = []
    all_outcomes = []
    rule_meta = None

    t0 = time.time()
    for ep in range(n_episodes):
        outcomes, logger = run_episode_with_logging(game, board_size, seed + ep)

        if rule_meta is None:
            rule_meta = logger.rules

        outcome_value = outcomes[metric]
        all_outcomes.append(outcome_value)

        grads = logger.score_function_gradient(outcome_value)
        all_grads.append(grads)

    elapsed = time.time() - t0

    n_rules = len(rule_meta)
    mean_outcome = np.mean(all_outcomes)

    grad_matrix = np.zeros((n_episodes, n_rules))
    for ep, grads in enumerate(all_grads):
        for rid, g in grads.items():
            grad_matrix[ep, rid] = g

    # Baseline subtraction: E[(f-b) * ∇log p] = E[f * ∇log p] since E[∇log p] = 0
    # So the mean is unchanged, but subtracting per-episode improves variance.
    # We recompute: store grad_log_p separately, multiply by (outcome - baseline).
    # For now, the raw estimator is correct; variance reduction is a refinement.
    mean_grads = grad_matrix.mean(axis=0)
    std_grads = grad_matrix.std(axis=0) / np.sqrt(n_episodes)

    return {
        'rules': rule_meta,
        'mean_grads': mean_grads,
        'std_grads': std_grads,
        'mean_outcome': mean_outcome,
        'n_episodes': n_episodes,
        'elapsed': elapsed,
        'metric': metric,
    }


def print_results(results):
    """Print gradient estimates sorted by magnitude."""
    rules = results['rules']
    grads = results['mean_grads']
    stds = results['std_grads']
    metric = results['metric']

    print(f"\nScore Function Gradient Estimates: ∂E[{metric}]/∂θ_k")
    print(f"  Mean {metric}: {results['mean_outcome']:.2f}")
    print(f"  Episodes: {results['n_episodes']}, Time: {results['elapsed']:.1f}s")
    print(f"\n  {'Rule':<40} {'Rate':>8} {'∂E/∂θ':>10} {'±SE':>8} {'Sig':>5}")
    print(f"  {'-'*71}")

    # Sort by absolute gradient
    order = np.argsort(-np.abs(grads))
    for idx in order:
        meta = rules[idx]
        g = grads[idx]
        se = stds[idx]
        sig = '***' if abs(g) > 2 * se and se > 0 else ''
        rate = meta['effective_rate']
        label = f"{meta['type_name']} rule#{meta['rule_index']}"
        print(f"  {label:<30} {rate:>8.2f}/s {g:>+12.2f} {se:>10.2f} {sig:>5}")


def main():
    parser = argparse.ArgumentParser(description='Score function estimator for rate sensitivity')
    parser.add_argument('--game', default='predator_prey', help='Game name')
    parser.add_argument('--board-size', type=int, default=16)
    parser.add_argument('--episodes', type=int, default=200)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--metric', default='score',
                        choices=['score', 'survival_steps', 'total_reward'])
    args = parser.parse_args()

    print("=" * 60)
    print(f"Rate Sensitivity Analysis: {args.game}")
    print(f"Metric: {args.metric}, Episodes: {args.episodes}")
    print("=" * 60)

    results = estimate_gradients(
        game=args.game,
        board_size=args.board_size,
        n_episodes=args.episodes,
        seed=args.seed,
        metric=args.metric,
    )

    print_results(results)

    # Also show which rates to increase/decrease for higher outcome
    print(f"\n  Recommendation for increasing E[{args.metric}]:")
    grads = results['mean_grads']
    stds = results['std_grads']
    for idx in np.argsort(-grads):
        meta = results['rules'][idx]
        g = grads[idx]
        se = stds[idx]
        if abs(g) > 2 * se and se > 0:
            direction = "INCREASE" if g > 0 else "DECREASE"
            rate = meta['effective_rate']
            print(f"    {direction} {meta['type_name']} rule#{meta['rule_index']} "
                  f"(rate={rate:.2f}/s, ∂={g:+.2f})")


if __name__ == '__main__':
    main()
