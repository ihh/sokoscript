import { parse, SyntaxError } from './grammar.js';
import { lhsTerm } from './serialize.js';

const makeGrammarIndex = (rules) => {
    let transform = {}, syncTransform = {}, parents = {}, types = ['_'], seenType = {'_':true};
    const markTerm = (term) => {
        if (term.op === 'negterm')
            markTerm (term.term);
        else if (term.op === 'alt')
            term.alt.forEach ((t) => markTerm);
        else if (term.op !== 'any' && term.op !== 'group' && term.op !== 'prefix') {
            if (typeof(term.type) === 'undefined')
                throw new Error('undefined type in term: ' + JSON.stringify(term))
            markType (term.type);
        }
    };
    const markType = (type) => {
        if (!seenType[type])
            types.push (type);
        seenType[type] = true;
    };
    rules.forEach ((rule) => {
        let prefix;
        switch (rule.type) {
            case 'transform':
                {
                    prefix = rule.lhs[0].type;
                    let trans = rule.sync ? (syncTransform[rule.sync] = syncTransform[rule.sync] || {}) : transform;
                    trans[prefix] = trans[prefix] || [];
                    trans[prefix].push (rule);
                    rule.lhs.forEach (markTerm);
                    rule.rhs.forEach (markTerm);
                }
                break;
            case 'inherit':
                prefix = rule.child;
                parents[prefix] = (parents[prefix] || []).concat (rule.parents);
                markType (rule.child);
                rule.parents.forEach (markType);
                break;
            case 'comment':
                break;
            default:
                throw new Error ("Unrecognized rule type '" + rule.type + "' in " + JSON.stringify(rule));
            break;
        }
    })
    let ancestors = Object.assign (
        ...[{}].concat (Object.keys(parents).map ((child) => {
            let seen = {};
            const getAncestors = (prefix) => {
                if (seen[prefix] || !parents[prefix])
                    return [];
                seen[prefix] = true;
                return parents[prefix].reduce ((a,p) => a.concat(getAncestors(p)), parents[prefix]);
            };
            return { [child]: getAncestors(child) }
        })
    ));
    let isAncestor = {}, descendants = {};
    Object.keys(ancestors).forEach ((descendant) => ancestors[descendant].forEach ((ancestor) => {
        isAncestor[ancestor] = isAncestor[ancestor] || {}
        isAncestor[ancestor][descendant] = true
    }));
    Object.keys(isAncestor).forEach ((ancestor) => descendants[ancestor] = Object.keys(isAncestor[ancestor]).sort())
    let typeIndex = {};
    types.forEach ((type, n) => typeIndex[type] = n);
    let syncRates = Object.keys(syncTransform).sort ((a,b) => a - b);
    return { transform, syncTransform, ancestors, descendants, types, typeIndex, syncRates };
}

const replaceTermWithAlt = (term, descendants) => {
    if (term.op === 'negterm')
        return { op: term.op, term: replaceTermWithAlt (term.term, descendants) }
    if (term.op === 'alt')
        return { 
                    op: term.op,
                    alt: term.alt.map ((t) => replaceTermWithAlt (t, descendants))
                        .reduce ((alt, t) => alt.concat(t.op==='alt' ? t.alt : [t]), [])
                        .reduce ((memo, t) => {
                            const tstr = lhsTerm(t);
                            if (memo.seen[tstr])
                                return memo;
                            return { alt: memo.alt.concat([t]), seen: { ...memo.seen, [tstr]: true }}
                        }, { alt: [], seen: {} }).alt
                }
    if (descendants[term.type])
        return { op: 'alt', alt: [term].concat (descendants[term.type].map ((descendant) => ({ ...term, type: descendant }))) }
    return term;
}

const expandAlts = (transform, descendants) => Object.assign (...[{}].concat (Object.keys(transform).map ((prefix) => ({
    [prefix]: transform[prefix].map ((rule) => ({
        ...rule,
        lhs: [rule.lhs[0]].concat (rule.lhs.slice(1).map ((term) => replaceTermWithAlt (term, descendants)))
    }))
}))));

const replaceSubjectType = (rule, type) => {
    let lhs = rule.lhs.slice(0);
    lhs[0] = { ...lhs[0], type }
    return { ...rule, lhs }
}

