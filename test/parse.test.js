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

    it ('State patterns', (done) => {
        // Simple state
        testParse ('a/x : b.');
        testParse ('a/xy : b.');
        testParse ('a/x b/y : c d.');
        // Wildcard characters
        testParse ('a/? : b.');
        testParse ('a/?? : b.');
        testParse ('a/* : b.');
        // Character classes
        testParse ('a/[abc] : b.');
        testParse ('a/[^abc] : b.');
        // State on both sides
        testParse ('a/x : b/y.');
        done();
    })

    it ('State expressions', (done) => {
        // Vector literal
        testParse ('a/@vec(1,2) : b.');
        testParse ('a/@vec(0,0) : b.');
        testParse ('a/@vec(4,4) : b.');
        testParse ('a/@vec(-3,4) : b.');
        // Integer literal
        testParse ('a/@int(3) : b.');
        testParse ('a/@int(0) : b.');
        // Addition and subtraction ($#1 normalizes to $1#1 during parsing)
        testParse ('a/? : b/@add(@int(1),$#1).', {expect:'a/? : b/@add(@int(1),$1#1).'});
        testParse ('a/? : b/@sub($#1,@int(1)).', {expect:'a/? : b/@sub($1#1,@int(1)).'});
        // Clock and anti rotation
        testParse ('a/? : b/@clock($#1).', {expect:'a/? : b/@clock($1#1).'});
        testParse ('a/? : b/@anti($#1).', {expect:'a/? : b/@anti($1#1).'});
        // State references with $group/state prefix
        testParse ('a/? b/? : $1 $2/@sub($2#1,$1#1).');
        // Matrix transforms require parentheses and a vector operand
        // PEG grammar uses D,B,L,R,H,V for matrices (not F; F is a direction)
        // Serializer always includes explicit * between matrix and operand
        testParse ('a/? : b/(%R@N).', {expect:'a/? : b/(%R*@N).'});
        testParse ('a/? : b/(%B@N).', {expect:'a/? : b/(%B*@N).'});
        testParse ('a/? : b/(%L@N).', {expect:'a/? : b/(%L*@N).'});
        testParse ('a/? : b/(%H@N).', {expect:'a/? : b/(%H*@N).'});
        testParse ('a/? : b/(%V@N).', {expect:'a/? : b/(%V*@N).'});
        // Absolute and relative direction
        testParse ('a : b/@N.');
        testParse ('a : b/@E.');
        testParse ('a : b/@F.');
        testParse ('a : b/@R.');
        done();
    })

    it ('Addresses', (done) => {
        // Absolute direction addresses
        testParse ('a >N> b : c.');
        testParse ('a >E> b : c.');
        testParse ('a >S> b : c.');
        testParse ('a >W> b : c.');
        // Relative direction addresses
        testParse ('a >F> b : c.');
        testParse ('a >R> b : c.');
        testParse ('a >B> b : c.');
        testParse ('a >L> b : c.');
        // Neighbor address by state char (>1> expands to >+$1#1> in serialization)
        testParse ('a/? >1> b : c.', {expect:'a/? >+$1#1> b : c.'});
        // Multi-hop addresses
        testParse ('a/? >1> b/?? >2> c : d.', {expect:'a/? >+$1#1> b/?? >+$2#2> c : d.'});
        done();
    })

    it ('Alternatives and negation', (done) => {
        // Simple alternative
        testParse ('a (b|c) : d.');
        // Triple alternative
        testParse ('a (b|c|d) : e.');
        // Alternative with state
        testParse ('a (b/x|c/y) : d.');
        // Negation
        testParse ('a ^b : c.');
        // Negated alternative
        testParse ('a ^(b|c) : d.');
        done();
    })

    it ('RHS terms', (done) => {
        // Group reference
        testParse ('a b : $1 $2.');
        // Swap
        testParse ('a b : $2 $1.');
        // Group with prefix (new state)
        testParse ('a/? b : $1/x $2.');
        // ID tags
        testParse ('a b : a~1 b.');
        testParse ('a b c : $2~1 $1 $3.', {expect:'a b c : $2~1 $1 $3.'});
        // Wildcard LHS term
        testParse ('a * : $2 $1.');
        // Empty cell
        testParse ('a _ : _ a.');
        done();
    })

    it ('Commands and keys', (done) => {
        testParse ('a : b, command={left}.');
        testParse ('a : b, command={right}.');
        testParse ('a : b, key={x}.');
        testParse ('a : b, key={z}.');
        // Combined attributes
        testParse ('a : b, rate=2 command={left}.');
        testParse ('a b : $2 $1, key={x}.');
        done();
    })

    it ('Score attribute', (done) => {
        testParse ('a : b, score=1.');
        testParse ('a : b, score=10.');
        testParse ('a : b, score=-5.');
        testParse ('a : b, rate=2 score=3.');
        done();
    })

    it ('Sound and caption attributes', (done) => {
        testParse ('a : b, sound={pop}.');
        testParse ('a : b, caption={hello world}.');
        testParse ('a : b, rate=1 sound={zap} caption={fire!}.');
        done();
    })

    it ('Sync rules', (done) => {
        testParse ('a : b, sync=1.');
        testParse ('a : b, sync=3.1.');
        testParse ('a b : $2 $1, sync=10.');
        // sync and rate are mutually exclusive
        testParse ('a : b, sync=1 rate=2', {error:true});
        done();
    })

    it ('Comments', (done) => {
        testParse ('// A comment\na b : c d.', {expect:'// A comment\na b : c d.\n', literal:true});
        testParse ('a b : c d.\n// Another comment', {expect:'a b : c d.\n// Another comment\n', literal:true});
        done();
    })

    it ('Serialization round-trips', (done) => {
        // Parse, serialize, re-parse, re-serialize should be stable
        const grammars = [
            'a b : $2 $1.',
            'a >N> b : c.',
            'a (b|c) : d.',
            'a ^b : c.',
            'a b : $2 $1, rate=2 command={left}.',
            'a = b. b c : d.',
            'a b c : $2~1 $1 $3.',
            'a/? : b/@add(@int(1),$#1).',
            'a _ : _ a, rate=5.',
            'a/? b : $1/x $2.',
            'a : b, score=-3.',
            'a : b, caption={hello}.',
        ];
        grammars.forEach ((g) => {
            const rules1 = parseOrUndefined(g, {error:false});
            expect(rules1, `Failed to parse: ${g}`).to.not.be.undefined;
            const s1 = serialize(rules1);
            const rules2 = parseOrUndefined(s1, {error:false});
            expect(rules2, `Failed to re-parse serialized: ${s1}`).to.not.be.undefined;
            const s2 = serialize(rules2);
            expect(s2).to.equal(s1);
        });
        done();
    })

    it ('Complex grammars from files', (done) => {
        // These should all parse without error
        const grammars = [
            'bee _ : $2 $1.',
            'bee:_.\nsandpile: $1/0.\nsandpile/[0123]: $1/@add(@int(1),$#1), rate=0.1.',
            'bee _ : $2 $1, rate=999.\nrock = bee.\nscissors = bee.\npaper = bee.',
            'x _ : _ x, sync=1.',
            'player crate >L> * : $3 player crate, command={z}.',
        ];
        grammars.forEach ((g) => {
            const rules = parseOrUndefined(g, {error:false});
            expect(rules, `Failed to parse: ${g}`).to.not.be.undefined;
        });
        done();
    })

    it ('Error cases', (done) => {
        // Incomplete rules
        testParse ('a :', {error:true});
        testParse (': b', {error:true});
        // Invalid rate values
        testParse ('a : b, rate=1001', {error:true});
        testParse ('a : b, rate=.0123456', {error:true});
        // Duplicate attributes
        testParse ('a : b, rate=1 rate=2', {error:/Duplicate attribute/});
        testParse ('a : b, command={x} command={y}', {error:/Duplicate attribute/});
        // Self-inheritance
        testParse ('a = a.', {error:/inherits from itself/,suppressLocation:true});
        // Circular inheritance
        testParse ('a = b. b = a.', {error:/inherits from itself/,suppressLocation:true});
        done();
    })
})