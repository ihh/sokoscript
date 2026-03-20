# SokoScript Development Plan

## Phase 1: Testing & Stability ✅

### 1.1 Expand Parser Tests ✅
- Test all state expression types (`@vec`, `@int`, `@add`, `@sub`, `@clock`, `@anti`)
- Test all address types (relative, absolute, neighbor, cell)
- Test wildcards, character classes, negation, alternatives
- Test `$group` and `$group/prefix` RHS terms
- Test ID tags (`~n`)
- Test all attributes (rate, sync, command, key, score, sound, caption)
- Test serialization round-trips (parse -> serialize -> parse)
- Test error cases: invalid rates, out-of-range references, malformed rules

### 1.2 Engine Tests ✅
- Test `RangeCounter`: add, remove, total, kthElement with various sizes
- Test `Board` creation, `initFromJSON`/`toJSON` round-trips
- Test `setCellTypeByName`, type lookup, unknown type handling
- Test `Matcher` pattern matching: simple types, states, wildcards, alternatives, negation
- Test `applyTransformRule` with known board setups
- Test `evolveToTime` with simple grammars (verify deterministic output given same seed)
- Test sync rules execute at correct intervals
- Test player commands and key handling
- Test move processing (command, write, grammar moves)

### 1.3 Lookup Table Tests ✅
- Test vector/char encoding round-trips
- Test matrix multiplication tables
- Test neighborhood computations

## Phase 2: Example Games ✅

### 2.1 Forest Fire ✅
Grammar file: `grammars/forest_fire.txt`. Web UI preset with icons.

### 2.2 Sokoban Classic ✅
Grammar file: `grammars/sokoban.txt`. Web UI preset with icons.

### 2.3 Ecosystem Simulation ✅
Grammar file: `grammars/ecosystem.txt`. Web UI preset with icons.

## Phase 3: Documentation

### 3.1 README.md ✅
- Project overview, quick start, grammar reference, architecture overview

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

## Phase 4: Terminal Debugger

Pure Node.js TUI debugger (zero external TUI deps, ANSI escape codes only).
Inspired by the 6502life terminal debugger. See `docs/terminal-debugger-proposal.md` for full design.

### 4.1 Core TUI Framework
- `ansi.js`, `input.js`, `layout.js` — three-pane layout (map, grammar, CLI)
- `pane-command.js` — full-width CLI with history and scrollback
- `app.js` — orchestrator with tab-based pane focus cycling
- Entry point: `sokodebug` CLI that loads grammar/board files

### 4.2 Map Pane
- One character per cell, type-based colors
- Cursor navigation, focused cell highlighting, toroidal wrapping
- Zoom toggle (local ↔ full board)
- Player key forwarding (WASD etc.)

### 4.3 Grammar Pane
- Rule listing via `serializeRuleWithTypes`
- Last-fired marker (▶) from trace buffer
- Heat coloring by fire frequency (hot=red, cold=dim)
- Scroll and auto-sync modes

### 4.4 Commands
- Simulation control: run/pause/step/speed/reset
- Navigation: goto/center/player
- Inspection: cell/neighbors/trace
- Board editing: set/paint/clear/fill
- State management: save/load/snapshot/restore
- Debugging: watch/break/trace filtering

## Phase 5: Trace-Based Undo & Time Travel

Extend the existing trace system (`src/trace.js`) to support undo/redo and time-travel debugging.
The debugger (Phase 4) is the primary consumer of these features.

### 5.1 Snapshot Checkpoints
- Periodic full board snapshots interleaved with trace events
- Configurable checkpoint interval (e.g. every 500 trace events)
- Enables rewinding to any point by restoring nearest checkpoint + replaying

### 5.2 Undo/Redo
- `undo [N]` command: rewind N events (restores from checkpoint + replay)
- `redo [N]` command: replay N events forward
- Undo player moves specifically: `undo move` skips back to previous move event

### 5.3 Time Travel
- `rewind T` — rewind to simulation time T
- `replay` — replay from current point at configurable speed
- `bookmark` — mark points of interest for quick navigation
- Visual timeline in status bar showing position within trace

## Phase 6: Web UI Improvements

### 6.1 Game Selector ✅
- Preset dropdown menu with Forest Fire, Sokoban, Ecosystem

### 6.2 Improved Game Controls
- Speed control slider
- Step-by-step mode for debugging
- Touch support for mobile

### 6.3 Visual Polish
- Grammar syntax highlighting in editor
- Error messages shown inline
- Better default icon mappings for common type names

## Phase 7: Future Directions (not yet planned in detail)

- Reinforcement learning integration: gym-style environment wrapper
- More game examples: snake, Conway's Life, maze generation, tower defense
- Serverless multiplayer revival (Lambda/DynamoDB backend)
- Performance: WebAssembly engine, WebGL rendering for large boards
- Socket mode: debugger connects to running websok instance via WebSocket

## Execution Order

1. **Phase 1** ✅ — testing established confidence in the engine
2. **Phase 2** ✅ — example games demonstrate the framework
3. **Phase 3** next — documentation makes the project approachable
4. **Phase 4** after docs — terminal debugger for development and debugging
5. **Phase 5** after debugger — trace-based undo gives debugger time-travel powers
6. **Phase 6** — web UI polish
7. **Phase 7** — aspirational, pursue as interest dictates
