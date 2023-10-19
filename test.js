#!/usr/bin/env node
// emacs mode -*-JavaScript-*-

const serialize = require('./serialize').serialize;
const parse = require('./grammar').parse;

const fs = require('fs'),
      getopt = require('node-getopt');

// parse command-line options
const opt = getopt.create([
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
    const line = text.split("\n")[e.location.start.line - 1];
    const arrow = '-'.repeat(e.location.start.column - 1) + '^';
    console.error(`File "${filename}", line ${e.location.start.line}, column ${e.location.start.column}:`);
    console.error(e.message);
    console.error(line);
    console.error(arrow);
    process.exit();
  }
  const out = serialize(grammar);
  console.log(out);
})

