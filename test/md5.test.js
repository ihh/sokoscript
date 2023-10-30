import { expect } from 'chai';
import { describe } from 'mocha';

import { hexMD5 } from '../src/md5.js';

describe ('Testing the hash function', () => {
    it ('MD5 hash', (done) => {
        expect(hexMD5('abcd')).to.equal('e2fc714c4727ee9395f324cd2e7f331f');
        done();
    });
})