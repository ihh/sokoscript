RuleSet
 = r:Rule _ "." _ s:RuleSet { return [r].concat(s) }
 / r:Rule _ "." _ { return [r] }
 / r:Rule _ { return [r] }

Rule
= lhsDir:LhsDir _ ":" _ rhs:Rhs _ rate:Rate _ command:Command _ reward:Reward _ sound:Sound _ caption:Caption
 { return { ...lhsDir, rhs, ...rate, ...command, ...reward, ...sound, ...caption } }

LhsDir
 = t:Subject _ d:Dir _ s:LhsTermSeq { return { prefix: t.prefix, dir: d, lhs: [t.term].concat(s) } }
 / t:Subject _ d:Dir { return { prefix: t.prefix, dir: d, lhs: [t.term] } }
 / t:Subject _sep s:LhsTermSeq { return { prefix: t.prefix, lhs: [t.term].concat(s) } }
 / t:Subject { return { prefix: t.prefix, lhs: [t.term] } }

Dir
 = ">" d:[nsewNSEW] ">" { return d.toLowerCase() }

LhsTermSeq
 = t:WildLhsTerm _sep s:LhsTermSeq { return [t].concat(s); }
 / t:WildLhsTerm { return [t] }

Subject
 = p:Prefix "/" s:LhsTermCharSeq { return { prefix: p.toLowerCase(), term: text().toLowerCase() } }
 / Prefix { return { prefix: text().toLowerCase(), term: text().toLowerCase() } }
 / EmptyLhsTerm { return { prefix: "_", term: "_" } }

WildLhsTerm
 = "*"
 / LhsTerm

LhsTerm
 = Prefix LhsTermCharSeq { return text().toLowerCase() }
 / Prefix { return text().toLowerCase() }
 / EmptyLhsTerm
 
 EmptyLhsTerm
 = "_"

Prefix
 = InitChar PrefixCharSeq
 / InitChar

PrefixCharSeq
 = PrefixChar PrefixCharSeq
 / PrefixChar

LhsTermCharSeq
 = LhsTermChar LhsTermCharSeq
 / LhsTermChar

InitChar
 = [A-Za-z]

PrefixChar
 = [0-9_] / InitChar

LhsTermChar
 = DirChar / WildChar / PrefixChar

DirChar
 = [!<>~]

WildChar
 = "?"


Rhs = RhsTermSeq

RhsTermSeq
 = s:RhsTerm _ o:RhsTermSeq { return [s].concat(o); }
 / s:RhsTerm { return [s] }

RhsTerm
 = "$" PositiveInteger { return text() }
 / LhsTerm



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
