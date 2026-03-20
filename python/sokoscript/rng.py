"""Mersenne Twister RNG, port of src/MersenneTwister.js for cross-validation.

Also includes fast log2 approximation from src/log2.js.
"""

import base64
import struct

N = 624
M = 397
UPPER_MASK = 0x80000000
LOWER_MASK = 0x7FFFFFFF
MATRIX_A = 0x9908B0DF


class MersenneTwister:
    def __init__(self, seed=5489):
        self.mt = [0] * N
        self.mti = N + 1
        self.seed(seed)

    def seed(self, seed):
        self.mt[0] = seed & 0xFFFFFFFF
        for i in range(1, N):
            s = self.mt[i - 1] ^ (self.mt[i - 1] >> 30)
            self.mt[i] = (
                ((((s & 0xFFFF0000) >> 16) * 1812433253) << 16)
                + (s & 0x0000FFFF) * 1812433253
                + i
            ) & 0xFFFFFFFF
        self.mti = N

    def int(self):
        mag01 = [0, MATRIX_A]

        if self.mti >= N:
            if self.mti == N + 1:
                self.seed(5489)

            for kk in range(N - M):
                y = (self.mt[kk] & UPPER_MASK) | (self.mt[kk + 1] & LOWER_MASK)
                self.mt[kk] = self.mt[kk + M] ^ (y >> 1) ^ mag01[y & 1]

            for kk in range(N - M, N - 1):
                y = (self.mt[kk] & UPPER_MASK) | (self.mt[kk + 1] & LOWER_MASK)
                self.mt[kk] = self.mt[kk + (M - N)] ^ (y >> 1) ^ mag01[y & 1]

            y = (self.mt[N - 1] & UPPER_MASK) | (self.mt[0] & LOWER_MASK)
            self.mt[N - 1] = self.mt[M - 1] ^ (y >> 1) ^ mag01[y & 1]
            self.mti = 0

        y = self.mt[self.mti]
        self.mti += 1

        y ^= y >> 11
        y ^= (y << 7) & 0x9D2C5680
        y ^= (y << 15) & 0xEFC60000
        y ^= y >> 18

        return y & 0xFFFFFFFF

    def save_state(self):
        return list(self.mt), self.mti

    def restore_state(self, state):
        self.mt, self.mti = list(state[0]), state[1]

    def to_string(self):
        data = [self.mti] + self.mt
        buf = struct.pack(f'>{len(data)}i', *[x if x < 0x80000000 else x - 0x100000000 for x in data])
        return base64.b64encode(buf).decode('ascii')

    @classmethod
    def from_string(cls, s):
        buf = base64.b64decode(s)
        count = len(buf) // 4
        values = struct.unpack(f'>{count}i', buf)
        rng = cls.__new__(cls)
        rng.mti = values[0] & 0xFFFFFFFF
        rng.mt = [v & 0xFFFFFFFF for v in values[1:]]
        return rng


# Fast log2 approximation (port of src/log2.js)

_log_table_256 = [0] * 256
for _i in range(2, 256):
    _log_table_256[_i] = 1 + _log_table_256[_i >> 1]


def _fast_log2_floor(v):
    tt = (v >> 24) & 0xFF
    if tt:
        return 24 + _log_table_256[tt]
    tt = (v >> 16) & 0xFF
    if tt:
        return 16 + _log_table_256[tt]
    tt = (v >> 8) & 0xFF
    if tt:
        return 8 + _log_table_256[tt]
    return _log_table_256[v & 0xFF]


def fast_lg_left_shift_26(x):
    x = x & 0xFFFFFFFF
    lg = _fast_log2_floor(x)
    n_useful_bits = min(lg, 26)
    return (lg << 26) | ((x & ((1 << n_useful_bits) - 1)) << (26 - n_useful_bits))


fast_lg_left_shift_26_max = fast_lg_left_shift_26(0xFFFFFFFF) + 1

_log2_21 = round(0.6931471805599453 * (1 << 21))  # math.log(2) * 2^21


def fast_ln_left_shift_26(x):
    return (fast_lg_left_shift_26(x) * _log2_21) >> 21


fast_ln_left_shift_26_max = fast_ln_left_shift_26(0xFFFFFFFF) + 1
