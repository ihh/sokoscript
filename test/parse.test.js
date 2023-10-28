import { expect } from 'chai';
import { describe } from 'mocha';

import { makeGrammarIndex, expandInherits, compileTypes, parseOrUndefined, grammarIndexToRuleList, compiledGrammarIndexToRuleList } from '../src/gramutil.js';
import { serialize } from '../src/serialize.js';
import { stringify } from '../src/canonical-json.js';

const testParse = (grammarText, expectedSerialization) => {
    let rules = parseOrUndefined (grammarText, false);
    if (expectedSerialization===false)
        expect(rules).to.be.undefined;
    else
        expect(serialize(rules)).to.equal(expectedSerialization || grammarText);
}

const testInherit = (grammarText, expectedSerialization) => {
    let rules = parseOrUndefined (grammarText, false);
    if (expectedSerialization===false)
        expect(rules).to.be.undefined;
    else {
        rules = grammarIndexToRuleList (expandInherits (makeGrammarIndex (rules)));
        expect(serialize(rules)).to.equal(expectedSerialization || grammarText);
    }
}

const testCompile = (grammarText, expectedSerialization) => {
    let rules = parseOrUndefined (grammarText, false);
    if (expectedSerialization===false)
        expect(rules).to.be.undefined;
    else {
        rules = compiledGrammarIndexToRuleList (compileTypes (rules));
        expect(serialize(rules)).to.equal(expectedSerialization || grammarText);
    }
}

describe ('Testing the parser', () => {
    it ('Basic rule parsing', (done) => {
        testParse ('a b : c d.\n');
        testParse ('a b : c d.', 'a b : c d.\n');
        testParse ('a b:c d.', 'a b : c d.\n');
        testParse ('a b : c d', 'a b : c d.\n');
        testParse ('a b :', false);
        done();
    })

    it ('Multi-rule parsing', (done) => {
        testParse ('a b : c d.\ne : f.\n');
        testParse ('a b : c d. e : f.', 'a b : c d.\ne : f.\n');
        done();
    })

    it ('Inheritance', (done) => {
        testInherit ('a b : c d. e = a.', 'a b : c d.\ne b : c d.\n');
        testParse ('a = b. b = a.', false);
        done();
    })
})