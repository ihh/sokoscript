import * as lookups from './lookups.js';
import { applyTransformRule, transformRuleUpdate } from './engine.js';
import { fastLn_leftShift26_max, fastLn_leftShift26 } from './log2.js';
import { bigIntContainerToObject } from './gramutil.js';

// Time-efficient data structure for storing a set of ints in the range [0,n) where n is a power of 2
// Uses 2n memory.
// Counting total number of elements is an O(1) operation
// Add, remove, get K'th element are all O(log n) operations
class RangeCounter {
    constructor (n, full) {
        this.n = n;
        this.log2n = Math.log(n) / Math.log(2);
        if ((this.log2n) % 1 !== 0)
            throw new Error ("Length is not a power of 2: " + n)
        // levelCount[k][m] is the cardinality of {i: i % (1<<k) = m} where i is an integer in the current set
        this.levelCount = new Array(this.log2n + 1).fill(0).map ((_,level) => new Array (1 << (this.log2n - level)).fill(full ? (1 << level) : 0));
    }

    add (val) {
        for (let level = this.log2n; level >= 0; --level)
            ++this.levelCount[level][val >> level];
    }

    remove (val) {
        for (let level = this.log2n; level >= 0; --level)
            --this.levelCount[level][val >> level];
    }

    total() {
        return this.levelCount[this.log2n];
    }

    // k is 0-based
    kthElement (k) {
        let index = 0;
        for (let level = this.log2n - 1; level >= 0; --level) {
            index = index << 1;
            if (k + 1 > this.levelCount[level][index]) {
                k -= this.levelCount[level][index];
                ++index;
            }
        }
        return index;
    }

    elements() {
        return Array.from({length:this.total()},(_,k)=>this.kthElement(k));
    }
}

// return random integer in the range [0,max)
const randomInt = (rng, max) => Number ((BigInt(max) * BigInt(rng.int())) >> BigInt(32));
const randomBigInt = (rng, max) => {
    let tmp = max, lg = 32, r = BigInt(rng.int());
    while (tmp = tmp >> BigInt(32)) {
        lg += 32;
        r = (r << BigInt(32)) | BigInt(rng.int());
    }
    return (max * r) >> BigInt(lg);
}

const knuthShuffle = (rng, list) => {
    const len = list.length;
    for (let k = 0; k < len - 1; ++k) {
        const i = k + randomInt (rng, len - k);
        [list[i], list[k]] = [list[k], list[i]];
    }
    return list;
}

const bigSum = (...args) => args.reduce ((s, w) => s + w);
const bigMin = (...args) => args.reduce((m, e) => e < m ? e : m);
const bigMax = (...args) => args.reduce((m, e) => e > m ? e : m);

class Board {
    constructor (size, grammar, owner, rng) {
        this.size = size;
        this.grammar = grammar;
        this.owner = owner;
        this.rng = rng;
        this.maxStateLen = 64;
        this.time = BigInt(0);
        this.lastEventTime = BigInt(0);
        this.cell = new Array(size*size).fill(0).map((_)=>({type:0,state:''}));
        this.byType = new Array(grammar.types.length).fill(0).map((_,n)=>new RangeCounter(size*size,n===0));
        this.byID = {};
    }

    index2xy (index) {
        return [index % this.size, Math.floor (index / this.size)];
    }

    xy2index (x, y) {
        const size = this.size;
        return (((y % size) + size) % size) * size + (((x % size) + size) % size);
    }

    getCell (x, y) {
        return this.cell[this.xy2index(x,y)];
    }

    setCell (x, y, newValue) {
        if (newValue.state?.length > this.maxStateLen)
            newValue.state = newValue.state.substr (0, this.maxStateLen);
        this.setCellByIndex (this.xy2index (x, y), newValue);
    }

