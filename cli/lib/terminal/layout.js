// Three-pane layout manager
//
// +-------------------------------+---------------------------+
// |                               |                           |
// |   LOCAL MAP (upper-left)      |  GRAMMAR RULES            |
// |                               |  (upper-right)            |
// |                               |                           |
// +-------------------------------+---------------------------+
// |                                                           |
// |   COMMAND LINE (bottom, full width)                       |
// |                                                           |
// +-----------------------------------------------------------+

import { moveTo, ESC, reset, dim, inverse } from '../ansi.js';

const BOX = {
    h: '\u2500', v: '\u2502',
    tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518',
    lj: '\u251C', rj: '\u2524', tj: '\u252C', bj: '\u2534',
    cross: '\u253C',
};

export class Layout {
    constructor() {
        this.recalculate();
    }

    recalculate() {
        this.termW = process.stdout.columns || 120;
        this.termH = process.stdout.rows || 40;

        // Right pane width (grammar): ~40% of width, min 30, max 60
        this.rightW = Math.max(30, Math.min(60, Math.floor(this.termW * 0.4)));
        this.leftW = this.termW - this.rightW - 1; // -1 for vertical divider

        // Bottom pane height (command): ~25% of height, min 6, max 14
        this.bottomH = Math.max(6, Math.min(14, Math.floor(this.termH * 0.25)));
        this.topH = this.termH - this.bottomH - 1; // -1 for horizontal divider

        // Pane rects (1-indexed for moveTo)
        this.map = { row: 1, col: 1, width: this.leftW, height: this.topH };
        this.grammar = { row: 1, col: this.leftW + 2, width: this.rightW, height: this.topH };
        this.command = { row: this.topH + 2, col: 1, width: this.termW, height: this.bottomH };

        // Divider positions
        this.vDivCol = this.leftW + 1;
        this.hDivRow = this.topH + 1;
    }

    renderDividers(activePane) {
        let out = '';
        const color = dim;

        // Horizontal divider (full width)
        out += color;
        out += moveTo(this.hDivRow, 1);
        for (let c = 1; c <= this.termW; c++) {
            if (c === this.vDivCol) {
                out += BOX.bj; // bottom junction (vertical divider ends here)
            } else {
                out += BOX.h;
            }
        }

        // Vertical divider (top section only)
        for (let r = 1; r < this.hDivRow; r++) {
            out += moveTo(r, this.vDivCol) + BOX.v;
        }

        out += reset;

        // Pane labels with focus indicators
        const panes = [
            { name: ' MAP ', id: 'map', col: this.map.col + 1 },
            { name: ' RULES ', id: 'grammar', col: this.grammar.col + 1 },
            { name: ' CMD ', id: 'command', col: this.command.col + 1 },
        ];

        for (const p of panes) {
            const isActive = (activePane === p.id);
            const label = isActive ? `${inverse}${p.name}${reset}` : `${dim}${p.name}${reset}`;
            out += moveTo(this.hDivRow, p.col) + label;
        }

        return out;
    }
}

export { BOX };
