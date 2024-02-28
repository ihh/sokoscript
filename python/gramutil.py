from copy import deepcopy

EmptyType = '_'
UnknownType = '?'

def makeGrammarIndex(rules):
    transform = {}
    syncTransform = {}
    parents = {}
    types = [EmptyType]
    seenType = {EmptyType: True, UnknownType: True}

    def markTerm(term):
        nonlocal types, seenType
        if term['op'] == 'negterm':
            markTerm(term['term'])
        elif term['op'] == 'alt':
            for t in term['alt']:
                markTerm(t)
        elif term['op'] != 'any' and term['op'] != 'group' and term['op'] != 'prefix':
            if term['type'] == '':
                raise Exception(' type in term: ' + json.dumps(term))
            markType(term['type'])

    def markType(type):
        nonlocal types, seenType
        if type not in seenType:
            types.append(type)
        seenType[type] = True

    for rule in rules:
        prefix = ''
        if rule['type'] == 'transform':
            prefix = rule['lhs'][0]['type']
            trans = syncTransform[rule['sync']] if rule['sync'] else transform
            if prefix not in trans:
                trans[prefix] = []
            trans[prefix].append(rule)
            for term in rule['lhs']:
                markTerm(term)
            for term in rule['rhs']:
                markTerm(term)
        elif rule['type'] == 'inherit':
            prefix = rule['child']
            if prefix not in parents:
                parents[prefix] = []
            parents[prefix].extend(rule['parents'])
            markType(rule['child'])
            for parent in rule['parents']:
                markType(parent)
        elif rule['type'] == 'comment':
            pass
        else:
            raise Exception("Unrecognized rule type '" + rule['type'] + "' in " + json.dumps(rule))

    types.append(UnknownType)

    ancestors = {}
    for child in parents.keys():
        seen = {}
        def getAncestors(prefix):
            nonlocal seen
            if prefix in seen or not parents[prefix]:
                return []
            seen[prefix] = True
            return parents[prefix] + sum([getAncestors(p) for p in parents[prefix]], [])
        ancestors[child] = getAncestors(child)

    isAncestor = {}
    descendants = {}
    for descendant in ancestors.keys():
        for ancestor in ancestors[descendant]:
            if ancestor not in isAncestor:
                isAncestor[ancestor] = {}
            isAncestor[ancestor][descendant] = True

    for ancestor in isAncestor.keys():
        descendants[ancestor] = sorted(isAncestor[ancestor].keys())

    typeIndex = {type: n for n, type in enumerate(types)}

    syncRates = sorted([int(s) for s in syncTransform.keys()])
    syncCategoriesByType = {t: [r for r in syncRates if len(syncTransform[str(r)].get(t, [])) > 0] for t in types}

    return {
        'transform': transform,
        'syncTransform': syncTransform,
        'ancestors': ancestors,
        'descendants': descendants,
        'types': types,
        'typeIndex': typeIndex,
        'syncRates': syncRates,
        'syncCategoriesByType': syncCategoriesByType
    }

def replaceTermWithAlt(term, descendants):
    if term['op'] == 'negterm':
        return {'op': term['op'], 'term': replaceTermWithAlt(term['term'], descendants)}
    if term['op'] == 'alt':
        alt = []
        seen = {}
        for t in term['alt']:
            if t['op'] == 'alt':
                alt.extend(t['alt'])
            else:
                tstr = lhsTerm(t)
                if tstr not in seen:
                    alt.append(t)
                    seen[tstr] = True
        return {'op': term['op'], 'alt': alt}
    if term['type'] in descendants:
        return {'op': 'alt', 'alt': [term] + [dict(term, type=descendant) for descendant in descendants[term['type']]]}
    return term

def expandAlts(transform, descendants):
    return {prefix: [dict(rule, lhs=[rule['lhs'][0]] + [replaceTermWithAlt(term, descendants) for term in rule['lhs'][1:]]) for rule in rules] for prefix, rules in transform.items()}

def replaceSubjectType(rule, type):
    lhs = deepcopy(rule['lhs'])
    lhs[0]['type'] = type
    return dict(rule, lhs=lhs)

def appendInherited(types, explicit, ancestors):
    return {prefix: sum([explicit[anc] if anc in explicit else [] for anc in ancs], []) + (explicit[prefix] if prefix in explicit else []) for prefix, ancs in ancestors.items()}

def expandInherits(index):
    explicit = expandAlts(index['transform'], index['descendants'])
    syncExplicit = {r: expandAlts(syncTransform, index['descendants']) for r, syncTransform in index['syncTransform'].items()}
    transform = appendInherited(index['types'], explicit, index['ancestors'])
    syncTransform = {r: appendInherited(index['types'], syncExplicit[r], index['ancestors']) for r in index['syncRates']}
    return {
        'types': index['types'],
        'typeIndex': index['typeIndex'],
        'syncRates': index['syncRates'],
        'syncCategoriesByType': index['syncCategoriesByType'],
        'transform': transform,
        'syncTransform': syncTransform
    }

