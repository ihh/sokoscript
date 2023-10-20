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
    return { transform, ancestors };
}

function replaceSubjectType (rule, type) {
    let lhs = rule.lhs.slice(0);
    lhs[0] = { ...lhs[0], type }
    return { ...rule, lhs }
}

function expandInherits (rules) {
    const index = makeGrammarIndex (rules);
    console.warn(index.ancestors)
    let transform  = {};
    Object.keys(index.transform).forEach ((prefix) => transform[prefix] = index.transform[prefix].slice(0));
    Object.keys(index.ancestors).forEach ((prefix) =>
        transform[prefix] = index.ancestors[prefix].reduce ((rules,ancs) =>
            rules.concat((index.transform[ancs] || []).map ((rule) => replaceSubjectType(rule,prefix))), transform[prefix] || []));

  // TODO: implement inheritance in positions other than $1, using alts

  return transform;
}

module.exports = { expandInherits }
