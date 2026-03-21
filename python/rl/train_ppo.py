"""PPO training for SokoScript games.

Usage:
    python -m rl.train_ppo --game forest_fire --timesteps 1000000
"""

import argparse
import os
import sys

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def make_forest_fire_env(board_size=16, seed=None):
    """Create a forest fire environment."""
    from sokoscript.env import SokoScriptEnv

    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
    with open(os.path.join(grammars_dir, 'forest_fire.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        import random
        rng = random.Random(seed)
        # Place fireman
        board.set_cell_type_by_name(
            board.size // 2, board.size // 2,
            'fireman', '', {'id': 'p1'}
        )
        # Place random trees and grass
        for y in range(board.size):
            for x in range(board.size):
                if x == board.size // 2 and y == board.size // 2:
                    continue
                r = rng.random()
                if r < 0.4:
                    board.set_cell_type_by_name(x, y, 'tree')
                elif r < 0.6:
                    board.set_cell_type_by_name(x, y, 'grass')
        # Start a fire
        board.set_cell_type_by_name(3, 3, 'fire')
        board.set_cell_type_by_name(12, 12, 'fire')

    return SokoScriptEnv(
        grammar=grammar,
        board_size=board_size,
        player_id='p1',
        dt=0.2,
        max_steps=500,
        board_init_fn=init_fn,
        score_reward_scale=10.0,
        time_penalty=0.01,
        seed=seed,
    )


def make_apple_collector_env(board_size=16, seed=None):
    """Create an apple collector environment."""
    from sokoscript.env import SokoScriptEnv

    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
    with open(os.path.join(grammars_dir, 'apple_collector.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        for y in range(board.size):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'ground')
        board.set_cell_type_by_name(
            board.size // 2, board.size // 2,
            'player', '', {'id': 'p1'}
        )

    return SokoScriptEnv(
        grammar=grammar,
        board_size=board_size,
        player_id='p1',
        dt=0.1,
        max_steps=500,
        board_init_fn=init_fn,
        score_reward_scale=1.0,
        time_penalty=0.001,
        seed=seed,
    )


def make_predator_prey_env(board_size=16, seed=None, n_predators=3):
    """Create a predator-prey environment."""
    from sokoscript.env import SokoScriptEnv

    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
    with open(os.path.join(grammars_dir, 'predator_prey.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        import random
        rng = random.Random(seed)
        for y in range(board.size):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'ground')
        board.set_cell_type_by_name(
            board.size // 2, board.size // 2,
            'player', '', {'id': 'p1'}
        )
        # Place predators at edges
        edge_positions = [
            (0, 0), (board.size - 1, 0),
            (0, board.size - 1), (board.size - 1, board.size - 1),
            (board.size // 2, 0), (0, board.size // 2),
        ]
        rng.shuffle(edge_positions)
        for i in range(min(n_predators, len(edge_positions))):
            x, y = edge_positions[i]
            board.set_cell_type_by_name(x, y, 'predator')

    return SokoScriptEnv(
        grammar=grammar,
        board_size=board_size,
        player_id='p1',
        dt=0.1,
        max_steps=500,
        board_init_fn=init_fn,
        score_reward_scale=1.0,
        time_penalty=0.001,
        seed=seed,
    )


def make_plague_doctor_env(board_size=16, seed=None, n_sick=3):
    """Create a plague doctor environment."""
    from sokoscript.env import SokoScriptEnv

    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
    with open(os.path.join(grammars_dir, 'plague_doctor.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        import random
        rng = random.Random(seed)
        # Fill with healthy villagers
        for y in range(board.size):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'healthy')
        # Place player in center
        board.set_cell_type_by_name(
            board.size // 2, board.size // 2,
            'player', '', {'id': 'p1'}
        )
        # Place initial sick at edges
        edge_positions = [
            (0, 0), (board.size - 1, board.size - 1),
            (board.size - 1, 0), (0, board.size - 1),
        ]
        rng.shuffle(edge_positions)
        for i in range(min(n_sick, len(edge_positions))):
            x, y = edge_positions[i]
            board.set_cell_type_by_name(x, y, 'sick')

    return SokoScriptEnv(
        grammar=grammar,
        board_size=board_size,
        player_id='p1',
        dt=0.2,
        max_steps=500,
        board_init_fn=init_fn,
        score_reward_scale=1.0,
        time_penalty=0.001,
        seed=seed,
    )


def make_key_door_env(board_size=8, seed=None):
    """Create a key-and-door environment."""
    from sokoscript.env import SokoScriptEnv

    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
    with open(os.path.join(grammars_dir, 'key_door.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        import random
        rng = random.Random(seed)
        for y in range(board.size):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'ground')
        # Wall row with gap
        for x in range(board.size):
            board.set_cell_type_by_name(x, 3, 'wall')
        gap_x = rng.randint(1, board.size - 2)
        board.set_cell_type_by_name(gap_x, 3, 'ground')
        # Key in upper half, door in lower half
        key_x = rng.randint(0, board.size - 1)
        key_y = rng.randint(0, 2)
        board.set_cell_type_by_name(key_x, key_y, 'key')
        door_x = rng.randint(0, board.size - 1)
        door_y = rng.randint(4, board.size - 1)
        board.set_cell_type_by_name(door_x, door_y, 'door')
        # Player in lower half
        px = rng.randint(0, board.size - 1)
        py = rng.randint(4, board.size - 1)
        while (px, py) == (door_x, door_y):
            px = rng.randint(0, board.size - 1)
        board.set_cell_type_by_name(px, py, 'player', '', {'id': 'p1'})

    return SokoScriptEnv(
        grammar=grammar,
        board_size=board_size,
        player_id='p1',
        dt=0.1,
        max_steps=200,
        board_init_fn=init_fn,
        score_reward_scale=10.0,
        time_penalty=0.01,
        seed=seed,
    )


def make_treasure_miner_env(board_size=16, seed=None):
    """Create a treasure miner environment."""
    from sokoscript.env import SokoScriptEnv

    grammars_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
    with open(os.path.join(grammars_dir, 'treasure_miner.txt')) as f:
        grammar = f.read()

    def init_fn(board):
        import random
        rng = random.Random(seed)
        # Fill with dirt
        for y in range(board.size):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'dirt')
        # Rock layer at top (rows 0-2)
        for y in range(3):
            for x in range(board.size):
                board.set_cell_type_by_name(x, y, 'rock')
        # Scatter gems in dirt
        n_gems = max(board.size, 8)
        placed = 0
        while placed < n_gems:
            gx = rng.randint(0, board.size - 1)
            gy = rng.randint(3, board.size - 1)
            board.set_cell_type_by_name(gx, gy, 'gem')
            placed += 1
        # Player at bottom with clear starting area
        px = board.size // 2
        py = board.size - 1
        board.set_cell_type_by_name(px, py, 'player', '', {'id': 'p1'})
        board.set_cell_type_by_name(px, py - 1, 'ground')

    return SokoScriptEnv(
        grammar=grammar,
        board_size=board_size,
        player_id='p1',
        dt=0.05,
        max_steps=500,
        board_init_fn=init_fn,
        score_reward_scale=1.0,
        time_penalty=0.001,
        seed=seed,
    )


def make_env(game, board_size=16, seed=None):
    if game == 'forest_fire':
        return make_forest_fire_env(board_size, seed)
    if game == 'apple_collector':
        return make_apple_collector_env(board_size, seed)
    if game == 'predator_prey':
        return make_predator_prey_env(board_size, seed)
    if game == 'plague_doctor':
        return make_plague_doctor_env(board_size, seed)
    if game == 'key_door':
        return make_key_door_env(board_size if board_size != 16 else 8, seed)
    if game == 'treasure_miner':
        return make_treasure_miner_env(board_size, seed)
    raise ValueError(f"Unknown game: {game}")


def train(game='forest_fire', timesteps=1_000_000, board_size=16,
          n_envs=8, seed=42, log_dir='./logs', use_wandb=False):
    """Train PPO agent on a SokoScript game."""
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv
        from stable_baselines3.common.callbacks import EvalCallback
    except ImportError:
        print("stable-baselines3 not installed. Install with: pip install stable-baselines3")
        return

    try:
        from rl.networks import ToroidalCNN
        policy_kwargs = dict(
            features_extractor_class=ToroidalCNN,
            features_extractor_kwargs=dict(features_dim=256),
        )
    except ImportError:
        print("Warning: Using default CNN policy (torch not available for custom network)")
        policy_kwargs = {}

    # Create vectorized environments
    def make_env_fn(env_seed):
        def _init():
            return make_env(game, board_size, env_seed)
        return _init

    if n_envs > 1:
        env = DummyVecEnv([make_env_fn(seed + i) for i in range(n_envs)])
    else:
        env = DummyVecEnv([make_env_fn(seed)])

    # Evaluation env
    eval_env = DummyVecEnv([make_env_fn(seed + 1000)])

    # Callbacks
    callbacks = [
        EvalCallback(
            eval_env,
            best_model_save_path=os.path.join(log_dir, 'best_model'),
            log_path=os.path.join(log_dir, 'eval'),
            eval_freq=max(10000 // n_envs, 1),
            n_eval_episodes=10,
            deterministic=True,
        ),
    ]

    # Initialize wandb if requested
    if use_wandb:
        try:
            import wandb
            wandb.init(
                project='sokoscript-rl',
                config={
                    'game': game,
                    'timesteps': timesteps,
                    'board_size': board_size,
                    'n_envs': n_envs,
                    'seed': seed,
                },
            )
        except ImportError:
            print("wandb not installed, skipping logging")

    # Create and train model
    model = PPO(
        'CnnPolicy',
        env,
        policy_kwargs=policy_kwargs,
        verbose=1,
        tensorboard_log=os.path.join(log_dir, 'tensorboard'),
        seed=seed,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
    )

    print(f"Training PPO on {game} for {timesteps} timesteps with {n_envs} envs...")
    model.learn(total_timesteps=timesteps, callback=callbacks)

    # Save final model
    model_path = os.path.join(log_dir, f'{game}_ppo_final')
    model.save(model_path)
    print(f"Model saved to {model_path}")

    env.close()
    eval_env.close()


def main():
    parser = argparse.ArgumentParser(description='Train PPO agent on SokoScript game')
    parser.add_argument('--game', default='forest_fire', help='Game name')
    parser.add_argument('--timesteps', type=int, default=1_000_000, help='Total timesteps')
    parser.add_argument('--board-size', type=int, default=16, help='Board size')
    parser.add_argument('--n-envs', type=int, default=8, help='Number of parallel envs')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--log-dir', default='./logs', help='Log directory')
    parser.add_argument('--wandb', action='store_true', help='Enable wandb logging')
    args = parser.parse_args()

    train(
        game=args.game,
        timesteps=args.timesteps,
        board_size=args.board_size,
        n_envs=args.n_envs,
        seed=args.seed,
        log_dir=args.log_dir,
        use_wandb=args.wandb,
    )


if __name__ == '__main__':
    main()
