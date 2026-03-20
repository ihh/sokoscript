# SokoScript Architecture

This document describes the internal architecture of SokoScript: how grammar text becomes a running simulation, and why each piece is designed the way it is. It is written for someone who wants to understand the codebase deeply enough to modify it.

## 1. Overview

SokoScript is a framework for building 2D grid-based games from declarative pattern-matching rules. The core pipeline is:

```
Grammar text
    |
    v
PEG Parser (grammar.pegjs -> grammar.js)
    |
    v
AST (array of rule objects)
    |
    v
Compilation Pipeline (gramutil.js)
    makeGrammarIndex()  -- index rules by subject type, resolve inheritance
    expandInherits()    -- expand type inheritance, create alternative patterns
    compileTypes()      -- convert type names to integer indices, compute rates
    |
    v
Compiled Grammar (types[], transform[][], rateByType[], syncTransform[], ...)
    |
    v
Board (board.js)
    cell[]              -- flat array of {type, state, meta} objects
    byType[]            -- RangeCounter per type for O(log n) random cell selection
    byID{}              -- cell identity tracking
    |
    v
Evolution Loop
    nextRule()          -- sample next async event (exponential timing)
    evolveToTime()      -- advance clock, interleave sync rules
    _traceApplyRule()   -- match LHS, compute RHS, apply updates, record trace
```

The design is driven by two constraints: **determinism** (identical seeds and inputs must produce identical evolution) and **performance** (pattern matching and state computation must be fast enough for real-time simulation at large board sizes).


## 2. Parsing

**File:** `src/grammar.pegjs` (compiled to `src/grammar.js` via `npm run build-parser`)

The grammar is defined as a PEG (Parsing Expression Grammar) using the PEG.js format. The parser is generated at build time and imported as a module.

### Input

Grammar text consisting of rules separated by `.` (period), with optional `//` comments:

```
x _ : _ x.
bee/? >F> _ : _ bee/$#1, rate=5.
child = parent1, parent2.
```

### Output AST

The parser produces an array of rule objects. There are three types:

**Transform rules** (the core game logic):
```js
{
  type: "transform",
  lhs: [                          // left-hand side: pattern to match
    { type: "x" },                // subject cell (first term)
    { type: "_" }                 // neighbor cell
  ],
  rhs: [                          // right-hand side: replacement
    { type: "_" },
    { type: "x" }
  ],
  rate: 1000000,                  // micro-Hertz (1 Hz = 1000000)
  // optional: sync, command, key, score, sound, caption
}
```

**Inheritance rules:**
```js
{ type: "inherit", child: "child", parents: ["parent1", "parent2"] }
```

**Comments:**
```js
{ type: "comment", comment: " some text" }
```

### Validation

The parser performs inline validation during parsing (not as a separate pass):

- **LHS validation:** State references (`$#n`, `$g#n`) only reference characters that have been matched by earlier terms in the LHS. This is checked incrementally as terms are parsed, tracking how many state characters each term has matched.
- **RHS validation:** RHS terms can only reference LHS groups that exist (`$1` requires at least one LHS term). The `~n` ID tag cannot duplicate group references.
- **Inheritance validation:** Circular inheritance is detected and rejected at parse time.
- **Attribute validation:** Duplicate attributes on a single rule are rejected. `rate` and `sync` are mutually exclusive.

### Rate encoding

Rates are parsed as fixed-point numbers with 6 decimal places of precision, stored internally in micro-Hertz (so `rate=1` becomes `1000000`, `rate=0.5` becomes `500000`). This avoids floating-point issues in rate arithmetic.

### LHS term structure

Each LHS term can have:
- `type` -- string type name (or `"_"` for empty, `"?"` for unknown)
- `state` -- array of state matchers: literal chars, `{op:"wild"}`, `{op:"any"}`, `{op:"class",chars:[...]}`, `{op:"negated",chars:[...]}`, or computed expressions
- `addr` -- addressing expression: `{op:"absdir",dir:"N"}`, `{op:"reldir",dir:"F"}`, `{op:"neighbor",arg:...}`, `{op:"cell",arg:...}`
- `op` -- for special terms: `"any"` (wildcard `*`), `"negterm"` (negation `^`), `"alt"` (alternatives `(a|b)`)

