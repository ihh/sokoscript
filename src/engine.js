import * as lookups from './lookups.js';
import { bigIntContainerToObject } from './gramutil.js';

class Matcher {
    constructor (board, x, y, dir) {
        this.board = board;
        this.x = x;
        this.y = y;
        this.dir = lookups.charLookup.absDir[dir];
        this.termAddr = [];
        this.termCell = [];
        this.termTailStart = [];
        this.failed = false;
    }

    getCell (x, y) { return board.getCell (x + this.x, y + this.y); }

    matchLhsTerm (t, type, state) {
        if (t.op === 'any')
            return true;
        if (t.op === 'negterm')
            return !this.matchLhsTerm (t.term, type, state);
        if (t.op === 'alt')
            return t.alt.reduce ((matched, term) => matched || this.matchLhsTerm (term, type, state), false);
        if (t.type !== type)
            return false;

        if (!t.state)
          return !state.length;

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
        return lookups.charPermLookup.rotate[t.op][this.computeStateChar(t.arg)];
      case 'add':
        return lookups.charPermLookup.intAdd[this.computeStateChar(t.right)][this.computeStateChar(t.left)];
      case 'sub':
      case '+':
        return lookups.charPermLookup.vecAdd[this.computeStateChar(t.right)][this.computeStateChar(t.left)];
      case '-':
        return lookups.charPermLookup.vecSub[this.computeStateChar(t.right)][this.computeStateChar(t.left)];
      case '*':
        return lookups.charPermLookup.matMul[t.left.matrix][this.computeStateChar(t.right)];
      case 'location':
        return lookups.vec2char (this.termAddr[t.group-1]);
      case 'reldir':
        return this.getRelativeDir (t.dir);
      case 'absdir':
        return lookups.charVecLookup[t.dir];
      case 'integer':
        return lookups.int2char (t.n);
      case 'vector':
        return lookups.vec2char (t.x, t.y);
      case 'state':
        return this.termCell[t.group-1].state.charAt(t.char-1);
      case 'tail':
        return this.termCell[t.group-1].state.substr(this.termTailStart[t.group-1]);
      default:
        throw new Error ("Unrecognized op '" + t.op + "' in " + JSON.stringify(t));
      }
    }

    getRelativeDir (dir) {
        return lookups.charPermLookup.matMul[dir][this.dir];
    }

    computeAddr (addr, baseVec) {
      switch (addr.op) {
        case 'absolute':
            return lookups.charVecLookup[lookups.charPermLookup.vecAdd[lookups.absDir[t.dir]][lookups.vec2char(baseVec)]];
        case 'relative':
            return lookups.charVecLookup[lookups.charPermLookup.vecAdd[this.getRelativeDir(addr.dir)][lookups.vec2char(baseVec)]];
        case 'neighbor':
            return lookups.charVecLookup[lookups.charPermLookup.vecAdd[this.computeStateChar(addr.arg)][lookups.vec2char(baseVec)]];
        case 'cell':
            return lookups.charVecLookup[this.computeStateChar(addr.arg)];
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
            const cell = this.board.getCell (x + this.x, y + this.y);
            const { type, state } = cell;
            const match = this.matchLhsTerm (term, type, state);
            if (match) {
                this.termCell.push (cell);
                this.termTailStart.push (term.state && term.state[term.state.length-1].op === 'any' ? term.state.length - 1 : state.length);
            } else
                this.failed = true;
        } else
            this.failed = true;
        return this;
    }

    getLhsPosForRhsTerm (t) {
      if (t.id)
        return t.id;
      if (t.op === 'group' || t.op === 'prefix')
        return t.group;
      return undefined;
    }

    getMetaForRhsTerm (t, score) {
      const g = this.getLhsPosForRhsTerm (t);
      if (g) {
        const meta = this.termCell[g-1].meta;
        if (meta || score)
          return { ...(meta||{}), ...(g===1 && score ? { score: (meta?.score || 0) + score } : {}) };
      }
      return undefined;
    }

    newCell (t, score) {
      const meta = this.getMetaForRhsTerm (t, score);
      if (t.op === 'group') {
            const { type, state } = this.termCell[t.group-1];
            return { type, state, meta }
        }
        if (t.op === 'prefix') {
            const { type } = this.termCell[t.group-1];
            const state = t.state ? t.state.map(this.computeStateChar.bind(this)).join('') : '';
            return { type, state, meta }
        }
        const { type } = t;
        const state = t.state ? t.state.map(this.computeStateChar.bind(this)).join('') : '';
        return { type: t.type, state, meta };
    }
    
    newCellUpdate (term, pos, score) {
      const a = this.termAddr[pos];
      return [a[0] + this.x, a[1] + this.y, this.newCell (term, score)];
    }
};

const applyTransformRule = (board, x, y, dir, rule) => {
  const updates = transformRuleUpdate (board, x, y, dir, rule);
  if (updates)
    updates.forEach ((update) => update && board.setCell (...update))
  return !!updates;
}

const stripDuplicateMetadata = (matcher, domCell, subCell, domTerm, subTerm) => {
  if (matcher.getLhsPosForRhsTerm(domTerm) === matcher.getLhsPosForRhsTerm(subTerm))
    delete subCell.meta;
  if (subCell?.meta?.id && domCell?.meta?.id === subCell?.meta?.id)
    delete subCell.meta['id'];
  if (subCell.meta && !Object.keys(subCell.meta).length)
    delete subCell.meta;
}

const matchLhs = (board, x, y, dir, rule) => rule.lhs.reduce ((matcher, term, pos) => matcher.matchLhsCell(term,pos), new Matcher (board, x, y, dir) );
const transformRuleUpdate = (board, x, y, dir, rule) => {
  const matcher = matchLhs (board, x, y, dir, rule);
  if (matcher.failed) return null;
  let update = rule.rhs.map ((term, pos) => matcher.newCellUpdate(term,pos,rule.score));
  for (let i = 0; i < update.length-1; ++i)
    for (let j = i + 1; j < update.length; ++j)
      stripDuplicateMetadata (matcher, update[i][2], update[j][2], rule.rhs[i], rule.rhs[j]);
  return update;
}

export { applyTransformRule, transformRuleUpdate, matchLhs };
