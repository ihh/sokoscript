// SokoScript grammar syntax highlighter
// Uses the PEG parser to tokenize grammar text, then walks the AST
// to produce colored output. Falls back to plain text on parse failure.

import { parseOrUndefined } from './gramutil.js';

// Token types:
//   comment, type, address, state, operator, attribute,
//   reference, expression, punctuation, text

// ── AST-based colorizing serializer ──────────────────────────────────────────
// Mirrors the logic in serialize.js but produces {text, type} token arrays
// instead of plain strings.

const escape = (c, special) => {
  if (!special) special = ' !"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~';
  return (special.indexOf(c) >= 0 ? '\\' : '') + c;
};
const escapeAttr = (c) => escape(c, '\\}');

const tok = (text, type) => ({ text, type });

function stateCharTokens(t) {
  if (typeof t === 'string') return [tok(t, 'state')];
  switch (t.op) {
    case 'char': return [tok(escape(t.char), 'state')];
    case 'wild': return [tok('?', 'state')];
    case 'any':  return [tok('*', 'state')];
    case 'class':
      return [tok('[', 'punctuation'), ...t.chars.flatMap(vecExprTokens), tok(']', 'punctuation')];
    case 'negated':
      return [tok('[^', 'punctuation'), ...t.chars.flatMap(vecExprTokens), tok(']', 'punctuation')];
    case 'neighborhood':
      return [tok('@' + t.neighborhood + '(', 'expression'), ...vecExprTokens(t.origin), tok(')', 'expression')];
    case 'clock': case 'anti':
      return [tok('@' + t.op + '(', 'expression'), ...vecExprTokens(t.arg), tok(')', 'expression')];
    case 'add': case 'sub':
      return [tok('@' + t.op + '(', 'expression'), ...vecExprTokens(t.left), tok(',', 'punctuation'), ...vecExprTokens(t.right), tok(')', 'expression')];
    case '+': case '-': case '*':
    case 'location': case 'absdir': case 'reldir':
    case 'integer': case 'vector': case 'state': case 'tail':
      return vecExprTokens(t);
    default:
      return [tok(JSON.stringify(t), 'text')];
  }
}

function topStateCharTokens(t) {
  if (typeof t === 'string') return [tok(t, 'state')];
  switch (t.op) {
    case '+': case '-': case '*':
      return [tok('(', 'punctuation'), ...stateCharTokens(t), tok(')', 'punctuation')];
    default:
      return stateCharTokens(t);
  }
}

function vecExprTokens(t) {
  switch (t.op) {
    case '+': case '-':
      return [...vecExprTokens(t.left), tok(t.op, 'expression'), ...vecExprTokens(t.right)];
    case '*':
      return [...vecExprTokens(t.left), tok('*', 'expression'), ...mulVecExprTokens(t.right)];
    case 'location': return [tok('@' + t.group, 'expression')];
    case 'absdir': case 'reldir': return [tok('@' + t.dir, 'expression')];
    case 'integer': return [tok('@int(' + t.n + ')', 'expression')];
    case 'vector': return [tok('@vec(' + t.x + ',' + t.y + ')', 'expression')];
    case 'state':  return [tok('$' + (t.group || '') + '#' + t.char, 'reference')];
    case 'tail':   return [tok('$' + (t.group || '') + '#*', 'reference')];
    case 'matrix': return [tok('%' + t.matrix, 'expression')];
    default: return stateCharTokens(t);
  }
}

function mulVecExprTokens(t) {
  if (t.op === '+' || t.op === '-')
    return [tok('(', 'punctuation'), ...vecExprTokens(t), tok(')', 'punctuation')];
  return vecExprTokens(t);
}

function stateSuffixTokens(t) {
  if (!t.state) return [];
  return [tok('/', 'punctuation'), ...t.state.flatMap(topStateCharTokens)];
}

