const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Global parameters
const MaxOutgoingMovesForBlock = 100;
const MaxTimeInSecondsBetweenBlocks = 600;

const MaxMoveAnticipationMillisecs = 250;
const MaxMoveDelayMillisecs = 250;

const BlockTicksPerSecond = BigInt(Math.pow(2,32));
const MaxTicksBetweenBlocks = BigInt(MaxTimeInSecondsBetweenBlocks) * BlockTicksPerSecond;

const MaxMoveRetries = 3;
const MaxMoveTableRetries = 10

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

// This all builds up to our subroutine that hashes a JavaScript object:
const hash = (obj) => md5(stringify(obj));

// The conceptual hierarchy of tables is clocks->moves->blocks items in each of which can be owned by users.
// Each clock defines a board, whose state is updated by moves, whose accumulation is reflected in blocks.
// Blocks are not guaranteed to be correct (their computations of evolving/modified state are not verified before storage),
// but they are guaranteed to be consistent with the clock and move tables.
// Clock tables include various denormalized summaries of moves, including the last move time and the current rules and permissions.
const userTableName = 'soko-users';
const clockTableName = 'soko-clocks';
const moveTableName = 'soko-moves';
const blockTableName = 'soko-blocks';

// Subroutine: get a block from the block table
const getBlock = async (boardId, blockHash, headerOnly) => {
    const blockQueryParams = {
        TableName: blockTableName,
        KeyConditionExpression: '#id = :id and #hash = :hash',
        ExpressionAttributeNames: {
            '#id': 'boardId',
            '#hash': 'blockHash'
        },
        ExpressionAttributeValues: {
            ':id': boardId,
            ':hash': blockHash
        }
    };
    let blockQuery = dynamoDB.query(blockQueryParams).promise();
    let blockResult = await blockQuery;
    if (blockResult.Items?.length !== 1)
        throw new Error ('Block not found');
    const block = blockResult.Items[0];
    return { boardId,
             blockHash,
             previousBlockHash: block.previousBlockHash,
             claims: block.claimants?.length,
             ...(headerOnly ? {} : { firstClaimant: block.firstClaimant,
                                     claimants: block.claimants,
                                     block: block.block }) }
};

// Subroutine: get clock table entry for a board
const getClockTableEntry = async (boardId) => {
    const clockQueryParams = {
        TableName: clockTableName,
        KeyConditionExpression: '#id = :id',
        ExpressionAttributeNames: {
            '#id': 'boardId'
        },
        ExpressionAttributeValues: {
            ':id': boardId
        }
    };

    let clockQuery = dynamoDB.query(clockQueryParams).promise();
    let clockResult = await clockQuery;
    if (clockResult.Items?.length !== 1)
        throw new Error ('Clock not found');
    return clockResult.Items[0];
};

// Subroutine: get outgoing move list for a block, and indicate whether this move list is complete
const addOutgoingMovesToBlock = async (block) => {
    const clock = await getClockTableEntry (block.boardId);

    const blockTime = BigInt (block.blockTime);
    const lastMoveTime = BigInt(clock.lastMoveTime);
    let maxMoveTime = blockTime + MaxTicksBetweenBlocks;  // moves at exactly maxMoveTime are allowed
    let expectedLastMoveTime, blockTimedOut = false;
    if (maxMoveTime > lastMoveTime) {
        maxMoveTime = lastMoveTime;  // avoid retrieving moves that weren't yet reflected in the clock table, to avoid compromising our movelist completeness call
        expectedLastMoveTime = lastMoveTime.toString();
    } else  // lastMoveTime >= maxMoveTime
        blockTimedOut = true;

    // query move table
    const moveQueryParams = {
        TableName: moveTableName,
        KeyConditionExpression: '#id = :id and #time > :lastBlockTime and #time <= :maxMoveTime',
        Limit: MaxOutgoingMovesForBlock,
        ExpressionAttributeNames: {
            '#id': 'boardId',
            '#time': 'moveTime'
        },
        ExpressionAttributeValues: {
            ':id': boardId,
            ':lastBlockTime': blockTime.toString(),
            ':maxMoveTime': maxMoveTime.toString()
        }
    };

    let moveResult = await dynamoDB.query(moveQueryParams).promise();
    const moves = moveResult.Items;
    if (!moves || (typeof(expectedLastMoveTime) !== 'undefined' && moves[moves.length-1].moveTime !== expectedLastMoveTime))
        throw new Error ('Move query failed');

    const isComplete = blockTimedOut || (moveResult.Items.length === MaxOutgoingMovesForBlock);
    return { block, moves, isComplete };
};

