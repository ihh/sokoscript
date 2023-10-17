const dirs = { N: [0,-1],
               E: [1,0],
               S: [0,1],
               W: [-1,0] };

const matrices = { F: [[1,0],[0,1]],
                   R: [[0,-1],[1,0]],
                   B: [[-1,0],[0,-1]],
                   L: [[0,1],[-1,0]],
                   N: [[1,0],[0,1]],
                   E: [[0,-1],[1,0]],
                   S: [[-1,0],[0,-1]],
                   W: [[0,1],[-1,0]],
                   H: [[-1,0],[0,1]],
                   V: [[1,0],[0,-1]] };

const addVecs = (u, v) => {
    return [u[0] + v[0], u[1] + v[1]]
}

const matMulVec = (m, v) => {
    return [m[0][0] * v[0] + m[0][1] * v[1],
            m[1][0] * v[0] + m[1][1] * v[1]];
}

const baseChar = 40;
const vec2char = (v) => {
    if (!(v[0] >= -4 && v[0] <= 4 && v[1] >= -4 && v[1] <= 4))
        return '~'
    return String.fromCharCode (baseChar + (v[0] + 4) + (v[1] + 4) * 9);
}
const char2vec = (c) => {
    const n = c.charCodeAt(0) - baseChar;
    if (n < 0 || n > 80)
        return [NaN, NaN];
    return [(n % 9) - 4, Math.floor(n/9) - 4]
}

function applyRule (board, x, y, dir, rule) {
    let match = rule.lhs.reduce ((match, term, n) => {
        if (!match.fail) {
            let xn, yn;
            if (n === 0) {
                xn = x;
                yn = y;
            } else {
                // TODO: WRITE ME
            }
        }
        return match;
    }, { cell: [], state: [], x, y });
}