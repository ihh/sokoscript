#!/usr/bin/env node

import getopt from 'node-getopt';
import { execSync } from 'child_process';
import { createTables } from './boards.js';

const exec = (cmd) => {
    console.warn(cmd);
    console.log (execSync(cmd).toString())
};

const listTables = () => {
    exec (`aws dynamodb list-tables --endpoint-url ${endpoint} --no-cli-pager`)
}

const deleteTables = () => {
    exec (`aws dynamodb delete-table --endpoint-url ${endpoint} --no-cli-pager --table-name soko-clocks`)
    exec (`aws dynamodb delete-table --endpoint-url ${endpoint} --no-cli-pager --table-name soko-blocks`)
    exec (`aws dynamodb delete-table --endpoint-url ${endpoint} --no-cli-pager --table-name soko-moves`)
}

// parse command-line options
const defaultEndpoint = 'http://localhost:8000';
const commands = ['list-tables','create-tables','delete-tables','reset-tables','scan'];
const opt = getopt.create([
  ['e' , 'endpoint=URL'    , `specify AWS DynamoDB endpoint URL (default ${defaultEndpoint})`],
  ['c' , 'command=COMMAND' , `specify command (options: ${commands.join(', ')})`],
  ['t' , 'table=TABLE_NAME', `specify table name for 'scan' command`],
  ['h' , 'help'            , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

const endpoint = opt.options.endpoint || defaultEndpoint;
const command = opt.options.command || opt.argv[0];
const table = opt.options.table || opt.argv[1];
switch (command) {
    case 'list-tables':
        listTables();
        break
    case 'delete-tables':
        deleteTables();
        listTables();
        break
    case 'create-tables':
        createTables(endpoint).then (listTables);
        break;
    case 'reset-tables':
        deleteTables();
        createTables(endpoint).then (listTables);
        break
    case 'scan':
        exec (`aws dynamodb scan --endpoint-url ${endpoint} --table-name ${table}`)
        break
    default:
        console.error (`Unknown command ${command}`)
        process.exit()
}
