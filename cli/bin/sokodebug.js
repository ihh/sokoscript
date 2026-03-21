#!/usr/bin/env node

// SokoScript Terminal Debugger
// Usage: node cli/bin/sokodebug.js [--size N] [--preset NAME] [grammar-or-board-file]

import { readFileSync } from 'fs';
import { Board } from '../../src/board.js';
import { TerminalApp } from '../lib/terminal/app.js';
import presets from '../../presets/index.js';

const args = process.argv.slice(2);
let size = 16;
let file = null;
let presetName = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--size' && i + 1 < args.length) {
        size = parseInt(args[++i]);
    } else if (args[i] === '--preset' && i + 1 < args.length) {
        presetName = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log('Usage: sokodebug [--size N] [--preset NAME] [grammar.txt | board.json]');
        console.log('');
        console.log('Options:');
        console.log('  --size N       Board size (default 16, ignored for .json files)');
        console.log('  --preset NAME  Load a built-in preset');
        console.log('');
        console.log('Presets: ' + Object.keys(presets).join(', '));
        console.log('');
        console.log('Controls:');
        console.log('  Tab/Shift-Tab  Cycle pane focus');
        console.log('  Space          Toggle run/pause');
        console.log('  n              Step one event');
        console.log('  Arrows         Move cursor (Shift for 8x)');
        console.log('  Home           Center on player');
        console.log('  z              Toggle zoom');
        console.log('  Ctrl-C         Quit');
        console.log('');
        console.log('In command pane: "preset NAME" or "presets" to list');
        process.exit(0);
    } else {
        file = args[i];
    }
}

let board;

if (presetName) {
    // Find preset by name (case-insensitive)
    let preset = presets[presetName];
    if (!preset) {
        const lower = presetName.toLowerCase();
        const key = Object.keys(presets).find(k => k.toLowerCase() === lower);
        if (key) preset = presets[key];
    }
    if (!preset) {
        console.error(`Unknown preset: ${presetName}`);
        console.error('Available: ' + Object.keys(presets).join(', '));
        process.exit(1);
    }
    board = new Board({ size: preset.size, grammar: preset.grammar });
    if (preset.setup) preset.setup(board);
} else if (file) {
    const content = readFileSync(file, 'utf-8');
    if (file.endsWith('.json')) {
        const json = JSON.parse(content);
        board = new Board(json);
    } else {
        board = new Board({ size, grammar: content });
    }
} else {
    // No file, no preset — start with empty board and diffusion grammar
    board = new Board({ size, grammar: 'bee _ : $2 $1.\n' });
}

const app = new TerminalApp(board);
app.start();
