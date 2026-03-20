#!/usr/bin/env node

// SokoScript Terminal Debugger
// Usage: node cli/bin/sokodebug.js [--size N] <grammar-or-board-file>

import { readFileSync } from 'fs';
import { Board } from '../../src/board.js';
import { TerminalApp } from '../lib/terminal/app.js';

const args = process.argv.slice(2);
let size = 16;
let file = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--size' && i + 1 < args.length) {
        size = parseInt(args[++i]);
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log('Usage: sokodebug [--size N] <grammar.txt | board.json>');
        console.log('');
        console.log('Options:');
        console.log('  --size N    Board size (default 16, ignored for .json files)');
        console.log('');
        console.log('Controls:');
        console.log('  Tab/Shift-Tab  Cycle pane focus');
        console.log('  Space          Toggle run/pause');
        console.log('  n              Step one event');
        console.log('  Arrows         Move cursor (Shift for 8x)');
        console.log('  Home           Center on player');
        console.log('  z              Toggle zoom');
        console.log('  WASD           Player controls (in map pane)');
        console.log('  Ctrl-C         Quit');
        process.exit(0);
    } else {
        file = args[i];
    }
}

if (!file) {
    console.error('Usage: sokodebug [--size N] <grammar.txt | board.json>');
    process.exit(1);
}

let board;
const content = readFileSync(file, 'utf-8');

if (file.endsWith('.json')) {
    const json = JSON.parse(content);
    board = new Board(json);
} else {
    // Treat as grammar file
    board = new Board({ size, grammar: content });
}

const app = new TerminalApp(board);
app.start();
