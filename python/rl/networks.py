"""Custom CNN policy with circular padding for toroidal grid topology."""

try:
    import torch
    import torch.nn as nn
    from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
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
