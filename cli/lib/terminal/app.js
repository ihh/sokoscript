// Main Terminal App — orchestrates three panes, input, simulation

import { clear, hideCursor, showCursor, altScreen, mainScreen, moveTo, reset, dim, bold, fgRGB, inverse, ESC } from '../ansi.js';
import { Layout } from './layout.js';
import { MapPane } from './pane-map.js';
import { GrammarPane } from './pane-grammar.js';
import { CommandPane } from './pane-command.js';
import { CommandExecutor } from './commands.js';
import { parseKey } from './input.js';
import { matchLhs } from '../../../src/engine.js';

const PANES = ['map', 'grammar', 'command'];

export class TerminalApp {
    constructor(board, opts = {}) {
        this.board = board;
        this.playerId = opts.playerId || 'Player';
        this.initialBoardJSON = board.toJSON();

        this.layout = new Layout();

        this.mapPane = new MapPane(board);
        this.grammarPane = new GrammarPane(board);
        this.commandPane = new CommandPane();

        this.executor = new CommandExecutor(this);
        this.commandPane.onCommand = (cmd) => this.executor.execute(cmd);

        this.activePane = 'command';

        this.running = false;
        this.speed = 1;
        this.totalEvents = 0;

        this.lastRender = 0;
        this.minRenderInterval = 66; // ~15fps
        this.needsRender = true;
        this.quit = false;

        // Center on player if present
        this.mapPane.centerOnPlayer(this.playerId);

        // Player key bindings from grammar
        this.playerKeys = new Set();
        this.rebuildPlayerKeys();
    }

    rebuildPlayerKeys() {
        this.playerKeys.clear();
        if (!this.board.grammar || !this.board.grammar.key) return;
        // Collect all key bindings across all types
        for (const typeKeys of this.board.grammar.key) {
            if (typeKeys) {
                for (const k of Object.keys(typeKeys)) {
                    this.playerKeys.add(k);
                }
            }
        }
    }

    start() {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf-8');
        process.stdout.write(altScreen + hideCursor + clear());

        process.stdin.on('data', (data) => this.handleInput(data));
        process.stdout.on('resize', () => {
            this.layout.recalculate();
            this.needsRender = true;
        });

        this.commandPane.print('SokoScript debugger. Type "help" for commands.');
        this.commandPane.print(`Board: ${this.board.size}x${this.board.size}, ${this.board.grammar.types.length} types`);

        this.render();
        this.tick();
    }

    stop() {
        this.running = false;
        this.quit = true;
        process.stdout.write(showCursor + mainScreen);
        process.stdin.setRawMode(false);
        process.stdin.pause();
    }

    resetBoard() {
        this.board.initFromJSON(this.initialBoardJSON);
        this.mapPane.setBoard(this.board);
        this.grammarPane.setBoard(this.board);
        this.totalEvents = 0;
        this.running = false;
        this.rebuildPlayerKeys();
    }

    stepOnce() {
        const ticksPerStep = BigInt(1) << BigInt(20); // ~1/4096 second
        const targetTime = this.board.time + ticksPerStep;
        this.board.evolveToTime(targetTime, true);

        // Update grammar pane with latest trace
        const entries = this.board.trace.toArray();
        if (entries.length > 0) {
            const last = entries[entries.length - 1];
            if (last.type !== 'init') {
                this.grammarPane.updateFromTrace(last);
                this.totalEvents++;
            }
        }
    }

    handleInput(data) {
        const key = parseKey(data);

        if (key.name === 'ctrl-c') {
            this.stop();
            process.exit(0);
            return;
        }

        if (key.name === 'tab') {
            const idx = PANES.indexOf(this.activePane);
            this.activePane = PANES[(idx + 1) % PANES.length];
            this.needsRender = true;
            return;
        }

        if (key.name === 'shift-tab') {
            const idx = PANES.indexOf(this.activePane);
            this.activePane = PANES[(idx - 1 + PANES.length) % PANES.length];
            this.needsRender = true;
            return;
        }

        switch (this.activePane) {
            case 'map':
                this.handleMapInput(key, data);
                break;
            case 'grammar':
                this.handleGrammarInput(key);
                break;
            case 'command':
                this.handleCommandInput(key, data);
                break;
        }

        this.needsRender = true;
    }

