# SokoScript Grammar Tutorial

This tutorial teaches you the SokoScript grammar language step by step. Each section builds on the last, so work through them in order. Every snippet is a valid grammar you can paste into the web UI and run immediately.

---

## 1. Your First Rule

The simplest possible SokoScript grammar is one line:

```
x _ : _ x.
```

This makes particles of type `x` drift randomly across the grid. Let's break down the syntax:

- **Left-hand side (LHS):** `x _` -- the pattern to match. This says "find a cell of type `x` next to an empty cell `_`."
- **Colon `:`** -- separates the pattern (what to look for) from the replacement (what to do).
- **Right-hand side (RHS):** `_ x` -- what to replace the matched cells with. The `x` and the empty cell swap positions.
- **Period `.`** -- every rule ends with a period.

The LHS and RHS must have the same number of terms. The first LHS term maps to the first RHS term, the second to the second, and so on. In this case, the `x` cell becomes empty and the empty cell becomes `x` -- the particle moves.

Place some `x` cells on the board, hit play, and watch them wander. That's diffusion: the simplest emergent behavior from a single rule.

### Why does the particle move randomly?

When no direction is specified between LHS terms, SokoScript picks a random adjacent neighbor. Each time the engine tries to fire this rule, it picks a random `x` cell and checks a random neighbor. If that neighbor is empty, the swap happens. Over many applications, the particle drifts in all directions equally -- Brownian motion.

---

## 2. Types and Empty Cells

A **type** is just a name for a kind of cell. Types can be any alphanumeric word: `tree`, `fire`, `rock`, `player`, `sandpile`. The special type `_` means "empty cell" (no type).

Rules can create new types on the RHS even if they don't appear on the LHS:

```
tree : fire, rate=0.002.
fire : ash, rate=0.2.
ash : grass, rate=0.05.
grass : tree, rate=0.005.
```

This is a lifecycle: trees spontaneously catch fire (lightning), fire burns to ash, ash decays to grass, grass regrows into trees. Each rule transforms one type into another. No neighbors are involved -- these are single-cell rules.

Notice that you never "declare" types. You just use them. Any word that appears in a rule is automatically a type. Place a mix of `tree` and `grass` cells on the board and watch the cycle play out.

---

## 3. Rates

Every rule has a **rate** that controls how often it fires. The `rate=N` attribute sets events per cell per second. If you don't specify a rate, it defaults to 1.

```
// Slow: trees take a long time to grow
grass : tree, rate=0.005.

// Fast: fire spreads aggressively
tree fire : fire fire, rate=3.

// Very fast: maximum speed
x _ : _ x, rate=999.
```

Rates are probabilistic, not deterministic. A rate of 3 means each matching cell fires about 3 times per second on average, but the exact timing is random (exponential distribution). This gives the simulation a natural, organic feel -- events don't happen in lockstep.

A rate of 0.005 means a cell fires roughly once every 200 seconds. Use low rates for rare events (lightning strikes, spontaneous growth) and high rates for fast processes (fire spreading, particle diffusion).

The maximum rate is 999. If you want something to happen as fast as possible, use `rate=999`.

---

## 4. Directions and Neighbors

So far, multi-cell rules have matched "a cell next to another cell" without specifying which direction. You can be explicit about direction using **address operators** between LHS terms.

The four absolute directions are:

- `>N>` -- north (up)
- `>E>` -- east (right)
- `>S>` -- south (down)
- `>W>` -- west (left)

```
// Fire only spreads northward
tree >N> fire : fire fire, rate=3.
```

This rule says: "find a `tree` cell whose **north** neighbor is `fire`, then turn the tree into fire too." The direction is always **from the preceding term to the next term**. So `tree >N> fire` means "tree, and to its north, fire."

You can chain multiple addresses to match longer patterns:

```
// Player pushes a crate northward into an empty space
player >N> crate >N> _ : _ $1 crate, key={w}.
```

This matches three cells in a vertical line: player, then crate directly north of the player, then empty space directly north of the crate. On the RHS, the player's old position becomes empty, the crate's old position gets the player (`$1` copies the first LHS term), and the empty space gets a new crate.