### RHS term structure

Each RHS term can be:
- `{type:"typename", state:[...]}` -- new cell of given type with computed state
- `{op:"group", group:n}` -- copy LHS term n as-is
- `{op:"prefix", group:n, state:[...]}` -- copy type from LHS term n, replace state


## 3. Compilation Pipeline

**File:** `src/gramutil.js`

The compilation pipeline transforms the flat AST into an indexed, optimized structure suitable for the evolution loop. It has three stages.

### Stage 1: `makeGrammarIndex(rules)`

Scans all rules and builds:

- **`types[]`** -- ordered list of type names. `"_"` (empty) is always index 0; `"?"` (unknown) is always last. Types are discovered in order of first appearance.
- **`typeIndex{}`** -- reverse map from type name to index.
- **`transform{}`** -- map from subject type name to array of transform rules. Only async rules (no `sync` attribute).
- **`syncTransform{}`** -- nested map: `syncTransform[syncRate][subjectType]` -> array of sync rules.
- **`ancestors{}`** -- for each type with parents, the transitive closure of all ancestor types.
- **`descendants{}`** -- inverse of ancestors: for each type, all types that inherit from it.

### Stage 2: `expandInherits(index)`

Two things happen here:

**Alternative expansion:** For every rule whose LHS references a type that has descendants, the LHS term is replaced with an `{op:"alt"}` node listing the original type plus all descendants. This means a rule matching `animal` will automatically also match `bee`, `ant`, etc. Duplicate alternatives (by serialized form) are deduplicated.

Only non-subject LHS terms are expanded this way. The subject term (position 0) keeps its original type -- inheritance for the subject is handled separately.

**Inheritance propagation:** For each type, its rule list is extended with rules inherited from all ancestors. Inherited rules have their subject type rewritten to the child type (via `replaceSubjectType`). Rules are appended in ancestor order, so a child's own rules take priority (they appear first and are tried first).

### Stage 3: `compileTypes(rules)`

This is the main entry point called by `Board.initGrammar()`. It calls `makeGrammarIndex` then `expandInherits`, then:

1. **Converts type names to indices** in all LHS/RHS terms (via `compileTerm`). After this, `term.type` is an integer, not a string.

2. **Reorganizes transforms into arrays indexed by type number** instead of maps keyed by type name. `transform[typeIndex]` is an array of rules for that type.

3. **Computes async rate fields:**
   - `rule.rate_Hz` (BigInt) -- the rule's rate rounded up to the nearest integer Hz. Used for random event selection.
   - `rule.acceptProb_leftShift30` (integer) -- the fractional part of the rate, encoded as a 30-bit probability. After selecting a rule, a random number is compared against this to accept or reject, giving micro-Hz resolution without floating point.
   - Rules with `key` or `command` attributes get `rate_Hz = 0` -- they only fire from player input.

4. **Computes per-type aggregate rates:** `rateByType[typeIndex]` (BigInt) is the sum of `rate_Hz` across all async rules for that type. This is used to weight random cell selection by type.

5. **Computes sync scheduling data:**
   - `syncPeriods[]` -- BigInt tick counts between sync events for each sync rate.
   - `syncCategories[]` -- indices into `syncPeriods`, in reverse order (so faster-period categories are processed later, which matters for interleaving).
   - `typesBySyncCategory[n]` -- which type indices have rules in sync category n.
   - `syncCategoriesByType[typeIndex]` -- which sync categories apply to a given type.

6. **Collects command/key mappings:** `command[typeIndex][commandName]` and `key[typeIndex][keyName]` map to arrays of rules that fire on player input.


## 4. Board State

**File:** `src/board.js`

### The `Board` class

The board is a toroidal (wrapping) 2D grid of size `N x N` where `N` must be a power of 2.

