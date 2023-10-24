let LogTable256 = new Array(256).fill(0);
for (let i = 2; i < 256; i++)
  LogTable256[i] = 1 + LogTable256[i >> 1];
// To return NaN for log(0) we should set LogTable256[0] = NaN
// But we actually don't want that for our purposes, so leave it at 0

const fastLog2Floor = (v) => {
    let tt;
    if (tt = v >> 24) 
        return 24 + LogTable256[tt & 0xff];
    if (tt = v >> 16) 
        return 16 + LogTable256[tt & 0xff];
    if (tt = v >> 8)
        return 8 + LogTable256[tt & 0xff];
    return LogTable256[v];
}

// Input: 32-bit unsigned integer
// Output: 31-bit integer that is a fast piecewise linear approximation to (log2(x) * 2^26)
const fastLg_leftShift26 = (x) => {
    x = x & 0xffffffff;
    const lg = fastLog2Floor(x);
    const nUsefulBits = Math.min (lg, 26);  // this is how many bits of x we can use for the piecewise linear section
    return (lg << 26) | ((x & ((1<<nUsefulBits) - 1)) << (26 - nUsefulBits));
}
const fastLg_leftShift26_max = fastLg_leftShift26(0xffffffff) + 1;

// Input: 32-bit unsigned integer
// Output: 31-bit integer that is a fast piecewise linear approximation to (loge(x) * 2^26)
const log2_21 = Math.round (Math.log(2) * (1 << 21));  // multiplier of (1<<21) chosen to minimize rounding error
const fastLn_leftShift26 = (x) => {
    return Number ((BigInt(fastLg_leftShift26(x)) * BigInt(log2_21)) >> BigInt(21));
}
const fastLn_leftShift26_max = fastLn_leftShift26(0xffffffff) + 1;

// For an exponentially-distributed waiting time with expectation 1, use (fastLn_leftShift26_max - fastLn_leftShift26(rng.rnd32())) >> 26

export { fastLg_leftShift26, fastLg_leftShift26_max, fastLn_leftShift26, fastLn_leftShift26_max };
