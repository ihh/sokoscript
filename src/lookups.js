// precompute all rotations, additions, transformations, and permutations on char states

const dirVec = { N: [0,-1],
                 E: [1,0],
                 S: [0,1],
                 W: [-1,0] };

const dirs = ['N','E','S','W'];

const matrices = { F: [[1,0],[0,1]],
                   R: [[0,-1],[1,0]],
                   B: [[-1,0],[0,-1]],
                   L: [[0,1],[-1,0]],
                   H: [[-1,0],[0,1]],
                   V: [[1,0],[0,-1]] };

const neighborhood = { moore: [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],
                       neumann: [[0,-1],[-1,0],[0,0],[1,0],[0,1]] }

// vector algebra
const addVecs = (u, v) => {
    return [u[0] + v[0], u[1] + v[1]]
}

const matMulVec = (m, v) => {
    return [m[0][0] * v[0] + m[0][1] * v[1],
            m[1][0] * v[0] + m[1][1] * v[1]];
}

const minusVec = (v) => matMulVec (matrices.B, v);

// cyclic int char encoding
const firstChar = 33, lastChar = 126, nChars = lastChar + 1 - firstChar;
const allChars = new Array(nChars).fill(0).map((_,n)=>String.fromCharCode(n+firstChar));

const char2int = (c) => ((((c.charCodeAt(0) - firstChar) % nChars) + nChars) % nChars);
const int2char = (n) => String.fromCharCode (firstChar + (((n % nChars) + nChars) % nChars));
const cyclicAdd = (a, b) => (a + b) % nChars;
const minusInt = (x) => nChars - x;

// vector char encoding
const firstVecChar = 40;
const isNonVec = (v) => !(v[0] >= -4 && v[0] <= 4 && v[1] >= -4 && v[1] <= 4);
const isZeroVec = (v) => v[0] == 0 && v[1] == 0;
const vec2char = (v) => {
    if (isNonVec(v))
        return '~'
    return String.fromCharCode (firstVecChar + (v[0] + 4) + (v[1] + 4) * 9);
}
const char2vec = (c) => {
    const n = c.charCodeAt(0) - firstVecChar;
    if (n < 0 || n > 80)
        return [NaN, NaN];
    return [(n % 9) - 4, Math.floor(n/9) - 4]
}

// find inverse of char function
const invertCharFunc = (f) => {
    let inv = {};
    allChars.forEach ((c) => inv[f(c)] = c);
    return (c) => inv[c];
}

// radius-dependent neighborhood rotation (use e.g. to scan neighbors)
const rotateNeighborhoodClockwise = (c) => {
    const v = char2vec (c);
    if (isNonVec(v) || isZeroVec(v))
        return c;
    const x = v[0], y = v[1];
    const radius = Math.max (Math.abs(x), Math.abs(y));
    let newVec;
    if (x == -radius)
        newVec = y == -radius ? [x+1,y] : [x,y-1];
    else if (y == -radius)
        newVec = x == radius ? [x,y+1] : [x+1,y];
    else if (x == radius)
        newVec = y == radius ? [x-1,y] : [x,y+1];
    else // y == radius, x > -radius
        newVec = [x-1,y];
    return vec2char (newVec);
}

const rotateNeighborhoodCounterClockwise = invertCharFunc (rotateNeighborhoodClockwise);

// precompute permutations
const tabulateCharFunc = (f) => Object.assign(...allChars.map((c) => ({ [c]: f(c) })));
const tabulateVecFunc = (f) => tabulateCharFunc ((c) => vec2char(f(char2vec(c))));
const tabulateIntFunc = (f) => tabulateCharFunc ((c) => int2char(f(char2int(c))));

const tabulateMatMul = (m) => tabulateVecFunc (matMulVec.bind (null, m));
const tabulateVecAdd = (c) => tabulateVecFunc (addVecs.bind (null, char2vec(c)));
const tabulateVecSub = (c) => tabulateVecFunc (addVecs.bind (null, minusVec (char2vec(c))));
const tabulateIntAdd = (c) => tabulateIntFunc (cyclicAdd.bind (null, char2int(c)));
const tabulateIntSub = (c) => tabulateIntFunc (cyclicAdd.bind (null, minusInt (char2int(c))));

const tabulateOperators = (operators, tabulator) => Object.assign (...operators.map ((operator) => ({ [operator]: tabulator(operator) })));

const charPermLookup = {
    matMul: tabulateOperators (Object.keys(matrices), (k) => tabulateMatMul (matrices[k])),
    vecAdd: tabulateOperators (allChars, tabulateVecAdd),
    vecSub: tabulateOperators (allChars, tabulateVecSub),
    intAdd: tabulateOperators (allChars, tabulateIntAdd),
    intSub: tabulateOperators (allChars, tabulateIntSub),
    rotate: { clock: tabulateCharFunc (rotateNeighborhoodClockwise),
              anti: tabulateCharFunc (rotateNeighborhoodCounterClockwise) }
}

const charLookup = {
    absDir: Object.assign (...dirs.map ((d) => ({ [d]: vec2char (dirVec[d]) })))
};

// precompute char classes, e.g. neighborhoods of each cell
const computeCharNeighborhood = (nbrs, c) => nbrs
  .map ((nbr) => addVecs (nbr, char2vec(c)))
  .filter ((v) => !isNonVec(v))
  .map(vec2char).sort().join('');
const charClassLookup = tabulateOperators (Object.keys(neighborhood), (nh) => tabulateCharFunc (computeCharNeighborhood.bind (null, neighborhood[nh])));

// precompute char->vector mapping
const charVecLookup = tabulateCharFunc (char2vec);

// precompute char->degree rotation mapping
const charRotLookup = {
    [vec2char([0,-1])]: 0,
    [vec2char([1,-1])]: 45,
    [vec2char([1,0])]: 90,
    [vec2char([1,1])]: 135,
    [vec2char([0,1])]: 180,
    [vec2char([-1,1])]: 225,
    [vec2char([-1,0])]: 270,
    [vec2char([-1,-1])]: 315
};

export { charPermLookup, charLookup, charClassLookup, charVecLookup, vec2char, int2char, dirs, charRotLookup };
