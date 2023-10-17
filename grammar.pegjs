RuleSet
 = r:Rule _ "." _ s:RuleSet { return [r].concat(s) }
 / r:Rule _ "." _ { return [r] }
 / r:Rule _ { return [r] }

Rule
 = lhs:Lhs _ ":" _ rhs:Rhs _ rate:Rate _ command:Command _ key:Key _ reward:Reward _ sound:Sound _ caption:Caption
 !{ return rhs.filter ((t) => t.group > lhs.length).length }
{ return { lhs, rhs, ...rate, ...command, ...key, ...reward, ...sound, ...caption } }

Lhs
 = t:Subject _ dir:AbsDirOrNbrAddr _ u:LhsTerm s:LhsNbrSeq { return [t, { dir, ...u }].concat(s) }
 / t:Subject _ dir:AbsDirOrNbrAddr _ u:LhsTerm { return [t, { dir, ...u }] }
 / t:Subject _sep u:LhsTerm s:LhsNbrSeq { return [t, u].concat(s) }
 / t:Subject _sep u:LhsTerm { return [t, u] }
 / t:Subject { return [t] }

AbsDirOrNbrAddr
 = ">" d:AbsDirChar ">" { return d.toUpperCase() }
  / NbrAddr

AbsDirChar
 = [nsewNSEW]

RelDirOrNbrAddr
 = ">" d:[fblrFBLR] ">" { return d.toUpperCase() }
 / NbrAddr

RelDirChar
 = [fblrFBLR]

NbrAddr
 = ">" AdditiveVecExpr ">"


TerminatedVecExpr
  = v:AdditiveVecExpr _ ";" { return v }

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
  = "%" m:[blrhvBLRHV] { return { op: "matrix", matrix: m.toUpperCase() } }


PrimaryVecExpr
  = "@" group:NonZeroInteger { return { op: "location", group } }
  / "@" dir:(AbsDirChar / RelDirChar) { return { op: "dir", dir: dir.toUpperCase() } }
  / "@(" _ x:SignedInteger _ "," _ y:SignedInteger _ ")" { return { op: "constant", x: parseInt(x), y: parseInt(y) } }
  / "$" group:NonZeroInteger "/" char:NonZeroInteger { return { op: "state", group, char } }
  / "(" expr:AdditiveVecExpr ")" { return expr }


LhsNbrSeq
 = _ dir:RelDirOrNbrAddr _ t:WildLhsTerm s:LhsNbrSeq { return [{ dir, ...t }].concat(s) }
 / _ dir:RelDirOrNbrAddr _ t:WildLhsTerm { return [{ dir, ...t }] }
 / _sep t:WildLhsTerm s:LhsNbrSeq { return [t].concat(s) }
 / _sep t:WildLhsTerm { return [t] }

Subject
 = type:Prefix "/" state:LhsStateCharSeq { return { type, state } }
 / type:Prefix { return { type } }
 / EmptyLhsTerm { return { type: "_" } }

WildLhsTerm
 = "*" { return { wild: "*" } }
 / LhsTerm

LhsTerm
 = "^" negate:PrimaryLhsTerm { return { negate } }
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

InitChar
 = [a-z]

PrefixChar
 = [0-9_] / InitChar

LhsStateChar
 = WildChar / CharClass / RhsStateChar

WildChar
  = "?" { return { type: "wild" } }

CharClass
  = "[^" chars:(PrefixChar / TerminatedVecExpr)+ "]" { return { type: "negated", chars } }
  / "[" chars:(PrefixChar / TerminatedVecExpr)+ "]" { return { type: "class", chars } }


Rhs = RhsTermSeq

RhsTermSeq
 = s:RhsTerm _ o:RhsTermSeq { return [s].concat(o); }
 / s:RhsTerm { return [s] }

RhsTerm
 = "$" g:PositiveInteger { return { group: parseInt(g) } }
 / type:Prefix "/" state:RhsStateCharSeq { return { type, state } }
 / type:Prefix { return { type } }
 / EmptyLhsTerm { return { type: "_" } }

RhsStateCharSeq
 = c:RhsStateChar s:RhsStateCharSeq { return [c].concat(s) }
 / c:RhsStateChar { return [c] }

RhsStateChar
 = TerminatedVecExpr
 / char:[0-9A-Za-z_] { return { type: "char", char } }
 / "\\" char:. { return { type: "char", char } }



Rate
 = "(" _ r:Float _ ")" { return { rate: parseFloat(r) } }
 / "" { return {} }

Command
 = "{" command:[^\}]* "}" { return { command } }
 / "" { return {} }

Key
 = "'\\" key:. "'" { return { key } }
 / "'" key:. "'" { return { key } }
 / "" { return {} }

Reward
 = "<" _ r:SignedInteger _ ">" { return { reward: parseInt(r) } }
 / "" { return {} }

Sound
 = "#" sound:[^#]* "#" { return { sound } }
 / "" { return {} }

Caption
 = "\"" caption:[^\"]* "\"" { return caption }
 / "" { return {} }


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

_sep
 = [ \t\n\r]+

_ "whitespace"
  = [ \t\n\r]*