The board is **toroidal** -- coordinates wrap around. A cell on the north edge has the south edge as its northern neighbor.

---

## 5. Relative Directions

Absolute directions (N/E/S/W) are fine for player movement, but for autonomous agents, you usually want **relative directions**:

- `>F>` -- forward (the direction the cell is "facing")
- `>R>` -- right (clockwise 90 degrees from forward)
- `>B>` -- back (opposite of forward)
- `>L>` -- left (counter-clockwise 90 degrees from forward)

```
// Particle moves forward
particle >F> _ : _ particle, rate=5.
```

When a rule uses relative directions and no explicit facing is given, the engine picks a random facing for each rule attempt. This means `particle >F> _` effectively tries a random adjacent cell -- similar to omitting the direction entirely, but it opens the door to **directional state** (covered in the States section).

Relative directions become powerful when combined with state. A cell can store which direction it's facing, and `>F>` will resolve to that stored direction. This lets you build creatures that move in straight lines, turn, and navigate.

```
// Without explicit facing, these two rules behave identically:
x _ : _ x.
x >F> _ : _ x.
```

The difference becomes meaningful once cells track their own facing direction in state, but even without that, relative directions are useful for keeping rule sets concise and orientation-independent.

---

## 6. Player Control

To make an interactive game, you need rules that fire only when the player presses a key. The `key={k}` attribute binds a rule to a keyboard key:

```
// Player moves with WASD
player >N> _ : _ $1, key={w}.
player >S> _ : _ $1, key={s}.
player >E> _ : _ $1, key={d}.
player >W> _ : _ $1, key={a}.
```

Key-bound rules never fire on their own. They only fire when the player presses the specified key AND the pattern matches on the board.

### The `$1` reference

On the RHS, `$1` means "copy the first cell from the LHS, preserving its identity." Why not just write `player` instead of `$1`?

Because each cell has a hidden **ID**. When you write `$1`, the player cell keeps its ID as it moves. This matters for two reasons: the engine tracks which cell is the player (for camera following, highlighting, etc.), and it preserves any state the cell carries.

If you wrote `_ player` on the RHS instead of `_ $1`, you'd create a brand-new player cell each move -- losing the original's identity and state.

### Scoring

The `score=N` attribute awards points when a rule fires:

```
// Push crate onto target: score a point
player >N> crate >N> target : _ $1 goal, key={w} score=1.
```

### A complete mini-game: Sokoban

Putting movement and pushing together:

```
// Move onto empty cells
player >N> _ : _ $1, key={w}.
player >S> _ : _ $1, key={s}.
player >E> _ : _ $1, key={d}.
player >W> _ : _ $1, key={a}.

// Push crate into empty space
player >N> crate >N> _ : _ $1 crate, key={w}.
player >S> crate >S> _ : _ $1 crate, key={s}.
player >E> crate >E> _ : _ $1 crate, key={d}.
player >W> crate >W> _ : _ $1 crate, key={a}.

// Push crate onto target: score!
player >N> crate >N> target : _ $1 goal, key={w} score=1.
player >S> crate >S> target : _ $1 goal, key={s} score=1.
player >E> crate >E> target : _ $1 goal, key={d} score=1.
player >W> crate >W> target : _ $1 goal, key={a} score=1.
```

Place a `player`, some `crate` cells, some `target` cells, and `wall` cells for obstacles. The player pushes crates with WASD and scores when a crate lands on a target.

---

## 7. States

Every cell can carry a **state string** -- a sequence of characters that encode additional information. States are written after the type, separated by a slash:

```
sandpile/0
sandpile/4
bee/NE
```

### Matching states on the LHS

You can match specific state values, or use wildcards:

```
// Match sandpile with state "4" exactly
sandpile/4 : avalanche, rate=10.

// Match any single state character
sandpile/? : something.

// Match specific characters with a character class
sandpile/[0123] : something.

// Match any remaining characters with *
wild/xy* : wild.
```

