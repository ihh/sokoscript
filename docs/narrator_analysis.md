# SokoScript Narrator Analysis

Behavioral fingerprints, thematic renames, and new game designs optimized for contrived spontaneity.

---

## Part 1: Behavioral Fingerprints of Existing Games

### Predator-Prey

| Type | Traits | Notes |
|------|--------|-------|
| `ground` | Catalyst | Appears unchanged in swaps; the empty medium everything moves through |
| `apple` | Spawner (from ground) + Prey/Collectible | Spawned stochastically, consumed by player for score |
| `predator` | Mobile + Predator | Diffuses randomly, kills player on contact |
| `player` | Mobile + Prey (to predator) | Player-controlled, collects apples, dies to predators |

**Verdict**: A classic foraging-under-threat loop. The predator is both mobile and lethal. The apple is a passive collectible with no evasion behavior. Ground is pure catalyst.

### Apple Collector

| Type | Traits | Notes |
|------|--------|-------|
| `ground` | Catalyst + Spawner | Spontaneously becomes apple |
| `apple` | Mortal + Prey/Collectible | Decays to `old`, collected by player for score |
| `old` | Mortal + Prey/Collectible | Decays to ground, still collectible |
| `player` | Mobile | Moves, collects both apple and old |

**Verdict**: A pure time-pressure foraging game. No threats, just decay. The two-stage apple lifecycle (apple -> old -> ground) is the only dynamic tension.

### Forest Fire

| Type | Traits | Notes |
|------|--------|-------|
| `grass` | Catalyst + Spawner | Spawns trees slowly |
| `tree` | Mortal (to lightning) + Prey (to fire) | Grows from grass, ignites spontaneously or from adjacent fire |
| `fire` | Spreader + Mortal | Spreads to adjacent trees, burns out to ash |
| `ash` | Mortal | Decays back to grass, walkable |
| `water` | Mortal | Evaporates to grass, left behind by fireman |
| `fireman` | Mobile + Predator (to fire) | Extinguishes fires for score, walks through most terrain |

**Verdict**: The richest ecology so far. A full cycle: grass -> tree -> fire -> ash -> grass. Fire is Spreader + Mortal, the classic wildfire archetype. The fireman fights a self-sustaining chain reaction.

### Treasure Miner

| Type | Traits | Notes |
|------|--------|-------|
| `dirt` | Blocker (passively blocks until dug) | Consumed by player movement |
| `gem` | Prey/Collectible + Blocker | Hidden in dirt, scored on contact |
| `ground` | Catalyst | Empty tunnel space |
| `rock` | Mobile (gravity) + Predator | Falls south, crushes player |
| `player` | Mobile | Digs dirt, collects gems, killed by falling rocks |

**Verdict**: A Boulderdash-style gravity puzzle. Rock is Mobile + Predator (falls and kills). Dirt is a destructible blocker. The chain reaction is: dig dirt -> rock above loses support -> rock falls -> crush. Simple but effective.

### Minefield

| Type | Traits | Notes |
|------|--------|-------|
| `ground` | Catalyst | Safe walking surface |
| `mine` | Predator (hidden) | Kills player on contact, visually indistinguishable from ground |
| `explosion` | Mortal | Fades to ground quickly |
| `exit` | Prey/Collectible | Big score on contact |
| `player` | Mobile | Navigates toward exit, dies to mines |
| `safe` | Blocker (decorative) | Identity rule, visual hint only |

**Verdict**: A hidden-information game. The mine is a disguised Predator. Almost no dynamics -- the board is static except for player movement and explosions. This game lives and dies by the survey/divine special actions.

### Scout

| Type | Traits | Notes |
|------|--------|-------|
| `fog` | Mortal (reactive) | Dissipates when player is adjacent |
| `treasure` | Prey/Collectible | Score on contact |
| `trap` | Predator | Kills player on contact |
| `ground` | Catalyst | Revealed surface |
| `wall` | Blocker | Blocks movement, identity rule |
| `player` | Mobile | Explores, collects treasure, dies to traps |

