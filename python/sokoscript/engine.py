"""Pattern matching engine and rule application.

Port of src/engine.js: Matcher class, applyTransformRule, transformRuleUpdate.
"""

from . import lookups


class Matcher:
    def __init__(self, board, x, y, direction):
        self.board = board
        self.x = x
        self.y = y
        self.dir = lookups.char_lookup['absDir'][direction]
        self.term_addr = []
        self.term_cell = []
        self.term_tail_start = []
        self.failed = False

    def match_lhs_term(self, t, cell_type, state):
        op = t.get('op')
        if op == 'any':
            return True
        if op == 'negterm':
            return not self.match_lhs_term(t['term'], cell_type, state)
        if op == 'alt':
            return any(self.match_lhs_term(term, cell_type, state) for term in t['alt'])
        if t.get('type') != cell_type:
            return False
        if 'state' not in t:
            return len(state) == 0
        for n, s in enumerate(t['state']):
            c = state[n] if n < len(state) else None
            match_status = self.match_state_char(s, c)
            if not match_status:
                return False
            if match_status < 0:
                return True
        return len(t['state']) == len(state)

    def match_state_char(self, s, c):
        if isinstance(s, str):
            return 1 if s == c else 0
        op = s.get('op')
        if op == 'char':
            return 1 if s['char'] == c else 0
        if op == 'wild':
            return 1 if c is not None else 0
        if op == 'any':
            return -1  # match all remaining
        if op == 'class':
            return 1 if c is not None and c in self._expand_char_class(s['chars']) else 0
        if op == 'negated':
            return 1 if c is not None and c not in self._expand_char_class(s['chars']) else 0
        return 1 if self.compute_state_char(s) == c else 0

    @staticmethod
    def _expand_char_class(chars):
        result = []
        for ch in chars:
            if isinstance(ch, str):
                result.append(ch)
            elif isinstance(ch, dict) and ch.get('op') == 'char':
                result.append(ch['char'])
            else:
                result.append(ch)
        return result

    def compute_state_char(self, t):
        if isinstance(t, str):
            return t
        op = t.get('op')
        if op == 'char':
            return t['char']
        if op in ('clock', 'anti'):
            return lookups.char_perm_lookup['rotate'][op][self.compute_state_char(t['arg'])]
        if op == 'add':
            return lookups.char_perm_lookup['intAdd'][self.compute_state_char(t['right'])][self.compute_state_char(t['left'])]
        if op == 'sub':
            return lookups.char_perm_lookup['intSub'][self.compute_state_char(t['right'])][self.compute_state_char(t['left'])]
        if op == '+':
            return lookups.char_perm_lookup['vecAdd'][self.compute_state_char(t['right'])][self.compute_state_char(t['left'])]
        if op == '-':
            return lookups.char_perm_lookup['vecSub'][self.compute_state_char(t['right'])][self.compute_state_char(t['left'])]
        if op == '*':
            return lookups.char_perm_lookup['matMul'][t['left']['matrix']][self.compute_state_char(t['right'])]
        if op == 'location':
            return lookups.vec2char(self.term_addr[t['group'] - 1])
        if op == 'reldir':
            return self.get_relative_dir(t['dir'])
        if op == 'absdir':
            return lookups.char_lookup['absDir'][t['dir']]
        if op == 'integer':
            return lookups.int2char(t['n'])
        if op == 'vector':
            return lookups.vec2char((t['x'], t['y']))
        if op == 'state':
            state = self.term_cell[t['group'] - 1]['state']
            idx = t['char'] - 1
            return state[idx] if idx < len(state) else None
        if op == 'tail':
            cell = self.term_cell[t['group'] - 1]
            start = self.term_tail_start[t['group'] - 1]
            return cell['state'][start:]
        raise ValueError(f"Unrecognized op '{op}' in {t}")

    def get_relative_dir(self, direction):
        return lookups.char_perm_lookup['matMul'][direction][self.dir]

    def compute_addr(self, addr, base_vec):
        op = addr['op']
        base_char = lookups.vec2char(base_vec)
        if op == 'absdir':
            return lookups.char_vec_lookup[lookups.char_perm_lookup['vecAdd'][lookups.char_lookup['absDir'][addr['dir']]][base_char]]
        if op == 'reldir':
            return lookups.char_vec_lookup[lookups.char_perm_lookup['vecAdd'][self.get_relative_dir(addr['dir'])][base_char]]
        if op == 'neighbor':
            return lookups.char_vec_lookup[lookups.char_perm_lookup['vecAdd'][self.compute_state_char(addr['arg'])][base_char]]
        if op == 'cell':
            return lookups.char_vec_lookup[self.compute_state_char(addr['arg'])]
        raise ValueError(f"Unrecognized op '{op}' in {addr}")

    def match_lhs_cell(self, term, pos):
        if self.failed:
            return self
        if pos == 0:
            xy = (0, 0)
        else:
            addr = term.get('addr', {'op': 'reldir', 'dir': 'F'})
            xy = self.compute_addr(addr, self.term_addr[pos - 1])

        self.term_addr.append(xy)
        cell = self.board.get_cell(xy[0] + self.x, xy[1] + self.y)
        cell_type = cell['type']
        state = cell['state']
        match = self.match_lhs_term(term, cell_type, state)
        if match:
            self.term_cell.append(cell)
            state_list = term.get('state', [])
            if state_list and isinstance(state_list[-1], dict) and state_list[-1].get('op') == 'any':
                self.term_tail_start.append(len(state_list) - 1)
            else:
                self.term_tail_start.append(len(state))
        else:
            self.failed = True
        return self

    def get_lhs_pos_for_rhs_term(self, t):
        if 'id' in t:
            return t['id']
        if t.get('op') in ('group', 'prefix'):
            return t.get('group')
        return None

    def get_meta_for_rhs_term(self, t, score):
        g = self.get_lhs_pos_for_rhs_term(t)
        if g:
            meta = self.term_cell[g - 1].get('meta')
            if meta or score:
                result = dict(meta) if meta else {}
                if g == 1 and score:
                    result['score'] = result.get('score', 0) + score
                return result if result else None
        return None

    def new_cell(self, t, score):
        meta = self.get_meta_for_rhs_term(t, score)
        op = t.get('op')
        if op == 'group':
            cell = self.term_cell[t['group'] - 1]
            result = {'type': cell['type'], 'state': cell['state']}
            if meta:
                result['meta'] = meta
            return result
        if op == 'prefix':
            cell = self.term_cell[t['group'] - 1]
            state = ''.join(self.compute_state_char(s) for s in t.get('state', []))
            result = {'type': cell['type'], 'state': state}
            if meta:
                result['meta'] = meta
            return result
        state = ''.join(self.compute_state_char(s) for s in t.get('state', []))
        result = {'type': t['type'], 'state': state}
        if meta:
            result['meta'] = meta
        return result

    def new_cell_update(self, term, pos, score):
        a = self.term_addr[pos]
        return (a[0] + self.x, a[1] + self.y, self.new_cell(term, score))


