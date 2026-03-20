"""Tests for Board class. Port of test/board.test.js."""

from sokoscript.board import Board


def test_board_creation_defaults():
    board = Board()
    assert board.size == 64
    assert len(board.cell) == 64 * 64
    assert board.time == 0


def test_board_creation_custom_size():
    board = Board({'size': 8})
    assert board.size == 8
    assert len(board.cell) == 64


def test_coordinate_wrapping():
    board = Board({'size': 8})
    assert board.xy2index(0, 0) == board.xy2index(8, 8)
    assert board.xy2index(3, 5) == board.xy2index(11, 13)
    assert board.xy2index(0, 0) == board.xy2index(-8, -8)
    assert board.xy2index(7, 7) == board.xy2index(-1, -1)


def test_grammar_initialization():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    assert 'bee' in board.grammar['types']
    assert '_' in board.grammar['types']
    assert isinstance(board.grammar['typeIndex']['bee'], int)
    assert board.grammar['typeIndex']['_'] == 0


def test_set_and_get_cells():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    board.set_cell_type_by_name(1, 2, 'bee')
    desc = board.get_cell_descriptor_string(1, 2)
    assert desc == 'bee'
    board.set_cell_type_by_name(1, 2, '_')
    assert board.get_cell_descriptor_string(1, 2) == '_'


def test_set_cell_with_state():
    board = Board({'size': 4, 'grammar': 'bee/? : bee.'})
    board.set_cell_type_by_name(0, 0, 'bee', 'x')
    assert board.get_cell_descriptor_string(0, 0) == 'bee/x'


def test_cell_id_tracking():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    board.set_cell_type_by_name(2, 3, 'bee', '', {'id': 'player1'})
    assert board.by_id['player1'] == board.xy2index(2, 3)
    board.set_cell_type_by_name(1, 1, 'bee', '', {'id': 'player1'})
    assert board.by_id['player1'] == board.xy2index(1, 1)


def test_unique_id_generation():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    board.set_cell_type_by_name(0, 0, 'bee', '', {'id': 'bee1'})
    id2 = board.get_unique_id('bee')
    assert id2 == 'bee2'
    board.set_cell_type_by_name(1, 0, 'bee', '', {'id': id2})
    id3 = board.get_unique_id('bee')
    assert id3 == 'bee3'


def test_type_counts():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    counts = board.type_counts_including_unknowns()
    assert counts['_'] == 16
    assert counts['bee'] == 0
    board.set_cell_type_by_name(0, 0, 'bee')
    board.set_cell_type_by_name(1, 0, 'bee')
    counts = board.type_counts_including_unknowns()
    assert counts['bee'] == 2
    assert counts['_'] == 14


def test_json_roundtrip():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    board.set_cell_type_by_name(2, 2, 'bee')
    board.set_cell_type_by_name(3, 1, 'bee', 'x')
    json_data = board.to_json()
    board2 = Board(json_data)
    assert board2.size == board.size
    assert board2.get_cell_descriptor_string(2, 2) == 'bee'
    assert board2.get_cell_descriptor_string(3, 1) == 'bee/x'
    assert board2.get_cell_descriptor_string(0, 0) == '_'


def test_unknown_type():
    board = Board({'size': 4, 'grammar': 'bee _ : _ bee.'})
    board.set_cell_type_by_name(0, 0, 'dragon')
    cell = board.get_cell(0, 0)
    assert cell['type'] == board.grammar['unknownType']
    assert cell['meta']['type'] == 'dragon'


def test_deterministic_evolution():
    grammar = 'bee _ : _ bee.'
    board1 = Board({'size': 4, 'seed': 42, 'grammar': grammar})
    board2 = Board({'size': 4, 'seed': 42, 'grammar': grammar})
    board1.set_cell_type_by_name(2, 2, 'bee')
    board2.set_cell_type_by_name(2, 2, 'bee')
    t = 1 << 32  # 1 second
    board1.evolve_to_time(t, True)
    board2.evolve_to_time(t, True)
    assert board1.to_string() == board2.to_string()


def test_different_seeds():
    grammar = 'bee _ : _ bee, rate=100.'
    board1 = Board({'size': 4, 'seed': 1, 'grammar': grammar})
    board2 = Board({'size': 4, 'seed': 2, 'grammar': grammar})
    board1.set_cell_type_by_name(2, 2, 'bee')
    board2.set_cell_type_by_name(2, 2, 'bee')
    t = 1 << 32
    board1.evolve_to_time(t, True)
    board2.evolve_to_time(t, True)
    assert board1.to_string() != board2.to_string()


def test_diffusion_conserves_particles():
    board = Board({'size': 4, 'seed': 42, 'grammar': 'bee _ : _ bee, rate=100.'})
    board.set_cell_type_by_name(0, 0, 'bee')
    counts = board.type_counts_including_unknowns()
    assert counts['bee'] == 1
    board.evolve_to_time(1 << 32, True)
    counts = board.type_counts_including_unknowns()
    assert counts['bee'] == 1


def test_sync_rules():
    board = Board({'size': 4, 'seed': 42, 'grammar': 'bee : ant, sync=1.'})
    board.set_cell_type_by_name(0, 0, 'bee')
    board.set_cell_type_by_name(1, 1, 'bee')
    assert board.type_counts_including_unknowns()['bee'] == 2
    board.evolve_to_time(2 << 32, True)
    assert board.type_counts_including_unknowns().get('bee', 0) == 0
    assert board.type_counts_including_unknowns()['ant'] == 2


def test_player_command():
    board = Board({'size': 8, 'grammar': 'player _ : _ player, command={move}.'})
    board.set_cell_type_by_name(4, 4, 'player', '', {'id': 'p1'})
    move = {
        'type': 'command',
        'time': 1,
        'user': None,
        'id': 'p1',
        'dir': 'N',
        'command': 'move',
    }
    board.process_move(move)
    assert board.get_cell_descriptor_string(4, 3) == 'player'
    assert board.get_cell_descriptor_string(4, 4) == '_'


def test_key_rules_dont_fire_spontaneously():
    board = Board({'size': 4, 'seed': 42, 'grammar': 'player _ : _ player, key={w}.'})
    board.set_cell_type_by_name(2, 2, 'player', '', {'id': 'p1'})
    initial_pos = board.by_id['p1']
    board.evolve_to_time(5 << 32, True)
    assert board.by_id['p1'] == initial_pos


def test_range_counter():
    board = Board({'size': 4, 'grammar': 'a _ : _ a. b _ : _ b.'})
    assert board.by_type[0].total() == 16
    board.set_cell_type_by_name(0, 0, 'a')
    board.set_cell_type_by_name(1, 0, 'a')
    board.set_cell_type_by_name(2, 0, 'b')
    assert board.by_type[0].total() == 13
    a_idx = board.grammar['typeIndex']['a']
    b_idx = board.grammar['typeIndex']['b']
    assert board.by_type[a_idx].total() == 2
    assert board.by_type[b_idx].total() == 1
    board.set_cell_type_by_name(0, 0, '_')
    assert board.by_type[a_idx].total() == 1
    assert board.by_type[0].total() == 14
