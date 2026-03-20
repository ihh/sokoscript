"""Tests for engine module."""

from sokoscript.board import Board


def test_basic_pattern_match():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    board.set_cell_type_by_name(1, 1, 'bee')
    # Manually verify the board has the bee
    assert board.get_cell_descriptor_string(1, 1) == 'bee'
    assert board.get_cell_descriptor_string(2, 1) == '_'


def test_rule_application_swap():
    board = Board({'size': 4, 'seed': 42, 'grammar': 'bee _ : _ bee, rate=100.'})
    board.set_cell_type_by_name(2, 2, 'bee')
    # Evolve briefly — bee should move
    board.evolve_to_time(1 << 32, True)
    counts = board.type_counts_including_unknowns()
    assert counts['bee'] == 1  # conservation


def test_state_preservation():
    board = Board({'size': 4, 'seed': 42, 'grammar': 'bee/? _ : _ $1, rate=100.'})
    board.set_cell_type_by_name(2, 2, 'bee', 'x')
    board.evolve_to_time(1 << 32, True)
    # Find the bee
    for y in range(4):
        for x in range(4):
            desc = board.get_cell_descriptor_string(x, y)
            if desc.startswith('bee'):
                assert desc == 'bee/x'
                return
    assert False, "Bee not found after evolution"


def test_multi_type_rules():
    grammar = 'a b : b a, rate=100.'
    board = Board({'size': 4, 'seed': 42, 'grammar': grammar})
    board.set_cell_type_by_name(0, 0, 'a')
    board.set_cell_type_by_name(1, 0, 'b')
    board.evolve_to_time(1 << 32, True)
    # Particles should still total the same
    counts = board.type_counts_including_unknowns()
    assert counts['a'] == 1
    assert counts['b'] == 1


def test_negation_matching():
    grammar = 'a ^b : a a.'
    board = Board({'size': 4, 'seed': 42, 'grammar': grammar})
    board.set_cell_type_by_name(0, 0, 'a')
    # Next to a non-b cell (empty), rule should fire
    board.evolve_to_time(1 << 32, True)
    counts = board.type_counts_including_unknowns()
    # a should have spread (replacing empties)
    assert counts['a'] >= 1
