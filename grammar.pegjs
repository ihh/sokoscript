RuleSet
 = r:Rule _ "." _ s:RuleSet { return [r].concat(s) }
 / r:Rule _ "." _ { return [r] }
 / r:Rule _ { return [r] }

Rule
= lhsDir:LhsDir _ ":" _ rhs:Rhs _ rate:Rate _ command:Command _ reward:Reward _ sound:Sound _ caption:Caption
 { return { ...lhsDir, rhs, ...rate, ...command, ...reward, ...sound, ...caption } }

LhsDir
 = t:Subject _ dir:AbsDir _ u:LhsTerm s:LhsNbrSeq { return { prefix: t.prefix, lhs: [{ term: t.term }, { dir, term: u.term }].concat(s) } }
 / t:Subject _ dir:AbsDir _ u:LhsTerm { return { prefix: t.prefix, lhs: [{ term: t.term }, { dir, term: u.term }] } }
 / t:Subject _sep u:LhsTerm s:LhsNbrSeq { return { prefix: t.prefix, lhs: [{ term: t.term }, { term: u.term }].concat(s) } }
 / t:Subject _sep u:LhsTerm { return { prefix: t.prefix, lhs: [{ term: t.term }, { term: u.term }] } }
 / t:Subject { return { prefix: t.prefix, lhs: [{ term: t.term }] } }

AbsDir
 = ">" d:[nsewNSEW] ">" { return d.toUpperCase() }

RelDir
 = ">" d:[fblrFBLR] ">" { return d.toUpperCase() }

LhsNbrSeq
 = _ dir:RelDir _ t:WildLhsTerm s:LhsNbrSeq { return [{ dir, term: t.term }].concat(s) }
 / _ dir:RelDir _ t:WildLhsTerm { return [{ dir, term: t.term }] }
 / _sep t:WildLhsTerm s:LhsNbrSeq { return [{ term: t.term }].concat(s) }
 / _sep t:WildLhsTerm { return [{ term: t.term }] }

Subject
 = prefix:Prefix "/" term:LhsTermCharSeq { return { prefix, term: text() } }
 / Prefix { return { prefix: text(), term: text() } }
 / EmptyLhsTerm { return { prefix: "_", term: "_" } }

WildLhsTerm
 = "*" { return { term: text() } }
 / LhsTerm

LhsTerm
 = Prefix "/" LhsTermCharSeq { return { term: text() } }
 / Prefix { return { term: text() } }
 / EmptyLhsTerm { return { term: text() } }
 
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
 = "$" PositiveInteger { return { term: text() } }
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
