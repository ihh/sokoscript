const escape = (c, special) => {
  if (!special)
    special = ' !"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~';
  return (special.indexOf(c) >= 0 ? '\\' : '') + c;
}
const escapeAttr = (c) => escape (c, '\\}');

const topStateChar = (t) => {
  if (typeof(t) === 'string')
    return t;
  switch (t.op) {
  case '+':
  case '-':
  case '*':
    return '(' + makeStateChar(t) + ')';
  default:
    return makeStateChar(t);
  }
}

const makeStateChar = (t) => {
  if (typeof(t) === 'string')
    return t;
  switch (t.op) {
  case 'char':
    return escape(t.char);
  case 'wild':
    return '?';
  case 'any':
    return '*';
  case 'class':
    return '[' + t.chars.map(makeStateChar).join('') + ']';
  case 'negated':
    return '[^' + t.chars.map(makeStateChar).join('') + ']';
  case 'neighborhood':
    return '@' + t.neighborhood + '(' + vecExpr(t.origin) + ')';
  case 'clock':
  case 'anti':
      return '@' + t.op + '(' + vecExpr(t.arg) + ')';
  case 'add':
  case 'sub':
      return '@' + t.op + '(' + vecExpr(t.left) + ',' + vecExpr(t.right) + ')';
  case '+':
  case '-':
  case '*':
  case 'location':
  case 'absdir':
  case 'reldir':
  case 'integer':
  case 'vector':
  case 'state':
    return vecExpr(t);
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
  case 'absdir':
  case 'reldir':
      return '@' + t.dir;
  case 'integer':
    return '@int(' + t.n + ')';
  case 'vector':
    return '@vec(' + t.x + ',' + t.y + ')';
  case 'state':
    return '$' + t.group + '#' + t.char;
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

const stateSuffix = (t) => {
  return t.state ? ("/" + t.state.map(topStateChar).join('')) : '';
}

const termWithState = (t) => {
  return t.type + stateSuffix(t);
}

const lhsTerm = (t) => {
  switch (t.op) {
    case 'any':
      return '*';
    case 'negterm':
      return '^' + lhsTerm(t.term);
    case 'alt':
      return '(' + t.alt.map(lhsTerm).join('|') + ')';
    default:
      return termWithState(t);
    }
}

const addrExpr = (t) => {
  switch (t.op) {
    case 'absdir':
    case 'reldir':
        return '>' + t.dir.toUpperCase() + '>';
    case 'cell':
      return '>' + vecExpr(t.arg) + '>';
    default:
      throw new Error ("Unrecognized op '" + t.op + "' in " + JSON.stringify(t));
      return undefined;
    }
}

const makeLhs = (lhs) => {
  return lhs.slice(1).reduce ((list, curr) => {
    return list + ' ' + (curr.addr ? (addrExpr(curr.addr) + ' ') : '') + lhsTerm(curr);
  }, [lhsTerm(lhs[0])]);
}

const rhsTerm = (t) => {
  if (t.op === 'group')
    return '$' + t.group;
  if (t.op === 'prefix')
    return '$' + t.group + '/' + stateSuffix(t);
  return termWithState(t);
};

const makeRhs = (rhs, sep) => {
  return rhs.map(rhsTerm).join(sep);
};

function serialize (rules) {
  const attrs = (rule) =>
    (rule.rate ? (' rate={' + rule.rate + '}') : '')
    + (rule.command ? (' command={' + escapeAttr(rule.command) + '}') : '')
    + (rule.key ? (' key={' + escapeAttr(rule.key) + '}') : '')
    + (rule.reward ? (' reward={' + rule.reward + '}') : '')
    + (rule.sound ? (' sound={' + escapeAttr(rule.sound) + '}') : '')
    + (rule.caption ? (' caption={' + escapeAttr(rule.caption) + '}') : '');
  return rules.map ((rule) => {
    switch (rule.type) {
      case 'transform': {
        const a = attrs(rule);
        return makeLhs(rule.lhs) + ' : ' + makeRhs(rule.rhs,' ')
        + (a.length ? ("," + a) : "")
        + ".\n";
      }
      case 'inherit':
        return rule.child + ' = ' + rule.parents.join(', ') + ".\n";
      default:
        throw new Error ("Unrecognized rule type '" + rule.type + "' in " + JSON.stringify(rule));
        return undefined;
      }
  }).join("");
}

module.exports = { serialize }