**Core state:**
- `cell[]` -- flat array of `N*N` cell objects, each `{type, state, meta}`:
  - `type` (integer) -- index into `grammar.types[]`
  - `state` (string) -- variable-length sequence of encoded characters (see Section 8)
  - `meta` (object, optional) -- metadata including `id` (unique cell identity), `owner` (player ownership), `score`
- `byType[]` -- array of `RangeCounter` instances, one per type. Tracks which cell indices contain each type.
- `byID{}` -- map from string ID to cell index. Maintained by `setCellByIndex()`.
- `time` (BigInt) -- current board time in ticks (2^32 ticks per second).
- `lastEventTime` (BigInt) -- time of last async event. Used to compute waiting time for next event.
- `rng` -- `MersenneTwister` instance.
- `grammar` -- compiled grammar object (output of `compileTypes()`).
- `trace` -- `TraceBuffer` ring buffer for debug logging.

**Coordinate system:**
```
index = ((y % N + N) % N) * N + ((x % N + N) % N)
```
Coordinates wrap toroidally: `(x + N, y)` and `(x, y + N)` refer to the same cell. The double-modulo `((v % N + N) % N)` handles negative coordinates correctly.

### `RangeCounter`

A data structure for maintaining a set of integers in `[0, n)` where `n` is a power of 2:

```
Operations:
  add(val)         -- O(log n)
  remove(val)      -- O(log n)
  total()          -- O(1)
  kthElement(k)    -- O(log n)
```

Internally, it is a segment tree. `levelCount[k][m]` counts how many set members have `floor(val / 2^k) == m`. The top level `levelCount[log2(n)][0]` holds the total count. To find the k-th element, the tree is descended from top to bottom, choosing left or right child based on accumulated counts.

This is critical for performance: the evolution loop needs to (a) know how many cells of each type exist (O(1) via `total()`) and (b) pick a uniformly random cell of a given type (O(log n) via `kthElement()`). A naive approach would require maintaining separate lists per type, with O(n) insertion/removal when cells change type.

### Cell identity (`byID`)

Cells can have a persistent identity via `meta.id`. The `byID` map tracks at most one cell per ID. When a cell changes (via `setCellByIndex`):
- If the old cell had an ID that pointed to this index, and the new cell doesn't have that ID, the mapping is deleted.
- If the new cell has an ID, any previous cell with that ID loses it (at most one cell per ID).

This enables player-controlled agents: the player issues commands to a specific cell ID, and the system locates that cell on the board via `byID`.

### Serialization

`toJSON()` produces a snapshot including time, RNG state, grammar source, type list, and cell array. Cells are encoded compactly: a bare integer for type-only cells, or `[typeIndex, state, meta]` for cells with state/metadata. The type list includes "unknown" types -- cells whose type name doesn't appear in the current grammar but was present when the board was saved.


## 5. Pattern Matching

**File:** `src/engine.js`

### The `Matcher` class

A `Matcher` is instantiated for a specific board position `(x, y)` and direction `dir`. It attempts to match the entire LHS of a rule against the board.

**State accumulated during matching:**
- `termAddr[]` -- the `[dx, dy]` offset (relative to the subject cell) for each matched LHS term
- `termCell[]` -- the actual cell object at each matched position
- `termTailStart[]` -- for each term, the index where `*` (match-remaining) starts in the state string
- `failed` -- set to `true` on first mismatch; once failed, all subsequent terms auto-fail

Matching proceeds left-to-right through LHS terms via `matchLhsCell()`:

```
rule.lhs.reduce(
    (matcher, term, pos) => matcher.matchLhsCell(term, pos),
    new Matcher(board, x, y, dir)
)
```

### Address computation

The first LHS term (the "subject") is always at offset `(0, 0)`. Subsequent terms compute their position relative to the previous term's position:

