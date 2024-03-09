import * as lookups from './lookups.js';
import { applyTransformRule, transformRuleUpdate } from './engine.js';
import { fastLn_leftShift26_max, fastLn_leftShift26 } from './log2.js';
import { parseOrUndefined, compileTypes } from './gramutil.js';
import { MersenneTwister } from './MersenneTwister.js';
import { stringify } from './canonical-json.js';

const defaultBoardSize = 64;
const defaultRngSeed = 5489;

const xy2index = (x, y, size) => (((y % size) + size) % size) * size + (((x % size) + size) % size);

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
        return this.levelCount[this.log2n][0];
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
    constructor (opts) {
        this.maxStateLen = 64;
        this.initFromJSON (opts || {});
    }

    initGrammar (grammar) {
        this.grammarSource = grammar;
        this.grammar = compileTypes (parseOrUndefined(grammar,{error:false}) || []);
        this.cell = new Array(this.size*this.size).fill(0).map((_)=>({type:0,state:''}));
        this.byType = new Array(this.grammar.types.length).fill(0).map((_,n)=>new RangeCounter(this.size*this.size,n===0));
        this.byID = {};
    }

    updateGrammar (grammar) {
        this.initFromJSON ({...this.toJSON(), grammar});
    }

    timeInSeconds() {
        return Number(this.time) / 2**32;
    }

    index2xy (index) {
        return [index % this.size, Math.floor (index / this.size)];
    }

    xy2index (x, y) {
        return xy2index (x, y, this.size);
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

    setCellTypeByName (x, y, type, state, meta) {
        let typeIdx = this.grammar.typeIndex[type];
        if (typeof(typeIdx) === 'undefined') {
            meta = {...meta||{},type};
            typeIdx = this.grammar.unknownType;
        }
        state = state || '';
        this.setCell (x, y, { type: typeIdx, state, meta });
    }

    getCellDescriptorString (x, y) {
        const cell = this.getCell (x, y);
        const type = this.grammar.types[cell.type];
        return type + (cell.state ? `/${cell.state}` : '') + (cell.meta && Object.keys(cell.meta).length ? ` ${JSON.stringify(cell.meta)}` : '');
    }

    getCellDescriptorStringWithCoords (x, y) {
        return `(${x},${y}) ` + this.getCellDescriptorString(x,y);
    }

    totalTypeRates() {
        return this.byType.map ((counter, type) => BigInt(counter.total()) * this.grammar.rateByType[type]);
    }

    getUniqueID(prefix) {
        const idPrefix = prefix || 'cell';
        let id;
        for (id = 1; idPrefix+id in this.byID; ++id);
        return idPrefix+id;
    }

    // Random waiting time until next event, and selection of next event

// Integer times:
//    Suppose w is an exponentially distributed rv with mean 1
//    W = w * F   where F = 2^26  is the value returned by (fastLn_leftShift26_max - fastLn_leftShift26(rng.int()))
    
//    r = sum_cells(cell_rate)
//    R = r * M  is the value returned by an integer encoding of our fixed-point rate values
//    (we need at least M = 10^6 but in principle we can set M = 2^20 without losing much precision)
    
//    Time to next event in seconds = t = w / r = (W / F) / (R / M) = MW/(FR)
    
//    Max cell rate is Q, number of cells on board is B=S*S where S=board size
//    r_max = QB = Q S^2
//    R_max = r_max * M = MQS^2

//    Minimum unit of time (a "tick") needs to be 1/r_max = 1/(QB) = 1/(QS^2) seconds
    
//    Thus, time to next event in ticks = T = tQS^2 = M Q S^2 W / (FR)
    
//    We allow for up to Q=2^10, S=2^11 by specifying that a tick is 2^{-32} of a second, QS^2/F=64,
//     and T = 64 * M * W/R     (we further take max(T,1) to ensure every event takes at least one tick)

//    NB actual Q_max is 1000<1024 so r_max < 2^32, however R_max = r_max * M so we do need to store R as a BigInt
//    and we will sometimes need more than 32 bits of randomness; specifically, if S=2^11, Q=2^10, and M=2^20 then R_max=2^52
//    so the random number generation will really need to be a BigInt (intermediate value is 104 bits, well more than 64)

//    Given the above concerns we reduce the size of rates as follows:
//    Set M=1, round all rates up to nearest integer Hz, and implement the fractional part by randomly rejecting some moves.

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

    processMove (move) {
        if (move.type === 'command') {
            const { time, user, id, dir, command, key } = move;
            const index = this.byID[id];
            if (typeof(index) !== 'undefined') {
                const [x,y] = this.index2xy(index);
                const cell = this.cell[index];
                if (typeof(cell.owner) === 'undefined' || user === cell.owner || user === Board.owner) {
                    const rules = command ? this.grammar.command[cell.type][command] : this.grammar.key[cell.type][key];
                    rules.reduce ((success, rule) => success || applyTransformRule (this, x, y, dir, rule), false);
                }
            }
        } else if (move.type === 'write') {
            const { time, user, cells } = move;
            cells.forEach ((write) => {
                let { x, y, id, oldType, oldState, type, state, meta } = write;
                const index = id ? this.byID[id] : (typeof(x) !== 'undefined' && typeof(y) !== 'undefined' ? this.xy2index(x,y) : undefined);
                if (typeof(index) !== 'undefined') {
                    const cell = this.cell[index];
                    if (typeof(cell.owner) === 'undefined' || user === cell.owner || user === Board.owner)
                        if (typeof(meta?.owner) === 'undefined' || user === meta.owner)
                            if (typeof(oldType) === 'undefined' || this.grammar.types[cell.type] === oldType)
                                if (typeof(oldState === 'undefined' || cell.state === oldState))
                                    this.setCellTypeByName (x, y, type, state, meta);
                }
            })
        } else if (move.type === 'grammar') {
            const { user, grammar } = move;
            if (user === Board.owner)
                this.updateGrammar (grammar);
        } else
            console.error ('Unknown move type');
    }

    randomDir() {
        return lookups.dirs[this.rng.int() % 4];
    }

    // if hardStop is true, then there is a concrete event at time t, and we will advance the clock to that point even if nothing happens in the final interval
    // if hardStop is false, we stop the clock (and the random number generator) at the last event *before* t, so that we can resume consistently if more events (e.g. moves) arrive after t but before the next event
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
            const nextSyncTimes = this.grammar.syncPeriods.map ((p) => p + this.time - (this.time % p));
            const nextTime = bigMin (t, ...nextSyncTimes);
            const nextSyncCategories = this.grammar.syncCategories.filter ((n) => nextSyncTimes[n] === nextTime);
            const nextTimeIsSyncEvent = nextSyncCategories.length > 0;
            this.evolveAsyncToTime (nextTime, hardStop || nextTimeIsSyncEvent);
            if (nextTimeIsSyncEvent)
                knuthShuffle (this.rng, nextSyncCategories.reduce ((l, nSync) =>
                    l.concat (this.grammar.typesBySyncCategory[nSync].reduce ((l, nType) => {
                        const rules = this.grammar.syncTransform[nSync][nType];
                        return l.concat (this.byType[nType].elements().reduce ((l, index) => {
                            const xy = this.index2xy(index);
                            return l.concat (rules.map ((rule) => [xy,rule]));
                        }, []));
                    }, [])), [])).forEach ((xy_rule) =>
                        applyTransformRule(this,xy_rule[0][0],xy_rule[0][1],this.randomDir(),xy_rule[1]));
        }
    }

    // evolve board, processing sync rules and moves
    // There is probably no reason to call this with hardStop==true, unless imposing another time limit that is well-defined within the game
    evolveAndProcess (t, moves, hardStop) {
        moves.filter ((msg) => msg.time > t).toSorted ((a,b) => a.time > b.time ? +1 : a.time < b.time ? -1 : 0).forEach ((move) => {
            this.evolveToTime (move.time, true);
            this.processMove (move);
        })
        this.evolveToTime (t, hardStop);
    }

    typesIncludingUnknowns() {
        const unknownTypes = this.byType[this.grammar.unknownType].elements().reduce ((types, index) => types.add (this.cell[index].meta?.type), new Set());
        const types = this.grammar.types.concat (Array.from(unknownTypes).filter((type)=>typeof(type)!=='undefined'));
        const type2idx = types.reduce ((map, type, idx) => { map[type] = idx; return map; }, {});
        return { types, type2idx };
    }

    typeCountsIncludingUnknowns() {
        let count = {};
        this.typesIncludingUnknowns().types.forEach ((type) => count[type] = 0);
        this.cell.forEach ((cell) => {
            const type = cell.type === this.grammar.unknownType ? cell.meta?.type : this.grammar.types[cell.type];
            if (type)
                count[type] = (count[type] || 0) + 1;
        })
        return count;
    }

    cellToJSON (cell, type2idx) {
        let meta = {...cell.meta || {}}, typeIdx = cell.type;
        if (typeIdx === this.grammar.unknownType && meta.type) {
            typeIdx = type2idx[meta.type];
            delete meta.type;
        }
        if (Object.keys(meta).length === 0)
            meta = undefined;
        return cell.state || meta ? [typeIdx,cell.state || ''].concat(meta ? [meta] : []) : typeIdx;
    }

    toJSON() {
        const { types, type2idx } = this.typesIncludingUnknowns();
        return { time: this.time.toString(),
                 lastEventTime: this.lastEventTime.toString(),
                 rng: this.rng.toString(),
                 owner: this.owner,
                 grammar: this.grammarSource,
                 types,
                 size: this.size,
                 cell: this.cell.map ((cell) => this.cellToJSON (cell, type2idx)) }
    }

    toString() {
        return stringify (this.toJSON())
    }

    initFromString (str) {
        this.initFromJSON (JSON.parse (str));
    }

    initFromJSON (json) {
        this.owner = json.owner;
        this.size = json.size || defaultBoardSize;
        this.time = BigInt (json.time || 0);
        this.lastEventTime = BigInt (json.lastEventTime || json.time || 0);
        this.rng = json.rng ? MersenneTwister.newFromString(json.rng) : new MersenneTwister(json.seed || defaultRngSeed);
        this.initGrammar (json.grammar || '');
        if (json.cell) {
            if (json.cell.length !== this.cell.length)
                throw new Error ("Tried to load "+json.cell.length+"-cell board file into "+this.cell.length+"-cell board");
            json.cell.forEach ((type_state_meta, index) => {
                if (typeof(type_state_meta) === 'number')
                    type_state_meta = [type_state_meta];
                let [type, state, meta] = type_state_meta;
                type = json.types[type];
                let typeIdx = this.grammar.typeIndex[type];
                if (typeof(typeIdx) === 'undefined') {
                    meta = {...meta||{},type};
                    typeIdx = this.grammar.unknownType;
                }
                this.setCellByIndex (index, { type: typeIdx,
                                              state: state || '',
                                              ...(meta ? {meta} : {})});
            });
        }
    }

    // TODO
    // Implement canonical hashes of board, rules, and moves
    // Implement "create verifiable update" (hashes of board, rule, moves, and time lapsed, plus new board state) and "verify update"

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

}

export { Board, xy2index };