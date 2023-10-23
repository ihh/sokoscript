// Input: 32-bit unsigned integer
// Output: fast piecewise linear approximation to (log2(x) * 2^26)
const fastLog2 = (x) => {
    x = x & 0xffffffff;
    const lg = fastLog2Floor(x);
    return (lg << 26) | ((x & 0x7fffffff) >> (37 - lg));
}

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

export { fastLog2 };
