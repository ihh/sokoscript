"""JAX-accelerated sync rule matching.

For sync rules with fixed addresses (the common case), we can vectorize
the pattern matching and rule application across all cells simultaneously
using jnp.roll for neighbor access.
"""

try:
    import jax
    import jax.numpy as jnp
    from functools import partial
    HAS_JAX = True
except ImportError:
    HAS_JAX = False


def classify_rule(rule):
    """Classify a rule as 'simple' (fixed addresses, no complex state matching)
    or 'complex' (state-dependent addresses, wildcards, etc.).

    Simple rules can be vectorized with jnp.roll.
    """
    for i, term in enumerate(rule['lhs']):
        if i == 0:
            continue
        addr = term.get('addr', {'op': 'reldir', 'dir': 'F'})
        if addr['op'] not in ('absdir', 'reldir'):
            return 'complex'
        # Check for state-dependent matching
        if term.get('state'):
            for s in term['state']:
                if isinstance(s, dict) and s.get('op') not in ('char', None):
                    return 'complex'
    # Check RHS for complex state expressions
    for term in rule['rhs']:
        if term.get('state'):
            for s in term['state']:
                if isinstance(s, dict) and s.get('op') not in ('char', None):
                    return 'complex'
    return 'simple'


if HAS_JAX:
    # Direction to (dx, dy) offset
    _DIR_OFFSETS = {
        'N': (0, -1), 'E': (1, 0), 'S': (0, 1), 'W': (-1, 0),
        'F': (0, -1), 'R': (1, 0), 'B': (0, 1), 'L': (-1, 0),
    }

    def _get_neighbor(cell_types, dx, dy):
        """Get neighbor types using jnp.roll for toroidal access."""
        return jnp.roll(jnp.roll(cell_types, -dy, axis=0), -dx, axis=1)

    @partial(jax.jit, static_argnums=(1, 2, 3))
    def apply_simple_sync_swap(cell_types, subject_type, neighbor_type, dx, dy,
                                new_subject_type, new_neighbor_type):
        """JIT-compiled sync rule: swap/replace a subject-neighbor pair.

        This handles the most common sync rule pattern:
        subject neighbor : new_subject new_neighbor
        """
        size = cell_types.shape[0]
        neighbor = _get_neighbor(cell_types, dx, dy)

        # Find cells where rule matches
        match = (cell_types == subject_type) & (neighbor == neighbor_type)

        # Apply: update matched cells and their neighbors
        new_types = jnp.where(match, new_subject_type, cell_types)
        # Shift match mask to neighbor positions and apply there
        neighbor_match = jnp.roll(jnp.roll(match, dy, axis=0), dx, axis=1)
        new_types = jnp.where(neighbor_match, new_neighbor_type, new_types)

        return new_types

    @partial(jax.jit, static_argnums=(1, 2))
    def apply_simple_sync_self(cell_types, subject_type, new_type):
        """JIT-compiled sync rule: transform a single cell type.

        Handles: subject : new_type
        """
        match = cell_types == subject_type
        return jnp.where(match, new_type, cell_types)
