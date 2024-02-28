import numberToBase64

N = 624
M = 397
UPPER_MASK = 0x80000000
LOWER_MASK = 0x7fffffff
MATRIX_A = 0x9908b0df

class MersenneTwister:
    def __init__(self, seed=None):
        if seed == '':
            seed = int(time.time())
        self.mt = [0] * N
        self.mti = N + 1
        self.seed(seed)

    def seed(self, seed):
        self.mt[0] = seed & 0xffffffff
        for self.mti in range(1, N):
            s = self.mt[self.mti - 1] ^ (self.mt[self.mti - 1] >> 30)
            self.mt[self.mti] = (((((s & 0xffff0000) >> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253) + self.mti
            self.mt[self.mti] &= 0xffffffff

    def __str__(self):
        return numberToBase64.int32ArrayToBase64String([self.mti] + self.mt)

    def initFromString(self, s):
        a = numberToBase64.base64StringToInt32Array(s)
        self.mti = a[0]
        self.mt = a[1:]

    @staticmethod
    def newFromString(s):
        rng = MersenneTwister()
        rng.initFromString(s)
        return rng

    def int(self):
        mag01 = [0, MATRIX_A]
        if self.mti >= N:
            if self.mti == N + 1:
                self.seed(5489)
            for kk in range(N - M):
                y = (self.mt[kk] & UPPER_MASK) | (self.mt[kk + 1] & LOWER_MASK)
                self.mt[kk] = self.mt[kk + M] ^ (y >> 1) ^ mag01[y & 1]
            for kk in range(N - 1, N):
                y = (self.mt[kk] & UPPER_MASK) | (self.mt[kk + 1] & LOWER_MASK)
                self.mt[kk] = self.mt[kk + (M - N)] ^ (y >> 1) ^ mag01[y & 1]
            y = (self.mt[N - 1] & UPPER_MASK) | (self.mt[0] & LOWER_MASK)
            self.mt[N - 1] = self.mt[M - 1] ^ (y >> 1) ^ mag01[y & 1]
            self.mti = 0
        y = self.mt[self.mti]
        y ^= (y >> 11)
        y ^= (y << 7) & 0x9d2c5680
        y ^= (y << 15) & 0xefc60000
        y ^= (y >> 18)
        return y & 0xffffffff

from time import time

