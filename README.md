# SokoScript

A framework for building 2D grid-based games from declarative reaction-diffusion grammar rules. Define cell types, write pattern-matching rules, and watch complex behaviors emerge on a toroidal grid — from cellular automata to Sokoban puzzles to ecological simulations.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start the web UI
cd websok && npm install && npm run dev
```

Open the Vite dev server URL in your browser. You'll see a grid editor where you can:
- Write grammar rules in the text area
- Select a cell type from the palette and click/drag to paint
- Press **Start** to evolve the board
- Assign player IDs to cells and use keyboard/command controls

## How It Works

Games are defined by **grammar rules** that specify how cells on a 2D grid transform based on their neighbors. The engine continuously picks random cells and tries to apply matching rules, creating emergent behavior from simple local interactions.

### Example: Simple Diffusion

```
bee _ : _ bee.
```

This rule says: when a `bee` cell is next to an empty (`_`) cell, they swap. The result is random diffusion — bees wander around the grid.

### Example: Fire Spreading

```
tree fire : fire fire, rate=3.
```

When a `tree` is adjacent to a `fire`, both become `fire`. The `rate=3` means this happens 3 times per second (per matching pair). Fire spreads rapidly through forests.

### Example: Player Movement

```
player >N> _ : _ player, key={w}.
```

When the `w` key is pressed, if there's an empty cell north (`>N>`) of the player, the player moves there.

## Example Games

### Forest Fire (`grammars/forest_fire.txt`)
A firefighting game where you control a fireman trying to extinguish spreading wildfires. Trees grow, lightning strikes, fires spread to adjacent trees. Move with WASD, walk into fires to put them out and score points.

### Sokoban (`grammars/sokoban.txt`)
The classic box-pushing puzzle. Move with WASD, push crates onto targets to score. Features directional pushing using the `>N> crate >N> _` three-cell pattern.

### Ecosystem (`grammars/ecosystem.txt`)
A prey-predator-plant simulation. Plants grow and spread, herbivores eat plants and reproduce, predators eat herbivores. Watch population dynamics emerge from simple rules.

### Rock-Paper-Scissors (`grammars/lv3.txt`)
A Lotka-Volterra style ecosystem where three species compete in a cyclic dominance pattern.

### Abelian Sandpile (`grammars/sandpile.txt`)
Demonstrates the framework's state arithmetic — sandpile cells accumulate grains and avalanche when they reach 4, distributing grains to neighbors.

## Grammar Language

### Rule Syntax

```
subject [address] neighbor ... : replacement ..., attributes.
```

**Left-hand side** (pattern to match):
- Cell types: `bee`, `tree`, `player`
- Empty cell: `_`
- Any cell: `*`
- State patterns: `cell/state`, `cell/?` (wildcard), `cell/*` (any), `cell/[abc]` (class)
- Alternatives: `(a|b|c)`
- Negation: `^type`

**Addresses** (neighbor position):
- Absolute: `>N>`, `>E>`, `>S>`, `>W>`
- Relative: `>F>` (forward), `>R>` (right), `>B>` (back), `>L>` (left)
- By state: `>1>` (direction from state char 1)

**Right-hand side** (replacement):
- Copy cell: `$1`, `$2` (by LHS position)
- Copy with new state: `$1/newState`
- New cell: `type` or `type/state`

**Attributes:**
- `rate=N` — events per second (default 1, max 999)
- `sync=N` — synchronous rule period in Hz
- `command={name}` — player command trigger
- `key={k}` — keyboard key trigger
- `score=N` — score change on rule application

### Type Inheritance

```
child = parent1, parent2.
```

Child types inherit all rules from parents. Alternatives are expanded automatically in matching patterns.

### State Expressions

States are strings of characters (ASCII 33-126) that encode integers mod 94 and 2D vectors. Expressions include:
- `@vec(x,y)`, `@int(n)` — literals
- `@add(a,b)`, `@sub(a,b)` — cyclic arithmetic
- `@clock(v)`, `@anti(v)` — neighborhood rotation
- `$#n`, `$g#n` — reference matched state characters
- `%R`, `%B`, `%L`, `%H`, `%V` — matrix transforms

## Architecture

```
src/
  grammar.pegjs    — PEG grammar definition (compile with npm run build-parser)
  grammar.js       — Compiled parser (generated)
  gramutil.js      — Grammar indexing, inheritance, compilation
  board.js         — Board state, cell management, evolution loop
  engine.js        — Pattern matching and rule application
  serialize.js     — Rule AST to text conversion
  lookups.js       — Precomputed O(1) lookup tables
  MersenneTwister.js — Deterministic PRNG

websok/            — React + Vite web frontend
grammars/          — Example game grammars
boards/            — Saved board states
test/              — Mocha + Chai test suite
lambda/            — AWS Lambda serverless backend (not actively developed)
```

## Development

```bash
npm test                         # Run tests
npm run build-parser             # Rebuild parser from grammar.pegjs
cd websok && npm run dev         # Start web UI dev server
cd websok && npm run build       # Production build
```

## Design Principles

- **Deterministic**: Mersenne Twister RNG with state save/restore enables replay from any point
- **Toroidal**: All coordinates wrap around (the grid has no edges)
- **Efficient**: All vector/matrix/char operations use precomputed O(1) lookup tables
- **Declarative**: Game logic is defined entirely in grammar rules — no imperative code needed