| Address type | Syntax | Computation |
|---|---|---|
| Absolute direction | `>N>`, `>E>`, `>S>`, `>W>` | Fixed unit vector added to previous term's position |
| Relative direction | `>F>`, `>R>`, `>B>`, `>L>` | Unit vector rotated by the matcher's `dir`, then added |
| By state char | `>1>`, `>2#3>` | Read a state character from a previously matched cell, interpret as vector, add to previous position |
| By expression | `>@vec(1,2)>` | Evaluate expression to get vector, use as absolute position |
| Neighbor-relative | `>+expr>` | Evaluate expression to get vector, add to previous position |
| Default (no address) | (space) | Same as `>F>` (forward from previous) |

All vector operations use precomputed lookup tables (see Section 9), so address computation is O(1) table lookups.

### Term matching (`matchLhsTerm`)

For each term at its computed position, the matcher checks:

1. **`op` dispatch:**
   - `"any"` -- always matches (the `*` wildcard)
   - `"negterm"` -- matches if the inner term does NOT match
   - `"alt"` -- matches if ANY alternative matches
   - Otherwise, proceed to type/state matching

2. **Type matching:** `term.type` (integer) must equal `cell.type`. If not, the match fails.

3. **State matching:** Each state character in the pattern is checked against the corresponding character in the cell's state string:
   - Literal character -- exact match
   - `{op:"wild"}` (`?`) -- matches any single character
   - `{op:"any"}` (`*`) -- matches all remaining characters (terminates matching, always succeeds)
   - `{op:"class",chars:[...]}` -- character must be in the set
   - `{op:"negated",chars:[...]}` -- character must NOT be in the set
   - Computed expression -- the expression is evaluated (via `computeStateChar`) and compared

   If the pattern has no `*` at the end, the state string length must exactly match the pattern length.

### State expression evaluation (`computeStateChar`)

State expressions form a tree of operations. Each evaluates to a single character:

- **`char`** -- literal character
- **`state`** -- read character at position `char` from the state string of LHS group `group`
- **`tail`** -- read remaining characters from a group's state string (returns a substring, used in RHS)
- **`location`** -- encode the address of LHS group `group` as a vector character
- **`reldir`/`absdir`** -- direction encoded as a vector character
- **`integer`** -- integer mod 94 encoded as a character
- **`vector`** -- 2D vector encoded as a character
- **`add`/`sub`** -- cyclic integer arithmetic on characters
- **`+`/`-`** -- vector addition/subtraction on characters
- **`*`** -- matrix multiplication (rotation/reflection) on a vector character
- **`clock`/`anti`** -- neighborhood rotation (clockwise/counterclockwise scan of cells at a given radius)

All of these operations resolve to single table lookups in `lookups.charPermLookup` (see Section 9).


## 6. Rule Application

**File:** `src/engine.js`

### `transformRuleUpdate(board, x, y, dir, rule)`

This is the core function that determines what changes a rule would make, without applying them:

1. Run `matchLhs()` to match the rule's LHS against the board at `(x, y, dir)`.
2. If matching fails, return `null`.
3. For each RHS term at position `pos`, call `matcher.newCellUpdate(term, pos, score)` to compute the new cell value and its board coordinates.
4. Strip duplicate metadata: if two RHS terms reference the same LHS group, the second one doesn't get metadata (to avoid duplicate IDs).
5. Return an array of `[x, y, {type, state, meta}]` updates.

### `newCell(term, score)`

Computes the new cell value for a single RHS term:

- **`{op:"group", group:n}`** -- copies the cell from LHS position `n` exactly (type, state, and metadata).
- **`{op:"prefix", group:n, state:[...]}`** -- copies the type from LHS position `n`, but replaces the state with a freshly computed value.
- **Typed term `{type:n, state:[...]}`** -- creates a new cell with the given type index and computed state.

State characters in the RHS are evaluated using the same `computeStateChar` as the LHS, allowing expressions like `$1#2` (character 2 from LHS group 1) or `@add($#1,$#2)` (sum of two state characters).

### Metadata and ID propagation

The `~n` syntax in the RHS transfers metadata (including `id`) from LHS group `n` to the new cell. This is how identity follows a moving agent: if a `bee` moves from cell A to cell B, the rule's RHS uses `~1` to carry the bee's ID to the new position.

