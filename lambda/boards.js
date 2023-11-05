const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Global parameters
const maxOutgoingMovesForBlock = 100;
const maxTimeInSecondsBetweenBlocks = 600;

const maxMoveAnticipationMillisecs = 250;
const maxMoveDelayMillisecs = 250;

const blockTicksPerSecond = BigInt(Math.pow(2,32));
const maxTicksBetweenBlocks = BigInt(maxTimeInSecondsBetweenBlocks) * blockTicksPerSecond;



const MaxMoveRetries = 3;

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
             blockTime: block.blockTime,
             moveListHash: block.moveListHash,
             confirmations: block.confirmedBy?.length,
             ...(headerOnly ? {} : { confirmedBy: block.confirmedBy,
                                     boardState: block.boardState }) }
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
    let maxMoveTime = blockTime + maxTicksBetweenBlocks;  // moves at exactly maxMoveTime are allowed
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
        Limit: maxOutgoingMovesForBlock,
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

    const isComplete = blockTimedOut || (moveResult.Items.length === maxOutgoingMovesForBlock);
    return { ...block, moves, isComplete };
};

// Subroutine: get a block and (if headerOnly is not true) its outgoing move list
const getBlockAndOutgoingMoves = async (boardId, blockHash, headerOnly) => {
    let block = await getBlock (boardId, blockHash, headerOnly);
    if (!headerOnly)
        block = await addOutgoingMovesToBlock (block);
    return block;
}

const handler = async (event) => {
    const routeKey = event.httpMethod + ' ' + event.resource;

    switch (routeKey) {
        case 'POST /boards':
            // create a random board ID
            const id = Math.floor(Math.random()*Math.pow(2,32)).toString(32)
            // create a clock table entry with this board ID, owned by caller, with lastMoveTime=now, conditional on none existing
            const clockUpdateParams = {
                TableName: clockTableName,
                Key: { boardId: id },
                ConditionExpression: 'attribute_not_exists(boardId)',
                UpdateExpression: 'set owner=:owner, lastMoveTime=:lastMoveTime',
                ExpressionAttributeValues: {
                    ':owner': event.requestContext.identity.cognitoIdentityId,
                    ':lastMoveTime': Date.now()
                }
            };
            let clockUpdate = dynamoDB.update(clockUpdateParams).promise();
            let clockResult = await clockUpdate;
            if (!clockResult)
                throw new Error ('Clock update failed');
            // create an initial entry in the block table
            const blockUpdateParams = {
                // TODO: write me
            };
            let blockUpdate = dynamoDB.update(blockUpdateParams).promise();
            let blockResult = await blockUpdate;
            if (!(blockResult?.Items?.length === 1))
                throw new Error ('Block update failed');
            // return the board ID
            return {
                statusCode: 200,
                body: JSON.stringify({ id }),
            };
            break;

        case 'GET /boards':
            // query the clock table for all boards using optional query parameter filter (owner=), sorted by lastMoveTime (most recent first)
            // return a sorted paginated list
            break;

        case 'DELETE /boards/{id}':
            // delete the clock table entry for this board ID, conditional on owner matching caller ID
            // if successful: delete all block and move table entries for this board ID
            break;

        case 'POST /boards/{id}/moves': {
            // move time is specified in milliseconds since epoch
            const requestedUnixTime = parseInt (event.body?.time);
            const originallyRequestedUnixTime = requestedTime;
            let requestedBoardTime = BigInt(requestedTime) * blockTicksPerSecond / 1000n;
            // TODO: verify that move fits JSON schema for a move
            // Retry up to rnd(MaxMoveRetries) times:
            const moveRetries = Math.floor(Math.random()*MaxMoveRetries);
            let retry = 0, newClock = false, newMove = false;
            for (retry = 0; retry <= moveRetries && !newClock; ++retry) {
                const currentTimeOnServer = Date.now();
                //  - check that originallyRequestedTime - maxMoveAnticipation <= currentTimeOnServer <= originallyRequestedTime + maxMoveDelay
                //    if it isn't, return an error
                if (!(originallyRequestedUnixTime - maxMoveAnticipationMillisecs <= currentTimeOnServer <= originallyRequestedUnixTime + maxMoveDelayMillisecs))
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
                while (!newMove) {
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
                    body: JSON.stringify({ boardTime: requestedBoardTime.toString() }),
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
                statusCode: 400,
                body: JSON.stringify(block),
            };
        }

        case 'PUT /boards/{id}/blocks/{hash}':
            // TODO: verify that block fits JSON schema for a block
            // get clock table entry for board, and verify that board size matches
            // get previous block from block table, and its outgoing moves
            // verify that move list is complete, and that its hash matches the update
            // verify that previousBlockTime < updateBlockTime <= previousBlockTime + maxTimeBetweenBlocks
            // if all checks pass, create a block table entry with this board ID and hash, attributed to caller, conditional on none existing
            // if the block already existed, update the existing entry to include the caller as one of the confirmers
            // return success or failure
            break;

        case 'GET /boards/{id}/state':
            // If 'since' is unspecified:
            //  search the block table for all blocks for this board, sorted by time of creation (most recent first)
            //  of all blocks with the most recent timestamp, pick the one with the highest confirmation count
            // OR, if 'since' is specified:
            //  retrieve moves subsequent to specified time (up to a max of maxOutgoingMovesForBlock)
            // return this block (if no 'since') and its outgoing moves
            break;
    
        default:
            break;
    }

    return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid request' }),
    };
};

export { handler };
