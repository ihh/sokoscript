"""Tests for parser + serializer. Port of test/parse.test.js."""

import re
from sokoscript.parser import parse_or_undefined
from sokoscript.serialize import serialize
from sokoscript.compiler import (
    make_grammar_index, expand_inherits, compile_types,
    grammar_index_to_rule_list, compiled_grammar_index_to_rule_list,
)


def _test_parse(grammar_text, expect=None, error=None, literal=False,
                inherit=False, compile=False, suppress_location=False):
    error_text = []

    if error:
        error_func = lambda msg: error_text.append(str(msg))
        rules = parse_or_undefined(grammar_text, error=error_func, suppress_location=suppress_location)
        assert rules is None, f"Expected parse error for: {grammar_text}"
        if isinstance(error, str):
            assert error_text[0] == error if error_text else False
        elif hasattr(error, 'search'):
            assert any(error.search(t) for t in error_text), f"Error text {error_text} doesn't match {error.pattern}"
        return

    rules = parse_or_undefined(grammar_text, error=False)
    assert rules is not None, f"Failed to parse: {grammar_text}"

    expected = expect if expect is not None else grammar_text

    if compile:
        rules = compiled_grammar_index_to_rule_list(compile_types(rules))
    elif inherit:
        rules = grammar_index_to_rule_list(expand_inherits(make_grammar_index(rules)))

    if isinstance(expected, str):
        if not literal:
            expected = re.sub(r'\.\s*([^0-9])', lambda m: '.\n' + m.group(1), expected)
            if expected.endswith('.'):
                expected += '\n'
        assert serialize(rules) == expected, f"Serialization mismatch:\n  got:      {serialize(rules)!r}\n  expected: {expected!r}"
    else:
        assert expected.search(serialize(rules))


def test_basic_rule_parsing():
    _test_parse('a b : c d.\n', literal=True)
    _test_parse('a b : c d.', expect='a b : c d.\n', literal=True)
    _test_parse('a b:c d.', expect='a b : c d.')
    _test_parse('a b : c d', expect='a b : c d.')
    _test_parse('a b :', error=True)


def test_rates():
    _test_parse('a b : c d, rate=1.')
    _test_parse('a b : c d, rate=23.')
    _test_parse('a b : c d, rate=456.')
    _test_parse('a b : c d, rate=.7.', expect='a b : c d, rate=0.7.')
    _test_parse('a b : c d, rate=0.89.')
    _test_parse('a b : c d, rate=0.012345.')
    _test_parse('a b : c d, rate=123.456789.')
    _test_parse('a b : c d, rate={123.456789}.', expect='a b : c d, rate=123.456789.')
    _test_parse('a b : c d, rate=.0123456', error=True)
    _test_parse('a b : c d, rate=1001', error=True)
    _test_parse('a b : c d, rate=1 rate=2', error=re.compile(r'Duplicate attribute.*"rate"'))
    _test_parse('a b : c d, sync=123.')


def test_multi_rule_parsing():
    _test_parse('a b : c d. e : f.')


def test_inheritance():
    _test_parse('a b : c d. e = a.')
    _test_parse('a b : c d. e f : g. h = a, f.', inherit=True, expect='a b : c d. e (f|h) : g. h b : c d.')
    _test_parse('a b : c d. e = a.', inherit=True, expect='a b : c d. e b : c d.')
    _test_parse('a = b. b = a.', error="Type 'a' inherits from itself", suppress_location=True)


def test_state_patterns():
    _test_parse('a/x : b.')
    _test_parse('a/xy : b.')
    _test_parse('a/x b/y : c d.')
    _test_parse('a/? : b.')
    _test_parse('a/?? : b.')
    _test_parse('a/* : b.')
    _test_parse('a/[abc] : b.')
    _test_parse('a/[^abc] : b.')
    _test_parse('a/x : b/y.')


def test_state_expressions():
    _test_parse('a/@vec(1,2) : b.')
    _test_parse('a/@vec(0,0) : b.')
    _test_parse('a/@vec(4,4) : b.')
    _test_parse('a/@vec(-3,4) : b.')
    _test_parse('a/@int(3) : b.')
    _test_parse('a/@int(0) : b.')
    _test_parse('a/? : b/@add(@int(1),$#1).', expect='a/? : b/@add(@int(1),$1#1).')
    _test_parse('a/? : b/@sub($#1,@int(1)).', expect='a/? : b/@sub($1#1,@int(1)).')
    _test_parse('a/? : b/@clock($#1).', expect='a/? : b/@clock($1#1).')
    _test_parse('a/? : b/@anti($#1).', expect='a/? : b/@anti($1#1).')
    _test_parse('a/? b/? : $1 $2/@sub($2#1,$1#1).')
    _test_parse('a/? : b/(%R@N).', expect='a/? : b/(%R*@N).')
    _test_parse('a/? : b/(%B@N).', expect='a/? : b/(%B*@N).')
    _test_parse('a/? : b/(%L@N).', expect='a/? : b/(%L*@N).')
    _test_parse('a/? : b/(%H@N).', expect='a/? : b/(%H*@N).')
    _test_parse('a/? : b/(%V@N).', expect='a/? : b/(%V*@N).')
    _test_parse('a : b/@N.')
    _test_parse('a : b/@E.')
    _test_parse('a : b/@F.')
    _test_parse('a : b/@R.')


