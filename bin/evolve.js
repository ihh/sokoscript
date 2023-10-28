#!/usr/bin/env node

import { compileTypes, parseOrUndefined } from '../src/gramutil.js';
import { Board } from '../src/board.js';

import fs from 'fs';
import getopt from 'node-getopt';

// parse command-line options
const defaultSeed = 42;
const opt = getopt.create([
  ['g' , 'grammar=PATH'     , 'specify grammar file'],
  ['s' , 'size=INT'         , 'specify board size (must be power of 2)'],
  ['b' , 'board=PATH'       , 'load initial board from file'],
  ['o' , 'owner=STRING'     , 'owner ID'],
  ['t' , 'time=FLOAT'       , 'time to evolve'],
  ['r' , 'rnd=INT'          , 'random seed (default '+defaultSeed+')'],
  ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
    .bindHelp()     // bind option 'help' to default action
    .parseSystem() // parse command line

const text = fs.readFileSync(opt.options.grammar).toString();
const rules = parseOrUndefined (text, (err) => { console.error(err); process.exit() });
const grammar = compileTypes (rules || []);

const board = new Board (parseInt(opt.options.size), grammar, opt.options.owner || 'owner', parseInt (opt.options.rnd || defaultSeed));
if (opt.options.board)
    board.initFromString (fs.readFileSync(opt.options.board).toString());

if (opt.options.time)
    board.evolveToTime (BigInt(Math.round(opt.options.time * (2**32))));

console.log (board.toString());
