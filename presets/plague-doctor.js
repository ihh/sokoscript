// Plague Doctor — cure the sick before the plague consumes everyone!

export default {
  name: 'Plague Doctor',
  grammar: `// Plague Doctor — cure the sick before the plague consumes everyone!
// Move with WASD. Walk into sick villagers to cure them (score).

// Infection spreads between adjacent villagers
healthy >N> sick : sick sick, rate=0.3.
healthy >S> sick : sick sick, rate=0.3.
healthy >E> sick : sick sick, rate=0.3.
healthy >W> sick : sick sick, rate=0.3.

// Sick villagers die
sick : corpse, rate=0.1.

// Corpses become impassable graves
corpse : grave, rate=0.2.

// Player cures sick villagers — score
player >N> sick : $1 healthy, key={w} score=1.
player >S> sick : $1 healthy, key={s} score=1.
player >E> sick : $1 healthy, key={d} score=1.
player >W> sick : $1 healthy, key={a} score=1.

// Player movement on ground
player >N> ground : ground $1, key={w}.
player >S> ground : ground $1, key={s}.
player >E> ground : ground $1, key={d}.
player >W> ground : ground $1, key={a}.

// Player can walk over healthy villagers (pass through crowds)
player >N> healthy : healthy $1, key={w}.
player >S> healthy : healthy $1, key={s}.
player >E> healthy : healthy $1, key={d}.
player >W> healthy : healthy $1, key={a}.
`,
  size: 16,
  icons: {
    ground: { name: 'square', color: '#4a3728' },
    healthy: { name: 'person', color: 'limegreen' },
    sick: { name: 'face-dizzy', color: 'yellow' },
    corpse: { name: 'skull-crossbones', color: 'gray' },
    grave: { name: 'cross', color: '#555' },
    player: { name: 'user-doctor', color: 'white' },
  },
  setup: (board) => {
    // Fill board with healthy villagers
    for (let x = 0; x < board.size; x++)
      for (let y = 0; y < board.size; y++)
        board.setCellTypeByName(x, y, 'healthy');
    // Place player in center
    board.setCellTypeByName(8, 8, 'player', '', { id: 'Player' });
    // Initial sick at edges
    board.setCellTypeByName(0, 0, 'sick');
    board.setCellTypeByName(15, 15, 'sick');
    board.setCellTypeByName(15, 0, 'sick');
  },
};
