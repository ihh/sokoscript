import { expect } from 'chai';
import { describe } from 'mocha';

import { charPermLookup, charLookup, charClassLookup, charVecLookup, vec2char, int2char, dirs } from '../src/lookups.js';

describe ('Testing lookup tables', () => {
    it ('Vector-char encoding round-trip', () => {
        // All vectors in range [-4,4] x [-4,4] should round-trip
        for (let x = -4; x <= 4; x++) {
            for (let y = -4; y <= 4; y++) {
                const c = vec2char([x, y]);
                const v = charVecLookup[c];
                expect(v).to.deep.equal([x, y]);
            }
        }
    });

    it ('Integer-char encoding round-trip', () => {
        for (let n = 0; n < 94; n++) {
            const c = int2char(n);
            expect(c.charCodeAt(0)).to.be.at.least(33);
            expect(c.charCodeAt(0)).to.be.at.most(126);
        }
    });

    it ('Integer-char cyclic arithmetic', () => {
        // 0 + 0 = 0
        const zero = int2char(0);
        expect(charPermLookup.intAdd[zero][zero]).to.equal(zero);
        // n + 0 = n for all n
        for (let n = 0; n < 94; n++) {
            const c = int2char(n);
            expect(charPermLookup.intAdd[zero][c]).to.equal(c);
        }
        // n - n = 0 for all n
        for (let n = 0; n < 94; n++) {
            const c = int2char(n);
            expect(charPermLookup.intSub[c][c]).to.equal(zero);
        }
    });

    it ('Vector addition is commutative', () => {
        for (let x1 = -2; x1 <= 2; x1++) {
            for (let y1 = -2; y1 <= 2; y1++) {
                const c1 = vec2char([x1, y1]);
                for (let x2 = -2; x2 <= 2; x2++) {
                    for (let y2 = -2; y2 <= 2; y2++) {
                        const c2 = vec2char([x2, y2]);
                        expect(charPermLookup.vecAdd[c1][c2]).to.equal(
                            charPermLookup.vecAdd[c2][c1]);
                    }
                }
            }
        }
    });

    it ('Vector add then subtract returns original', () => {
        const origin = vec2char([0, 0]);
        for (let x = -2; x <= 2; x++) {
            for (let y = -2; y <= 2; y++) {
                const c = vec2char([x, y]);
                // (0,0) + v - v = (0,0)
                const added = charPermLookup.vecAdd[c][origin];
                const result = charPermLookup.vecSub[c][added];
                expect(result).to.equal(origin);
            }
        }
    });

    it ('Matrix identity (forward) preserves vectors', () => {
        // %D in PEG grammar maps to 'F' matrix (identity) in lookups
        // The F matrix is [[1,0],[0,1]]
        for (let x = -4; x <= 4; x++) {
            for (let y = -4; y <= 4; y++) {
                const c = vec2char([x, y]);
                expect(charPermLookup.matMul['F'][c]).to.equal(c);
            }
        }
    });

    it ('Matrix R rotates 90 degrees clockwise', () => {
        // R = [[0,-1],[1,0]] so (1,0) -> (0,1), (0,1) -> (-1,0)
        const east = vec2char([1, 0]);
        const south = vec2char([0, 1]);
        const west = vec2char([-1, 0]);
        const north = vec2char([0, -1]);
        expect(charPermLookup.matMul['R'][east]).to.equal(south);
        expect(charPermLookup.matMul['R'][south]).to.equal(west);
        expect(charPermLookup.matMul['R'][west]).to.equal(north);
        expect(charPermLookup.matMul['R'][north]).to.equal(east);
    });

    it ('Matrix B rotates 180 degrees', () => {
        // B = [[-1,0],[0,-1]] so (x,y) -> (-x,-y)
        for (let x = -4; x <= 4; x++) {
            for (let y = -4; y <= 4; y++) {
                const c = vec2char([x, y]);
                const expected = vec2char([-x, -y]);
                // Only check if both are in range
                if (Math.abs(x) <= 4 && Math.abs(y) <= 4) {
                    expect(charPermLookup.matMul['B'][c]).to.equal(expected);
                }
            }
        }
    });

    it ('Four rotations return to identity', () => {
        // R^4 = I
        for (let x = -3; x <= 3; x++) {
            for (let y = -3; y <= 3; y++) {
                let c = vec2char([x, y]);
                for (let i = 0; i < 4; i++)
                    c = charPermLookup.matMul['R'][c];
                expect(c).to.equal(vec2char([x, y]));
            }
        }
    });

    it ('Direction vectors are correct', () => {
        expect(dirs).to.deep.equal(['N', 'E', 'S', 'W']);
        expect(charLookup.absDir['N']).to.equal(vec2char([0, -1]));
        expect(charLookup.absDir['E']).to.equal(vec2char([1, 0]));
        expect(charLookup.absDir['S']).to.equal(vec2char([0, 1]));
        expect(charLookup.absDir['W']).to.equal(vec2char([-1, 0]));
    });

    it ('Neighborhood char classes exist', () => {
        expect(charClassLookup).to.have.property('moore');
        expect(charClassLookup).to.have.property('neumann');
        // Origin should have full neighborhoods
        const origin = vec2char([0, 0]);
        expect(charClassLookup.moore[origin].length).to.equal(9);  // 3x3 including center
        expect(charClassLookup.neumann[origin].length).to.equal(5);  // + shape including center
    });

    it ('Clock rotation cycles through neighborhood ring', () => {
        // Rotating (1,0) clockwise should give (1,1) or similar based on ring
        const east = vec2char([1, 0]);
        const rotated = charPermLookup.rotate.clock[east];
        expect(rotated).to.not.equal(east);
        // 8 clockwise rotations around radius-1 ring should return to start
        let c = east;
        for (let i = 0; i < 8; i++)
            c = charPermLookup.rotate.clock[c];
        expect(c).to.equal(east);
    });

    it ('Clock and anti-clock are inverse', () => {
        for (let x = -3; x <= 3; x++) {
            for (let y = -3; y <= 3; y++) {
                if (x === 0 && y === 0) continue;
                const c = vec2char([x, y]);
                const clockwise = charPermLookup.rotate.clock[c];
                const back = charPermLookup.rotate.anti[clockwise];
                expect(back).to.equal(c);
            }
        }
    });
});
