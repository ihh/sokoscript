"""Grammar compilation: AST -> indexed, inherited, compiled rules.

Port of src/gramutil.js: makeGrammarIndex, expandInherits, compileTypes.
"""

from .serialize import lhs_term

EMPTY_TYPE = '_'
UNKNOWN_TYPE = '?'


def make_grammar_index(rules):
    transform = {}
    sync_transform = {}
    parents = {}
    types = [EMPTY_TYPE]
    seen_type = {EMPTY_TYPE: True, UNKNOWN_TYPE: True}

    def mark_type(t):
        if t not in seen_type:
            types.append(t)
        seen_type[t] = True

    def mark_term(term):
        op = term.get('op')
        if op == 'negterm':
            mark_term(term['term'])
        elif op == 'alt':
            for t in term['alt']:
                mark_term(t)
        elif op not in ('any', 'group', 'prefix'):
            if 'type' not in term:
                raise ValueError(f"undefined type in term: {term}")
            mark_type(term['type'])

    for rule in rules:
        rt = rule['type']
        if rt == 'transform':
            prefix = rule['lhs'][0]['type']
            if rule.get('sync'):
                sync_key = rule['sync']
                if sync_key not in sync_transform:
                    sync_transform[sync_key] = {}
                trans = sync_transform[sync_key]
            else:
                trans = transform
            trans.setdefault(prefix, []).append(rule)
            for t in rule['lhs']:
                mark_term(t)
            for t in rule['rhs']:
                mark_term(t)
        elif rt == 'inherit':
            prefix = rule['child']
            parents.setdefault(prefix, []).extend(rule['parents'])
            mark_type(rule['child'])
            for p in rule['parents']:
                mark_type(p)
        elif rt == 'comment':
            pass
        else:
            raise ValueError(f"Unrecognized rule type '{rt}'")

    types.append(UNKNOWN_TYPE)

    # Compute ancestors
    ancestors = {}
    for child in parents:
        seen = set()

        def get_ancestors(p):
            if p in seen or p not in parents:
                return []
            seen.add(p)
            result = list(parents[p])
            for pp in parents[p]:
                result.extend(get_ancestors(pp))
            return result

        ancestors[child] = get_ancestors(child)

    # Compute descendants
    is_ancestor = {}
    descendants = {}
    for desc, ancs in ancestors.items():
        for anc in ancs:
            is_ancestor.setdefault(anc, {})[desc] = True
    for anc in is_ancestor:
        descendants[anc] = sorted(is_ancestor[anc].keys())

    type_index = {t: n for n, t in enumerate(types)}
    sync_rates = sorted(int(s) for s in sync_transform.keys())
    sync_categories_by_type = {}
    for n, t in enumerate(types):
        cats = [r for r in sync_rates if len(sync_transform.get(r, {}).get(t, [])) > 0]
        if cats:
            sync_categories_by_type[t] = cats

    return {
        'transform': transform,
        'syncTransform': sync_transform,
        'ancestors': ancestors,
        'descendants': descendants,
        'types': types,
        'typeIndex': type_index,
        'syncRates': sync_rates,
        'syncCategoriesByType': sync_categories_by_type,
    }


def _replace_term_with_alt(term, descendants):
    op = term.get('op')
    if op == 'negterm':
        return {'op': 'negterm', 'term': _replace_term_with_alt(term['term'], descendants)}
    if op == 'alt':
        expanded = []
        for t in term['alt']:
            rt = _replace_term_with_alt(t, descendants)
            if rt.get('op') == 'alt':
                expanded.extend(rt['alt'])
            else:
                expanded.append(rt)
        # Deduplicate
        seen = {}
        deduped = []
        for t in expanded:
            key = lhs_term(t)
            if key not in seen:
                deduped.append(t)
                seen[key] = True
        return {'op': 'alt', 'alt': deduped}
    if term.get('type') in descendants:
        return {
            'op': 'alt',
            'alt': [term] + [{**term, 'type': d} for d in descendants[term['type']]]
        }
    return term


def _expand_alts(transform, descendants):
    result = {}
    for prefix, rules in transform.items():
        result[prefix] = [
            {**rule, 'lhs': [rule['lhs'][0]] + [_replace_term_with_alt(t, descendants) for t in rule['lhs'][1:]]}
            for rule in rules
        ]
    return result


def _replace_subject_type(rule, new_type):
    lhs = list(rule['lhs'])
    lhs[0] = {**lhs[0], 'type': new_type}
    return {**rule, 'lhs': lhs}


def _append_inherited(types, explicit, ancestors):
    result = {}
    for prefix in types:
        rules = list(explicit.get(prefix, []))
        for anc in ancestors.get(prefix, []):
            for rule in explicit.get(anc, []):
                rules.append(_replace_subject_type(rule, prefix))
        if rules:
            result[prefix] = rules
    return result


def expand_inherits(index):
    explicit = _expand_alts(index['transform'], index['descendants'])
    sync_explicit = {
        r: _expand_alts(index['syncTransform'].get(r, {}), index['descendants'])
        for r in index['syncRates']
    }
    transform = _append_inherited(index['types'], explicit, index['ancestors'])
    sync_transform = {
        r: _append_inherited(index['types'], sync_explicit[r], index['ancestors'])
        for r in index['syncRates']
    }

    return {
        'types': index['types'],
        'typeIndex': index['typeIndex'],
        'syncRates': index['syncRates'],
        'syncCategoriesByType': index['syncCategoriesByType'],
        'transform': transform,
        'syncTransform': sync_transform,
    }


