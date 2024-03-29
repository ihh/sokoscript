{
  const validatePositionals = (expr, matchedStateChars, extraLoc) => {
    if (expr.group === 0)
      expr.group = matchedStateChars.length;
    return ('group' in expr
        ? ((expr.group <= matchedStateChars.length + (extraLoc && expr.op==='location' ? 1 : 0))
          && ('char' in expr ? (expr.char <= matchedStateChars[expr.group-1]) : true))
        : true)
      && ['left','right','arg']
          .filter((prop)=>prop in expr)
          .reduce ((result, prop) => result && validatePositionals (expr[prop], matchedStateChars), true);
  };

  const validateIds = (rhs, lhsLen) => !!rhs.reduce ((seen, term) => {
    let pos;
    if ('id' in term) {
      if (term.id > lhsLen)
        return false;
      pos = term.id;
    } else if ('group' in term) {
      if (term.group > lhsLen)
        return false;
      if (!seen[term.group])
        pos = term.group;
    }
    if (seen && pos) {
      if (seen[pos])
        return false;
      seen[pos] = true;
    }
    return seen;
  }, {});

  const sum = (weights) => weights.reduce ((s, w) => s + w, 0);
  const reducePred = (args, pred) => args.reduce ((result, arg) => result && pred(arg), true);
  const altList = (alt) => alt.op === 'alt' ? alt.alt : [alt];
  const reduceAlt = (alt, pred) => alt.op === 'negterm' ? reduceAlt (alt.term, pred) : reducePred (altList(alt), pred);
  const validateState = (term, msc, extraLoc) => !('state' in term) || reducePred (term.state, (char) => validatePositionals(char,msc,extraLoc));
  const validateAddr = (term, msc) => !('addr' in term) || validatePositionals(term.addr,msc,false);
  const matchedStateChars = (alt) => altList(alt).length && Math.min.apply (null, altList(alt).map (term => ('state' in term) ? term.state.filter((s)=>!(s.op==='any')).length : 0));
  const validateLhs = (lhs) => lhs.reduce ((memo, term) => ({ result: memo.result && reduceAlt (term, (term) => validateState(term,memo.matchedStateChars,true) && validateAddr(term,memo.matchedStateChars)),
                                                              matchedStateChars: memo.matchedStateChars.concat ([matchedStateChars(term)]) }),
                                                            { result: true, matchedStateChars: [] }).result;
  const validateRhs = (lhs, rhs) => rhs.length <= lhs.length && rhs.reduce ((result, term) => result && reduceAlt (term, (term) => validateState(term,lhs.map(matchedStateChars),false)), true) && validateIds(rhs,lhs.length);

  const validateInheritance = (rule, rules, error) => {
    if (rule.type === 'transform')
      return true;
    let parents = {}, checked = {};
    rules.filter((r)=>r.type==='inherit').forEach ((r) => parents[r.child] = (parents[r.child] || []).concat (r.parents));
    const isValidAncestor = (p) => {
      if (checked[p])
        return true;
      checked[p] = true;
      if (p === rule.child) {
        error ("Type '" + rule.child + "' inherits from itself");
        return false;
      }
      return !parents[p] || reducePred (parents[p], isValidAncestor);
    }
    return reducePred (rule.parents, isValidAncestor);
  }

  const countDuplicateAttributes = (attrs,error) => {
    let count = {};
    attrs.forEach ((attr) => Object.keys(attr).forEach((k) => count[k] = (count[k] || 0) + 1));
    const duplicates = Object.keys(count).filter((k) => count[k] > 1);
    if (duplicates.length)
      error ("Duplicate attribute: " + duplicates.map((d)=>'"'+d+'"').join(", "));
    return duplicates.length;
  }

  const validateAttributes = (attrs) => {
    const a = Object.assign (...attrs);
    return !(a.sync && a.rate);
  }

  const minusVec = (arg) => ({ op: "-", left: { op: "vector", x: 0, y: 0 }, right: arg });
}

