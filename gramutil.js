import { lhsTerm } from './serialize.js';

const makeGrammarIndex = (rules) => {
    let transform = {}, parents = {}, types = ['_'], seenType = {'_':true};
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
                prefix = rule.lhs[0].type;
                transform[prefix] = transform[prefix] || [];
                transform[prefix].push (rule);
                rule.lhs.forEach (markTerm);
                rule.rhs.forEach (markTerm);
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
        ...Object.keys(parents).map ((child) => {
            let seen = {};
            const getAncestors = (prefix) => {
                if (seen[prefix] || !parents[prefix])
                    return [];
                seen[prefix] = true;
                return parents[prefix].reduce ((a,p) => a.concat(getAncestors(p)), parents[prefix]);
            };
            return { [child]: getAncestors(child) }
        })
    );
    let isAncestor = {}, descendants = {};
    Object.keys(ancestors).forEach ((descendant) => ancestors[descendant].forEach ((ancestor) => {
        isAncestor[ancestor] = isAncestor[ancestor] || {}
        isAncestor[ancestor][descendant] = true
    }));
    Object.keys(isAncestor).forEach ((ancestor) => descendants[ancestor] = Object.keys(isAncestor[ancestor]).sort())
    let typeIndex = {};
    types.forEach ((type, n) => typeIndex[type] = n);
    return { transform, ancestors, descendants, types, typeIndex };
}

const replaceSubjectType = (rule, type) => {
    let lhs = rule.lhs.slice(0);
    lhs[0] = { ...lhs[0], type }
    return { ...rule, lhs }
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

const expandInherits = (index) => {
    const explicit  = Object.assign (...Object.keys(index.transform).map ((prefix) => ({
        [prefix]: index.transform[prefix].map ((rule) => ({
            ...rule,
            lhs: [rule.lhs[0]].concat (rule.lhs.slice(1).map ((term) => replaceTermWithAlt (term, index.descendants)))
        }))
    })));
    const inherited = Object.assign (...Object.keys(index.ancestors).map ((prefix) => ({
        [prefix]: index.ancestors[prefix].reduce ((rules,ancs) =>
            rules.concat((explicit[ancs] || []).map ((rule) =>
                replaceSubjectType(rule,prefix))), explicit[prefix] || [])
    })));

    return { types: index.types, typeIndex: index.typeIndex, transform: {...explicit, ...inherited} };
};

const compileTypes = (rules) => {
    const index = expandInherits (makeGrammarIndex (rules));
    const compileType = (t) => {
        if (t.op === 'negterm')
            return { ...t, term: compileType (t.term) };
        if (t.op === 'alt')
            return { ...t, alt: t.alt.map (compileType) };
        return { ...t, type: index.typeIndex[t.type] }
    };
    const transform = index.types.map ((type) =>
        (index.transform[type] || []).map ((rule) =>
            rule.type === 'transform'
            ? { ...rule, lhs: rule.lhs.map(compileType), rhs: rule.rhs.map(compileType) }
            : rule ));
    return { transform, types: index.types }
}

export { makeGrammarIndex, expandInherits, compileTypes }