def compileTerm(typeIndex, t):
    if t['op'] == 'negterm':
        return dict(t, term=compileTerm(typeIndex, t['term']))
    if t['op'] == 'alt':
        return dict(t, alt=[compileTerm(typeIndex, alt) for alt in t['alt']])
    return dict(t, type=typeIndex[t['type']])

def compileTransform(types, transform, typeIndex, rateKey, defaultRate):
    return [
        [
            {
                rateKey: defaultRate,
                **rule,
                'lhs': [compileTerm(typeIndex, t) for t in rule['lhs']],
                'rhs': [compileTerm(typeIndex, t) for t in rule['rhs']]
            }
            if rule['type'] == 'transform'
            else rule
            for rule in rules
        ]
        for rules in transform.values()
    ]

def collectCommandsAndKeys(command, key, transform, types):
    for type, rules in enumerate(transform):
        for rule in rules:
            if 'command' in rule:
                if rule['command'] not in command[type]:
                    command[type][rule['command']] = []
                command[type][rule['command']].append(rule)
            if 'key' in rule:
                if rule['key'] not in key[type]:
                    key[type][rule['key']] = []
                key[type][rule['key']].append(rule)

def compileTypes(rules):
    index = expandInherits(makeGrammarIndex(rules))
    types = index['types']
    typeIndex = index['typeIndex']
    syncRates = index['syncRates']
    transform = compileTransform(types, index['transform'], typeIndex, 'rate', 1000000)
    syncTransform = [compileTransform(types, syncTransform, typeIndex, 'sync', 1) for syncTransform in index['syncTransform']]

    bigMillion = 1000000
    big2pow30minus1 = 0x3fffffff
    bigMillion_leftShift32 = bigMillion << 32

    for rules in transform:
        for rule in rules:
            rule['rate_Hz'] = (rule['rate'] + bigMillion - 1) // bigMillion
            rule['acceptProb_leftShift30'] = int(rule['rate'] * big2pow30minus1 // (rule['rate_Hz'] * bigMillion))

    command = [{} for _ in types]
    key = [{} for _ in types]
    collectCommandsAndKeys(command, key, transform, types)

    for n, syncTransform in enumerate(syncTransform):
        collectCommandsAndKeys(command, key, syncTransform, types)

    rateByType = [sum(rule['rate_Hz'] for rule in rules) for rules in transform]
    syncCategoriesByType = [list(filter(lambda r: len(syncTransform[r][n]) > 0, syncRates)) for n in types]
    typesBySyncCategory = [list(filter(lambda n: len(syncTransform[m][n]) > 0, types)) for m in syncRates]
    syncPeriods = [bigMillion_leftShift32 // r for r in syncRates]
    syncCategories = list(range(len(syncRates)))[::-1]
    unknownType = len(types) - 1

    return {
        'transform': transform,
        'syncTransform': syncTransform,
        'types': types,
        'unknownType': unknownType,
        'typeIndex': typeIndex,
        'syncRates': syncRates,
        'syncPeriods': syncPeriods,
        'syncCategories': syncCategories,
        'rateByType': rateByType,
        'syncCategoriesByType': syncCategoriesByType,
        'typesBySyncCategory': typesBySyncCategory,
        'command': command,
        'key': key
    }

def syntaxErrorMessage(e, text):
    if isinstance(e, SyntaxError):
        line = text.split("\n")[e.location.start.line - 1]
        arrow = '-' * (e.location.start.column - 1) + '^'
        return f"Line {e.location.start.line}, column {e.location.start.column}:\n{e.message}\n{line}\n{arrow}\n"
    else:
        return str(e)

def parseOrUndefined(text, opts=None):
    try:
        return parse(text)
    except Exception as e:
        if opts is None or opts.get('error', True):
            if opts is not None and opts.get('suppressLocation', False):
                print(e.message)
            else:
                print(syntaxErrorMessage(e, text))
        return None

def grammarIndexToRuleList(index, addComments):
    rules = []
    for n, type in enumerate(index['types']):
        if addComments and n != index['unknownType']:
            rules.append({'type': 'comment', 'comment': f' Type {n}: {type} ({len(index["transform"][type])} rules)'})
        rules.extend(index['transform'][type])
        for s in index['syncCategoriesByType'][type]:
            rules.extend(index['syncTransform'][s][type])
    return rules

def compiledGrammarIndexToRuleList(index, addComments):
    rules = []
    for n, type in enumerate(index['types']):
        if addComments and n != index['unknownType']:
            rules.append({'type': 'comment', 'comment': f' Type {n}: {type} ({len(index["transform"][n])} rules)'})
        rules.extend(index['transform'][n])
        for s in index['syncCategoriesByType'][n]:
            rules.extend(index['syncTransform'][s][n])
    return rules

def bigIntContainerToObject(x):
    return json.loads(json.dumps(x, default=lambda o: str(o) + 'n' if isinstance(o, int) else o))


