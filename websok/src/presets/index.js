const diffuseGrammar = `x _ : _ x.
`;

const forestFireGrammar = `// Forest Fire - A firefighting cellular automata game
// Control your fireman with WASD. Walk into fires to extinguish them.

// Tree growth (grass sprouts trees)
grass : tree, rate=0.005.

// Lightning (rare spontaneous fire)
tree : fire, rate=0.002.

// Fire spreads to adjacent trees
tree fire : fire fire, rate=3.

// Fire burns out to ash
fire : ash, rate=0.2.

// Ash decays back to grass
ash : grass, rate=0.05.

// Water evaporates
water : grass, rate=0.3.

// Fireman extinguishes adjacent fire (WASD, put out fire and score!)
fireman >N> fire : $1 water, key={w} score=1.
fireman >S> fire : $1 water, key={s} score=1.
fireman >E> fire : $1 water, key={d} score=1.
fireman >W> fire : $1 water, key={a} score=1.

// Fireman movement on empty ground (WASD)
fireman >N> _ : _ $1, key={w}.
fireman >S> _ : _ $1, key={s}.
fireman >E> _ : _ $1, key={d}.
fireman >W> _ : _ $1, key={a}.

// Fireman can walk over grass
fireman >N> grass : _ $1, key={w}.
fireman >S> grass : _ $1, key={s}.
fireman >E> grass : _ $1, key={d}.
fireman >W> grass : _ $1, key={a}.

// Fireman can walk over ash
fireman >N> ash : _ $1, key={w}.
fireman >S> ash : _ $1, key={s}.
fireman >E> ash : _ $1, key={d}.
fireman >W> ash : _ $1, key={a}.

// Fireman can walk over water
fireman >N> water : _ $1, key={w}.
fireman >S> water : _ $1, key={s}.
fireman >E> water : _ $1, key={d}.
fireman >W> water : _ $1, key={a}.
`;

const sokobanGrammar = `// Sokoban - Push crates onto targets
// Control the player with WASD. Push crates onto targets to score!

// Player movement (WASD) - walk on empty ground or floor
player >N> _ : _ $1, key={w}.
player >S> _ : _ $1, key={s}.
player >E> _ : _ $1, key={d}.
player >W> _ : _ $1, key={a}.

// Player walks onto target (target stays, shown via player state)
player >N> target : _ $1, key={w}.
player >S> target : _ $1, key={s}.
player >E> target : _ $1, key={d}.
player >W> target : _ $1, key={a}.

// Player pushes crate onto empty space
player >N> crate >N> _ : _ $1 crate, key={w}.
player >S> crate >S> _ : _ $1 crate, key={s}.
player >E> crate >E> _ : _ $1 crate, key={d}.
player >W> crate >W> _ : _ $1 crate, key={a}.

// Player pushes crate onto target (score!)
player >N> crate >N> target : _ $1 goal, key={w} score=1.
player >S> crate >S> target : _ $1 goal, key={s} score=1.
player >E> crate >E> target : _ $1 goal, key={d} score=1.
player >W> crate >W> target : _ $1 goal, key={a} score=1.
`;

const ecosystemGrammar = `// Ecosystem - A prey-predator-plant simulation
// Watch plants grow, herbivores graze, and predators hunt.

// Plants grow on empty ground
soil : plant, rate=0.05.

// Plants spread to adjacent soil
plant soil : plant plant, rate=0.02.

// Herbivores eat plants (reproduce by eating)
herbivore plant : herbivore herbivore, rate=2.

// Herbivores wander
herbivore soil : soil herbivore, rate=0.5.

// Herbivores starve without food (slow death)
herbivore : soil, rate=0.02.

// Predators eat herbivores (reproduce by eating)
predator herbivore : predator predator, rate=3.

// Predators wander
predator soil : soil predator, rate=1.

// Predators starve without prey (faster than herbivores)
predator : soil, rate=0.05.
`;

const rpsGrammar = `// Rock-Paper-Scissors ecosystem
drifter _ : $2 $1, rate=999.
rock = drifter.
scissors = drifter.
paper = drifter.
drifter : _, rate=0.01.
drifter _ : $1 $1, rate=0.05.
drifter drifter : _ _, rate=0.01.
rock scissors : $1 $1, rate=999.
scissors paper : $1 $1, rate=999.
paper rock : $1 $1, rate=999.
`;

const sandpileGrammar = `// Abelian Sandpile
bee : _.
sandpile : $1/0.
sandpile/[0123] : $1/@add(@int(1),$#1), rate=0.1.
sandpile/4 : avalanche/@F4~1.
avalanche/?[1234] _ : $1/@clock($1#1)@sub($1#2,@int(1)) sandpile/1, rate=10.
avalanche/?[1234] sandpile/[0123] : $1/@clock($1#1)@sub($1#2,@int(1)) $2/@add(@int(1),$2#1), rate=10.
avalanche/?0 : sandpile/0~1.
`;

