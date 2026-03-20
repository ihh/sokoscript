"""Serialize parsed AST back to text format.

Port of src/serialize.js.
"""


def _escape(c, special=None):
    if special is None:
        special = ' !"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~'
    return ('\\' if c in special else '') + c


def _escape_attr(c):
    return _escape(c, '\\}')


def _top_state_char(t):
    if isinstance(t, str):
        return t
    op = t.get('op')
    if op in ('+', '-', '*'):
        return '(' + _make_state_char(t) + ')'
    return _make_state_char(t)


def _make_state_char(t):
    if isinstance(t, str):
        return t
    op = t.get('op')
    if op == 'char':
        return _escape(t['char'])
    if op == 'wild':
        return '?'
    if op == 'any':
        return '*'
    if op == 'class':
        return '[' + ''.join(_make_state_char(c) for c in t['chars']) + ']'
    if op == 'negated':
        return '[^' + ''.join(_make_state_char(c) for c in t['chars']) + ']'
    if op == 'neighborhood':
        return '@' + t['neighborhood'] + '(' + _vec_expr(t['origin']) + ')'
    if op in ('clock', 'anti'):
        return '@' + op + '(' + _vec_expr(t['arg']) + ')'
    if op in ('add', 'sub'):
        return '@' + op + '(' + _vec_expr(t['left']) + ',' + _vec_expr(t['right']) + ')'
    if op in ('+', '-', '*', 'location', 'absdir', 'reldir', 'integer', 'vector', 'state', 'tail'):
        return _vec_expr(t)
    raise ValueError(f"Unrecognized op '{op}' in {t}")


def _vec_expr(t):
    op = t.get('op')
    if op in ('+', '-'):
        return _vec_expr(t['left']) + op + _vec_expr(t['right'])
    if op == '*':
        return _vec_expr(t['left']) + op + _multiplicative_vec_expr(t['right'])
    if op == 'location':
        return '@' + str(t['group'])
    if op in ('absdir', 'reldir'):
        return '@' + t['dir']
    if op == 'integer':
        return '@int(' + str(t['n']) + ')'
    if op == 'vector':
        return '@vec(' + str(t['x']) + ',' + str(t['y']) + ')'
    if op == 'state':
        return '$' + (str(t['group']) if t.get('group') else '') + '#' + str(t['char'])
    if op == 'tail':
        return '$' + (str(t['group']) if t.get('group') else '') + '#*'
    if op == 'matrix':
        return '%' + t['matrix']
    raise ValueError(f"Unrecognized op '{op}' in {t}")


def _multiplicative_vec_expr(t):
    s = _vec_expr(t)
    if t.get('op') in ('+', '-'):
        return '(' + s + ')'
    return s


def _state_suffix(t):
    if 'state' in t:
        return '/' + ''.join(_top_state_char(c) for c in t['state'])
    return ''


def _term_with_state(t):
    type_val = t.get('type', '')
    prefix = 't' if isinstance(type_val, int) else ''
    return prefix + str(type_val) + _state_suffix(t)


def lhs_term(t):
    op = t.get('op')
    if op == 'any':
        return '*'
    if op == 'negterm':
        return '^' + lhs_term(t['term'])
    if op == 'alt':
        return '(' + '|'.join(lhs_term(a) for a in t['alt']) + ')'
    return _term_with_state(t)


def _addr_expr(t):
    op = t['op']
    if op in ('absdir', 'reldir'):
        return '>' + t['dir'].upper() + '>'
    if op == 'cell':
        return '>' + _vec_expr(t['arg']) + '>'
    if op == 'neighbor':
        return '>+' + _vec_expr(t['arg']) + '>'
    raise ValueError(f"Unrecognized op '{op}' in {t}")


def _make_lhs(lhs):
    result = lhs_term(lhs[0])
    for term in lhs[1:]:
        if 'addr' in term:
            result += ' ' + _addr_expr(term['addr']) + ' '
        else:
            result += ' '
        # Need to serialize the term without the addr key
        term_copy = {k: v for k, v in term.items() if k != 'addr'}
        result += lhs_term(term_copy)
    return result


def _rhs_term(t):
    id_str = '~' + str(t['id']) if 'id' in t else ''
    op = t.get('op')
    if op == 'group':
        return '$' + str(t['group']) + id_str
    if op == 'prefix':
        return '$' + str(t['group']) + _state_suffix(t) + id_str
    return _term_with_state(t) + id_str


def _make_rhs(rhs, sep=' '):
    return sep.join(_rhs_term(t) for t in rhs)


def _fixed_point_6(rate):
    s = rate // 1000000
    f = rate % 1000000
    if f:
        f_str = str(f).zfill(6).rstrip('0')
        return str(s) + '.' + f_str
    return str(s)


def serialize(rules):
    """Serialize a list of rules back to grammar text."""
    result = []
    for rule in rules:
        rule_type = rule['type']
        if rule_type == 'transform':
            a = ''
            if rule.get('rate'):
                a += ' rate=' + _fixed_point_6(rule['rate'])
            if rule.get('sync'):
                a += ' sync=' + _fixed_point_6(rule['sync'])
            if rule.get('command'):
                a += ' command={' + _escape_attr(rule['command']) + '}'
            if rule.get('key'):
                a += ' key={' + _escape_attr(rule['key']) + '}'
            if rule.get('score'):
                a += ' score=' + str(rule['score'])
            if rule.get('sound'):
                a += ' sound={' + _escape_attr(rule['sound']) + '}'
            if rule.get('caption'):
                a += ' caption={' + _escape_attr(rule['caption']) + '}'
            line = _make_lhs(rule['lhs']) + ' : ' + _make_rhs(rule['rhs'])
            if a:
                line += ',' + a
            result.append(line + '.\n')
        elif rule_type == 'inherit':
            result.append(rule['child'] + ' = ' + ', '.join(rule['parents']) + '.\n')
        elif rule_type == 'comment':
            result.append('//' + rule['comment'] + '\n')
        else:
            raise ValueError(f"Unrecognized rule type '{rule_type}'")
    return ''.join(result)


def serialize_rule_with_types(rule, types):
    def resolve(t):
        if t.get('op') == 'negterm':
            return {**t, 'term': resolve(t['term'])}
        if t.get('op') == 'alt':
            return {**t, 'alt': [resolve(a) for a in t['alt']]}
        if t.get('op') in ('group', 'prefix'):
            return t
        if isinstance(t.get('type'), int):
            return {**t, 'type': types[t['type']]}
        return t

    resolved = {
        **rule,
        'lhs': [resolve(t) for t in rule['lhs']],
        'rhs': [resolve(t) for t in rule['rhs']],
    }
    return serialize([resolved]).strip()
