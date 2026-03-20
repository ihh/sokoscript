# SokoScript Terminal Debugger — Design Proposal

## Overview

A terminal-based debugger for SokoScript games, inspired by the [6502life terminal debugger](https://github.com/ihh/6502life). Pure Node.js TUI using ANSI escape codes (no blessed/ncurses dependencies). Provides a local board map, grammar rule listing with live match highlighting, and a CLI for inspection and control. Connects to a running Board instance directly (in-process) or via socket for remote debugging.

## Layout

Three-pane layout (the 6502life debugger uses four, but we don't need a separate minimap since our local map already shows one char per cell and can zoom out to show the whole board):

```
+-------------------------------+---------------------------+
|                               |                           |
|   LOCAL MAP                   |  GRAMMAR RULES            |
|   (upper-left)                |  (upper-right)            |
|   ~60% width × 75% height    |  ~40% width × 75% height  |
|                               |                           |
+-------------------------------+---------------------------+
|                                                           |
|   COMMAND LINE                                            |
|   (bottom, full width)                                    |
|   ~25% height                                             |
|                                                           |
+-----------------------------------------------------------+
```

The CLI spans the full width (unlike 6502life which splits the bottom into two panes). SokoScript doesn't need a minimap quadrant because:
- The local map already renders one character per cell, so even a modest terminal can show a 60x40 region
- A `zoom` command can toggle between local and full-board views
- The grammar pane is more important than a minimap and needs the vertical space

### Status Bar

Rendered over the horizontal divider between map and CLI:

```
 RUN  cell:(8,8) type:fireman state: id:Player  t:12.34s  events:1847  spd:1x
```

Shows: run/pause state, focused cell info, simulation time, total events, speed multiplier.

## Pane Details

### Local Map Pane (Upper-Left)

**Purpose:** Board visualization at one character per cell, centered on the focused cell.

**Rendering:**
- Each cell rendered as a single character with foreground color
- Type-to-character mapping: first letter of type name by default, configurable via `icon` command
- Empty cells (`_`) rendered as `·` (middle dot) in dark gray
- Unknown types rendered as `?`
- Focused cell highlighted with inverse video
- Player cell (cell with tracked ID) shown with bold + underline
- Cell colors: deterministic hash of type name to terminal 256-color, matching the web UI's MD5-based color assignment

**Coordinate overlay:**
- Axis labels along top and left edges (every 5th coordinate labeled)
- Toroidal wrapping: seamless display across board edges

**Navigation:**
- Arrow keys: move cursor/focus (1 cell)
- Shift+arrows: move cursor (8 cells)
- `Home`: center on player
- `z`: toggle zoom (local view ↔ full board scaled to fit)

**Cursor:**
- Blinking inverse-video block on the focused cell
- Cell under cursor described in status bar

### Grammar Rules Pane (Upper-Right)

**Purpose:** Display compiled grammar rules with live feedback on which rules are firing. Analogous to 6502life's disassembler pane.

**Layout:**
```
── Grammar Rules ─────────────
  grass : tree, rate=0.005.
  tree : fire, rate=0.002.
▶ tree fire : fire fire, rate=3.        ← last fired (yellow ▶)
  fire : ash, rate=0.2.
  ash : grass, rate=0.05.
  water : grass, rate=0.3.
  fireman >N> fire : $1 water, key={w} score=1.
  ...
```

**Features:**
- Rules displayed as serialized text (via `serializeRuleWithTypes`)
- **Last-fired marker:** Yellow `▶` on the most recently applied rule
- **Heat coloring:** Rules colored by recent fire frequency (hot = red/yellow, cold = dim). Uses a decaying counter per rule.
- **Scroll:** Arrow keys scroll when pane is focused, Page Up/Down for fast scroll
- **Sync mode:** Auto-scrolls to keep the last-fired rule visible (toggle with `d`)
- **Rule grouping:** Rules grouped by subject type, with type name as section header
- **Key/command rules:** Shown with distinct styling (cyan) since they only fire on player input

**Integration with trace:**
- The trace buffer already records `ruleText` for every event. The grammar pane reads the most recent trace entries to determine which rules are "hot."

### Command Pane (Bottom, Full Width)

**Purpose:** CLI with command history and scrollback output. Direct port of 6502life's command pane, extended to full width.

**Layout:**
```
[scrollback output, max 200 lines]
> [input cursor]
```

**Input features** (identical to 6502life):
- Command history: ↑/↓ arrows
- Line editing: Backspace, Ctrl-A (home), Ctrl-E (end), Ctrl-K (kill to EOL), Ctrl-U (kill line)
- Left/Right arrow for cursor movement within input
- Green prompt when focused, dim when not

## Controls

### Global Keys (work regardless of focus)

| Key | Action |
|-----|--------|
| Tab | Cycle focus: map → grammar → command → map |
| Shift-Tab | Cycle focus backward |
| Ctrl-C | Quit |
| Space | Toggle run/pause (from any pane except command) |
| `n` | Step one async event (from any pane except command) |

### Map Pane Keys

| Key | Action |
|-----|--------|
| Arrows | Move cell focus |
| Shift+Arrows | Move cell focus by 8 |
| Home | Center on player |
| `z` | Toggle zoom (local ↔ full board) |
| WASD / game keys | Send player commands (forwarded as moves) |
| `p` | Paint selected type at cursor |

### Grammar Pane Keys

| Key | Action |
|-----|--------|
| ↑/↓ | Scroll rules |
| Page Up/Down | Scroll rules by page |
| `d` | Toggle auto-scroll to last-fired rule |

### Command Pane Keys

| Key | Action |
|-----|--------|
| Enter | Execute command |
| ↑/↓ | Command history |
| Ctrl-A/E/K/U | Line editing |

## Command Set

### Simulation Control
```
run, r              Start board evolution
pause, p            Pause
step [N]            Step N async events (default 1)
speed N             Set speed multiplier (events per frame)
reset               Reset board to initial state
```

### Navigation & Inspection
```
goto X,Y            Focus on cell (x,y)
center              Center view on focused cell
player              Focus on player cell
cell [X,Y]          Show cell info (type, state, meta, ID) at cursor or (x,y)
neighbors [X,Y]     Show all neighbors of cell
trace [N]           Show last N trace entries (default 20)
trace rule TEXT     Filter trace for entries matching rule text
trace move          Show only player move trace entries
```

### Board Editing
```
set TYPE [STATE]    Set focused cell to type (with optional state)
setid ID            Assign ID to focused cell
paint TYPE          Select type for painting (then 'p' in map to apply)
clear [X,Y]         Clear cell to empty
fill TYPE           Fill entire board with type
```

### Grammar
```
grammar             Show current grammar text
rule N              Show details of rule N (parsed AST)
reload FILE         Load grammar from file
```

### State Management
```
save FILE           Export board state to JSON
load FILE           Import board state from JSON
snapshot            Save named snapshot (in-memory)
restore [NAME]      Restore named snapshot
```

### Trace & Debugging
```
trace [N]           Show last N trace entries
trace rule PATTERN  Filter trace by rule text pattern
trace type TYPE     Filter trace by subject type
trace cell X,Y      Filter trace by position
watch X,Y           Watch cell — print to CLI whenever it changes
unwatch X,Y         Remove watch
break RULE_TEXT     Break (pause) when rule matching pattern fires
unbreak             Remove breakpoint
```

### Help
```
help, ?             Show command list
help COMMAND        Show help for specific command
```

## Architecture

### File Structure
```
cli/
  bin/
    sokodebug.js          # Entry point — CLI arg parsing, board setup
  lib/
    terminal/
      app.js              # Main orchestrator (TerminalApp class)
      layout.js           # Three-pane layout manager
      pane-map.js         # Upper-left: board map view
      pane-grammar.js     # Upper-right: grammar rules display
      pane-command.js     # Bottom: CLI input/output
      commands.js         # Command parser & executor
      input.js            # Raw stdin → key descriptor parser
    ansi.js               # ANSI escape code helpers
    render.js             # Cell-to-character mapping, color assignment
```

### Key Design Decisions

**1. Zero external TUI dependencies** (same as 6502life)
- Pure ANSI escape codes, raw stdin
- Alt screen buffer for clean enter/exit
- Responsive layout on terminal resize

**2. Reuse existing engine code**
- Import `Board`, `compileTypes`, `parseOrUndefined` directly
- The trace system already exists — CLI commands just query `board.trace`
- Grammar serialization already exists via `serialize.js`

**3. In-process by default, socket optional**
- Default mode: `sokodebug grammars/forest_fire.txt` loads grammar, creates board, runs in-process
- Optional: `sokodebug --connect HOST:PORT` connects to a running websok instance over WebSocket
- Socket protocol: JSON messages for board state snapshots, move submission, trace queries
- The socket mode is a stretch goal — in-process mode comes first

**4. Board file or grammar file as input**
- `sokodebug grammar.txt` — creates fresh board from grammar
- `sokodebug board.json` — loads saved board state
- `sokodebug --size 32 grammar.txt` — specify board size

**5. Player input forwarding**
- WASD keys in map pane are forwarded as player moves (same as web UI)
- Only when a player cell exists (has ID matching `playerId`)
- Game keys configured by the grammar's `key={}` attributes

### Differences from 6502life Terminal Debugger

| Aspect | 6502life | SokoScript |
|--------|----------|------------|
| Panes | 4 (memory, disasm, cmd, minimap) | 3 (map, grammar, cmd) |
| CLI width | Half | Full |
| Upper-left | Byte-level sextant memory map | One-char-per-cell board view |
| Upper-right | CPU registers + disassembly | Grammar rules + fire frequency |
| Minimap | Separate pane | Integrated via zoom toggle |
| Domain | 6502 opcodes, memory addresses | Grammar rules, cell types |
| Socket | Not implemented | Stretch goal (WebSocket to websok) |
| Rendering | Sextant chars (2x3 pixels/char) | One char per cell |
| Color model | HSV from byte value | Hash of type name |

### Performance

- **Render throttle:** 66ms minimum interval (~15fps), same as 6502life
- **Dirty flag rendering:** Only re-render on input, resize, or simulation events
- **Trace query:** Ring buffer `toArray()` is O(n) but n ≤ 2000, so trace commands are instantaneous
- **Rule heat tracking:** Decaying counters updated on each trace push, O(1) per event

## Implementation Phases

### Phase A: Core TUI Framework
- `ansi.js`, `input.js`, `layout.js` — port from 6502life (adapt for 3-pane layout)
- `pane-command.js` — port directly from 6502life (widen to full width)
- `app.js` — orchestrator skeleton with pane focus cycling
- Entry point with grammar/board loading

### Phase B: Map Pane
- Cell-to-character rendering with type-based colors
- Cursor navigation, focused cell highlighting
- Viewport scrolling with toroidal wrapping
- Zoom toggle

### Phase C: Grammar Pane
- Rule serialization and display
- Last-fired marker from trace buffer
- Heat coloring with decay
- Scroll and sync modes

### Phase D: Commands
- Simulation control (run/pause/step/speed)
- Navigation (goto/center/player)
- Inspection (cell/neighbors/trace)
- Board editing (set/paint/clear)
- State management (save/load/snapshot)

### Phase E: Debugging Features
- Watch expressions (print on cell change)
- Breakpoints (pause on rule match)
- Trace filtering commands

### Phase F: Socket Mode (Stretch)
- WebSocket server in websok
- Socket client in CLI
- Board state sync protocol
- Remote move submission
