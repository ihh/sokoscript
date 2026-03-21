import { expect } from 'chai';
import { describe } from 'mocha';

import { Board } from '../src/board.js';

describe ('Testing the Board', () => {
    it ('Board creation with defaults', () => {
        const board = new Board();
        expect(board.size).to.equal(64);
        expect(board.cell.length).to.equal(64 * 64);
        expect(board.time).to.equal(0n);
    });

    it ('Board creation with custom size', () => {
        const board = new Board({ size: 8 });
        expect(board.size).to.equal(8);
        expect(board.cell.length).to.equal(64);
    });

    it ('Coordinate wrapping (toroidal)', () => {
        const board = new Board({ size: 8 });
        // Positive wrap
        expect(board.xy2index(0, 0)).to.equal(board.xy2index(8, 8));
        expect(board.xy2index(3, 5)).to.equal(board.xy2index(11, 13));
        // Negative wrap
        expect(board.xy2index(0, 0)).to.equal(board.xy2index(-8, -8));
        expect(board.xy2index(7, 7)).to.equal(board.xy2index(-1, -1));
    });

    it ('Grammar initialization', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        expect(board.grammar.types).to.include('bee');
        expect(board.grammar.types).to.include('_');
        expect(board.grammar.typeIndex['bee']).to.be.a('number');
        expect(board.grammar.typeIndex['_']).to.equal(0);
    });

    it ('Set and get cells by name', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        board.setCellTypeByName(1, 2, 'bee');
        const desc = board.getCellDescriptorString(1, 2);
        expect(desc).to.equal('bee');
        board.setCellTypeByName(1, 2, '_');
        expect(board.getCellDescriptorString(1, 2)).to.equal('_');
    });

    it ('Set cell with state', () => {
        const board = new Board({ size: 4, grammar: 'bee/? : bee.' });
        board.setCellTypeByName(0, 0, 'bee', 'x');
        const desc = board.getCellDescriptorString(0, 0);
        expect(desc).to.equal('bee/x');
    });

    it ('Cell ID tracking', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        board.setCellTypeByName(2, 3, 'bee', '', { id: 'player1' });
        expect(board.byID['player1']).to.equal(board.xy2index(2, 3));
        // Move the cell
        board.setCellTypeByName(1, 1, 'bee', '', { id: 'player1' });
        expect(board.byID['player1']).to.equal(board.xy2index(1, 1));
    });

    it ('Unique ID generation', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        board.setCellTypeByName(0, 0, 'bee', '', { id: 'bee1' });
        const id2 = board.getUniqueID('bee');
        expect(id2).to.equal('bee2');
        board.setCellTypeByName(1, 0, 'bee', '', { id: id2 });
        const id3 = board.getUniqueID('bee');
        expect(id3).to.equal('bee3');
    });

    it ('Type counts', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        const initialCounts = board.typeCountsIncludingUnknowns();
        expect(initialCounts['_']).to.equal(16);
        expect(initialCounts['bee']).to.equal(0);
        board.setCellTypeByName(0, 0, 'bee');
        board.setCellTypeByName(1, 0, 'bee');
        const counts = board.typeCountsIncludingUnknowns();
        expect(counts['bee']).to.equal(2);
        expect(counts['_']).to.equal(14);
    });

    it ('JSON serialization round-trip', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        board.setCellTypeByName(2, 2, 'bee');
        board.setCellTypeByName(3, 1, 'bee', 'x');
        const json = board.toJSON();
        const board2 = new Board(json);
        expect(board2.size).to.equal(board.size);
        expect(board2.getCellDescriptorString(2, 2)).to.equal('bee');
        expect(board2.getCellDescriptorString(3, 1)).to.equal('bee/x');
        expect(board2.getCellDescriptorString(0, 0)).to.equal('_');
    });

    it ('Unknown type handling', () => {
        const board = new Board({ size: 4, grammar: 'bee _ : _ bee.' });
        board.setCellTypeByName(0, 0, 'dragon');
        const cell = board.getCell(0, 0);
        expect(cell.type).to.equal(board.grammar.unknownType);
        expect(cell.meta.type).to.equal('dragon');
    });

    it ('Deterministic evolution with same seed', () => {
        const grammar = 'bee _ : _ bee.';
        const board1 = new Board({ size: 4, seed: 42, grammar });
        const board2 = new Board({ size: 4, seed: 42, grammar });
        // Place same bees on both boards
        board1.setCellTypeByName(2, 2, 'bee');
        board2.setCellTypeByName(2, 2, 'bee');
        // Evolve both to the same time
        const t = (1n << 32n);  // 1 second
        board1.evolveToTime(t, true);
        board2.evolveToTime(t, true);
        // Boards should be identical
        expect(board1.toString()).to.equal(board2.toString());
    });

    it ('Different seeds produce different evolution', () => {
        const grammar = 'bee _ : _ bee, rate=100.';
        const board1 = new Board({ size: 4, seed: 1, grammar });
        const board2 = new Board({ size: 4, seed: 2, grammar });
        board1.setCellTypeByName(2, 2, 'bee');
        board2.setCellTypeByName(2, 2, 'bee');
        const t = (1n << 32n);
        board1.evolveToTime(t, true);
        board2.evolveToTime(t, true);
        // Very unlikely to be identical with different seeds and enough evolution
        expect(board1.toString()).to.not.equal(board2.toString());
    });

    it ('Simple diffusion rule evolves', () => {
        const board = new Board({ size: 4, seed: 42, grammar: 'bee _ : _ bee, rate=100.' });
        board.setCellTypeByName(0, 0, 'bee');
        const initialCount = board.typeCountsIncludingUnknowns();
        expect(initialCount['bee']).to.equal(1);
        // Evolve 1 second
        board.evolveToTime(1n << 32n, true);
        // Bee count should still be 1 (diffusion conserves particles)
        const finalCount = board.typeCountsIncludingUnknowns();
        expect(finalCount['bee']).to.equal(1);
    });

    it ('Sync rules execute', () => {
        // Sync rule: all bees become ants every 1 second
        const board = new Board({ size: 4, seed: 42, grammar: 'bee : ant, sync=1.' });
        board.setCellTypeByName(0, 0, 'bee');
        board.setCellTypeByName(1, 1, 'bee');
        expect(board.typeCountsIncludingUnknowns()['bee']).to.equal(2);
        // Evolve past the sync point
        board.evolveToTime(2n << 32n, true);
        expect(board.typeCountsIncludingUnknowns()['bee'] || 0).to.equal(0);
        expect(board.typeCountsIncludingUnknowns()['ant']).to.equal(2);
    });

    it ('Player command processing', () => {
        // Player can push crate forward
        const board = new Board({ size: 8, grammar: 'player _ : _ player, command={move}.' });
        board.setCellTypeByName(4, 4, 'player', '', { id: 'p1' });
        const move = {
            type: 'command',
            time: 1n,
            user: undefined,
            id: 'p1',
            dir: 'N',
            command: 'move'
        };
        board.processMove(move);
        // Player should have moved north
        expect(board.getCellDescriptorString(4, 3)).to.equal('player');
        expect(board.getCellDescriptorString(4, 4)).to.equal('_');
    });

    it ('Key/command rules do not fire spontaneously', () => {
        // Rules with key or command should only fire via processMove, not async evolution
        const board = new Board({ size: 4, seed: 42, grammar: 'player _ : _ player, key={w}.' });
        board.setCellTypeByName(2, 2, 'player', '', { id: 'p1' });
        const initialPos = board.byID['p1'];
        // Evolve for 5 seconds — player should NOT move spontaneously
        board.evolveToTime(5n << 32n, true);
        expect(board.byID['p1']).to.equal(initialPos);
    });

    it ('RangeCounter operations', () => {
        // RangeCounter is tested indirectly through Board type tracking
        const board = new Board({ size: 4, grammar: 'a _ : _ a. b _ : _ b.' });
        // All 16 cells start as empty
        expect(board.byType[0].total()).to.equal(16); // empty type
        board.setCellTypeByName(0, 0, 'a');
        board.setCellTypeByName(1, 0, 'a');
        board.setCellTypeByName(2, 0, 'b');
        expect(board.byType[0].total()).to.equal(13);
        const aTypeIdx = board.grammar.typeIndex['a'];
        const bTypeIdx = board.grammar.typeIndex['b'];
        expect(board.byType[aTypeIdx].total()).to.equal(2);
        expect(board.byType[bTypeIdx].total()).to.equal(1);
        // Remove a cell
        board.setCellTypeByName(0, 0, '_');
        expect(board.byType[aTypeIdx].total()).to.equal(1);
        expect(board.byType[0].total()).to.equal(14);
    });

    it ('Trace replay reproduces exact board state', () => {
        // Grammar with both async rules and player-controlled key rules
        const grammar = [
            'bee _ : _ bee, rate=10.',
            'player >N> _ : _ $1, key={w}.',
            'player >S> _ : _ $1, key={s}.',
            'player >E> _ : _ $1, key={d}.',
            'player >W> _ : _ $1, key={a}.',
        ].join('\n');
        const board = new Board({ size: 8, seed: 42, grammar });
        board.setCellTypeByName(4, 4, 'player', '', { id: 'p1' });
        board.setCellTypeByName(1, 1, 'bee');
        board.setCellTypeByName(6, 6, 'bee');
        board.setCellTypeByName(3, 5, 'bee');

        // Re-init to capture the placed cells in the init trace entry
        board.updateGrammar(grammar);

        const sec = 1n << 32n;

        // Simulate player moves at specific times, interleaved with async evolution
        const moves = [
            { type: 'command', time: sec / 2n,     id: 'p1', dir: 'N', key: 'w' },
            { type: 'command', time: sec,           id: 'p1', dir: 'E', key: 'd' },
            { type: 'command', time: sec * 3n / 2n, id: 'p1', dir: 'E', key: 'd' },
            { type: 'command', time: sec * 2n,      id: 'p1', dir: 'S', key: 's' },
        ];

        for (const move of moves) {
            board.evolveToTime(move.time, true);
            board.processMove(move);
        }
        const finalTime = sec * 3n;
        board.evolveToTime(finalTime, true);

        // Extract replay log
        const log = board.replayLog();
        expect(log).to.not.be.null;
        expect(log.moves).to.have.length(4);

        // Replay on a fresh board
        const replayed = Board.replay(log);

        // Verify exact match
        expect(replayed.toJSON().cell).to.deep.equal(board.toJSON().cell);
        expect(replayed.time).to.equal(board.time);
        expect(replayed.rng.mt).to.deep.equal(board.rng.mt);
    });

    it ('Trace replay with no player moves (pure async)', () => {
        const grammar = 'bee _ : _ bee, rate=50.';
        const board = new Board({ size: 4, seed: 123, grammar });
        board.setCellTypeByName(2, 2, 'bee');
        board.setCellTypeByName(0, 3, 'bee');
        board.updateGrammar(grammar);

        const finalTime = 2n << 32n;
        board.evolveToTime(finalTime, true);

        const log = board.replayLog();
        expect(log.moves).to.have.length(0);

        const replayed = Board.replay(log);
        expect(replayed.toJSON().cell).to.deep.equal(board.toJSON().cell);
        expect(replayed.time).to.equal(board.time);
    });

    it ('Trace replay with sync rules and player moves', () => {
        const grammar = [
            'bee : ant, sync=2.',
            'player >N> _ : _ $1, key={w}.',
        ].join('\n');
        const board = new Board({ size: 4, seed: 99, grammar });
        board.setCellTypeByName(2, 2, 'player', '', { id: 'p1' });
        board.setCellTypeByName(0, 0, 'bee');
        board.setCellTypeByName(3, 3, 'bee');
        board.updateGrammar(grammar);

        const sec = 1n << 32n;
        const moves = [
            { type: 'command', time: sec / 4n, id: 'p1', dir: 'N', key: 'w' },
            { type: 'command', time: sec * 3n / 4n, id: 'p1', dir: 'N', key: 'w' },
        ];

        for (const move of moves) {
            board.evolveToTime(move.time, true);
            board.processMove(move);
        }
        const finalTime = sec * 2n;
        board.evolveToTime(finalTime, true);

        const log = board.replayLog();
        const replayed = Board.replay(log);
        expect(replayed.toJSON().cell).to.deep.equal(board.toJSON().cell);
        expect(replayed.time).to.equal(board.time);
        expect(replayed.rng.mt).to.deep.equal(board.rng.mt);
    });

    it ('Replay log size is O(player input), not O(total events)', () => {
        // High-rate async rule generates many events; only player moves matter for replay
        const grammar = [
            'bee _ : _ bee, rate=100.',
            'player >N> _ : _ $1, key={w}.',
            'player >S> _ : _ $1, key={s}.',
            'player >E> _ : _ $1, key={d}.',
            'player >W> _ : _ $1, key={a}.',
        ].join('\n');
        const board = new Board({ size: 8, seed: 42, grammar });
        board.setCellTypeByName(4, 4, 'player', '', { id: 'p1' });
        for (let i = 0; i < 10; i++)
            board.setCellTypeByName(i % 8, Math.floor(i / 8), 'bee');
        board.updateGrammar(grammar);

        const sec = 1n << 32n;
        const playerMoves = [
            { type: 'command', time: sec,       id: 'p1', dir: 'N', key: 'w' },
            { type: 'command', time: sec * 2n,   id: 'p1', dir: 'E', key: 'd' },
            { type: 'command', time: sec * 3n,   id: 'p1', dir: 'S', key: 's' },
        ];

        for (const move of playerMoves) {
            board.evolveToTime(move.time, true);
            board.processMove(move);
        }
        board.evolveToTime(sec * 4n, true);

        // Full trace has many async events
        const allEvents = board.trace.toArray();
        const asyncCount = allEvents.filter(e => e.type === 'async').length;
        expect(asyncCount).to.be.greaterThan(50); // many async events fired

        // Replay log only has player moves
        const log = board.replayLog();
        expect(log.moves).to.have.length(3); // exactly 3 player inputs
        expect(log.moves.length).to.be.lessThan(asyncCount / 10);

        // And it replays exactly
        const replayed = Board.replay(log);
        expect(replayed.toJSON().cell).to.deep.equal(board.toJSON().cell);
        expect(replayed.time).to.equal(board.time);
        expect(replayed.rng.mt).to.deep.equal(board.rng.mt);
    });
});
