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
    let rules = parseOrUndefined (grammarText, { error: consoleErrorFunc, suppressLocation: opts.suppressLocation });
    if (opts.error) {
        expect(rules).to.be.undefined;
        if (typeof(opts.error)==='string')
            expect(consoleErrorText).to.equal(opts.error);
        else if (typeof(opts.error)==='object')
            expect(consoleErrorText).to.match(opts.error);
    } else {
        expect(rules).to.not.be.undefined;
        let expectedSerialization = opts.expect || grammarText;
        if (opts.compile)
            rules = compiledGrammarIndexToRuleList (compileTypes (rules));
        else if (opts.inherit)
            rules = grammarIndexToRuleList (expandInherits (makeGrammarIndex (rules)));
        if (typeof(expectedSerialization) === 'string') {
            if (!opts.literal)
                expectedSerialization = expectedSerialization.replace(/\.\s*([^0-9])/g, (_m,g)=>'.\n'+g).replace(/\.$/,'.\n');
            expect(serialize(rules)).to.equal(expectedSerialization);
        } else
            expect(serialize(rules)).to.match(expectedSerialization);
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

    it ('Rates', (done) => {
        testParse ('a b : c d, rate=1.');
        testParse ('a b : c d, rate=23.');
        testParse ('a b : c d, rate=456.');
        testParse ('a b : c d, rate=.7.', {expect:'a b : c d, rate=0.7.'});
        testParse ('a b : c d, rate=0.89.');
        testParse ('a b : c d, rate=0.012345.');
        testParse ('a b : c d, rate=123.456789.');
        testParse ('a b : c d, rate={123.456789}.',{expect:'a b : c d, rate=123.456789.'});
        testParse ('a b : c d, rate=.0123456', {error:true});
        testParse ('a b : c d, rate=1001', {error:true});
        testParse ('a b : c d, rate=1 rate=2', {error:/Duplicate attribute: "rate"/});
        testParse ('a b : c d, sync=123.');
        done();
    })

    it ('Multi-rule parsing', (done) => {
        testParse ('a b : c d. e : f.');
        done();
    })

    it ('Inheritance', (done) => {
        testParse ('a b : c d. e = a.');
        testParse ('a b : c d. e f : g. h = a, f.', {inherit:true,expect:'a b : c d. e (f|h) : g. h b : c d.'});
        testParse ('a b : c d. e = a.', {inherit:true,expect:'a b : c d. e b : c d.'});
        testParse ('a = b. b = a.', {error:"Type 'a' inherits from itself",suppressLocation:true});
        done();
    })
})