def test_addresses():
    _test_parse('a >N> b : c.')
    _test_parse('a >E> b : c.')
    _test_parse('a >S> b : c.')
    _test_parse('a >W> b : c.')
    _test_parse('a >F> b : c.')
    _test_parse('a >R> b : c.')
    _test_parse('a >B> b : c.')
    _test_parse('a >L> b : c.')
    _test_parse('a/? >1> b : c.', expect='a/? >+$1#1> b : c.')
    _test_parse('a/? >1> b/?? >2> c : d.', expect='a/? >+$1#1> b/?? >+$2#2> c : d.')


def test_alternatives_and_negation():
    _test_parse('a (b|c) : d.')
    _test_parse('a (b|c|d) : e.')
    _test_parse('a (b/x|c/y) : d.')
    _test_parse('a ^b : c.')
    _test_parse('a ^(b|c) : d.')


def test_rhs_terms():
    _test_parse('a b : $1 $2.')
    _test_parse('a b : $2 $1.')
    _test_parse('a/? b : $1/x $2.')
    _test_parse('a b : a~1 b.')
    _test_parse('a b c : $2~1 $1 $3.', expect='a b c : $2~1 $1 $3.')
    _test_parse('a * : $2 $1.')
    _test_parse('a _ : _ a.')


def test_commands_and_keys():
    _test_parse('a : b, command={left}.')
    _test_parse('a : b, command={right}.')
    _test_parse('a : b, key={x}.')
    _test_parse('a : b, key={z}.')
    _test_parse('a : b, rate=2 command={left}.')
    _test_parse('a b : $2 $1, key={x}.')


def test_score_attribute():
    _test_parse('a : b, score=1.')
    _test_parse('a : b, score=10.')
    _test_parse('a : b, score=-5.')
    _test_parse('a : b, rate=2 score=3.')


def test_sound_and_caption():
    _test_parse('a : b, sound={pop}.')
    _test_parse('a : b, caption={hello world}.')
    _test_parse('a : b, rate=1 sound={zap} caption={fire!}.')


def test_sync_rules():
    _test_parse('a : b, sync=1.')
    _test_parse('a : b, sync=3.1.')
    _test_parse('a b : $2 $1, sync=10.')
    _test_parse('a : b, sync=1 rate=2', error=True)


def test_comments():
    _test_parse('// A comment\na b : c d.', expect='// A comment\na b : c d.\n', literal=True)
    _test_parse('a b : c d.\n// Another comment', expect='a b : c d.\n// Another comment\n', literal=True)


def test_serialization_roundtrips():
    grammars = [
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
    ]
    for g in grammars:
        rules1 = parse_or_undefined(g, error=False)
        assert rules1 is not None, f"Failed to parse: {g}"
        s1 = serialize(rules1)
        rules2 = parse_or_undefined(s1, error=False)
        assert rules2 is not None, f"Failed to re-parse: {s1}"
        s2 = serialize(rules2)
        assert s2 == s1, f"Round-trip failed: {s1!r} != {s2!r}"


def test_complex_grammars():
    grammars = [
        'bee _ : $2 $1.',
        'bee:_.\nsandpile: $1/0.\nsandpile/[0123]: $1/@add(@int(1),$#1), rate=0.1.',
        'bee _ : $2 $1, rate=999.\nrock = bee.\nscissors = bee.\npaper = bee.',
        'x _ : _ x, sync=1.',
        'player crate >L> * : $3 player crate, command={z}.',
    ]
    for g in grammars:
        rules = parse_or_undefined(g, error=False)
        assert rules is not None, f"Failed to parse: {g}"


def test_error_cases():
    _test_parse('a :', error=True)
    _test_parse(': b', error=True)
    _test_parse('a : b, rate=1001', error=True)
    _test_parse('a : b, rate=.0123456', error=True)
    _test_parse('a : b, rate=1 rate=2', error=re.compile(r'Duplicate attribute'))
    _test_parse('a : b, command={x} command={y}', error=re.compile(r'Duplicate attribute'))
    _test_parse('a = a.', error=re.compile(r'inherits from itself'), suppress_location=True)
    _test_parse('a = b. b = a.', error=re.compile(r'inherits from itself'), suppress_location=True)
