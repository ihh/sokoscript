"""Recursive descent parser for SokoScript grammar.

Port of src/grammar.pegjs. Produces identical AST structure to the JS parser.
"""


class SyntaxError(Exception):
    def __init__(self, message, line=None, column=None, offset=None):
        self.msg = message
        self.line = line
        self.column = column
        self.offset = offset
        loc = f"Line {line}, column {column}: " if line is not None else ""
        super().__init__(f"{loc}{message}")


class Parser:
    def __init__(self, text):
        self.text = text
        self.pos = 0
        self.len = len(text)

    # --- Utility ---

    def at_end(self):
        return self.pos >= self.len

    def peek(self, n=1):
        return self.text[self.pos:self.pos + n]

    def advance(self, n=1):
        self.pos += n

    def match_str(self, s):
        if self.text[self.pos:self.pos + len(s)] == s:
            self.pos += len(s)
            return True
        return False

    def match_char(self, charset):
        if self.pos < self.len and self.text[self.pos] in charset:
            c = self.text[self.pos]
            self.pos += 1
            return c
        return None

    def match_regex_char(self, pred):
        if self.pos < self.len and pred(self.text[self.pos]):
            c = self.text[self.pos]
            self.pos += 1
            return c
        return None

    def skip_whitespace(self):
        while self.pos < self.len and self.text[self.pos] in ' \t\n\r':
            self.pos += 1

    def require_whitespace(self):
        start = self.pos
        while self.pos < self.len and self.text[self.pos] in ' \t\n\r':
            self.pos += 1
        return self.pos > start

    def get_location(self):
        line = self.text[:self.pos].count('\n') + 1
        last_nl = self.text[:self.pos].rfind('\n')
        col = self.pos - last_nl
        return line, col

    def error(self, msg):
        line, col = self.get_location()
        raise SyntaxError(msg, line, col, self.pos)

    def expect(self, s, msg=None):
        if not self.match_str(s):
            self.error(msg or f"Expected '{s}'")

    # --- Helpers matching JS validation ---

    @staticmethod
    def _minus_vec(arg):
        return {'op': '-', 'left': {'op': 'vector', 'x': 0, 'y': 0}, 'right': arg}

    @staticmethod
    def _alt_list(alt):
        return alt['alt'] if alt.get('op') == 'alt' else [alt]

    @staticmethod
    def _matched_state_chars(alt):
        alts = Parser._alt_list(alt)
        if not alts:
            return 0
        return min(
            len([s for s in term.get('state', []) if not (isinstance(s, dict) and s.get('op') == 'any')])
            if 'state' in term else 0
            for term in alts
        )

    def _validate_positionals(self, expr, matched_state_chars, extra_loc=False):
        if expr.get('group') == 0:
            expr['group'] = len(matched_state_chars)
        if 'group' in expr:
            limit = len(matched_state_chars) + (1 if extra_loc and expr.get('op') == 'location' else 0)
            if expr['group'] > limit:
                return False
            if 'char' in expr and expr['char'] > matched_state_chars[expr['group'] - 1]:
                return False
        for prop in ('left', 'right', 'arg'):
            if prop in expr:
                if not self._validate_positionals(expr[prop], matched_state_chars, False):
                    return False
        return True

    def _validate_state(self, term, msc, extra_loc=False):
        if 'state' not in term:
            return True
        return all(self._validate_positionals(ch, msc, extra_loc) for ch in term['state'] if isinstance(ch, dict))

    def _validate_addr(self, term, msc):
        if 'addr' not in term:
            return True
        return self._validate_positionals(term['addr'], msc, False)

    def _reduce_alt(self, alt, pred):
        if alt.get('op') == 'negterm':
            return self._reduce_alt(alt['term'], pred)
        return all(pred(t) for t in self._alt_list(alt))

    def _validate_lhs(self, lhs):
        msc = []
        for term in lhs:
            if not self._reduce_alt(term, lambda t: self._validate_state(t, msc, True) and self._validate_addr(t, msc)):
                return False
            msc.append(self._matched_state_chars(term))
        return True

    def _validate_rhs(self, lhs, rhs):
        if len(rhs) > len(lhs):
            return False
        msc_list = [self._matched_state_chars(t) for t in lhs]
        for term in rhs:
            if not self._reduce_alt(term, lambda t: self._validate_state(t, msc_list, False)):
                return False
        return self._validate_ids(rhs, len(lhs))

    @staticmethod
    def _validate_ids(rhs, lhs_len):
        seen = {}
        for term in rhs:
            pos = None
            if 'id' in term:
                if term['id'] > lhs_len:
                    return False
                pos = term['id']
            elif term.get('op') in ('group', 'prefix'):
                if term.get('group', 0) > lhs_len:
                    return False
                if term['group'] not in seen:
                    pos = term['group']
            if pos is not None:
                if pos in seen:
                    return False
                seen[pos] = True
        return True

    def _validate_inheritance(self, rule, rules):
        if rule['type'] == 'transform':
            return True
        parents = {}
        for r in rules:
            if r.get('type') == 'inherit':
                parents.setdefault(r['child'], []).extend(r['parents'])
        checked = set()

        def is_valid_ancestor(p):
            if p in checked:
                return True
            checked.add(p)
            if p == rule['child']:
                self.error(f"Type '{rule['child']}' inherits from itself")
                return False
            return all(is_valid_ancestor(a) for a in parents.get(p, []))

        return all(is_valid_ancestor(p) for p in rule['parents'])

    @staticmethod
    def _count_duplicate_attributes(attrs):
        count = {}
        for attr in attrs:
            for k in attr:
                count[k] = count.get(k, 0) + 1
        duplicates = [k for k, v in count.items() if v > 1]
        return duplicates

    @staticmethod
    def _validate_attributes(attrs):
        merged = {}
        for a in attrs:
            merged.update(a)
        return not (merged.get('sync') and merged.get('rate'))

    # --- Grammar rules ---

    def parse(self):
        self.skip_whitespace()
        result = self.parse_rule_set()
        self.skip_whitespace()
        if not self.at_end():
            self.error("Unexpected input")
        return result

    def parse_rule_set(self):
        rules = []
        while not self.at_end():
            self.skip_whitespace()
            if self.at_end():
                break

            # Try comment
            saved = self.pos
            c = self.try_comment()
            if c is not None:
                rules.append(c)
                continue

            # Try rule
            self.pos = saved
            r = self.try_rule()
            if r is None:
                break
            rules.append(r)
            self.skip_whitespace()
            self.match_str('.')  # optional period

        # Validate inheritance for all rules (JS PEG validates top-down with full rule set)
        for r in rules:
            if r.get('type') == 'inherit':
                self._validate_inheritance(r, rules)
        return rules

    def try_comment(self):
        if self.match_str('//'):
            start = self.pos
            while self.pos < self.len and self.text[self.pos] != '\n':
                self.pos += 1
            return {'type': 'comment', 'comment': self.text[start:self.pos]}
        return None

    def try_rule(self):
        saved = self.pos
        # Try inheritance
        child = self.try_prefix()
        if child is not None:
            self.skip_whitespace()
            if self.match_str('='):
                self.skip_whitespace()
                parents = self.parse_inherit_rhs()
                return {'type': 'inherit', 'child': child, 'parents': parents}
            self.pos = saved

        # Try transform rule
        lhs = self.try_lhs()
        if lhs is None:
            return None
        if not self._validate_lhs(lhs):
            self.error("Invalid LHS")

        self.skip_whitespace()
        if not self.match_str(':'):
            self.error("Expected ':'")
        self.skip_whitespace()

        rhs = self.parse_rhs()
        if not self._validate_rhs(lhs, rhs):
            self.error("Invalid RHS")

        self.skip_whitespace()
        if self.match_str(','):
            self.skip_whitespace()
            attrs = self.parse_attributes()
            dupes = self._count_duplicate_attributes(attrs)
            if dupes:
                self.error(f"Duplicate attribute: {', '.join('\"' + d + '\"' for d in dupes)}")
            if not self._validate_attributes(attrs):
                self.error("sync and rate are mutually exclusive")
            merged = {}
            for a in attrs:
                merged.update(a)
            return {'type': 'transform', 'lhs': lhs, 'rhs': rhs, **merged}

        return {'type': 'transform', 'lhs': lhs, 'rhs': rhs}

    def parse_inherit_rhs(self):
        first = self.try_prefix()
        if first is None:
            self.error("Expected type name")
        parents = [first]
        while True:
            saved = self.pos
            self.skip_whitespace()
            if not self.match_str(','):
                self.pos = saved
                break
            self.skip_whitespace()
            p = self.try_prefix()
            if p is None:
                self.pos = saved
                break
            parents.append(p)
        return parents

    def try_lhs(self):
        subject = self.try_subject()
        if subject is None:
            return None
        terms = [subject]

        while True:
            saved = self.pos
            # Try address then term
            ws_start = self.pos
            has_ws = self.require_whitespace() or self.pos == ws_start
            addr = self.try_dir_or_nbr_addr()
            if addr is not None:
                self.skip_whitespace()
                term = self.try_wild_lhs_term()
                if term is not None:
                    term['addr'] = addr
                    terms.append(term)
                    continue
                self.pos = saved
                break

            # Try whitespace-separated term
            self.pos = ws_start
            if not self.require_whitespace():
                break
            term = self.try_wild_lhs_term()
            if term is not None:
                terms.append(term)
                continue
            self.pos = saved
            break

        return terms

    def try_subject(self):
        prefix = self.try_prefix()
        if prefix is None:
            return None
        if self.match_str('/'):
            state = self.parse_lhs_state_char_seq()
            return {'type': prefix, 'state': state}
        return {'type': prefix}

    def try_wild_lhs_term(self):
        if self.match_str('*'):
            return {'op': 'any'}
        return self.try_lhs_term()

    def try_lhs_term(self):
        if self.match_str('^'):
            term = self.try_alt_lhs_term()
            if term is None:
                self.error("Expected term after '^'")
            return {'op': 'negterm', 'term': term}
        return self.try_alt_lhs_term()

    def try_alt_lhs_term(self):
        if self.match_str('('):
            first = self.try_primary_lhs_term()
            if first is None:
                self.error("Expected term inside '('")
            alts = [first]
            while self.match_str('|'):
                t = self.try_primary_lhs_term()
                if t is None:
                    self.error("Expected term after '|'")
                alts.append(t)
            if not self.match_str(')'):
                self.error("Expected ')'")
            if len(alts) == 1:
                return alts[0]
            return {'op': 'alt', 'alt': alts}
        return self.try_primary_lhs_term()

    def try_primary_lhs_term(self):
        if self.match_str('_'):
            # Make sure it's not a prefix that starts with _
            if self.pos < self.len and self.text[self.pos] in 'abcdefghijklmnopqrstuvwxyz0123456789_':
                self.pos -= 1
                return None
            return {'type': '_'}

        prefix = self.try_prefix()
        if prefix is not None:
            if self.match_str('/'):
                state = self.parse_lhs_state_char_seq()
                return {'type': prefix, 'state': state}
            return {'type': prefix}
        return None

    def try_prefix(self):
        if self.pos >= self.len:
            return None
        c = self.text[self.pos]
        if not c.islower():
            return None
        start = self.pos
        self.pos += 1
        while self.pos < self.len and self.text[self.pos] in 'abcdefghijklmnopqrstuvwxyz0123456789_':
            self.pos += 1
        return self.text[start:self.pos]

    def parse_lhs_state_char_seq(self):
        if self.match_str('*'):
            return [{'op': 'any'}]
        chars = []
        while True:
            c = self.try_lhs_state_char()
            if c is None:
                break
            chars.append(c)
        if not chars:
            self.error("Expected state characters")
        return chars

    def try_lhs_state_char(self):
        # Wildcard
        if self.match_str('?'):
            return {'op': 'wild'}
        # Char class
        cc = self.try_char_class()
        if cc is not None:
            return cc
        # RHS state char (but not those starting with special chars that end state)
        return self.try_rhs_state_char()

    def try_char_class(self):
        if self.match_str('[^'):
            chars = self._parse_char_class_contents()
            self.expect(']')
            return {'op': 'negated', 'chars': chars}
        if self.match_str('['):
            chars = self._parse_char_class_contents()
            self.expect(']')
            return {'op': 'class', 'chars': chars}
        return None

    def _parse_char_class_contents(self):
        chars = []
        while True:
            # Try neighborhood
            nh = self.try_neighborhood()
            if nh is not None:
                chars.append(nh)
                continue
            # Try primary vec expr
            saved = self.pos
            ve = self.try_primary_vec_expr()
            if ve is not None:
                chars.append(ve)
                continue
            # Try state char (stored as raw string, not {op:'char'}, matching JS)
            sc = self.try_state_char()
            if sc is not None:
                chars.append(sc)
                continue
            break
        return chars

    def try_neighborhood(self):
        saved = self.pos
        if not self.match_str('@'):
            return None
        for nh in ('moore', 'neumann'):
            if self.match_str(nh):
                if self.match_str('('):
                    self.skip_whitespace()
                    origin = self.parse_additive_vec_expr()
                    self.skip_whitespace()
                    self.expect(')')
                    return {'op': 'neighborhood', 'neighborhood': nh, 'origin': origin}
                self.pos = saved
                return None
        self.pos = saved
        return None

    def try_state_char(self):
        if self.pos < self.len and self.text[self.pos] in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_':
            c = self.text[self.pos]
            self.pos += 1
            return c
        return None

    def try_dir_or_nbr_addr(self):
        if not self.match_str('>'):
            return None

        # Check for absolute direction
        abs_dirs = 'nsewNSEW'
        rel_dirs = 'fblrFBLR'

        if self.pos < self.len and self.text[self.pos] in abs_dirs:
            d = self.text[self.pos]
            self.pos += 1
            if self.match_str('>'):
                return {'op': 'absdir', 'dir': d.upper()}
            self.pos -= 2  # back before > and d
            return None

        if self.pos < self.len and self.text[self.pos] in rel_dirs:
            d = self.text[self.pos]
            self.pos += 1
            if self.match_str('>'):
                return {'op': 'reldir', 'dir': d.upper()}
            self.pos -= 2
            return None

        # Neighbor address forms
        self.pos -= 1  # put back the >
        return self.try_nbr_addr()

    def try_nbr_addr(self):
        saved = self.pos

        # >+expr>
        if self.match_str('>+'):
            arg = self.try_additive_vec_expr()
            if arg is not None and self.match_str('>'):
                return {'op': 'neighbor', 'arg': arg}
            self.pos = saved

        # >-expr>
        if self.match_str('>-'):
            # Try >-group#char>
            nzi = self.try_non_zero_integer()
            if nzi is not None:
                if self.match_str('#'):
                    char = self.try_non_zero_integer()
                    if char is not None and self.match_str('>'):
                        return {'op': 'neighbor', 'arg': self._minus_vec({'op': 'state', 'group': nzi, 'char': char})}
                    self.pos = saved
                elif self.match_str('>'):
                    return {'op': 'neighbor', 'arg': self._minus_vec({'op': 'state', 'group': 0, 'char': nzi})}
                self.pos = saved

            if self.match_str('>-'):
                pass
            else:
                self.pos = saved
                if not self.match_str('>-'):
                    # fall through to >expr>
                    pass

            if self.text[self.pos - 2:self.pos] == '>-':
                arg = self.try_additive_vec_expr()
                if arg is not None and self.match_str('>'):
                    return {'op': 'neighbor', 'arg': self._minus_vec(arg)}
                self.pos = saved

        # >group#char>
        if self.match_str('>'):
            nzi = self.try_non_zero_integer()
            if nzi is not None:
                if self.match_str('#'):
                    char = self.try_non_zero_integer()
                    if char is not None and self.match_str('>'):
                        return {'op': 'neighbor', 'arg': {'op': 'state', 'group': nzi, 'char': char}}
                    self.pos = saved
                    self.match_str('>')  # re-consume for fallback
                    nzi2 = self.try_non_zero_integer()  # re-try
                elif self.match_str('>'):
                    # >char> form
                    return {'op': 'neighbor', 'arg': {'op': 'state', 'group': 0, 'char': nzi}}
                self.pos = saved

        # >expr>
        if self.match_str('>'):
            arg = self.try_additive_vec_expr()
            if arg is not None and self.match_str('>'):
                return {'op': 'cell', 'arg': arg}
            self.pos = saved

        return None

    def try_additive_vec_expr(self):
        return self.parse_additive_vec_expr_opt()

    def parse_additive_vec_expr(self):
        result = self.parse_additive_vec_expr_opt()
        if result is None:
            self.error("Expected vector expression")
        return result

    def parse_additive_vec_expr_opt(self):
        left = self.try_multiplicative_vec_expr()
        if left is None:
            return None
        while True:
            saved = self.pos
            self.skip_whitespace()
            op = None
            if self.match_str('+'):
                op = '+'
            elif self.match_str('-'):
                op = '-'
            if op is None:
                self.pos = saved
                break
            self.skip_whitespace()
            right = self.try_multiplicative_vec_expr()
            if right is None:
                self.pos = saved
                break
            left = {'op': op, 'left': left, 'right': right}
        return left

    def try_multiplicative_vec_expr(self):
        matrices_list = []
        while True:
            saved = self.pos
            m = self.try_matrix_expr()
            if m is None:
                break
            matrices_list.append(m)
            self.skip_whitespace()
            self.match_str('*')  # optional *
            self.skip_whitespace()

        primary = self.try_primary_vec_expr()
        if primary is None:
            if matrices_list:
                self.error("Expected operand after matrix")
            return None

        # Build right-to-left: front.reduce((memo, curr) => {op:'*', left:curr, right:memo}, back)
        result = primary
        for m in matrices_list:
            result = {'op': '*', 'left': m, 'right': result}
        return result

    def try_matrix_expr(self):
        if self.match_str('%'):
            if self.pos < self.len and self.text[self.pos].lower() in 'dblrhv':
                m = self.text[self.pos].upper()
                self.pos += 1
                return {'op': 'matrix', 'matrix': m}
            self.pos -= 1
        return None

    def try_primary_vec_expr(self):
        saved = self.pos

        # @group (location)
        if self.match_str('@'):
            # Try @vec(...)
            if self.match_str('vec('):
                self.skip_whitespace()
                x = self.try_signed_integer()
                if x is None:
                    self.pos = saved
                    return None
                self.skip_whitespace()
                self.expect(',')
                self.skip_whitespace()
                y = self.try_signed_integer()
                if y is None:
                    self.pos = saved
                    return None
                self.skip_whitespace()
                self.expect(')')
                return {'op': 'vector', 'x': int(x), 'y': int(y)}

            # @int(...)
            if self.match_str('int('):
                self.skip_whitespace()
                n = self.try_signed_integer()
                if n is None:
                    self.pos = saved
                    return None
                self.skip_whitespace()
                self.expect(')')
                return {'op': 'integer', 'n': int(n)}

            # @add(...)
            if self.match_str('add('):
                self.skip_whitespace()
                left = self.parse_additive_vec_expr()
                self.skip_whitespace()
                self.expect(',')
                self.skip_whitespace()
                right = self.parse_additive_vec_expr()
                self.skip_whitespace()
                self.expect(')')
                return {'op': 'add', 'left': left, 'right': right}

            # @sub(...)
            if self.match_str('sub('):
                self.skip_whitespace()
                left = self.parse_additive_vec_expr()
                self.skip_whitespace()
                self.expect(',')
                self.skip_whitespace()
                right = self.parse_additive_vec_expr()
                self.skip_whitespace()
                self.expect(')')
                return {'op': 'sub', 'left': left, 'right': right}

            # @clock(...)
            if self.match_str('clock('):
                self.skip_whitespace()
                arg = self.parse_additive_vec_expr()
                self.skip_whitespace()
                self.expect(')')
                return {'op': 'clock', 'arg': arg}

            # @anti(...)
            if self.match_str('anti('):
                self.skip_whitespace()
                arg = self.parse_additive_vec_expr()
                self.skip_whitespace()
                self.expect(')')
                return {'op': 'anti', 'arg': arg}

            # @absdir
            if self.pos < self.len and self.text[self.pos] in 'nsewNSEW':
                d = self.text[self.pos].upper()
                self.pos += 1
                return {'op': 'absdir', 'dir': d}

            # @reldir
            if self.pos < self.len and self.text[self.pos] in 'fblrFBLR':
                d = self.text[self.pos].upper()
                self.pos += 1
                return {'op': 'reldir', 'dir': d}

            # @group (location) - must come after @absdir/@reldir check
            nzi = self.try_non_zero_integer()
            if nzi is not None:
                return {'op': 'location', 'group': nzi}

            self.pos = saved
            return None

        # $group#char or $#char
        if self.match_str('$#'):
            char = self.try_non_zero_integer()
            if char is not None:
                return {'op': 'state', 'group': 0, 'char': char}
            self.pos = saved
            return None

        if self.match_str('$'):
            group = self.try_non_zero_integer()
            if group is not None:
                if self.match_str('#'):
                    char = self.try_non_zero_integer()
                    if char is not None:
                        return {'op': 'state', 'group': group, 'char': char}
            self.pos = saved
            return None

        # Parenthesized
        if self.match_str('('):
            expr = self.parse_additive_vec_expr()
            self.expect(')')
            return expr

        return None

    def try_rhs_state_char(self):
        # Try primary vec expr first
        saved = self.pos
        ve = self.try_primary_vec_expr()
        if ve is not None:
            return ve

        # $group#* (tail)
        if self.match_str('$#*'):
            return {'op': 'tail', 'group': 0}
        if self.match_str('$'):
            group = self.try_non_zero_integer()
            if group is not None:
                if self.match_str('#*'):
                    return {'op': 'tail', 'group': group}
            self.pos = saved

        # Escaped char
        if self.match_str('\\'):
            if self.pos < self.len:
                c = self.text[self.pos]
                self.pos += 1
                return {'op': 'char', 'char': c}
            self.pos -= 1
            return None

        # State char
        sc = self.try_state_char()
        if sc is not None:
            return {'op': 'char', 'char': sc}

        return None

    def parse_rhs(self):
        terms = []
        while True:
            term = self.try_rhs_term()
            if term is None:
                break
            terms.append(term)
            self.skip_whitespace()
        if not terms:
            self.error("Expected RHS terms")
        return terms

    def try_rhs_term(self):
        saved = self.pos

        # $_
        if self.match_str('_'):
            if self.pos < self.len and self.text[self.pos] in 'abcdefghijklmnopqrstuvwxyz0123456789_':
                self.pos = saved
            else:
                return {'type': '_'}

        # $group/state or $group with optional id
        if self.match_str('$'):
            group = self.try_non_zero_integer()
            if group is not None:
                if self.match_str('/'):
                    state = self.parse_rhs_state_char_seq()
                    id_tag = self.try_optional_id_tag()
                    return {'op': 'prefix', 'group': group, 'state': state, **id_tag}
                id_tag = self.try_optional_id_tag()
                return {'op': 'group', 'group': group, **id_tag}
            self.pos = saved

        # type/state or type with optional id
        prefix = self.try_prefix()
        if prefix is not None:
            if self.match_str('/'):
                state = self.parse_rhs_state_char_seq()
                id_tag = self.try_optional_id_tag()
                return {'type': prefix, 'state': state, **id_tag}
            id_tag = self.try_optional_id_tag()
            return {'type': prefix, **id_tag}

        return None

    def parse_rhs_state_char_seq(self):
        chars = []
        while True:
            c = self.try_rhs_state_char()
            if c is None:
                break
            chars.append(c)
        if not chars:
            self.error("Expected state characters")
        return chars

    def try_optional_id_tag(self):
        if self.match_str('~0'):
            return {'id': 0}
        if self.match_str('~'):
            group = self.try_non_zero_integer()
            if group is not None:
                return {'id': group}
            self.pos -= 1
        return {}

    def parse_attributes(self):
        attrs = []
        while True:
            attr = self.try_attribute()
            if attr is None:
                break
            attrs.append(attr)
            self.skip_whitespace()
        return attrs

    def try_attribute(self):
        for parser in (self._try_rate, self._try_sync, self._try_command,
                        self._try_key, self._try_score, self._try_sound, self._try_caption):
            result = parser()
            if result is not None:
                return result
        return None

    def _try_rate(self):
        saved = self.pos
        if self.match_str('rate={'):
            self.skip_whitespace()
            rate = self.try_fixed_point()
            if rate is not None:
                self.skip_whitespace()
                if self.match_str('}'):
                    return {'rate': rate}
        self.pos = saved
        if self.match_str('rate='):
            rate = self.try_fixed_point()
            if rate is not None:
                return {'rate': rate}
        self.pos = saved
        return None

    def _try_sync(self):
        saved = self.pos
        if self.match_str('sync={'):
            self.skip_whitespace()
            sync = self.try_fixed_point()
            if sync is not None:
                self.skip_whitespace()
                if self.match_str('}'):
                    return {'sync': sync}
        self.pos = saved
        if self.match_str('sync='):
            sync = self.try_fixed_point()
            if sync is not None:
                return {'sync': sync}
        self.pos = saved
        return None

    def _try_command(self):
        saved = self.pos
        if self.match_str('command={'):
            s = self._parse_escaped_string()
            if self.match_str('}'):
                return {'command': s}
        self.pos = saved
        if self.match_str('command='):
            s = self._parse_attr_string()
            if s:
                return {'command': s}
        self.pos = saved
        return None

    def _try_key(self):
        saved = self.pos
        if self.match_str('key={'):
            c = self._try_escaped_char()
            if c is not None and self.match_str('}'):
                return {'key': c}
        self.pos = saved
        if self.match_str('key='):
            c = self._try_attr_char()
            if c is not None:
                return {'key': c}
        self.pos = saved
        return None

    def _try_score(self):
        saved = self.pos
        if self.match_str('score={'):
            self.skip_whitespace()
            n = self.try_signed_integer()
            if n is not None:
                self.skip_whitespace()
                if self.match_str('}'):
                    return {'score': int(n)}
        self.pos = saved
        if self.match_str('score='):
            n = self.try_signed_integer()
            if n is not None:
                return {'score': int(n)}
        self.pos = saved
        return None

    def _try_sound(self):
        saved = self.pos
        if self.match_str('sound={'):
            s = self._parse_escaped_string()
            if self.match_str('}'):
                return {'sound': s}
        self.pos = saved
        if self.match_str('sound='):
            s = self._parse_attr_string()
            if s:
                return {'sound': s}
        self.pos = saved
        return None

    def _try_caption(self):
        saved = self.pos
        if self.match_str('caption={'):
            s = self._parse_escaped_string()
            if self.match_str('}'):
                return {'caption': s}
        self.pos = saved
        if self.match_str('caption='):
            s = self._parse_attr_string()
            if s:
                return {'caption': s}
        self.pos = saved
        return None

    def _parse_escaped_string(self):
        result = []
        while True:
            c = self._try_escaped_char()
            if c is None:
                break
            result.append(c)
        return ''.join(result)

    def _try_escaped_char(self):
        if self.pos >= self.len:
            return None
        if self.text[self.pos] == '\\':
            if self.pos + 1 < self.len:
                self.pos += 2
                return self.text[self.pos - 1]
            return None
        if self.text[self.pos] == '}':
            return None
        c = self.text[self.pos]
        self.pos += 1
        return c

    def _parse_attr_string(self):
        start = self.pos
        while self.pos < self.len and self.text[self.pos] in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_':
            self.pos += 1
        return self.text[start:self.pos]

    def _try_attr_char(self):
        if self.pos < self.len and self.text[self.pos] in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_':
            c = self.text[self.pos]
            self.pos += 1
            return c
        return None

    def try_non_zero_integer(self):
        if self.pos >= self.len or self.text[self.pos] not in '123456789':
            return None
        start = self.pos
        self.pos += 1
        while self.pos < self.len and self.text[self.pos].isdigit():
            self.pos += 1
        return int(self.text[start:self.pos])

    def try_signed_integer(self):
        saved = self.pos
        sign = ''
        if self.match_str('+'):
            pass
        elif self.match_str('-'):
            sign = '-'

        if self.match_str('0'):
            if self.pos < self.len and self.text[self.pos].isdigit():
                self.pos = saved
                return None
            return sign + '0' if sign == '-' else '0'

        nzi = self.try_non_zero_integer()
        if nzi is not None:
            return sign + str(nzi)

        self.pos = saved
        return None

    def try_fixed_point(self):
        saved = self.pos

        # Try integer.fraction
        i = self._try_integer_part()
        if i is not None:
            if self.match_str('.'):
                f = self._try_fractional_part()
                if f is not None:
                    return 1000000 * int(i) + int(f)
                self.pos = saved
                # Retry as just integer
                i = self._try_integer_part()
                if i is not None:
                    val = int(i)
                    if val > 999:
                        self.pos = saved
                        return None
                    return 1000000 * val
                self.pos = saved
                return None
            val = int(i)
            if val > 999:
                self.pos = saved
                return None
            return 1000000 * val

        # .fraction
        if self.match_str('.'):
            f = self._try_fractional_part()
            if f is not None:
                return int(f)
            self.pos = saved

        return None

    def _try_integer_part(self):
        start = self.pos
        count = 0
        while self.pos < self.len and self.text[self.pos].isdigit() and count < 3:
            self.pos += 1
            count += 1
        if count == 0:
            return None
        return self.text[start:self.pos]

    def _try_fractional_part(self):
        start = self.pos
        count = 0
        while self.pos < self.len and self.text[self.pos].isdigit() and count < 6:
            self.pos += 1
            count += 1
        if count == 0:
            return None
        s = self.text[start:self.pos]
        # Pad to 6 digits
        return s + '0' * (6 - len(s))


def parse(text):
    """Parse a SokoScript grammar string and return a list of rules."""
    p = Parser(text)
    return p.parse()


def parse_or_undefined(text, error=None, suppress_location=False):
    """Parse grammar text, returning None on error (like JS parseOrUndefined)."""
    try:
        return parse(text)
    except SyntaxError as e:
        if error is not False and error is not None:
            if callable(error):
                if suppress_location:
                    error(e.msg)
                else:
                    msg = e.msg
                    if e.line is not None:
                        lines = text.split('\n')
                        if e.line <= len(lines):
                            line_text = lines[e.line - 1]
                            arrow = '-' * (e.column - 1) + '^'
                            msg = f"Line {e.line}, column {e.column}:\n{e.msg}\n{line_text}\n{arrow}\n"
                    error(msg)
        return None
    except Exception:
        return None
