import { lookups } from './lookups';

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

        for (let n = 0; n < t.state.length; ++n) {
          const matchStatus = this.matchStateChar (t.state[n], state.charAt(n));
          if (!matchStatus)
            return false;
          if (matchStatus < 0)
            return true;
        }
        return t.state.length === state.length;
    }

    // return true to match char, -1 to match all remaining state chars
    matchStateChar (s, c) {
      if (typeof(s) === 'string')
        return s === c;
      switch (s.op) {
      case 'char':
        return s.char === c;
      case 'wild':
        return typeof(c) !== 'undefined';
      case 'any':
        return -1;  // match all remaining state chars
      case 'class':
        return s.chars.indexOf(c) >= 0;
      case 'negated':
        return s.chars.indexOf(c) < 0;
      default:
        return this.computeStateChar (s) === c;
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
        case 'neighbor':
            return lookups.charVecLookup[lookups.vecAdd[this.computeStateChar(t.arg)][lookups.vec2char(baseVec)]];
        case 'cell':
            return lookups.charVecLookup[this.computeStateChar(t.arg)];
        default:
          throw new Error ("Unrecognized op '" + addr.op + "' in " + JSON.stringify(addr));
      }
    }

    matchLhsCell (term, pos) {
        if (!this.failed) {
            let x, y;
            if (pos === 0)
                x = y = 0;
            else
                [x,y] = this.computeAddr (term.dir || { op: 'relative', dir: 'F' }, this.termAddr[pos-1], pos);
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
            const { type, state, meta } = this.termCell[t.group-1];
            this.termCell[t.group-1] = { type, state };  // at most one cell can inherit metadata
            return { type, state, meta }
        }
        if (t.op === 'prefix') {
            const { type, state, meta } = this.termCell[t.group-1];
            this.termCell[t.group-1] = { type, state };  // at most one cell can inherit metadata
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

const applyTransformRule = (board, x, y, dir, rule) => {
    const matcher = rule.lhs.reduce ((matcher, term, pos) => matcher.matchLhsCell(term,pos), new Matcher (board, x, y, dir) );
    if (!matcher.failed)
        rule.rhs.forEach ((term, pos) => matcher.updateCell (pos, term));
    return !matcher.failed;
}

export { applyTransformRule };
