// Key and Door — find the key, then unlock the door!

export default {
  name: 'Key & Door',
  grammar: `// Key and Door — find the key, then unlock the door!
// Move with WASD. Pick up the key, then open the door for score.

// Wall is an obstacle (identity rule to register the type)
wall : wall, rate=0.

// Player picks up key (gains key state, $1/k preserves player ID)
player >N> key : ground $1/k, key={w}.
player >S> key : ground $1/k, key={s}.
player >E> key : ground $1/k, key={d}.
player >W> key : ground $1/k, key={a}.

// Player with key opens door — score! ($1 preserves player ID)
player/k >N> door : ground $1, key={w} score=10.
player/k >S> door : ground $1, key={s} score=10.
player/k >E> door : ground $1, key={d} score=10.
player/k >W> door : ground $1, key={a} score=10.

// Player movement on ground (any state)
player >N> ground : ground $1, key={w}.
player >S> ground : ground $1, key={s}.
player >E> ground : ground $1, key={d}.
player >W> ground : ground $1, key={a}.

player/k >N> ground : ground $1, key={w}.
player/k >S> ground : ground $1, key={s}.
player/k >E> ground : ground $1, key={d}.
player/k >W> ground : ground $1, key={a}.
`,
  size: 8,
  icons: {
    ground: { name: 'square', color: '#555' },
    wall: { name: 'square-full', color: '#222' },
    key: { name: 'key', color: 'gold' },
    door: { name: 'door-closed', color: 'saddlebrown' },
    player: { name: 'person-walking', color: 'dodgerblue' },
  },
  setup: (board) => {
    for (let x = 0; x < board.size; x++)
      for (let y = 0; y < board.size; y++)
        board.setCellTypeByName(x, y, 'ground');
    // Walls forming a simple maze
    for (let x = 0; x < board.size; x++) {
      board.setCellTypeByName(x, 3, 'wall');
    }
    board.setCellTypeByName(2, 3, 'ground'); // gap in wall
    // Place key, door, player
    board.setCellTypeByName(6, 1, 'key');
    board.setCellTypeByName(5, 5, 'door');
    board.setCellTypeByName(1, 6, 'player', '', { id: 'Player' });
  },
};
