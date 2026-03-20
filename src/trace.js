class TraceBuffer {
    constructor(capacity = 2000) {
        this.capacity = capacity;
        this.entries = new Array(capacity);
        this.head = 0;
        this.count = 0;
    }

    push(entry) {
        entry.seq = this.count++;
        this.entries[this.head] = entry;
        this.head = (this.head + 1) % this.capacity;
    }

    get length() {
        return Math.min(this.count, this.capacity);
    }

    toArray() {
        const len = this.length;
        if (len === 0) return [];
        if (this.count <= this.capacity)
            return this.entries.slice(0, len);
        return this.entries.slice(this.head).concat(this.entries.slice(0, this.head));
    }

    clear() {
        this.head = 0;
        this.count = 0;
    }

    toJSON() {
        return { capacity: this.capacity, entries: this.toArray() };
    }
}

export { TraceBuffer };
