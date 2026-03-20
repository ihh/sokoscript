class TraceBuffer {
    constructor(capacity = 2000, snapshotInterval = 200) {
        this.capacity = capacity;
        this.snapshotInterval = snapshotInterval;
        this.entries = new Array(capacity);
        this.head = 0;
        this.count = 0;
        this.eventsSinceSnapshot = 0;
    }

    push(entry) {
        entry.seq = this.count++;
        this.entries[this.head] = entry;
        this.head = (this.head + 1) % this.capacity;
        if (entry.type !== 'init' && entry.type !== 'snapshot') {
            this.eventsSinceSnapshot++;
        }
    }

    needsSnapshot() {
        return this.eventsSinceSnapshot >= this.snapshotInterval;
    }

    pushSnapshot(boardJSON) {
        this.push({ type: 'snapshot', boardJSON });
        this.eventsSinceSnapshot = 0;
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

    // Find the most recent snapshot at or before `stepsBack` events from the end.
    // Returns { snapshot, replayEntries } where replayEntries are events after
    // the snapshot that need to be replayed to reach the target point.
    findUndoPoint(stepsBack) {
        const all = this.toArray();
        if (all.length === 0) return null;

        // Target index: stepsBack events before the end
        // Count only non-snapshot/non-init events
        let eventCount = 0;
        let targetIdx = all.length;
        for (let i = all.length - 1; i >= 0; i--) {
            if (all[i].type !== 'snapshot' && all[i].type !== 'init') {
                eventCount++;
                if (eventCount >= stepsBack) {
                    targetIdx = i;
                    break;
                }
            }
        }

        // Find the most recent snapshot before targetIdx
        for (let i = targetIdx - 1; i >= 0; i--) {
            if (all[i].type === 'snapshot' || all[i].type === 'init') {
                const replayEntries = all.slice(i + 1, targetIdx);
                return {
                    snapshot: all[i],
                    replayEntries,
                    truncateAt: targetIdx
                };
            }
        }

        return null; // no snapshot found
    }

    // Truncate trace to `count` entries (used after undo to discard future)
    truncateTo(keepCount) {
        const all = this.toArray();
        const kept = all.slice(0, keepCount);
        this.entries = new Array(this.capacity);
        this.head = 0;
        this.count = 0;
        for (const entry of kept) {
            this.push(entry);
        }
    }

    clear() {
        this.head = 0;
        this.count = 0;
        this.eventsSinceSnapshot = 0;
    }

    toJSON() {
        return { capacity: this.capacity, entries: this.toArray() };
    }
}

export { TraceBuffer };