Score is accumulated on the subject cell's metadata: `meta.score = (meta.score || 0) + rule.score`.

### `applyTransformRule(board, x, y, dir, rule)`

A convenience wrapper that calls `transformRuleUpdate` and then applies all updates via `board.setCell()`. Returns `true` if the rule matched and was applied.


## 7. Evolution Loop

**File:** `src/board.js`

The evolution loop advances the board from its current time to a target time, firing async and sync rules along the way.

### Async rules: `nextRule(maxWait)`

The async evolution model treats each rule instance (a specific rule applied to a specific cell) as an independent Poisson process. The combined rate across all cells and rules determines the overall event rate.

**Sampling algorithm:**

1. **Compute total rate.** For each type, `rateByType[type]` (BigInt, in Hz) is multiplied by the count of cells of that type. These are summed to get `totalRate`.

2. **Sample waiting time.** An exponentially-distributed waiting time is generated using the inverse-CDF method:
   ```
   wait = -ln(U) / totalRate
   ```
   where `U` is a uniform random 32-bit integer. The `ln` is computed by `fastLn_leftShift26` (see Section 9). The result is in units of ticks (2^32 per second). If `wait > maxWait`, no event occurs and `null` is returned.

3. **Select type.** A second random number (BigInt, up to 52 bits) selects a type proportional to `typeRates[type]`.

4. **Select cell.** Within the chosen type, the cell index within the type's rate contribution determines which specific cell. The k-th cell of that type is found via `byType[type].kthElement(k)` in O(log n).

5. **Select rule.** Within the chosen type's rules, iterate through rules accumulating rates to find which rule was selected.

6. **Accept/reject.** Because rates are rounded up to integer Hz, the fractional part is recovered via rejection sampling: a random number is compared against `rule.acceptProb_leftShift30`. Rejected events return `null` (the time still advances but nothing happens).

7. **Select direction.** The top 2 bits of the accept/reject random number select a random cardinal direction (N/E/S/W), giving 4-fold rotational symmetry to all rules.

### The BigInt time system

Time is measured in "ticks" at 2^32 ticks per second, stored as a BigInt. This gives sub-nanosecond resolution while avoiding floating-point drift.

Why 2^32? The system needs to handle boards up to 2^11 x 2^11 cells with rates up to 1000 Hz. The maximum aggregate rate is ~1000 * 2^22 ~= 2^32 events per second. The minimum meaningful time interval (one event at max rate) is ~2^{-32} seconds, which is exactly one tick.

The waiting time formula in integer ticks:
```
T = 64 * W / R
```
where `W = fastLn_leftShift26_max - fastLn_leftShift26(rng.int())` is the shifted log value, and `R = totalRate` in Hz. The factor 64 comes from `Q * S^2 / F` where Q=2^10 (max rate), S=2^11 (max board size), F=2^26 (the shift in the log approximation).

### Sync rules: `evolveToTime(t)`

Sync rules fire at fixed periods. `evolveToTime` interleaves async and sync execution:

1. Find the next sync event time (the earliest sync period boundary after the current time).
2. Run async evolution up to that time (via `evolveAsyncToTime`).
3. Collect all sync rules that fire at this time across all relevant types and cells.
4. Apply a Knuth shuffle (Fisher-Yates) to randomize the order.
5. Apply each sync rule with a random direction.
6. Repeat until the target time is reached.

The Knuth shuffle ensures that sync rules are applied in a uniformly random order, preventing systematic bias from array ordering.

### Soft vs. hard stops

`evolveAsyncToTime(t, hardStop)` has two modes:

- **Hard stop** (`hardStop=true`): The clock advances to exactly time `t`, even if the last event happened earlier. Used when there is a concrete event at time `t` (a sync rule, a player move).
- **Soft stop** (`hardStop=false`): The clock stops at the last event *before* `t`, and the RNG state is rewound to before the failed `nextRule` call. This allows consistent resumption: if more events (e.g., player moves) arrive between `t` and the next natural event, the simulation can incorporate them without diverging.

