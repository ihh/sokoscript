import { expect } from 'chai';
import { describe } from 'mocha';

import { makeGrammarIndex, expandInherits, compileTypes, parseOrUndefined, grammarIndexToRuleList, compiledGrammarIndexToRuleList } from '../src/gramutil.js';
import { serialize } from '../src/serialize.js';
import { stringify } from '../src/canonical-json.js';

const testParse = (grammarText, opts) => {
    opts = opts || {};
    let consoleErrorFunc = false, consoleErrorText = '';
    if (opts.error)
        consoleErrorFunc = function() { consoleErrorText += Array.from(arguments).map((arg)=>arg.toString()).join('') }
    let rules = parseOrUndefined (grammarText, { error: consoleErrorFunc, suppressLocation: true });
    if (opts.error) {
        console.error = consoleErrorFunc;
        expect(rules).to.be.undefined;
        if (typeof(opts.error)==='string')
            expect(consoleErrorText).to.equal(opts.error);
    } else {
        expect(rules).to.not.be.undefined;
        let expectedSerialization = opts.expect || grammarText;
        if (!opts.literal)
            expectedSerialization = expectedSerialization.replace(/\.\s*/g, '.\n');
        if (opts.compile)
            rules = compiledGrammarIndexToRuleList (compileTypes (rules));
        else if (opts.inherit)
            rules = grammarIndexToRuleList (expandInherits (makeGrammarIndex (rules)));
        expect(serialize(rules)).to.equal(expectedSerialization);
    }
}

describe ('Testing the parser', () => {
    it ('Basic rule parsing', (done) => {
        testParse ('a b : c d.\n',{literal:true});
        testParse ('a b : c d.', {expect:'a b : c d.\n',literal:true});
        testParse ('a b:c d.', {expect:'a b : c d.'});
        testParse ('a b : c d', {expect:'a b : c d.'});
        testParse ('a b :', {error:true});
        done();
    })

    it ('Multi-rule parsing', (done) => {
        testParse ('a b : c d. e : f.');
        done();
    })

    it ('Inheritance', (done) => {
        testParse ('a b : c d. e = a.', {inherit:true,expect:'a b : c d. e b : c d.'});
        testParse ('a = b. b = a.', {error:"Type 'a' inherits from itself"});
        done();
    })
})