function lhsTermTokens(t) {
  switch (t.op) {
    case 'any': return [tok('*', 'type')];
    case 'negterm': return [tok('^', 'punctuation'), ...lhsTermTokens(t.term)];
    case 'alt':
      const parts = [];
      parts.push(tok('(', 'punctuation'));
      t.alt.forEach((a, i) => {
        if (i > 0) parts.push(tok('|', 'punctuation'));
        parts.push(...lhsTermTokens(a));
      });
      parts.push(tok(')', 'punctuation'));
      return parts;
    default:
      return [tok(t.type || '_', 'type'), ...stateSuffixTokens(t)];
  }
}

function addrTokens(t) {
  switch (t.op) {
    case 'absdir': case 'reldir':
      return [tok('>' + t.dir.toUpperCase() + '>', 'address')];
    case 'cell':
      return [tok('>', 'address'), ...vecExprTokens(t.arg), tok('>', 'address')];
    case 'neighbor':
      return [tok('>+', 'address'), ...vecExprTokens(t.arg), tok('>', 'address')];
    default:
      return [tok(JSON.stringify(t), 'text')];
  }
}

function lhsTokens(lhs) {
  const tokens = [...lhsTermTokens(lhs[0])];
  for (let i = 1; i < lhs.length; i++) {
    tokens.push(tok(' ', 'text'));
    if (lhs[i].addr) {
      tokens.push(...addrTokens(lhs[i].addr));
      tokens.push(tok(' ', 'text'));
    }
    tokens.push(...lhsTermTokens(lhs[i]));
  }
  return tokens;
}

function rhsTermTokens(t) {
  const idToks = 'id' in t ? [tok('~' + t.id, 'reference')] : [];
  if (t.op === 'group')
    return [tok('$' + t.group, 'reference'), ...idToks];
  if (t.op === 'prefix')
    return [tok('$' + t.group, 'reference'), ...stateSuffixTokens(t), ...idToks];
  return [tok(t.type || '_', 'type'), ...stateSuffixTokens(t), ...idToks];
}

function rhsTokens(rhs) {
  const tokens = [];
  rhs.forEach((t, i) => {
    if (i > 0) tokens.push(tok(' ', 'text'));
    tokens.push(...rhsTermTokens(t));
  });
  return tokens;
}

function fixedPoint6(rate) {
  let s = Math.floor(rate / 1000000), f = Math.floor(rate % 1000000);
  if (f) {
    f = f.toString();
    while (f.length < 6) f = '0' + f;
    s = (s + '.' + f).replace(/0+$/g, '');
  }
  return '' + s;
}

function attrTokens(rule) {
  const tokens = [];
  const add = (text) => tokens.push(tok(text, 'attribute'));
  if (rule.rate) add(' rate=' + fixedPoint6(rule.rate));
  if (rule.sync) add(' sync=' + fixedPoint6(rule.sync));
  if (rule.command) add(' command={' + escapeAttr(rule.command) + '}');
  if (rule.key) add(' key={' + escapeAttr(rule.key) + '}');
  if (rule.score) add(' score=' + rule.score);
  if (rule.sound) add(' sound={' + escapeAttr(rule.sound) + '}');
  if (rule.caption) add(' caption={' + escapeAttr(rule.caption) + '}');
  return tokens;
}

