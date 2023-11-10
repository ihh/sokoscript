// AWS SDK
import { DynamoDBClient, CreateTableCommand, DeleteTableCommand, QueryCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// Global parameters
const TimeInSecondsBetweenBlocks = 600;
const TimeInSecondsBeforeBlockUpdateAllowed = 10;

const MaxMoveAnticipationMillisecs = 100;
const MaxMoveDelayMillisecs = 250;

const MaxMoveRetries = 3;

const BlockTicksPerSecond = BigInt(Math.pow(2,32));
const TicksBetweenBlocks = BigInt(TimeInSecondsBetweenBlocks) * BlockTicksPerSecond;
const TicksBeforeUpdate = BigInt(TimeInSecondsBeforeBlockUpdateAllowed) * BlockTicksPerSecond;

const MaxConnectionLifetimeMillisecs = 24*60*60*1000;
const WebSocketEndpoint = process.env.WEBSOCKET_API_ENDPOINT;

const createEmptyBoardState = (time, seed) => ({ grammar: '',
                                                 board: { time: time.toString(),
                                                          lastEventTime: time.toString(),
                                                          seed } });

// The conceptual hierarchy of tables is clocks->moves->blocks items in each of which can be owned by users.
// Each clock defines a board, whose state is updated by moves, whose accumulation is reflected in blocks.
// Blocks are not guaranteed to be correct (their computations of evolving/modified state are not verified before storage),
// but they are guaranteed to be consistent with the clock and move tables.
const clockTableName = 'soko-clocks';
const moveTableName = 'soko-moves';
const blockTableName = 'soko-blocks';
const connectionTableName = 'soko-connections';

// Subroutine: AWS config params
const createAWSConfig = (endpoint) => ({endpoint});

// Subroutine: create AWS Dynamo document client for given (or default) endpoint
const createDynamoDocumentClient = (endpoint) => {
    return new DynamoDBDocumentClient (createDynamoClient(endpoint), createAWSConfig (endpoint));
};

// Subroutine: create AWS Dynamo client for given (or default) endpoint
const createDynamoClient = (endpoint) => {
    return new DynamoDBClient (createAWSConfig (endpoint));
};

// MD5 hash function: https://github.com/jbt/tiny-hashes/blob/b0ee6142d046c1c2987a0120ea9cf51c28d957dd/md5-min.js
const md5 = function(){for(var m=[],l=0;64>l;)m[l]=0|4294967296*Math.abs(Math.sin(++l));return function(c){var e,g,f,a,h=[];c=unescape(encodeURI(c));for(var b=c.length,k=[e=1732584193,g=-271733879,~e,~g],d=0;d<=b;)h[d>>2]|=(c.charCodeAt(d)||128)<<8*(d++%4);h[c=16*(b+8>>6)+14]=8*b;for(d=0;d<c;d+=16){b=k;for(a=0;64>a;)b=[f=b[3],(e=b[1]|0)+((f=b[0]+[e&(g=b[2])|~e&f,f&e|~f&g,e^g^f,g^(e|~f)][b=a>>4]+(m[a]+(h[[a,5*a+1,3*a+5,7*a][b]%16+d]|0)))<<(b=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21][4*b+a++%4])|f>>>32-b),e,g];for(a=4;a;)k[--a]=k[a]+b[a]}for(c="";32>a;)c+=(k[a>>3]>>4*(1^a++&7)&15).toString(16);return c}}();

// canonical JSON.stringify
const isObject = (a) => {
    return Object.prototype.toString.call(a) === '[object Object]'
};
  
const copyObjectWithSortedKeys = (object) => {
    if (isObject(object))
        return Object.assign ({}, ...Object.keys(object).sort().map ((key) => ({ [key]: copyObjectWithSortedKeys(object[key]) })))
    else if (Array.isArray(object))
        return object.map(copyObjectWithSortedKeys)
    else
      return object
  }