**Verdict**: A fog-of-war exploration game. Fog is a reactive Mortal (it auto-clears near the player at rate=20, so effectively instant). Like Minefield, the board is mostly static. The tension is spatial uncertainty, not dynamic ecology.

---

## Part 2: Thematic Renames

### Predator-Prey

Current names: `ground`, `apple`, `predator`, `player`

| Theme | ground | apple | predator | player | Game Title |
|-------|--------|-------|----------|--------|------------|
| **Wolfberry Meadow** | meadow | berry | wolf | ranger | "Wolfberry Meadow" |
| **Drone Harvest** | grid | data | sentinel | hacker | "Sentinel Grid" |
| **Tide Pool** | sand | plankton | crab | diver | "Tide Pool" |

### Apple Collector

Current names: `ground`, `apple`, `old`, `player`

| Theme | ground | apple | old | player | Game Title |
|-------|--------|-------|-----|--------|------------|
| **Firefly Glade** | dusk | firefly | ember | moth | "Firefly Glade" |
| **Mushroom Forager** | loam | mushroom | toadstool | forager | "Mushroom Dew" |
| **Star Catcher** | void | star | dwarf | comet | "Fading Stars" |

### Forest Fire

Current names: `grass`, `tree`, `fire`, `ash`, `water`, `fireman`

| Theme | grass | tree | fire | ash | water | fireman | Game Title |
|-------|-------|------|------|-----|-------|---------|------------|
| **Ember Warden** | moss | pine | blaze | cinder | mist | warden | "Ember Warden" |
| **Corruption Purge** | soil | crystal | blight | shard | cure | paladin | "Crystal Blight" |
| **Neural Cascade** | quiet | neuron | seizure | scar | calm | surgeon | "Brainstorm" |

### Treasure Miner

Current names: `dirt`, `gem`, `ground`, `rock`, `player`

| Theme | dirt | gem | ground | rock | player | Game Title |
|-------|------|-----|--------|------|--------|------------|
| **Dwarf Delve** | clay | ruby | tunnel | boulder | dwarf | "Dwarf Delve" |
| **Ice Core** | permafrost | fossil | shaft | glacier | driller | "Ice Core" |
| **Ruin Crawler** | rubble | relic | passage | slab | archaeologist | "Ruin Crawler" |

### Minefield

Current names: `ground`, `mine`, `explosion`, `exit`, `player`, `safe`

| Theme | ground | mine | explosion | exit | player | safe | Game Title |
|-------|--------|------|-----------|------|--------|------|------------|
| **Cursed Tomb** | flagstone | glyph | hex | sarcophagus | thief | blessed | "Cursed Tomb" |
| **Orbital Debris** | vacuum | debris | burst | station | pilot | beacon | "Debris Field" |
| **Mushroom Marsh** | mud | spore | sneeze | bridge | toad | lily | "Spore Marsh" |

### Scout

Current names: `fog`, `treasure`, `trap`, `ground`, `wall`, `player`

| Theme | fog | treasure | trap | ground | wall | player | Game Title |
|-------|-----|----------|------|--------|------|--------|------------|
| **Sunken Wreck** | murk | doubloon | eel | sand | coral | diver | "Sunken Wreck" |
| **Haunted Manor** | shadow | heirloom | ghost | floor | stone | detective | "Haunted Manor" |
| **Alien Cavern** | spore | crystal | acid | rock | obsidian | spelunker | "Alien Cavern" |

---

## Part 3: New Game Designs for Contrived Spontaneity

### Game 1: "Mycelium"

**Flavor**: You are a gardener in a living forest. Mushrooms grow from rot, rot spreads from dead trees, and trees die when overcrowded. You harvest mushrooms for score -- but every mushroom you pick removes the rot that feeds the next generation. Somewhere across the board, a chain reaction of death and regrowth is unfolding because of a mushroom you picked thirty seconds ago.

