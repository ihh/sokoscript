def escape(c, special=None):
    if not special:
        special = ' !"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~'
    return ('\\' if c in special else '') + c

def escape_attr(c):
    return escape(c, '\\}')

def top_state_char(t):
    if isinstance(t, str):
        return t
    if t['op'] in ['+', '-', '*']:
        return '(' + make_state_char(t) + ')'
    return make_state_char(t)

def make_state_char(t):
    if isinstance(t, str):
        return t
    match t['op']:
        case 'char':
            return escape(t['char'])
        case 'wild':
            return '?'
        case 'any':
            return '*'
        case 'class':
            return '[' + ''.join(map(make_state_char, t['chars'])) + ']'
        case 'negated':
            return '[^' + ''.join(map(make_state_char, t['chars'])) + ']'
        case 'neighborhood':
            return '@' + t['neighborhood'] + '(' + vec_expr(t['origin']) + ')'
        case 'clock' | 'anti':
            return '@' + t['op'] + '(' + vec_expr(t['arg']) + ')'
        case 'add' | 'sub':
            return '@' + t['op'] + '(' + vec_expr(t['left']) + ',' + vec_expr(t['right']) + ')'
        case _:
            return vec_expr(t)

def vec_expr(t):
    match t['op']:
        case '+' | '-':
            return vec_expr(t['left']) + t['op'] + vec_expr(t['right'])
        case '*':
            return vec_expr(t['left']) + t['op'] + multiplicative_vec_expr(t['right'])
        case 'location':
            return '@' + t['group']
        case 'absdir' | 'reldir':
            return '@' + t['dir']
        case 'integer':
            return '@int(' + str(t['n']) + ')'
        case 'vector':
            return '@vec(' + str(t['x']) + ',' + str(t['y']) + ')'
        case 'state':
            return '$' + (t['group'] or '') + '#' + t['char']
        case 'tail':
            return '$' + (t['group'] or '') + '#*'
        case 'matrix':
            return '%' + t['matrix']
        case _:
            raise ValueError(f"Unrecognized op '{t['op']}' in {t}")

def multiplicative_vec_expr(t):
    s = vec_expr(t)
    return '(' + s + ')' if t['op'] in ['+', '-'] else s

def state_suffix(t):
    return "/" + ''.join(map(top_state_char, t['state'])) if t.get('state') else ''

def term_with_state(t):
    return ('t' if isinstance(t['type'], int) else '') + str(t['type']) + state_suffix(t)

def lhs_term(t):
    match t['op']:
        case 'any':
            return '*'
        case 'negterm':
            return '^' + lhs_term(t['term'])
        case 'alt':
            return '(' + '|'.join(map(lhs_term, t['alt'])) + ')'
        case _:
            return term_with_state(t)

def addr_expr(t):
    match t['op']:
        case 'absdir' | 'reldir':
            return '>' + t['dir'].upper() + '>'
        case 'cell':
            return '>' + vec_expr(t['arg']) + '>'
        case 'neighbor':
            return '>+' + vec_expr(t['arg']) + '>'
        case _:
            raise ValueError(f"Unrecognized op '{t['op']}' in {t}")

def make_lhs(lhs):
    return ' '.join([lhs_term(lhs[0])] + [(addr_expr(curr['addr']) + ' ' if curr.get('addr') else '') + lhs_term(curr) for curr in lhs[1:]])

def rhs_term(t):
    if t['op'] == 'group':
        return '$' + t['group']
    if t['op'] == 'prefix':
        return '$' + t['group'] + '/' + state_suffix(t)
    return term_with_state(t)

def make_rhs(rhs, sep):
    return sep.join(map(rhs_term, rhs))

def fixed_point6(rate):
    s, f = divmod(rate, 1000000)
    f_str = f"{f:06d}".rstrip('0') or '0'
    return f"{s}.{f_str}" if f else str(s)

def serialize(rules):
    def attrs(rule):
        return ''.join([
            f" rate={fixed_point6(rule['rate'])}" if 'rate' in rule else '',
            f" sync={fixed_point6(rule['sync'])}" if 'sync' in rule else '',
            f" command={{{escape_attr(rule['command'])}}}" if 'command' in rule else '',
            f" key={{{escape_attr(rule['key'])}}}" if 'key' in rule else '',
            f" reward={rule['reward']}" if 'reward' in rule else '',
            f" sound={{{escape_attr(rule['sound'])}}}" if 'sound' in rule else '',
            f" caption={{{escape_attr(rule['caption'])}}}" if 'caption' in rule else '',
        ])
    return ''.join([
        f"{make_lhs(rule['lhs'])} : {make_rhs(rule['rhs'], ' ')},{attrs(rule)}.\n" if rule['type'] == 'transform' else
        f"{rule['child']} = {', '.join(rule['parents'])}.\n" if rule['type'] == 'inherit' else
        f"//{rule['comment']}\n" if rule['type'] == 'comment' else
        raise ValueError(f"Unrecognized rule type '{rule['type']}' in {rule}")
        for rule in rules
    ])