function ruleTokens(rule) {
  switch (rule.type) {
    case 'transform': {
      const tokens = [...lhsTokens(rule.lhs)];
      tokens.push(tok(' ', 'text'), tok(':', 'operator'), tok(' ', 'text'));
      tokens.push(...rhsTokens(rule.rhs));
      const attrs = attrTokens(rule);
      if (attrs.length > 0) {
        tokens.push(tok(',', 'punctuation'));
        tokens.push(...attrs);
      }
      tokens.push(tok('.', 'operator'));
      return tokens;
    }
    case 'inherit':
      return [
        tok(rule.child, 'type'), tok(' ', 'text'),
        tok('=', 'operator'), tok(' ', 'text'),
        ...rule.parents.flatMap((p, i) =>
          i > 0 ? [tok(',', 'punctuation'), tok(' ', 'text'), tok(p, 'type')] : [tok(p, 'type')]),
        tok('.', 'operator')
      ];
    case 'comment':
      return [tok('//' + rule.comment, 'comment')];
    default:
      return [tok(JSON.stringify(rule), 'text')];
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Tokenize grammar text into array of {text, type} tokens.
 * Uses the PEG parser for accurate syntax-aware highlighting.
 * Falls back to plain text for unparseable input.
 */
export function highlightTokens(text) {
  // Try parsing the full grammar
  const ast = parseOrUndefined(text, { error: false });
  if (ast) {
    // Successfully parsed — produce tokens from AST
    const tokens = [];
    ast.forEach((rule, i) => {
      if (i > 0) tokens.push(tok('\n', 'text'));
      tokens.push(...ruleTokens(rule));
    });
    return tokens;
  }

  // Parse failed — try line by line. For each line, attempt to parse it
  // as a standalone rule. On failure, output as plain text.
  const lines = text.split('\n');
  const tokens = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tokens.push(tok('\n', 'text'));
    const line = lines[i];
    const trimmed = line.trimStart();

    // Comment lines
    if (trimmed.startsWith('//')) {
      tokens.push(tok(line, 'comment'));
      continue;
    }

    // Blank lines
    if (trimmed.length === 0) {
      if (line.length > 0) tokens.push(tok(line, 'text'));
      continue;
    }

    // Try parsing this line as a standalone rule
    const lineAst = parseOrUndefined(trimmed, { error: false });
    if (lineAst && lineAst.length > 0) {
      // Preserve leading whitespace
      const indent = line.substring(0, line.length - line.trimStart().length);
      if (indent) tokens.push(tok(indent, 'text'));
      lineAst.forEach((rule, j) => {
        if (j > 0) tokens.push(tok('\n', 'text'));
        tokens.push(...ruleTokens(rule));
      });
    } else {
      // Can't parse — output as plain text
      tokens.push(tok(line, 'text'));
    }
  }
  return tokens;
}

// ANSI color scheme
const ANSI_COLORS = {
  comment:     (fgRGB) => fgRGB(120, 120, 120),
  type:        (fgRGB) => fgRGB(100, 180, 255),
  address:     (fgRGB) => fgRGB(230, 200, 60),
  state:       (fgRGB) => fgRGB(80, 200, 120),
  operator:    (fgRGB) => fgRGB(255, 255, 255),
  attribute:   (fgRGB) => fgRGB(220, 130, 220),
  reference:   (fgRGB) => fgRGB(230, 160, 60),
  expression:  (fgRGB) => fgRGB(80, 200, 200),
  punctuation: (fgRGB) => fgRGB(140, 140, 160),
  text:        () => '',
};

/**
 * Render grammar text with ANSI escape codes for terminal display.
 */
export function highlightAnsi(text, fgRGB, reset, boldEsc) {
  const tokens = highlightTokens(text);
  let result = '';
  for (const token of tokens) {
    const colorFn = ANSI_COLORS[token.type];
    const color = colorFn ? colorFn(fgRGB) : '';
    if (color) {
      const extra = (token.type === 'operator' && boldEsc) ? boldEsc : '';
      result += extra + color + token.text + reset;
    } else {
      result += token.text;
    }
  }
  return result;
}

// CSS class names for React/HTML rendering
export const TOKEN_CSS_CLASSES = {
  comment:     'sok-comment',
  type:        'sok-type',
  address:     'sok-address',
  state:       'sok-state',
  operator:    'sok-operator',
  attribute:   'sok-attribute',
  reference:   'sok-reference',
  expression:  'sok-expression',
  punctuation: 'sok-punctuation',
  text:        'sok-text',
};
