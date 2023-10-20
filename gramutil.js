const serialize = require('./serialize');

function makeGrammarIndex (rules) {
    let transform = {}, parents = {};
    rules.forEach ((rule) => {
        let prefix;
        switch (rule.type) {
            case 'transform':
                prefix = rule.lhs[0].type;
                transform[prefix] = transform[prefix] || [];
                transform[prefix].push (rule);
                break;
            case 'inherit':
                prefix = rule.child;
                parents[prefix] = (parents[prefix] || []).concat (rule.parents);
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
    return { transform, ancestors, descendants };
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
                            const tstr = serialize.lhsTerm(t);
                            if (memo.seen[tstr])
                                return memo;
                            return { alt: memo.alt.concat([t]), seen: { ...memo.seen, [tstr]: true }}
                        }, { alt: [], seen: {} }).alt
                }
    if (descendants[term.type])
        return { op: 'alt', alt: [term].concat (descendants[term.type].map ((descendant) => ({ ...term, type: descendant }))) }
    return term;
}

function expandInherits (rules) {
    const index = makeGrammarIndex (rules);
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

  return {...explicit, ...inherited};
}

module.exports = { expandInherits }
