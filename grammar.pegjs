RuleSet
 = r:Rule _ "." _ s:RuleSet { return [r].concat(s) }
 / r:Rule _ "." _ { return [r] }
 / r:Rule _ { return [r] }

Rule
 = lhs:Lhs _ ":" _ rhs:Rhs _ rate:Rate _ command:Command _ reward:Reward _ sound:Sound _ caption:Caption
 !{ return rhs.filter ((t) => t.group > lhs.length).length }
 { return { lhs, rhs, ...rate, ...command, ...reward, ...sound, ...caption } }

Lhs
 = t:Subject _ dir:AbsDir _ u:LhsTerm s:LhsNbrSeq { return [t, { dir, ...u }].concat(s) }
 / t:Subject _ dir:AbsDir _ u:LhsTerm { return [t, { dir, ...u }] }
 / t:Subject _sep u:LhsTerm s:LhsNbrSeq { return [t, u].concat(s) }
 / t:Subject _sep u:LhsTerm { return [t, u] }
 / t:Subject { return [t] }

AbsDir
 = ">" d:[nsewNSEW] ">" { return d.toUpperCase() }

RelDir
 = ">" d:[fblrFBLR] ">" { return d.toUpperCase() }

LhsNbrSeq
 = _ dir:RelDir _ t:WildLhsTerm s:LhsNbrSeq { return [{ dir, ...t }].concat(s) }
 / _ dir:RelDir _ t:WildLhsTerm { return [{ dir, ...t }] }
 / _sep t:WildLhsTerm s:LhsNbrSeq { return [t].concat(s) }
 / _sep t:WildLhsTerm { return [t] }

Subject
 = type:Prefix "/" state:LhsTermCharSeq { return { type, state } }
 / type:Prefix { return { type } }
 / EmptyLhsTerm { return { type: "_" } }

WildLhsTerm
 = "*" { return { wild: "*" } }
 / LhsTerm

LhsTerm
 = type:Prefix "/" state:LhsTermCharSeq { return { type, state } }
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

LhsTermCharSeq
 = LhsTermChar LhsTermCharSeq
 / LhsTermChar

InitChar
 = [a-z]

PrefixChar
 = [0-9_] / InitChar

LhsTermChar
 = DirChar / WildChar / PrefixChar

DirChar
 = [NSEWFBLR]

WildChar
 = "?"


Rhs = RhsTermSeq

RhsTermSeq
 = s:RhsTerm _ o:RhsTermSeq { return [s].concat(o); }
 / s:RhsTerm { return [s] }

RhsTerm
 = "$" g:PositiveInteger { return { group: parseInt(g) } }
 / type:Prefix "/" state:RhsTermCharSeq { return { type, state } }
 / type:Prefix { return { type } }
 / EmptyLhsTerm { return { type: "_" } }

RhsTermCharSeq
 = RhsTermChar RhsTermCharSeq
 / RhsTermChar



Rate
 = "(" _ r:PositiveInteger _ ")" { return { rate: parseInt(r) } }
 / "" { return {} }

Command
 = "{" s:[^\}]* "}" { return { command: s } }
 / "" { return {} }

Reward
 = "[" _ r:SignedInteger _ "]" { return { reward: parseInt(r) } }
 / "" { return {} }

Sound
 = "#" s:[^#]* "#" { return { sound: s } }
 / "" { return {} }

Caption
 = "\"" s:[^\"]* "\"" { return s }
 / "" { return undefined }

NonZeroInteger
  = [1-9][0-9]*

PositiveInteger
  = "+" NonZeroInteger
  / NonZeroInteger

SignedInteger
 = PositiveInteger
 / "-" NonZeroInteger
 / "0"

_sep
 = [ \t\n\r]+

_ "whitespace"
  = [ \t\n\r]*

RhsTermChar
 = DirChar / PrefixChar

