import math

LogTable256 = [0] * 256
for i in range(2, 256):
    LogTable256[i] = 1 + LogTable256[i >> 1]

def fastLog2Floor(v):
    tt = 0
    if (tt := v >> 24):
        return 24 + LogTable256[tt & 0xff]
    if (tt := v >> 16):
        return 16 + LogTable256[tt & 0xff]
    if (tt := v >> 8):
        return 8 + LogTable256[tt & 0xff]
    return LogTable256[v]

def fastLg_leftShift26(x):
    x = x & 0xffffffff
    lg = fastLog2Floor(x)
    nUsefulBits = min(lg, 26)
    return (lg << 26) | ((x & ((1 << nUsefulBits) - 1)) << (26 - nUsefulBits))

fastLg_leftShift26_max = fastLg_leftShift26(0xffffffff) + 1

log2_21 = round(math.log(2) * (1 << 21))

def fastLn_leftShift26(x):
    return int((fastLg_leftShift26(x) * log2_21) >> 21)

fastLn_leftShift26_max = fastLn_leftShift26(0xffffffff) + 1


