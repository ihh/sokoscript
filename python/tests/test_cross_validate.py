"""Cross-validation: compare Python parser output with JS parser output."""

import json
import os
import subprocess
import pytest
from sokoscript.parser import parse_or_undefined
from sokoscript.serialize import serialize
from sokoscript.compiler import compile_types
from tests.conftest import GRAMMARS_DIR, load_grammar


def _js_available():
    try:
        subprocess.run(['node', '-e', '1'], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


@pytest.fixture
def js_parse():
    """Run JS parser via node and return parsed rules as JSON."""
    src_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'src')

    def _parse(grammar_text):
        script = f"""
import {{ parseOrUndefined }} from './src/gramutil.js';
import {{ serialize }} from './src/serialize.js';
const rules = parseOrUndefined({json.dumps(grammar_text)}, {{error:false}});
if (rules) {{
    process.stdout.write(serialize(rules));
}} else {{
    process.stdout.write('PARSE_ERROR');
}}
"""
        result = subprocess.run(
            ['node', '--input-type=module', '-e', script],
            capture_output=True, text=True, timeout=10,
            cwd=os.path.join(os.path.dirname(__file__), '..', '..')
        )
        return result.stdout
    return _parse


@pytest.mark.skipif(not _js_available(), reason="Node.js not available")
class TestCrossValidation:
    """Compare Python and JS parser serialization output."""

    GRAMMARS = [
        'a b : c d.',
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
        'a : b, sync=1.',
        'bee _ : _ bee.',
        'bee _ : $2 $1, rate=999.\nrock = bee.\nscissors = bee.\npaper = bee.',
        'x _ : _ x, sync=1.',
    ]

    def test_simple_grammars(self, js_parse):
        for g in self.GRAMMARS:
            py_rules = parse_or_undefined(g, error=False)
            assert py_rules is not None, f"Python failed to parse: {g}"
            py_serial = serialize(py_rules)
            js_serial = js_parse(g)
            assert js_serial != 'PARSE_ERROR', f"JS failed to parse: {g}"
            assert py_serial == js_serial, (
                f"Serialization mismatch for: {g}\n"
                f"  Python: {py_serial!r}\n"
                f"  JS:     {js_serial!r}"
            )

    def test_grammar_files(self, js_parse):
        skip = ['syntax.txt']
        for f in os.listdir(GRAMMARS_DIR):
            if not f.endswith('.txt') or f in skip:
                continue
            grammar = load_grammar(f)
            py_rules = parse_or_undefined(grammar, error=False)
            assert py_rules is not None, f"Python failed to parse {f}"
            py_serial = serialize(py_rules)
            js_serial = js_parse(grammar)
            assert js_serial != 'PARSE_ERROR', f"JS failed to parse {f}"
            assert py_serial == js_serial, (
                f"Serialization mismatch for {f}\n"
                f"  Python: {py_serial[:200]!r}\n"
                f"  JS:     {js_serial[:200]!r}"
            )


@pytest.mark.skipif(not _js_available(), reason="Node.js not available")
class TestRNGCrossValidation:
    """Compare Python and JS Mersenne Twister output."""

    def test_rng_sequence(self):
        from sokoscript.rng import MersenneTwister

        script = """
import { MersenneTwister } from './src/MersenneTwister.js';
const rng = new MersenneTwister(5489);
const vals = [];
for (let i = 0; i < 100; i++) vals.push(rng.int());
process.stdout.write(JSON.stringify(vals));
"""
        result = subprocess.run(
            ['node', '--input-type=module', '-e', script],
            capture_output=True, text=True, timeout=10,
            cwd=os.path.join(os.path.dirname(__file__), '..', '..')
        )
        js_vals = json.loads(result.stdout)

        rng = MersenneTwister(5489)
        py_vals = [rng.int() for _ in range(100)]

        assert py_vals == js_vals, "RNG sequences differ"