def _compile_term(type_index, t):
    op = t.get('op')
    if op == 'negterm':
        return {**t, 'term': _compile_term(type_index, t['term'])}
    if op == 'alt':
        return {**t, 'alt': [_compile_term(type_index, a) for a in t['alt']]}
    if 'type' in t:
        return {**t, 'type': type_index[t['type']]}
    return t


def _compile_transform(types, transform, type_index, rate_key, default_rate):
    result = []
    for t in types:
        rules = []
        for rule in transform.get(t, []):
            if rule['type'] == 'transform':
                compiled = {rate_key: default_rate, **rule}
                compiled['lhs'] = [_compile_term(type_index, term) for term in rule['lhs']]
                compiled['rhs'] = [_compile_term(type_index, term) for term in rule['rhs']]
                rules.append(compiled)
            else:
                rules.append(rule)
        result.append(rules)
    return result


def _collect_commands_and_keys(command, key, transform, types):
    for type_idx, _name in enumerate(types):
        for rule in transform[type_idx]:
            if rule.get('command'):
                command[type_idx].setdefault(rule['command'], []).append(rule)
            if rule.get('key'):
                key[type_idx].setdefault(rule['key'], []).append(rule)


def compile_types(rules):
    index = expand_inherits(make_grammar_index(rules))
    types = index['types']
    type_index = index['typeIndex']
    sync_rates = index['syncRates']
    million = 1000000

    transform = _compile_transform(types, index['transform'], type_index, 'rate', million)
    sync_transform = [
        _compile_transform(types, index['syncTransform'].get(r, {}), type_index, 'sync', 1)
        for r in sync_rates
    ]

    # Convert from microHertz rate to Hertz with rejection
    big_million = million
    big_2pow30minus1 = 0x3FFFFFFF
    import math

    for rules in transform:
        for rule in rules:
            if rule.get('key') or rule.get('command'):
                rule['rate_Hz'] = 0
                rule['acceptProb_leftShift30'] = 0
            else:
                rate = rule.get('rate', million)
                rule['rate_Hz'] = math.ceil(rate / million)
                if rate:
                    rule['acceptProb_leftShift30'] = (rate * big_2pow30minus1) // (rule['rate_Hz'] * big_million)
                else:
                    rule['acceptProb_leftShift30'] = 0

    command = [{} for _ in types]
    key = [{} for _ in types]
    _collect_commands_and_keys(command, key, transform, types)
    for n, r in enumerate(sync_rates):
        _collect_commands_and_keys(command, key, sync_transform[n], types)

    rate_by_type = [
        sum(rule['rate_Hz'] for rule in rules)
        for rules in transform
    ]

    sync_categories_by_type = [
        [m for m, _r in enumerate(sync_rates) if sync_transform[m][n]]
        for n, _t in enumerate(types)
    ]

    types_by_sync_category = [
        [n for n, _t in enumerate(types) if sync_transform[m][n]]
        for m, _r in enumerate(sync_rates)
    ]

    big_million_left_shift_32 = million << 32
    sync_periods = [big_million_left_shift_32 // r for r in sync_rates]
    sync_categories = list(range(len(sync_periods) - 1, -1, -1))

    unknown_type = len(types) - 1

    return {
        'transform': transform,
        'syncTransform': sync_transform,
        'types': types,
        'unknownType': unknown_type,
        'typeIndex': type_index,
        'syncRates': sync_rates,
        'syncPeriods': sync_periods,
        'syncCategories': sync_categories,
        'rateByType': rate_by_type,
        'syncCategoriesByType': sync_categories_by_type,
        'typesBySyncCategory': types_by_sync_category,
        'command': command,
        'key': key,
    }


def grammar_index_to_rule_list(index, add_comments=False):
    rules = []
    unknown = index.get('unknownType', len(index['types']) - 1)
    for n, t in enumerate(index['types']):
        if add_comments and n != unknown:
            trans = index['transform'].get(t, [])
            rules.append({'type': 'comment', 'comment': f' Type {n}: {t} ({len(trans)} rules)'})
        rules.extend(index['transform'].get(t, []))
        for s in index.get('syncCategoriesByType', {}).get(t, []):
            rules.extend(index['syncTransform'].get(s, {}).get(t, []))
    return rules


def compiled_grammar_index_to_rule_list(index, add_comments=False):
    rules = []
    unknown = index['unknownType']
    for n, t in enumerate(index['types']):
        if add_comments and n != unknown:
            trans = index['transform'][n] if n < len(index['transform']) else []
            rules.append({'type': 'comment', 'comment': f' Type {n}: {t} ({len(trans)} rules)'})
        if n < len(index['transform']):
            rules.extend(index['transform'][n])
        for s in index['syncCategoriesByType'][n] if n < len(index['syncCategoriesByType']) else []:
            rules.extend(index['syncTransform'][s][n])
    return rules
