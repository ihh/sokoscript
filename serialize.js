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
  case '+':
  case '-':
  case '*':
  case 'location':
  case 'dir':
  case 'constant':
  case 'state':
    return vecExpr(t) + ';';
  default:
    throw new Error ("Unrecognized op " + t.op + " in " + JSON.stringify(t));
    return '';
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
  case 'constant':
    return '@(' + t.x + ',' + t.y + ')';
  case 'state':
    return '$' + t.group + '/' + t['char'];
  case 'matrix':
    return '%' + t.matrix;
  default:
    throw new Error ("Unrecognized op " + t.op + " in " + JSON.stringify(t));
    return '';
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
  if (t.op === 'any')
    return '*';
  return termWithState(t);
}

const addrExpr = (t) => {
  return '>' + (t.op === 'dir' ? t.dir.toUpperCase() : vecExpr(t)) + '>';
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