RNG rewinding works by saving `this.rng.mt` (the full 624-word state array) before calling `nextRule`, and restoring it if the event would have occurred past the target time.

### Player input: `processMove(move)`

Player moves are processed between evolution steps in `evolveAndProcess`:

1. Sort moves by time.
2. For each move, evolve the board to the move's time (hard stop), then process the move.
3. After all moves, evolve to the final target time.

Move types:
- **`command`** -- find the cell by ID (`byID[id]`), look up rules in `grammar.command[type][command]` or `grammar.key[type][key]`, apply the first matching rule.
- **`write`** -- directly set a cell's type/state/metadata (with ownership checks).
- **`grammar`** -- replace the board's grammar entirely (owner only).


## 8. State Encoding

SokoScript encodes cell state as strings of printable ASCII characters (code points 33-126), giving 94 possible values per character position.

### Integer encoding

Characters encode integers mod 94:
```
char code 33 ('!') = 0
char code 34 ('"') = 1
...
char code 126 ('~') = 93
```

Arithmetic wraps cyclically: `(93 + 1) mod 94 = 0`.

### Vector encoding

2D vectors in the range `[-4, +4] x [-4, +4]` are encoded as single characters:
```
char = firstVecChar + (x + 4) + (y + 4) * 9
```
where `firstVecChar = 40` (code point for `(`). This maps the 81 possible vectors to characters in the range `(` through `x`. Vectors outside this range encode to `~` (a sentinel indicating out-of-range).

The vector `(0, 0)` encodes to char code `40 + 4 + 4*9 = 80` which is `P`.

### Matrix transform encoding

The six matrices (F=identity, R=rotate90, B=rotate180, L=rotate270, H=horizontal flip, V=vertical flip) are applied to vector-encoded characters via lookup tables. A matrix multiplication `%R * vec_char` becomes a single table lookup.

### State strings

A cell's state is a variable-length string of these encoded characters. Position matters: character 1 might encode a direction, character 2 a counter, character 3 an inventory item. The grammar rules define what each position means implicitly through how they match and transform state characters.


## 9. Lookup Tables

**File:** `src/lookups.js`

All character-level operations are precomputed into lookup tables at module load time. This is the key performance optimization: pattern matching and state computation involve many character operations per rule application, and table lookups are O(1) with excellent cache behavior.

### What is precomputed

**`charPermLookup`** -- nested objects for O(1) two-argument character operations:
- `matMul[matrix][char]` -- apply matrix transform (F/R/B/L/H/V) to a vector character
- `vecAdd[char1][char2]` -- add two vector characters
- `vecSub[char1][char2]` -- subtract two vector characters
- `intAdd[char1][char2]` -- add two integer characters (mod 94)
- `intSub[char1][char2]` -- subtract two integer characters (mod 94)
- `rotate.clock[char]` / `rotate.anti[char]` -- neighborhood rotation (clockwise/counterclockwise traversal of cells at a given Manhattan radius)

**`charLookup`** -- single-argument lookups:
- `absDir[dir]` -- direction name ('N','E','S','W') to vector character

**`charClassLookup`** -- precomputed neighborhoods:
- `moore[char]` / `neumann[char]` -- string of all characters that are Moore/von Neumann neighbors of the given vector character (used for neighborhood-based pattern matching)

**`charVecLookup`** -- character to `[x, y]` array (inverse of `vec2char`)

**`charRotLookup`** -- vector character to rotation angle in degrees (used by the UI for icon rotation)

### Memory cost

Each two-argument table is 94 * 94 = 8,836 entries. With 6 such tables (matMul has 6 sub-tables, vecAdd/Sub/intAdd/Sub are 94 sub-tables each), total memory is modest (hundreds of KB). The tables are computed once at module load and never modified.

### Why this matters

Consider matching a rule like `bee/$#1 >+$#2> ant/$#1` against the board. This requires:
1. Read state char 1 from the bee cell
2. Compare it against the pattern
3. Compute `$#2` (read state char 2)
4. Use it as a vector to compute the neighbor address (vector addition)
5. Read the ant cell at that address
6. Read its state char 1 and compare

