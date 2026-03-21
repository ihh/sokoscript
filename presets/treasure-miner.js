// Treasure Miner — dig for gems, avoid falling rocks!

export default {
  name: 'Treasure Miner',
  grammar: `// Treasure Miner — dig for gems, avoid falling rocks!
// Move with WASD. Dig through dirt to find gems. Rocks fall down.

// Player digs dirt (converts to tunnel)
player >N> dirt : ground $1, key={w}.
player >S> dirt : ground $1, key={s}.
player >E> dirt : ground $1, key={d}.
player >W> dirt : ground $1, key={a}.

// Player digs into gem — score!
player >N> gem : ground $1, key={w} score=1.
player >S> gem : ground $1, key={s} score=1.
player >E> gem : ground $1, key={d} score=1.
player >W> gem : ground $1, key={a} score=1.

// Player movement on ground (tunnels)
player >N> ground : ground $1, key={w}.
player >S> ground : ground $1, key={s}.
player >E> ground : ground $1, key={d}.
player >W> ground : ground $1, key={a}.

// Gravity: rocks fall into empty space below
rock >S> ground : ground rock, rate=10.

// Falling rock crushes player
rock >S> player : ground rock, rate=10.
`,
  size: 12,
  icons: {
    ground: { name: 'square', color: '#333' },
    dirt: { name: 'square-full', color: '#8B4513' },
    rock: { name: 'square-full', color: '#666' },
    gem: { name: 'gem', color: 'cyan' },
    player: { name: 'person-digging', color: 'orange' },
  },
  setup: (board) => {
    // Fill with dirt
    for (let x = 0; x < board.size; x++)
      for (let y = 0; y < board.size; y++)
        board.setCellTypeByName(x, y, 'dirt');
    // Rock layer at top rows
    for (let x = 0; x < board.size; x++)
      for (let y = 0; y < 3; y++)
        board.setCellTypeByName(x, y, 'rock');
    // Scatter gems
    const gems = [[2,5],[4,7],[7,4],[9,8],[5,10],[10,6],[3,9],[8,3]];
    for (const [x,y] of gems)
      board.setCellTypeByName(x, y, 'gem');
    // Player at bottom
    board.setCellTypeByName(6, 11, 'player', '', { id: 'Player' });
    // Clear starting area
    board.setCellTypeByName(6, 10, 'ground');
    board.setCellTypeByName(6, 11, 'player', '', { id: 'Player' });
  },
};