    handleMapInput(key, rawData) {
        if (key.name === 'arrow') {
            const step = key.shift ? 8 : 1;
            const dx = key.dir === 'right' ? step : key.dir === 'left' ? -step : 0;
            const dy = key.dir === 'down' ? step : key.dir === 'up' ? -step : 0;
            this.mapPane.moveFocus(dx, dy);
            return;
        }

        if (key.name === 'home') {
            this.mapPane.centerOnPlayer(this.playerId);
            return;
        }

        if (key.name === 'char') {
            switch (key.char) {
                case ' ':
                    this.running = !this.running;
                    return;
                case 'n':
                    this.stepOnce();
                    return;
                case 'z':
                    this.mapPane.zoom = !this.mapPane.zoom;
                    return;
            }

            // Player key forwarding
            if (this.playerKeys.has(key.char) && this.playerId in this.board.byID) {
                // Find a direction that works for this key
                const dirs = ['N', 'E', 'S', 'W'];
                const index = this.board.byID[this.playerId];
                const [x, y] = this.board.index2xy(index);
                const cell = this.board.cell[index];
                const rules = this.board.grammar.key[cell.type]?.[key.char];
                if (rules) {
                    for (const dir of dirs) {
                        for (const rule of rules) {
                            const matcher = matchLhs(this.board, x, y, dir, rule);
                            if (!matcher.failed) {
                                this.board.processMove({
                                    type: 'command', time: this.board.time + 1n,
                                    id: this.playerId, dir, key: key.char
                                });
                                this.mapPane.centerOnPlayer(this.playerId);
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

    handleGrammarInput(key) {
        if (key.name === 'arrow') {
            if (key.dir === 'up') this.grammarPane.scrollBy(-1);
            if (key.dir === 'down') this.grammarPane.scrollBy(1);
            return;
        }

        if (key.name === 'pageup') { this.grammarPane.scrollBy(-10); return; }
        if (key.name === 'pagedown') { this.grammarPane.scrollBy(10); return; }

        if (key.name === 'char') {
            switch (key.char) {
                case 'd':
                    this.grammarPane.toggleSync();
                    return;
                case ' ':
                    this.running = !this.running;
                    return;
                case 'n':
                    this.stepOnce();
                    return;
            }
        }
    }

    handleCommandInput(key, rawData) {
        this.commandPane.handleKey(rawData);
    }

    tick() {
        if (this.quit) return;

        if (this.running) {
            for (let i = 0; i < this.speed; i++) {
                this.stepOnce();
            }
            this.needsRender = true;
        }

        const now = Date.now();
        if (this.needsRender && (now - this.lastRender >= this.minRenderInterval)) {
            this.render();
            this.lastRender = now;
            this.needsRender = false;
        }

        setImmediate(() => this.tick());
    }

    render() {
        this.layout.recalculate();
        let out = moveTo(1, 1);

        // Clear all lines
        for (let r = 1; r <= this.layout.termH; r++) {
            out += moveTo(r, 1) + ESC + '2K';
        }

        out += this.mapPane.render(this.layout.map);
        out += this.grammarPane.render(this.layout.grammar);
        out += this.commandPane.render(this.layout.command, this.activePane === 'command');
        out += this.layout.renderDividers(this.activePane);
        out += this.renderStatusBar();

        process.stdout.write(out);
    }

    renderStatusBar() {
        let out = '';
        const row = this.layout.hDivRow;

        const x = this.mapPane.focusX;
        const y = this.mapPane.focusY;
        const cellDesc = this.board.getCellDescriptorString(x, y);

        const status = this.running
            ? fgRGB(0, 255, 0) + bold + 'RUN' + reset
            : dim + 'PAU' + reset;

        const t = (Number(this.board.time) / 2**32).toFixed(2);

        // Position status after the pane labels
        const col = Math.max(20, this.layout.leftW - 10);
        const statusText = ` ${status} `
            + `${dim}cell:${reset}(${x},${y}) ${cellDesc} `
            + `${dim}t:${reset}${t}s `
            + `${dim}ev:${reset}${this.totalEvents} `
            + `${dim}spd:${reset}${this.speed}x `;

        out += moveTo(row, col) + statusText;
        return out;
    }
}
