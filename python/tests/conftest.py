"""Shared test fixtures."""

import os

GRAMMARS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'grammars')
BOARDS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'boards')


def load_grammar(filename):
    with open(os.path.join(GRAMMARS_DIR, filename)) as f:
        return f.read()
