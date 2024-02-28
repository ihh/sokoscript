def safeAdd(x, y):
    lsw = (x & 0xffff) + (y & 0xffff)
    msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)

def bitRotateLeft(num, cnt):
    return (num << cnt) | (num >> (32 - cnt))

def md5cmn(q, a, b, x, s, t):
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b)

def md5ff(a, b, c, d, x, s, t):
    return md5cmn((b & c) | (~b & d), a, b, x, s, t)

def md5gg(a, b, c, d, x, s, t):
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t)

def md5hh(a, b, c, d, x, s, t):
    return md5cmn(b ^ c ^ d, a, b, x, s, t)

def md5ii(a, b, c, d, x, s, t):
    return md5cmn(c ^ (b | ~d), a, b, x, s, t)

def binlMD5(x, length):
    x[length >> 5] |= 0x80 << length % 32
    x[(((length + 64) >> 9) << 4) + 14] = length
    a = 1732584193
    b = -271733879
    c = -1732584194
    d = 271733878
    for i in range(0, len(x), 16):
        olda = a
        oldb = b
        oldc = c
        oldd = d
        a = md5ff(a, b, c, d, x[i], 7, -680876936)
        d = md5ff(d, a, b, c, x[i + 1], 12, -389564586)
        c = md5ff(c, d, a, b, x[i + 2], 17, 606105819)
        b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330)
        a = md5ff(a, b, c, d, x[i + 4], 7, -176418897)
        d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426)
        c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341)
        b = md5ff(b, c, d, a, x[i + 7], 22, -45705983)
        a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416)
        d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417)
        c = md5ff(c, d, a, b, x[i + 10], 17, -42063)
        b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162)
        a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682)
        d = md5ff(d, a, b, c, x[i + 13], 12, -40341101)
        c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290)
        b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329)
        a = md5gg(a, b, c, d, x[i + 1], 5, -165796510)
        d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632)
        c = md5gg(c, d, a, b, x[i + 11], 14, 643717713)
        b = md5gg(b, c, d, a, x[i], 20, -373897302)
        a = md5gg(a, b, c, d, x[i + 5], 5, -701558691)
        d = md5gg(d, a, b, c, x[i + 10], 9, 38016083)
        c = md5gg(c, d, a, b, x[i + 15], 14, -660478335)
        b = md5gg(b, c, d, a, x[i + 4], 20, -405537848)
        a = md5gg(a, b, c, d, x[i + 9], 5, 568446438)
        d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690)
        c = md5gg(c, d, a, b, x[i + 3], 14, -187363961)
        b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501)
        a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467)
        d = md5gg(d, a, b, c, x[i + 2], 9, -51403784)
        c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473)
        b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734)
        a = md5hh(a, b, c, d, x[i + 5], 4, -378558)
        d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463)
        c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562)
        b = md5hh(b, c, d, a, x[i + 14], 23, -35309556)
        a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060)
        d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353)
        c = md5hh(c, d, a, b, x[i + 7], 16, -155497632)
        b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640)
        a = md5hh(a, b, c, d, x[i + 13], 4, 681279174)
        d = md5hh(d, a, b, c, x[i], 11, -358537222)
        c = md5hh(c, d, a, b, x[i + 3], 16, -722521979)
        b = md5hh(b, c, d, a, x[i + 6], 23, 76029189)
        a = md5hh(a, b, c, d, x[i + 9], 4, -640364487)
        d = md5hh(d, a, b, c, x[i + 12], 11, -421815835)
        c = md5hh(c, d, a, b, x[i + 15], 16, 530742520)
        b = md5hh(b, c, d, a, x[i + 2], 23, -995338651)
        a = md5ii(a, b, c, d, x[i], 6, -198630844)
        d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415)
        c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905)
        b = md5ii(b, c, d, a, x[i + 5], 21, -57434055)
        a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571)
        d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606)
        c = md5ii(c, d, a, b, x[i + 10], 15, -1051523)
        b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799)
        a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359)
        d = md5ii(d, a, b, c, x[i + 15], 10, -30611744)
        c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380)
        b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649)
        a = md5ii(a, b, c, d, x[i + 4], 6, -145523070)
        d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379)
        c = md5ii(c, d, a, b, x[i + 2], 15, 718787259)
        b = md5ii(b, c, d, a, x[i + 9], 21, -343485551)
        a = safeAdd(a, olda)
        b = safeAdd(b, oldb)
        c = safeAdd(c, oldc)
        d = safeAdd(d, oldd)
    return [a, b, c, d]

def binl2rstr(input):
    output = ''
    length32 = len(input) * 32
    for i in range(0, length32, 8):
        output += chr((input[i >> 5] >> i % 32) & 0xff)
    return output

def rstr2binl(input):
    output = [0] * ((len(input) >> 2) + 1)
    length8 = len(input) * 8
    for i in range(0, length8, 8):
        output[i >> 5] |= (ord(input[i // 8]) & 0xff) << i % 32
    return output

def rstrMD5(s):
    return binl2rstr(binlMD5(rstr2binl(s), len(s) * 8))

def rstrHMACMD5(key, data):
    bkey = rstr2binl(key)
    ipad = [0] * 16
    opad = [0] * 16
    if len(bkey) > 16:
        bkey = binlMD5(bkey, len(key) * 8)
    for i in range(16):
        ipad[i] = bkey[i] ^ 0x36363636
        opad[i] = bkey[i] ^ 0x5c5c5c5c
    hash = binlMD5(ipad + rstr2binl(data), 512 + len(data) * 8)
    return binl2rstr(binlMD5(opad + hash, 512 + 128))

def rstr2hex(input):
    hexTab = '0123456789abcdef'
    output = ''
    for i in range(len(input)):
        x = ord(input[i])
        output += hexTab[(x >> 4) & 0x0f] + hexTab[x & 0x0f]
    return output

def str2rstrUTF8(input):
    return input

def rawMD5(s):
    return rstrMD5(str2rstrUTF8(s))

def hexMD5(s):
    return rstr2hex(rawMD5(s))

def rawHMACMD5(k, d):
    return rstrHMACMD5(str2rstrUTF8(k), str2rstrUTF8(d))

def hexHMACMD5(k, d):
    return rstr2hex(rawHMACMD5(k, d))

def md5(string, key=None, raw=False):
    if not key:
        if not raw:
            return hexMD5(string)
        return rawMD5(string)
    if not raw:
        return hexHMACMD5(key, string)
    return rawHMACMD5(key, string)


