// Command Pane — bottom, full width
// CLI input with command history and output scrollback

import { moveTo, reset, dim, bold, fgRGB, inverse } from '../ansi.js';

export class CommandPane {
    constructor() {
        this.inputBuffer = '';
        this.cursorPos = 0;
        this.history = [];
        this.historyIndex = -1;
        this.outputLines = [];
        this.maxOutput = 200;
        this.onCommand = null;
    }

    print(text) {
        const lines = text.split('\n');
        for (const line of lines) {
            this.outputLines.push(line);
        }
        while (this.outputLines.length > this.maxOutput) {
            this.outputLines.shift();
        }
    }

    handleKey(rawData) {
        if (rawData === '\r' || rawData === '\n') {
            const cmd = this.inputBuffer.trim();
            if (cmd) {
                this.history.push(cmd);
                this.print(`> ${cmd}`);
                if (this.onCommand) {
                    try {
                        const result = this.onCommand(cmd);
                        if (result) this.print(result);
                    } catch (e) {
                        this.print(`Error: ${e.message}`);
                    }
                }
            }
            this.inputBuffer = '';
            this.cursorPos = 0;
            this.historyIndex = -1;
            return;
        }

        if (rawData === '\x7f' || rawData === '\b') {
            if (this.cursorPos > 0) {
                this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos - 1) + this.inputBuffer.slice(this.cursorPos);
                this.cursorPos--;
            }
            return;
        }

        if (rawData === '\x1b[A') {
            if (this.history.length > 0) {
                if (this.historyIndex < 0) this.historyIndex = this.history.length;
                this.historyIndex = Math.max(0, this.historyIndex - 1);
                this.inputBuffer = this.history[this.historyIndex];
                this.cursorPos = this.inputBuffer.length;
            }
            return;
        }

        if (rawData === '\x1b[B') {
            if (this.historyIndex >= 0) {
                this.historyIndex++;
                if (this.historyIndex >= this.history.length) {
                    this.historyIndex = -1;
                    this.inputBuffer = '';
                } else {
                    this.inputBuffer = this.history[this.historyIndex];
                }
                this.cursorPos = this.inputBuffer.length;
            }
            return;
        }

        if (rawData === '\x1b[D') { this.cursorPos = Math.max(0, this.cursorPos - 1); return; }
        if (rawData === '\x1b[C') { this.cursorPos = Math.min(this.inputBuffer.length, this.cursorPos + 1); return; }
        if (rawData === '\x01') { this.cursorPos = 0; return; } // Ctrl-A
        if (rawData === '\x05') { this.cursorPos = this.inputBuffer.length; return; } // Ctrl-E
        if (rawData === '\x0b') { this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos); return; } // Ctrl-K
        if (rawData === '\x15') { this.inputBuffer = ''; this.cursorPos = 0; return; } // Ctrl-U

        // Regular character
        if (rawData.length === 1 && rawData >= ' ') {
            this.inputBuffer = this.inputBuffer.slice(0, this.cursorPos) + rawData + this.inputBuffer.slice(this.cursorPos);
            this.cursorPos++;
        }
    }

    render(rect, hasFocus) {
        let out = '';

        const outputRows = rect.height - 1;
        const startLine = Math.max(0, this.outputLines.length - outputRows);

        for (let i = 0; i < outputRows; i++) {
            out += moveTo(rect.row + i, rect.col);
            const lineIdx = startLine + i;
            if (lineIdx < this.outputLines.length) {
                const line = this.outputLines[lineIdx];
                out += dim + line.slice(0, rect.width) + reset;
            }
        }

        // Input line
        const inputRow = rect.row + rect.height - 1;
        out += moveTo(inputRow, rect.col);
        const prompt = hasFocus ? fgRGB(100, 255, 100) + '> ' + reset : dim + '> ' + reset;
        const input = this.inputBuffer.slice(0, rect.width - 3);
        out += prompt + input;

        // Cursor
        if (hasFocus) {
            const curCol = rect.col + 2 + this.cursorPos;
            if (curCol < rect.col + rect.width) {
                const ch = this.cursorPos < this.inputBuffer.length ? this.inputBuffer[this.cursorPos] : ' ';
                out += moveTo(inputRow, curCol) + inverse + ch + reset;
            }
        }

        return out;
    }
}
