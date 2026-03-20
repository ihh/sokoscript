"""Precomputed lookup tables for vector algebra, character encoding, and permutations.

Port of src/lookups.js. All operations are O(1) via table lookup.
"""

import math

# Direction vectors
dir_vec = {'N': (0, -1), 'E': (1, 0), 'S': (0, 1), 'W': (-1, 0)}
dirs = ['N', 'E', 'S', 'W']

# Transformation matrices (as 2x2 tuples)
matrices = {
    'F': ((1, 0), (0, 1)),
    'R': ((0, -1), (1, 0)),
    'B': ((-1, 0), (0, -1)),
    'L': ((0, 1), (-1, 0)),
    'H': ((-1, 0), (0, 1)),
    'V': ((1, 0), (0, -1)),
}

# Neighborhoods
neighborhood = {
    'moore': [(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1)],
    'neumann': [(0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)],
}

# Vector algebra
def add_vecs(u, v):
    return (u[0] + v[0], u[1] + v[1])

def mat_mul_vec(m, v):
    return (m[0][0] * v[0] + m[0][1] * v[1],
            m[1][0] * v[0] + m[1][1] * v[1])

def minus_vec(v):
    return mat_mul_vec(matrices['B'], v)

# Cyclic integer char encoding
FIRST_CHAR = 33
LAST_CHAR = 126
N_CHARS = LAST_CHAR + 1 - FIRST_CHAR  # 94

all_chars = [chr(n + FIRST_CHAR) for n in range(N_CHARS)]

def char2int(c):
    return ((ord(c) - FIRST_CHAR) % N_CHARS + N_CHARS) % N_CHARS

def int2char(n):
    return chr(FIRST_CHAR + ((n % N_CHARS) + N_CHARS) % N_CHARS)

def cyclic_add(a, b):
    return (a + b) % N_CHARS

def minus_int(x):
    return N_CHARS - x

# Vector char encoding
FIRST_VEC_CHAR = 40

def is_non_vec(v):
    return not (-4 <= v[0] <= 4 and -4 <= v[1] <= 4)

def is_zero_vec(v):
    return v[0] == 0 and v[1] == 0

def vec2char(v):
    if isinstance(v, (list, tuple)) and len(v) == 2:
        x, y = v
    else:
        raise TypeError(f"vec2char expects a 2-tuple, got {v!r}")
    if is_non_vec((x, y)):
        return '~'
    return chr(FIRST_VEC_CHAR + (x + 4) + (y + 4) * 9)

def char2vec(c):
    n = ord(c) - FIRST_VEC_CHAR
    if n < 0 or n > 80:
        return (float('nan'), float('nan'))
    return ((n % 9) - 4, (n // 9) - 4)


def _invert_char_func(f):
    inv = {}
    for c in all_chars:
        inv[f(c)] = c
    return lambda c: inv.get(c, c)


def _rotate_neighborhood_clockwise(c):
    v = char2vec(c)
    if is_non_vec(v) or is_zero_vec(v):
        return c
    x, y = v
    radius = max(abs(x), abs(y))
    if x == -radius:
        new_vec = (x + 1, y) if y == -radius else (x, y - 1)
    elif y == -radius:
        new_vec = (x, y + 1) if x == radius else (x + 1, y)
    elif x == radius:
        new_vec = (x - 1, y) if y == radius else (x, y + 1)
    else:  # y == radius, x > -radius
        new_vec = (x - 1, y)
    return vec2char(new_vec)


_rotate_neighborhood_counterclockwise = _invert_char_func(_rotate_neighborhood_clockwise)


# Precompute permutation tables
def _tabulate_char_func(f):
    return {c: f(c) for c in all_chars}

def _tabulate_vec_func(f):
    return _tabulate_char_func(lambda c: vec2char(f(char2vec(c))))

def _tabulate_int_func(f):
    return _tabulate_char_func(lambda c: int2char(f(char2int(c))))

def _tabulate_mat_mul(m):
    return _tabulate_vec_func(lambda v: mat_mul_vec(m, v))

def _tabulate_vec_add(c):
    v = char2vec(c)
    return _tabulate_vec_func(lambda u: add_vecs(v, u))

def _tabulate_vec_sub(c):
    v = minus_vec(char2vec(c))
    return _tabulate_vec_func(lambda u: add_vecs(v, u))

def _tabulate_int_add(c):
    n = char2int(c)
    return _tabulate_int_func(lambda m: cyclic_add(n, m))

def _tabulate_int_sub(c):
    n = minus_int(char2int(c))
    return _tabulate_int_func(lambda m: cyclic_add(n, m))


# Build the main lookup tables
char_perm_lookup = {
    'matMul': {k: _tabulate_mat_mul(m) for k, m in matrices.items()},
    'vecAdd': {c: _tabulate_vec_add(c) for c in all_chars},
    'vecSub': {c: _tabulate_vec_sub(c) for c in all_chars},
    'intAdd': {c: _tabulate_int_add(c) for c in all_chars},
    'intSub': {c: _tabulate_int_sub(c) for c in all_chars},
    'rotate': {
        'clock': _tabulate_char_func(_rotate_neighborhood_clockwise),
        'anti': _tabulate_char_func(_rotate_neighborhood_counterclockwise),
    },
}

char_lookup = {
    'absDir': {d: vec2char(dir_vec[d]) for d in dirs},
}

# Precompute char classes (neighborhoods of each cell)
def _compute_char_neighborhood(nbrs, c):
    v = char2vec(c)
    result = []
    for nbr in nbrs:
        nv = add_vecs(nbr, v)
        if not is_non_vec(nv):
            result.append(vec2char(nv))
    return ''.join(sorted(result))

char_class_lookup = {
    nh: _tabulate_char_func(lambda c, _nbrs=nbrs: _compute_char_neighborhood(_nbrs, c))
    for nh, nbrs in neighborhood.items()
}

# Precompute char->vector mapping
char_vec_lookup = _tabulate_char_func(char2vec)

# Precompute char->degree rotation mapping
char_rot_lookup = {
    vec2char((0, -1)): 0,
    vec2char((1, -1)): 45,
    vec2char((1, 0)): 90,
    vec2char((1, 1)): 135,
    vec2char((0, 1)): 180,
    vec2char((-1, 1)): 225,
    vec2char((-1, 0)): 270,
    vec2char((-1, -1)): 315,
}