// Subroutine: get a block and (if headerOnly is not true) its outgoing move list
const getBlockAndOutgoingMoves = async (boardId, blockHash, headerOnly) => {
    let block = await getBlock (boardId, blockHash, headerOnly);
    if (!headerOnly)
        block = await addOutgoingMovesToBlock (block);
    return block;
}

const makeBoardState = (args) => {
    return { grammar: args.grammar || '',
             board: stringify(args.board) };
};

const makeBlockTableEntry = (args) => {
    return {
        boardTime: args.time.toString(),
        boardState: args.boardState || {},
        boardHash: hash(args.boardState || {}),
        moveListHash: hash(args.moveList || []),
        previousBoardHash: hash(previousBoardState || {}),
        ...args
    };
};

const handler = async (event) => {
    const routeKey = event.httpMethod + ' ' + event.resource;

    switch (routeKey) {
        case 'POST /boards':
            // create a random board ID
            const idNum = Math.floor(Math.random()*Math.pow(2,32));
            const id = idNum.toString(32);
            const time = BigInt(Date.now()) * BlockTicksPerSecond / 1000n;
            // create a clock table entry with this board ID, owned by caller, with lastMoveTime=now, conditional on none existing
            const clockUpdateParams = {
                TableName: clockTableName,
                Key: { boardId: id },
                ConditionExpression: 'attribute_not_exists(boardId)',
                UpdateExpression: 'set owner=:owner, boardSize=:boardSize, lastMoveTime=:lastMoveTime',
                ExpressionAttributeValues: {
                    ':owner': event.requestContext.identity.cognitoIdentityId,
                    ':lastMoveTime': time.toString()
                }
            };
            let clockUpdate = dynamoDB.update(clockUpdateParams).promise();
            let clockResult = await clockUpdate;
            if (!clockResult)
                throw new Error ('Clock update failed');
            // create an initial entry in the block table
            // first create the new block itself
            const boardState = makeBoardState ({ board: { time: time.toString,
                                                          lastEventTime: time.toString(),
                                                          seed: idNum } });
            const block = makeBlockTableEntry ({ boardTime: time, boardState, head: true });
            const blockHash = hash(block);
            const userId = event.requestContext.identity.cognitoIdentityId;
            const blockUpdateParams = {
                TableName: blockTableName,
                Key: { boardId: id, blockHash: blockHash },
                ConditionExpression: 'attribute_not_exists(boardId)',
                UpdateExpression: 'set first=:firstClaimant, claimants=:claimants, boardTime=:boardTime, block=:block',
                ExpressionAttributeValues: {
                    ':blockTime': time.toString(),
                    ':block': block,
                    ':firstClaimant': userId,
                    ':claimants': [userId]
                }
            };
            let blockUpdate = dynamoDB.update(blockUpdateParams).promise();
            let blockResult = await blockUpdate;
            if (!(blockResult?.Items?.length === 1))
                throw new Error ('Block update failed');
            // return the board ID
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Board created', id }),
            };
            break;

        case 'GET /boards': {
            // query the clock table for all boards using optional query parameter filter (owner=), sorted by lastMoveTime (most recent first)
            const clockQueryParams = {
                TableName: clockTableName,
                IndexName: 'owner-lastMoveTime-index',
                KeyConditionExpression: 'owner = :owner',
                ExpressionAttributeValues: {
                    ':owner': event.requestContext.identity.cognitoIdentityId
                },
                ScanIndexForward: false
            }; 
            const clockQueryResult = await dynamoDB.query(clockQueryParams).promise();  
            const clocks = clockQueryResult.Items || [];
            // return the board IDs
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Boards retrieved', boards: clocks.map((clock)=>clock.boardId) }),
            };
            break;
        }

        case 'DELETE /boards/{id}': {
            // delete the clock table entry for this board ID, conditional on owner matching caller ID
            const clockDeleteParams = {
                TableName: clockTableName,
                Key: { boardId: event.pathParameters?.id },
                ConditionExpression: 'owner = :owner',
                ExpressionAttributeValues: {
                    ':owner': event.requestContext.identity.cognitoIdentityId
                }
            };
            let clockDeleteResult = await dynamoDB.delete(clockDeleteParams).promise();
            clockDeleteResult.then ((result) => {
                // following successful clock table deletion: delete all block and move table entries for this board ID
                const blockDeleteParams = {
                    TableName: blockTableName,
                    KeyConditionExpression: 'boardId = :id',
                    ExpressionAttributeValues: {
                        ':id': event.pathParameters?.id
                    }
                };
                let blockDelete = dynamoDB.query(blockDeleteParams).promise();
                blockDelete.then ((result) => {
                    const moveDeleteParams = {
                        TableName: moveTableName,
                        KeyConditionExpression: 'boardId = :id',
                        ExpressionAttributeValues: {
                            ':id': event.pathParameters?.id
                        }
                    };
                    let moveDelete = dynamoDB.query(moveDeleteParams).promise();
                    moveDelete.then ((result) => {
                        // return success
                        return {
                            statusCode: 200,
                            body: JSON.stringify({ message: 'Board deleted' }),
                        };
                    });
                });
            })
            // if unsuccessful: return an error
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Board deletion failed' }),
            };
        }

        case 'POST /boards/{id}/moves': {
            // move time is specified in milliseconds since epoch
            const requestedUnixTime = parseInt (event.body?.time);
            const originallyRequestedUnixTime = requestedUnixTime;
            let requestedBoardTime = BigInt(requestedTime) * BlockTicksPerSecond / 1000n;
            // TODO: verify that move fits JSON schema for a move
            // Retry up to rnd(MaxMoveRetries) times:
            const moveRetries = Math.floor(Math.random()*MaxMoveRetries);
            let retry = 0, newClock = false, newMove = false;
            for (retry = 0; retry <= moveRetries && !newClock; ++retry) {
                const currentTimeOnServer = Date.now();
                //  - check that originallyRequestedTime - maxMoveAnticipation <= currentTimeOnServer <= originallyRequestedTime + maxMoveDelay
                //    if it isn't, return an error
                if (!(originallyRequestedUnixTime - MaxMoveAnticipationMillisecs <= currentTimeOnServer <= originallyRequestedUnixTime + MaxMoveDelayMillisecs))
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ message: 'Move time out of range' }),
                    };
                //  - retrieve clock table entry for board. Check permissions. Set requestedTime=max(requestedTime,lastMoveTimeRetrieved+1)
                let clock = await getClockTableEntry (event.pathParameters?.id);
                // TODO: check permissions
                requestedBoardTime = Math.max (requestedBoardTime, clock.lastMoveTime + 1);
                //  - update clock table with requested time, conditional on lastMoveTime=lastMoveTimeRetrieved
                const clockUpdateParams = {
                    TableName: clockTableName,
                    Key: { boardId: event.pathParameters?.id },
                    ConditionExpression: 'lastMoveTime = :lastMoveTime',
                    UpdateExpression: 'set lastMoveTime=:requestedTime',
                    ExpressionAttributeValues: {
                        ':requestedTime': requestedBoardTime.toString(),
                        ':lastMoveTime': clock.lastMoveTime.toString()
                    }
                };
                clockUpdate = await dynamoDB.update(clockUpdateParams).promise();
                if (clockUpdate?.Items?.length === 1)
                    newClock = clockUpdate.Items[0];
            }
            // if clock table update succeeded...
            if (newClock) {
                //  - create a move table entry with this board ID, requestedTime, and originallyRequestedTime, attributed to caller
                const moveUpdateParams = {
                    TableName: moveTableName,
                    Key: { boardId: event.pathParameters?.id, moveTime: requestedBoardTime.toString() },
                    ConditionExpression: 'attribute_not_exists(boardId)',
                    UpdateExpression: 'set owner=:owner, originallyRequestedTime=:originallyRequestedTime',
                    ExpressionAttributeValues: {
                        ':owner': event.requestContext.identity.cognitoIdentityId,
                        ':originallyRequestedTime': originallyRequestedBoardTime.toString()
                    }
                };
                for (let moveRetry = 0; !newMove && moveRetry < MaxMoveTableRetries; ++moveRetry) {
                    //  - retry persistently until move table entry is created
                    const moveUpdate = await dynamoDB.update(moveUpdateParams).promise();
                    if (moveUpdate?.Items?.length === 1)
                        newMove = moveUpdate.Items[0];
                }
            }

            if (newMove)
                // return the move time
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Move posted', moveTime: requestedBoardTime.toString() }),
                };

            // if move table entry creation failed, return an error
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Move creation failed' }),
            };
        }
    
        case 'GET /boards/{id}/blocks/{hash}': {
            const block = await getBlockAndOutgoingMoves (event.pathParameters?.id, event.pathParameters?.hash, event.queryParameters?.headerOnly);
            return {
                statusCode: 200,
                body: JSON.stringify(block),
            };
        }

        case 'POST /boards/{id}/blocks': {
            // TODO: verify that block fits JSON schema for a block
            // get clock table entry for board, and verify that board size matches
            const boardSize = parseInt (event.body.boardSize);
            const { boardTime, boardState } = event.body.block;
            const previousBlockHash = event.body.previousBlockHash;
            const block = { boardTime, boardState };
            const blockHash = hash(block);
            let clock = await getClockTableEntry (event.pathParameters?.id);
            if (clock.boardSize !== boardSize)
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Board size mismatch' }),
                };
            // get previous block from block table, and its outgoing moves
            const previousBlock = await getBlockAndOutgoingMoves (event.pathParameters?.id, previousBlockHash, false);
            // verify that move list is complete, and that its hash matches the update
            if (!previousBlock.isComplete || hash(previousBlock.moves) !== block.moveListHash)
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Move list mismatch' }),
                };
            // verify that block time is as determined by previous block + move list
            const timesMatch = (previousBlock.moves?.length === MaxOutgoingMovesForBlock
                ? (boardTime === previousBlock.moves[previousBlock.moves.length-1].moveTime)
                : (BigInt(boardTime) > BigInt(previousBlock.moves?.length ? previousBlock.moves[previousBlock.moves.length-1].moveTime : previousBlock.blockTime)
                    && BigInt(boardTime) === BigInt(previousBlock.blockTime) + MaxTicksBetweenBlocks));
            if (!timesMatch)
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Block time mismatch' }),
                };
            // since all checks pass, create a block table entry with this board ID and hash, attributed to caller, conditional on none existing
            const blockUpdateParams = {
                TableName: blockTableName,
                Key: { boardId: id, blockHash: blockHash },
                ConditionExpression: 'attribute_not_exists(blockHash)',
                UpdateExpression: 'set firstClaimant=:firstClaimant, claimants=:claimants, blockTime=:blockTime, block=:block, previousBlockHash=:previousBlockHash',
                ExpressionAttributeValues: {
                    ':previousBlockHash': previousBlockHash,
                    ':blockTime': boardTime,
                    ':block': block,
                    ':firstClaimant': userId,
                    ':claimants': [userId]
                }
            };
            let blockUpdatePromise = dynamoDB.update(blockUpdateParams).promise();
            blockUpdatePromise.catch ((err) => {
                if (err.code === 'ConditionalCheckFailedException') {
                    // if the block already existed, update the existing entry to include the caller as one of the confirmers
                    const blockUpdateParams = {
                        TableName: blockTableName,
                        Key: { boardId: id, blockHash: blockHash },
                        UpdateExpression: 'set claimants=list_append(claimants,:userId)',
                        ExpressionAttributeValues: {
                            ':userId': userId
                        }
                    };
                }
                else
                    throw err;
            })
            // return success
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Block created', blockHash }),
            };
        }
        break;

        case 'GET /boards/{id}/state':
            const since = event.queryParameters?.since;
            let result = false;
            // If 'since' is not specified as a query parameter:
            if (!since) {
                //  search the block table for all blocks for this board, sorted by time of creation (most recent first)
                const blockQueryParams = {
                    TableName: blockTableName,
                    IndexName: 'boardId-blockTime-index',
                    KeyConditionExpression: 'boardId = :id',
                    ExpressionAttributeValues: {
                        ':id': boardId
                    },
                    ScanIndexForward: false
                };
                const blockQueryResult = await dynamoDB.query(blockQueryParams).promise();
                let blocks = blockQueryResult.Items || [];
                //  of all blocks with the most recent timestamp, pick the one with the highest confirmation count
                blocks = blocks.filter ((block) => block.blockTime === blocks[0].blockTime);
                blocks = blocks.sort ((a,b) => b.claimants.length - a.claimants.length);
                let block = block[0];
                // add outgoing moves
                result = await addOutgoingMovesToBlock (block);
            } else {
                //  retrieve moves subsequent to specified time (up to a max of maxOutgoingMovesForBlock)
                const moveQueryParams = {
                    TableName: moveTableName,
                    KeyConditionExpression: 'boardId = :id and moveTime > :since',
                    ExpressionAttributeValues: {
                        ':id': boardId,
                        ':since': since
                    },
                    Limit: MaxOutgoingMovesForBlock
                };
                const moveQueryResults = await dynamoDB.query(moveQueryParams).promise();
                const moves = moveQueryResults.Items || [];
                result = { moves };
            }
            break;
    
        default:
            break;
    }

    if (result)
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };

    return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Board state request failed' }),
    };
};


export { handler };