**The chain reaction**: Player harvests mushroom -> rot patch shrinks -> nearby tree survives (less rot competition) -> tree cluster becomes overcrowded -> overcrowded trees die -> new rot patch appears far away -> mushrooms bloom there later. The player thinks: "Where did all those mushrooms come from?" Answer: they cleared a patch on the other side of the board minutes ago.

**Why divine/survey helps**: The player can only see locally. A survey reveals rot density -- high rot means mushrooms are coming soon. Divine reveals the next tree about to die from overcrowding, letting the player position themselves near the future bloom.

**Type fingerprints**:

| Type | Traits | Archetype |
|------|--------|-----------|
| `soil` | Catalyst | The empty medium |
| `tree` | Spawner (rot from overcrowding) + Mortal | Living tree, dies when surrounded |
| `rot` | Spreader + Mortal + Spawner | Spreads slowly, decays, spawns mushrooms |
| `mushroom` | Mortal + Prey/Collectible | Grows from rot, decays if not picked |
| `sapling` | Mortal (grows into tree) | Intermediate growth stage |
| `gardener` | Mobile | Player-controlled harvester |

```
// === Mycelium ===
// Harvest mushrooms from a living forest. Every pick reshapes the ecosystem.

// Rot spawns mushrooms
rot : mushroom, rate=0.08.

// Mushrooms wilt if not picked
mushroom : soil, rate=0.15.

// Rot spreads slowly to adjacent soil
rot >N> soil : rot soil, rate=0.05.
rot >S> soil : rot soil, rate=0.05.
rot >E> soil : rot soil, rate=0.05.
rot >W> soil : rot soil, rate=0.05.

// Rot decays back to soil
rot : soil, rate=0.03.

// Saplings grow from soil near trees
tree >N> soil : tree sapling, rate=0.01.
tree >S> soil : tree sapling, rate=0.01.
tree >E> soil : tree sapling, rate=0.01.
tree >W> soil : tree sapling, rate=0.01.

// Saplings mature into trees
sapling : tree, rate=0.02.

// Overcrowded trees die into rot (tree next to tree triggers death)
tree >N> tree : rot tree, rate=0.005.
tree >E> tree : rot tree, rate=0.005.

// Gardener harvests mushroom — score!
gardener >N> mushroom : soil $1, key={w} score=1.
gardener >S> mushroom : soil $1, key={s} score=1.
gardener >E> mushroom : soil $1, key={d} score=1.
gardener >W> mushroom : soil $1, key={a} score=1.

// Gardener moves on soil
gardener >N> soil : soil $1, key={w}.
gardener >S> soil : soil $1, key={s}.
gardener >E> soil : soil $1, key={d}.
gardener >W> soil : soil $1, key={a}.

// Gardener moves over rot
gardener >N> rot : soil $1, key={w}.
gardener >S> rot : soil $1, key={s}.
gardener >E> rot : soil $1, key={d}.
gardener >W> rot : soil $1, key={a}.
```

---

### Game 2: "Phosphor"

**Flavor**: You are a spark in a dark grid of dormant crystals. When you touch a crystal, it ignites into a bright cell that slowly dims through three stages before going dark again. But bright cells excite their neighbors -- a crystal next to a bright cell may spontaneously ignite. Your job is to keep a cascade of light rolling across the board. Score for each crystal you personally ignite, but the real spectacle is watching your single touch set off a wave of luminescence that ripples outward and then fades, leaving you scrambling to reignite the darkness.

**The chain reaction**: Player touches crystal -> crystal becomes bright -> bright excites adjacent crystals at low probability -> some ignite, creating a wave -> wave dims and dies -> board goes dark in that region -> player must chase the wavefront or start a new one. The timing surprise: a single touch can illuminate a quarter of the board five seconds later, or fizzle immediately.

**Why divine/survey helps**: Survey reveals crystal density -- dense clusters will cascade further. Divine reveals which crystals are about to be excited by the current wave, letting the player avoid redundant ignitions and instead position for the next dark zone.

