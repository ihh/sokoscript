import { lookups } from './lookups';
import { applyTransformRule } from './engine';

// binarySearch returns a negative insertion point if the element is not found
const binarySearch = (arr, el) => {
    let m = 0;
    let n = arr.length - 1;
    while (m <= n) {
        let k = (n + m) >> 1;
        let ak = arr[k];
        if (el > ak) {
            m = k + 1;
        } else if (el < ak) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return ~m;
};

const sum = (weights) => weights.reduce ((s, w) => s + w, 0);

class Board {
    constructor (size, grammar, owner) {
        this.size = size;
        this.grammar = grammar;
        this.owner = owner;
        this.time = 0;
        this.cell = new Array(size*size).fill(0).map((_)=>({type:'_',state:''}));
        this.byType = [new Array(size*size).fill(0).map((_,n)=>n)].concat (new Array(grammar.types.length-1).fill(0).map((_)=>[]));
        this.byID = {};
    }

    index2xy (index) {
        return [index % this.size, Math.floor (index / this.size)];
    }

    xy2index (x, y) {
        return y * this.size + x;
    }

    getCell (x, y) {
        return this.cell[this.xy2index(x,y)];
    }

    setCell (x, y, newValue) {
        const index = xy2index (x, y);
        const oldValue = this.cell[index];
        if (newValue.type !== oldValue.type) {
            let oldByType = this.byType[oldValue.type];
            let newByType = this.byType[newValue.type];
            oldByType.splice (binarySearch(oldByType,index), 1);
            newByType.splice (~binarySearch(newByType,index), 0, index);
        }
        if (oldValue.meta && oldValue.meta.id && this.byID[oldValue.meta.id] === index && (!newValue.meta || newValue.meta.id !== oldValue.meta.id))
            delete this.byID[oldValue.meta.id];
        if (newValue.meta && newValue.meta.id && (!oldValue.meta || newValue.meta.id !== oldValue.meta.id)) {
            if (this.byID.hasOwnProperty(newValue.meta.id)) {
                const prevIndexForNewID = this.byID[newValue.meta.id];
                let prevCellForNewID = this.cell[prevIndexForNewID];
                if (prevCellForNewID.meta) {
                    if (prevCellForNewID.meta.id === newValue.meta.id)
                        delete prevCellForNewID.meta.id;  // at most one cell can have a given ID
                    else
                        console.error ("ID mismatch: cell ("+this.index2xy(prevIndexForNewID)+") type "+this.grammar.type[prevCellForNewID.type]+" has ID "+prevCellForNewID.meta.id+", expected "+newValue.meta.id)
                }
            }
            this.byID[newValue.meta.id] = index;
        }
        this.cell[index] = newValue;
    }

    totalTypeRates() {
        return this.byType.map ((cells, type) => cells.length * this.grammar.rateByType[type]);
    }

    totalRate() {
        return sum (this.totalTypeRates());
    }

    // Random waiting time until next event, and selection of next event
    // Ultimately this could all be integerized for lightning-fast implementation, but that isn't important yet! Premature optimization!
    // r1 and r2 are random variables uniformly distributed on [0,1)
    nextRule (r1, r2) {
        const typeRates = this.totalTypeRates();
        const totalRate = sum (typeRates);
        const wait = -Math.log(r1 > 0 ? r1 : Number.MIN_VALUE) / totalRate;
        let r = r2 * totalWeight;
        let type = 0, w;
        while (r >= 0) {
            w = weights[type];
            r -= w;
            ++type;
        }
        --type;
        r = (r / w) + 1;
        const t = this.grammar.rateByType[type];
        const n = Math.floor (r / t);
        r = (r - n*t) / t;
        const rules = this.grammar.transform[type];
        let ruleIndex = 0, rule;
        while (r >= 0) {
            rule = rules[ruleIndex];
            w = rule.rate;
            r -= w;
            ++ruleIndex;
        }
        --ruleIndex;
        r = (r / w) + 1;
        const dir = Math.floor (r*4);
        const [x,y] = this.index2xy (this.byType[type][n]);
        return { wait, x, y, rule, dir }
    }

    processMessage (msg) {
        if (msg.type === 'command') {
            const { time, user, id, dir, command, key } = msg;
            const index = this.byID[id];
            if (typeof(index) !== 'undefined') {
                const [x,y] = this.index2xy[index];
                if (typeof(cell.owner) === 'undefined' || user === cell.owner || user === Board.owner) {
                    const rules = command ? this.grammar.command[cell.type][command] : this.grammar.key[cell.type][key];
                    rules.reduce ((rule) => success || applyTransformRule (this, x, y, dir, rule), false);
                }
            }
        } else if (msg.type === 'write') {
            const { time, user, cells } = msg;
            cells.forEach ((cell) => {
                const { x, y, oldType, oldState, type, state, meta } = cell;
                const index = this.xy2index(x,y);
                const cell = this.cell[index];
                if (typeof(cell.owner) === 'undefined' || user === cell.owner || user === Board.owner)
                    if (typeof(oldType) === 'undefined' || this.grammar.types[cell.type] === this.oldType)
                        if (typeof(oldState === 'undefined' || cell.state === this.oldState))
                            this.setCell (x, y, { type, state, meta });
            })
        } else
            console.error ('Unknown message type');
    }

    // TODO
    // Implement "process message". A message can be
    //   { type: 'command', time, user, command, id }                       ... user must match board.owner or cell.meta.owner
    //   { type: 'write', time, user, cells: [{x, y, type, state, meta}] }  ... user must match board.owner or cell.meta.owner
    // Implement "evolve board for max time t"
    // Implement "evolve board for max time t while processing the following set of messages"
    // Implement serialize/deserialize board
    // Implement canonical hashes of board, rules, and messages
    // Implement "create verifiable update" (hashes of board, rule, messages, and time lapsed, plus new board state) and "verify update"

    // Implement web app:
    // React app (hook-based)
    // - Text box for typing rules
    // - Pause/resume board button
    // - Board is just text for now
    // - Dropdown menu to select type to paint
    // - Click or drag to paint
    // - Shift-click to assign an ID (playable character), if type has commands and/or keys
    // - Radio buttons to select current playable character
    // - Menu of command buttons generated automatically
    // - Key presses are translated as commands

    // Web API:
    // - Chat app model: https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-chat-app.html
    // - Board config CRUD. GET /boards. POST create new board. GET/PUT/DELETE /boards/BOARD: handle board config, including rules (not cell values), pause/resume state
    // - All board config includes a version ID (eventually we can keep a revision table, don't need it just yet)
    // - POST message to /messages/BOARD with requested time. Server responds with actual time, and broadcasts message to connected clients.
    // - Messages rejected if the board has not been updated for a certain amount of time
    // - Websockets: connect, disconnect
    // - As well as 'command' and 'write' messages, server broadcasts 'config' whenever config is updated (covers pause and resume)
    // - GET current state: last update (with ID), messages since last update, ID of current revision of rules
    //    (assume all updates verified, for now. Conflict resolution requires some thought, e.g. subscriber consensus pending owner vote? Auto-ban cheaters?)
    // - POST update. Includes config version ID, last update ID, last update time, and verifiable update
    // - Check hashes match (previous board, messages, rules) but do not otherwise attempt to verify update

    // Crypto:
    // - Maybe: solve a crypto-puzzle based on the previous board hash, to mine a coin? incentivizes update correction...
    // - New message { msg: 'pay', user, recipient, amount }
    // - Board config includes rates for all writes & commands
    // - Rules include two new attributes: ownerCoins and boardCoins
}
