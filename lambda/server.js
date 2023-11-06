const { makeHandlerForEndpoint, createTables } = require('express');
const boards = require('./boards.js');

// mock AWS endpoint
const endpoint = 'http://localhost:8000';
// create the tables
createTables (endpoint);
const handler = makeHandlerForEndpoint (endpoint);
const makeHandler = (httpMethod, resource) => {
    return (req, res) => handler ({
        httpMethod,
        resource,
        pathParameters: req.params,
        queryParameters: req.query,
        body: req.body,
        requestContext: { identity: { cognitoIdentityId: req.body.userId } }
    }).then ((result) => res.json(result));
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