**Type fingerprints**:

| Type | Traits | Archetype |
|------|--------|-----------|
| `dark` | Catalyst | Empty dark space |
| `crystal` | Prey/Collectible + Mortal (to excitation) | Dormant, waiting to be lit |
| `bright` | Spreader + Mortal | Excites neighbors, dims to glow |
| `glow` | Mortal | Dims to flicker |
| `flicker` | Mortal | Dims to dark, spawns new crystal |
| `spark` | Mobile | Player-controlled igniter |

```
// === Phosphor ===
// Ignite crystals and watch light cascade across the darkness.

// Bright cells excite adjacent crystals (the cascade)
crystal >N> bright : bright bright, rate=0.8.
crystal >S> bright : bright bright, rate=0.8.
crystal >E> bright : bright bright, rate=0.8.
crystal >W> bright : bright bright, rate=0.8.

// Bright dims to glow
bright : glow, rate=0.5.

// Glow dims to flicker
glow : flicker, rate=0.5.

// Flicker dies to dark
flicker : dark, rate=0.5.

// Dark cells slowly regrow crystals
dark : crystal, rate=0.02.

// Spark ignites crystal — score!
spark >N> crystal : dark $1, key={w} score=1.
spark >S> crystal : dark $1, key={s} score=1.
spark >E> crystal : dark $1, key={d} score=1.
spark >W> crystal : dark $1, key={a} score=1.

// Spark moves on dark
spark >N> dark : dark $1, key={w}.
spark >S> dark : dark $1, key={s}.
spark >E> dark : dark $1, key={d}.
spark >W> dark : dark $1, key={a}.

// Spark moves through glow and flicker (fading light)
spark >N> glow : dark $1, key={w}.
spark >S> glow : dark $1, key={s}.
spark >E> glow : dark $1, key={d}.
spark >W> glow : dark $1, key={a}.

spark >N> flicker : dark $1, key={w}.
spark >S> flicker : dark $1, key={s}.
spark >E> flicker : dark $1, key={d}.
spark >W> flicker : dark $1, key={a}.
```

---

### Game 3: "Dominion"

**Flavor**: You are a herald planting banners on neutral ground to claim territory for your kingdom. But the land fights back: wilderness reclaims your territory over time, converting claimed cells back to neutral. Meanwhile, a rival faction's influence (blight) seeps from the edges, converting neutral ground into enemy territory. Enemy territory adjacent to your territory sparks conflict -- both cells are destroyed, leaving scorched earth that nothing can reclaim. Your goal: claim as much as you can, but every banner you plant is a border that may eventually generate scorched earth. Expand too fast and your borders crumble. Expand too slow and blight swallows everything.

**The chain reaction**: Player plants banner -> claimed territory borders neutral ground -> blight converts neutral to enemy -> enemy meets claimed -> both become scorched -> scorched earth blocks future expansion. The player realizes: "I expanded east, and now there is a wall of scorched earth I cannot cross because blight hit my border." Alternatively: not planting in a region means blight fills it unopposed, and now the player is surrounded.

**Why divine/survey helps**: Survey reveals blight density -- the player can see which direction blight pressure is strongest and prioritize planting borders there. Divine reveals the next neutral cell about to be converted to blight, letting the player race to claim it first.

**Type fingerprints**:

| Type | Traits | Archetype |
|------|--------|-----------|
| `neutral` | Catalyst + Prey (to blight and player) | Unclaimed land |
| `claimed` | Mortal (to wilderness decay) + Prey (to conflict) | Player's territory |
| `blight` | Spreader + Prey (to conflict) | Enemy faction's creeping influence |
| `scorched` | Blocker | Permanent wasteland from conflict |
| `wild` | Mortal (becomes neutral) | Regrowing wilderness |
| `herald` | Mobile | Player-controlled banner planter |

