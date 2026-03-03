# SokoScript Development Plan

## Phase 1: Testing & Stability

### 1.1 Expand Parser Tests
- Test all state expression types (`@vec`, `@int`, `@add`, `@sub`, `@clock`, `@anti`)
- Test all address types (relative, absolute, neighbor, cell)
- Test wildcards, character classes, negation, alternatives
- Test `$group` and `$group/prefix` RHS terms
- Test ID tags (`~n`)
- Test all attributes (rate, sync, command, key, score, sound, caption)
- Test serialization round-trips (parse -> serialize -> parse)
- Test error cases: invalid rates, out-of-range references, malformed rules

### 1.2 Engine Tests
- Test `RangeCounter`: add, remove, total, kthElement with various sizes
- Test `Board` creation, `initFromJSON`/`toJSON` round-trips
- Test `setCellTypeByName`, type lookup, unknown type handling
- Test `Matcher` pattern matching: simple types, states, wildcards, alternatives, negation
- Test `applyTransformRule` with known board setups
- Test `evolveToTime` with simple grammars (verify deterministic output given same seed)
- Test sync rules execute at correct intervals
- Test player commands and key handling
- Test move processing (command, write, grammar moves)

### 1.3 Lookup Table Tests
- Test vector/char encoding round-trips
- Test matrix multiplication tables
- Test neighborhood computations

## Phase 2: Example Games

### 2.1 Forest Fire (Cellular Automata Game)
A game where the player controls a fireman trying to extinguish spreading fires while trees grow.

**Types:**
- `tree` — grows from grass, can catch fire
- `fire` — spreads to adjacent trees
- `ash` — left after fire burns out, slowly becomes grass
- `grass` — empty ground, trees grow here
- `water` — blocks fire, placed by fireman
- `fireman` — player-controlled, sprays water

**Rules:**
- Trees grow from grass at low rate
- Fire spreads to adjacent trees at moderate rate
- Fire burns out to ash after a while
- Ash decays to grass slowly
- Fireman moves in commanded direction
- Fireman pushes water (Sokoban-style) or sprays water adjacent
- Score for each fire extinguished

**Grammar file:** `grammars/forest_fire.txt`
**Board file:** `boards/forest_fire.json`

### 2.2 Sokoban Classic
A proper Sokoban puzzle with crates and targets.

**Types:**
- `player` — user-controlled
- `crate` — pushable
- `wall` — immovable
- `target` — goal position
- `crate_on_target` — crate placed on target (score!)

**Grammar file:** `grammars/sokoban.txt`
**Board file:** `boards/sokoban.json`

### 2.3 Ecosystem Simulation
A richer prey-predator-plant ecosystem (building on existing `lv3.txt`).

**Types:**
- `plant` — grows spontaneously
- `herbivore` — eats plants, reproduces
- `predator` — eats herbivores, reproduces
- `_` — empty space

**Grammar file:** `grammars/ecosystem.txt`

## Phase 3: Documentation

### 3.1 README.md
- Project overview and motivation
- Quick start guide (install, run web UI, try example grammars)
- Link to grammar language reference
- Screenshots or diagrams of example games
- Architecture overview

### 3.2 Grammar Language Tutorial
- `docs/grammar-tutorial.md`
- Step-by-step introduction: first rule, diffusion, types, states
- Building up to a simple game
- Worked examples from the grammar files

### 3.3 Architecture Documentation
- `docs/architecture.md`
- How the engine works: parsing -> compilation -> evolution loop
- Data structures: RangeCounter, cell encoding, state chars
- Time system and deterministic replay
- Pattern matching algorithm

### 3.4 API Documentation
- `docs/api.md`
- Board class API
- Grammar compilation pipeline
- Serialization format

## Phase 4: Web UI Improvements

### 4.1 Game Selector
- Dropdown or menu to load example grammars and boards
- Bundled game presets (forest fire, sokoban, ecosystem, etc.)

### 4.2 Improved Game Controls
- Better keyboard handling (arrow keys for movement)
- Touch support for mobile
- Speed control slider
- Step-by-step mode for debugging

### 4.3 Visual Polish
- Better default icon mappings for common type names
- Status bar with game info
- Grammar syntax highlighting in editor
- Error messages shown inline

## Phase 5: Future Directions (not yet planned in detail)

- Reinforcement learning integration: gym-style environment wrapper
- More game examples: snake, Conway's Life, maze generation, tower defense
- Grammar debugger: step through rule matching, highlight matched cells
- Serverless multiplayer revival (Lambda/DynamoDB backend)
- Performance: WebAssembly engine, WebGL rendering for large boards

## Execution Order

1. **Phase 1** first (testing) — establishes confidence in the engine
2. **Phase 2** next (games) — demonstrates the framework's capabilities
3. **Phase 3** alongside Phase 2 (docs) — document as we build
4. **Phase 4** after games work (UI) — polish the experience
5. **Phase 5** is aspirational — pursue as interest dictates
