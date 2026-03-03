# SokoScript

A framework for building 2D grid-based games from reaction-diffusion grammar rules, with support for cellular automata, Sokoban-like pushing mechanics, and agent-based simulations.

## Project Overview

SokoScript lets you define game rules using a declarative pattern-matching grammar. Rules specify how cells on a toroidal 2D grid transform based on their neighbors, enabling everything from simple diffusion to complex agent behaviors. The engine supports asynchronous (rate-based) and synchronous (clock-based) rule execution, player-controlled agents, type inheritance, and rich state encoding.

## Architecture

### Core Engine (`src/`)
- **`grammar.pegjs`** — PEG grammar definition for the rule language. Compile with `npm run build-parser`.
- **`grammar.js`** — Compiled parser (generated, do not edit directly).
- **`gramutil.js`** — Grammar indexing, inheritance expansion, type compilation. Key functions: `makeGrammarIndex()`, `expandInherits()`, `compileTypes()`, `parseOrUndefined()`.
- **`board.js`** — Board state management. `Board` class holds cell array, type counters (`RangeCounter`), RNG state. Key methods: `initGrammar()`, `nextRule()`, `evolveToTime()`, `evolveAndProcess()`, `toJSON()`/`initFromJSON()`.
- **`engine.js`** — Pattern matching (`Matcher` class) and rule application (`applyTransformRule()`). The `Matcher` recursively matches LHS patterns against board state, computes state expressions, and generates cell updates.
- **`serialize.js`** — Converts parsed rule ASTs back to text format.
- **`lookups.js`** — Precomputed lookup tables for vector algebra, character encoding, matrix transformations, neighborhood computations. All operations are O(1).
- **`MersenneTwister.js`** — Deterministic PRNG with state serialization.
- **`log2.js`** — Fast piecewise-linear ln() approximation for exponential event timing.
- **`canonical-json.js`** — Deterministic JSON serialization.
- **`md5.js`** — MD5 hash for color assignment and state hashing.

### Web Frontend (`websok/`)
- React 18 + Vite app for interactive board editing and game play.
- **`App.jsx`** — Main component: grammar editor, board evolution timer, player controls, palette, import/export.
- **`components/TiledBoard.jsx`** — Zoomable tile-based board view with pan/drag.
- **`components/PixelMap.jsx`** — Minimap pixel view of entire board.
- **`components/Tile.jsx`** — Individual cell renderer using Iconify icons, with rotation support.
- **`components/boardUtils.js`** — Mouse event handling (drag, paint, hover).
- **`components/BoardSizeSelector.jsx`** — Board resize controls.
- **`components/ScoreDisplay.jsx`** — Score display.
- Source files from `src/` are symlinked into `websok/src/soko/`.

### Serverless Backend (`lambda/`) — *not actively developed*
- AWS Lambda + DynamoDB backend for multiplayer.
- `boards.js` — HTTP handler for board CRUD, move submission, block computation.
- `server.js` — Express dev server for local testing.
- `dynamo.js` / `client.js` — DynamoDB and HTTP client CLI tools.

### Grammar Files (`grammars/`)
- `diffuse.txt` — Simple particle diffusion (`x _ : _ x.`)
- `sync_diffuse.txt` — Synchronous diffusion variant
- `sandpile.txt` — Abelian sandpile model with avalanche dynamics
- `lv3.txt` — Rock-paper-scissors / Lotka-Volterra ecosystem
- `syntax.txt` — Grammar syntax examples and test cases

### Board Files (`boards/`)
- JSON board snapshots with cell arrays, types, RNG state.

## Grammar Language Reference

### Rule Syntax
```
subject [address] neighbor [address] neighbor ... : rhs_term rhs_term ..., attributes.
```

### Pattern Matching (LHS)
- **Types**: `bee`, `rock`, `_` (empty), `?` (unknown)
- **States**: `type/stateChars` — e.g. `sandpile/4`, `bee/?`
- **Wildcards**: `?` (any char), `*` (any remaining), `[abc]` (class), `[^abc]` (negated)
- **Alternatives**: `(a|b|c)`
- **Negation**: `^term`
- **Any cell**: `*`

### Addresses
- **Relative direction**: `>F>` (forward), `>R>` (right), `>B>` (back), `>L>` (left)
- **Absolute direction**: `>N>`, `>E>`, `>S>`, `>W>`
- **By state**: `>1>` (neighbor in direction stored in state char 1)
- **By expression**: `>@vec(1,2)>`, `>+expr>` (neighbor-relative)

### Replacement (RHS)
- **Copy cell**: `$1`, `$2` (by LHS position)
- **Copy with new state**: `$1/newState`
- **New cell**: `type/state`
- **ID tag**: `~1` (transfer ID from LHS term 1)

### State Expressions
- `@vec(x,y)` — vector literal
- `@int(n)` — integer literal (mod 94)
- `@add(a,b)`, `@sub(a,b)` — cyclic integer arithmetic
- `@clock(v)`, `@anti(v)` — neighborhood rotation
- `$#n`, `$g#n` — reference state char n of group g
- `$#*`, `$g#*` — reference remaining state chars (tail)
- `%F`, `%R`, `%B`, `%L`, `%H`, `%V` — matrix transforms

### Attributes
- `rate=N` — events per second (default 1, max 999)
- `sync=N` — synchronous rule period in Hz
- `command={name}` — player command trigger
- `key={k}` — keyboard key trigger
- `score=N` — score increment on rule application
- `sound={name}` — sound effect identifier
- `caption={text}` — UI caption

### Type Inheritance
```
child = parent1, parent2.
```
Child types inherit all rules from parents. LHS alternatives are expanded automatically.

## Development

### Commands
```bash
npm test                    # Run tests (mocha)
npm run build-parser        # Rebuild grammar.js from grammar.pegjs
cd websok && npm run dev    # Start Vite dev server for web UI
cd websok && npm run build  # Production build of web UI
```

### Key Design Principles
- **Deterministic evolution**: Mersenne Twister RNG with state save/restore enables replay from any point.
- **Toroidal grid**: All coordinates wrap around (modular arithmetic).
- **O(1) lookups**: All vector/matrix/char operations use precomputed tables.
- **Rate-based scheduling**: Exponential distribution for async events, with accept/reject for fractional rates.
- **BigInt time**: 2^32 ticks per second for sub-microsecond precision.

### Testing
- Framework: Mocha + Chai (ES modules)
- Test files in `test/`: `parse.test.js`, `rng.test.js`, `md5.test.js`
- Run: `npm test`

### State Encoding
- Characters ASCII 33-126 (94 printable chars) encode integers mod 94, 2D vectors (-4..+4 per axis), and matrix transforms.
- State strings are variable-length sequences of these encoded characters.

## Current Status
- Core engine is functional: grammar parsing, board evolution, pattern matching, player input all work.
- Web UI is functional: tile rendering, grammar editing, paint tools, player controls, import/export.
- Serverless backend exists but is not actively maintained.
- Tests cover parser basics, RNG determinism, and MD5 hashing.
- No documentation existed prior to this file.
