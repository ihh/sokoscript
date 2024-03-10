(() => {
  // lookups.js
  var dirVec = {
    N: [0, -1],
    E: [1, 0],
    S: [0, 1],
    W: [-1, 0]
  };
  var dirs = ["N", "E", "S", "W"];
  var matrices = {
    F: [[1, 0], [0, 1]],
    R: [[0, -1], [1, 0]],
    B: [[-1, 0], [0, -1]],
    L: [[0, 1], [-1, 0]],
    H: [[-1, 0], [0, 1]],
    V: [[1, 0], [0, -1]]
  };
  var neighborhood = {
    moore: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
    neumann: [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]
  };
  var addVecs = (u, v) => {
    return [u[0] + v[0], u[1] + v[1]];
  };
  var matMulVec = (m, v) => {
    return [
      m[0][0] * v[0] + m[0][1] * v[1],
      m[1][0] * v[0] + m[1][1] * v[1]
    ];
  };
  var minusVec = (v) => matMulVec(matrices.B, v);
  var firstChar = 33;
  var lastChar = 126;
  var nChars = lastChar + 1 - firstChar;
  var allChars = new Array(nChars).fill(0).map((_, n) => String.fromCharCode(n + firstChar));
  var char2int = (c) => ((c.charCodeAt(0) - firstChar) % nChars + nChars) % nChars;
  var int2char = (n) => String.fromCharCode(firstChar + (n % nChars + nChars) % nChars);
  var cyclicAdd = (a, b) => (a + b) % nChars;
  var minusInt = (x) => nChars - x;
  var firstVecChar = 40;
  var isNonVec = (v) => !(v[0] >= -4 && v[0] <= 4 && v[1] >= -4 && v[1] <= 4);
  var isZeroVec = (v) => v[0] == 0 && v[1] == 0;
  var vec2char = (v) => {
    if (isNonVec(v))
      return "~";
    return String.fromCharCode(firstVecChar + (v[0] + 4) + (v[1] + 4) * 9);
  };
  var char2vec = (c) => {
    const n = c.charCodeAt(0) - firstVecChar;
    if (n < 0 || n > 80)
      return [NaN, NaN];
    return [n % 9 - 4, Math.floor(n / 9) - 4];
  };
  var invertCharFunc = (f) => {
    let inv = {};
    allChars.forEach((c) => inv[f(c)] = c);
    return (c) => inv[c];
  };
  var rotateNeighborhoodClockwise = (c) => {
    const v = char2vec(c);
    if (isNonVec(v) || isZeroVec(v))
      return c;
    const x = v[0], y = v[1];
    const radius = Math.max(Math.abs(x), Math.abs(y));
    let newVec;
    if (x == -radius)
      newVec = y == -radius ? [x + 1, y] : [x, y - 1];
    else if (y == -radius)
      newVec = x == radius ? [x, y + 1] : [x + 1, y];
    else if (x == radius)
      newVec = y == radius ? [x - 1, y] : [x, y + 1];
    else
      newVec = [x - 1, y];
    return vec2char(newVec);
  };
  var rotateNeighborhoodCounterClockwise = invertCharFunc(rotateNeighborhoodClockwise);
  var tabulateCharFunc = (f) => Object.assign(...allChars.map((c) => ({ [c]: f(c) })));
  var tabulateVecFunc = (f) => tabulateCharFunc((c) => vec2char(f(char2vec(c))));
  var tabulateIntFunc = (f) => tabulateCharFunc((c) => int2char(f(char2int(c))));
  var tabulateMatMul = (m) => tabulateVecFunc(matMulVec.bind(null, m));
  var tabulateVecAdd = (c) => tabulateVecFunc(addVecs.bind(null, char2vec(c)));
  var tabulateVecSub = (c) => tabulateVecFunc(addVecs.bind(null, minusVec(char2vec(c))));
  var tabulateIntAdd = (c) => tabulateIntFunc(cyclicAdd.bind(null, char2int(c)));
  var tabulateIntSub = (c) => tabulateIntFunc(cyclicAdd.bind(null, minusInt(char2int(c))));
  var tabulateOperators = (operators, tabulator) => Object.assign(...operators.map((operator) => ({ [operator]: tabulator(operator) })));
  var charPermLookup = {
    matMul: tabulateOperators(Object.keys(matrices), (k) => tabulateMatMul(matrices[k])),
    vecAdd: tabulateOperators(allChars, tabulateVecAdd),
    vecSub: tabulateOperators(allChars, tabulateVecSub),
    intAdd: tabulateOperators(allChars, tabulateIntAdd),
    intSub: tabulateOperators(allChars, tabulateIntSub),
    rotate: {
      clock: tabulateCharFunc(rotateNeighborhoodClockwise),
      anti: tabulateCharFunc(rotateNeighborhoodCounterClockwise)
    }
  };
  var charLookup = {
    absDir: Object.assign(...dirs.map((d) => ({ [d]: vec2char(dirVec[d]) })))
  };
  var computeCharNeighborhood = (nbrs, c) => nbrs.map((nbr) => addVecs(nbr, char2vec(c))).filter((v) => !isNonVec(v)).map(vec2char).sort().join("");
  var charClassLookup = tabulateOperators(Object.keys(neighborhood), (nh) => tabulateCharFunc(computeCharNeighborhood.bind(null, neighborhood[nh])));
  var charVecLookup = tabulateCharFunc(char2vec);
  var charRotLookup = {
    [vec2char([0, -1])]: 0,
    [vec2char([1, -1])]: 45,
    [vec2char([1, 0])]: 90,
    [vec2char([1, 1])]: 135,
    [vec2char([0, 1])]: 180,
    [vec2char([-1, 1])]: 225,
    [vec2char([-1, 0])]: 270,
    [vec2char([-1, -1])]: 315
  };

  // grammar.js
  function peg$subclass(child, parent) {
    function ctor() {
      this.constructor = child;
    }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }
  function peg$SyntaxError(message, expected, found, location) {
    this.message = message;
    this.expected = expected;
    this.found = found;
    this.location = location;
    this.name = "SyntaxError";
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, peg$SyntaxError);
    }
  }
  peg$subclass(peg$SyntaxError, Error);
  peg$SyntaxError.buildMessage = function(expected, found) {
    var DESCRIBE_EXPECTATION_FNS = {
      literal: function(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      "class": function(expectation) {
        var escapedParts = "", i;
        for (i = 0; i < expectation.parts.length; i++) {
          escapedParts += expectation.parts[i] instanceof Array ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1]) : classEscape(expectation.parts[i]);
        }
        return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
      },
      any: function(expectation) {
        return "any character";
      },
      end: function(expectation) {
        return "end of input";
      },
      other: function(expectation) {
        return expectation.description;
      }
    };
    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }
    function literalEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function classEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      var descriptions = new Array(expected2.length), i, j;
      for (i = 0; i < expected2.length; i++) {
        descriptions[i] = describeExpectation(expected2[i]);
      }
      descriptions.sort();
      if (descriptions.length > 0) {
        for (i = 1, j = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
        case 1:
          return descriptions[0];
        case 2:
          return descriptions[0] + " or " + descriptions[1];
        default:
          return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  };
  function peg$parse(input, options) {
    options = options !== void 0 ? options : {};
    var peg$FAILED = {}, peg$startRuleFunctions = { RuleTop: peg$parseRuleTop }, peg$startRuleFunction = peg$parseRuleTop, peg$c0 = function(s) {
      return s;
    }, peg$c1 = ".", peg$c2 = peg$literalExpectation(".", false), peg$c3 = function(r, s) {
      return validateInheritance(r, s, error);
    }, peg$c4 = function(r, s) {
      return [r].concat(s);
    }, peg$c5 = function(r) {
      return [r];
    }, peg$c6 = function(c, s) {
      return [c].concat(s);
    }, peg$c7 = function(c) {
      return [c];
    }, peg$c8 = function(lhs) {
      return validateLhs(lhs);
    }, peg$c9 = ":", peg$c10 = peg$literalExpectation(":", false), peg$c11 = function(lhs, rhs) {
      return validateRhs(lhs, rhs);
    }, peg$c12 = ",", peg$c13 = peg$literalExpectation(",", false), peg$c14 = function(lhs, rhs, attrs) {
      return { type: "transform", lhs, rhs, ...attrs };
    }, peg$c15 = function(lhs, rhs) {
      return { type: "transform", lhs, rhs };
    }, peg$c16 = "=", peg$c17 = peg$literalExpectation("=", false), peg$c18 = function(child, parents) {
      return { type: "inherit", child, parents };
    }, peg$c19 = "//", peg$c20 = peg$literalExpectation("//", false), peg$c21 = /^[^\n]/, peg$c22 = peg$classExpectation(["\n"], true, false), peg$c23 = function(c) {
      return { type: "comment", comment: c.join("") };
    }, peg$c24 = function(a) {
      return countDuplicateAttributes(a, error);
    }, peg$c25 = function(a) {
      return validateAttributes(a);
    }, peg$c26 = function(a) {
      return Object.assign(...a);
    }, peg$c27 = function(first, rest) {
      return [first].concat(rest.map((a) => a[1]));
    }, peg$c28 = function(first, rest) {
      return [first].concat(rest.map((r) => r[3]));
    }, peg$c29 = function(p) {
      return [p];
    }, peg$c30 = function(t2, addr, u, s) {
      return [t2, { addr, ...u }].concat(s);
    }, peg$c31 = function(t2, addr, u) {
      return [t2, { addr, ...u }];
    }, peg$c32 = function(t2, u, s) {
      return [t2, u].concat(s);
    }, peg$c33 = function(t2, u) {
      return [t2, u];
    }, peg$c34 = function(t2) {
      return [t2];
    }, peg$c35 = ">", peg$c36 = peg$literalExpectation(">", false), peg$c37 = function(d) {
      return { op: "absdir", dir: d.toUpperCase() };
    }, peg$c38 = function(d) {
      return { op: "reldir", dir: d.toUpperCase() };
    }, peg$c39 = /^[nsewNSEW]/, peg$c40 = peg$classExpectation(["n", "s", "e", "w", "N", "S", "E", "W"], false, false), peg$c41 = /^[fblrFBLR]/, peg$c42 = peg$classExpectation(["f", "b", "l", "r", "F", "B", "L", "R"], false, false), peg$c43 = function(arg) {
      return { op: "cell", arg };
    }, peg$c44 = ">+", peg$c45 = peg$literalExpectation(">+", false), peg$c46 = function(arg) {
      return { op: "neighbor", arg };
    }, peg$c47 = ">-", peg$c48 = peg$literalExpectation(">-", false), peg$c49 = function(arg) {
      return { op: "neighbor", arg: minusVec2(arg) };
    }, peg$c50 = "#", peg$c51 = peg$literalExpectation("#", false), peg$c52 = function(group, char) {
      return { op: "neighbor", arg: { op: "state", group, char } };
    }, peg$c53 = function(char) {
      return { op: "neighbor", arg: { op: "state", group: 0, char } };
    }, peg$c54 = function(group, char) {
      return { op: "neighbor", arg: minusVec2({ op: "state", group, char }) };
    }, peg$c55 = function(char) {
      return { op: "neighbor", arg: minusVec2({ op: "state", group: 0, char }) };
    }, peg$c56 = "+", peg$c57 = peg$literalExpectation("+", false), peg$c58 = "-", peg$c59 = peg$literalExpectation("-", false), peg$c60 = function(first, rest) {
      return rest.reduce(function(memo, curr) {
        return { op: curr[1], left: memo, right: curr[3] };
      }, first);
    }, peg$c61 = "*", peg$c62 = peg$literalExpectation("*", false), peg$c63 = "", peg$c64 = function(front, back) {
      return front.reduce(function(memo, curr) {
        return { op: "*", left: curr[0], right: memo };
      }, back);
    }, peg$c65 = "%", peg$c66 = peg$literalExpectation("%", false), peg$c67 = /^[dblrhvDBLRHV]/, peg$c68 = peg$classExpectation(["d", "b", "l", "r", "h", "v", "D", "B", "L", "R", "H", "V"], false, false), peg$c69 = function(m) {
      return { op: "matrix", matrix: m.toUpperCase() };
    }, peg$c70 = "@", peg$c71 = peg$literalExpectation("@", false), peg$c72 = function(group) {
      return { op: "location", group };
    }, peg$c73 = "@vec(", peg$c74 = peg$literalExpectation("@vec(", false), peg$c75 = ")", peg$c76 = peg$literalExpectation(")", false), peg$c77 = function(x, y) {
      return { op: "vector", x: parseInt(x), y: parseInt(y) };
    }, peg$c78 = "@int(", peg$c79 = peg$literalExpectation("@int(", false), peg$c80 = function(n) {
      return { op: "integer", n: parseInt(n) };
    }, peg$c81 = "@add(", peg$c82 = peg$literalExpectation("@add(", false), peg$c83 = function(left, right) {
      return { op: "add", left, right };
    }, peg$c84 = "@sub(", peg$c85 = peg$literalExpectation("@sub(", false), peg$c86 = function(left, right) {
      return { op: "sub", left, right };
    }, peg$c87 = "@clock(", peg$c88 = peg$literalExpectation("@clock(", false), peg$c89 = function(arg) {
      return { op: "clock", arg };
    }, peg$c90 = "@anti(", peg$c91 = peg$literalExpectation("@anti(", false), peg$c92 = function(arg) {
      return { op: "anti", arg };
    }, peg$c93 = function(dir) {
      return { op: "absdir", dir: dir.toUpperCase() };
    }, peg$c94 = function(dir) {
      return { op: "reldir", dir: dir.toUpperCase() };
    }, peg$c95 = "$#", peg$c96 = peg$literalExpectation("$#", false), peg$c97 = function(char) {
      return { op: "state", group: 0, char };
    }, peg$c98 = "$", peg$c99 = peg$literalExpectation("$", false), peg$c100 = function(group, char) {
      return { op: "state", group, char };
    }, peg$c101 = "(", peg$c102 = peg$literalExpectation("(", false), peg$c103 = function(expr) {
      return expr;
    }, peg$c104 = function(addr, t2, s) {
      return [{ addr, ...t2 }].concat(s);
    }, peg$c105 = function(addr, t2) {
      return [{ addr, ...t2 }];
    }, peg$c106 = function(t2, s) {
      return [t2].concat(s);
    }, peg$c107 = "/", peg$c108 = peg$literalExpectation("/", false), peg$c109 = function(type, state) {
      return { type, state };
    }, peg$c110 = function(type) {
      return { type };
    }, peg$c111 = function() {
      return { op: "any" };
    }, peg$c112 = "^", peg$c113 = peg$literalExpectation("^", false), peg$c114 = function(term) {
      return { op: "negterm", term };
    }, peg$c115 = "|", peg$c116 = peg$literalExpectation("|", false), peg$c117 = function(first, rest) {
      return { op: "alt", alt: rest.reduce((l, t2) => l.concat([t2[1]]), [first]) };
    }, peg$c118 = function() {
      return { type: "_" };
    }, peg$c119 = "_", peg$c120 = peg$literalExpectation("_", false), peg$c121 = function() {
      return text();
    }, peg$c122 = function(c, s) {
      return [c].concat(s);
    }, peg$c123 = function() {
      return [{ op: "any" }];
    }, peg$c124 = /^[a-z]/, peg$c125 = peg$classExpectation([["a", "z"]], false, false), peg$c126 = /^[0-9_]/, peg$c127 = peg$classExpectation([["0", "9"], "_"], false, false), peg$c128 = "?", peg$c129 = peg$literalExpectation("?", false), peg$c130 = function() {
      return { op: "wild" };
    }, peg$c131 = "[^", peg$c132 = peg$literalExpectation("[^", false), peg$c133 = "]", peg$c134 = peg$literalExpectation("]", false), peg$c135 = function(chars) {
      return { op: "negated", chars };
    }, peg$c136 = "[", peg$c137 = peg$literalExpectation("[", false), peg$c138 = function(chars) {
      return { op: "class", chars };
    }, peg$c139 = "moore", peg$c140 = peg$literalExpectation("moore", false), peg$c141 = "neumann", peg$c142 = peg$literalExpectation("neumann", false), peg$c143 = function(neighborhood2, origin) {
      return { op: "neighborhood", neighborhood: neighborhood2, origin };
    }, peg$c144 = function(s, o) {
      return [s].concat(o);
    }, peg$c145 = function(s) {
      return [s];
    }, peg$c146 = function(group, state, id) {
      return { op: "prefix", group, state, ...id };
    }, peg$c147 = function(group, id) {
      return { op: "group", group, ...id };
    }, peg$c148 = function(type, state, id) {
      return { type, state, ...id };
    }, peg$c149 = function(type, id) {
      return { type, ...id };
    }, peg$c150 = "$#*", peg$c151 = peg$literalExpectation("$#*", false), peg$c152 = function() {
      return { op: "tail", group: 0 };
    }, peg$c153 = "#*", peg$c154 = peg$literalExpectation("#*", false), peg$c155 = function(group) {
      return { op: "tail", group };
    }, peg$c156 = function(char) {
      return { op: "char", char };
    }, peg$c157 = "\\", peg$c158 = peg$literalExpectation("\\", false), peg$c159 = peg$anyExpectation(), peg$c160 = /^[0-9A-Za-z_]/, peg$c161 = peg$classExpectation([["0", "9"], ["A", "Z"], ["a", "z"], "_"], false, false), peg$c162 = "~", peg$c163 = peg$literalExpectation("~", false), peg$c164 = function(group) {
      return { id: group };
    }, peg$c165 = "~0", peg$c166 = peg$literalExpectation("~0", false), peg$c167 = function() {
      return { id: 0 };
    }, peg$c168 = function() {
      return {};
    }, peg$c169 = "rate={", peg$c170 = peg$literalExpectation("rate={", false), peg$c171 = "}", peg$c172 = peg$literalExpectation("}", false), peg$c173 = function(rate) {
      return { rate };
    }, peg$c174 = "rate=", peg$c175 = peg$literalExpectation("rate=", false), peg$c176 = "sync={", peg$c177 = peg$literalExpectation("sync={", false), peg$c178 = function(sync) {
      return { sync };
    }, peg$c179 = "sync=", peg$c180 = peg$literalExpectation("sync=", false), peg$c181 = "command={", peg$c182 = peg$literalExpectation("command={", false), peg$c183 = function(command) {
      return { command };
    }, peg$c184 = "command=", peg$c185 = peg$literalExpectation("command=", false), peg$c186 = "key={", peg$c187 = peg$literalExpectation("key={", false), peg$c188 = function(key) {
      return { key };
    }, peg$c189 = "key=", peg$c190 = peg$literalExpectation("key=", false), peg$c191 = "score={", peg$c192 = peg$literalExpectation("score={", false), peg$c193 = function(r) {
      return { score: parseInt(r) };
    }, peg$c194 = "score=", peg$c195 = peg$literalExpectation("score=", false), peg$c196 = "sound={", peg$c197 = peg$literalExpectation("sound={", false), peg$c198 = function(sound) {
      return { sound };
    }, peg$c199 = "sound=", peg$c200 = peg$literalExpectation("sound=", false), peg$c201 = "caption={", peg$c202 = peg$literalExpectation("caption={", false), peg$c203 = function(caption) {
      return caption;
    }, peg$c204 = "caption=", peg$c205 = peg$literalExpectation("caption=", false), peg$c206 = /^[1-9]/, peg$c207 = peg$classExpectation([["1", "9"]], false, false), peg$c208 = /^[0-9]/, peg$c209 = peg$classExpectation([["0", "9"]], false, false), peg$c210 = function() {
      return parseInt(text());
    }, peg$c211 = "0", peg$c212 = peg$literalExpectation("0", false), peg$c213 = function(i, f) {
      return 1e6 * parseInt(i) + parseInt(f);
    }, peg$c214 = function(i) {
      return 1e6 * parseInt(i);
    }, peg$c215 = function(f) {
      return parseInt(f);
    }, peg$c216 = "1000", peg$c217 = peg$literalExpectation("1000", false), peg$c218 = function() {
      return text() + "0";
    }, peg$c219 = function() {
      return text() + "00";
    }, peg$c220 = function() {
      return text() + "000";
    }, peg$c221 = function() {
      return text() + "0000";
    }, peg$c222 = function() {
      return text() + "00000";
    }, peg$c223 = function(c, s) {
      return c + s;
    }, peg$c224 = /^[^\\}]/, peg$c225 = peg$classExpectation(["\\", "}"], true, false), peg$c226 = function(c) {
      return c;
    }, peg$c227 = /^[A-Za-z0-9_]/, peg$c228 = peg$classExpectation([["A", "Z"], ["a", "z"], ["0", "9"], "_"], false, false), peg$c229 = /^[ \t\n\r]/, peg$c230 = peg$classExpectation([" ", "	", "\n", "\r"], false, false), peg$c231 = peg$otherExpectation("whitespace"), peg$currPos = 0, peg$savedPos = 0, peg$posDetailsCache = [{ line: 1, column: 1 }], peg$maxFailPos = 0, peg$maxFailExpected = [], peg$silentFails = 0, peg$result;
    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
      }
      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }
    function text() {
      return input.substring(peg$savedPos, peg$currPos);
    }
    function location() {
      return peg$computeLocation(peg$savedPos, peg$currPos);
    }
    function expected(description, location2) {
      location2 = location2 !== void 0 ? location2 : peg$computeLocation(peg$savedPos, peg$currPos);
      throw peg$buildStructuredError(
        [peg$otherExpectation(description)],
        input.substring(peg$savedPos, peg$currPos),
        location2
      );
    }
    function error(message, location2) {
      location2 = location2 !== void 0 ? location2 : peg$computeLocation(peg$savedPos, peg$currPos);
      throw peg$buildSimpleError(message, location2);
    }
    function peg$literalExpectation(text2, ignoreCase) {
      return { type: "literal", text: text2, ignoreCase };
    }
    function peg$classExpectation(parts, inverted, ignoreCase) {
      return { type: "class", parts, inverted, ignoreCase };
    }
    function peg$anyExpectation() {
      return { type: "any" };
    }
    function peg$endExpectation() {
      return { type: "end" };
    }
    function peg$otherExpectation(description) {
      return { type: "other", description };
    }
    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos], p;
      if (details) {
        return details;
      } else {
        p = pos - 1;
        while (!peg$posDetailsCache[p]) {
          p--;
        }
        details = peg$posDetailsCache[p];
        details = {
          line: details.line,
          column: details.column
        };
        while (p < pos) {
          if (input.charCodeAt(p) === 10) {
            details.line++;
            details.column = 1;
          } else {
            details.column++;
          }
          p++;
        }
        peg$posDetailsCache[pos] = details;
        return details;
      }
    }
    function peg$computeLocation(startPos, endPos) {
      var startPosDetails = peg$computePosDetails(startPos), endPosDetails = peg$computePosDetails(endPos);
      return {
        start: {
          offset: startPos,
          line: startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line: endPosDetails.line,
          column: endPosDetails.column
        }
      };
    }
    function peg$fail(expected2) {
      if (peg$currPos < peg$maxFailPos) {
        return;
      }
      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }
      peg$maxFailExpected.push(expected2);
    }
    function peg$buildSimpleError(message, location2) {
      return new peg$SyntaxError(message, null, null, location2);
    }
    function peg$buildStructuredError(expected2, found, location2) {
      return new peg$SyntaxError(
        peg$SyntaxError.buildMessage(expected2, found),
        expected2,
        found,
        location2
      );
    }
    function peg$parseRuleTop() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseRuleSet();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c0(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parseRuleSet() {
      var s0, s1, s2, s3, s4, s5, s6;
      s0 = peg$currPos;
      s1 = peg$parseRule();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 46) {
            s3 = peg$c1;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c2);
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseRuleSet();
              if (s5 !== peg$FAILED) {
                peg$savedPos = peg$currPos;
                s6 = peg$c3(s1, s5);
                if (s6) {
                  s6 = void 0;
                } else {
                  s6 = peg$FAILED;
                }
                if (s6 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c4(s1, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseRule();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 46) {
              s3 = peg$c1;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c2);
              }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c5(s1);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseRule();
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c5(s1);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$parseComment();
            if (s1 !== peg$FAILED) {
              s2 = peg$parse_();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseRuleSet();
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c6(s1, s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              s1 = peg$parseComment();
              if (s1 !== peg$FAILED) {
                s2 = peg$parse_();
                if (s2 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c7(s1);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            }
          }
        }
      }
      return s0;
    }
    function peg$parseRule() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;
      s0 = peg$currPos;
      s1 = peg$parseLhs();
      if (s1 !== peg$FAILED) {
        peg$savedPos = peg$currPos;
        s2 = peg$c8(s1);
        if (s2) {
          s2 = void 0;
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 58) {
              s4 = peg$c9;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c10);
              }
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                s6 = peg$parseRhsTermSeq();
                if (s6 !== peg$FAILED) {
                  peg$savedPos = peg$currPos;
                  s7 = peg$c11(s1, s6);
                  if (s7) {
                    s7 = void 0;
                  } else {
                    s7 = peg$FAILED;
                  }
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_();
                    if (s8 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 44) {
                        s9 = peg$c12;
                        peg$currPos++;
                      } else {
                        s9 = peg$FAILED;
                        if (peg$silentFails === 0) {
                          peg$fail(peg$c13);
                        }
                      }
                      if (s9 !== peg$FAILED) {
                        s10 = peg$parse_();
                        if (s10 !== peg$FAILED) {
                          s11 = peg$parseValidAttributes();
                          if (s11 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c14(s1, s6, s11);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseLhs();
        if (s1 !== peg$FAILED) {
          peg$savedPos = peg$currPos;
          s2 = peg$c8(s1);
          if (s2) {
            s2 = void 0;
          } else {
            s2 = peg$FAILED;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parse_();
            if (s3 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 58) {
                s4 = peg$c9;
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c10);
                }
              }
              if (s4 !== peg$FAILED) {
                s5 = peg$parse_();
                if (s5 !== peg$FAILED) {
                  s6 = peg$parseRhsTermSeq();
                  if (s6 !== peg$FAILED) {
                    peg$savedPos = peg$currPos;
                    s7 = peg$c11(s1, s6);
                    if (s7) {
                      s7 = void 0;
                    } else {
                      s7 = peg$FAILED;
                    }
                    if (s7 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c15(s1, s6);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parsePrefix();
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 61) {
                s3 = peg$c16;
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c17);
                }
              }
              if (s3 !== peg$FAILED) {
                s4 = peg$parse_();
                if (s4 !== peg$FAILED) {
                  s5 = peg$parseInheritRhs();
                  if (s5 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c18(s1, s5);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
      return s0;
    }
    function peg$parseComment() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c19) {
        s1 = peg$c19;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c20);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c21.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c22);
          }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c21.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c22);
              }
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c23(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parseValidAttributes() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parseAttributes();
      if (s1 !== peg$FAILED) {
        peg$savedPos = peg$currPos;
        s2 = peg$c24(s1);
        if (s2) {
          s2 = peg$FAILED;
        } else {
          s2 = void 0;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = peg$currPos;
          s3 = peg$c25(s1);
          if (s3) {
            s3 = void 0;
          } else {
            s3 = peg$FAILED;
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c26(s1);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parseAttributes() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      s1 = peg$parseAttribute();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseAttribute();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseAttribute();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c27(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parseInheritRhs() {
      var s0, s1, s2, s3, s4, s5, s6, s7;
      s0 = peg$currPos;
      s1 = peg$parsePrefix();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 44) {
            s5 = peg$c12;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c13);
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parsePrefix();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$currPos;
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 44) {
                s5 = peg$c12;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c13);
                }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parsePrefix();
                  if (s7 !== peg$FAILED) {
                    s4 = [s4, s5, s6, s7];
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c28(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsePrefix();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c29(s1);
        }
        s0 = s1;
      }
      return s0;
    }
    function peg$parseAttribute() {
      var s0;
      s0 = peg$parseRate();
      if (s0 === peg$FAILED) {
        s0 = peg$parseSync();
        if (s0 === peg$FAILED) {
          s0 = peg$parseCommand();
          if (s0 === peg$FAILED) {
            s0 = peg$parseKey();
            if (s0 === peg$FAILED) {
              s0 = peg$parseScore();
              if (s0 === peg$FAILED) {
                s0 = peg$parseSound();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseCaption();
                }
              }
            }
          }
        }
      }
      return s0;
    }
    function peg$parseLhs() {
      var s0, s1, s2, s3, s4, s5, s6;
      s0 = peg$currPos;
      s1 = peg$parseSubject();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseDirOrNbrAddr();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseWildLhsTerm();
              if (s5 !== peg$FAILED) {
                s6 = peg$parseLhsNbrSeq();
                if (s6 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c30(s1, s3, s5, s6);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseSubject();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseDirOrNbrAddr();
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseWildLhsTerm();
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c31(s1, s3, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseSubject();
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_sep();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseWildLhsTerm();
              if (s3 !== peg$FAILED) {
                s4 = peg$parseLhsNbrSeq();
                if (s4 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c32(s1, s3, s4);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$parseSubject();
            if (s1 !== peg$FAILED) {
              s2 = peg$parse_sep();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseWildLhsTerm();
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c33(s1, s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              s1 = peg$parseSubject();
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c34(s1);
              }
              s0 = s1;
            }
          }
        }
      }
      return s0;
    }
    function peg$parseDirOrNbrAddr() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 62) {
        s1 = peg$c35;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c36);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseAbsDirChar();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 62) {
            s3 = peg$c35;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c36);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c37(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 62) {
          s1 = peg$c35;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c36);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseRelDirChar();
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 62) {
              s3 = peg$c35;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c36);
              }
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c38(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseNbrAddr();
        }
      }
      return s0;
    }
    function peg$parseAbsDirChar() {
      var s0;
      if (peg$c39.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c40);
        }
      }
      return s0;
    }
    function peg$parseRelDirChar() {
      var s0;
      if (peg$c41.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c42);
        }
      }
      return s0;
    }
    function peg$parseNbrAddr() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 62) {
        s1 = peg$c35;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c36);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseAdditiveVecExpr();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 62) {
            s3 = peg$c35;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c36);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c43(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c44) {
          s1 = peg$c44;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c45);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseAdditiveVecExpr();
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 62) {
              s3 = peg$c35;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c36);
              }
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c46(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c47) {
            s1 = peg$c47;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c48);
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parseAdditiveVecExpr();
            if (s2 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 62) {
                s3 = peg$c35;
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c36);
                }
              }
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c49(s2);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 62) {
              s1 = peg$c35;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c36);
              }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseNonZeroInteger();
              if (s2 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 35) {
                  s3 = peg$c50;
                  peg$currPos++;
                } else {
                  s3 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c51);
                  }
                }
                if (s3 !== peg$FAILED) {
                  s4 = peg$parseNonZeroInteger();
                  if (s4 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 62) {
                      s5 = peg$c35;
                      peg$currPos++;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$c36);
                      }
                    }
                    if (s5 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c52(s2, s4);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 62) {
                s1 = peg$c35;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c36);
                }
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parseNonZeroInteger();
                if (s2 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 62) {
                    s3 = peg$c35;
                    peg$currPos++;
                  } else {
                    s3 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$c36);
                    }
                  }
                  if (s3 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c53(s2);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c47) {
                  s1 = peg$c47;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c48);
                  }
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parseNonZeroInteger();
                  if (s2 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 35) {
                      s3 = peg$c50;
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$c51);
                      }
                    }
                    if (s3 !== peg$FAILED) {
                      s4 = peg$parseNonZeroInteger();
                      if (s4 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 62) {
                          s5 = peg$c35;
                          peg$currPos++;
                        } else {
                          s5 = peg$FAILED;
                          if (peg$silentFails === 0) {
                            peg$fail(peg$c36);
                          }
                        }
                        if (s5 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c54(s2, s4);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c47) {
                    s1 = peg$c47;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$c48);
                    }
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parseNonZeroInteger();
                    if (s2 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 62) {
                        s3 = peg$c35;
                        peg$currPos++;
                      } else {
                        s3 = peg$FAILED;
                        if (peg$silentFails === 0) {
                          peg$fail(peg$c36);
                        }
                      }
                      if (s3 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c55(s2);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                }
              }
            }
          }
        }
      }
      return s0;
    }
    function peg$parseAdditiveVecExpr() {
      var s0, s1, s2, s3, s4, s5, s6, s7;
      s0 = peg$currPos;
      s1 = peg$parseMultiplicativeVecExpr();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 43) {
            s5 = peg$c56;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c57);
            }
          }
          if (s5 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 45) {
              s5 = peg$c58;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c59);
              }
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseMultiplicativeVecExpr();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$currPos;
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 43) {
                s5 = peg$c56;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c57);
                }
              }
              if (s5 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 45) {
                  s5 = peg$c58;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c59);
                  }
                }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseMultiplicativeVecExpr();
                  if (s7 !== peg$FAILED) {
                    s4 = [s4, s5, s6, s7];
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c60(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseMultiplicativeVecExpr();
      }
      return s0;
    }
    function peg$parseMultiplicativeVecExpr() {
      var s0, s1, s2, s3, s4, s5, s6;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$currPos;
      s3 = peg$parseMatrixExpr();
      if (s3 !== peg$FAILED) {
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 42) {
            s5 = peg$c61;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c62);
            }
          }
          if (s5 === peg$FAILED) {
            s5 = peg$c63;
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s3 = [s3, s4, s5, s6];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$currPos;
          s3 = peg$parseMatrixExpr();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 42) {
                s5 = peg$c61;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c62);
                }
              }
              if (s5 === peg$FAILED) {
                s5 = peg$c63;
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s3 = [s3, s4, s5, s6];
                  s2 = s3;
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsePrimaryVecExpr();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c64(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parsePrimaryVecExpr();
      }
      return s0;
    }
    function peg$parseMatrixExpr() {
      var s0, s1, s2;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 37) {
        s1 = peg$c65;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c66);
        }
      }
      if (s1 !== peg$FAILED) {
        if (peg$c67.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c68);
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c69(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parsePrimaryVecExpr() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 64) {
        s1 = peg$c70;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c71);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseNonZeroInteger();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c72(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c73) {
          s1 = peg$c73;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c74);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseSignedInteger();
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 44) {
                  s5 = peg$c12;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c13);
                  }
                }
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse_();
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parseSignedInteger();
                    if (s7 !== peg$FAILED) {
                      s8 = peg$parse_();
                      if (s8 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 41) {
                          s9 = peg$c75;
                          peg$currPos++;
                        } else {
                          s9 = peg$FAILED;
                          if (peg$silentFails === 0) {
                            peg$fail(peg$c76);
                          }
                        }
                        if (s9 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c77(s3, s7);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 5) === peg$c78) {
            s1 = peg$c78;
            peg$currPos += 5;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c79);
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseSignedInteger();
              if (s3 !== peg$FAILED) {
                s4 = peg$parse_();
                if (s4 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 41) {
                    s5 = peg$c75;
                    peg$currPos++;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$c76);
                    }
                  }
                  if (s5 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c80(s3);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 5) === peg$c81) {
              s1 = peg$c81;
              peg$currPos += 5;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c82);
              }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parse_();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseAdditiveVecExpr();
                if (s3 !== peg$FAILED) {
                  s4 = peg$parse_();
                  if (s4 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 44) {
                      s5 = peg$c12;
                      peg$currPos++;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$c13);
                      }
                    }
                    if (s5 !== peg$FAILED) {
                      s6 = peg$parse_();
                      if (s6 !== peg$FAILED) {
                        s7 = peg$parseAdditiveVecExpr();
                        if (s7 !== peg$FAILED) {
                          s8 = peg$parse_();
                          if (s8 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 41) {
                              s9 = peg$c75;
                              peg$currPos++;
                            } else {
                              s9 = peg$FAILED;
                              if (peg$silentFails === 0) {
                                peg$fail(peg$c76);
                              }
                            }
                            if (s9 !== peg$FAILED) {
                              peg$savedPos = s0;
                              s1 = peg$c83(s3, s7);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 5) === peg$c84) {
                s1 = peg$c84;
                peg$currPos += 5;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c85);
                }
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parse_();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseAdditiveVecExpr();
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parse_();
                    if (s4 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 44) {
                        s5 = peg$c12;
                        peg$currPos++;
                      } else {
                        s5 = peg$FAILED;
                        if (peg$silentFails === 0) {
                          peg$fail(peg$c13);
                        }
                      }
                      if (s5 !== peg$FAILED) {
                        s6 = peg$parse_();
                        if (s6 !== peg$FAILED) {
                          s7 = peg$parseAdditiveVecExpr();
                          if (s7 !== peg$FAILED) {
                            s8 = peg$parse_();
                            if (s8 !== peg$FAILED) {
                              if (input.charCodeAt(peg$currPos) === 41) {
                                s9 = peg$c75;
                                peg$currPos++;
                              } else {
                                s9 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                  peg$fail(peg$c76);
                                }
                              }
                              if (s9 !== peg$FAILED) {
                                peg$savedPos = s0;
                                s1 = peg$c86(s3, s7);
                                s0 = s1;
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 7) === peg$c87) {
                  s1 = peg$c87;
                  peg$currPos += 7;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c88);
                  }
                }
                if (s1 !== peg$FAILED) {
                  s2 = peg$parse_();
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parseAdditiveVecExpr();
                    if (s3 !== peg$FAILED) {
                      s4 = peg$parse_();
                      if (s4 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 41) {
                          s5 = peg$c75;
                          peg$currPos++;
                        } else {
                          s5 = peg$FAILED;
                          if (peg$silentFails === 0) {
                            peg$fail(peg$c76);
                          }
                        }
                        if (s5 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c89(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 6) === peg$c90) {
                    s1 = peg$c90;
                    peg$currPos += 6;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$c91);
                    }
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = peg$parse_();
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parseAdditiveVecExpr();
                      if (s3 !== peg$FAILED) {
                        s4 = peg$parse_();
                        if (s4 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 41) {
                            s5 = peg$c75;
                            peg$currPos++;
                          } else {
                            s5 = peg$FAILED;
                            if (peg$silentFails === 0) {
                              peg$fail(peg$c76);
                            }
                          }
                          if (s5 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c92(s3);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 64) {
                      s1 = peg$c70;
                      peg$currPos++;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$c71);
                      }
                    }
                    if (s1 !== peg$FAILED) {
                      s2 = peg$parseAbsDirChar();
                      if (s2 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c93(s2);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.charCodeAt(peg$currPos) === 64) {
                        s1 = peg$c70;
                        peg$currPos++;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                          peg$fail(peg$c71);
                        }
                      }
                      if (s1 !== peg$FAILED) {
                        s2 = peg$parseRelDirChar();
                        if (s2 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s1 = peg$c94(s2);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                      if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c95) {
                          s1 = peg$c95;
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) {
                            peg$fail(peg$c96);
                          }
                        }
                        if (s1 !== peg$FAILED) {
                          s2 = peg$parseNonZeroInteger();
                          if (s2 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s1 = peg$c97(s2);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                        if (s0 === peg$FAILED) {
                          s0 = peg$currPos;
                          if (input.charCodeAt(peg$currPos) === 36) {
                            s1 = peg$c98;
                            peg$currPos++;
                          } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                              peg$fail(peg$c99);
                            }
                          }
                          if (s1 !== peg$FAILED) {
                            s2 = peg$parseNonZeroInteger();
                            if (s2 !== peg$FAILED) {
                              if (input.charCodeAt(peg$currPos) === 35) {
                                s3 = peg$c50;
                                peg$currPos++;
                              } else {
                                s3 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                  peg$fail(peg$c51);
                                }
                              }
                              if (s3 !== peg$FAILED) {
                                s4 = peg$parseNonZeroInteger();
                                if (s4 !== peg$FAILED) {
                                  peg$savedPos = s0;
                                  s1 = peg$c100(s2, s4);
                                  s0 = s1;
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                          if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 40) {
                              s1 = peg$c101;
                              peg$currPos++;
                            } else {
                              s1 = peg$FAILED;
                              if (peg$silentFails === 0) {
                                peg$fail(peg$c102);
                              }
                            }
                            if (s1 !== peg$FAILED) {
                              s2 = peg$parseAdditiveVecExpr();
                              if (s2 !== peg$FAILED) {
                                if (input.charCodeAt(peg$currPos) === 41) {
                                  s3 = peg$c75;
                                  peg$currPos++;
                                } else {
                                  s3 = peg$FAILED;
                                  if (peg$silentFails === 0) {
                                    peg$fail(peg$c76);
                                  }
                                }
                                if (s3 !== peg$FAILED) {
                                  peg$savedPos = s0;
                                  s1 = peg$c103(s2);
                                  s0 = s1;
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return s0;
    }
    function peg$parseLhsNbrSeq() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseDirOrNbrAddr();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$parseWildLhsTerm();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseLhsNbrSeq();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c104(s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parse_();
        if (s1 !== peg$FAILED) {
          s2 = peg$parseDirOrNbrAddr();
          if (s2 !== peg$FAILED) {
            s3 = peg$parse_();
            if (s3 !== peg$FAILED) {
              s4 = peg$parseWildLhsTerm();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c105(s2, s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parse_sep();
          if (s1 !== peg$FAILED) {
            s2 = peg$parseWildLhsTerm();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseLhsNbrSeq();
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c106(s2, s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$parse_sep();
            if (s1 !== peg$FAILED) {
              s2 = peg$parseWildLhsTerm();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c34(s2);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }
      return s0;
    }
    function peg$parseSubject() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parsePrefix();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 47) {
          s2 = peg$c107;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c108);
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseLhsStateCharSeq();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c109(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsePrefix();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c110(s1);
        }
        s0 = s1;
      }
      return s0;
    }
    function peg$parseWildLhsTerm() {
      var s0, s1;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 42) {
        s1 = peg$c61;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c62);
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c111();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$parseLhsTerm();
      }
      return s0;
    }
    function peg$parseLhsTerm() {
      var s0, s1, s2;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 94) {
        s1 = peg$c112;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c113);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseAltLhsTerm();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c114(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseAltLhsTerm();
      }
      return s0;
    }
    function peg$parseAltLhsTerm() {
      var s0, s1, s2, s3, s4, s5, s6;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c101;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c102);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsePrimaryLhsTerm();
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 124) {
            s5 = peg$c115;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c116);
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parsePrimaryLhsTerm();
            if (s6 !== peg$FAILED) {
              s5 = [s5, s6];
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            while (s4 !== peg$FAILED) {
              s3.push(s4);
              s4 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 124) {
                s5 = peg$c115;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c116);
                }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parsePrimaryLhsTerm();
                if (s6 !== peg$FAILED) {
                  s5 = [s5, s6];
                  s4 = s5;
                } else {
                  peg$currPos = s4;
                  s4 = peg$FAILED;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            }
          } else {
            s3 = peg$FAILED;
          }
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 41) {
              s4 = peg$c75;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c76);
              }
            }
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c117(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parsePrimaryLhsTerm();
      }
      return s0;
    }
    function peg$parsePrimaryLhsTerm() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parsePrefix();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 47) {
          s2 = peg$c107;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c108);
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseLhsStateCharSeq();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c109(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsePrefix();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c110(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseEmptyLhsTerm();
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c118();
          }
          s0 = s1;
        }
      }
      return s0;
    }
    function peg$parseEmptyLhsTerm() {
      var s0;
      if (input.charCodeAt(peg$currPos) === 95) {
        s0 = peg$c119;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c120);
        }
      }
      return s0;
    }
    function peg$parsePrefix() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parseInitChar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsePrefixCharSeq();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c121();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseInitChar();
      }
      return s0;
    }
    function peg$parsePrefixCharSeq() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parsePrefixChar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsePrefixCharSeq();
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parsePrefixChar();
      }
      return s0;
    }
    function peg$parseLhsStateCharSeq() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parseLhsStateChar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseLhsStateCharSeq();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c122(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseLhsStateChar();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c7(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 42) {
            s1 = peg$c61;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c62);
            }
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c123();
          }
          s0 = s1;
        }
      }
      return s0;
    }
    function peg$parseInitChar() {
      var s0;
      if (peg$c124.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c125);
        }
      }
      return s0;
    }
    function peg$parsePrefixChar() {
      var s0;
      if (peg$c126.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c127);
        }
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseInitChar();
      }
      return s0;
    }
    function peg$parseLhsStateChar() {
      var s0;
      s0 = peg$parseWildChar();
      if (s0 === peg$FAILED) {
        s0 = peg$parseCharClass();
        if (s0 === peg$FAILED) {
          s0 = peg$parseRhsStateChar();
        }
      }
      return s0;
    }
    function peg$parseWildChar() {
      var s0, s1;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 63) {
        s1 = peg$c128;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c129);
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c130();
      }
      s0 = s1;
      return s0;
    }
    function peg$parseCharClass() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c131) {
        s1 = peg$c131;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c132);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseStateChar();
        if (s3 === peg$FAILED) {
          s3 = peg$parseNeighborhood();
          if (s3 === peg$FAILED) {
            s3 = peg$parsePrimaryVecExpr();
          }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseStateChar();
            if (s3 === peg$FAILED) {
              s3 = peg$parseNeighborhood();
              if (s3 === peg$FAILED) {
                s3 = peg$parsePrimaryVecExpr();
              }
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 93) {
            s3 = peg$c133;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c134);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c135(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 91) {
          s1 = peg$c136;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c137);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseStateChar();
          if (s3 === peg$FAILED) {
            s3 = peg$parseNeighborhood();
            if (s3 === peg$FAILED) {
              s3 = peg$parsePrimaryVecExpr();
            }
          }
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parseStateChar();
              if (s3 === peg$FAILED) {
                s3 = peg$parseNeighborhood();
                if (s3 === peg$FAILED) {
                  s3 = peg$parsePrimaryVecExpr();
                }
              }
            }
          } else {
            s2 = peg$FAILED;
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 93) {
              s3 = peg$c133;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c134);
              }
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c138(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseNeighborhood() {
      var s0, s1, s2, s3, s4, s5, s6, s7;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 64) {
        s1 = peg$c70;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c71);
        }
      }
      if (s1 !== peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c139) {
          s2 = peg$c139;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c140);
          }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 7) === peg$c141) {
            s2 = peg$c141;
            peg$currPos += 7;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c142);
            }
          }
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 40) {
            s3 = peg$c101;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c102);
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseAdditiveVecExpr();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 41) {
                    s7 = peg$c75;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$c76);
                    }
                  }
                  if (s7 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c143(s2, s5);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parseRhsTermSeq() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parseRhsTerm();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseRhsTermSeq();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c144(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseRhsTerm();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c145(s1);
        }
        s0 = s1;
      }
      return s0;
    }
    function peg$parseRhsTerm() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 36) {
        s1 = peg$c98;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c99);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseNonZeroInteger();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 47) {
            s3 = peg$c107;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c108);
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parseRhsStateCharSeq();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseOptionalIdTag();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c146(s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 36) {
          s1 = peg$c98;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c99);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseNonZeroInteger();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseOptionalIdTag();
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c147(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parsePrefix();
          if (s1 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 47) {
              s2 = peg$c107;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c108);
              }
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$parseRhsStateCharSeq();
              if (s3 !== peg$FAILED) {
                s4 = peg$parseOptionalIdTag();
                if (s4 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c148(s1, s3, s4);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$parsePrefix();
            if (s1 !== peg$FAILED) {
              s2 = peg$parseOptionalIdTag();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c149(s1, s2);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              s1 = peg$parseEmptyLhsTerm();
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c118();
              }
              s0 = s1;
            }
          }
        }
      }
      return s0;
    }
    function peg$parseRhsStateCharSeq() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parseRhsStateChar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseRhsStateCharSeq();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c122(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseRhsStateChar();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c7(s1);
        }
        s0 = s1;
      }
      return s0;
    }
    function peg$parseRhsStateChar() {
      var s0, s1, s2, s3;
      s0 = peg$parsePrimaryVecExpr();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 3) === peg$c150) {
          s1 = peg$c150;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c151);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c152();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 36) {
            s1 = peg$c98;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c99);
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parseNonZeroInteger();
            if (s2 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c153) {
                s3 = peg$c153;
                peg$currPos += 2;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c154);
                }
              }
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c155(s2);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$parseStateChar();
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c156(s1);
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 92) {
                s1 = peg$c157;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c158);
                }
              }
              if (s1 !== peg$FAILED) {
                if (input.length > peg$currPos) {
                  s2 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s2 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c159);
                  }
                }
                if (s2 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c156(s2);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            }
          }
        }
      }
      return s0;
    }
    function peg$parseStateChar() {
      var s0;
      if (peg$c160.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c161);
        }
      }
      return s0;
    }
    function peg$parseOptionalIdTag() {
      var s0, s1, s2;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 126) {
        s1 = peg$c162;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c163);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseNonZeroInteger();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c164(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c165) {
          s1 = peg$c165;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c166);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c167();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$c63;
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c168();
          }
          s0 = s1;
        }
      }
      return s0;
    }
    function peg$parseRate() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c169) {
        s1 = peg$c169;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c170);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseFixedPoint();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 125) {
                s5 = peg$c171;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c172);
                }
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c173(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c174) {
          s1 = peg$c174;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c175);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseFixedPoint();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c173(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseSync() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c176) {
        s1 = peg$c176;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c177);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseFixedPoint();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 125) {
                s5 = peg$c171;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c172);
                }
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c178(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c179) {
          s1 = peg$c179;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c180);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseFixedPoint();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c178(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseCommand() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9) === peg$c181) {
        s1 = peg$c181;
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c182);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapedString();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 125) {
            s3 = peg$c171;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c172);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c183(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 8) === peg$c184) {
          s1 = peg$c184;
          peg$currPos += 8;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c185);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseAttrString();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c183(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseKey() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 5) === peg$c186) {
        s1 = peg$c186;
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c187);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapedChar();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 125) {
            s3 = peg$c171;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c172);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c188(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 4) === peg$c189) {
          s1 = peg$c189;
          peg$currPos += 4;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c190);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseAttrChar();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c188(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseScore() {
      var s0, s1, s2, s3, s4, s5;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 7) === peg$c191) {
        s1 = peg$c191;
        peg$currPos += 7;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c192);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseSignedInteger();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 125) {
                s5 = peg$c171;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c172);
                }
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c193(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 6) === peg$c194) {
          s1 = peg$c194;
          peg$currPos += 6;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c195);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseSignedInteger();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c193(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseSound() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 7) === peg$c196) {
        s1 = peg$c196;
        peg$currPos += 7;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c197);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapedString();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 125) {
            s3 = peg$c171;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c172);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c198(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 6) === peg$c199) {
          s1 = peg$c199;
          peg$currPos += 6;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c200);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseAttrString();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c198(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseCaption() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9) === peg$c201) {
        s1 = peg$c201;
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c202);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapedString();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 125) {
            s3 = peg$c171;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c172);
            }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c203(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 8) === peg$c204) {
          s1 = peg$c204;
          peg$currPos += 8;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c205);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseAttrString();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c203(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseNonZeroInteger() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (peg$c206.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c207);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c208.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c209);
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c210();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parsePositiveInteger() {
      var s0, s1, s2;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 43) {
        s1 = peg$c56;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c57);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseNonZeroInteger();
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseNonZeroInteger();
      }
      return s0;
    }
    function peg$parseSignedInteger() {
      var s0, s1, s2;
      s0 = peg$parsePositiveInteger();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 45) {
          s1 = peg$c58;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c59);
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseNonZeroInteger();
          if (s2 !== peg$FAILED) {
            s1 = [s1, s2];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 48) {
            s0 = peg$c211;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c212);
            }
          }
        }
      }
      return s0;
    }
    function peg$parseFixedPoint() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$parseIntegerPart();
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 46) {
          s2 = peg$c1;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c2);
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseFractionalPart();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c213(s1, s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        s2 = peg$parseIntegerPart();
        if (s2 !== peg$FAILED) {
          s1 = input.substring(s1, peg$currPos);
        } else {
          s1 = s2;
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c214(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 46) {
            s1 = peg$c1;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c2);
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parseFractionalPart();
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c215(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 4) === peg$c216) {
              s1 = peg$c216;
              peg$currPos += 4;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c217);
              }
            }
            if (s1 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 48) {
                s1 = peg$c211;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c212);
                }
              }
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c210();
            }
            s0 = s1;
          }
        }
      }
      return s0;
    }
    function peg$parseIntegerPart() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      if (peg$c208.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c209);
        }
      }
      if (s1 !== peg$FAILED) {
        if (peg$c208.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c209);
          }
        }
        if (s2 !== peg$FAILED) {
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (peg$c208.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c209);
          }
        }
        if (s1 !== peg$FAILED) {
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
          if (s2 !== peg$FAILED) {
            s1 = [s1, s2];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
        }
      }
      return s0;
    }
    function peg$parseFractionalPart() {
      var s0, s1, s2, s3, s4, s5, s6;
      s0 = peg$currPos;
      if (peg$c208.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c209);
        }
      }
      if (s1 !== peg$FAILED) {
        if (peg$c208.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c209);
          }
        }
        if (s2 !== peg$FAILED) {
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
          if (s3 !== peg$FAILED) {
            if (peg$c208.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c209);
              }
            }
            if (s4 !== peg$FAILED) {
              if (peg$c208.test(input.charAt(peg$currPos))) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c209);
                }
              }
              if (s5 !== peg$FAILED) {
                if (peg$c208.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c209);
                  }
                }
                if (s6 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c121();
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (peg$c208.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c209);
          }
        }
        if (s1 !== peg$FAILED) {
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
          if (s2 !== peg$FAILED) {
            if (peg$c208.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c209);
              }
            }
            if (s3 !== peg$FAILED) {
              if (peg$c208.test(input.charAt(peg$currPos))) {
                s4 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c209);
                }
              }
              if (s4 !== peg$FAILED) {
                if (peg$c208.test(input.charAt(peg$currPos))) {
                  s5 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c209);
                  }
                }
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c218();
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (peg$c208.test(input.charAt(peg$currPos))) {
            s1 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c209);
            }
          }
          if (s1 !== peg$FAILED) {
            if (peg$c208.test(input.charAt(peg$currPos))) {
              s2 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c209);
              }
            }
            if (s2 !== peg$FAILED) {
              if (peg$c208.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c209);
                }
              }
              if (s3 !== peg$FAILED) {
                if (peg$c208.test(input.charAt(peg$currPos))) {
                  s4 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s4 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c209);
                  }
                }
                if (s4 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c219();
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (peg$c208.test(input.charAt(peg$currPos))) {
              s1 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$c209);
              }
            }
            if (s1 !== peg$FAILED) {
              if (peg$c208.test(input.charAt(peg$currPos))) {
                s2 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s2 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c209);
                }
              }
              if (s2 !== peg$FAILED) {
                if (peg$c208.test(input.charAt(peg$currPos))) {
                  s3 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s3 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c209);
                  }
                }
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c220();
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (peg$c208.test(input.charAt(peg$currPos))) {
                s1 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$c209);
                }
              }
              if (s1 !== peg$FAILED) {
                if (peg$c208.test(input.charAt(peg$currPos))) {
                  s2 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s2 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c209);
                  }
                }
                if (s2 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c221();
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (peg$c208.test(input.charAt(peg$currPos))) {
                  s1 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$c209);
                  }
                }
                if (s1 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c222();
                }
                s0 = s1;
              }
            }
          }
        }
      }
      return s0;
    }
    function peg$parseEscapedString() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parseEscapedChar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapedString();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c223(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseEscapedChar();
        if (s0 === peg$FAILED) {
          s0 = peg$c63;
        }
      }
      return s0;
    }
    function peg$parseEscapedChar() {
      var s0, s1, s2;
      if (peg$c224.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c225);
        }
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c157;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c158);
          }
        }
        if (s1 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c159);
            }
          }
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c226(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      return s0;
    }
    function peg$parseAttrString() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseAttrChar();
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$parseAttrChar();
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c121();
      }
      s0 = s1;
      return s0;
    }
    function peg$parseAttrChar() {
      var s0;
      if (peg$c227.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c228);
        }
      }
      return s0;
    }
    function peg$parse_sep() {
      var s0, s1;
      s0 = [];
      if (peg$c229.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c230);
        }
      }
      if (s1 !== peg$FAILED) {
        while (s1 !== peg$FAILED) {
          s0.push(s1);
          if (peg$c229.test(input.charAt(peg$currPos))) {
            s1 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$c230);
            }
          }
        }
      } else {
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parse_() {
      var s0, s1;
      peg$silentFails++;
      s0 = [];
      if (peg$c229.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c230);
        }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        if (peg$c229.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$c230);
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$c231);
        }
      }
      return s0;
    }
    const validatePositionals = (expr, matchedStateChars2, extraLoc) => {
      if (expr.group === 0)
        expr.group = matchedStateChars2.length;
      return ("group" in expr ? expr.group <= matchedStateChars2.length + (extraLoc && expr.op === "location" ? 1 : 0) && ("char" in expr ? expr.char <= matchedStateChars2[expr.group - 1] : true) : true) && ["left", "right", "arg"].filter((prop) => prop in expr).reduce((result, prop) => result && validatePositionals(expr[prop], matchedStateChars2), true);
    };
    const validateIds = (rhs, lhsLen) => !!rhs.reduce((seen, term) => {
      let pos;
      if ("id" in term) {
        if (term.id > lhsLen)
          return false;
        pos = term.id;
      } else if ("group" in term) {
        if (term.group > lhsLen)
          return false;
        if (!seen[term.group])
          pos = term.group;
      }
      if (seen && pos) {
        if (seen[pos])
          return false;
        seen[pos] = true;
      }
      return seen;
    }, {});
    const sum = (weights) => weights.reduce((s, w) => s + w, 0);
    const reducePred = (args, pred) => args.reduce((result, arg) => result && pred(arg), true);
    const altList = (alt) => alt.op === "alt" ? alt.alt : [alt];
    const reduceAlt = (alt, pred) => alt.op === "negterm" ? reduceAlt(alt.term, pred) : reducePred(altList(alt), pred);
    const validateState = (term, msc, extraLoc) => !("state" in term) || reducePred(term.state, (char) => validatePositionals(char, msc, extraLoc));
    const validateAddr = (term, msc) => !("addr" in term) || validatePositionals(term.addr, msc, false);
    const matchedStateChars = (alt) => altList(alt).length && Math.min.apply(null, altList(alt).map((term) => "state" in term ? term.state.filter((s) => !(s.op === "any")).length : 0));
    const validateLhs = (lhs) => lhs.reduce(
      (memo, term) => ({
        result: memo.result && reduceAlt(term, (term2) => validateState(term2, memo.matchedStateChars, true) && validateAddr(term2, memo.matchedStateChars)),
        matchedStateChars: memo.matchedStateChars.concat([matchedStateChars(term)])
      }),
      { result: true, matchedStateChars: [] }
    ).result;
    const validateRhs = (lhs, rhs) => rhs.length <= lhs.length && rhs.reduce((result, term) => result && reduceAlt(term, (term2) => validateState(term2, lhs.map(matchedStateChars), false)), true) && validateIds(rhs, lhs.length);
    const validateInheritance = (rule, rules, error2) => {
      if (rule.type === "transform")
        return true;
      let parents = {}, checked = {};
      rules.filter((r) => r.type === "inherit").forEach((r) => parents[r.child] = (parents[r.child] || []).concat(r.parents));
      const isValidAncestor = (p) => {
        if (checked[p])
          return true;
        checked[p] = true;
        if (p === rule.child) {
          error2("Type '" + rule.child + "' inherits from itself");
          return false;
        }
        return !parents[p] || reducePred(parents[p], isValidAncestor);
      };
      return reducePred(rule.parents, isValidAncestor);
    };
    const countDuplicateAttributes = (attrs, error2) => {
      let count = {};
      attrs.forEach((attr) => Object.keys(attr).forEach((k) => count[k] = (count[k] || 0) + 1));
      const duplicates = Object.keys(count).filter((k) => count[k] > 1);
      if (duplicates.length)
        error2("Duplicate attribute: " + duplicates.map((d) => '"' + d + '"').join(", "));
      return duplicates.length;
    };
    const validateAttributes = (attrs) => {
      const a = Object.assign(...attrs);
      return !(a.sync && a.rate);
    };
    const minusVec2 = (arg) => ({ op: "-", left: { op: "vector", x: 0, y: 0 }, right: arg });
    peg$result = peg$startRuleFunction();
    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail(peg$endExpectation());
      }
      throw peg$buildStructuredError(
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }

  // serialize.js
  var escape = (c, special) => {
    if (!special)
      special = " !\"#$%&'()*+,-./0123456789:;<=>?@[\\]^_`{|}~";
    return (special.indexOf(c) >= 0 ? "\\" : "") + c;
  };
  var topStateChar = (t2) => {
    if (typeof t2 === "string")
      return t2;
    switch (t2.op) {
      case "+":
      case "-":
      case "*":
        return "(" + makeStateChar(t2) + ")";
      default:
        return makeStateChar(t2);
    }
  };
  var makeStateChar = (t2) => {
    if (typeof t2 === "string")
      return t2;
    switch (t2.op) {
      case "char":
        return escape(t2.char);
      case "wild":
        return "?";
      case "any":
        return "*";
      case "class":
        return "[" + t2.chars.map(makeStateChar).join("") + "]";
      case "negated":
        return "[^" + t2.chars.map(makeStateChar).join("") + "]";
      case "neighborhood":
        return "@" + t2.neighborhood + "(" + vecExpr(t2.origin) + ")";
      case "clock":
      case "anti":
        return "@" + t2.op + "(" + vecExpr(t2.arg) + ")";
      case "add":
      case "sub":
        return "@" + t2.op + "(" + vecExpr(t2.left) + "," + vecExpr(t2.right) + ")";
      case "+":
      case "-":
      case "*":
      case "location":
      case "absdir":
      case "reldir":
      case "integer":
      case "vector":
      case "state":
      case "tail":
        return vecExpr(t2);
      default:
        throw new Error("Unrecognized op '" + t2.op + "' in " + JSON.stringify(t2));
    }
  };
  var vecExpr = (t2) => {
    switch (t2.op) {
      case "+":
      case "-":
        return vecExpr(t2.left) + t2.op + vecExpr(t2.right);
      case "*":
        return vecExpr(t2.left) + t2.op + multiplicativeVecExpr(t2.right);
      case "location":
        return "@" + t2.group;
      case "absdir":
      case "reldir":
        return "@" + t2.dir;
      case "integer":
        return "@int(" + t2.n + ")";
      case "vector":
        return "@vec(" + t2.x + "," + t2.y + ")";
      case "state":
        return "$" + (t2.group || "") + "#" + t2.char;
      case "tail":
        return "$" + (t2.group || "") + "#*";
      case "matrix":
        return "%" + t2.matrix;
      default:
        throw new Error("Unrecognized op '" + t2.op + "' in " + JSON.stringify(t2));
    }
  };
  var multiplicativeVecExpr = (t2) => {
    const s = vecExpr(t2);
    return t2.op === "+" || t2.op === "-" ? "(" + s + ")" : s;
  };
  var stateSuffix = (t2) => {
    return t2.state ? "/" + t2.state.map(topStateChar).join("") : "";
  };
  var termWithState = (t2) => {
    return (typeof t2.type === "number" ? "t" : "") + t2.type + stateSuffix(t2);
  };
  var lhsTerm = (t2) => {
    switch (t2.op) {
      case "any":
        return "*";
      case "negterm":
        return "^" + lhsTerm(t2.term);
      case "alt":
        return "(" + t2.alt.map(lhsTerm).join("|") + ")";
      default:
        return termWithState(t2);
    }
  };

  // gramutil.js
  var EmptyType = "_";
  var UnknownType = "?";
  var makeGrammarIndex = (rules) => {
    let transform = {}, syncTransform = {}, parents = {}, types = [EmptyType], seenType = { [EmptyType]: true, [UnknownType]: true };
    const markTerm = (term) => {
      if (term.op === "negterm")
        markTerm(term.term);
      else if (term.op === "alt")
        term.alt.forEach((t2) => markTerm);
      else if (term.op !== "any" && term.op !== "group" && term.op !== "prefix") {
        if (typeof term.type === "undefined")
          throw new Error("undefined type in term: " + JSON.stringify(term));
        markType(term.type);
      }
    };
    const markType = (type) => {
      if (!seenType[type])
        types.push(type);
      seenType[type] = true;
    };
    rules.forEach((rule) => {
      let prefix;
      switch (rule.type) {
        case "transform":
          {
            prefix = rule.lhs[0].type;
            let trans = rule.sync ? syncTransform[rule.sync] = syncTransform[rule.sync] || {} : transform;
            trans[prefix] = trans[prefix] || [];
            trans[prefix].push(rule);
            rule.lhs.forEach(markTerm);
            rule.rhs.forEach(markTerm);
          }
          break;
        case "inherit":
          prefix = rule.child;
          parents[prefix] = (parents[prefix] || []).concat(rule.parents);
          markType(rule.child);
          rule.parents.forEach(markType);
          break;
        case "comment":
          break;
        default:
          throw new Error("Unrecognized rule type '" + rule.type + "' in " + JSON.stringify(rule));
          break;
      }
    });
    types.push(UnknownType);
    let ancestors = Object.assign(
      ...[{}].concat(
        Object.keys(parents).map((child) => {
          let seen = {};
          const getAncestors = (prefix) => {
            if (seen[prefix] || !parents[prefix])
              return [];
            seen[prefix] = true;
            return parents[prefix].reduce((a, p) => a.concat(getAncestors(p)), parents[prefix]);
          };
          return { [child]: getAncestors(child) };
        })
      )
    );
    let isAncestor = {}, descendants = {};
    Object.keys(ancestors).forEach((descendant) => ancestors[descendant].forEach((ancestor) => {
      isAncestor[ancestor] = isAncestor[ancestor] || {};
      isAncestor[ancestor][descendant] = true;
    }));
    Object.keys(isAncestor).forEach((ancestor) => descendants[ancestor] = Object.keys(isAncestor[ancestor]).sort());
    let typeIndex = {};
    types.forEach((type, n) => typeIndex[type] = n);
    const syncRates = Object.keys(syncTransform).map((s) => parseInt(s)).sort((a, b) => a - b);
    const syncCategoriesByType = Object.assign(...[{}].concat(types.map((t2) => ({ [t2]: syncRates.filter((r) => (syncTransform[r][t2] || []).length) })).filter((o) => o[Object.keys(o)[0]].length)));
    return { transform, syncTransform, ancestors, descendants, types, typeIndex, syncRates, syncCategoriesByType };
  };
  var replaceTermWithAlt = (term, descendants) => {
    if (term.op === "negterm")
      return { op: term.op, term: replaceTermWithAlt(term.term, descendants) };
    if (term.op === "alt")
      return {
        op: term.op,
        alt: term.alt.map((t2) => replaceTermWithAlt(t2, descendants)).reduce((alt, t2) => alt.concat(t2.op === "alt" ? t2.alt : [t2]), []).reduce((memo, t2) => {
          const tstr = lhsTerm(t2);
          if (memo.seen[tstr])
            return memo;
          return { alt: memo.alt.concat([t2]), seen: { ...memo.seen, [tstr]: true } };
        }, { alt: [], seen: {} }).alt
      };
    if (descendants[term.type])
      return { op: "alt", alt: [term].concat(descendants[term.type].map((descendant) => ({ ...term, type: descendant }))) };
    return term;
  };
  var expandAlts = (transform, descendants) => Object.assign(...[{}].concat(Object.keys(transform).map((prefix) => ({
    [prefix]: transform[prefix].map((rule) => ({
      ...rule,
      lhs: [rule.lhs[0]].concat(rule.lhs.slice(1).map((term) => replaceTermWithAlt(term, descendants)))
    }))
  }))));
  var replaceSubjectType = (rule, type) => {
    let lhs = rule.lhs.slice(0);
    lhs[0] = { ...lhs[0], type };
    return { ...rule, lhs };
  };
  var appendInherited = (types, explicit, ancestors) => Object.assign(...[{}].concat(types.map((prefix) => ({
    [prefix]: (ancestors[prefix] || []).reduce((rules, ancs) => rules.concat((explicit[ancs] || []).map((rule) => replaceSubjectType(rule, prefix))), explicit[prefix] || [])
  })).filter((trans) => trans[Object.keys(trans)[0]].length)));
  var expandInherits = (index) => {
    const explicit = expandAlts(index.transform, index.descendants);
    const syncExplicit = Object.assign(...[{}].concat(index.syncRates.map((r) => ({ [r]: expandAlts(index.syncTransform[r], index.descendants) }))));
    const transform = appendInherited(index.types, explicit, index.ancestors);
    const syncTransform = Object.assign(...[{}].concat(index.syncRates.map((r) => ({ [r]: appendInherited(index.types, syncExplicit[r], index.ancestors) }))));
    return { types: index.types, typeIndex: index.typeIndex, syncRates: index.syncRates, syncCategoriesByType: index.syncCategoriesByType, transform, syncTransform };
  };
  var compileTerm = (typeIndex, t2) => {
    if (t2.op === "negterm")
      return { ...t2, term: compileTerm(typeIndex, t2.term) };
    if (t2.op === "alt")
      return { ...t2, alt: t2.alt.map((t3) => compileTerm(typeIndex, t3)) };
    return { ...t2, type: typeIndex[t2.type] };
  };
  var compileTransform = (types, transform, typeIndex, rateKey, defaultRate) => types.map((type) => (transform[type] || []).map((rule) => rule.type === "transform" ? {
    [rateKey]: defaultRate,
    ...rule,
    lhs: rule.lhs.map((t2) => compileTerm(typeIndex, t2)),
    rhs: rule.rhs.map((t2) => compileTerm(typeIndex, t2))
  } : rule));
  var collectCommandsAndKeys = (command, key, transform, types) => types.forEach((_name, type) => transform[type].forEach((rule) => {
    if (rule.command)
      command[type][rule.command] = (command[type][rule.command] || []).concat([rule]);
    if (rule.key)
      key[type][rule.key] = (key[type][rule.key] || []).concat([rule]);
  }));
  var compileTypes = (rules) => {
    const index = expandInherits(makeGrammarIndex(rules));
    const { types, typeIndex, syncRates } = index;
    const million = 1e6;
    const transform = compileTransform(types, index.transform, typeIndex, "rate", million);
    const syncTransform = index.syncRates.map((r) => compileTransform(types, index.syncTransform[r], typeIndex, "sync", 1));
    const bigMillion = BigInt(million), big2pow30minus1 = BigInt(1073741823), bigMillion_leftShift32 = bigMillion << BigInt(32);
    transform.forEach((rules2) => rules2.forEach((rule) => {
      rule.rate_Hz = BigInt(Math.ceil(rule.rate / million));
      rule.acceptProb_leftShift30 = rule.rate && Number(BigInt(rule.rate) * big2pow30minus1 / (rule.rate_Hz * bigMillion));
    }));
    let command = types.map(() => ({})), key = types.map(() => ({}));
    collectCommandsAndKeys(command, key, transform, types);
    syncRates.forEach((r, n) => collectCommandsAndKeys(command, key, syncTransform[n], types));
    const rateByType = transform.map((rules2) => rules2.reduce((total, rule) => total + rule.rate_Hz, BigInt(0)));
    const syncCategoriesByType = types.map((_t, n) => syncRates.reduce((l, _r, m) => l.concat(syncTransform[m][n].length ? [m] : []), []));
    const typesBySyncCategory = syncRates.map((_r, m) => types.reduce((l, _t, n) => l.concat(syncTransform[m][n].length ? [n] : []), []));
    const syncPeriods = syncRates.map((r) => bigMillion_leftShift32 / BigInt(r));
    const syncCategories = syncPeriods.map((_p, n) => n).reverse();
    const unknownType = types.length - 1;
    return { transform, syncTransform, types, unknownType, typeIndex, syncRates, syncPeriods, syncCategories, rateByType, syncCategoriesByType, typesBySyncCategory, command, key };
  };
  var syntaxErrorMessage = (e, text) => {
    let msg;
    if (e instanceof peg$SyntaxError) {
      const line = text.split("\n")[e.location.start.line - 1];
      const arrow = "-".repeat(e.location.start.column - 1) + "^";
      msg = `Line ${e.location.start.line}, column ${e.location.start.column}:
` + e.message + "\n" + line + "\n" + arrow + "\n";
    } else {
      msg = e;
    }
    return msg;
  };
  var parseOrUndefined = (text, opts) => {
    let rules;
    try {
      rules = peg$parse(text);
    } catch (e) {
      if (opts?.error !== false)
        (opts?.error || console.error)(opts?.suppressLocation ? e.message : syntaxErrorMessage(e, text));
    }
    return rules;
  };

  // engine.js
  var Matcher = class {
    constructor(board2, x, y, dir) {
      this.board = board2;
      this.x = x;
      this.y = y;
      this.dir = charLookup.absDir[dir];
      this.termAddr = [];
      this.termCell = [];
      this.termTailStart = [];
      this.failed = false;
    }
    getCell(x, y) {
      return board.getCell(x + this.x, y + this.y);
    }
    matchLhsTerm(t2, type, state) {
      if (t2.op === "any")
        return true;
      if (t2.op === "negterm")
        return !this.matchLhsTerm(t2.term, type, state);
      if (t2.op === "alt")
        return t2.alt.reduce((matched, term) => matched || this.matchLhsTerm(term, type, state), false);
      if (t2.type !== type)
        return false;
      if (!t2.state)
        return !state.length;
      for (let n = 0; n < t2.state.length; ++n) {
        const matchStatus = this.matchStateChar(t2.state[n], state.charAt(n));
        if (!matchStatus)
          return false;
        if (matchStatus < 0)
          return true;
      }
      return t2.state.length === state.length;
    }
    // return true to match char, -1 to match all remaining state chars
    matchStateChar(s, c) {
      if (typeof s === "string")
        return s === c;
      switch (s.op) {
        case "char":
          return s.char === c;
        case "wild":
          return typeof c !== "undefined";
        case "any":
          return -1;
        case "class":
          return s.chars.indexOf(c) >= 0;
        case "negated":
          return s.chars.indexOf(c) < 0;
        default:
          return this.computeStateChar(s) === c;
      }
    }
    computeStateChar(t2) {
      if (typeof t2 === "string")
        return t2;
      switch (t2.op) {
        case "char":
          return t2.char;
        case "clock":
        case "anti":
          return charPermLookup.rotate[t2.op][this.computeStateChar(t2.arg)];
        case "add":
          return charPermLookup.intAdd[this.computeStateChar(t2.right)][this.computeStateChar(t2.left)];
        case "sub":
          return charPermLookup.intSub[this.computeStateChar(t2.right)][this.computeStateChar(t2.left)];
        case "+":
          return charPermLookup.vecAdd[this.computeStateChar(t2.right)][this.computeStateChar(t2.left)];
        case "-":
          return charPermLookup.vecSub[this.computeStateChar(t2.right)][this.computeStateChar(t2.left)];
        case "*":
          return charPermLookup.matMul[t2.left.matrix][this.computeStateChar(t2.right)];
        case "location":
          return vec2char(this.termAddr[t2.group - 1]);
        case "reldir":
          return this.getRelativeDir(t2.dir);
        case "absdir":
          return charVecLookup[t2.dir];
        case "integer":
          return int2char(t2.n);
        case "vector":
          return vec2char(t2.x, t2.y);
        case "state":
          return this.termCell[t2.group - 1].state.charAt(t2.char - 1);
        case "tail":
          return this.termCell[t2.group - 1].state.substr(this.termTailStart[t2.group - 1]);
        default:
          throw new Error("Unrecognized op '" + t2.op + "' in " + JSON.stringify(t2));
      }
    }
    getRelativeDir(dir) {
      return charPermLookup.matMul[dir][this.dir];
    }
    computeAddr(addr, baseVec) {
      switch (addr.op) {
        case "absolute":
          return charVecLookup[charPermLookup.vecAdd[(void 0)[t.dir]][vec2char(baseVec)]];
        case "relative":
          return charVecLookup[charPermLookup.vecAdd[this.getRelativeDir(addr.dir)][vec2char(baseVec)]];
        case "neighbor":
          return charVecLookup[charPermLookup.vecAdd[this.computeStateChar(addr.arg)][vec2char(baseVec)]];
        case "cell":
          return charVecLookup[this.computeStateChar(addr.arg)];
        default:
          throw new Error("Unrecognized op '" + addr.op + "' in " + JSON.stringify(addr));
      }
    }
    matchLhsCell(term, pos) {
      if (!this.failed) {
        let x, y;
        if (pos === 0)
          x = y = 0;
        else
          [x, y] = this.computeAddr(term.dir || { op: "relative", dir: "F" }, this.termAddr[pos - 1], pos);
        this.termAddr.push([x, y]);
        const cell = this.board.getCell(x + this.x, y + this.y);
        const { type, state } = cell;
        const match = this.matchLhsTerm(term, type, state);
        if (match) {
          this.termCell.push(cell);
          this.termTailStart.push(term.state && term.state[term.state.length - 1].op === "any" ? term.state.length - 1 : state.length);
        } else
          this.failed = true;
      } else
        this.failed = true;
      return this;
    }
    getLhsPosForRhsTerm(t2) {
      if (t2.id)
        return t2.id;
      if (t2.op === "group" || t2.op === "prefix")
        return t2.group;
      return void 0;
    }
    getMetaForRhsTerm(t2, score) {
      const g = this.getLhsPosForRhsTerm(t2);
      if (g) {
        const meta2 = this.termCell[g - 1].meta;
        if (meta2 || score)
          return { ...meta2 || {}, ...g === 1 && score ? { score: (meta2?.score || 0) + score } : {} };
      }
      return void 0;
    }
    newCell(t2, score) {
      const meta2 = this.getMetaForRhsTerm(t2, score);
      if (t2.op === "group") {
        const { type: type2, state: state2 } = this.termCell[t2.group - 1];
        return { type: type2, state: state2, meta: meta2 };
      }
      if (t2.op === "prefix") {
        const { type: type2 } = this.termCell[t2.group - 1];
        const state2 = t2.state ? t2.state.map(this.computeStateChar.bind(this)).join("") : "";
        return { type: type2, state: state2, meta: meta2 };
      }
      const { type } = t2;
      const state = t2.state ? t2.state.map(this.computeStateChar.bind(this)).join("") : "";
      return { type: t2.type, state, meta: meta2 };
    }
    newCellUpdate(term, pos, score) {
      const a = this.termAddr[pos];
      return [a[0] + this.x, a[1] + this.y, this.newCell(term, score)];
    }
  };
  var applyTransformRule = (board2, x, y, dir, rule) => {
    const updates = transformRuleUpdate(board2, x, y, dir, rule);
    if (updates)
      updates.forEach((update) => update && board2.setCell(...update));
    return !!updates;
  };
  var stripDuplicateMetadata = (matcher, domCell, subCell, domTerm, subTerm) => {
    if (matcher.getLhsPosForRhsTerm(domTerm) === matcher.getLhsPosForRhsTerm(subTerm))
      delete subCell.meta;
    if (subCell?.meta?.id && domCell?.meta?.id === subCell?.meta?.id)
      delete subCell.meta["id"];
    if (subCell.meta && !Object.keys(subCell.meta).length)
      delete subCell.meta;
  };
  var matchLhs = (board2, x, y, dir, rule) => rule.lhs.reduce((matcher, term, pos) => matcher.matchLhsCell(term, pos), new Matcher(board2, x, y, dir));
  var transformRuleUpdate = (board2, x, y, dir, rule) => {
    const matcher = matchLhs(board2, x, y, dir, rule);
    if (matcher.failed)
      return null;
    let update = rule.rhs.map((term, pos) => matcher.newCellUpdate(term, pos, rule.score));
    for (let i = 0; i < update.length - 1; ++i)
      for (let j = i + 1; j < update.length; ++j)
        stripDuplicateMetadata(matcher, update[i][2], update[j][2], rule.rhs[i], rule.rhs[j]);
    return update;
  };

  // log2.js
  var LogTable256 = new Array(256).fill(0);
  for (let i = 2; i < 256; i++)
    LogTable256[i] = 1 + LogTable256[i >> 1];
  var fastLog2Floor = (v) => {
    let tt;
    if (tt = v >> 24)
      return 24 + LogTable256[tt & 255];
    if (tt = v >> 16)
      return 16 + LogTable256[tt & 255];
    if (tt = v >> 8)
      return 8 + LogTable256[tt & 255];
    return LogTable256[v];
  };
  var fastLg_leftShift26 = (x) => {
    x = x & 4294967295;
    const lg = fastLog2Floor(x);
    const nUsefulBits = Math.min(lg, 26);
    return lg << 26 | (x & (1 << nUsefulBits) - 1) << 26 - nUsefulBits;
  };
  var fastLg_leftShift26_max = fastLg_leftShift26(4294967295) + 1;
  var log2_21 = Math.round(Math.log(2) * (1 << 21));
  var fastLn_leftShift26 = (x) => {
    return Number(BigInt(fastLg_leftShift26(x)) * BigInt(log2_21) >> BigInt(21));
  };
  var fastLn_leftShift26_max = fastLn_leftShift26(4294967295) + 1;

  // numberToBase64.js
  var int32ArrayToBase64String = (a) => {
    const buffer = new ArrayBuffer(a.length * 4);
    const view = new DataView(buffer);
    a.forEach((x, n) => view.setInt32(n * 4, x));
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };
  var base64StringToInt32Array = (s) => {
    const buffer = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
    const view = new DataView(buffer);
    return Array.from({ length: view.byteLength / 4 }, (_x, n) => view.getInt32(n * 4));
  };

  // MersenneTwister.js
  var N = 624;
  var M = 397;
  var UPPER_MASK = 2147483648;
  var LOWER_MASK = 2147483647;
  var MATRIX_A = 2567483615;
  var MersenneTwister = class _MersenneTwister {
    constructor(seed) {
      if (typeof seed === "undefined") {
        seed = (/* @__PURE__ */ new Date()).getTime();
      }
      this.mt = new Array(N);
      this.mti = N + 1;
      this.seed(seed);
    }
    /**
     * Initializes the state vector by using one unsigned 32-bit integer "seed", which may be zero.
     */
    seed(seed) {
      let s;
      this.mt[0] = seed >>> 0;
      for (this.mti = 1; this.mti < N; this.mti++) {
        s = this.mt[this.mti - 1] ^ this.mt[this.mti - 1] >>> 30;
        this.mt[this.mti] = (((s & 4294901760) >>> 16) * 1812433253 << 16) + (s & 65535) * 1812433253 + this.mti;
        this.mt[this.mti] >>>= 0;
      }
    }
    /** Serialize state
    */
    toString() {
      return int32ArrayToBase64String([this.mti].concat(this.mt));
    }
    /** Deserialize state
    */
    initFromString(s) {
      const a = base64StringToInt32Array(s);
      this.mti = a[0];
      this.mt = a.slice(1);
    }
    static newFromString(s) {
      let rng = new _MersenneTwister();
      rng.initFromString(s);
      return rng;
    }
    /**
     * Generates a random unsigned 32-bit integer.
     */
    int() {
      let y, kk, mag01 = new Array(0, MATRIX_A);
      if (this.mti >= N) {
        if (this.mti === N + 1) {
          this.seed(5489);
        }
        for (kk = 0; kk < N - M; kk++) {
          y = this.mt[kk] & UPPER_MASK | this.mt[kk + 1] & LOWER_MASK;
          this.mt[kk] = this.mt[kk + M] ^ y >>> 1 ^ mag01[y & 1];
        }
        for (; kk < N - 1; kk++) {
          y = this.mt[kk] & UPPER_MASK | this.mt[kk + 1] & LOWER_MASK;
          this.mt[kk] = this.mt[kk + (M - N)] ^ y >>> 1 ^ mag01[y & 1];
        }
        y = this.mt[N - 1] & UPPER_MASK | this.mt[0] & LOWER_MASK;
        this.mt[N - 1] = this.mt[M - 1] ^ y >>> 1 ^ mag01[y & 1];
        this.mti = 0;
      }
      y = this.mt[this.mti++];
      y ^= y >>> 11;
      y ^= y << 7 & 2636928640;
      y ^= y << 15 & 4022730752;
      y ^= y >>> 18;
      return y >>> 0;
    }
  };

  // canonical-json.js
  var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
  var gap;
  var indent;
  var meta = {
    // table of character substitutions
    "\b": "\\b",
    "	": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
    '"': '\\"',
    "\\": "\\\\"
  };
  var rep;
  function quote(string) {
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function(a) {
      var c = meta[a];
      return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
  }
  function str(key, holder) {
    var i, k, v, length, mind = gap, partial, value = holder[key];
    if (value && typeof value === "object" && typeof value.toJSON === "function") {
      value = value.toJSON(key);
    }
    if (typeof rep === "function") {
      value = rep.call(holder, key, value);
    }
    switch (typeof value) {
      case "string":
        return quote(value);
      case "number":
        return isFinite(value) ? String(value) : "null";
      case "boolean":
      case "null":
        return String(value);
      case "object":
        if (!value) {
          return "null";
        }
        gap += indent;
        partial = [];
        if (Object.prototype.toString.apply(value) === "[object Array]") {
          length = value.length;
          for (i = 0; i < length; i += 1) {
            partial[i] = str(i, value) || "null";
          }
          v = partial.length === 0 ? "[]" : gap ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" : "[" + partial.join(",") + "]";
          gap = mind;
          return v;
        }
        if (rep && typeof rep === "object") {
          length = rep.length;
          for (i = 0; i < length; i += 1) {
            if (typeof rep[i] === "string") {
              k = rep[i];
              v = str(k, value);
              if (v) {
                partial.push(quote(k) + (gap ? ": " : ":") + v);
              }
            }
          }
        } else {
          var keysSorted = Object.keys(value).sort();
          for (i in keysSorted) {
            k = keysSorted[i];
            if (Object.prototype.hasOwnProperty.call(value, k)) {
              v = str(k, value);
              if (v) {
                partial.push(quote(k) + (gap ? ": " : ":") + v);
              }
            }
          }
        }
        v = partial.length === 0 ? "{}" : gap ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" : "{" + partial.join(",") + "}";
        gap = mind;
        return v;
    }
  }
  var stringify = function(value, replacer, space) {
    var i;
    gap = "";
    indent = "";
    if (typeof space === "number") {
      for (i = 0; i < space; i += 1) {
        indent += " ";
      }
    } else if (typeof space === "string") {
      indent = space;
    }
    rep = replacer;
    if (replacer && typeof replacer !== "function" && (typeof replacer !== "object" || typeof replacer.length !== "number")) {
      throw new Error("JSON.stringify");
    }
    return str("", { "": value });
  };

  // board.js
  var defaultBoardSize = 64;
  var defaultRngSeed = 5489;
  var xy2index = (x, y, size) => (y % size + size) % size * size + (x % size + size) % size;
  var RangeCounter = class {
    constructor(n, full) {
      this.n = n;
      this.log2n = Math.log(n) / Math.log(2);
      if (this.log2n % 1 !== 0)
        throw new Error("Length is not a power of 2: " + n);
      this.levelCount = new Array(this.log2n + 1).fill(0).map((_, level) => new Array(1 << this.log2n - level).fill(full ? 1 << level : 0));
    }
    add(val) {
      for (let level = this.log2n; level >= 0; --level)
        ++this.levelCount[level][val >> level];
    }
    remove(val) {
      for (let level = this.log2n; level >= 0; --level)
        --this.levelCount[level][val >> level];
    }
    total() {
      return this.levelCount[this.log2n][0];
    }
    // k is 0-based
    kthElement(k) {
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
      return Array.from({ length: this.total() }, (_, k) => this.kthElement(k));
    }
  };
  var randomInt = (rng, max) => Number(BigInt(max) * BigInt(rng.int()) >> BigInt(32));
  var randomBigInt = (rng, max) => {
    let tmp = max, lg = 32, r = BigInt(rng.int());
    while (tmp = tmp >> BigInt(32)) {
      lg += 32;
      r = r << BigInt(32) | BigInt(rng.int());
    }
    return max * r >> BigInt(lg);
  };
  var knuthShuffle = (rng, list) => {
    const len = list.length;
    for (let k = 0; k < len - 1; ++k) {
      const i = k + randomInt(rng, len - k);
      [list[i], list[k]] = [list[k], list[i]];
    }
    return list;
  };
  var bigSum = (...args) => args.reduce((s, w) => s + w);
  var bigMin = (...args) => args.reduce((m, e) => e < m ? e : m);
  var Board = class _Board {
    constructor(opts) {
      this.maxStateLen = 64;
      this.initFromJSON(opts || {});
    }
    initGrammar(grammar) {
      this.grammarSource = grammar;
      this.grammar = compileTypes(parseOrUndefined(grammar, { error: false }) || []);
      this.cell = new Array(this.size * this.size).fill(0).map((_) => ({ type: 0, state: "" }));
      this.byType = new Array(this.grammar.types.length).fill(0).map((_, n) => new RangeCounter(this.size * this.size, n === 0));
      this.byID = {};
    }
    updateGrammar(grammar) {
      this.initFromJSON({ ...this.toJSON(), grammar });
    }
    timeInSeconds() {
      return Number(this.time) / 2 ** 32;
    }
    index2xy(index) {
      return [index % this.size, Math.floor(index / this.size)];
    }
    xy2index(x, y) {
      return xy2index(x, y, this.size);
    }
    getCell(x, y) {
      return this.cell[this.xy2index(x, y)];
    }
    setCell(x, y, newValue) {
      if (newValue.state?.length > this.maxStateLen)
        newValue.state = newValue.state.substr(0, this.maxStateLen);
      this.setCellByIndex(this.xy2index(x, y), newValue);
    }
    setCellByIndex(index, newValue) {
      const oldValue = this.cell[index];
      if (newValue.type !== oldValue.type) {
        let oldByType = this.byType[oldValue.type];
        let newByType = this.byType[newValue.type];
        oldByType.remove(index);
        newByType.add(index);
      }
      if (oldValue.meta && oldValue.meta.id && this.byID[oldValue.meta.id] === index && (!newValue.meta || newValue.meta.id !== oldValue.meta.id))
        delete this.byID[oldValue.meta.id];
      if (newValue.meta && newValue.meta.id && (!oldValue.meta || newValue.meta.id !== oldValue.meta.id)) {
        if (newValue.meta.id in this.byID) {
          const prevIndexForNewID = this.byID[newValue.meta.id];
          let prevCellForNewID = this.cell[prevIndexForNewID];
          if (prevCellForNewID.meta) {
            if (prevCellForNewID.meta.id === newValue.meta.id)
              delete prevCellForNewID.meta.id;
            else
              console.error("ID mismatch: cell (" + this.index2xy(prevIndexForNewID) + ") type " + this.grammar.type[prevCellForNewID.type] + " has ID " + prevCellForNewID.meta.id + ", expected " + newValue.meta.id);
          }
        }
        this.byID[newValue.meta.id] = index;
      }
      this.cell[index] = newValue;
    }
    setCellTypeByName(x, y, type, state, meta2) {
      let typeIdx = this.grammar.typeIndex[type];
      if (typeof typeIdx === "undefined") {
        meta2 = { ...meta2 || {}, type };
        typeIdx = this.grammar.unknownType;
      }
      state = state || "";
      this.setCell(x, y, { type: typeIdx, state, meta: meta2 });
    }
    getCellDescriptorString(x, y) {
      const cell = this.getCell(x, y);
      const type = this.grammar.types[cell.type];
      return type + (cell.state ? `/${cell.state}` : "") + (cell.meta && Object.keys(cell.meta).length ? ` ${JSON.stringify(cell.meta)}` : "");
    }
    getCellDescriptorStringWithCoords(x, y) {
      return `(${x},${y}) ` + this.getCellDescriptorString(x, y);
    }
    totalTypeRates() {
      return this.byType.map((counter, type) => BigInt(counter.total()) * this.grammar.rateByType[type]);
    }
    getUniqueID(prefix) {
      const idPrefix = prefix || "cell";
      let id;
      for (id = 1; idPrefix + id in this.byID; ++id)
        ;
      return idPrefix + id;
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
    nextRule(maxWait) {
      const typeRates = this.totalTypeRates();
      const totalRate = bigSum(...typeRates);
      if (totalRate == 0)
        return null;
      const r1 = this.rng.int();
      const wait = BigInt(64 * (fastLn_leftShift26_max - fastLn_leftShift26(r1))) / BigInt(totalRate) || BigInt(1);
      if (wait > maxWait)
        return null;
      const r2 = randomBigInt(this.rng, totalRate);
      let r = r2, type = 0, w;
      while (r >= 0) {
        w = typeRates[type];
        r -= w;
        ++type;
      }
      --type;
      r += w;
      const t2 = this.grammar.rateByType[type];
      const n = r / t2;
      const r2modt = r;
      r = r - n * t2;
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
      if ((r3 & 1073741823) > rule.acceptProb_leftShift30)
        return null;
      const dir = dirs[r3 >>> 30];
      const [x, y] = this.index2xy(this.byType[type].kthElement(Number(n)));
      return { wait, x, y, rule, dir };
    }
    processMove(move) {
      if (move.type === "command") {
        const { time, user, id, dir, command, key } = move;
        const index = this.byID[id];
        if (typeof index !== "undefined") {
          const [x, y] = this.index2xy(index);
          const cell = this.cell[index];
          if (typeof cell.owner === "undefined" || user === cell.owner || user === _Board.owner) {
            const rules = command ? this.grammar.command[cell.type][command] : this.grammar.key[cell.type][key];
            rules.reduce((success, rule) => success || applyTransformRule(this, x, y, dir, rule), false);
          }
        }
      } else if (move.type === "write") {
        const { time, user, cells } = move;
        cells.forEach((write) => {
          let { x, y, id, oldType, oldState, type, state, meta: meta2 } = write;
          const index = id ? this.byID[id] : typeof x !== "undefined" && typeof y !== "undefined" ? this.xy2index(x, y) : void 0;
          if (typeof index !== "undefined") {
            const cell = this.cell[index];
            if (typeof cell.owner === "undefined" || user === cell.owner || user === _Board.owner) {
              if (typeof meta2?.owner === "undefined" || user === meta2.owner) {
                if (typeof oldType === "undefined" || this.grammar.types[cell.type] === oldType) {
                  if (typeof (oldState === "undefined" || cell.state === oldState))
                    this.setCellTypeByName(x, y, type, state, meta2);
                }
              }
            }
          }
        });
      } else if (move.type === "grammar") {
        const { user, grammar } = move;
        if (user === _Board.owner)
          this.updateGrammar(grammar);
      } else
        console.error("Unknown move type");
    }
    randomDir() {
      return dirs[this.rng.int() % 4];
    }
    // if hardStop is true, then there is a concrete event at time t, and we will advance the clock to that point even if nothing happens in the final interval
    // if hardStop is false, we stop the clock (and the random number generator) at the last event *before* t, so that we can resume consistently if more events (e.g. moves) arrive after t but before the next event
    evolveAsyncToTime(t2, hardStop) {
      while (this.time < t2) {
        const mt = this.rng.mt;
        const r = this.nextRule(t2 - this.lastEventTime);
        if (!r) {
          this.time = t2;
          if (hardStop)
            this.lastEventTime = t2;
          else
            this.rng.mt = mt;
          break;
        }
        const { wait, x, y, rule, dir } = r;
        applyTransformRule(this, x, y, dir, rule);
        this.time = this.lastEventTime = this.lastEventTime + wait;
      }
    }
    evolveToTime(t2, hardStop) {
      const million = 1e6;
      while (this.time < t2) {
        const nextSyncTimes = this.grammar.syncPeriods.map((p) => p + this.time - this.time % p);
        const nextTime = bigMin(t2, ...nextSyncTimes);
        const nextSyncCategories = this.grammar.syncCategories.filter((n) => nextSyncTimes[n] === nextTime);
        const nextTimeIsSyncEvent = nextSyncCategories.length > 0;
        this.evolveAsyncToTime(nextTime, hardStop || nextTimeIsSyncEvent);
        if (nextTimeIsSyncEvent)
          knuthShuffle(this.rng, nextSyncCategories.reduce((l, nSync) => l.concat(this.grammar.typesBySyncCategory[nSync].reduce((l2, nType) => {
            const rules = this.grammar.syncTransform[nSync][nType];
            return l2.concat(this.byType[nType].elements().reduce((l3, index) => {
              const xy = this.index2xy(index);
              return l3.concat(rules.map((rule) => [xy, rule]));
            }, []));
          }, [])), [])).forEach((xy_rule) => applyTransformRule(this, xy_rule[0][0], xy_rule[0][1], this.randomDir(), xy_rule[1]));
      }
    }
    // evolve board, processing sync rules and moves
    // There is probably no reason to call this with hardStop==true, unless imposing another time limit that is well-defined within the game
    evolveAndProcess(t2, moves, hardStop) {
      moves.filter((msg) => msg.time > t2).toSorted((a, b) => a.time > b.time ? 1 : a.time < b.time ? -1 : 0).forEach((move) => {
        this.evolveToTime(move.time, true);
        this.processMove(move);
      });
      this.evolveToTime(t2, hardStop);
    }
    typesIncludingUnknowns() {
      const unknownTypes = this.byType[this.grammar.unknownType].elements().reduce((types2, index) => types2.add(this.cell[index].meta?.type), /* @__PURE__ */ new Set());
      const types = this.grammar.types.concat(Array.from(unknownTypes).filter((type) => typeof type !== "undefined"));
      const type2idx = types.reduce((map, type, idx) => {
        map[type] = idx;
        return map;
      }, {});
      return { types, type2idx };
    }
    typeCountsIncludingUnknowns() {
      let count = {};
      this.typesIncludingUnknowns().types.forEach((type) => count[type] = 0);
      this.cell.forEach((cell) => {
        const type = cell.type === this.grammar.unknownType ? cell.meta?.type : this.grammar.types[cell.type];
        if (type)
          count[type] = (count[type] || 0) + 1;
      });
      return count;
    }
    cellToJSON(cell, type2idx) {
      let meta2 = { ...cell.meta || {} }, typeIdx = cell.type;
      if (typeIdx === this.grammar.unknownType && meta2.type) {
        typeIdx = type2idx[meta2.type];
        delete meta2.type;
      }
      if (Object.keys(meta2).length === 0)
        meta2 = void 0;
      return cell.state || meta2 ? [typeIdx, cell.state || ""].concat(meta2 ? [meta2] : []) : typeIdx;
    }
    toJSON() {
      const { types, type2idx } = this.typesIncludingUnknowns();
      return {
        time: this.time.toString(),
        lastEventTime: this.lastEventTime.toString(),
        rng: this.rng.toString(),
        owner: this.owner,
        grammar: this.grammarSource,
        types,
        size: this.size,
        cell: this.cell.map((cell) => this.cellToJSON(cell, type2idx))
      };
    }
    toString() {
      return stringify(this.toJSON());
    }
    initFromString(str2) {
      this.initFromJSON(JSON.parse(str2));
    }
    initFromJSON(json) {
      this.owner = json.owner;
      this.size = json.size || defaultBoardSize;
      this.time = BigInt(json.time || 0);
      this.lastEventTime = BigInt(json.lastEventTime || json.time || 0);
      this.rng = json.rng ? MersenneTwister.newFromString(json.rng) : new MersenneTwister(json.seed || defaultRngSeed);
      this.initGrammar(json.grammar || "");
      if (json.cell) {
        if (json.cell.length !== this.cell.length)
          throw new Error("Tried to load " + json.cell.length + "-cell board file into " + this.cell.length + "-cell board");
        json.cell.forEach((type_state_meta, index) => {
          if (typeof type_state_meta === "number")
            type_state_meta = [type_state_meta];
          let [type, state, meta2] = type_state_meta;
          type = json.types[type];
          let typeIdx = this.grammar.typeIndex[type];
          if (typeof typeIdx === "undefined") {
            meta2 = { ...meta2 || {}, type };
            typeIdx = this.grammar.unknownType;
          }
          this.setCellByIndex(index, {
            type: typeIdx,
            state: state || "",
            ...meta2 ? { meta: meta2 } : {}
          });
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
  };
})();
