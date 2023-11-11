#!/usr/bin/env node

import { Board } from '../src/board.js';

import fs from 'fs';
import getopt from 'node-getopt';

// parse command-line options
const defaultSeed = 42, defaultOwner = 'guest';
const opt = getopt.create([
  ['g' , 'grammar=PATH'     , 'specify grammar file'],
  ['s' , 'size=INT'         , 'specify board size (must be power of 2)'],
  ['b' , 'board=PATH'       , 'load initial board from file'],
  ['o' , 'owner=STRING'     , 'owner ID (default '+defaultOwner+')'],
  ['t' , 'time=FLOAT'       , 'time to evolve'],
  ['r' , 'rnd=INT'          , 'random seed (default '+defaultSeed+')'],
  ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
    .bindHelp()     // bind option 'help' to default action
    .parseSystem() // parse command line

let json = opt.options.board ? JSON.parse(fs.readFileSync(opt.options.board).toString()) : {};
if (opt.options.grammar)
    json.grammar = fs.readFileSync(opt.options.grammar).toString();
if (opt.options.size) {
    json.size = parseInt(opt.options.size);
    delete json.cell;
}
json.seed = opt.options.seed ? parseInt(opt.options.seed) : (json.seed || defaultSeed);
json.owner = opt.options.owner || json.owner || defaultOwner;

const board = new Board (json);
if (opt.options.time)
    board.evolveToTime (BigInt(Math.round(opt.options.time * (2**32))));

console.log (board.toString());
