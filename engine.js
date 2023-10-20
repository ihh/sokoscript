const lookups = require('./lookups');

function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

class Matcher {
    constructor (board, x, y, dir) {
        this.board = board;
        this.x = x;
        this.y = y;
        this.dir = lookups.charVecLookup.absDir[dir];
        this.termAddr = [];
        this.termCell = [];
        this.failed = false;
    }

    getCell (x, y) { return board.getCell (x + this.x, y + this.y); }
    setCell (pos, val) {
        const [x,y] = this.termAddr[pos];
        return board.setCell (x + this.x, y + this.y, val);
    }

    matchLhsTerm (t, type, state) {
        if (t.op === 'negterm')
            return !this.matchLhsTerm (t.term, type, state);
        if (t.op === 'alt')
            return t.alt.reduce ((matched, term) => matched || this.matchLhsTerm (term, type, state), false);
        if (t.type !== type)
            return false;

        const reStr = '^' + (term.state ? term.state.map(this.stateCharToRegex.bind(this)).join('') : '.*') + '$';
        const re = new RegExp (reStr);
        return re.test (state);
    }

    stateCharToRegex (t) {
      if (typeof(t) === 'string')
        return escapeRegex(t);
      switch (t.op) {
      case 'char':
        return escapeRegex(t.char);
      case 'wild':
        return '.';
      case 'any':
        return '.*';
      case 'class':
        return '[' + escapeRegex(t.chars.map(this.computeStateChar.bind(this)).join('')) + ']';
      case 'negated':
        return '[^' + escapeRegex(t.chars.map(this.computeStateChar.bind(this)).join('')) + ']';
      default:
        return escapeRegex (this.computeStateChar (t));
      }
    }

    computeStateChar (t) {
      if (typeof(t) === 'string')
        return t;
      switch (t.op) {
      case 'char':
        return t;
      case 'clock':
      case 'anti':
        return lookups.rotate[t.op][this.computeStateChar(t.arg)];
      case 'add':
        return lookups.intAdd[this.computeStateChar(t.right)][this.computeStateChar(t.left)];
      case 'sub':
      case '+':
        return lookups.vecAdd[this.computeStateChar(t.right)][this.computeStateChar(t.left)];
      case '-':
        return lookups.vecSub[this.computeStateChar(t.right)][this.computeStateChar(t.left)];
      case '*':
      case '*':
        return lookups.matMul[t.left.matrix][this.computeStateChar(t.right)];
      case 'location':
        return lookups.vec2char (this.termAddr[t.group-1]);
      case 'reldir':
        return this.getRelativeDir (t.dir);
      case 'reldir':
        return lookups.charVecLookup (t.dir);
      case 'integer':
        return lookups.int2char (t.n);
      case 'vector':
        return lookups.vec2char (t.x, t.y);
      case 'state':
        return this.termCell[t.group-1].state.charAt(t.char-1);
      default:
        throw new Error ("Unrecognized op '" + t.op + "' in " + JSON.stringify(t));
        return undefined;
      }
    }

    getRelativeDir (dir) {
        return lookups.matMul[dir][this.dir];
    }

    computeAddr (addr, baseVec) {
      switch (addr.op) {
        case 'absolute':
            return lookups.charVecLookup[lookups.vecAdd[lookups.absDir[t.dir]][lookups.vec2char(baseVec)]];
        case 'relative':
            return lookups.charVecLookup[lookups.vecAdd[this.getRelativeDir(t.dir)][lookups.vec2char(baseVec)]];
        case 'cell':
            return lookups.charVecLookup[this.computeStateChar(t.arg)];
        default:
          throw new Error ("Unrecognized op '" + addr.op + "' in " + JSON.stringify(addr));
          return undefined;
      }
    }

    matchLhsCell (term, pos) {
        if (!this.failed) {
            let x, y;
            if (pos === 0)
                x = y = 0;
            else
                [x,y] = this.computeAddr (term.dir || { op: 'relative', dir: 'F' }, this.termAddr[pos-1]);
            this.termAddr.push ([x,y]);
            const cell = board.getCell (x + this.x, y + this.y);
            const { type, state } = cell;
            const match = matchLhsTerm (term, type, state);
            if (match)
                this.termCell.push (cell);
        } else
            this.failed = true;
        return this;
    }

    newCell (t) {
        if (t.op === 'group') {
            const cell = this.termCell[t.group-1];
            const { type, state, meta } = cell;
            delete cell.meta;  // at most one cell can inherit metadata
            return { type, state, meta }
        }
        if (t.op === 'prefix') {
            const cell = this.termCell[t.group-1];
            const { type, meta } = cell;
            delete cell.meta;  // at most one cell can inherit metadata
            return { type,
                     state: t.state.map(this.computeStateChar.bind(this)).join(''),
                     meta }
        }
        return { type: t.type,
                 state: t.state.map(this.computeStateChar.bind(this)).join('') }
    }
    
    updateCell (pos, term) {
        const newCell = this.newCell (term);
        this.setCell (pos, newCell);
    }
};

function applyTransformRule (board, x, y, dir, rule) {
    const matcher = rule.lhs.reduce ((matcher, term, pos) => matcher.matchLhsCell(term,pos), new Matcher (board, x, y, dir) );
    if (!matcher.failed)
        rule.rhs.forEach ((term, pos) => matcher.updateCell (pos, term));
    return !matcher.failed;
}


// TODO:
// Random waiting time until next event & selection of next event
// Ultimately these could be integer-robust for lightning-fast implementation, but that isn't important yet! Premature optimization!
