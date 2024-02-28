import lookups
from gramutil import bigIntContainerToObject

class Matcher:
    def __init__(self, board, x, y, dir):
        self.board = board
        self.x = x
        self.y = y
        self.dir = lookups.charLookup.absDir[dir]
        self.termAddr = []
        self.termCell = []
        self.termTailStart = []
        self.failed = False

    def getCell(self, x, y):
        return self.board.getCell(x + self.x, y + self.y)

    def matchLhsTerm(self, t, type, state):
        if t['op'] == 'negterm':
            return not self.matchLhsTerm(t['term'], type, state)
        if t['op'] == 'alt':
            return any(self.matchLhsTerm(term, type, state) for term in t['alt'])
        if t['type'] != type:
            return False
        if not t['state']:
            return not state
        for n in range(len(t['state'])):
            matchStatus = self.matchStateChar(t['state'][n], state[n])
            if not matchStatus:
                return False
            if matchStatus < 0:
                return True
        return len(t['state']) == len(state)

    def matchStateChar(self, s, c):
        if isinstance(s, str):
            return s == c
        op = s['op']
        if op == 'char':
            return s['char'] == c
        if op == 'wild':
            return isinstance(c, str)
        if op == 'any':
            return -1
        if op == 'class':
            return c in s['chars']
        if op == 'negated':
            return c not in s['chars']
        return self.computeStateChar(s) == c

    def computeStateChar(self, t):
        if isinstance(t, str):
            return t
        op = t['op']
        if op == 'char':
            return t
        if op == 'clock' or op == 'anti':
            return lookups.charPermLookup.rotate[op][self.computeStateChar(t['arg'])]
        if op == 'add':
            return lookups.charPermLookup.intAdd[self.computeStateChar(t['right'])][self.computeStateChar(t['left'])]
        if op == 'sub' or op == '+':
            return lookups.charPermLookup.vecAdd[self.computeStateChar(t['right'])][self.computeStateChar(t['left'])]
        if op == '-':
            return lookups.charPermLookup.vecSub[self.computeStateChar(t['right'])][self.computeStateChar(t['left'])]
        if op == '*':
            return lookups.charPermLookup.matMul[t['left']['matrix']][self.computeStateChar(t['right'])]
        if op == 'location':
            return lookups.vec2char(self.termAddr[t['group']-1])
        if op == 'reldir':
            return self.getRelativeDir(t['dir'])
        if op == 'absdir':
            return lookups.charVecLookup[t['dir']]
        if op == 'integer':
            return lookups.int2char(t['n'])
        if op == 'vector':
            return lookups.vec2char(t['x'], t['y'])
        if op == 'state':
            return self.termCell[t['group']-1]['state'][t['char']-1]
        if op == 'tail':
            return self.termCell[t['group']-1]['state'][self.termTailStart[t['group']-1]:]
        raise ValueError(f"Unrecognized op '{op}' in {t}")

    def getRelativeDir(self, dir):
        return lookups.charPermLookup.matMul[dir][self.dir]

    def computeAddr(self, addr, baseVec):
        op = addr['op']
        if op == 'absolute':
            return lookups.charVecLookup[lookups.charPermLookup.vecAdd[lookups.absDir[self.dir]][lookups.vec2char(baseVec)]]
        if op == 'relative':
            return lookups.charVecLookup[lookups.charPermLookup.vecAdd[self.getRelativeDir(addr['dir'])][lookups.vec2char(baseVec)]]
        if op == 'neighbor':
            return lookups.charVecLookup[lookups.charPermLookup.vecAdd[self.computeStateChar(addr['arg'])][lookups.vec2char(baseVec)]]
        if op == 'cell':
            return lookups.charVecLookup[self.computeStateChar(addr['arg'])]
        raise ValueError(f"Unrecognized op '{op}' in {addr}")

    def matchLhsCell(self, term, pos):
        if not self.failed:
            if pos == 0:
                x = y = 0
            else:
                x, y = self.computeAddr(term.get('dir', {'op': 'relative', 'dir': 'F'}), self.termAddr[pos-1], pos)
            self.termAddr.append([x, y])
            cell = self.board.getCell(x + self.x, y + self.y)
            type = cell['type']
            state = cell['state']
            match = self.matchLhsTerm(term, type, state)
            if match:
                self.termCell.append(cell)
                self.termTailStart.append(len(state) - 1 if term.get('state') and term['state'][-1]['op'] == 'any' else len(state))
            else:
                self.failed = True
        else:
            self.failed = True
        return self

    def newCell(self, t):
        if t['op'] == 'group':
            cell = self.termCell[t['group']-1]
            return {'type': cell['type'], 'state': cell['state'], 'meta': cell['meta']}
        if t['op'] == 'prefix':
            cell = self.termCell[t['group']-1]
            newState = ''.join(self.computeStateChar(s) for s in t.get('state', ''))
            return {'type': cell['type'], 'state': newState, 'meta': cell['meta']}
        state = ''.join(self.computeStateChar(s) for s in t.get('state', ''))
        return {'type': t['type'], 'state': state}

    def newCellUpdate(self, term, pos):
        a = self.termAddr[pos]
        return [a[0] + self.x, a[1] + self.y, self.newCell(term)]

def applyTransformRule(board, x, y, dir, rule):
    updates = transformRuleUpdate(board, x, y, dir, rule)
    if updates:
        for update in updates:
            if update:
                board.setCell(*update)
    return bool(updates)

def stripDuplicateMetadata(domCell, subCell):
    if domCell.get('meta') and subCell.get('meta'):
        for prop in ['id', 'owner']:
            if domCell['meta'].get(prop) == subCell['meta'].get(prop):
                del subCell['meta'][prop]
        if not subCell['meta']:
            del subCell['meta']

def transformRuleUpdate(board, x, y, dir, rule):
    matcher = reduce(lambda matcher, term, pos: matcher.matchLhsCell(term, pos), rule['lhs'], Matcher(board, x, y, dir))
    if matcher.failed:
        return None
    update = [matcher.newCellUpdate(term, pos) for pos, term in enumerate(rule['rhs'])]
    for i in range(len(update)-1):
        for j in range(i + 1, len(update)):
            stripDuplicateMetadata(update[i][2], update[j][2])
    return update

__all__ = ['applyTransformRule', 'transformRuleUpdate']


