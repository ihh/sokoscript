// Command parser and executor for the SokoScript debugger

import { serializeRuleWithTypes } from '../../../src/serialize.js';
import { readFileSync, writeFileSync } from 'fs';

export class CommandExecutor {
    constructor(app) {
        this.app = app;
    }

    execute(input) {
        const parts = input.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'r': case 'run':
                return this.run();
            case 'p': case 'pause':
                return this.pause();
            case 's': case 'step':
                return this.step(args);
            case 'speed':
                return this.speed(args);
            case 'reset':
                return this.reset();
            case 'goto':
                return this.goto(args);
            case 'center':
                return this.center();
            case 'player':
                return this.player();
            case 'cell':
                return this.cell(args);
            case 'neighbors': case 'nbrs':
                return this.neighbors(args);
            case 'trace':
                return this.trace(args);
            case 'set':
                return this.set(args);
            case 'setid':
                return this.setid(args);
            case 'clear':
                return this.clearCell(args);
            case 'grammar':
                return this.grammar();
            case 'save':
                return this.save(args);
            case 'load':
                return this.load(args);
            case 'zoom': case 'z':
                return this.zoom();
            case 'help': case '?':
                return this.help(args);
            default:
                return `Unknown command: ${cmd}. Type "help" for commands.`;
        }
    }

    run() {
        this.app.running = true;
        return 'Running.';
    }

    pause() {
        this.app.running = false;
        return 'Paused.';
    }

    step(args) {
        const n = parseInt(args[0]) || 1;
        this.app.running = false;
        for (let i = 0; i < n; i++) {
            this.app.stepOnce();
        }
        return `Stepped ${n} event(s).`;
    }

    speed(args) {
        const n = parseInt(args[0]);
        if (!n || n < 1 || n > 512) return 'Usage: speed N (1-512)';
        this.app.speed = n;
        return `Speed set to ${n}.`;
    }

    reset() {
        this.app.resetBoard();
        return 'Board reset.';
    }

    goto(args) {
        const coords = args.join(',').split(',').map(Number);
        if (coords.length < 2 || coords.some(isNaN)) return 'Usage: goto X,Y';
        this.app.mapPane.focusX = ((coords[0] % this.app.board.size) + this.app.board.size) % this.app.board.size;
        this.app.mapPane.focusY = ((coords[1] % this.app.board.size) + this.app.board.size) % this.app.board.size;
        return `Focus: (${this.app.mapPane.focusX}, ${this.app.mapPane.focusY})`;
    }

    center() {
        // Already centered by default
        return `Focus: (${this.app.mapPane.focusX}, ${this.app.mapPane.focusY})`;
    }

    player() {
        const id = this.app.playerId;
        if (!(id in this.app.board.byID)) return 'No player on board.';
        this.app.mapPane.centerOnPlayer(id);
        return `Centered on ${id} at (${this.app.mapPane.focusX}, ${this.app.mapPane.focusY})`;
    }

    cell(args) {
        let x, y;
        if (args.length >= 1) {
            const coords = args.join(',').split(',').map(Number);
            if (coords.length < 2 || coords.some(isNaN)) return 'Usage: cell [X,Y]';
            [x, y] = coords;
        } else {
            x = this.app.mapPane.focusX;
            y = this.app.mapPane.focusY;
        }
        return this.app.board.getCellDescriptorStringWithCoords(x, y);
    }

    neighbors(args) {
        let x, y;
        if (args.length >= 1) {
            const coords = args.join(',').split(',').map(Number);
            if (coords.length < 2 || coords.some(isNaN)) return 'Usage: neighbors [X,Y]';
            [x, y] = coords;
        } else {
            x = this.app.mapPane.focusX;
            y = this.app.mapPane.focusY;
        }
        const dirs = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];
        let out = `(${x},${y}) ${this.app.board.getCellDescriptorString(x, y)}\n`;
        for (const [name, dx, dy] of dirs) {
            const nx = ((x + dx) % this.app.board.size + this.app.board.size) % this.app.board.size;
            const ny = ((y + dy) % this.app.board.size + this.app.board.size) % this.app.board.size;
            out += `  ${name}: ${this.app.board.getCellDescriptorStringWithCoords(nx, ny)}\n`;
        }
        return out.trimEnd();
    }

    trace(args) {
        const n = parseInt(args[0]) || 20;
        const entries = this.app.board.trace.toArray().slice(-n);
        if (entries.length === 0) return 'No trace entries.';
        return entries.map(e => {
            if (e.type === 'init') return `[${e.seq}] INIT t=${e.time}`;
            const before = e.before.map(c => `${c.type}${c.state ? '/' + c.state : ''}`).join(' ');
            const after = e.after.map(c => `${c.type}${c.state ? '/' + c.state : ''}`).join(' ');
            return `[${e.seq}] ${e.type} (${e.x},${e.y}) ${e.ruleText}  [${before} -> ${after}]`;
        }).join('\n');
    }

    set(args) {
        if (args.length < 1) return 'Usage: set TYPE [STATE]';
        const type = args[0];
        const state = args[1] || '';
        const x = this.app.mapPane.focusX;
        const y = this.app.mapPane.focusY;
        this.app.board.setCellTypeByName(x, y, type, state);
        return `(${x},${y}) set to ${type}${state ? '/' + state : ''}`;
    }

    setid(args) {
        if (args.length < 1) return 'Usage: setid ID';
        const id = args[0];
        const x = this.app.mapPane.focusX;
        const y = this.app.mapPane.focusY;
        const cell = this.app.board.getCell(x, y);
        cell.meta = { ...cell.meta || {}, id };
        this.app.board.byID[id] = this.app.board.xy2index(x, y);
        return `(${x},${y}) ID set to ${id}`;
    }

    clearCell(args) {
        let x, y;
        if (args.length >= 1) {
            const coords = args.join(',').split(',').map(Number);
            if (coords.length >= 2 && !coords.some(isNaN)) [x, y] = coords;
        }
        if (typeof x === 'undefined') {
            x = this.app.mapPane.focusX;
            y = this.app.mapPane.focusY;
        }
        this.app.board.setCellTypeByName(x, y, '_');
        return `(${x},${y}) cleared.`;
    }

    grammar() {
        return this.app.board.grammarSource || '(no grammar loaded)';
    }

    save(args) {
        if (args.length < 1) return 'Usage: save FILENAME';
        const json = JSON.stringify(this.app.board.toJSON(), null, 2);
        writeFileSync(args[0], json);
        return `Saved to ${args[0]}`;
    }

    load(args) {
        if (args.length < 1) return 'Usage: load FILENAME';
        const json = JSON.parse(readFileSync(args[0], 'utf-8'));
        this.app.board.initFromJSON(json);
        this.app.grammarPane.setBoard(this.app.board);
        this.app.mapPane.setBoard(this.app.board);
        return `Loaded ${args[0]}`;
    }

    zoom() {
        this.app.mapPane.zoom = !this.app.mapPane.zoom;
        return `Zoom: ${this.app.mapPane.zoom ? 'full board' : 'local'}`;
    }

    help() {
        return [
            'Simulation:  run, pause, step [N], speed N, reset',
            'Navigation:  goto X,Y  center  player  zoom',
            'Inspection:  cell [X,Y]  neighbors [X,Y]  trace [N]',
            'Editing:     set TYPE [STATE]  setid ID  clear [X,Y]',
            'Grammar:     grammar',
            'Files:       save FILE  load FILE',
            'Keys:        Tab=focus  Space=run/pause  n=step  z=zoom',
            '             Arrows=move  Shift+Arrows=move fast  Home=player',
            '             WASD=player controls (in map pane)',
        ].join('\n');
    }
}
