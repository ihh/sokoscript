dirVec = {'N': [0,-1],
          'E': [1,0],
          'S': [0,1],
          'W': [-1,0]}
dirs = ['N','E','S','W']
matrices = {'F': [[1,0],[0,1]],
            'R': [[0,-1],[1,0]],
            'B': [[-1,0],[0,-1]],
            'L': [[0,1],[-1,0]],
            'H': [[-1,0],[0,1]],
            'V': [[1,0],[0,-1]]}
neighborhood = {'moore': [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],
                'neumann': [[0,-1],[-1,0],[0,0],[1,0],[0,1]]}

def addVecs(u, v):
    return [u[0] + v[0], u[1] + v[1]]

def matMulVec(m, v):
    return [m[0][0] * v[0] + m[0][1] * v[1],
            m[1][0] * v[0] + m[1][1] * v[1]]

def minusVec(v):
    return matMulVec(matrices['B'], v)

firstChar = 33
lastChar = 126
nChars = lastChar + 1 - firstChar
allChars = [chr(n) for n in range(firstChar, lastChar+1)]

def char2int(c):
    return (((ord(c) - firstChar) % nChars) + nChars) % nChars

def int2char(n):
    return chr(firstChar + (((n % nChars) + nChars) % nChars))

def cyclicAdd(a, b):
    return (a + b) % nChars

def minusInt(x):
    return nChars - x

firstVecChar = 40

def isNonVec(v):
    return not (v[0] >= -4 and v[0] <= 4 and v[1] >= -4 and v[1] <= 4)

def isZeroVec(v):
    return v[0] == 0 and v[1] == 0

def vec2char(v):
    if isNonVec(v):
        return '~'
    return chr(firstVecChar + (v[0] + 4) + (v[1] + 4) * 9)

def char2vec(c):
    n = ord(c) - firstVecChar
    if n < 0 or n > 80:
        return [float('nan'), float('nan')]
    return [(n % 9) - 4, (n // 9) - 4]

def invertCharFunc(f):
    inv = {}
    for c in allChars:
        inv[f(c)] = c
    return lambda c: inv[c]

def rotateNeighborhoodClockwise(c):
    v = char2vec(c)
    if isNonVec(v) or isZeroVec(v):
        return c
    x = v[0]
    y = v[1]
    radius = max(abs(x), abs(y))
    if x == -radius:
        newVec = [x+1, y] if y == -radius else [x, y-1]
    elif y == -radius:
        newVec = [x, y+1] if x == radius else [x+1, y]
    elif x == radius:
        newVec = [x-1, y] if y == radius else [x, y+1]
    else:
        newVec = [x-1, y] # y == radius, x > -radius
    return vec2char(newVec)

def rotateNeighborhoodCounterClockwise(c):
    return invertCharFunc(rotateNeighborhoodClockwise)(c)

def tabulateCharFunc(f):
    return {c: f(c) for c in allChars}

def tabulateVecFunc(f):
    return tabulateCharFunc(lambda c: vec2char(f(char2vec(c))))

def tabulateIntFunc(f):
    return tabulateCharFunc(lambda c: int2char(f(char2int(c))))

def tabulateMatMul(m):
    return tabulateVecFunc(lambda v: matMulVec(m, char2vec(v)))

def tabulateVecAdd(c):
    return tabulateVecFunc(lambda v: addVecs(char2vec(c), v))

def tabulateVecSub(c):
    return tabulateVecFunc(lambda v: addVecs(minusVec(char2vec(c)), v))

def tabulateIntAdd(c):
    return tabulateIntFunc(lambda n: cyclicAdd(char2int(c), n))

def tabulateIntSub(c):
    return tabulateIntFunc(lambda n: cyclicAdd(minusInt(char2int(c)), n))

def tabulateOperators(operators, tabulator):
    return {operator: tabulator(operator) for operator in operators}

charPermLookup = {
    'matMul': tabulateOperators(matrices.keys(), lambda k: tabulateMatMul(matrices[k])),
    'vecAdd': tabulateOperators(allChars, tabulateVecAdd),
    'vecSub': tabulateOperators(allChars, tabulateVecSub),
    'intAdd': tabulateOperators(allChars, tabulateIntAdd),
    'intSub': tabulateOperators(allChars, tabulateIntSub),
    'rotate': {'clock': tabulateCharFunc(rotateNeighborhoodClockwise),
               'anti': tabulateCharFunc(rotateNeighborhoodCounterClockwise)}
}

charLookup = {
    'absDir': {d: vec2char(dirVec[d]) for d in dirs}
}

def computeCharNeighborhood(nbrs, c):
    return ''.join(sorted([vec2char(addVecs(nbr, char2vec(c))) for nbr in nbrs if not isNonVec(addVecs(nbr, char2vec(c)))]))

charClassLookup = tabulateOperators(neighborhood.keys(), lambda nh: tabulateCharFunc(lambda c: computeCharNeighborhood(neighborhood[nh], c)))

charVecLookup = tabulateCharFunc(char2vec)

charRotLookup = {
    vec2char([0,-1]): 0,
    vec2char([1,-1]): 45,
    vec2char([1,0]): 90,
    vec2char([1,1]): 135,
    vec2char([0,1]): 180,
    vec2char([-1,1]): 225,
    vec2char([-1,0]): 270,
    vec2char([-1,-1]): 315
}

charPermLookup, charLookup, charClassLookup, charVecLookup, vec2char, int2char, dirs, charRotLookup


