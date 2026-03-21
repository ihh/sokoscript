# SokoScript Game Ideas

A collection of game concepts designed for the SokoScript grammar engine. Each idea leverages the system's strengths: reaction-diffusion dynamics, player-controlled agents, rate-based scheduling, state encoding, type inheritance, and toroidal grid topology. These are starting points for implementation, not finished designs.

1. **Shepherd** -- The player controls a sheepdog that herds wandering sheep into a pen (target cells) while wolves patrol the edges and eat any sheep they contact. Sheep diffuse randomly but flee from the dog when adjacent. Score by pushing sheep onto pen cells; lose sheep to wolves. Emergent flocking as sheep cluster away from threats.

2. **Plague Doctor** -- A disease spreads between villagers at a tunable rate, turning healthy villagers into sick ones, then into corpses. The player walks between villagers to cure them (converting sick back to healthy, scoring). Corpses decay into graves that block movement. The challenge is triage: which outbreak cluster to address first as infection accelerates exponentially.

3. **Ice Sliding Puzzle** -- The player moves on an ice grid where movement does not stop until hitting a wall or rock. Rocks can be pushed (Sokoban-style) to create new stopping points. Collect gems scattered on the grid for score. The toroidal wrap-around means careless slides send the player to the opposite edge, demanding spatial planning.

4. **Coral Reef** -- An aquatic ecosystem where coral grows slowly on sand, fish eat algae and reproduce, and pollution cells spread from factory sources. The player controls a diver who cleans pollution (score) and plants coral. If pollution overwhelms coral, fish die off and the reef collapses. Balancing cleanup speed against pollution generation rate creates tension.

5. **Ant Colony** -- Ants wander randomly but leave pheromone trails (state-encoded intensity) that decay over time. When an ant finds food, it carries it home, leaving stronger pheromones. Other ants follow high-pheromone neighbors. The player places food sources and obstacles, scoring when food reaches the nest. Emergent path optimization without direct ant control.

6. **Lava Escape** -- Lava flows downward (south-biased diffusion) from volcano cells at the top of the board, consuming trees and grass. The player must navigate upward to reach a rescue helicopter cell, pushing boulders to dam lava flow. Score for each rescued villager NPC that reaches the helicopter. Lava cooling into rock creates dynamic terrain.

7. **Garden Defense** -- The player tends a garden where flowers grow from seeds and produce fruit (score). Weeds spread aggressively and choke flowers. Slugs wander and eat both flowers and fruit. The player can pull weeds (walk into them) and squash slugs, but both respawn from the edges. Balancing offense and harvesting creates a resource management loop.

8. **Chain Reaction** -- The board is filled with bombs of different countdown states (encoded as state integers). Bombs tick down synchronously; when one reaches zero it explodes, converting neighbors to shorter-fuse bombs. The player places firebreaks (walls) to contain cascading explosions and protect target cells. Score for each target surviving a full detonation wave.

9. **Magnetic Puzzle** -- Red and blue magnets attract opposite poles and repel same poles via directional rules. The player pushes magnets around a grid to align pairs on target cells. Magnets slide toward opposite-colored neighbors and away from same-colored ones at low rates, creating a dynamic puzzle where pieces drift after being placed.

10. **Bacteriophage** -- Bacteria multiply by splitting into adjacent empty cells. Phage viruses infect bacteria, converting them into phage factories that burst after a countdown (state-encoded timer), releasing new phages. The player controls a syringe that injects phages, scoring for each bacterium eliminated. Over-infection leads to phage die-off from lack of hosts -- a boom-bust dynamic.

11. **River Crossing** -- Logs float eastward across a river (synchronous horizontal movement). The player must hop between logs to cross from south bank to north bank, scoring on arrival, then cross back. Crocodiles swim westward and are lethal. The toroidal wrap means logs and crocs cycle continuously, creating rhythm-game timing on a grid.

12. **Treasure Miner** -- The player digs through dirt cells (converting them to tunnels) to find gems (score). Digging destabilizes rock above, which falls downward like sand (gravity diffusion). Falling rocks crush the player. Gas pockets explode when dug into, chain-clearing adjacent dirt. Strategic digging avoids cave-ins while maximizing gem collection.

13. **Wildfire Relay** -- Two firefighters (player-controlled via different key sets, e.g. WASD and IJKL) cooperate on a large board with aggressive fire spread. Water stations recharge slowly. Each firefighter can carry limited water (state-encoded count) and must return to stations to refill. Score for extinguished fires. Cooperative spatial division emerges naturally.

14. **Lichen Wars** -- Three species of lichen (rock-paper-scissors dynamics inherited from lv3) compete for territory on a stone surface, but the player controls a scraper that can remove any lichen type. Clearing a target species scores points, but removing its predator lets its prey explode. The player must understand the RPS cycle to selectively prune without causing ecological collapse.

15. **Conveyor Factory** -- Conveyor belt cells have directional state and push adjacent items in that direction each tick (synchronous rules). The player places and rotates conveyor segments to route raw materials from source cells to factory cells. Each delivery scores. Jams occur when items collide, requiring the player to reroute. A logistics puzzle with real-time pressure.

16. **Mushroom Forager** -- Mushrooms grow in dark forest cells (away from clearings) and are edible for a short window before becoming poisonous (state-encoded age). The player forages edible mushrooms for score but loses points for picking poisonous ones. Bears wander the forest and block paths. Rain events periodically trigger mushroom blooms across the board.

17. **Sandcastle** -- Waves advance from the east edge periodically (synchronous pulses), eroding sand cells they contact. The player builds sand walls by converting empty beach cells into sand. Score accumulates for each castle cell (placed inland) that survives wave cycles. Waves recede after each pulse, giving building windows. A race between construction and erosion.

18. **Electron Circuit** -- Wires, switches, and gates are placed on a board. Electrons flow along wire cells (Wireworld-style cellular automaton rules). The player toggles switches to route electrons from source to target cells, scoring on delivery. Short circuits destroy wire segments. The puzzle is achieving correct signal routing in a live, continuously-firing circuit.

19. **Frogger Grid** -- Vehicles move in alternating east/west lanes at different rates. The player (frog) must cross from bottom to top, dodging traffic. Safe lily-pad cells in river lanes float north/south. Reaching the top row scores and resets the frog to the bottom. Speed increases as score climbs by spawning faster vehicle types. Classic arcade tension on a toroidal grid.

20. **Symbiosis** -- Two organisms (fungus and alga) each die slowly in isolation but thrive when adjacent, forming lichen that spreads and scores. The player nudges separated organisms together by pushing them. Acid rain cells drift across the board and dissolve exposed organisms but not lichen. The goal is to establish enough lichen colonies to sustain a self-perpetuating population.