RuleTop = _ s:RuleSet { return s }

RuleSet
 = r:Rule _ "." _ s:RuleSet &{ return validateInheritance(r,s,error) } { return [r].concat(s) }
 / r:Rule _ "." _ { return [r] }
 / r:Rule _ { return [r] }
 / c:Comment _ s:RuleSet { return [c].concat (s) }
 / c:Comment _ { return [c] }

Rule
 = lhs:Lhs
 &{ return validateLhs(lhs) }
   _ ":" _ rhs:Rhs
 &{ return validateRhs(lhs,rhs) }
  _ "," _ attrs:ValidAttributes
  { return { type: "transform", lhs, rhs, ...attrs } }
 / lhs:Lhs
 &{ return validateLhs(lhs) }
   _ ":" _ rhs:Rhs
 &{ return validateRhs(lhs,rhs) }
  { return { type: "transform", lhs, rhs } }
 / child:Prefix _ "=" _ parents:InheritRhs
  { return { type: "inherit", child, parents } }

Comment
 = "//" c:[^\n]+
  { return { type: "comment", comment: c.join('') } }

ValidAttributes
 = a:Attributes
 !{ return countDuplicateAttributes(a,error) }
 &{ return validateAttributes(a) }
  { return Object.assign(...a) }

Attributes
 = first:Attribute rest:(_ Attribute)*
  { return [first].concat(rest.map ((a) => a[1])) }


InheritRhs
 = first:Prefix rest:(_ "," _ Prefix)+ { return [first].concat (rest.map ((r) => r[3])) }
 / p:Prefix { return [p] }

Attribute = Rate / Sync / Command / Key / Score / Sound / Caption

Lhs
 = t:Subject _ addr:DirOrNbrAddr _ u:WildLhsTerm s:LhsNbrSeq { return [t, { addr, ...u }].concat(s) }
 / t:Subject _ addr:DirOrNbrAddr _ u:WildLhsTerm { return [t, { addr, ...u }] }
 / t:Subject _sep u:WildLhsTerm s:LhsNbrSeq { return [t, u].concat(s) }
 / t:Subject _sep u:WildLhsTerm { return [t, u] }
 / t:Subject { return [t] }

DirOrNbrAddr
  = ">" d:AbsDirChar ">" { return { op: "absdir", dir: d.toUpperCase() } }
  / ">" d:RelDirChar ">" { return { op: "reldir", dir: d.toUpperCase() } }
  / NbrAddr

AbsDirChar
 = [nsewNSEW]

RelDirChar
 = [fblrFBLR]

NbrAddr
 = ">" arg:AdditiveVecExpr ">" { return { op: "cell", arg } }
 / ">+" arg:AdditiveVecExpr ">" { return { op: "neighbor", arg } }
 / ">-" arg:AdditiveVecExpr ">" { return { op: "neighbor", arg: minusVec(arg) } }
 / ">" group:NonZeroInteger "#" char:NonZeroInteger ">" { return { op: "neighbor", arg: { op: "state", group, char } } }
 / ">" char:NonZeroInteger ">" { return { op: "neighbor", arg: { op: "state", group: 0, char } } }
 / ">-" group:NonZeroInteger "#" char:NonZeroInteger ">" { return { op: "neighbor", arg: minusVec ({ op: "state", group, char }) } }
 / ">-" char:NonZeroInteger ">" { return { op: "neighbor", arg: minusVec ({ op: "state", group: 0, char }) } }

AdditiveVecExpr
 = first:MultiplicativeVecExpr rest:(_ ("+" / "-") _ MultiplicativeVecExpr)+ {
    return rest.reduce(function(memo, curr) {
      return { op: curr[1], left: memo, right: curr[3] };
    }, first);
  }
  / MultiplicativeVecExpr