const presets = {
  "Diffusion": {
    grammar: diffuseGrammar,
    size: 32,
    setup: (board) => {
      for (let i = 0; i < 100; i++) {
        const x = Math.floor(Math.random() * board.size);
        const y = Math.floor(Math.random() * board.size);
        board.setCellTypeByName(x, y, 'x');
      }
    },
    icons: {
      _: { defaultColor: "black" },
      x: { defaultColor: "cyan" },
    },
  },

  "Forest Fire": {
    grammar: forestFireGrammar,
    size: 32,
    setup: (board) => {
      for (let y = 0; y < board.size; y++)
        for (let x = 0; x < board.size; x++)
          board.setCellTypeByName(x, y, Math.random() < 0.6 ? 'tree' : 'grass');
      board.setCellTypeByName(16, 16, 'fireman', '', { id: 'Player' });
    },
    icons: {
      _: { defaultColor: "black" },
      tree: { name: "pine-tree", color: "green", defaultColor: "green" },
      grass: { name: "grass", color: "limegreen", defaultColor: "limegreen" },
      fire: { name: "fire", color: "orangered", defaultColor: "orangered" },
      ash: { defaultColor: "gray" },
      water: { name: "droplet", color: "dodgerblue", defaultColor: "dodgerblue" },
      fireman: { name: "person", color: "yellow", defaultColor: "yellow" },
    },
  },

  "Sokoban": {
    grammar: sokobanGrammar,
    size: 16,
    setup: (board) => {
      // Walls
      for (let i = 2; i <= 13; i++) {
        board.setCellTypeByName(i, 2, 'wall');
        board.setCellTypeByName(i, 13, 'wall');
        board.setCellTypeByName(2, i, 'wall');
        board.setCellTypeByName(13, i, 'wall');
      }
      // Crates
      board.setCellTypeByName(5, 5, 'crate');
      board.setCellTypeByName(8, 6, 'crate');
      board.setCellTypeByName(6, 9, 'crate');
      // Targets
      board.setCellTypeByName(10, 4, 'target');
      board.setCellTypeByName(10, 8, 'target');
      board.setCellTypeByName(4, 10, 'target');
      // Player
      board.setCellTypeByName(7, 7, 'player', '', { id: 'Player' });
    },
    icons: {
      _: { defaultColor: "black" },
      player: { name: "person", color: "dodgerblue", defaultColor: "dodgerblue" },
      crate: { name: "cube", color: "sienna", defaultColor: "sienna" },
      target: { name: "archery-target", color: "gold", defaultColor: "gold" },
      goal: { name: "trophy", color: "lime", defaultColor: "lime" },
      wall: { name: "brick-wall", color: "slategray", defaultColor: "slategray" },
    },
  },

  "Ecosystem": {
    grammar: ecosystemGrammar,
    size: 32,
    setup: (board) => {
      for (let y = 0; y < board.size; y++)
        for (let x = 0; x < board.size; x++) {
          const r = Math.random();
          if (r < 0.3) board.setCellTypeByName(x, y, 'plant');
          else if (r < 0.35) board.setCellTypeByName(x, y, 'herbivore');
          else if (r < 0.37) board.setCellTypeByName(x, y, 'predator');
          else board.setCellTypeByName(x, y, 'soil');
        }
    },
    icons: {
      _: { defaultColor: "black" },
      soil: { defaultColor: "#3d2b1f" },
      plant: { name: "grass", color: "limegreen", defaultColor: "limegreen" },
      herbivore: { name: "rabbit", color: "wheat", defaultColor: "wheat" },
      predator: { name: "wolf-head", color: "orangered", defaultColor: "orangered" },
    },
  },

  "Rock-Paper-Scissors": {
    grammar: rpsGrammar,
    size: 32,
    setup: (board) => {
      for (let y = 0; y < board.size; y++)
        for (let x = 0; x < board.size; x++) {
          const r = Math.random();
          if (r < 0.3) board.setCellTypeByName(x, y, 'rock');
          else if (r < 0.6) board.setCellTypeByName(x, y, 'scissors');
          else if (r < 0.9) board.setCellTypeByName(x, y, 'paper');
        }
    },
    icons: {
      _: { defaultColor: "black" },
      rock: { name: "rock", color: "slategray", defaultColor: "slategray" },
      scissors: { name: "scissors", color: "crimson", defaultColor: "crimson" },
      paper: { name: "scroll-unfurled", color: "wheat", defaultColor: "wheat" },
    },
  },

  "Sandpile": {
    grammar: sandpileGrammar,
    size: 32,
    setup: (board) => {
      for (let y = 0; y < board.size; y++)
        for (let x = 0; x < board.size; x++)
          board.setCellTypeByName(x, y, 'sandpile', '0');
    },
    icons: {
      _: { defaultColor: "black" },
      sandpile: { name: "mesh-ball", color: "sandybrown", defaultColor: "sandybrown" },
      avalanche: { name: "mesh-ball", color: "orangered", defaultColor: "orangered" },
    },
  },
};

export default presets;
