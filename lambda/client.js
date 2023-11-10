#!/usr/bin/env node

import fs from 'fs';
import getopt from 'node-getopt';
import { hexMD5 } from '../src/md5.js';
import { stringify } from '../src/canonical-json.js';

// Wrap fetch request
const Fetch = async (url, config) => {
    config = config || {}
    if (opt.options.verbose)
        console.warn("Fetch " + url + " " + JSON.stringify(config));
    return fetch(url, config);
};

// parse command-line options
const defaultUrl = 'http://localhost:3000';
const defaultMethod = 'GET', defaultRoute = 'boards', methods = ['GET','POST','DELETE'], routes = ['boards','moves','blocks','state'];
const defaultBoardSize = 64;

const opt = getopt.create([
  ['u' , 'url=URL'       , `specify web service URL (default ${defaultUrl})`],
  ['m' , 'method=METHOD' , `specify method (options ${methods.join(', ')}; default ${defaultMethod})`],
  ['r' , 'route=ROUTE'   , `specify route (options ${routes.join(', ')}; default ${defaultRoute})`],
  ['b' , 'board=ID'      , 'specify board ID'],
  ['H' , 'hash=HASH'     , 'specify block hash of previous block (for POST blocks) or current block (for GET blocks)'],
  ['s' , 'size=N'        , `specify boardSize (for POST boards); default ${defaultBoardSize}`],
  ['t' , 'time=T'        , 'specify ?since=T in ms (for GET moves), move time in ms (for POST moves), or block time in ticks (for POST blocks)'],
  ['M' , 'moves=LIST'    , 'specify JSON move (for POST moves) or move list (for POST blocks)'],
  ['S' , 'state=JSON'    , 'specify board state (for POST blocks)'],
  ['q' , 'header'        , 'specify ?headerOnly=1 (for GET blocks)'],
  ['R' , 'repeat=N'      , 'repeat the exact same web service call N times'],
  ['v' , 'verbose'       , 'log web traffic'],
  ['h' , 'help'          , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

let argvIdx = 0;
const moreArgs = () => argvIdx < opt.argv.length;
const gotArg = (optName) => opt.options[optName] || moreArgs();
const getArg = (optName, defaultVal) => opt.options[optName] || defaultVal;
const nextArg = (optName, defaultVal) => {
    const arg = opt.options[optName] || (moreArgs() && opt.argv[argvIdx++]) || defaultVal;
    if (!arg)
        throw new Error (`Missing required command-line argument or option: ${optName}`);
    return arg;
}
const needArg = (optName) => {
    const arg = opt.options[optName];
    if (typeof(arg) === 'undefined')
        throw new Error (`Missing required command-line option: ${optName}`)
    return arg;
}

const url = opt.options.url || defaultUrl;
const method = nextArg('method',defaultMethod).toUpperCase();
const pseudoRoute = nextArg('route',defaultRoute);

let config = { method, headers: { "Content-Type": "application/json" } }, route;
const routeKey = method + ' /' + pseudoRoute;
switch (routeKey) {
    case 'GET /boards':
        route = '/boards'
        break
    case 'POST /boards':
        route = '/boards'
        config.body = { boardSize: nextArg('size',defaultBoardSize) }
        break
    case 'DELETE /boards':
        route = '/boards/' + nextArg('id')
        break
    case 'POST /moves':
        route = '/boards/' + nextArg('id') + '/moves'
        config.body = { time: getArg('time',Date.now()), move: JSON.parse(nextArg('moves')) }
        break
    case 'GET /moves':
        route = '/boards/' + nextArg('id') + '/moves'
        if (gotArg('time'))
            route = route + '?since=' + nextArg('time')
        break
    case 'POST /blocks':
        route = '/boards/' + nextArg('id') + '/blocks'
        config.body = { previousBlockHash: needArg('hash'),
                        moveListHash: hexMD5(stringify(JSON.parse(opt.options.moves || '[]'))),
                        boardTime: needArg('time'),
                        boardState: opt.options.boardState || '' }
        break
    case 'GET /blocks':
        route = '/boards/' + nextArg('id') + '/blocks/' + nextArg('hash') + (opt.options.header ? '?headerOnly=1' : '')
        break
    case 'GET /state':
        route = '/boards/' + nextArg('id') + '/state'
        break
    default:
        console.error (`Unknown combination of method (${method}) and route (${pseudoRoute})`)
        process.exit()
}
if (config.body)
    config.body = JSON.stringify (config.body);

for (let n = 0; n < (opt.options.repeat || 1); ++n) {
    const tag = opt.options.repeat ? ` [${n+1}] ` : '';
    Fetch (url + route, config)
    .then ((result) => {
        console.warn (`Status${tag}: ${result.status}`)
        return result.json()
    }).then ((json) => {
        console.log (tag + JSON.stringify(json.body || json))
    })
}