const stringify = (object) => {
    return JSON.stringify(copyObjectWithSortedKeys(object))
}

// Canonical hash for a JSON-representable object
const hash = (obj) => md5(stringify(obj));

// BigInt max
const bigMax = (...args) => args.reduce((m, e) => e > m ? e : m);

// timeout Promise
const timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Subroutine: delete clock, move, and block tables
const deleteTables = async (endpoint) => {
    if (endpoint) {  // refuse to do this unless endpoint is specified
        const dynamoClient = createDynamoClient (endpoint);
        const clockTableParams = { TableName: clockTableName };
        const moveTableParams = { TableName: moveTableName };
        const blockTableParams = { TableName: blockTableName };
        const connectionTableParams = { TableName: connectionTableName };
        let clockTable = dynamoClient.send(new DeleteTableCommand(clockTableParams));
        let moveTable = dynamoClient.send(new DeleteTableCommand(moveTableParams));
        let blockTable = dynamoClient.send(new DeleteTableCommand(blockTableParams));
        let connectionTable = dynamoClient.send(new DeleteTableCommand(connectionTableParams));
        const clockResult = await clockTable;
        const moveResult = await moveTable;
        const blockResult = await blockTable;
        const connectionResult = await connectionTable;
        return { clockResult, moveResult, blockResult, connectionResult };
    }
};

