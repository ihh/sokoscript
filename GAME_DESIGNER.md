# SokoScript Game Designer & Narrator

Instructions for LLM-assisted game design, naming, and narrative generation.

## Overview

SokoScript games are defined by reaction-diffusion grammar rules on a toroidal 2D grid. The Game Designer agent assists with:
1. **Naming emergent behavior** — observing what types actually DO and giving them evocative names
2. **Narrative generation** — theming abstract grammars into coherent game worlds
3. **Rate tuning** — using gradient-based analysis to shape game dynamics
4. **Contrived spontaneity** — designing grammars where interesting events feel player-discovered

## Behavioral Fingerprinting

Each cell type in a grammar has a behavioral fingerprint derived from its rules:

| Trait | How to detect | Narrative archetypes |
|-------|--------------|---------------------|
| **Spawner** | Appears in RHS but not LHS of a spontaneous rule | Tree, nest, fountain, volcano |
| **Mortal** | Appears in LHS of a unary decay rule (X : Y) | Fruit, fire, ghost, ice |
| **Mobile** | Appears in LHS of a swap rule (X Y : Y X) | Creature, wind, water, wanderer |
| **Predator** | Transforms player/other type on contact | Monster, trap, lava, poison |
| **Prey/Collectible** | Player scores when contacting it | Treasure, food, gem, survivor |
| **Spreader** | Transforms neighbors into copies of itself | Disease, fire, corruption, lichen |
| **Blocker** | Appears in no RHS (or only self-referential rules) | Wall, mountain, grave, barrier |
| **Catalyst** | Appears in LHS and RHS unchanged | Ground, water, road, air |

Combine traits for richer names:
- Mobile + Predator = "prowling wolf", "hunting drone", "angry bee"
- Spawner + Mortal = "mushroom", "geyser", "firefly"
- Spreader + Mortal = "wildfire", "plague", "crystal growth"
- Mobile + Collectible = "fleeing rabbit", "bouncing coin", "drifting star"

## Naming Convention

When naming types for a new game:
1. Pick a **theme** that fits the combination of behaviors (fantasy, sci-fi, nature, horror, cute)
2. Names should be **short** (1-2 words), **evocative**, and **distinct** from each other
3. The player type name should suggest agency ("ranger", "diver", "alchemist", not "player")
4. Inanimate types get noun names ("ember", "crystal"); animate types get character names ("imp", "scout")

## Contrived Spontaneity

The goal is designing grammars where:
- The player feels they *discovered* something emergent
- Interesting events happen as *indirect consequences* of player actions
- The grammar is tuned so these events are likely but not guaranteed

### Techniques

**Chain reactions**: Player action triggers A, A triggers B at some rate, B triggers C.
The player sees C happen and thinks "I caused that!" — which they did, indirectly.
```
player >N> crystal : ground $1, key={w} score=1.  // player breaks crystal
crystal : spark, rate=0.5.                          // broken crystals spark
spark fire : fire fire, rate=3.                     // sparks ignite fires
fire ice : water water, rate=2.                     // fire melts ice
```

**Ecological cascades**: Removing one type causes another to flourish, which causes a third to appear.
```
// Wolves eat rabbits; rabbits eat flowers; flowers attract bees
// Player kills wolves → rabbits explode → flowers disappear → bees die
// Player discovers: "killing wolves kills bees?!"
```

**Timing surprises**: Slow rates create delayed consequences.
```
seed : sapling, rate=0.01.    // Very slow: player forgets they planted it
sapling : tree, rate=0.01.    // Even slower
tree : fruit, rate=0.1.       // Fruit appears "from nowhere" much later
```

### Gradient-Based Design

Use the differentiable world model pipeline to:
1. Define a desired "surprise" — e.g., "player action at time T causes visible effect at time T+50"
2. Backprop through the world model to find rate parameters that maximize P(surprise | player_action)
3. The world model predicts board evolution; the rates control how quickly chain reactions propagate

This is automated contrived spontaneity: the optimizer finds rate settings that create the illusion of emergence.

## Game Design Workflow

1. **Sketch rules** — define types and interactions in abstract terms
2. **Fingerprint** — classify each type's behavioral traits
3. **Name** — use the LLM narrator to theme the game based on fingerprints
4. **Screen** — run 50k PPO training to check for learning signal
5. **Tune rates** — use score function estimator or world model gradients
6. **Add special actions** — give the agent divine/survey if the game benefits
7. **Narrate** — generate game description, icon assignments, flavor text
8. **Iterate** — adjust based on what the RL agent actually learns to do

## Icon Assignment

Map behavioral fingerprints to Iconify icon names:
- Creatures: `mdi:cat`, `game-icons:wolf-head`, `mdi:bug`
- Plants: `mdi:tree`, `mdi:flower`, `mdi:mushroom`
- Elements: `mdi:fire`, `mdi:water`, `game-icons:crystal-growth`
- Treasures: `mdi:diamond-stone`, `mdi:star`, `mdi:treasure-chest`
- Hazards: `mdi:skull`, `mdi:flash`, `game-icons:mine-explosion`
- Terrain: `mdi:square`, `mdi:wall`, `mdi:gate`
- Player: `mdi:account`, `game-icons:sword-woman`, `mdi:robot`
