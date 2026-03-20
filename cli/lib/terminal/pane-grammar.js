// Grammar Pane — upper-right
// Shows grammar rules with last-fired highlighting and heat coloring

import { moveTo, reset, dim, bold, fgRGB } from '../ansi.js';
import { serializeRuleWithTypes } from '../../../src/serialize.js';

export class GrammarPane {
    constructor(board) {
        this.board = board;
        this.scrollOffset = 0;
        this.syncToLastFired = true;
        this.lastFiredIndex = -1;
        this.ruleHeat = []; // decaying fire-frequency per rule
        this.cachedLines = [];
        this.needsRebuild = true;
    }

    setBoard(board) {
        this.board = board;
        this.needsRebuild = true;
        this.ruleHeat = [];
        this.lastFiredIndex = -1;
    }

    rebuildLines() {
        this.cachedLines = [];
        if (!this.board.grammar) return;

        const types = this.board.grammar.types;
        const transform = this.board.grammar.transform;
        let ruleIndex = 0;

        for (let t = 0; t < types.length; t++) {
            const rules = transform[t];
            if (!rules || rules.length === 0) continue;

            // Type header
            this.cachedLines.push({ type: 'header', text: types[t], ruleIndex: -1 });

            for (const rule of rules) {
                const text = serializeRuleWithTypes(rule, types);
                this.cachedLines.push({ type: 'rule', text, ruleIndex, rule });
                ruleIndex++;
            }
        }

        // Ensure heat array matches
        while (this.ruleHeat.length < ruleIndex) this.ruleHeat.push(0);

        this.needsRebuild = false;
    }

    // Called from app after each trace event
    updateFromTrace(traceEntry) {
        if (!traceEntry) return;
        // Decay all heat
        for (let i = 0; i < this.ruleHeat.length; i++) {
            this.ruleHeat[i] *= 0.95;
        }

        // Find which rule fired by matching rule text
        const firedText = traceEntry.ruleText;
        if (firedText) {
            for (const line of this.cachedLines) {
                if (line.type === 'rule' && line.text === firedText) {
                    this.lastFiredIndex = line.ruleIndex;
                    if (line.ruleIndex < this.ruleHeat.length) {
                        this.ruleHeat[line.ruleIndex] = Math.min(this.ruleHeat[line.ruleIndex] + 1, 10);
                    }
                    break;
                }
            }
        }
    }

    scrollBy(delta) {
        this.scrollOffset = Math.max(0, Math.min(
            this.cachedLines.length - 1,
            this.scrollOffset + delta
        ));
    }

    toggleSync() {
        this.syncToLastFired = !this.syncToLastFired;
    }

    render(rect) {
        if (this.needsRebuild) this.rebuildLines();

        let out = '';
        const { width, height, row, col } = rect;

        // Auto-scroll to last fired rule
        if (this.syncToLastFired && this.lastFiredIndex >= 0) {
            const lineIdx = this.cachedLines.findIndex(l => l.ruleIndex === this.lastFiredIndex);
            if (lineIdx >= 0) {
                const margin = Math.floor(height / 3);
                if (lineIdx < this.scrollOffset + margin) {
                    this.scrollOffset = Math.max(0, lineIdx - margin);
                } else if (lineIdx > this.scrollOffset + height - margin) {
                    this.scrollOffset = Math.max(0, lineIdx - height + margin);
                }
            }
        }

        for (let r = 0; r < height; r++) {
            out += moveTo(row + r, col);
            const lineIdx = this.scrollOffset + r;

            if (lineIdx >= this.cachedLines.length) {
                continue; // empty line
            }

            const line = this.cachedLines[lineIdx];

            if (line.type === 'header') {
                out += bold + fgRGB(100, 180, 255) + line.text + reset;
                continue;
            }

            // Rule line
            const isLastFired = (line.ruleIndex === this.lastFiredIndex);
            const heat = line.ruleIndex < this.ruleHeat.length ? this.ruleHeat[line.ruleIndex] : 0;
            const isKeyRule = line.rule && (line.rule.key || line.rule.command);

            // Marker
            const marker = isLastFired ? fgRGB(255, 220, 50) + '\u25b6 ' + reset : '  ';

            // Color based on heat
            let color;
            if (isKeyRule) {
                color = fgRGB(80, 200, 200); // cyan for key/command rules
            } else if (heat > 3) {
                color = fgRGB(255, 80, 50); // hot red
            } else if (heat > 1) {
                color = fgRGB(255, 200, 80); // warm yellow
            } else if (heat > 0.1) {
                color = fgRGB(180, 180, 180); // neutral
            } else {
                color = dim; // cold
            }

            const text = line.text.slice(0, width - 3);
            out += marker + color + text + reset;
        }

        return out;
    }
}
