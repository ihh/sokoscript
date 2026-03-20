"""Tests for lookups module. Port of test/lookups.test.js."""

from sokoscript.lookups import (
    char_perm_lookup, char_lookup, char_class_lookup, char_vec_lookup,
    vec2char, int2char, dirs,
)


def test_vector_char_encoding_roundtrip():
    for x in range(-4, 5):
        for y in range(-4, 5):
            c = vec2char((x, y))
            v = char_vec_lookup[c]
            assert v == (x, y), f"Round-trip failed for ({x},{y})"


def test_integer_char_encoding_roundtrip():
    for n in range(94):
        c = int2char(n)
        assert 33 <= ord(c) <= 126


def test_integer_char_cyclic_arithmetic():
    zero = int2char(0)
    assert char_perm_lookup['intAdd'][zero][zero] == zero
    for n in range(94):
        c = int2char(n)
        assert char_perm_lookup['intAdd'][zero][c] == c
    for n in range(94):
        c = int2char(n)
        assert char_perm_lookup['intSub'][c][c] == zero


def test_vector_addition_commutative():
    for x1 in range(-2, 3):
        for y1 in range(-2, 3):
            c1 = vec2char((x1, y1))
            for x2 in range(-2, 3):
                for y2 in range(-2, 3):
                    c2 = vec2char((x2, y2))
                    assert char_perm_lookup['vecAdd'][c1][c2] == char_perm_lookup['vecAdd'][c2][c1]


def test_vector_add_then_subtract():
    origin = vec2char((0, 0))
    for x in range(-2, 3):
        for y in range(-2, 3):
            c = vec2char((x, y))
            added = char_perm_lookup['vecAdd'][c][origin]
            result = char_perm_lookup['vecSub'][c][added]
            assert result == origin


def test_matrix_identity():
    for x in range(-4, 5):
        for y in range(-4, 5):
            c = vec2char((x, y))
            assert char_perm_lookup['matMul']['F'][c] == c


def test_matrix_R_rotates_90():
    east = vec2char((1, 0))
    south = vec2char((0, 1))
    west = vec2char((-1, 0))
    north = vec2char((0, -1))
    assert char_perm_lookup['matMul']['R'][east] == south
    assert char_perm_lookup['matMul']['R'][south] == west
    assert char_perm_lookup['matMul']['R'][west] == north
    assert char_perm_lookup['matMul']['R'][north] == east


def test_matrix_B_rotates_180():
    for x in range(-4, 5):
        for y in range(-4, 5):
            c = vec2char((x, y))
            expected = vec2char((-x, -y))
            assert char_perm_lookup['matMul']['B'][c] == expected


def test_four_rotations_identity():
    for x in range(-3, 4):
        for y in range(-3, 4):
            c = vec2char((x, y))
            r = c
            for _ in range(4):
                r = char_perm_lookup['matMul']['R'][r]
            assert r == c


def test_direction_vectors():
    assert dirs == ['N', 'E', 'S', 'W']
    assert char_lookup['absDir']['N'] == vec2char((0, -1))
    assert char_lookup['absDir']['E'] == vec2char((1, 0))
    assert char_lookup['absDir']['S'] == vec2char((0, 1))
    assert char_lookup['absDir']['W'] == vec2char((-1, 0))


def test_neighborhood_char_classes():
    assert 'moore' in char_class_lookup
    assert 'neumann' in char_class_lookup
    origin = vec2char((0, 0))
    assert len(char_class_lookup['moore'][origin]) == 9
    assert len(char_class_lookup['neumann'][origin]) == 5


def test_clock_rotation_cycles():
    east = vec2char((1, 0))
    rotated = char_perm_lookup['rotate']['clock'][east]
    assert rotated != east
    c = east
    for _ in range(8):
        c = char_perm_lookup['rotate']['clock'][c]
    assert c == east


def test_clock_anti_inverse():
    for x in range(-3, 4):
        for y in range(-3, 4):
            if x == 0 and y == 0:
                continue
            c = vec2char((x, y))
            cw = char_perm_lookup['rotate']['clock'][c]
            back = char_perm_lookup['rotate']['anti'][cw]
            assert back == c
