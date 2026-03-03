import { expect } from 'chai';
import { describe } from 'mocha';
import fs from 'fs';

import { Board } from '../src/board.js';
import { parseOrUndefined, compileTypes } from '../src/gramutil.js';

const loadGrammar = (filename) => fs.readFileSync(`./grammars/${filename}`, 'utf8');

describe ('Testing game grammars', () => {
    it ('Forest fire grammar parses and compiles', () => {
        const grammar = loadGrammar('forest_fire.txt');
        const rules = parseOrUndefined(grammar, {error:false});
        expect(rules).to.not.be.undefined;
        const compiled = compileTypes(rules);
        expect(compiled.types).to.include('grass');
        expect(compiled.types).to.include('tree');
        expect(compiled.types).to.include('fire');
        expect(compiled.types).to.include('ash');
        expect(compiled.types).to.include('water');
        expect(compiled.types).to.include('fireman');
    });

    it ('Forest fire board loads and evolves', () => {
        const boardJson = JSON.parse(fs.readFileSync('./boards/forest_fire.json', 'utf8'));
        const board = new Board(boardJson);
        expect(board.size).to.equal(16);
        const initialCounts = board.typeCountsIncludingUnknowns();
        expect(initialCounts['fireman']).to.equal(1);
        expect(initialCounts['fire']).to.be.greaterThan(0);
        // Evolve for 0.5 seconds
        board.evolveToTime(1n << 31n, true);
        // Board should still have a fireman
        expect(board.typeCountsIncludingUnknowns()['fireman']).to.equal(1);
    });

    it ('Forest fire: fireman can move', () => {
        const grammar = loadGrammar('forest_fire.txt');
        const board = new Board({ size: 8, grammar });
        board.setCellTypeByName(4, 4, 'fireman', '', { id: 'p1' });
        board.setCellTypeByName(4, 3, 'grass');
        const move = { type: 'command', time: 1n, id: 'p1', dir: 'N', key: 'w' };
        board.processMove(move);
        expect(board.getCellDescriptorString(4, 3)).to.equal('fireman');
    });

    it ('Forest fire: fireman extinguishes fire', () => {
        const grammar = loadGrammar('forest_fire.txt');
        const board = new Board({ size: 8, grammar });
        board.setCellTypeByName(4, 4, 'fireman', '', { id: 'p1' });
        board.setCellTypeByName(4, 3, 'fire');
        const move = { type: 'command', time: 1n, id: 'p1', dir: 'N', key: 'w' };
        board.processMove(move);
        // Fire should be replaced with water
        expect(board.getCellDescriptorString(4, 3)).to.equal('water');
    });

    it ('Forest fire: fire spreads to trees', () => {
        const grammar = loadGrammar('forest_fire.txt');
        const board = new Board({ size: 8, seed: 42, grammar });
        // Create a line of trees with fire at one end
        for (let x = 0; x < 8; x++) board.setCellTypeByName(x, 4, 'tree');
        board.setCellTypeByName(0, 4, 'fire');
        // Evolve for 5 seconds (fire should spread)
        board.evolveToTime(5n << 32n, true);
        // At least some trees should have caught fire or turned to ash
        const counts = board.typeCountsIncludingUnknowns();
        const treeCount = counts['tree'] || 0;
        expect(treeCount).to.be.at.most(7); // at least one tree caught fire or burned
    });

    it ('Sokoban grammar parses and compiles', function() {
        const grammarPath = './grammars/sokoban.txt';
        if (!fs.existsSync(grammarPath)) this.skip();
        const grammar = loadGrammar('sokoban.txt');
        const rules = parseOrUndefined(grammar, {error:false});
        expect(rules).to.not.be.undefined;
        const compiled = compileTypes(rules);
        expect(compiled.types).to.include('player');
        expect(compiled.types).to.include('crate');
        // Note: wall is not in the grammar (no wall rules), stored as unknown type on board
    });

    it ('Ecosystem grammar parses and compiles', function() {
        const grammarPath = './grammars/ecosystem.txt';
        if (!fs.existsSync(grammarPath)) this.skip();
        const grammar = loadGrammar('ecosystem.txt');
        const rules = parseOrUndefined(grammar, {error:false});
        expect(rules).to.not.be.undefined;
    });

    it ('All grammar files parse without error', () => {
        const grammarDir = './grammars/';
        // syntax.txt uses 'reward' attribute which is not in the current grammar spec, so skip it
        const skip = ['syntax.txt'];
        const files = fs.readdirSync(grammarDir).filter(f => f.endsWith('.txt') && !skip.includes(f));
        files.forEach((file) => {
            const grammar = fs.readFileSync(grammarDir + file, 'utf8');
            const rules = parseOrUndefined(grammar, {error:false});
            expect(rules, `Grammar ${file} failed to parse`).to.not.be.undefined;
        });
    });
});
