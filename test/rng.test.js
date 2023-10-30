import { expect } from 'chai';
import { describe } from 'mocha';

import { MersenneTwister } from '../src/MersenneTwister.js';

describe ('Testing the random number generator', () => {
    it ('Seed', (done) => {
        const rng = new MersenneTwister(5489);
        expect(rng.int()).to.equal(3499211612);
        done();
    });
    it ('Save and restore state', (done) => {
        const rng = new MersenneTwister();
        const s1 = rng.toString();
        const r1 = rng.int();
        const s2 = rng.toString();
        const r2 = rng.int();
        rng.initFromString(s1);
        expect(rng.int()).to.equal(r1);
        expect(rng.int()).to.equal(r2);
        rng.initFromString(s2);
        expect(rng.int()).to.equal(r2);
        done();
    });
})