Without lookup tables, each of these would involve `charCodeAt`, arithmetic, modular reduction, `fromCharCode`. With tables, each is a single object property access.


## 10. Debug Trace

**File:** `src/trace.js`

### `TraceBuffer`

A fixed-capacity ring buffer (default 2000 entries) that records every rule application:

```js
{
  type: 'async' | 'sync' | 'move',   // how the rule was triggered
  time: '...',                         // BigInt time as string
  x, y,                               // subject cell coordinates
  dir,                                 // direction character
  ruleText: 'bee _ : _ bee.',          // human-readable rule text
  subjectType: 'bee',                  // subject type name
  before: [{x, y, type, state}, ...],  // cells before update
  after: [{x, y, type, state}, ...],   // cells after update
  seq: 42                              // monotonic sequence number
}
```

### How it hooks in

All rule applications go through `Board._traceApplyRule(category, x, y, dir, rule)`:

1. Call `transformRuleUpdate()` to compute what would change (without applying yet).
2. If the rule didn't match, return `false`.
3. Snapshot the "before" state of affected cells.
4. Apply all updates via `setCell()`.
5. Snapshot the "after" state.
6. Push a trace entry with the rule text (serialized back from the compiled AST via `serializeRuleWithTypes`), before/after snapshots, and metadata.
7. Return `true`.

The ring buffer means only the most recent 2000 events are retained, preventing unbounded memory growth during long simulations. The `seq` counter is monotonically increasing even as old entries are overwritten, so consumers can detect gaps.

An `init` entry is pushed when the board is first created or loaded, recording the board size and grammar source.


## 11. Determinism

SokoScript guarantees that given the same grammar, board state, RNG seed, and sequence of player inputs, the simulation produces identical results. This is critical for replay, networking, and testing.

### Mersenne Twister RNG

**File:** `src/MersenneTwister.js`

The MT19937 PRNG produces 32-bit unsigned integers with a period of 2^19937-1. Its full state is 624 32-bit words plus an index.

**State serialization:** `toString()` encodes the 625-integer state (index + 624 words) as a base64 string via `numberToBase64.js`. `newFromString()` reconstructs the RNG from this encoding. This allows exact save/restore of RNG state as part of board serialization.

**RNG rewinding:** In `evolveAsyncToTime`, the RNG's `mt` array is saved before calling `nextRule`. If the event would occur past the target time, the array is restored, effectively undoing the random number draws. This is how "soft stops" maintain determinism across interruptions.

### Canonical JSON

**File:** `src/canonical-json.js`

`Board.toString()` uses a canonical JSON serializer that produces deterministic key ordering. This ensures that two boards with identical state produce byte-identical JSON, enabling hash-based integrity checks.

### Integer arithmetic

All timing arithmetic uses BigInt to avoid floating-point rounding. The `fastLn_leftShift26` function is a piecewise-linear approximation of `ln(x)` using only integer operations:

1. `fastLog2Floor(x)` finds the position of the highest set bit using a precomputed 256-entry table.
2. The result is shifted left by 26 bits, and the remaining bits of `x` are used as the fractional part (linear interpolation between powers of 2).
3. The base-2 log is converted to natural log by multiplying by `ln(2)` (stored as a 21-bit fixed-point integer) and shifting.

This avoids `Math.log()` which could theoretically produce platform-dependent results, though in practice JavaScript's `Math.log` is well-specified. The real benefit is staying in integer-land for the entire timing calculation.

### Knuth shuffle

Sync rule ordering uses a Fisher-Yates shuffle driven by the same RNG, so the order of sync rule application is deterministic given the RNG state.

### Random integer generation

`randomInt(rng, max)` and `randomBigInt(rng, max)` use the multiply-and-shift method: `(max * rng.int()) >> 32`. For BigInt values exceeding 32 bits, multiple 32-bit random words are concatenated. This avoids modulo bias while staying efficient.
