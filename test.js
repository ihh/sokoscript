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
  const text = fs.readFileSync(filename).toString();
  const grammar = parse(text);
  const out = serialize(grammar);
  console.log(out);
})

