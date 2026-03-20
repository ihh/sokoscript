// Map Pane — upper-left
// Board visualization: one character per cell, centered on focus

import { moveTo, reset, dim, bold, inverse, underline, fgRGB, bgRGB } from '../ansi.js';
import { hexMD5 } from '../../../src/md5.js';

// Deterministic color from type name (matches web UI approach)
function typeColor(type) {
    if (type === '_') return [60, 60, 60];
    const hash = hexMD5(type);
    const hue = parseInt(hash.substring(0, 3), 16) / 4096;
    // HSV to RGB (s=0.7, v=0.9)
    const s = 0.7, v = 0.9;
    const i = Math.floor(hue * 6);
    const f = hue * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Type name to display character
function typeChar(type) {
    if (type === '_') return '\u00b7'; // middle dot
    if (type === '?') return '?';
    return type.charAt(0).toUpperCase();
}

export class MapPane {
    constructor(board) {
        this.board = board;
        this.focusX = 0;
        this.focusY = 0;
        this.zoom = false; // false = local, true = full board
        this.colorCache = {};
        this.charCache = {};
    }

    setBoard(board) {
        this.board = board;
        this.colorCache = {};
        this.charCache = {};
    }

    moveFocus(dx, dy) {
        this.focusX = ((this.focusX + dx) % this.board.size + this.board.size) % this.board.size;
        this.focusY = ((this.focusY + dy) % this.board.size + this.board.size) % this.board.size;
    }

    centerOnPlayer(playerId) {
        if (playerId in this.board.byID) {
            const [x, y] = this.board.index2xy(this.board.byID[playerId]);
            this.focusX = x;
            this.focusY = y;
        }
    }

    getTypeColor(type) {
        if (!(type in this.colorCache)) {
            this.colorCache[type] = typeColor(type);
        }
        return this.colorCache[type];
    }

    getTypeChar(type) {
        if (!(type in this.charCache)) {
            this.charCache[type] = typeChar(type);
        }
        return this.charCache[type];
    }

    render(rect) {
        let out = '';
        const { width, height, row, col } = rect;
        const board = this.board;

        if (this.zoom) {
            // Full board scaled to fit
            const scaleX = Math.max(1, Math.ceil(board.size / width));
            const scaleY = Math.max(1, Math.ceil(board.size / height));
            for (let r = 0; r < height && r * scaleY < board.size; r++) {
                out += moveTo(row + r, col);
                for (let c = 0; c < width && c * scaleX < board.size; c++) {
                    const x = c * scaleX;
                    const y = r * scaleY;
                    const cell = board.getCell(x, y);
                    const type = board.grammar.types[cell.type];
                    const [cr, cg, cb] = this.getTypeColor(type);
                    const ch = this.getTypeChar(type);
                    out += fgRGB(cr, cg, cb) + ch;
                }
                out += reset;
            }
        } else {
            // Local view centered on focus
            const halfW = Math.floor(width / 2);
            const halfH = Math.floor(height / 2);
            const startX = this.focusX - halfW;
            const startY = this.focusY - halfH;

            for (let r = 0; r < height; r++) {
                out += moveTo(row + r, col);
                for (let c = 0; c < width; c++) {
                    const x = ((startX + c) % board.size + board.size) % board.size;
                    const y = ((startY + r) % board.size + board.size) % board.size;
                    const cell = board.getCell(x, y);
                    const type = board.grammar.types[cell.type];
                    const [cr, cg, cb] = this.getTypeColor(type);
                    const ch = this.getTypeChar(type);

                    const isFocus = (x === this.focusX && y === this.focusY);
                    const hasId = cell.meta && cell.meta.id;

                    if (isFocus) {
                        out += inverse + fgRGB(cr, cg, cb) + ch + reset;
                    } else if (hasId) {
                        out += bold + underline + fgRGB(cr, cg, cb) + ch + reset;
                    } else {
                        out += fgRGB(cr, cg, cb) + ch;
                    }
                }
                out += reset;
            }
        }

        return out;
    }
}
