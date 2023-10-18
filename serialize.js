const escape = (c, special) => {
  if (!special)
    special = ' !"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~';
  return (special.indexOf(c) >= 0 ? '\\' : '') + c;
}
const lhsStateChar = (t) => {
  switch (t.op) {
  case 'char':
    return escape(t['char']);
  case 'wild':
    return '?';
  case 'class':
    return '[' + t.chars.map(lhsStateChar).join('') + ']';
  case 'negated':
    return '[^' + t.chars.map(lhsStateChar).join('') + ']';
  case 'neighborhood':
    return '@' + t.neighborhood + '(' + vecExpr(t.origin) + ')';
  case 'clock':
  case 'anti':
      return '@' + t.op + '(' + vecExpr(t.v) + ')';
  case 'add':
  case 'sub':
            return '@' + t.op + '(' + vecExpr(t.x) + ',' + vecExpr(t.y) + ')';
        case '+':
  case '-':
  case '*':
  case 'location':
  case 'dir':
  case 'integer':
  case 'vector':
  case 'state':
    return vecExpr(t) + ';';
  default:
    throw new Error ("Unrecognized op '" + t.op + "' in " + JSON.stringify(t));
    return undefined;
  }
}
const vecExpr = (t) => {
  switch (t.op) {
  case '+':
  case '-':
    return vecExpr(t.left) + t.op + vecExpr(t.right);
  case '*':
    return vecExpr(t.left) + t.op + multiplicativeVecExpr(t.right);
  case 'location':
    return '@' + t.group;
  case 'dir':
    return '@' + t.dir;
  case 'integer':
    return '@int(' + t.n + ')';
  case 'vector':
    return '@(' + t.x + ',' + t.y + ')';
  case 'state':
    return '$' + t.group + '/' + t['char'];
  case 'matrix':
    return '%' + t.matrix;
  default:
    throw new Error ("Unrecognized op '" + t.op + "' in " + JSON.stringify(t));
    return undefined;
  }
}
const multiplicativeVecExpr = (t) => {
  const s = vecExpr(t);
  return (t.op === '+' || t.op === '-') ? ('(' + s + ')') : s;
}

const termWithState = (t) => {
  return t.type + (t.state ? ("/" + t.state.map(lhsStateChar).join('')) : '');
}

const lhsTerm = (t) => {
  switch (t.op) {
    case 'any':
      return '*';
    case 'negterm':
      return '^' + lhsTerm(t.negate);
    case 'alt':
      return '(' + t.alt.map(lhsTerm).join('|') + ')';
    default:
      return termWithState(t);
    }
}

const addrExpr = (t) => {
  switch (t.op) {
    case 'neighbor':
      return '>' + t.dir.toUpperCase() + '>';
    case 'cell':
      return '>' + vecExpr(t.cell) + '>';
    default:
      throw new Error ("Unrecognized op '" + t.op + "' in " + JSON.stringify(t));
      return undefined;
    }
}

const makeLhs = (lhs) => {
  const defaultAddr = '>F>';
  return lhs.slice(1).reduce ((list, curr) => {
    return list + ' ' + (curr.addr ? (addrExpr(curr.addr) + ' ') : '') + lhsTerm(curr);
  }, [lhsTerm(lhs[0])]);
}

const rhsTerm = (t) => {
  if (t.op === 'group')
    return '$' + t.group;
  return termWithState(t);
};

const makeRhs = (rhs) => {
  return rhs.map(rhsTerm).join(' ');
};

function serialize (rules) {
  return rules.map ((rule) => {
    return makeLhs(rule.lhs) + ' : ' + makeRhs(rule.rhs)
      + (rule.rate ? (' (' + rule.rate + ')') : '')
      + (rule.command ? (' {' + escape(rule.command,'}') + '}') : '')
      + (rule.key ? (' \'' + escape(rule.key,'\'') + '\'') : '')
      + (rule.reward ? (' <' + rule.reward + '>') : '')
      + (rule.sound ? (' #' + escape(rule.sound,'#') + '#') : '')
      + (rule.caption ? (' "' + escape(rule.caption,'"') + '"') : '')
      + ".\n";
  }).join("");
}

module.exports = { serialize }