Wildcard reference:
- `?` -- matches exactly one character
- `*` -- matches zero or more remaining characters
- `[abc]` -- matches one character from the set
- `[^abc]` -- matches one character NOT in the set

### Setting states on the RHS

You can set a new state on the RHS:

```
// Set state to "0"
sandpile : sandpile/0.

// Copy cell but change its state
sandpile/[0123] : $1/@add(@int(1), $#1).
```

### State expressions

States aren't limited to literal characters. SokoScript has a small expression language for computing state values:

- `@int(n)` -- the character encoding integer `n` (mod 94)
- `@vec(x,y)` -- the character encoding a 2D vector
- `@add(a,b)` -- add two encoded values (cyclic)
- `@sub(a,b)` -- subtract two encoded values
- `$#1` -- reference state character 1 of the matched cell
- `$#*` -- reference all remaining state characters (the tail)
- `$2#1` -- reference state character 1 of LHS term 2

Example: incrementing a counter stored in state:

```
// Sandpile gains sand: increment state char 1
sandpile/[0123] : $1/@add(@int(1), $#1), rate=0.1.

// When it reaches 4, it becomes an avalanche
sandpile/4 : avalanche.
```

States use ASCII characters 33-126 (94 printable characters) to encode integers mod 94 and 2D vectors. You don't need to worry about the encoding details -- just use `@int()` and `@vec()` and the engine handles the rest.

---

## 8. Type Inheritance

When multiple types share the same behavior, you can avoid duplicating rules using **type inheritance**:

```
// All three species move and die like a "bee"
rock = bee.
scissors = bee.
paper = bee.

// These rules apply to bee, rock, scissors, AND paper
bee _ : $2 $1, rate=999.
bee : _, rate=0.01.
bee _ : $1 $1, rate=0.05.

// These rules are type-specific
rock scissors : $1 $1, rate=999.
scissors paper : $1 $1, rate=999.
paper rock : $1 $1, rate=999.
```

The line `rock = bee.` means "rock inherits from bee." Every rule that mentions `bee` on the LHS is automatically expanded to also apply to `rock`. The same goes for `scissors` and `paper`.

This is the rock-paper-scissors grammar. All three species wander (`bee _ : $2 $1`), die (`bee : _`), and reproduce (`bee _ : $1 $1`) at the same rates. But each one also beats one other species (`rock scissors : $1 $1` means rock replaces scissors).

A type can inherit from multiple parents:

```
child = parent1, parent2.
```

Inheritance is purely a rule-expansion mechanism. At parse time, the engine generates copies of inherited rules with the child type substituted in. There's no runtime overhead.

---

## 9. Sync Rules

All the rules so far have been **asynchronous**: they fire probabilistically, one cell at a time, at random. Sometimes you want rules that apply to **every matching cell simultaneously**, like a cellular automaton. That's what `sync=N` does:

```
// Every cell updates simultaneously, 3 times per second
cell : cell, sync=3.
```

The `sync=N` attribute makes the rule fire synchronously at `N` Hz. At each tick, the engine scans the entire board, finds all cells matching the LHS, and applies the RHS to all of them at once.

Synchronous rules are essential for cellular automata where a cell's next state depends on its current neighbors, and you don't want partial updates to contaminate the result. Conway's Game of Life, for instance, requires synchronous updates.

```
// Synchronous diffusion: all particles move at once
x _ : _ x, sync=10.
```

Compare this to the async version (`x _ : _ x, rate=10.`). The async version updates one random particle at a time, creating a gradual, stochastic flow. The sync version moves all particles simultaneously each tick, creating a more uniform, wave-like pattern.

You can mix sync and async rules in the same grammar. Async rules fire continuously between sync ticks.

---

## 10. Putting It Together: Forest Fire

Let's walk through a complete game grammar that combines most of what you've learned. This is a firefighting game: trees grow, lightning strikes, fires spread, and you control a fireman trying to save the forest.

