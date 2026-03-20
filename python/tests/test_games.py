"""Tests for game grammars. Port of test/games.test.js."""

import os
import json
import pytest
from sokoscript.parser import parse_or_undefined
from sokoscript.compiler import compile_types
from sokoscript.board import Board
from tests.conftest import load_grammar, GRAMMARS_DIR, BOARDS_DIR


def test_forest_fire_parses():
    grammar = load_grammar('forest_fire.txt')
    rules = parse_or_undefined(grammar, error=False)
    assert rules is not None
    compiled = compile_types(rules)
    assert 'grass' in compiled['types']
    assert 'tree' in compiled['types']
    assert 'fire' in compiled['types']
    assert 'ash' in compiled['types']
    assert 'water' in compiled['types']
    assert 'fireman' in compiled['types']


def test_forest_fire_board():
    board_path = os.path.join(BOARDS_DIR, 'forest_fire.json')
    if not os.path.exists(board_path):
        pytest.skip('forest_fire.json board not found')
    with open(board_path) as f:
        board_json = json.load(f)
    board = Board(board_json)
    assert board.size == 16
    counts = board.type_counts_including_unknowns()
    assert counts['fireman'] == 1
    assert counts.get('fire', 0) > 0
    board.evolve_to_time(1 << 31, True)
    assert board.type_counts_including_unknowns()['fireman'] == 1


def test_forest_fire_movement():
    grammar = load_grammar('forest_fire.txt')
    board = Board({'size': 8, 'grammar': grammar})
    board.set_cell_type_by_name(4, 4, 'fireman', '', {'id': 'p1'})
    board.set_cell_type_by_name(4, 3, 'grass')
    move = {'type': 'command', 'time': 1, 'id': 'p1', 'dir': 'N', 'key': 'w'}
    board.process_move(move)
    assert board.get_cell_descriptor_string(4, 3) == 'fireman {"id":"p1"}'


def test_forest_fire_extinguish():
    grammar = load_grammar('forest_fire.txt')
    board = Board({'size': 8, 'grammar': grammar})
    board.set_cell_type_by_name(4, 4, 'fireman', '', {'id': 'p1'})
    board.set_cell_type_by_name(4, 3, 'fire')
    move = {'type': 'command', 'time': 1, 'id': 'p1', 'dir': 'N', 'key': 'w'}
    board.process_move(move)
    assert board.get_cell_descriptor_string(4, 3) == 'water'


def test_forest_fire_spread():
    grammar = load_grammar('forest_fire.txt')
    board = Board({'size': 8, 'seed': 42, 'grammar': grammar})
    for x in range(8):
        board.set_cell_type_by_name(x, 4, 'tree')
    board.set_cell_type_by_name(0, 4, 'fire')
    board.evolve_to_time(5 << 32, True)
    counts = board.type_counts_including_unknowns()
    assert counts.get('tree', 0) <= 7


def test_sokoban_parses():
    grammar_path = os.path.join(GRAMMARS_DIR, 'sokoban.txt')
    if not os.path.exists(grammar_path):
        pytest.skip('sokoban.txt not found')
    grammar = load_grammar('sokoban.txt')
    rules = parse_or_undefined(grammar, error=False)
    assert rules is not None
    compiled = compile_types(rules)
    assert 'player' in compiled['types']
    assert 'crate' in compiled['types']


def test_ecosystem_parses():
    grammar_path = os.path.join(GRAMMARS_DIR, 'ecosystem.txt')
    if not os.path.exists(grammar_path):
        pytest.skip('ecosystem.txt not found')
    grammar = load_grammar('ecosystem.txt')
    rules = parse_or_undefined(grammar, error=False)
    assert rules is not None


def test_all_grammars_parse():
    skip = ['syntax.txt']
    for f in os.listdir(GRAMMARS_DIR):
        if f.endswith('.txt') and f not in skip:
            grammar = load_grammar(f)
            rules = parse_or_undefined(grammar, error=False)
            assert rules is not None, f"Grammar {f} failed to parse"
