"""Custom CNN policy with circular padding for toroidal grid topology."""

try:
    import torch
    import torch.nn as nn
    from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
    from stable_baselines3.common.callbacks import BaseCallback
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

if HAS_TORCH:
    class CircularPad2d(nn.Module):
        """Circular (wrap-around) padding for toroidal grid topology."""

        def __init__(self, padding=1):
            super().__init__()
            self.padding = padding

        def forward(self, x):
            return nn.functional.pad(x, [self.padding] * 4, mode='circular')

    class ToroidalCNN(BaseFeaturesExtractor):
        """CNN feature extractor with circular padding for SokoScript boards.

        Architecture: 3 conv layers [32, 64, 64] with 3x3 kernels,
        circular padding, and ReLU activations.
        """

        def __init__(self, observation_space, features_dim=256):
            super().__init__(observation_space, features_dim)
            n_input = observation_space.shape[2]  # num_types (channel-last obs -> channel-first)

            self.cnn = nn.Sequential(
                # Layer 1: 32 filters
                CircularPad2d(1),
                nn.Conv2d(n_input, 32, kernel_size=3, stride=1, padding=0),
                nn.ReLU(),
                # Layer 2: 64 filters
                CircularPad2d(1),
                nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=0),
                nn.ReLU(),
                # Layer 3: 64 filters
                CircularPad2d(1),
                nn.Conv2d(64, 64, kernel_size=3, stride=1, padding=0),
                nn.ReLU(),
                nn.Flatten(),
            )

            # Compute output size
            with torch.no_grad():
                sample = torch.zeros(1, n_input, *observation_space.shape[:2])
                n_flatten = self.cnn(sample).shape[1]

            self.linear = nn.Sequential(
                nn.Linear(n_flatten, features_dim),
                nn.ReLU(),
            )

        def forward(self, observations):
            # observations: (batch, H, W, C) -> (batch, C, H, W)
            x = observations.permute(0, 3, 1, 2)
            return self.linear(self.cnn(x))

    class ToroidalCNNWithTransitionHead(BaseFeaturesExtractor):
        """ToroidalCNN + auxiliary transition prediction head.

        The transition head is a 1x1 conv on the final conv features that
        predicts P(next_type) for each cell. Trained via auxiliary cross-entropy
        loss from (obs_t, obs_{t+1}) pairs in the PPO rollout buffer.

        The transition logits are stored in self._transition_logits for
        access by TransitionPredictionCallback.
        """

        def __init__(self, observation_space, features_dim=256, n_types=None):
            super().__init__(observation_space, features_dim)
            n_input = observation_space.shape[2]
            # Detect if last channel is mask (from MaskedLocalObsWrapper)
            # n_types is the number of actual cell types (excluding mask)
            self._n_types = n_types or n_input

            self.conv_layers = nn.Sequential(
                CircularPad2d(1),
                nn.Conv2d(n_input, 32, kernel_size=3, stride=1, padding=0),
                nn.ReLU(),
                CircularPad2d(1),
                nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=0),
                nn.ReLU(),
                CircularPad2d(1),
                nn.Conv2d(64, 64, kernel_size=3, stride=1, padding=0),
                nn.ReLU(),
            )

            # Transition prediction head: 1x1 conv -> n_types logits per cell
            self.transition_head = nn.Conv2d(64, self._n_types, kernel_size=1)

            # Standard policy path: flatten + linear
            with torch.no_grad():
                sample = torch.zeros(1, n_input, *observation_space.shape[:2])
                conv_out = self.conv_layers(sample)
                n_flatten = conv_out.numel() // conv_out.shape[0]

            self.flatten = nn.Flatten()
            self.linear = nn.Sequential(
                nn.Linear(n_flatten, features_dim),
                nn.ReLU(),
            )

            # Storage for callback access
            self._transition_logits = None

        def forward(self, observations):
            x = observations.permute(0, 3, 1, 2)  # (B, C, H, W)
            conv_features = self.conv_layers(x)     # (B, 64, H, W)

            # Store transition prediction for auxiliary loss
            self._transition_logits = self.transition_head(conv_features)  # (B, K, H, W)

            # Normal policy path
            return self.linear(self.flatten(conv_features))

    class TransitionPredictionCallback(BaseCallback):
        """Auxiliary loss: train the transition head to predict next cell types.

        After each rollout, computes cross-entropy between predicted and actual
        next-step observations. Backprops through the transition head and shared
        conv layers (but NOT through the policy/value heads).
        """

        def __init__(self, aux_weight=0.1, verbose=0):
            super().__init__(verbose)
            self.aux_weight = aux_weight
            self.aux_losses = []

        def _on_rollout_end(self):
            extractor = self.model.policy.features_extractor
            if not hasattr(extractor, '_transition_logits'):
                return True

            buf = self.model.rollout_buffer
            obs = torch.tensor(buf.observations, dtype=torch.float32)
            starts = torch.tensor(buf.episode_starts, dtype=torch.bool)
            # obs shape: (n_steps, n_envs, H, W, C) or (n_steps * n_envs, H, W, C)
            # In SB3, rollout_buffer.observations is (buffer_size, *obs_shape)
            # with n_envs flattened in. We need to reshape.

            n_steps = buf.buffer_size
            n_envs = buf.n_envs
            obs_shape = buf.obs_shape

            # Reshape to (n_steps, n_envs, ...)
            obs = obs.reshape(n_steps, n_envs, *obs_shape)
            starts = starts.reshape(n_steps, n_envs)

            # Take consecutive pairs, skip episode boundaries
            obs_t = obs[:-1]       # (n_steps-1, n_envs, H, W, C)
            obs_tp1 = obs[1:]
            valid = ~starts[1:]     # (n_steps-1, n_envs)

            # Flatten valid pairs
            obs_t_flat = obs_t[valid]      # (N, H, W, C)
            obs_tp1_flat = obs_tp1[valid]  # (N, H, W, C)

            if obs_t_flat.shape[0] == 0:
                return True

            # Subsample if too many (keep training fast)
            max_pairs = 512
            if obs_t_flat.shape[0] > max_pairs:
                idx = torch.randperm(obs_t_flat.shape[0])[:max_pairs]
                obs_t_flat = obs_t_flat[idx]
                obs_tp1_flat = obs_tp1_flat[idx]

            device = next(extractor.parameters()).device
            obs_t_flat = obs_t_flat.to(device)
            obs_tp1_flat = obs_tp1_flat.to(device)

            # Forward through extractor to populate _transition_logits
            extractor.forward(obs_t_flat)
            logits = extractor._transition_logits  # (N, K, H, W)

            # Target: type indices from obs_tp1 (argmax of one-hot)
            n_types = extractor._n_types
            target_onehot = obs_tp1_flat[:, :, :, :n_types]  # (N, H, W, K)
            target = target_onehot.argmax(dim=-1)             # (N, H, W)

            # Mask: ignore cells where obs_t is masked (if mask channel exists)
            C = obs_t_flat.shape[-1]
            if C > n_types:
                mask_channel = obs_t_flat[:, :, :, -1]  # (N, H, W)
                valid_cells = mask_channel < 0.5         # True where not masked
            else:
                valid_cells = torch.ones_like(target, dtype=torch.bool)

            # Cross-entropy loss (only on valid cells)
            logits_flat = logits.permute(0, 2, 3, 1).reshape(-1, n_types)  # (N*H*W, K)
            target_flat = target.reshape(-1)
            valid_flat = valid_cells.reshape(-1)

            if valid_flat.sum() == 0:
                return True

            loss = nn.functional.cross_entropy(
                logits_flat[valid_flat], target_flat[valid_flat]
            )

            # Backward through transition head + conv layers only
            aux_loss = self.aux_weight * loss
            extractor.zero_grad()
            aux_loss.backward()

            # Apply gradients to extractor parameters
            with torch.no_grad():
                for param in extractor.parameters():
                    if param.grad is not None:
                        param.data -= self.model.learning_rate * param.grad

            self.aux_losses.append(loss.item())
            if self.verbose > 0 and len(self.aux_losses) % 10 == 0:
                avg = sum(self.aux_losses[-10:]) / 10
                print(f"  [TransitionHead] loss={loss.item():.4f} (avg10={avg:.4f})")

            return True
