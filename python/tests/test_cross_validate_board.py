"""Cross-validation: compare Python and JS board evolution with same seed.

This is the critical gate test — same grammar, same seed, same initial state,
same number of evolution steps should produce identical board states.
"""

import json
import os
import subprocess
import pytest

from sokoscript.board import Board
from tests.conftest import load_grammar, GRAMMARS_DIR


def _js_available():
    try:
        subprocess.run(['node', '-e', '1'], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _run_js_evolution(grammar, size, seed, setup_cells, evolve_seconds):
    """Run JS board evolution and return cell dump."""
    # Build cell setup JS code
    setup_js = '\n'.join(
        f"board.setCellTypeByName({x}, {y}, '{t}'{', ' + repr(s) if s else ''}{', ' + json.dumps(m) if m else ''});"
        for x, y, t, s, m in setup_cells
    )

    script = f"""
import {{ Board }} from './src/board.js';
const board = new Board({{ size: {size}, seed: {seed}, grammar: {json.dumps(grammar)} }});
{setup_js}
board.evolveToTime(BigInt({evolve_seconds}) << 32n, true);
const cells = board.cell.map((c, i) => ({{
    x: i % {size},
    y: Math.floor(i / {size}),
    type: board.grammar.types[c.type],
    state: c.state
}})).filter(c => c.type !== '_');
process.stdout.write(JSON.stringify(cells));
"""
    result = subprocess.run(
        ['node', '--input-type=module', '-e', script],
        capture_output=True, text=True, timeout=30,
        cwd=os.path.join(os.path.dirname(__file__), '..', '..')
    )
    if result.returncode != 0:
        raise RuntimeError(f"JS error: {result.stderr}")
    return json.loads(result.stdout)


def _run_py_evolution(grammar, size, seed, setup_cells, evolve_seconds):
    """Run Python board evolution and return cell dump."""
    board = Board({'size': size, 'seed': seed, 'grammar': grammar})
    for x, y, t, s, m in setup_cells:
        board.set_cell_type_by_name(x, y, t, s or '', m)
    board.evolve_to_time(evolve_seconds << 32, True)

    cells = []
    for i, c in enumerate(board.cell):
        type_name = board.grammar['types'][c['type']]
        if type_name != '_':
            cells.append({
                'x': i % size,
                'y': i // size,
                'type': type_name,
                'state': c['state'],
            })
    return cells


@pytest.mark.skipif(not _js_available(), reason="Node.js not available")
class TestBoardCrossValidation:

    def _compare(self, grammar, size, seed, setup_cells, evolve_seconds):
        js_cells = _run_js_evolution(grammar, size, seed, setup_cells, evolve_seconds)
        py_cells = _run_py_evolution(grammar, size, seed, setup_cells, evolve_seconds)

        # Sort for stable comparison
        js_sorted = sorted(js_cells, key=lambda c: (c['y'], c['x']))
        py_sorted = sorted(py_cells, key=lambda c: (c['y'], c['x']))

        assert len(js_sorted) == len(py_sorted), (
            f"Cell count mismatch: JS={len(js_sorted)}, Python={len(py_sorted)}\n"
            f"JS: {js_sorted[:10]}\nPython: {py_sorted[:10]}"
        )
        for j, p in zip(js_sorted, py_sorted):
            assert j == p, (
                f"Cell mismatch at ({j['x']},{j['y']}):\n"
                f"  JS:     {j}\n"
                f"  Python: {p}"
            )

    def test_diffusion_1_bee(self):
        """Single bee diffusing for 1 second."""
        self._compare(
            grammar='bee _ : _ bee.',
            size=4, seed=42,
            setup_cells=[(2, 2, 'bee', '', None)],
            evolve_seconds=1,
        )

    def test_diffusion_high_rate(self):
        """Single bee with high rate diffusing for 1 second."""
        self._compare(
            grammar='bee _ : _ bee, rate=100.',
            size=4, seed=42,
            setup_cells=[(2, 2, 'bee', '', None)],
            evolve_seconds=1,
        )

    def test_diffusion_multiple_bees(self):
        """Multiple bees diffusing."""
        self._compare(
            grammar='bee _ : _ bee, rate=10.',
            size=8, seed=123,
            setup_cells=[(1, 1, 'bee', '', None), (5, 5, 'bee', '', None), (3, 7, 'bee', '', None)],
            evolve_seconds=2,
        )

    def test_two_types(self):
        """Two types swapping with empty cells."""
        self._compare(
            grammar='a _ : _ a, rate=5. b _ : _ b, rate=3.',
            size=4, seed=99,
            setup_cells=[(0, 0, 'a', '', None), (3, 3, 'b', '', None)],
            evolve_seconds=2,
        )

    def test_predator_prey(self):
        """Predator-prey interaction."""
        self._compare(
            grammar='a b : a a, rate=10. a _ : _ a, rate=2. b _ : _ b, rate=2.',
            size=8, seed=42,
            setup_cells=[
                (2, 2, 'a', '', None), (3, 3, 'b', '', None),
                (5, 5, 'b', '', None), (6, 1, 'b', '', None),
            ],
            evolve_seconds=1,
        )

    def test_sync_rule(self):
        """Sync rule: all bees become ants."""
        self._compare(
            grammar='bee : ant, sync=1.',
            size=4, seed=42,
            setup_cells=[(0, 0, 'bee', '', None), (2, 2, 'bee', '', None)],
            evolve_seconds=2,
        )

    def test_state_preservation(self):
        """Rules that preserve state."""
        self._compare(
            grammar='bee/? _ : _ $1, rate=10.',
            size=4, seed=42,
            setup_cells=[(2, 2, 'bee', 'x', None)],
            evolve_seconds=1,
        )

    def test_forest_fire_evolution(self):
        """Forest fire game: trees, fire, ash cycle."""
        grammar = load_grammar('forest_fire.txt')
        setup = []
        for x in range(8):
            setup.append((x, 4, 'tree', '', None))
        setup.append((0, 4, 'fire', '', None))
        self._compare(
            grammar=grammar,
            size=8, seed=42,
            setup_cells=setup,
            evolve_seconds=2,
        )

    def test_ecosystem(self):
        """Ecosystem grammar evolution."""
        grammar = load_grammar('ecosystem.txt')
        setup = [
            (2, 2, 'plant', '', None),
            (3, 3, 'herbivore', '', None),
            (5, 5, 'predator', '', None),
        ]
        for x in range(8):
            for y in range(8):
                if (x, y) not in [(2, 2), (3, 3), (5, 5)]:
                    setup.append((x, y, 'soil', '', None))
        self._compare(
            grammar=grammar,
            size=8, seed=42,
            setup_cells=setup,
            evolve_seconds=1,
        )

    def test_lv3_rock_paper_scissors(self):
        """Lotka-Volterra 3-species (rock-paper-scissors)."""
        grammar = load_grammar('lv3.txt')
        self._compare(
            grammar=grammar,
            size=4, seed=42,
            setup_cells=[
                (0, 0, 'rock', '', None),
                (1, 1, 'scissors', '', None),
                (2, 2, 'paper', '', None),
            ],
            evolve_seconds=1,
        )
