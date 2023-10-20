#!/usr/bin/env node
// emacs mode -*-JavaScript-*-

import { serialize } from './serialize.js';
import { expandInherits } from './gramutil.js';

// ugh: https://github.com/pegjs/pegjs/issues/423
import { parse } from './grammar.js';

import fs from 'fs';
import getopt from 'node-getopt';

// parse command-line options
const opt = getopt.create([
  ['x' , 'expand'           , 'expand inheritance'],
  ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
    .bindHelp()     // bind option 'help' to default action
    .parseSystem() // parse command line

opt.argv.forEach ((filename) => {
  const text = fs.readFileSync(filename).toString() || '';
  let grammar;
  try {
    grammar = parse(text);
  } catch (e) {
    if (e.location) {
      const line = text.split("\n")[e.location.start.line - 1];
      const arrow = '-'.repeat(e.location.start.column - 1) + '^';
      console.error(`File "${filename}", line ${e.location.start.line}, column ${e.location.start.column}:`);
      console.error(e.message);
      console.error(line);
      console.error(arrow);
    } else
      console.error(e);
    process.exit();
  }
  if (opt.options.expand) {
    let transform = expandInherits (grammar);
    let rules = [];
    Object.keys(transform).sort().forEach((type) => rules = rules.concat(transform[type]));
    grammar = rules;
  }
  const out = serialize(grammar);
  console.log(out);
})