MultiplicativeVecExpr
  = front:(MatrixExpr _ ("*" / "") _)+ back:PrimaryVecExpr {
    return front.reduce(function(memo, curr) {
      return { op: "*", left: curr[0], right: memo };
    }, back);
  }
  / PrimaryVecExpr

MatrixExpr
  = "%" m:[dblrhvDBLRHV] { return { op: "matrix", matrix: m.toUpperCase() } }

PrimaryVecExpr
  = "@" group:NonZeroInteger { return { op: "location", group } }
  / "@vec(" _ x:SignedInteger _ "," _ y:SignedInteger _ ")" { return { op: "vector", x: parseInt(x), y: parseInt(y) } }
  / "@int(" _ n:SignedInteger _ ")" { return { op: "integer", n: parseInt(n) } }
  / "@add(" _ left:AdditiveVecExpr _ "," _ right:AdditiveVecExpr _ ")" { return { op: "add", left, right } /* addition mod 94 */ }
  / "@sub(" _ left:AdditiveVecExpr _ "," _ right:AdditiveVecExpr _ ")" { return { op: "sub", left, right } /* subtraction mod 94 */ }
  / "@clock(" _ arg:AdditiveVecExpr _ ")" { return { op: "clock", arg } }
  / "@anti(" _ arg:AdditiveVecExpr _ ")" { return { op: "anti", arg } }
  / "@" dir:AbsDirChar { return { op: "absdir", dir: dir.toUpperCase() } }
  / "@" dir:RelDirChar { return { op: "reldir", dir: dir.toUpperCase() } }
  / "$#" char:NonZeroInteger { return { op: "state", group: 0, char } }
  / "$" group:NonZeroInteger "#" char:NonZeroInteger { return { op: "state", group, char } }
  / "(" expr:AdditiveVecExpr ")" { return expr }

LhsNbrSeq
 = _ addr:DirOrNbrAddr _ t:WildLhsTerm s:LhsNbrSeq { return [{ addr, ...t }].concat(s) }
 / _ addr:DirOrNbrAddr _ t:WildLhsTerm { return [{ addr, ...t }] }
 / _sep t:WildLhsTerm s:LhsNbrSeq { return [t].concat(s) }
 / _sep t:WildLhsTerm { return [t] }

Subject
 = type:Prefix "/" state:LhsStateCharSeq { return { type, state } }
 / type:Prefix { return { type } }

WildLhsTerm
 = "*" { return { op: "any" } }
 / LhsTerm

LhsTerm
 = "^" term:AltLhsTerm { return { op: "negterm", term } }
 / AltLhsTerm

AltLhsTerm
 = "(" first:PrimaryLhsTerm rest:("|" PrimaryLhsTerm)+ ")"
 { return { op: "alt", alt: rest.reduce ((l, t) => l.concat([t[1]]), [first]) } }
 / PrimaryLhsTerm

PrimaryLhsTerm
 = type:Prefix "/" state:LhsStateCharSeq { return { type, state } }
 / type:Prefix { return { type } }
 / EmptyLhsTerm { return { type: "_" } }
 
 EmptyLhsTerm
 = "_"

Prefix
 = InitChar PrefixCharSeq { return text() }
 / InitChar

PrefixCharSeq
 = PrefixChar PrefixCharSeq
 / PrefixChar

LhsStateCharSeq
 = c:LhsStateChar s:LhsStateCharSeq { return [c].concat(s) }
 / c:LhsStateChar { return [c] }
 / "*" { return [{ op: "any" }] }

InitChar
 = [a-z]

PrefixChar
 = [0-9_] / InitChar

LhsStateChar
 = WildChar / CharClass / RhsStateChar

WildChar
  = "?" { return { op: "wild" } }

CharClass
  = "[^" chars:(StateChar / Neighborhood / PrimaryVecExpr)+ "]" { return { op: "negated", chars } }
  / "[" chars:(StateChar / Neighborhood / PrimaryVecExpr)+ "]" { return { op: "class", chars } }