// Subroutine: create clock, move, and block tables
const createTables = async (endpoint) => {
    const dynamoClient = createDynamoClient (endpoint);
    const clockTableParams = {
        TableName: clockTableName,
        KeySchema: [
            { AttributeName: 'boardId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'boardId', AttributeType: 'S' },
            { AttributeName: 'boardOwner', AttributeType: 'S' },
            { AttributeName: 'boardTimeAtCreation', AttributeType: 'N' },
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'boardOwner-boardTimeAtCreation-index',
                KeySchema: [
                    { AttributeName: 'boardOwner', KeyType: 'HASH' },
                    { AttributeName: 'boardTimeAtCreation', KeyType: 'RANGE' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 1,
                    WriteCapacityUnits: 1
                }
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        }
    };
    const moveTableParams = {
        TableName: moveTableName,
        KeySchema: [
            { AttributeName: 'boardId', KeyType: 'HASH' },
            { AttributeName: 'moveTime', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'boardId', AttributeType: 'S' },
            { AttributeName: 'moveTime', AttributeType: 'N' },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        }
    };
    const blockTableParams = {
        TableName: blockTableName,
        KeySchema: [
            { AttributeName: 'boardId', KeyType: 'HASH' },
            { AttributeName: 'blockHash', KeyType: 'RANGE' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'boardId', AttributeType: 'S' },
            { AttributeName: 'blockHash', AttributeType: 'S' },
            { AttributeName: 'blockTime', AttributeType: 'N' },
            { AttributeName: 'previousBlockHash', AttributeType: 'S' },
        ],
        LocalSecondaryIndexes: [
            {
                IndexName: 'boardId-blockTime-index',
                KeySchema: [
                    { AttributeName: 'boardId', KeyType: 'HASH' },
                    { AttributeName: 'blockTime', KeyType: 'RANGE' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
            },
            {
                IndexName: 'boardId-previousBlockHash-index',
                KeySchema: [
                    { AttributeName: 'boardId', KeyType: 'HASH' },
                    { AttributeName: 'previousBlockHash', KeyType: 'RANGE' }
                ],
                Projection: {
                    ProjectionType: 'KEYS_ONLY'
                },
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        }
    };
    const connectionTableParams = {
        TableName: connectionTableName,
        KeySchema: [
            { AttributeName: 'connectionId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'connectionId', AttributeType: 'S',
              AttributeName: 'boardId', AttributeType: 'S',
              AttributeName: 'connectionTime', AttributeType: 'N' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'boardId-connectionTime-index',
                KeySchema: [
                    { AttributeName: 'boardId', KeyType: 'HASH',
                      AttributeName: 'connectionTime', KeyType: 'RANGE' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 1,
                    WriteCapacityUnits: 1
                }
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        }
    };
    let clockTable = dynamoClient.send(new CreateTableCommand(clockTableParams));
    let moveTable = dynamoClient.send(new CreateTableCommand(moveTableParams));
    let blockTable = dynamoClient.send(new CreateTableCommand(blockTableParams));
    let connectionTable = dynamoClient.send(new CreateTableCommand(connectionTableParams));
    await clockTable;
    await moveTable;
    await blockTable;
    await connectionTable;
};

// Subroutine: get a block from the block table
const getBlockWrapper = async (docClient, boardId, blockHash, headerOnly) => {
    const blockQueryParams = {
        TableName: blockTableName,
        KeyConditionExpression: 'boardId = :id and blockHash = :hash',
        ExpressionAttributeValues: {
            ':id': {S:boardId},
            ':hash': {S:blockHash}
        }
    };
    let blockQuery = docClient.send(new QueryCommand(blockQueryParams));
    let blockResult = await blockQuery;
    if (blockResult.Items?.length !== 1)
        throw new Error ('Block not found');
    const block = blockResult.Items[0];
    console.warn({block})
    return unmarshallBlockForClient (block, headerOnly)
};

// Subroutine: create a block
const makeBlockTableEntry = (args) => {
    return {
        boardTime: args.boardTime.toString(),
        boardState: args.boardState || {},
        boardHash: hash(args.boardState || {}),
        moveList: args.moveList || [],
        moveListHash: hash(args.moveList || []),
        previousBlockHash: args.previousBlockHash || ''
    };
};

// Subroutine: prepare a block wrapper for the client, from a marshalled block table query result
const unmarshallBlockForClient = (blockItem, headerOnly) => {
    const block = blockItem.theBlock?.M;
    return { boardId: blockItem.boardId.S,
             blockHash: blockItem.blockHash.S,
             predecessorCount: parseInt(blockItem.predecessorCount.N),
             numberOfClaims: blockItem.claimantList?.L.length,
             ...(headerOnly
                 ? {}
                 : { firstClaimant: blockItem.firstClaimant?.S,
                     claimantList: blockItem.claimantList?.L?.map((c)=>c.S),
                     block: { boardTime: block.boardTime.S, 
                              boardState: unmarshall(block.boardState?.M),
                              boardHash: block.boardHash.S,
                              moveList: block.moveList.L.map((m) => unmarshallMove(m.M)),
                              moveListHash: block.moveListHash.S,
                              previousBlockHash: block.previousBlockHash.S } }) }
}

// Subroutine: get outgoing move list for a block, and indicate whether this move list is complete
const addOutgoingMovesToBlockWrapper = async (docClient, wrapper) => {
    if (!wrapper?.block)
        throw new Error ('Block not found');
    const blockTime = BigInt (wrapper.block.boardTime);
    const nextBlockTime = blockTime + TicksBetweenBlocks;  // moves up to and including this time will be allowed
    const earliestPostTimeForBlock = nextBlockTime + TicksBeforeUpdate;
    const currentBoardTime = BigInt(Date.now()) * BlockTicksPerSecond / 1000n;

    // query move table
    let moves = [];
    let moveQueryParams = {
        TableName: moveTableName,
        KeyConditionExpression: '#id = :id and #time between :lastBlockTime and :maxMoveTime',
        ExpressionAttributeNames: {
            '#id': 'boardId',
            '#time': 'moveTime'
        },
        ExpressionAttributeValues: {
            ':id': {S:wrapper.boardId},
            ':lastBlockTime': {N:blockTime.toString()},
            ':maxMoveTime': {N:(nextBlockTime+BigInt(1)).toString()}
        },
        ConsistentRead: true
    };
    while (true) {
        const moveResult = await docClient.send(new QueryCommand(moveQueryParams));
        moves = moves.concat (moveResult.Items || []);
        if (!moveResult.LastEvaluatedKey)
            break;
        moveQueryParams.ExclusiveStartKey = moveResult.LastEvaluatedKey;
    }

    const ready = currentBoardTime >= earliestPostTimeForBlock;
    return { ...wrapper, moves: moves.map(unmarshallMove), nextBlockTime: nextBlockTime.toString(), ready };
};

const unmarshallMove = ((m) => ({
    moveTime: m.moveTime.S || m.moveTime.N,  // hackily conflates two cases: move time is string-valued in block table, numerical in move table
    mover: m.mover.S,
    move: unmarshall(m.move.M)
}));

// Subroutine: get a block and (if headerOnly is not true) its outgoing move list, for client consumption
const getBlockAndOutgoingMoves = async (docClient, boardId, blockHash, headerOnly) => {
    let wrapper = await getBlockWrapper (docClient, boardId, blockHash, headerOnly);
    if (!headerOnly)
        wrapper = await addOutgoingMovesToBlockWrapper (docClient, wrapper);
    return wrapper;
}

// strip out unnecessary stuff for /state
const convertBlockWrapperToStateWrapper = (wrapper) => {
    const { boardId, blockHash, block, moves, ready, nextBlockTime } = wrapper;
    const { boardTime, boardState, previousBlockHash } = block;
    return { boardId, blockHash, previousBlockHash, boardTime, boardState, moves, ready, nextBlockTime };
}

const makeHandlerForEndpoint = (endpoint) => {
    const handler = async (event) => {
        const routeKey = event.httpMethod + ' ' + event.resource;
        const callerId = event.requestContext?.identity?.cognitoIdentityId;

        const docClient = createDynamoDocumentClient (endpoint);

        switch (routeKey) {
            case 'POST /boards': {
                // create a random board ID, use it as a seed for the Mersenne Twister
                const seed32 = Math.floor(Math.random()*Math.pow(2,32));
                const boardId = seed32.toString(32);
                const boardTimeAtCreation = BigInt(Date.now()) * BlockTicksPerSecond / 1000n;
                const boardSize = parseInt (event.body?.boardSize);

                // check that boardSize is a power of 2
                if (boardSize & (boardSize - 1))
                    return {
                        statusCode: 400,
                        body: { message: 'Board size must be a power of 2' },
                    };
                // create the root block, and get the hash of it, but don't store it in the block table yet
                const boardState = createEmptyBoardState (boardTimeAtCreation, seed32);
                const rootBlock = makeBlockTableEntry ({ boardTime: boardTimeAtCreation, boardState });
                const rootBlockHash = hash(rootBlock);
                // create a clock table entry with this board ID, owned by caller, conditional on none existing
                const clockPutParams = {
                    TableName: clockTableName,
                    Item: { boardId, 
                            boardOwner: callerId, 
                            boardSize, 
                            rootBlockHash, 
                            rootBlock, 
                            boardTimeAtCreation },
                    ConditionExpression: 'attribute_not_exists(boardId)'
                }
                await docClient.send(new PutCommand(clockPutParams));
                // now create the root entry in the block table
                const blockPutParams = {
                    TableName: blockTableName,
                    Item: { boardId, 
                            blockHash: rootBlockHash, 
                            theBlock: rootBlock, 
                            firstClaimant: callerId, 
                            claimantList: [callerId], 
                            predecessorCount: 0,
                            blockTime: boardTimeAtCreation },
                    ConditionExpression: 'attribute_not_exists(boardId)'
                }
                await docClient.send (new PutCommand (blockPutParams));
                // return the board ID
                return {
                    statusCode: 200,
                    body: { message: 'Board created',
                            boardId,
                            blockHash: rootBlockHash },
                };
            }

            case 'GET /boards': {
                // query the clock table for all boards using optional query parameter filter (owner=), sorted by boardTimeAtCreation (most recent first)
                const clockQueryParams = {
                    TableName: clockTableName,
                    IndexName: 'boardOwner-boardTimeAtCreation-index',
                    KeyConditionExpression: 'boardOwner = :owner',
                    ExpressionAttributeValues: {
                        ':owner': {S:callerId}
                    },
                    ScanIndexForward: false
                };
                const clockQueryResult = await docClient.send(new QueryCommand(clockQueryParams));  
                const clocks = clockQueryResult.Items || [];
                // return the board IDs
                return {
                    statusCode: 200,
                    body: {
                        message: 'Boards retrieved',
                        boards: clocks.map((clock)=>({boardId:clock?.boardId?.S,boardTimeAtCreation:clock?.boardTimeAtCreation?.N}))
                    },
                };
            }

            case 'DELETE /boards/{id}': {
                const boardId = event.pathParameters?.id;
                try {
                    // delete the clock table entry for this board ID, conditional on owner matching caller ID
                    const clockDeleteParams = {
                        TableName: clockTableName,
                        Key: { boardId: {S:boardId} },
                        ConditionExpression: 'boardOwner = :owner',
                        ExpressionAttributeValues: {
                            ':owner': {S:callerId}
                        }
                    };
                    const clockDeleteResult = await docClient.send(new DeleteItemCommand(clockDeleteParams));
                    // TODO: scan blocks and moves tables for detritus; clean up
                    // return success
                    return {
                        statusCode: 200,
                        body: { message: 'Board deleted' },
                    };
                } catch (err) {
                    // if unsuccessful: return an error
                    return {
                        statusCode: 400,
                        body: { message: 'Board deletion failed' },
                        error: err.message
                    };
                }
            }

            case 'POST /boards/{id}/moves': {
                const boardId = event.pathParameters?.id;
                // move time is specified in milliseconds since epoch
                const requestedUnixTime = parseInt (event.body?.time);
                const move = event.body?.move;
                // TODO: verify that move fits JSON schema for a move
                const currentTimeOnServer = Date.now();
                //  - check that originallyRequestedTime - maxMoveAnticipation <= currentTimeOnServer <= originallyRequestedTime + maxMoveDelay
                //    if it isn't, return an error
                if (!(requestedUnixTime - MaxMoveAnticipationMillisecs <= currentTimeOnServer
                        && currentTimeOnServer <= requestedUnixTime + MaxMoveDelayMillisecs))
                    return {
                        statusCode: 400,
                        body: { message: 'Move time out of range' },
                    };
                let moveTime = BigInt(requestedUnixTime) * BlockTicksPerSecond / 1000n;
                let movePut = false, moveData, retry;
                for (retry = 0; !movePut && retry < MaxMoveRetries; ++retry) {
                    //  - create a move table entry with this board ID and moveTime, attributed to caller
                    moveData = { boardId, moveTime, mover: callerId, move };
                    const movePutParams = {
                        TableName: moveTableName,
                        Item: moveData,
                        ConditionExpression: 'attribute_not_exists(boardId)'
                    };
                    try {
                        movePut = await docClient.send (new PutCommand(movePutParams));
                    } catch (err) {
                        console.warn({err})
                    }
                    console.warn({movePut})
                    if (!movePut)
                        ++moveTime;
                }

                if (movePut) {

                    const connectQueryParams = {
                        TableName: connectionTableName,
                        IndexName: 'boardId-connectionTime-index',
                        KeyConditionExpression: 'boardId = :id and connectionTime > :since',
                        ExpressionAttributeValues: {
                            ':id': { S: boardId },
                            ':since': { N: Date.now() - MaxConnectionLifetimeMillisecs }
                        }
                    };
                    const connectQueryResults = await docClient.send(new QueryCommand(connectQueryParams));
                    const connections = connectQueryResults.Items || [];
                    
                    const apiClient = new ApiGatewayManagementApiClient({ endpoint: WebSocketEndpoint });
                    const sendMessages = connections.map(async ({ connectionId }) => {
                        try {
                            const postCommand = new PostToConnectionCommand({ ConnectionId: connectionId, Data: moveData });
                            await apiClient.send (postCommand);
                          } catch (e) {
                            console.log(e);
                          }
                    });
                    
                    try {
                        await Promise.all(sendMessages);
                    } catch (e) {
                        console.log(e);
                    }
    
                    return {
                        statusCode: 200,
                        body: { message: 'Move posted', moveTime: moveTime.toString() },
                    };
                }

                // if move table entry creation failed, return an error
                return {
                    statusCode: 400,
                    body: { message: 'Move failed' },
                };
            }
        
            case 'GET /boards/{id}/blocks/{hash}': {
                const boardId = event.pathParameters?.id;
                const blockHash = event.pathParameters?.hash;
                let block;
                try { block = await getBlockAndOutgoingMoves (docClient, boardId, blockHash, event.queryParameters?.headerOnly); }
                catch (err) { return { statusCode: 404, body: { message: err.message } }}
                return {
                    statusCode: 200,
                    body: block,
                };
            }

            case 'POST /boards/{id}/blocks': {
                const boardId = event.pathParameters?.id;
                // TODO: verify that block fits JSON schema for a block
                const { previousBlockHash, moveListHash, boardTime, boardState } = event.body;
                // get previous block from block table, and its outgoing moves
                const previousBlock = await getBlockAndOutgoingMoves (docClient, boardId, previousBlockHash, false);
                // verify that block is ready for update, and that its move list hash matches the update
                if (!previousBlock.ready)
                    return {
                        statusCode: 400,
                        body: { message: 'Block not ready' },
                    };
                if (hash(previousBlock.moves) !== moveListHash)
                    return {
                        statusCode: 400,
                        body: { message: 'Move list mismatch' },
                    };
                // verify that block time is as determined by previous block + move list
                if (!previousBlock.nextBlockTime === boardTime)
                    return {
                        statusCode: 400,
                        body: { message: 'Block time mismatch' },
                    };
                // since all checks pass, create a block table entry with this board ID and hash, attributed to caller, conditional on none existing
                // increment the previous block's predecessorCount count
                const block = makeBlockTableEntry ({boardTime, boardState, previousBlockHash, moveList: previousBlock.moves, moveListHash});
                console.warn({moveList:block.moveList})
                const blockHash = hash(block);
                const blockPutParams = {
                    TableName: blockTableName,
                    Item: { boardId,
                            blockHash,
                            previousBlockHash, 
                            theBlock: block, 
                            firstClaimant: callerId, 
                            claimantList: [callerId], 
                            blockTime: BigInt(boardTime), 
                            predecessorCount: previousBlock.predecessorCount + 1 },
                    ConditionExpression: 'attribute_not_exists(blockHash)'
                };
                console.warn({blockPutParams})
                let blockPutPromise = docClient.send (new PutCommand (blockPutParams));
                blockPutPromise.catch ((err) => {
                    if (err.code === 'ConditionalCheckFailedException') {
                        // if the block already existed, update the existing entry to include the caller as one of the confirmers
                        const blockUpdateParams = {
                            TableName: blockTableName,
                            Key: { boardId: id, blockHash: blockHash },
                            UpdateExpression: 'set claimantList=list_append(claimantList,:userId)',
                            ExpressionAttributeValues: {
                                ':userId': callerId
                            }
                        };
                        return docClient.send (new UpdateCommand (blockUpdateParams));
                    }
                    else
                        throw err;
                })
                await blockPutPromise;
                // return success
                return {
                    statusCode: 200,
                    body: { message: 'Block created', blockHash },
                };
            }

            case 'GET /boards/{id}/state': {
                const boardId = event.pathParameters?.id;
                //  search the block table for all blocks for this board, sorted by time of creation (most recent first)
                const blockQueryParams = {
                    TableName: blockTableName,
                    IndexName: 'boardId-blockTime-index',
                    KeyConditionExpression: 'boardId = :id',
                    ExpressionAttributeValues: {
                        ':id': {S:boardId}
                    },
                    ScanIndexForward: false
                };
                const blockQueryResult = await docClient.send(new QueryCommand(blockQueryParams));
                console.warn({blockQueryResult})
                let blocks = blockQueryResult.Items || [];
                if (!blocks.length)
                    return {
                        statusCode: 404,
                        body: { message: 'No blocks found' },
                    };
//                    console.warn(JSON.stringify({blocks}))
                //  of all blocks with the most recent timestamp, pick the one with the highest confirmation count
                blocks = blocks.filter ((block) => block.blockTime.N === blocks[0].blockTime.N);
                blocks = blocks.sort ((a,b) => b.claimantList.L.length - a.claimantList.L.length);
                const bestBlock = blocks[0];
                if (!bestBlock)
                    return { statusCode: 404, body: { message: 'Block not found' } }
                console.warn(JSON.stringify({bestBlock}))
                const wrapper = unmarshallBlockForClient (bestBlock, false)
                // add outgoing moves
                let result;
                try { let body = convertBlockWrapperToStateWrapper (await addOutgoingMovesToBlockWrapper (docClient, wrapper, boardId)); result = { statusCode: 200, body } }
                catch (err) { result = { statusCode: 404, body: { message: err.message }} }
                console.warn({result})
                return result;
            }
            
            case 'GET /boards/{id}/moves': {
                const boardId = event.pathParameters?.id;
                //  retrieve moves subsequent to specified time (up to a max of maxOutgoingMovesForBlock)
                if (typeof(event.queryParameters?.since) === 'undefined')
                    return { statusCode: 400, body: { message: 'No "since" time parameter specified' } }
                const moveQueryParams = {
                    TableName: moveTableName,
                    KeyConditionExpression: 'boardId = :id and moveTime > :since',
                    ExpressionAttributeValues: {
                        ':id': {S:boardId},
                        ':since': {N:(event.queryParameters?.since).toString()}
                    }
                 };
                const moveQueryResults = await docClient.send(new QueryCommand(moveQueryParams));
                const moves = moveQueryResults.Items || [];
                let body = { moves: moves.map(unmarshallMove) };
                if (moveQueryResults.LastEvaluatedKey)
                    body.more = true
                return {
                    statusCode: 200,
                    body
                };
            }

            case '$connect': {
                const connectionId = event.requestContext.connectionId;
                const connectionTime = event.requestContext.connectedAt;
                const connectPutParams = {
                    TableName: connectionTableName,
                    Item: { connectionId,
                            connectionTime }
                }
                await docClient.send(new PutCommand(connectPutParams));
                return { statusCode: 200 }
            }

            case '$disconnect': {
                const connectionId = event.requestContext.connectionId;
                const connectDeleteParams = {
                    TableName: connectionTableName,
                    Item: { connectionId }
                };
                await docClient.send(new DeleteItemCommand(connectDeleteParams));
                return { statusCode: 200 }
            }

            case '$default': {
                return { statusCode: 404 }
            }

            case 'subscribe': {
                const connectionId = event.requestContext.connectionId;
                const boardId = JSON.parse(event.body).boardId;
                const connectUpdateParams = {
                    TableName: connectionTableName,
                    Key: { connectionId },
                    UpdateExpression: 'set boardId=:boardId',
                    ExpressionAttributeValues: {
                        ':boardId': boardId
                    }
                };
                await docClient.send(new UpdateCommand(connectUpdateParams));
                return { statusCode: 200 }
            }

            default:
                break;
        }

        return {
            statusCode: 400,
            body: { message: 'Request failed' },
        };
        
    };
    return handler;
};
const handler = makeHandlerForEndpoint();

export { handler, makeHandlerForEndpoint, createTables, deleteTables };