const appendInherited = (types, explicit, ancestors) => Object.assign (...[{}].concat (types.map ((prefix) => ({
    [prefix]: (ancestors[prefix] || []).reduce ((rules,ancs) =>
        rules.concat((explicit[ancs] || []).map ((rule) =>
            replaceSubjectType(rule,prefix))), explicit[prefix] || []) })).filter ((trans) => trans[Object.keys(trans)[0]].length)));

const expandInherits = (index) => {
    const explicit = expandAlts (index.transform, index.descendants);
    const syncExplicit = Object.assign (...[{}].concat(index.syncRates.map ((r) => ({ [r]: expandAlts (index.syncTransform[r], index.descendants) }))));
    const transform = appendInherited (index.types, explicit, index.ancestors);
    const syncTransform = Object.assign (...[{}].concat(index.syncRates.map ((r) => ({ [r]: appendInherited (index.types, syncExplicit[r], index.ancestors) }))));

    return { types: index.types, typeIndex: index.typeIndex, syncRates: index.syncRates, transform, syncTransform };
};

const compileTerm = (typeIndex, t) => {
    if (t.op === 'negterm')
        return { ...t, term: compileTerm (typeIndex, t.term) };
    if (t.op === 'alt')
        return { ...t, alt: t.alt.map ((t) => compileTerm (typeIndex, t)) };
    return { ...t, type: typeIndex[t.type] }
};

const compileTransform = (types, transform, typeIndex, rateKey) =>
 types.map ((type) =>
    (transform[type] || []).map ((rule) =>
        rule.type === 'transform'
        ? { [rateKey]: 1,
            ...rule,
            lhs: rule.lhs.map((t) => compileTerm(typeIndex,t)),
            rhs: rule.rhs.map((t) => compileTerm(typeIndex,t)) }
        : rule ));

const collectCommandsAndKeys = (command, key, transform, types) =>
 types.forEach ((_name, type) => transform[type].forEach ((rule) => {
    if (rule.command)
        command[type][rule.command] = (command[type][rule.command] || []).concat ([rule]);
    if (rule.key)
        key[type][rule.key] = (key[type][rule.key] || []).concat ([rule]);
 }));

const compileTypes = (rules) => {
    const index = expandInherits (makeGrammarIndex (rules));
    const { types, typeIndex, syncRates } = index;
    const transform = compileTransform (types, index.transform, typeIndex, 'rate');
    const syncTransform = Object.assign (...[{}].concat(index.syncRates.map ((r) => ({ [r]: compileTransform (index.types, index.syncTransform[r], typeIndex, 'sync') }))));
    let command = types.map(()=>({})), key = types.map(()=>({}));
    collectCommandsAndKeys (command, key, transform, types);
    syncRates.forEach ((r) => collectCommandsAndKeys (command, key, syncTransform[r], types));
    const rateByType = transform.map ((rules) => rules.reduce ((total, rule) => total + rule.rate, 0));
    return { transform, syncTransform, types, typeIndex, syncRates, rateByType, command, key }
}

const syntaxErrorMessage = (e, text) => {
    let msg;
    if (e instanceof SyntaxError) {
        const line = text.split("\n")[e.location.start.line - 1];
        const arrow = '-'.repeat(e.location.start.column - 1) + '^';
        msg = `Line ${e.location.start.line}, column ${e.location.start.column}:\n`
              + e.message + "\n"
              + line + "\n"
              + arrow + "\n";
    } else
        msg = e.message;
    return msg;
}

const parseOrUndefined = (text, error) => {
    let rules;
    try {
        rules = parse(text);
    } catch (e) {
        if (error !== false)
            (error || console.error) (syntaxErrorMessage(e,text));
    }
    return rules;
}

const grammarIndexToRuleList = (index) => index.types.reduce ((newRules,type,n) => newRules.concat([{type:'comment',comment:' Type '+n+': '+type+' ('+(index.transform[type]||[]).length+' rules)'}]).concat(index.transform[type]||[]).concat(index.syncRates.reduce((l,s)=>l.concat(index.syncTransform[s][type]||[]),[])), []);
const compiledGrammarIndexToRuleList = (index) => index.types.reduce ((newRules,type,n) => newRules.concat([{type:'comment',comment:' Type '+n+': '+type+' ('+(index.transform[n]||[]).length+' rules)'}]).concat(index.transform[n]||[]).concat(index.syncRates.reduce((l,s)=>l.concat(index.syncTransform[s][n]||[]),[])), []);

export { makeGrammarIndex, expandInherits, compileTypes, syntaxErrorMessage, parseOrUndefined, grammarIndexToRuleList, compiledGrammarIndexToRuleList }