def _strip_duplicate_metadata(matcher, dom_cell, sub_cell, dom_term, sub_term):
    if matcher.get_lhs_pos_for_rhs_term(dom_term) == matcher.get_lhs_pos_for_rhs_term(sub_term):
        sub_cell.pop('meta', None)
    if (sub_cell.get('meta', {}).get('id') and
            dom_cell.get('meta', {}).get('id') == sub_cell['meta']['id']):
        del sub_cell['meta']['id']
    if 'meta' in sub_cell and not sub_cell['meta']:
        del sub_cell['meta']


def match_lhs(board, x, y, direction, rule):
    matcher = Matcher(board, x, y, direction)
    for pos, term in enumerate(rule['lhs']):
        matcher.match_lhs_cell(term, pos)
    return matcher


def transform_rule_update(board, x, y, direction, rule):
    matcher = match_lhs(board, x, y, direction, rule)
    if matcher.failed:
        return None
    score = rule.get('score')
    update = [matcher.new_cell_update(term, pos, score) for pos, term in enumerate(rule['rhs'])]
    for i in range(len(update) - 1):
        for j in range(i + 1, len(update)):
            _strip_duplicate_metadata(matcher, update[i][2], update[j][2], rule['rhs'][i], rule['rhs'][j])
    return update


def apply_transform_rule(board, x, y, direction, rule):
    updates = transform_rule_update(board, x, y, direction, rule)
    if updates:
        for ux, uy, cell in updates:
            board.set_cell(ux, uy, cell)
        return True
    return False