```
// Forest Fire - A firefighting cellular automata game

// Tree growth: grass slowly becomes trees
grass : tree, rate=0.005.

// Lightning: trees rarely catch fire spontaneously
tree : fire, rate=0.002.

// Fire spread: fire jumps to adjacent trees quickly
tree fire : fire fire, rate=3.

// Burnout: fire eventually turns to ash
fire : ash, rate=0.2.

// Ash recovery: ash slowly returns to grass
ash : grass, rate=0.05.

// Water evaporates back to grass
water : grass, rate=0.3.
```

These six rules create the autonomous ecosystem. Notice the rate hierarchy:
- Growth and lightning are very slow (0.005, 0.002) -- rare events.
- Fire spread is fast (3) -- fires are aggressive once started.
- Burnout is moderate (0.2) -- fires last a few seconds.
- Recovery is slow (0.05) -- the landscape heals gradually.

This rate balance creates emergent dynamics: forests grow, get struck by lightning, burn in dramatic waves, and slowly recover. Without any player interaction, it's already a cellular automaton worth watching.

Now add the player:

```
// Fireman extinguishes adjacent fire (score a point!)
fireman >N> fire : $1 water, key={w} score=1.
fireman >S> fire : $1 water, key={s} score=1.
fireman >E> fire : $1 water, key={d} score=1.
fireman >W> fire : $1 water, key={a} score=1.
```

When the fireman moves into a fire cell, it becomes `water` instead of the fireman moving there. The fireman stays put (`$1` preserves identity and position), the fire is replaced with water, and the player scores a point. The water will eventually evaporate back to grass.

```
// Fireman movement on empty ground
fireman >N> _ : _ $1, key={w}.
fireman >S> _ : _ $1, key={s}.
fireman >E> _ : _ $1, key={d}.
fireman >W> _ : _ $1, key={a}.

// Fireman walks over grass
fireman >N> grass : _ $1, key={w}.
fireman >S> grass : _ $1, key={s}.
fireman >E> grass : _ $1, key={d}.
fireman >W> grass : _ $1, key={a}.

// Fireman walks over ash and water too
fireman >N> ash : _ $1, key={w}.
fireman >S> ash : _ $1, key={s}.
fireman >E> ash : _ $1, key={d}.
fireman >W> ash : _ $1, key={a}.

fireman >N> water : _ $1, key={w}.
fireman >S> water : _ $1, key={s}.
fireman >E> water : _ $1, key={d}.
fireman >W> water : _ $1, key={a}.
```

Movement rules let the fireman walk on empty cells, grass, ash, and water. Notice the fireman cannot walk through trees or walls -- there are no rules for those, so the pattern simply won't match and the key press does nothing.

**The key design insight**: in SokoScript, what a player *can't* do is defined by the absence of rules. You don't write "player cannot walk through walls." You simply never write a rule matching `player >N> wall`. The wall blocks the player because no rule exists to handle that case.

### To play it

1. Paste the full grammar into the editor.
2. Fill the board mostly with `tree` and `grass` cells.
3. Place one `fireman` cell.
4. Hit play and use WASD to move.
5. Rush to extinguish fires before they consume the forest.

---

## Quick Reference

| Syntax | Meaning |
|--------|---------|
| `type` | A cell type (any word) |
| `_` | Empty cell |
| `type/state` | Cell with state string |
| `>N>` `>E>` `>S>` `>W>` | Absolute directions |
| `>F>` `>R>` `>B>` `>L>` | Relative directions |
| `$1`, `$2` | Copy LHS term 1, 2 to RHS |
| `$1/newstate` | Copy term 1 with new state |
| `~1` | Transfer ID from LHS term 1 |
| `?` `*` `[abc]` `[^abc]` | State wildcards |
| `@int(n)` `@vec(x,y)` | Literal state values |
| `@add(a,b)` `@sub(a,b)` | State arithmetic |
| `$#1` `$2#1` | Reference state chars |
| `rate=N` | Events/sec (async, default 1) |
| `sync=N` | Ticks/sec (synchronous) |
| `key={k}` | Keyboard trigger |
| `score=N` | Points on rule fire |
| `child = parent.` | Type inheritance |
| `// text` | Comment |
| `.` | End of rule |
