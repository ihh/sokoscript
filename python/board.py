import lookups
from engine import applyTransformRule, transformRuleUpdate
from log2 import fastLn_leftShift26_max, fastLn_leftShift26
from gramutil import parseOrUndefined, compileTypes
from MersenneTwister import MersenneTwister
from canonical_json import stringify

defaultBoardSize = 64
defaultRngSeed = 5489

def xy2index(x, y, size):
    return (((y % size) + size) % size) * size + (((x % size) + size) % size)

class RangeCounter:
    def __init__(self, n, full):
        self.n = n
        self.log2n = math.log(n) / math.log(2)
        if (self.log2n) % 1 != 0:
            raise Exception("Length is not a power of 2: " + str(n))
        self.levelCount = [[full if i == level else 0 for i in range(1 << (self.log2n - level))] for level in range(self.log2n + 1)]

    def add(self, val):
        for level in range(self.log2n, -1, -1):
            self.levelCount[level][val >> level] += 1

    def remove(self, val):
        for level in range(self.log2n, -1, -1):
            self.levelCount[level][val >> level] -= 1

    def total(self):
        return self.levelCount[self.log2n][0]

    def kthElement(self, k):
        index = 0
        for level in range(self.log2n - 1, -1, -1):
            index = index << 1
            if k + 1 > self.levelCount[level][index]:
                k -= self.levelCount[level][index]
                index += 1
        return index

    def elements(self):
        return [self.kthElement(k) for k in range(self.total())]

def randomInt(rng, max):
    return int((max * rng.int()) >> 32)

def randomBigInt(rng, max):
    tmp = max
    lg = 32
    r = rng.int()
    while tmp:
        tmp = tmp >> 32
        lg += 32
        r = (r << 32) | rng.int()
    return (max * r) >> lg

def knuthShuffle(rng, list):
    len = len(list)
    for k in range(len - 1):
        i = k + randomInt(rng, len - k)
        list[i], list[k] = list[k], list[i]
    return list

def bigSum(*args):
    return sum(args)

def bigMin(*args):
    return min(args)

def bigMax(*args):
    return max(args)

