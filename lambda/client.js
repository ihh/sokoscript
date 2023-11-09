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
  ['H' , 'block=HASH'    , 'specify block hash'],
  ['s' , 'size=N'        , `specify boardSize (for POST boards); default ${defaultBoardSize}`],
  ['t' , 'time=T'        , 'specify ?since=T in ms (for GET moves), move time in ms (for POST moves), or block time in ticks (for POST blocks)'],
  ['M' , 'moves=LIST'    , 'specify JSON move list (for POST blocks)'],
  ['S' , 'state=JSON'    , 'specify board state (for POST blocks)'],
  ['v' , 'verbose'       , 'log web traffic'],
  ['h' , 'help'          , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

let argvIdx = 0;
const moreArgs = () => argvIdx < opt.argv.length;
const gotArg = (optName) => opt.options[optName] || moreArgs();
const nextArg = (optName, defaultVal) => opt.options[optName] || (moreArgs() && opt.argv[argvIdx++]) || defaultVal;
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
        config.body = { time: nextArg('time',Date.now()) }
        break
    case 'GET /moves':
        route = '/boards/' + nextArg('id') + '/moves'
        if (gotArg('time'))
            route = route + '?since=' + nextArg('time')
        break
    case 'POST /blocks':
        route = '/boards/' + nextArg('id') + '/blocks'
        config.body = { previousBlockHash: needArg('hash'),
                        moveListHash: hexMD5(stringify(opt.options.moves || [])),
                        boardTime: needArg('time'),
                        boardState: opt.options.boardState || '' }
        break
    case 'GET /blocks':
        route = '/boards/' + nextArg('id') + '/blocks/' + needArg('hash')
        break
    case 'GET /state':
        route = '/boards/' + nextArg('id') + '/state'
        break
    default:
        console.error (`Unknown combination of method (${method}) and route (${pseudoRoute})`)
        process.exit()
}
if (config.body)
    config.body = JSON.stringify (config.body)

    Fetch (url + route, config)
 .then ((result) => {
    console.warn ("Status: " + result.status)
    return result.json()
 }).then ((json) => {
    console.log (json.body || json)
})