    setCellByIndex (index, newValue) {
        const oldValue = this.cell[index];
        if (newValue.type !== oldValue.type) {
            let oldByType = this.byType[oldValue.type];
            let newByType = this.byType[newValue.type];
            oldByType.remove (index);
            newByType.add (index);
        }
        if (oldValue.meta && oldValue.meta.id && this.byID[oldValue.meta.id] === index && (!newValue.meta || newValue.meta.id !== oldValue.meta.id))
            delete this.byID[oldValue.meta.id];
        if (newValue.meta && newValue.meta.id && (!oldValue.meta || newValue.meta.id !== oldValue.meta.id)) {
            if (newValue.meta.id in this.byID) {
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
        return this.byType.map ((counter, type) => BigInt(counter.total()) * this.grammar.rateByType[type]);
    }

    // Random waiting time until next event, and selection of next event
    // Ultimately this could all be integerized for lightning-fast implementation, but that isn't important yet! Premature optimization!

// Sigh....

//    Suppose w is an exponentially distributed rv with mean 1
//    W = w * F   where F = 2^26  is the value returned by (fastLn_leftShift26_max - fastLn_leftShift26(rng.rnd32()))
    
//    r = sum_cells(cell_rate)
//    R = r * M  is the value returned by an integer encoding of our fixed-point rate values
//    (we need at least M = 10^6 but in principle we can set M = 2^20 without losing much precision)
    
//    Time to next event in seconds = t = w / r = (W / F) / (R / M) = MW/(FR)
    
//    Max cell rate is Q, number of cells on board is B=S*S where S=board size
//    r_max = QB = Q S^2
//    R_max = r_max * M = MQS^2

//    Minimum unit of time (a "tick") needs to be 1/r_max = 1/(QB) = 1/(QS^2) seconds
    
//    Thus, time to next event in ticks = T = tQS^2 = M Q S^2 W / (FR)
    
//    If we allow for up to Q=2^10, S=2^11 then a tick can be 2^{-32} of a second, QS^2/F=64,
//     and T = 64 * M * W/R
//     (we should actually take max(T,1) to ensure every event takes at least one tick)

//    NB actual Q_max is 1000<1024 so r_max < 2^32, however R_max = r_max * M so we do need to store R as a BigInt
//    and we will also need more than 32 bits of randomness; specifically, if S=2^11, Q=2^10, and M=2^20 then R_max=2^52
//    so the random number generation will really need to be a BigInt (intermediate value is 104 bits, well more than 64)
//    NB running at 2^32 ticks/second would be ~4.3GHz which is certainly faster than we can reach!
//    For many "reasonable" boards (few fast particles), R_max may fit into 32 bits, and randomInt() may need only 64 bits of scratch

//    It is obviously true that if we sacrificed some slower moving particles by setting M=2^10 instead of 2^20 (allowing mHz but not uHz), we'd extend this regime.
//    EVEN BETTER: set M=1, round all rates up to nearest integer Hz, and implement fractional part by rejection sampling. I think we have a winner!

    nextRule (maxWait) {
        const typeRates = this.totalTypeRates();
        const totalRate = bigSum (...typeRates);
        if (totalRate == 0)
            return null;
        const r1 = this.rng.int();
        const wait = BigInt (64 * (fastLn_leftShift26_max - fastLn_leftShift26(r1))) / BigInt(totalRate) || BigInt(1);
        if (wait > maxWait)
            return null;
        const r2 = randomBigInt (this.rng, totalRate);
        let r = r2, type = 0, w;
        while (r >= 0) {
            w = typeRates[type];
            r -= w;
            ++type;
        }
        --type;
        r += w;
        const t = this.grammar.rateByType[type];
        const n = r / t;  // BigInt => rounds down
        const r2modt = r;
        r = r - n*t;
        const rules = this.grammar.transform[type];
        let ruleIndex = 0, rule;
        while (r >= 0) {
            rule = rules[ruleIndex];
            w = rule.rate_Hz;
            r -= w;
            ++ruleIndex;
        }
        --ruleIndex;
        const r3 = this.rng.int();
        if ((r3 & 0x3fffffff) > rule.acceptProb_leftShift30)
            return null;
        const dir = lookups.dirs[r3 >>> 30];
        const [x,y] = this.index2xy (this.byType[type].kthElement(Number(n)));
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
            cells.forEach ((write) => {
                const { x, y, oldType, oldState, type, state, meta } = write;
                const index = this.xy2index(x,y);
                const cell = this.cell[index];
                if (typeof(cell.owner) === 'undefined' || user === cell.owner || user === Board.owner)
                    if (typeof(meta?.owner) === 'undefined' || user === meta.owner)
                        if (typeof(oldType) === 'undefined' || this.grammar.types[cell.type] === oldType)
                            if (typeof(oldState === 'undefined' || cell.state === oldState))
                                this.setCell (x, y, { type, state, meta });
            })
        } else
            console.error ('Unknown message type');
    }

    randomDir() {
        return lookups.dirs[Math.floor (this.rng.random() * 4)];
    }

    // if hardStop is true, then there is a concrete event at time t, and we will advance the clock to that point even if nothing happens in the final interval
    // if hardStop is false, we stop the clock (and the random number generator) at the last event *before* t, so that we can resume consistently if more events (e.g. messages) arrive after t but before the next event
    evolveAsyncToTime (t, hardStop) {
        while (this.time < t) {
            const mt = this.rng.mt;
            const r = this.nextRule (t - this.lastEventTime);
            if (!r) {
                this.time = t;
                if (hardStop)
                    this.lastEventTime = t;
                else
                    this.rng.mt = mt;  // rewind random number generator
                break;
            }
            const { wait, x, y, rule, dir } = r;
            applyTransformRule (this, x, y, dir, rule);
            this.time = this.lastEventTime = this.lastEventTime + wait;
        }
    }

    evolveToTime (t, hardStop) {
        const million = 1000000;
        while (this.time < t) {
            const nextSyncTimes = this.grammar.syncPeriods.map ((p) => this.lastEventTime + p - (this.lastEventTime % p));
            const nextTime = bigMin (t, ...nextSyncTimes);
            const nextSyncCategories = this.grammar.syncCategories.filter ((n) => nextSyncTimes[n] === nextTime);
            const nextTimeIsSyncEvent = nextSyncCategories.length > 0;
            this.evolveAsyncToTime (nextTime, hardStop || nextTimeIsSyncEvent);
            if (nextTimeIsSyncEvent) {
                const updates = knuthShuffle (this.rng, nextSyncCategories.reduce ((l, nSync) =>
                    l.concat (this.grammar.typesBySyncRate[nSync].reduce ((l, nType) => {
                        const rules = this.grammar.syncTransform[nSync][nType];
                        return l.concat (this.byType[nType].elements().reduce ((l, index) => {
                            const xy = this.index2xy(index);
                            return l.concat (rules.map ((rule) => [xy,rule]));
                        }, []));
                    }, [])), [])).reduce ((updates, xy_rule) =>
                        updates.concat (transformRuleUpdate(this,xy_rule[0][0],xy_rule[0][1],this.randomDir(),xy_rule[1])), []);
                updates.forEach ((update) => this.setCell (...update));
            }
       }
    }

    // evolve board, processing sync rules and messages
    // There is probably no reason to call this with hardStop==true, unless imposing another time limit that is well-defined within the game
    evolveAndProcess (t, messages, hardStop) {
        messages.toSorted ((a,b) => a.time - b.time).reduce ((message) => {
            this.evolveToTime (message.time, true);
            this.processMessage (message);
        })
        this.evolveToTime (t, hardStop);
    }

    toString() {
        return JSON.stringify ({ time: this.time.toString(),
                                 lastEventTime: this.lastEventTime.toString(),
                                 mt: this.rng.mt,
                                 types: this.grammar.types,
                                 cell: this.cell.map ((cell) => [cell.type].concat(cell.state || cell.meta ? [cell.state || ''].concat(cell.meta ? [cell.meta] : []) : [])) })
    }

    initFromString (str) {
        const json = JSON.parse (str);
        this.time = BigInt (json.time);
        this.lastEventTime = BigInt (json.lastEventTime);
        this.rng.mt = json.mt;
        if (json.cell.length !== this.cell.length)
            throw new Error ("Tried to load "+json.cell.size()+"-cell board file into "+this.cell.size()+"-cell board");
        const unknownTypes = json.types.filter ((type) => !(type in this.grammar.typeIndex));
        if (unknownTypes.length)
            throw new Error ("Tried to load board with unknown types: "+unknownTypes.join(' '));
        json.cell.forEach ((type_state_meta, index) => this.setCellByIndex (index, { type: this.grammar.typeIndex[json.types[type_state_meta[0]]], state: type_state_meta[1] || '', ...(type_state_meta[2] ? {meta:type_state_meta[2]} : {})}));
    }

    // TODO
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

export { Board };