```
// === Dominion ===
// Plant banners to claim territory. Blight creeps. Borders burn.

// Blight spreads to neutral ground
blight >N> neutral : blight blight, rate=0.3.
blight >S> neutral : blight blight, rate=0.3.
blight >E> neutral : blight blight, rate=0.3.
blight >W> neutral : blight blight, rate=0.3.

// Claimed territory decays to wild (wilderness reclamation)
claimed : wild, rate=0.02.

// Wild regrows to neutral
wild : neutral, rate=0.1.

// Conflict: claimed meets blight -> both become scorched
claimed >N> blight : scorched scorched, rate=5.
claimed >S> blight : scorched scorched, rate=5.
claimed >E> blight : scorched scorched, rate=5.
claimed >W> blight : scorched scorched, rate=5.

// Blight spawns at edges (rare, simulated as spontaneous conversion)
neutral : blight, rate=0.003.

// Herald plants banner — claims neutral ground, score!
herald >N> neutral : claimed $1, key={w} score=1.
herald >S> neutral : claimed $1, key={s} score=1.
herald >E> neutral : claimed $1, key={d} score=1.
herald >W> neutral : claimed $1, key={a} score=1.

// Herald moves on claimed territory
herald >N> claimed : claimed $1, key={w}.
herald >S> claimed : claimed $1, key={s}.
herald >E> claimed : claimed $1, key={d}.
herald >W> claimed : claimed $1, key={a}.

// Herald moves on neutral ground (without claiming)
herald >N> wild : neutral $1, key={w}.
herald >S> wild : neutral $1, key={s}.
herald >E> wild : neutral $1, key={d}.
herald >W> wild : neutral $1, key={a}.

// Herald killed by blight
blight >N> herald : blight scorched, rate=10.
blight >S> herald : blight scorched, rate=10.
blight >E> herald : blight scorched, rate=10.
blight >W> herald : blight scorched, rate=10.

// Scorched is permanent (identity rule to register type)
scorched : scorched, rate=0.
```

---

## Part 4: Design Notes

### On the existing games

The six existing grammars span a spectrum from purely static (Minefield, Scout) to dynamically ecological (Forest Fire). The strongest candidate for contrived spontaneity among the existing games is **Forest Fire**, which already has a chain reaction (lightning -> fire -> spread -> ash -> grass -> tree -> lightning again). The weakest candidates are Minefield and Scout, which have no autonomous dynamics at all -- the board only changes in response to the player.

Apple Collector and Predator-Prey sit in the middle: they have stochastic spawning but no cascading effects. A player action (eating an apple) does not trigger further consequences.

### On the new designs

All three new games are built around the principle that **player actions have delayed, non-local consequences**:

- **Mycelium**: harvesting removes rot, which changes tree survival, which changes future rot patterns. The delay is long (tens of seconds) and the effect is non-local (toroidal wrapping means the far side of the board is affected).

- **Phosphor**: igniting a crystal triggers a probabilistic wave. The delay is short (seconds) but the extent is unpredictable. The player must read the wave and position for its aftermath.

- **Dominion**: claiming territory creates borders that interact with blight. The consequence (scorched earth) is permanent and irreversible, making early decisions strategically weighty. The delay comes from blight needing time to reach the player's borders.

### Rate tuning recommendations

For all three games, the rates are initial estimates. The critical parameters to tune:

- **Mycelium**: `rot : mushroom` rate vs. `mushroom : soil` rate controls the harvest window. `tree >N> tree : rot tree` rate controls the overcrowding cascade speed.
- **Phosphor**: `crystal >N> bright : bright bright` rate controls cascade probability. Too high and every touch floods the board. Too low and cascades fizzle. The sweet spot is around 60-70% propagation probability per neighbor.
- **Dominion**: `blight >N> neutral` rate vs. `claimed : wild` rate is the core tension. Blight must spread faster than the player can claim, but slow enough that strategic play matters.

All three are good candidates for gradient-based rate optimization using the differentiable world model pipeline described in GAME_DESIGNER.md.
