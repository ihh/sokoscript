{
  const validatePositionals = (expr, matchedStateChars, extraLoc) =>
    (expr.hasOwnProperty('group')
     ? ((expr.group <= matchedStateChars.length + (extraLoc && expr.op==='location' ? 1 : 0))
        && (expr.hasOwnProperty('char') ? (expr.char <= matchedStateChars[expr.group-1]) : true))
     : true)
    && ['left','right','arg']
        .filter((prop)=>expr.hasOwnProperty(prop))
        .reduce ((result, prop) => result && validatePositionals (expr[prop], matchedStateChars), true);

  const reducePred = (args, pred) => args.reduce ((result, arg) => result && pred(arg), true);
  const altList = (alt) => alt.op === 'alt' ? alt.alt : [alt];
  const reduceAlt = (alt, pred) => alt.op === 'negterm' ? reduceAlt (alt.term, pred) : reducePred (altList(alt), pred);
  const validateState = (term, msc, extraLoc) => !term.hasOwnProperty('state') || reducePred (term.state, (char) => validatePositionals(char,msc,extraLoc));
  const validateDir = (term, msc) => !term.hasOwnProperty('dir') || validatePositionals(term.dir,msc,false);
  const matchedStateChars = (alt) => altList(alt).length && Math.min.apply (null, altList(alt).map (term => term.hasOwnProperty('state') ? term.state.filter((s)=>!(s.op==='any')).length : 0));
  const validateLhs = (lhs) => lhs.reduce ((memo, term) => ({ result: memo.result && reduceAlt (term, (term) => validateState(term,memo.matchedStateChars,true) && validateDir(term,memo.matchedStateChars)),
                                                              matchedStateChars: memo.matchedStateChars.concat ([matchedStateChars(term)]) }),
                                                            { result: true, matchedStateChars: [] }).result;
  const validateRhs = (lhs, rhs) => rhs.reduce ((result, term) => result && reduceAlt (term, (term) => validateState(term,lhs.map(matchedStateChars),false)), true);
}

RuleSet
 = r:Rule _ "." _ s:RuleSet { return [r].concat(s) }
 / r:Rule _ "." _ { return [r] }
 / r:Rule _ { return [r] }

Rule
 = lhs:Lhs
 &{ return validateLhs(lhs) }
   _ ":" _ rhs:Rhs
 &{ return validateRhs(lhs,rhs) }
  _ "," _ attrs:Attributes
  { return { type: 'transform', lhs, rhs, ...attrs } }
 / lhs:Lhs
 &{ return validateLhs(lhs) }
   _ ":" _ rhs:Rhs
 &{ return validateRhs(lhs,rhs) }
  { return { type: 'transform', lhs, rhs } }
 / child:Subject
 &{ return validateLhs ([child]) }
    _ "=" _ parents:InheritRhs
 &{ return validateRhs ([child],parents) }
  { return { type: 'inherit', child, parents } }

Attributes
 = first:Attribute rest:(_ Attribute)*
 !{
    let count = {};
    [[null,first]].concat(rest).forEach ((attr) => Object.keys(attr[1]).forEach((k) => count[k] = (count[k] || 0) + 1));
    const duplicates = Object.keys(count).filter((k) => count[k] > 1);
    if (duplicates.length)
      console.warn ("Warning - duplicate attributes: " + duplicates.map((d)=>'"'+d+'"').join(", "));
    return duplicates.length;
  }
  { return [[null,first]].concat(rest).reduce((a, attr) => { return { ...a, ...attr[1] } }, {}) }


InheritRhs
 = first:RhsTerm rest:(_ "," _ RhsTerm)+ { return [first].concat (rest.map ((r) => r[3])) }
 / t:RhsTerm { return [t] }

Attribute = Rate / Command / Key / Reward / Sound / Caption

Lhs
 = t:Subject _ addr:AbsDirOrNbrAddr _ u:LhsTerm s:LhsNbrSeq { return [t, { addr, ...u }].concat(s) }
 / t:Subject _ addr:AbsDirOrNbrAddr _ u:LhsTerm { return [t, { addr, ...u }] }
 / t:Subject _sep u:LhsTerm s:LhsNbrSeq { return [t, u].concat(s) }
 / t:Subject _sep u:LhsTerm { return [t, u] }
 / t:Subject { return [t] }

AbsDirOrNbrAddr
  = ">" d:AbsDirChar ">" { return { op: "neighbor", dir: d.toUpperCase() } }
  / NbrAddr

AbsDirChar
 = [nsewNSEW]

RelDirOrNbrAddr
  = ">" d:RelDirChar ">" { return { op: "neighbor", dir: d.toUpperCase() } }
 / NbrAddr

RelDirChar
 = [fblrFBLR]

NbrAddr
 = ">" arg:AdditiveVecExpr ">" { return { op: "cell", arg } }


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
  / "@" dir:(AbsDirChar / RelDirChar) { return { op: "dir", dir: dir.toUpperCase() } }
  / "$" group:NonZeroInteger "#" char:NonZeroInteger { return { op: "state", group, char } }
  / "(" expr:AdditiveVecExpr ")" { return expr }


LhsNbrSeq
 = _ addr:RelDirOrNbrAddr _ t:WildLhsTerm s:LhsNbrSeq { return [{ addr, ...t }].concat(s) }
 / _ addr:RelDirOrNbrAddr _ t:WildLhsTerm { return [{ addr, ...t }] }
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
  = "$" group:NonZeroInteger { return { op: "group", group } }
 / type:Prefix "/" state:RhsStateCharSeq { return { type, state } }
 / type:Prefix { return { type } }
 / EmptyLhsTerm { return { type: "_" } }

RhsStateCharSeq
 = c:RhsStateChar s:RhsStateCharSeq { return [c].concat(s) }
 / c:RhsStateChar { return [c] }

RhsStateChar
 = PrimaryVecExpr
 / char:StateChar { return { op: "char", char } }
 / "\\" char:. { return { op: "char", char } }

StateChar = [0-9A-Za-z_]



Rate
 = "rate={" _ r:Float _ "}" { return { rate: parseFloat(r) } }
 / "rate=" r:Float { return { rate: parseFloat(r) } }

Command
 = "command={" command:EscapedString "}" { return { command } }
 / "command=" command:AttrString { return { command } }

Key
 = "key={" key:EscapedChar "}" { return { key } }
 / "key=" key:AttrChar { return { key } }

Reward
 = "reward={" _ r:SignedInteger _ "}" { return { reward: parseInt(r) } }
 / "reward=" r:SignedInteger { return { reward: parseInt(r) } }

Sound
 = "sound={" sound:EscapedString "}" { return { sound } }
 / "sound=" sound:AttrString { return { sound } }

Caption
 = "caption={" caption:EscapedString "}" { return caption }
 / "caption=" caption:AttrString { return caption }


NonZeroInteger
  = n:[1-9][0-9]* { return parseInt(n) }

PositiveInteger
  = "+" NonZeroInteger
  / NonZeroInteger

SignedInteger
 = PositiveInteger
 / "-" NonZeroInteger
 / "0"

Float
  = (NonZeroInteger / "0" / "") "." [0-9]*
  / NonZeroInteger
  / "0"

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

