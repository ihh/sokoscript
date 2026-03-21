// Predator-Prey — collect apples while avoiding predators!

export default {
  name: 'Predator-Prey',
  grammar: `// Predator-Prey — collect apples while avoiding predators!
// Move with WASD. Eat apples for score. Predators kill on contact.

// Food spawns on ground
ground : apple, rate=0.2.

// Predators diffuse randomly
predator >N> ground : ground predator, rate=2.
predator >S> ground : ground predator, rate=2.
predator >E> ground : ground predator, rate=2.
predator >W> ground : ground predator, rate=2.

// Predator kills player
predator >N> player : predator ground, rate=999.
predator >S> player : predator ground, rate=999.
predator >E> player : predator ground, rate=999.
predator >W> player : predator ground, rate=999.

// Player eats apple — score
player >N> apple : ground $1, key={w} score=1.
player >S> apple : ground $1, key={s} score=1.
player >E> apple : ground $1, key={d} score=1.
player >W> apple : ground $1, key={a} score=1.

// Player movement on ground
player >N> ground : ground $1, key={w}.
player >S> ground : ground $1, key={s}.
player >E> ground : ground $1, key={d}.
player >W> ground : ground $1, key={a}.
`,
  size: 16,
  icons: {
    ground: { name: 'square', color: '#2d5a1e' },
    apple: { name: 'apple-whole', color: 'crimson' },
    predator: { name: 'skull', color: 'darkred' },
    player: { name: 'person-running', color: 'dodgerblue' },
  },
  setup: (board) => {
    for (let x = 0; x < board.size; x++)
      for (let y = 0; y < board.size; y++)
        board.setCellTypeByName(x, y, 'ground');
    board.setCellTypeByName(8, 8, 'player', '', { id: 'Player' });
    // Place predators at edges
    board.setCellTypeByName(0, 0, 'predator');
    board.setCellTypeByName(15, 0, 'predator');
    board.setCellTypeByName(0, 15, 'predator');
  },
};
