import * as lookups from './lookups.js';
import { applyTransformRule, transformRuleUpdate } from './engine.js';

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

const knuthShuffle = (list, rng) => {
    const len = list.length;
    for (let k = 0; k < len - 1; ++k) {
        const i = k + Math.floor (rng.random() * (len - k));
        [list[i], list[k]] = [list[k], list[i]];
    }
    return list;
}

const sum = (weights) => weights.reduce ((s, w) => s + w, 0);

class Board {
    constructor (size, grammar, owner, rng) {
        this.size = size;
        this.grammar = grammar;
        this.owner = owner;
        this.rng = rng;
        this.time = 0;
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
        return this.byType.map ((counter, type) => counter.total() * this.grammar.rateByType[type]);
    }

    totalRate() {
        return sum (this.totalTypeRates());
    }

    // Random waiting time until next event, and selection of next event
    // Ultimately this could all be integerized for lightning-fast implementation, but that isn't important yet! Premature optimization!
    nextRule (maxWait) {
        const typeRates = this.totalTypeRates();
        const totalRate = sum (typeRates);
        if (totalRate === 0)
            return null;
        const r1 = this.rng.random();
        const wait = -Math.log(r1 > 0 ? r1 : Number.MIN_VALUE) / totalRate;
        if (wait > maxWait)
            return null;
        const r2 = this.rng.random();
        let r = r2 * totalRate;
        let type = 0, w;
        while (r >= 0) {
            w = typeRates[type];
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
        const [x,y] = this.index2xy (this.byType[type].kthElement(n));
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

    evolveAsyncToTime (t) {
        while (true) {
            const r = this.nextRule (t - this.time);
            if (!r) {
                this.time = t;
                break;
            }
            const { x, y, rule, dir } = r;
            applyTransformRule (this, x, y, this.randomDir(), rule);
            this.time += wait;
        }
    }

    evolveToTime (t) {
        const syncPeriods = this.grammar.syncRates.map ((r) => 1 / r);
        const syncCategories = syncPeriods.map((_p,n)=>n).reverse();
        while (this.time < t) {
            const nextSyncTimes = syncPeriods.map ((p) => this.time + p - (this.time % p));
            const nextTime = Math.min (t, ...nextSyncTimes);
            this.evolveAsyncToTime (nextTime);
            const nextSyncCategories = syncCategories.filter ((n) => nextSyncTimes[n] === nextTime);
            const updates = knuthShuffle (nextSyncCategories.reduce ((l, nSync) =>
                l.concat (this.grammar.typesBySyncRate[nSync].reduce ((l, nType) => {
                    const rules = this.grammar.syncTransform[nSync][nType];
                    return l.concat (this.byType[nType].elements().reduce ((l, index) => {
                        const xy = this.index2xy(index);
                        return l.concat (rules.map ((rule) => [xy,rule]));
                    }, []));
                }, [])), []), this.rng).reduce ((updates, xy_rule) =>
                    updates.concat (transformRuleUpdate(this,xy_rule[0][0],xy_rule[0][1],this.randomDir(),xy_rule[1])), []);
            updates.forEach ((update) => this.setCell (...update));
       }
    }

    evolveAndProcess (t, messages) {
        messages.toSorted ((a,b) => a.time - b.time).forEach ((message) => {
            this.evolveToTime (message.time);
            this.processMessage (message);
        })
        this.evolveToTime (t);
    }

    toString() {
        return JSON.stringify ({ time: this.time,
                                 mt: this.rng.mt,
                                 types: this.grammar.types,
                                 cell: this.cell.map ((cell) => [cell.type].concat(cell.state || cell.meta ? [cell.state || ''].concat(cell.meta ? [cell.meta] : []) : [])) })
    }

    initFromString (str) {
        const json = JSON.parse (str);
        this.time = json.time;
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