# SokoScript API Reference

## Table of Contents

- [Board Class](#board-class)
- [Move Format](#move-format)
- [Board JSON Format](#board-json-format)
- [Grammar Compilation](#grammar-compilation)
- [Serialization](#serialization)
- [TraceBuffer](#tracebuffer)
- [Engine Functions](#engine-functions)
- [Lookup Exports](#lookup-exports)

---

## Board Class

**Module:** `src/board.js`

The `Board` class manages a toroidal 2D grid, grammar compilation, cell state, deterministic RNG, and time evolution.

### Constructor

```js
/**
 * @param {Object} [opts] - Options passed to initFromJSON(). See Board JSON Format.
 *   Commonly used fields:
 *     opts.size    {number}  - Board side length (must be power of 2, default 64)
 *     opts.grammar {string}  - Grammar source text
 *     opts.seed    {number}  - RNG seed (default 5489)
 *     opts.cell    {Array}   - Cell array (see Board JSON Format)
 *     opts.types   {string[]} - Type name list for decoding opts.cell
 */
new Board(opts)
```

**Example: create a blank board with a grammar**

```js
import { Board } from './board.js';

const board = new Board({
  size: 16,
  grammar: 'x _ : _ x.'
});
```

### Initialization and Grammar

#### `initFromJSON(json)`

Re-initializes the board from a JSON object (same shape as `toJSON()` output). Resets all cells, RNG state, time, and grammar. Called internally by the constructor.

```js
/** @param {Object} json - Board JSON (see Board JSON Format) */
board.initFromJSON(json)
```

#### `initGrammar(grammar)`

Parses and compiles a grammar string, then resets all cells to empty and rebuilds the type counters. Does **not** restore cell content.

```js
/** @param {string} grammar - Grammar source text */
board.initGrammar(grammar)
```

#### `updateGrammar(grammar)`

Updates the grammar while preserving existing cell content. Internally calls `initFromJSON` with the current board state merged with the new grammar.

```js
/** @param {string} grammar - New grammar source text */
board.updateGrammar(grammar)
```

### Serialization

#### `toJSON()`

Returns a plain object representing the full board state, suitable for `JSON.stringify()`. See [Board JSON Format](#board-json-format) for the schema.

```js
/** @returns {Object} Board state as a JSON-serializable object */
board.toJSON()
```

#### `toString()`

Returns a canonical (deterministic) JSON string of the board state.

```js
/** @returns {string} Canonical JSON string */
board.toString()
```

#### `initFromString(str)`

Parses a JSON string and calls `initFromJSON()`.

```js
/** @param {string} str - JSON string (as produced by toString()) */
board.initFromString(str)
```

### Cell Access

#### `getCell(x, y)`

Returns the cell object at coordinates `(x, y)`. Coordinates wrap toroidally.

```js
/**
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {{ type: number, state: string, meta?: Object }} Cell object
 *   - type: integer index into board.grammar.types
 *   - state: string of encoded state characters
 *   - meta: optional metadata (id, owner, score, etc.)
 */
board.getCell(x, y)
```

#### `setCell(x, y, value)`

Sets the cell at `(x, y)`. Updates type counters and ID index. State is truncated to `maxStateLen` (64) characters.

```js
/**
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {{ type: number, state: string, meta?: Object }} value - New cell value
 */
board.setCell(x, y, value)
```

#### `setCellTypeByName(x, y, type, state, meta)`

Sets a cell using the type's string name rather than its numeric index. If the type is not in the grammar, the cell is stored as the "unknown" type with the name in `meta.type`.

```js
/**
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Type name (e.g. "bee", "_")
 * @param {string} [state] - State string (default "")
 * @param {Object} [meta] - Metadata object
 */
board.setCellTypeByName(x, y, type, state, meta)
```

#### `getCellDescriptorString(x, y)`

Returns a human-readable string describing the cell, e.g. `"bee/NE"` or `"rock"`.

```js
/** @param {number} x @param {number} y @returns {string} */
board.getCellDescriptorString(x, y)
```

#### `getCellDescriptorStringWithCoords(x, y)`

Same as `getCellDescriptorString` but prefixed with coordinates, e.g. `"(3,7) bee/NE"`.

```js
/** @param {number} x @param {number} y @returns {string} */
board.getCellDescriptorStringWithCoords(x, y)
```

### Coordinate Conversion

#### `index2xy(index)`

Converts a flat cell array index to `[x, y]` coordinates.

```js
/** @param {number} index @returns {[number, number]} [x, y] */
board.index2xy(index)
```

#### `xy2index(x, y)`

Converts `(x, y)` coordinates to a flat array index. Coordinates wrap toroidally.

```js
/** @param {number} x @param {number} y @returns {number} */
board.xy2index(x, y)
```

There is also a standalone exported function:

```js
/** @param {number} x @param {number} y @param {number} size @returns {number} */
xy2index(x, y, size)
```

### Evolution

#### `evolveToTime(t, hardStop)`

Advances the board to time `t`, processing both asynchronous (rate-based) and synchronous (clock-based) rules. Time is a `BigInt` in units of 2^-32 seconds.

```js
/**
 * @param {BigInt} t - Target time (2^32 ticks per second)
 * @param {boolean} [hardStop] - If true, advance clock to exactly t even if
 *   no event occurs in the final interval. If false, stop the clock (and RNG)
 *   at the last event before t, allowing consistent resumption.
 */
board.evolveToTime(t, hardStop)
```

#### `evolveAsyncToTime(t, hardStop)`

Advances only asynchronous rules to time `t`. Does not process synchronous rules. Called internally by `evolveToTime`.

```js
/** @param {BigInt} t @param {boolean} [hardStop] */
board.evolveAsyncToTime(t, hardStop)
```

#### `evolveAndProcess(t, moves, hardStop)`

Evolves the board to time `t`, interleaving move processing at each move's timestamp. Moves with `time > t` are processed in chronological order; the board evolves to each move's time before applying it.

```js
/**
 * @param {BigInt} t - Target time
 * @param {Object[]} moves - Array of move objects (see Move Format)
 * @param {boolean} [hardStop]
 */
board.evolveAndProcess(t, moves, hardStop)
```

**Example: evolve for 1 second with a player move**

```js
const oneSecond = BigInt(2**32);
board.evolveAndProcess(board.time + oneSecond, [
  { type: 'command', time: board.time + oneSecond / 2n, id: 'player1', dir: 'N', command: 'move' }
]);
```

#### `nextRule(maxWait)`

Samples the next asynchronous rule event using exponential waiting times. Returns `null` if no rules are active or the wait exceeds `maxWait`.

```js
/**
 * @param {BigInt} maxWait - Maximum wait in ticks
 * @returns {{ wait: BigInt, x: number, y: number, rule: Object, dir: string } | null}
 *   - wait: ticks until event
 *   - x, y: cell coordinates of the event
 *   - rule: the compiled rule object
 *   - dir: random cardinal direction ('N','E','S','W')
 */
board.nextRule(maxWait)
```

### Move Processing

#### `processMove(move)`

Applies a single move to the board. See [Move Format](#move-format) for the supported move shapes.

```js
/** @param {Object} move - A move object */
board.processMove(move)
```

### Type Queries

#### `typesIncludingUnknowns()`

Returns all known type names plus any unknown types found on the board (stored in cell metadata).

```js
/**
 * @returns {{ types: string[], type2idx: Object.<string, number> }}
 *   - types: array of type name strings
 *   - type2idx: map from type name to index
 */
board.typesIncludingUnknowns()
```

#### `typeCountsIncludingUnknowns()`

Returns a map of type names to the number of cells of that type on the board.

```js
/** @returns {Object.<string, number>} Map of type name to count */
board.typeCountsIncludingUnknowns()
```

### Utilities

#### `getUniqueID(prefix)`

Generates a unique cell ID string not currently in use on the board.

```js
/**
 * @param {string} [prefix="cell"] - ID prefix
 * @returns {string} e.g. "cell1", "cell2", or "player1"
 */
board.getUniqueID(prefix)
```

#### `timeInSeconds()`

Returns the current board time as a floating-point number of seconds.

```js
/** @returns {number} Current time in seconds */
board.timeInSeconds()
```

### Properties

| Property | Type | Description |
|---|---|---|
| `size` | `number` | Board side length (always a power of 2) |
| `time` | `BigInt` | Current time in ticks (2^32 ticks/second) |
| `lastEventTime` | `BigInt` | Time of most recent event |
| `rng` | `MersenneTwister` | Deterministic PRNG instance |
| `cell` | `Array` | Flat array of cell objects (`size * size` elements) |
| `grammar` | `Object` | Compiled grammar (output of `compileTypes()`) |
| `grammarSource` | `string` | Original grammar source text |
| `byType` | `RangeCounter[]` | Per-type cell index sets for O(log n) sampling |
| `byID` | `Object` | Map from cell ID string to flat array index |
| `trace` | `TraceBuffer` | Ring buffer of recent rule application events |
| `owner` | `string` | Board owner identifier (for access control) |
| `maxStateLen` | `number` | Maximum state string length (default 64) |

---

## Move Format

Moves are plain objects passed to `processMove()` or `evolveAndProcess()`. Three shapes are supported:

### Command Move

Triggers command/key rules on a cell identified by its ID.

```js
{
  type: 'command',
  time: BigInt,        // When the move occurs (in ticks)
  user: string,        // User identifier (for ownership checks)
  id: string,          // Cell ID (must exist in board.byID)
  dir: string,         // Direction: 'N', 'E', 'S', or 'W'
  command: string,     // (optional) Command name matching rule's command={name} attribute
  key: string          // (optional) Key name matching rule's key={k} attribute
}
```

Exactly one of `command` or `key` should be provided.

### Write Move

Directly sets cell types/states on the board.

```js
{
  type: 'write',
  time: BigInt,
  user: string,
  cells: [
    {
      x: number,           // X coordinate (or use id instead)
      y: number,           // Y coordinate (or use id instead)
      id: string,          // (optional) Cell ID to write to (alternative to x,y)
      oldType: string,     // (optional) Only write if current type matches
      oldState: string,    // (optional) Only write if current state matches
      type: string,        // New type name
      state: string,       // New state string
      meta: Object         // (optional) New metadata
    }
  ]
}
```

### Grammar Move

Replaces the board's grammar. Only the board owner can issue this move.

```js
{
  type: 'grammar',
  user: string,       // Must equal Board.owner
  grammar: string     // New grammar source text
}
```

---

## Board JSON Format

The object returned by `board.toJSON()` and accepted by the `Board` constructor and `initFromJSON()`.

```js
{
  time: string,            // BigInt time as decimal string
  lastEventTime: string,   // BigInt last event time as decimal string
  rng: string,             // Serialized Mersenne Twister state
  owner: string,           // Board owner identifier
  grammar: string,         // Grammar source text
  types: string[],         // Ordered type name list (index 0 is always "_")
  size: number,            // Board side length (power of 2)
  cell: Array              // Flat array of cell encodings (size*size elements)
}
```

### Cell Encoding

Each element in the `cell` array is one of:

- **`number`** — Type index only, no state or metadata. Equivalent to `[typeIndex]`.
- **`[typeIndex, state]`** — Type index and state string.
- **`[typeIndex, state, meta]`** — Type index, state string, and metadata object.

Type indices refer to the `types` array in the same JSON object.

---

## Grammar Compilation

**Module:** `src/gramutil.js`

These functions form a pipeline: parse text into an AST, index the rules, expand inheritance, and compile to a form the engine can execute.

### `parseOrUndefined(text, opts)`

Parses grammar source text into a rule AST array. Returns `undefined` on syntax error.

```js
/**
 * @param {string} text - Grammar source text
 * @param {Object} [opts]
 *   @param {Function|false} [opts.error] - Error handler. Pass `false` to suppress errors,
 *     a function to receive error messages, or omit for console.error.
 *   @param {boolean} [opts.suppressLocation] - If true, omit line/column info from error messages.
 * @returns {Object[]|undefined} Array of rule AST nodes, or undefined on parse failure.
 *   Each node has a `type` field: 'transform', 'inherit', or 'comment'.
 */
parseOrUndefined(text, opts)
```

### `makeGrammarIndex(rules)`

Indexes a parsed rule array by subject type, building type lists and inheritance maps.

```js
/**
 * @param {Object[]} rules - Parsed rule AST (from parseOrUndefined)
 * @returns {Object} Grammar index:
 *   - transform: { [typeName]: rule[] } — async rules by subject type
 *   - syncTransform: { [syncRate]: { [typeName]: rule[] } } — sync rules by rate and type
 *   - types: string[] — ordered type list (first is '_', last is '?')
 *   - typeIndex: { [typeName]: number } — type name to index
 *   - ancestors: { [type]: string[] } — transitive ancestor types
 *   - descendants: { [type]: string[] } — transitive descendant types
 *   - syncRates: number[] — sorted unique sync rates (in microHz)
 *   - syncCategoriesByType: { [type]: number[] } — sync rate indices per type
 */
makeGrammarIndex(rules)
```

### `expandInherits(index)`

Expands type inheritance: copies parent rules to children and expands LHS type alternatives for inherited types.

```js
/**
 * @param {Object} index - Output of makeGrammarIndex()
 * @returns {Object} Expanded index with the same shape, but with inherited rules
 *   added to child types and LHS alternatives expanded.
 */
expandInherits(index)
```

### `compileTypes(rules)`

Full compilation pipeline: indexes rules, expands inheritance, compiles type references to numeric indices, computes rates and acceptance probabilities, and collects command/key bindings.

```js
/**
 * @param {Object[]} rules - Parsed rule AST
 * @returns {Object} Compiled grammar with fields:
 *   - transform: rule[][] — async rules by type index
 *   - syncTransform: rule[][][] — sync rules by sync category and type index
 *   - types: string[] — type name list
 *   - typeIndex: { [name]: number } — name-to-index map
 *   - unknownType: number — index of the '?' catch-all type (last index)
 *   - syncRates: number[] — sync rates in microHz
 *   - syncPeriods: BigInt[] — sync periods in ticks
 *   - syncCategories: number[] — sync category indices (reversed order)
 *   - rateByType: BigInt[] — total async rate per type (Hz)
 *   - syncCategoriesByType: number[][] — sync categories each type participates in
 *   - typesBySyncCategory: number[][] — types in each sync category
 *   - command: Object[][] — command rule index: command[typeIdx][commandName] = rule[]
 *   - key: Object[][] — key rule index: key[typeIdx][keyName] = rule[]
 */
compileTypes(rules)
```

Each compiled transform rule has these additional fields added during compilation:

| Field | Type | Description |
|---|---|---|
| `rate` | `number` | Original rate in microHz (default 1000000 = 1 Hz) |
| `rate_Hz` | `BigInt` | Rate rounded up to nearest Hz (0 for command/key rules) |
| `acceptProb_leftShift30` | `number` | Fractional acceptance probability, scaled by 2^30 |
| `sync` | `number` | Sync period in microHz (sync rules only) |

---

## Serialization

**Module:** `src/serialize.js`

Converts compiled or parsed rule ASTs back to grammar source text.

### `serialize(rules)`

Serializes an array of rule AST nodes back to grammar text.

```js
/**
 * @param {Object[]} rules - Array of rule nodes (type: 'transform', 'inherit', or 'comment')
 * @returns {string} Grammar source text
 */
serialize(rules)
```

### `serializeRuleWithTypes(rule, types)`

Serializes a single compiled rule, resolving numeric type indices back to type names using the provided types array.

```js
/**
 * @param {Object} rule - A compiled transform rule (with numeric type indices)
 * @param {string[]} types - Type name array (from compiled grammar)
 * @returns {string} Single rule as grammar text (trimmed, no trailing newline)
 */
serializeRuleWithTypes(rule, types)
```

### `lhsTerm(t)`

Serializes a single LHS term AST node to its text representation.

```js
/**
 * @param {Object} t - LHS term node
 * @returns {string} Text representation (e.g. "bee/NE", "(a|b)", "^rock", "*")
 */
lhsTerm(t)
```

---

## TraceBuffer

**Module:** `src/trace.js`

A fixed-capacity ring buffer that records recent rule application events. Accessible as `board.trace`.

### Constructor

```js
/**
 * @param {number} [capacity=2000] - Maximum number of entries to retain
 */
new TraceBuffer(capacity)
```

### Methods

#### `push(entry)`

Appends an entry to the buffer. Overwrites the oldest entry if at capacity. Automatically adds a `seq` field (monotonically increasing sequence number).

```js
/** @param {Object} entry - Trace entry (see format below) */
trace.push(entry)
```

#### `toArray()`

Returns all entries in chronological order (oldest first).

```js
/** @returns {Object[]} Array of trace entries */
trace.toArray()
```

#### `clear()`

Removes all entries and resets the sequence counter.

```js
trace.clear()
```

#### `toJSON()`

Returns a JSON-serializable representation.

```js
/** @returns {{ capacity: number, entries: Object[] }} */
trace.toJSON()
```

### Properties

| Property | Type | Description |
|---|---|---|
| `length` | `number` | Number of entries currently in the buffer (read-only getter) |
| `capacity` | `number` | Maximum number of entries |
| `count` | `number` | Total entries ever pushed (used for `seq` numbering) |

### Trace Entry Format

The board pushes two kinds of trace entries:

**Init entry** (pushed on board initialization):

```js
{
  type: 'init',
  time: string,          // Board time as decimal string
  boardSize: number,     // Board side length
  grammar: string,       // Grammar source text
  seq: number            // Sequence number (auto-assigned)
}
```

**Rule application entry** (pushed each time a rule fires):

```js
{
  type: string,          // 'async', 'sync', or 'move'
  time: string,          // Board time as decimal string
  x: number,             // Subject cell X coordinate
  y: number,             // Subject cell Y coordinate
  dir: string,           // Direction ('N','E','S','W')
  ruleText: string,      // Human-readable rule text
  subjectType: string,   // Type name of the subject cell
  before: [              // Cell states before the rule applied
    { x: number, y: number, type: string, state: string }
  ],
  after: [               // Cell states after the rule applied
    { x: number, y: number, type: string, state: string }
  ],
  seq: number            // Sequence number (auto-assigned)
}
```

---

## Engine Functions

**Module:** `src/engine.js`

Low-level pattern matching and rule application. These are used internally by the Board, but can also be called directly.

### `applyTransformRule(board, x, y, dir, rule)`

Attempts to match and apply a rule at position `(x, y)` in direction `dir`. If the LHS matches, cells are updated in place.

```js
/**
 * @param {Board} board - Board instance
 * @param {number} x - Subject cell X coordinate
 * @param {number} y - Subject cell Y coordinate
 * @param {string} dir - Direction character (encoded as a vec2char direction)
 * @param {Object} rule - Compiled transform rule
 * @returns {boolean} true if the rule matched and was applied
 */
applyTransformRule(board, x, y, dir, rule)
```

### `transformRuleUpdate(board, x, y, dir, rule)`

Matches the rule and computes cell updates without applying them. Returns the updates array or `null` if the LHS does not match.

```js
/**
 * @param {Board} board
 * @param {number} x
 * @param {number} y
 * @param {string} dir
 * @param {Object} rule
 * @returns {Array|null} Array of [x, y, cellValue] triples, or null if no match.
 *   Each element is [number, number, { type: number, state: string, meta?: Object }].
 */
transformRuleUpdate(board, x, y, dir, rule)
```

### `matchLhs(board, x, y, dir, rule)`

Performs LHS pattern matching only, without computing RHS updates. Returns a `Matcher` instance.

```js
/**
 * @param {Board} board
 * @param {number} x
 * @param {number} y
 * @param {string} dir
 * @param {Object} rule
 * @returns {Matcher} Matcher instance. Check matcher.failed to see if matching succeeded.
 *   On success, matcher.termCell contains the matched cells and matcher.termAddr
 *   contains the matched addresses.
 */
matchLhs(board, x, y, dir, rule)
```

---

## Lookup Exports

**Module:** `src/lookups.js`

Precomputed O(1) lookup tables for character-encoded vector algebra, matrix transforms, and neighborhood computations. All state characters are ASCII 33-126 (94 printable characters).

### `dirs`

```js
/** @type {string[]} Cardinal directions: ['N', 'E', 'S', 'W'] */
dirs
```

### `vec2char(v)`

Encodes a 2D vector `[x, y]` (range -4 to +4 per axis) as a single character. Returns `'~'` for out-of-range vectors.

```js
/** @param {[number, number]} v @returns {string} Single character */
vec2char(v)
```

### `int2char(n)`

Encodes an integer (mod 94) as a single character (ASCII 33-126).

```js
/** @param {number} n @returns {string} Single character */
int2char(n)
```

### `charVecLookup`

Maps each character to its decoded `[x, y]` vector.

```js
/** @type {Object.<string, [number, number]>} char -> [x, y] */
charVecLookup
```

### `charLookup`

Contains precomputed direction lookups.

```js
/**
 * @type {Object}
 * @property {Object.<string, string>} absDir - Maps direction name ('N','E','S','W')
 *   to its vec2char-encoded character.
 */
charLookup
```

### `charPermLookup`

Precomputed permutation tables for O(1) character-level arithmetic.

```js
/**
 * @type {Object}
 * @property {Object.<string, Object.<string, string>>} matMul
 *   matMul[matrix][char] -> transformed char. Matrices: 'F','R','B','L','H','V'
 *   (Forward/Right/Back/Left = rotations; H/V = horizontal/vertical reflection)
 *
 * @property {Object.<string, Object.<string, string>>} vecAdd
 *   vecAdd[charA][charB] -> char encoding vecA + vecB
 *
 * @property {Object.<string, Object.<string, string>>} vecSub
 *   vecSub[charA][charB] -> char encoding vecB - vecA
 *
 * @property {Object.<string, Object.<string, string>>} intAdd
 *   intAdd[charA][charB] -> char encoding (intA + intB) mod 94
 *
 * @property {Object.<string, Object.<string, string>>} intSub
 *   intSub[charA][charB] -> char encoding (intB - intA) mod 94
 *
 * @property {Object} rotate
 *   rotate.clock[char] -> clockwise neighborhood rotation
 *   rotate.anti[char]  -> counter-clockwise neighborhood rotation
 */
charPermLookup
```

### `charClassLookup`

Precomputed neighborhood character classes for each cell position.

```js
/**
 * @type {Object}
 * @property {Object.<string, string>} moore
 *   moore[char] -> string of chars representing the Moore neighborhood (8+1 cells)
 *   of the position encoded by char, filtered to valid vector range.
 *
 * @property {Object.<string, string>} neumann
 *   neumann[char] -> string of chars representing the von Neumann neighborhood (4+1 cells).
 */
charClassLookup
```

### `charRotLookup`

Maps direction-vector characters to degree rotations (for rendering).

```js
/**
 * @type {Object.<string, number>}
 * Maps vec2char-encoded direction to degrees: N=0, NE=45, E=90, SE=135, S=180, SW=225, W=270, NW=315
 */
charRotLookup
```
