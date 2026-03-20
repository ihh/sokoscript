"""Board state management and evolution loop.

Port of src/board.js: Board class, RangeCounter, evolution logic.
"""

import json
import math
from . import lookups
from .engine import transform_rule_update
from .rng import MersenneTwister, fast_ln_left_shift_26, fast_ln_left_shift_26_max
from .parser import parse_or_undefined
from .compiler import compile_types
from .serialize import serialize_rule_with_types

DEFAULT_BOARD_SIZE = 64
DEFAULT_RNG_SEED = 5489


def xy2index(x, y, size):
    return (((y % size) + size) % size) * size + (((x % size) + size) % size)


class RangeCounter:
    """Time-efficient data structure for a set of ints in [0, n) where n is a power of 2.
    O(1) total count, O(log n) add/remove/kth-element."""

    def __init__(self, n, full=False):
        self.n = n
        self.log2n = round(math.log2(n))
        if (1 << self.log2n) != n:
            raise ValueError(f"Length is not a power of 2: {n}")
        self.level_count = [
            [((1 << level) if full else 0) for _ in range(1 << (self.log2n - level))]
            for level in range(self.log2n + 1)
        ]

    def add(self, val):
        for level in range(self.log2n, -1, -1):
            self.level_count[level][val >> level] += 1

    def remove(self, val):
        for level in range(self.log2n, -1, -1):
            self.level_count[level][val >> level] -= 1

    def total(self):
        return self.level_count[self.log2n][0]

    def kth_element(self, k):
        index = 0
        for level in range(self.log2n - 1, -1, -1):
            index = index << 1
            if k + 1 > self.level_count[level][index]:
                k -= self.level_count[level][index]
                index += 1
        return index

    def elements(self):
        return [self.kth_element(k) for k in range(self.total())]


def _random_int(rng, max_val):
    return (max_val * rng.int()) >> 32


def _random_big_int(rng, max_val):
    """Generate random integer in [0, max_val) using enough random bits."""
    tmp = max_val
    lg = 32
    r = rng.int()
    while tmp >> 32:
        tmp = tmp >> 32
        lg += 32
        r = (r << 32) | rng.int()
    return (max_val * r) >> lg


def _knuth_shuffle(rng, lst):
    n = len(lst)
    for k in range(n - 1):
        i = k + _random_int(rng, n - k)
        lst[i], lst[k] = lst[k], lst[i]
    return lst


