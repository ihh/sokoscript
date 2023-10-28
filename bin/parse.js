#!/usr/bin/env node

import { serialize } from '../src/serialize.js';
import { makeGrammarIndex, expandInherits, compileTypes, parseOrUndefined, grammarIndexToRuleList, compiledGrammarIndexToRuleList } from '../src/gramutil.js';

import fs from 'fs';
import getopt from 'node-getopt';

// parse command-line options
const opt = getopt.create([
  ['x' , 'expand'           , 'expand inheritance relationships'],
  ['c' , 'compile'          , 'compile types'],
  ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
    .bindHelp()     // bind option 'help' to default action
    .parseSystem() // parse command line

opt.argv.forEach ((filename) => {
  const text = fs.readFileSync(filename).toString() || '';
  let rules = parseOrUndefined (text, (err) => { console.error(`File "${filename}":\n`, err); process.exit() });
  if (opt.options.compile) {
    if (opt.options.expand)
      console.warn ("Warning: specifying --expand with --compile is redundant")
    rules = compiledGrammarIndexToRuleList (compileTypes (rules), true);
  } else if (opt.options.expand) {
    rules = grammarIndexToRuleList (expandInherits (makeGrammarIndex (rules)), true);
  }
  const out = serialize(rules);
  console.log(out);
})

