const { makeHandlerForEndpoint, createTables, deleteTables } = require('./boards.js');
const express = require('express');

// mock AWS endpoint
const endpoint = 'http://localhost:8000';

// port we will listen on
const port = 3000;

// default user ID
const defaultUserId = 'default-user-id';

// if arguments list includes --delete-tables, delete the tables and exit
if (process.argv.includes('--delete-tables')) {
    const results = deleteTables (endpoint);
    console.log (JSON.stringify (results));
    process.exit();
}

// if arguments list includes --create-tables, create the tables
if (process.argv.includes('--create-tables'))
    createTables (endpoint);

// make a handler for the endpoint
const handler = makeHandlerForEndpoint (endpoint);
const makeHandler = (httpMethod, resource) => {
    return (req, res) => handler ({
        httpMethod,
        resource,
        pathParameters: req.params,
        queryParameters: req.query,
        body: req.body,
        requestContext: { identity: { cognitoIdentityId: req.body?.userId || defaultUserId } }
    }).then ((result) => res.json(result))
    .catch ((err) => { console.warn(err); res.json({ status: 500, message: 'Error in handler', err }).status(500).end() });
};
// make a pseudo-API Gateway express server that proxies all the routes in boards.js to the handler
const app = express();
const registerHandler = (httpMethod, resource) => {
    const appMethodName = httpMethod.toLowerCase();
    const expressRoute = resource.replace(/{([^}]*)}/g, ':$1');
    app[appMethodName](expressRoute, makeHandler(httpMethod, resource));
};
registerHandler ('GET', '/boards');
registerHandler ('POST', '/boards');
registerHandler ('DELETE', '/boards/{id}');
registerHandler ('POST', '/boards/{id}/moves');
registerHandler ('GET', '/boards/{id}/blocks/{hash}');
registerHandler ('POST', '/boards/{id}/blocks');


console.log ('listening on port ' + port);
const serverPromise = app.listen(port);
