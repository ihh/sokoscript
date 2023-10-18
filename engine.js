const lookups = require('./lookups');

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