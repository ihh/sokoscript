import { makeHandlerForEndpoint, createTables, deleteTables } from './boards.js';
import express from 'express';

// mock AWS endpoint
const endpoint = 'http://localhost:8000';

// port we will listen on
const port = 3000;

// default user ID
const defaultUserId = 'guest';

// if arguments list includes --delete-tables, delete the tables and exit
if (process.argv.includes('--delete-tables'))
    deleteTables (endpoint).then ((results) => {
       console.log (JSON.stringify (results));
        process.exit();
    })


// if arguments list includes --create-tables, create the tables
else if (process.argv.includes('--create-tables'))
    createTables (endpoint).then ((results) => {
        console.log (JSON.stringify (results));
        process.exit();
     })

else {
    // if arguments list includes --debug, report full stack for error messages
    let errorMessageProp = 'message';
    if (process.argv.includes('--debug'))
        errorMessageProp = 'stack';

    // make a handler for the endpoint
    const handler = makeHandlerForEndpoint (endpoint);
    const makeHandler = (httpMethod, resource) => {
        return (req, res) => {
            const userId = req.body?.userId || defaultUserId;
            console.warn (httpMethod + ' ' + resource
            + ' @' + userId
            + (Object.keys(req.params||{}).length ? ' ' + JSON.stringify(req.params) : '')
            + (Object.keys(req.query||{}).length ? ' ?' + JSON.stringify(req.query) : '')
            + (Object.keys(req.body||{}).length ? ' body=' + JSON.stringify(req.body) : '')
            );
            return handler ({
            httpMethod,
            resource,
            pathParameters: req.params,
            queryParameters: req.query,
            body: req.body,
            requestContext: { identity: { cognitoIdentityId: userId } }
        }).then ((result) => res.json(result))
        .catch ((err) => { console.warn(err); res.json({ status: 500, message: 'Error in handler', error: err[errorMessageProp] }).status(500).end() });
    }};
    // make a pseudo-API Gateway express server that routes all supported paths in boards.js to the handler
    const app = express();
    app.use(express.json())
    const registerHandler = (httpMethod, resource) => {
        const appMethodName = httpMethod.toLowerCase();
        const expressRoute = resource.replace(/{([^}]*)}/g, ':$1');
        app[appMethodName](expressRoute, makeHandler(httpMethod, resource));
        console.warn ('Registered ' + httpMethod + ' ' + expressRoute);
    };
    registerHandler ('GET', '/boards');
    registerHandler ('POST', '/boards');
    registerHandler ('DELETE', '/boards/{id}');
    registerHandler ('POST', '/boards/{id}/moves');
    registerHandler ('GET', '/boards/{id}/moves');
    registerHandler ('GET', '/boards/{id}/blocks/{hash}');
    registerHandler ('POST', '/boards/{id}/blocks');
    registerHandler ('GET', '/boards/{id}/state');


    console.log ('listening on port ' + port);
    const serverPromise = app.listen(port);
}