class Board:
    def __init__(self, opts):
        self.maxStateLen = 64
        self.initFromJSON(opts or {})

    def initGrammar(self, grammar):
        self.grammarSource = grammar
        self.grammar = compileTypes(parseOrUndefined(grammar, error=False) or [])
        self.cell = [{"type": 0, "state": ""} for _ in range(self.size * self.size)]
        self.byType = [RangeCounter(self.size * self.size, n == 0) for n in range(len(self.grammar.types))]
        self.byID = {}

    def updateGrammar(self, grammar):
        self.initFromJSON({...self.toJSON(), "grammar": grammar})

    def timeInSeconds(self):
        return self.time / 2**32

    def index2xy(self, index):
        return [index % self.size, index // self.size]

    def xy2index(self, x, y):
        return xy2index(x, y, self.size)

    def getCell(self, x, y):
        return self.cell[self.xy2index(x, y)]

    def setCell(self, x, y, newValue):
        if len(newValue["state"]) > self.maxStateLen:
            newValue["state"] = newValue["state"][:self.maxStateLen]
        self.setCellByIndex(self.xy2index(x, y), newValue)

    def setCellByIndex(self, index, newValue):
        oldValue = self.cell[index]
        if newValue["type"] != oldValue["type"]:
            oldByType = self.byType[oldValue["type"]]
            newByType = self.byType[newValue["type"]]
            oldByType.remove(index)
            newByType.add(index)
        if oldValue["meta"] and oldValue["meta"]["id"] and self.byID[oldValue["meta"]["id"]] == index and (not newValue["meta"] or newValue["meta"]["id"] != oldValue["meta"]["id"]):
            del self.byID[oldValue["meta"]["id"]]
        if newValue["meta"] and newValue["meta"]["id"] and (not oldValue["meta"] or newValue["meta"]["id"] != oldValue["meta"]["id"]):
            if newValue["meta"]["id"] in self.byID:
                prevIndexForNewID = self.byID[newValue["meta"]["id"]]
                prevCellForNewID = self.cell[prevIndexForNewID]
                if prevCellForNewID["meta"]:
                    if prevCellForNewID["meta"]["id"] == newValue["meta"]["id"]:
                        del prevCellForNewID["meta"]["id"]
                    else:
                        print("ID mismatch: cell (" + self.index2xy(prevIndexForNewID) + ") type " + self.grammar.type[prevCellForNewID["type"]] + " has ID " + prevCellForNewID["meta"]["id"] + ", expected " + newValue["meta"]["id"])
            self.byID[newValue["meta"]["id"]] = index
        self.cell[index] = newValue

    def setCellTypeByName(self, x, y, type, state, meta):
        typeIdx = self.grammar.typeIndex[type]
        if typeIdx == '':
            meta = {...meta or {}, "type": type}
            typeIdx = self.grammar.unknownType
        state = state or ''
        self.setCell(x, y, {"type": typeIdx, "state": state, "meta": meta})

    def getCellDescriptorString(self, x, y):
        cell = self.getCell(x, y)
        type = self.grammar.types[cell["type"]]
        return type + (cell["state"] and "/" + cell["state"]) + (cell["meta"] and cell["meta"] and " " + json.dumps(cell["meta"]))

    def getCellDescriptorStringWithCoords(self, x, y):
        return "(" + x + "," + y + ") " + self.getCellDescriptorString(x, y)

    def totalTypeRates(self):
        return [self.byType[counter].total() * self.grammar.rateByType[type] for counter, type in enumerate(self.grammar.types)]

    def getUniqueID(self, prefix):
        idPrefix = prefix or 'cell'
        id = 1
        while idPrefix + str(id) in self.byID:
            id += 1
        return idPrefix + str(id)

    def nextRule(self, maxWait):
        typeRates = self.totalTypeRates()
        totalRate = bigSum(*typeRates)
        if totalRate == 0:
            return None
        r1 = self.rng.int()
        wait = 64 * (fastLn_leftShift26_max - fastLn_leftShift26(r1)) / totalRate or 1
        if wait > maxWait:
            return None
        r2 = randomBigInt(self.rng, totalRate)
        r = r2
        type = 0
        w = 0
        while r >= 0:
            w = typeRates[type]
            r -= w
            type += 1
        type -= 1
        r += w
        t = self.grammar.rateByType[type]
        n = r // t
        r2modt = r
        r = r - n * t
        rules = self.grammar.transform[type]
        ruleIndex = 0
        rule = None
        while r >= 0:
            rule = rules[ruleIndex]
            w = rule["rate_Hz"]
            r -= w
            ruleIndex += 1
        ruleIndex -= 1
        r3 = self.rng.int()
        if (r3 & 0x3fffffff) > rule["acceptProb_leftShift30"]:
            return None
        dir = lookups.dirs[r3 >> 30]
        x, y = self.index2xy(self.byType[type].kthElement(n))
        return {"wait": wait, "x": x, "y": y, "rule": rule, "dir": dir}

    def processMove(self, move):
        if move["type"] == "command":
            time = move["time"]
            user = move["user"]
            id = move["id"]
            dir = move["dir"]
            command = move["command"]
            key = move["key"]
            index = self.byID[id]
            if index != '':
                x, y = self.index2xy(index)
                cell = self.cell[index]
                if cell["owner"] == '' or user == cell["owner"] or user == Board.owner:
                    rules = self.grammar.command[cell["type"]][command] if command else self.grammar.key[cell["type"]][key]
                    success = False
                    for rule in rules:
                        success = success or applyTransformRule(self, x, y, dir, rule)
        elif move["type"] == "write":
            time = move["time"]
            user = move["user"]
            cells = move["cells"]
            for write in cells:
                x = write["x"]
                y = write["y"]
                id = write["id"]
                oldType = write["oldType"]
                oldState = write["oldState"]
                type = write["type"]
                state = write["state"]
                meta = write["meta"]
                index = self.byID[id] if id else (self.xy2index(x, y) if x != '' and y != '' else '')
                if index != '':
                    cell = self.cell[index]
                    if cell["owner"] == '' or user == cell["owner"] or user == Board.owner:
                        if meta["owner"] == '' or user == meta["owner"]:
                            if oldType == '' or self.grammar.types[cell["type"]] == oldType:
                                if oldState == '' or cell["state"] == oldState:
                                    self.setCellTypeByName(x, y, type, state, meta)
        elif move["type"] == "grammar":
            user = move["user"]
            grammar = move["grammar"]
            if user == Board.owner:
                self.updateGrammar(grammar)
        else:
            print("Unknown move type")

    def randomDir(self):
        return lookups.dirs[self.rng.int() % 4]

    def evolveAsyncToTime(self, t, hardStop):
        while self.time < t:
            mt = self.rng.mt
            r = self.nextRule(t - self.lastEventTime)
            if not r:
                self.time = t
                if hardStop:
                    self.lastEventTime = t
                else:
                    self.rng.mt = mt
                break
            wait = r["wait"]
            x = r["x"]
            y = r["y"]
            rule = r["rule"]
            dir = r["dir"]
            applyTransformRule(self, x, y, dir, rule)
            self.time = self.lastEventTime = self.lastEventTime + wait

    def evolveToTime(self, t, hardStop):
        million = 1000000
        while self.time < t:
            nextSyncTimes = [p + self.time - (self.time % p) for p in self.grammar.syncPeriods]
            nextTime = bigMin(t, *nextSyncTimes)
            nextSyncCategories = [n for n, nextSyncTime in enumerate(nextSyncTimes) if nextSyncTime == nextTime]
            nextTimeIsSyncEvent = len(nextSyncCategories) > 0
            self.evolveAsyncToTime(nextTime, hardStop or nextTimeIsSyncEvent)
            if nextTimeIsSyncEvent:
                nextSyncCategories = knuthShuffle(self.rng, nextSyncCategories)
                for nSync in nextSyncCategories:
                    for nType in self.grammar.typesBySyncCategory[nSync]:
                        rules = self.grammar.syncTransform[nSync][nType]
                        for index in self.byType[nType].elements():
                            xy = self.index2xy(index)
                            for rule in rules:
                                applyTransformRule(self, xy[0], xy[1], self.randomDir(), rule)

    def evolveAndProcess(self, t, moves, hardStop):
        moves = [move for move in moves if move["time"] > t].sort(key=lambda move: move["time"])
        for move in moves:
            self.evolveToTime(move["time"], True)
            self.processMove(move)
        self.evolveToTime(t, hardStop)

    def typesIncludingUnknowns(self):
        unknownTypes = set()
        for index in self.byType[self.grammar.unknownType].elements():
            cell = self.cell[index]
            if cell["meta"] and cell["meta"]["type"]:
                unknownTypes.add(cell["meta"]["type"])
        types = self.grammar.types + [type for type in unknownTypes if type != '']
        type2idx = {type: idx for idx, type in enumerate(types)}
        return {"types": types, "type2idx": type2idx}

    def typeCountsIncludingUnknowns(self):
        count = {}
        for type in self.typesIncludingUnknowns()["types"]:
            count[type] = 0
        for cell in self.cell:
            type = self.grammar.types[cell["type"]] if cell["type"] != self.grammar.unknownType else cell["meta"]["type"]
            if type:
                count[type] = count.get(type, 0) + 1
        return count

    def cellToJSON(self, cell, type2idx):
        meta = cell["meta"] or {}
        typeIdx = cell["type"]
        if typeIdx == self.grammar.unknownType and meta["type"]:
            typeIdx = type2idx[meta["type"]]
            del meta["type"]
        if not meta:
            meta = None
        return [typeIdx, cell["state"] or '', meta] if cell["state"] or meta else typeIdx

    def toJSON(self):
        typesIncludingUnknowns = self.typesIncludingUnknowns()
        types = typesIncludingUnknowns["types"]
        type2idx = typesIncludingUnknowns["type2idx"]
        return {"time": str(self.time),
                "lastEventTime": str(self.lastEventTime),
                "rng": str(self.rng),
                "owner": self.owner,
                "grammar": self.grammarSource,
                "types": types,
                "size": self.size,
                "cell": [self.cellToJSON(cell, type2idx) for cell in self.cell]}

    def toString(self):
        return stringify(self.toJSON())

    def initFromString(self, str):
        self.initFromJSON(json.loads(str))

    def initFromJSON(self, json):
        self.owner = json["owner"]
        self.size = json.get("size", defaultBoardSize)
        self.time = int(json.get("time", 0))
        self.lastEventTime = int(json.get("lastEventTime", json.get("time", 0)))
        self.rng = MersenneTwister.newFromString(json["rng"]) if "rng" in json else MersenneTwister(json.get("seed", defaultRngSeed))
        self.initGrammar(json.get("grammar", ''))
        if "cell" in json:
            if len(json["cell"]) != len(self.cell):
                raise Exception("Tried to load " + str(len(json["cell"])) + "-cell board file into " + str(len(self.cell)) + "-cell board")
            for index, type_state_meta in enumerate(json["cell"]):
                if isinstance(type_state_meta, int):
                    type_state_meta = [type_state_meta]
                type, state, meta = type_state_meta
                type = json["types"][type]
                typeIdx = self.grammar.typeIndex[type]
                if typeIdx == '':
                    meta = {...meta or {}, "type": type}
                    typeIdx = self.grammar.unknownType
                self.setCellByIndex(index, {"type": typeIdx, "state": state or '', "meta": meta})

Board.owner = None
xy2index = xy2index
Board = Board


