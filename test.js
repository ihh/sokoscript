#!/usr/bin/env node
// emacs mode -*-JavaScript-*-

import { serialize } from './serialize.js';
import { makeGrammarIndex, expandInherits, compileTypes } from './gramutil.js';

// ugh: https://github.com/pegjs/pegjs/issues/423
import { parse } from './grammar.js';

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
  let rules;
  try {
    rules = parse(text);
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
  if (opt.options.compile) {
    if (opt.options.expand)
      console.warn ("Warning: specifying --expand with --compile is redundant")
    const { transform, types } = compileTypes (rules);
    rules = transform.reduce ((newRules,r,n) => newRules.concat([{type:'comment',comment:' Type '+n+': '+types[n]+' ('+r.length+' rules)'}]).concat(r), []);
  } else if (opt.options.expand) {
    const { transform, types } = expandInherits (makeGrammarIndex (rules));
    rules = types.reduce ((newRules,type,n) => newRules.concat([{type:'comment',comment:' Type '+n+': '+type+' ('+(transform[type]||[]).length+' rules)'}]).concat(transform[type]||[]), []);
  }
  const out = serialize(rules);
  console.log(out);
})