Neighborhood
 = "@" neighborhood:("moore" / "neumann") "(" _ origin:AdditiveVecExpr _ ")" { return { op: "neighborhood", neighborhood, origin }}

Rhs = RhsTermSeq

RhsTermSeq
 = s:RhsTerm _ o:RhsTermSeq { return [s].concat(o); }
 / s:RhsTerm { return [s] }

RhsTerm
  = "$" group:NonZeroInteger "/" state:RhsStateCharSeq id:OptionalIdTag { return { op: "prefix", group, state, ...id } }
  / "$" group:NonZeroInteger id:OptionalIdTag { return { op: "group", group, ...id } }
  / type:Prefix "/" state:RhsStateCharSeq id:OptionalIdTag { return { type, state, ...id } }
  / type:Prefix id:OptionalIdTag { return { type, ...id } }
  / EmptyLhsTerm { return { type: "_" } }

RhsStateCharSeq
 = c:RhsStateChar s:RhsStateCharSeq { return [c].concat(s) }
 / c:RhsStateChar { return [c] }

RhsStateChar
 = PrimaryVecExpr
 / "$#*" { return { op: "tail", group: 0 } }
 / "$" group:NonZeroInteger "#*" { return { op: "tail", group } }
 / char:StateChar { return { op: "char", char } }
 / "\\" char:. { return { op: "char", char } }

StateChar = [0-9A-Za-z_]

OptionalIdTag = "~" group:NonZeroInteger { return { id: group } }
 / "~0" { return { id: 0 } }
 / "" { return {} }

Rate
 = "rate={" _ rate:FixedPoint _ "}" { return { rate } }
 / "rate=" rate:FixedPoint { return { rate } }

Sync
 = "sync={" _ sync:FixedPoint _ "}" { return { sync } }
 / "sync=" sync:FixedPoint { return { sync } }

Command
 = "command={" command:EscapedString "}" { return { command } }
 / "command=" command:AttrString { return { command } }

Key
 = "key={" key:EscapedChar "}" { return { key } }
 / "key=" key:AttrChar { return { key } }

Score
 = "score={" _ r:SignedInteger _ "}" { return { score: parseInt(r) } }
 / "score=" r:SignedInteger { return { score: parseInt(r) } }

Sound
 = "sound={" sound:EscapedString "}" { return { sound } }
 / "sound=" sound:AttrString { return { sound } }

Caption
 = "caption={" caption:EscapedString "}" { return caption }
 / "caption=" caption:AttrString { return caption }


NonZeroInteger
  = [1-9][0-9]* { return parseInt(text()) }

PositiveInteger
  = "+" NonZeroInteger
  / NonZeroInteger

SignedInteger
 = PositiveInteger
 / "-" NonZeroInteger
 / "0"

FixedPoint
 = i:$IntegerPart "." f:FractionalPart { return 1000000 * parseInt(i) + parseInt(f) }
 / i:$IntegerPart { return 1000000 * parseInt(i) }
 / "." f:FractionalPart { return parseInt(f) }
 / ("1000" / "0") { return parseInt(text()) }

IntegerPart = [0-9][0-9][0-9] / [0-9][0-9] / [0-9]

FractionalPart
 = [0-9][0-9][0-9][0-9][0-9][0-9] { return text() }
 / [0-9][0-9][0-9][0-9][0-9]  { return text()+'0' }
 / [0-9][0-9][0-9][0-9]      { return text()+'00' }
 / [0-9][0-9][0-9]          { return text()+'000' }
 / [0-9][0-9]              { return text()+'0000' }
 / [0-9]                  { return text()+'00000' }

EscapedString
 = c:EscapedChar s:EscapedString { return c + s }
 / EscapedChar
 / ""

EscapedChar
 = [^\\}]
 / "\\" c:. { return c }

AttrString
 = AttrChar+ { return text() }

AttrChar = [A-Za-z0-9_]

_sep
 = [ \t\n\r]+

_ "whitespace"
  = [ \t\n\r]*