class Board:
    owner = None  # class-level owner for ownership checks

    def __init__(self, opts=None):
        self.max_state_len = 64
        self.init_from_json(opts or {})

    def init_grammar(self, grammar):
        self.grammar_source = grammar
        parsed = parse_or_undefined(grammar, error=False)
        self.grammar = compile_types(parsed if parsed else [])
        n_cells = self.size * self.size
        self.cell = [{'type': 0, 'state': ''} for _ in range(n_cells)]
        self.by_type = [
            RangeCounter(n_cells, full=(n == 0))
            for n in range(len(self.grammar['types']))
        ]
        self.by_id = {}

    def update_grammar(self, grammar):
        self.init_from_json({**self.to_json(), 'grammar': grammar})

    def time_in_seconds(self):
        return self.time / (1 << 32)

    def index2xy(self, index):
        return (index % self.size, index // self.size)

    def xy2index(self, x, y):
        return xy2index(x, y, self.size)

    def get_cell(self, x, y):
        return self.cell[self.xy2index(x, y)]

    def set_cell(self, x, y, new_value):
        state = new_value.get('state', '')
        if len(state) > self.max_state_len:
            new_value = {**new_value, 'state': state[:self.max_state_len]}
        self.set_cell_by_index(self.xy2index(x, y), new_value)

    def set_cell_by_index(self, index, new_value):
        old_value = self.cell[index]
        if new_value['type'] != old_value['type']:
            self.by_type[old_value['type']].remove(index)
            self.by_type[new_value['type']].add(index)

        old_meta = old_value.get('meta', {})
        new_meta = new_value.get('meta', {})

        if (old_meta.get('id') and
                self.by_id.get(old_meta['id']) == index and
                new_meta.get('id') != old_meta.get('id')):
            del self.by_id[old_meta['id']]

        if (new_meta.get('id') and
                new_meta.get('id') != old_meta.get('id')):
            new_id = new_meta['id']
            if new_id in self.by_id:
                prev_index = self.by_id[new_id]
                prev_cell = self.cell[prev_index]
                prev_meta = prev_cell.get('meta', {})
                if prev_meta.get('id') == new_id:
                    prev_meta_copy = dict(prev_meta)
                    del prev_meta_copy['id']
                    if prev_meta_copy:
                        self.cell[prev_index] = {**prev_cell, 'meta': prev_meta_copy}
                    else:
                        cell_copy = dict(prev_cell)
                        cell_copy.pop('meta', None)
                        self.cell[prev_index] = cell_copy
            self.by_id[new_id] = index

        self.cell[index] = new_value

    def set_cell_type_by_name(self, x, y, type_name, state='', meta=None):
        type_idx = self.grammar['typeIndex'].get(type_name)
        if type_idx is None:
            meta = {**(meta or {}), 'type': type_name}
            type_idx = self.grammar['unknownType']
        cell = {'type': type_idx, 'state': state or ''}
        if meta:
            cell['meta'] = meta
        self.set_cell(x, y, cell)

    def get_cell_descriptor_string(self, x, y):
        cell = self.get_cell(x, y)
        type_name = self.grammar['types'][cell['type']]
        result = type_name
        if cell['state']:
            result += '/' + cell['state']
        meta = cell.get('meta', {})
        if meta:
            result += ' ' + json.dumps(meta, separators=(',', ':'))
        return result

    def total_type_rates(self):
        return [
            self.by_type[t].total() * self.grammar['rateByType'][t]
            for t in range(len(self.by_type))
        ]

    def get_unique_id(self, prefix='cell'):
        i = 1
        while f'{prefix}{i}' in self.by_id:
            i += 1
        return f'{prefix}{i}'

    def next_rule(self, max_wait):
        type_rates = self.total_type_rates()
        total_rate = sum(type_rates)
        if total_rate == 0:
            return None

        r1 = self.rng.int()
        wait = (64 * (fast_ln_left_shift_26_max - fast_ln_left_shift_26(r1))) // total_rate or 1
        if wait > max_wait:
            return None

        r2 = _random_big_int(self.rng, total_rate)
        r = r2
        cell_type = 0
        w = 0
        while r >= 0:
            w = type_rates[cell_type]
            r -= w
            cell_type += 1
        cell_type -= 1
        r += w

        t = self.grammar['rateByType'][cell_type]
        n = r // t  # integer division rounds down
        r = r - n * t

        rules = self.grammar['transform'][cell_type]
        rule_index = 0
        rule = None
        while r >= 0:
            rule = rules[rule_index]
            w = rule['rate_Hz']
            r -= w
            rule_index += 1

        r3 = self.rng.int()
        if (r3 & 0x3FFFFFFF) > rule['acceptProb_leftShift30']:
            return None

        direction = lookups.dirs[r3 >> 30]
        pos = self.by_type[cell_type].kth_element(int(n))
        x, y = self.index2xy(pos)
        return {'wait': wait, 'x': x, 'y': y, 'rule': rule, 'dir': direction}

    def process_move(self, move):
        if move['type'] == 'command':
            cell_id = move.get('id')
            direction = move.get('dir')
            command = move.get('command')
            key = move.get('key')
            user = move.get('user')

            index = self.by_id.get(cell_id)
            if index is not None:
                x, y = self.index2xy(index)
                cell = self.cell[index]
                if cell.get('owner') is None or user == cell.get('owner') or user == Board.owner:
                    if command:
                        rules = self.grammar['command'][cell['type']].get(command, [])
                    else:
                        rules = self.grammar['key'][cell['type']].get(key, [])
                    for rule in rules:
                        if self._apply_rule(x, y, direction, rule):
                            break

    def random_dir(self):
        return lookups.dirs[self.rng.int() % 4]

    def evolve_async_to_time(self, t, hard_stop=False):
        while self.time < t:
            mt_state = self.rng.save_state()
            r = self.next_rule(t - self.last_event_time)
            if r is None:
                self.time = t
                if not hard_stop:
                    self.rng.restore_state(mt_state)
                else:
                    self.last_event_time = t
                break
            self._apply_rule(r['x'], r['y'], r['dir'], r['rule'])
            self.time = self.last_event_time = self.last_event_time + r['wait']

    def evolve_to_time(self, t, hard_stop=False):
        while self.time < t:
            sync_periods = self.grammar['syncPeriods']
            next_sync_times = [p + self.time - (self.time % p) for p in sync_periods]
            next_time = min([t] + next_sync_times)
            next_sync_categories = [
                n for n in self.grammar['syncCategories']
                if next_sync_times[n] == next_time
            ]
            next_time_is_sync_event = len(next_sync_categories) > 0
            self.evolve_async_to_time(next_time, hard_stop or next_time_is_sync_event)
            if next_time_is_sync_event:
                sync_items = []
                for n_sync in next_sync_categories:
                    for n_type in self.grammar['typesBySyncCategory'][n_sync]:
                        rules = self.grammar['syncTransform'][n_sync][n_type]
                        for index in self.by_type[n_type].elements():
                            xy = self.index2xy(index)
                            for rule in rules:
                                sync_items.append((xy, rule))
                _knuth_shuffle(self.rng, sync_items)
                for xy, rule in sync_items:
                    self._apply_rule(xy[0], xy[1], self.random_dir(), rule)

    def evolve_and_process(self, t, moves, hard_stop=False):
        future = sorted(
            [m for m in moves if m.get('time', 0) > t],
            key=lambda m: m.get('time', 0)
        )
        for move in future:
            self.evolve_to_time(move['time'], True)
            self.process_move(move)
        self.evolve_to_time(t, hard_stop)

    def _apply_rule(self, x, y, direction, rule):
        updates = transform_rule_update(self, x, y, direction, rule)
        if not updates:
            return False
        for ux, uy, cell in updates:
            self.set_cell(ux, uy, cell)
        return True

    def types_including_unknowns(self):
        unknown_types = set()
        for index in self.by_type[self.grammar['unknownType']].elements():
            meta = self.cell[index].get('meta', {})
            if 'type' in meta:
                unknown_types.add(meta['type'])
        types = list(self.grammar['types']) + [t for t in unknown_types if t is not None]
        type2idx = {t: i for i, t in enumerate(types)}
        return types, type2idx

    def type_counts_including_unknowns(self):
        types, _ = self.types_including_unknowns()
        count = {t: 0 for t in types}
        for cell in self.cell:
            if cell['type'] == self.grammar['unknownType']:
                t = cell.get('meta', {}).get('type')
            else:
                t = self.grammar['types'][cell['type']]
            if t:
                count[t] = count.get(t, 0) + 1
        return count

    def cell_to_json(self, cell, type2idx):
        meta = dict(cell.get('meta', {}))
        type_idx = cell['type']
        if type_idx == self.grammar['unknownType'] and 'type' in meta:
            type_idx = type2idx[meta['type']]
            del meta['type']
        if not meta:
            meta = None
        if cell['state'] or meta:
            result = [type_idx, cell['state'] or '']
            if meta:
                result.append(meta)
            return result
        return type_idx

    def to_json(self):
        types, type2idx = self.types_including_unknowns()
        return {
            'time': str(self.time),
            'lastEventTime': str(self.last_event_time),
            'rng': self.rng.to_string(),
            'owner': self.owner_val,
            'grammar': self.grammar_source,
            'types': types,
            'size': self.size,
            'cell': [self.cell_to_json(cell, type2idx) for cell in self.cell],
        }

    def to_string(self):
        return json.dumps(self.to_json(), sort_keys=True, separators=(',', ':'))

    def init_from_string(self, s):
        self.init_from_json(json.loads(s))

    def init_from_json(self, data):
        self.owner_val = data.get('owner')
        self.size = data.get('size', DEFAULT_BOARD_SIZE)
        self.time = int(data.get('time', 0))
        self.last_event_time = int(data.get('lastEventTime', data.get('time', 0)))

        rng_str = data.get('rng')
        if rng_str:
            self.rng = MersenneTwister.from_string(rng_str)
        else:
            self.rng = MersenneTwister(data.get('seed', DEFAULT_RNG_SEED))

        self.init_grammar(data.get('grammar', ''))

        if 'cell' in data:
            cells = data['cell']
            if len(cells) != len(self.cell):
                raise ValueError(f"Tried to load {len(cells)}-cell board file into {len(self.cell)}-cell board")
            types_list = data.get('types', [])
            for index, type_state_meta in enumerate(cells):
                if isinstance(type_state_meta, int):
                    type_state_meta = [type_state_meta]
                type_idx_in_file = type_state_meta[0]
                state = type_state_meta[1] if len(type_state_meta) > 1 else ''
                meta = type_state_meta[2] if len(type_state_meta) > 2 else None

                type_name = types_list[type_idx_in_file] if type_idx_in_file < len(types_list) else '_'
                actual_type_idx = self.grammar['typeIndex'].get(type_name)
                if actual_type_idx is None:
                    meta = {**(meta or {}), 'type': type_name}
                    actual_type_idx = self.grammar['unknownType']

                cell = {'type': actual_type_idx, 'state': state or ''}
                if meta:
                    cell['meta'] = meta
                self.set_cell_by_index(index, cell)
