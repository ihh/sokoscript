"""JAX-backed board state for GPU-accelerated simulation.

Stores cell types and states as JAX arrays. Toroidal access via modular arithmetic.
"""

try:
    import jax
    import jax.numpy as jnp
    HAS_JAX = True
except ImportError:
    HAS_JAX = False

import numpy as np
from .board import Board, RangeCounter, _random_int, _random_big_int, _knuth_shuffle
from .rng import MersenneTwister, fast_ln_left_shift_26, fast_ln_left_shift_26_max
from .engine import transform_rule_update
from . import lookups

MAX_STATE_LEN = 64


class JAXBoardState:
    """JAX array representation of board state.

    cell_types: uint8[size, size] - type index per cell
    cell_states: uint8[size, size, MAX_STATE_LEN] - state chars (as ASCII codes)
    cell_state_lens: uint8[size, size] - length of state string per cell
    """

    def __init__(self, size):
        if not HAS_JAX:
            raise ImportError("JAX not installed. Install with: pip install jax jaxlib")
        self.size = size
        self.cell_types = jnp.zeros((size, size), dtype=jnp.uint8)
        self.cell_states = jnp.zeros((size, size, MAX_STATE_LEN), dtype=jnp.uint8)
        self.cell_state_lens = jnp.zeros((size, size), dtype=jnp.uint8)

    def get_type(self, x, y):
        return int(self.cell_types[y % self.size, x % self.size])

    def get_state(self, x, y):
        row, col = y % self.size, x % self.size
        slen = int(self.cell_state_lens[row, col])
        codes = self.cell_states[row, col, :slen]
        return ''.join(chr(int(c)) for c in codes)

    def set_cell(self, x, y, type_idx, state=''):
        row, col = y % self.size, x % self.size
        self.cell_types = self.cell_types.at[row, col].set(type_idx)
        state_codes = np.zeros(MAX_STATE_LEN, dtype=np.uint8)
        for i, c in enumerate(state[:MAX_STATE_LEN]):
            state_codes[i] = ord(c)
        self.cell_states = self.cell_states.at[row, col].set(jnp.array(state_codes))
        self.cell_state_lens = self.cell_state_lens.at[row, col].set(min(len(state), MAX_STATE_LEN))

    def type_counts(self, num_types):
        """Count cells of each type using jnp.bincount."""
        flat = self.cell_types.reshape(-1).astype(jnp.int32)
        return jnp.bincount(flat, length=num_types)

    def to_one_hot(self, num_types):
        """One-hot encode cell types: (size, size, num_types) float32."""
        return jax.nn.one_hot(self.cell_types.astype(jnp.int32), num_types)

    @classmethod
    def from_board(cls, board):
        """Create JAXBoardState from a pure-Python Board."""
        state = cls(board.size)
        types = np.zeros((board.size, board.size), dtype=np.uint8)
        states = np.zeros((board.size, board.size, MAX_STATE_LEN), dtype=np.uint8)
        lens = np.zeros((board.size, board.size), dtype=np.uint8)

        for idx, cell in enumerate(board.cell):
            y, x = divmod(idx, board.size)
            x, y = idx % board.size, idx // board.size
            types[y, x] = cell['type']
            s = cell['state']
            lens[y, x] = len(s)
            for i, c in enumerate(s[:MAX_STATE_LEN]):
                states[y, x, i] = ord(c)

        state.cell_types = jnp.array(types)
        state.cell_states = jnp.array(states)
        state.cell_state_lens = jnp.array(lens)
        return state

    def to_board_cells(self, grammar_types):
        """Convert back to list of cell dicts for a pure-Python Board."""
        size = self.size
        types_np = np.array(self.cell_types)
        states_np = np.array(self.cell_states)
        lens_np = np.array(self.cell_state_lens)
        cells = []
        for y in range(size):
            for x in range(size):
                t = int(types_np[y, x])
                slen = int(lens_np[y, x])
                s = ''.join(chr(int(states_np[y, x, i])) for i in range(slen))
                cells.append({'type': t, 'state': s})
        return cells


class JAXBoard(Board):
    """Board that maintains a parallel JAX array representation.

    Sync rules use JAX for parallel execution. Async rules use the
    pure-Python path but update the JAX state.
    """

    def __init__(self, opts=None):
        self._jax_state = None
        super().__init__(opts)

    def init_grammar(self, grammar):
        super().init_grammar(grammar)
        if HAS_JAX:
            self._jax_state = JAXBoardState(self.size)
            self._sync_jax_from_python()

    def set_cell(self, x, y, new_value):
        super().set_cell(x, y, new_value)
        if self._jax_state is not None:
            state = new_value.get('state', '')
            if len(state) > self.max_state_len:
                state = state[:self.max_state_len]
            self._jax_state.set_cell(x, y, new_value['type'], state)

    def set_cell_by_index(self, index, new_value):
        super().set_cell_by_index(index, new_value)
        if self._jax_state is not None:
            x, y = self.index2xy(index)
            state = new_value.get('state', '')
            self._jax_state.set_cell(x, y, new_value['type'], state)

    def _sync_jax_from_python(self):
        """Rebuild JAX state from Python cells."""
        if self._jax_state is not None:
            self._jax_state = JAXBoardState.from_board(self)

    def get_jax_state(self):
        return self._jax_state

    def get_observation(self):
        """Get one-hot observation suitable for RL: (size, size, num_types) float32."""
        if self._jax_state is not None:
            return self._jax_state.to_one_hot(len(self.grammar['types']))
        return None
