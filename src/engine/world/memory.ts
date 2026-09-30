/**
 * A person's durable memories, read in conversation. History holds what
 * happened; a memory holds what this person carries and cites its source.
 * Rare event memories are append-only. Compression would remove rows from a
 * store whose persistence appends them, and there is no routine-memory producer.
 * Forgetting the mortal dead also removes their memories; no orphan-memory
 * retrieval bypasses that rule.
 */

import type { HistoricalFact } from './history.js';

// ─────────────────────────────────────────────────────────────────────────
// RECORDS
// ─────────────────────────────────────────────────────────────────────────

export type MemoryKind =
    /** A tie formed, changed, or ended. */
    | 'relationship'
    /** Somebody broke faith. */
    | 'betrayal'
    /** Something was sworn. */
    | 'promise'
    /** Something is owed, in either direction. */
    | 'debt'
    /** Something was learned that changed what is possible. */
    | 'discovery'
    /** Something was lost: a person, a technique, a place, a limb. */
    | 'loss'
    /** A world event this person carries the memory of. */
    | 'history'
    /** A faction rose, fell, changed hands, or changed its mind about them. */
    | 'faction_change'
    /** Something they saw. */
    | 'observation'
    /** Something they were told. May be false. */
    | 'rumour'
    /** Day-to-day. */
    | 'routine';

export interface MemoryRecord {
    id: string;
    /** Whose memory this is. An NPC id or a player character id. */
    ownerId: string;
    kind: MemoryKind;
    /** One line. What this person would say if asked. */
    summary: string;
    /** Longer text, when there is more to it. May be empty. */
    detail: string;
    /** Absolute day the remembered thing happened. */
    onDay: number;
    /** Who it involves. */
    actorIds: string[];
    locationId: string | null;
    factionIds: string[];
    /**
     * 0..1. How load-bearing this is for the owner. Retrieval orders on it, but
     * nothing in the world reads it as a mechanical effect - it is a property of
     * the memory, not of the person.
     */
    salience: number;
    tags: string[];
    /** Ledger fact ids this memory is about. May be empty: memory outlives record. */
    sourceFactIds: string[];
    createdOnDay: number;
    updatedOnDay: number;
}

export interface MemoryStore {
    records: MemoryRecord[];
    /** Monotonic. Ids are `m${seq}` so replays compare byte-for-byte. */
    nextSeq: number;
}

export function createMemoryStore(): MemoryStore {
    return { records: [], nextSeq: 1 };
}

export interface MemoryInput {
    ownerId: string;
    kind: MemoryKind;
    summary: string;
    onDay: number;
    detail?: string;
    actorIds?: string[];
    locationId?: string | null;
    factionIds?: string[];
    salience?: number;
    tags?: string[];
    sourceFactIds?: string[];
}

/**
 * Store a memory.
 *
 * Mutates the store in place, like the ledger and for the same reason: a long
 * run writes a great many of these and copy-on-write shows up in a profile.
 * The store is owned by the world state and is never shared.
 */
export function storeMemory(store: MemoryStore, input: MemoryInput): MemoryRecord {
    const record: MemoryRecord = {
        id: `m${store.nextSeq}`,
        ownerId: input.ownerId,
        kind: input.kind,
        summary: input.summary,
        detail: input.detail ?? '',
        onDay: input.onDay,
        actorIds: input.actorIds ?? [],
        locationId: input.locationId ?? null,
        factionIds: input.factionIds ?? [],
        salience: clamp01(input.salience ?? defaultSalience(input.kind)),
        tags: input.tags ?? [],
        sourceFactIds: input.sourceFactIds ?? [],
        createdOnDay: input.onDay,
        updatedOnDay: input.onDay
    };
    store.nextSeq++;
    store.records.push(record);
    return record;
}

/**
 * Store a memory of a world fact.
 *
 * The bridge between ground truth and what somebody carries. The memory keeps
 * its own summary - it is what this person would say, not what the ledger says
 * - and cites the fact so the two can be compared later, including when they
 * have come to disagree.
 */
export function rememberFact(
    store: MemoryStore,
    ownerId: string,
    fact: HistoricalFact,
    opts: { kind?: MemoryKind; summary?: string; salience?: number; tags?: string[] } = {}
): MemoryRecord {
    return storeMemory(store, {
        ownerId,
        kind: opts.kind ?? 'history',
        summary: opts.summary ?? fact.summary,
        onDay: fact.day,
        actorIds: fact.actors.map(a => a.id),
        locationId: fact.locationId,
        factionIds: fact.factionIds,
        salience: opts.salience ?? Math.max(0.3, fact.magnitude),
        tags: opts.tags ?? [fact.kind],
        sourceFactIds: [fact.id]
    });
}

function defaultSalience(kind: MemoryKind): number {
    switch (kind) {
        case 'betrayal':
        case 'promise':
        case 'debt':
            return 0.9;
        case 'loss':
        case 'discovery':
            return 0.8;
        case 'relationship':
        case 'faction_change':
            return 0.7;
        case 'history':
            return 0.6;
        case 'observation':
            return 0.3;
        case 'rumour':
            return 0.25;
        case 'routine':
            return 0.1;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────

export interface MemoryQuery {
    ownerId?: string;
    kinds?: readonly MemoryKind[];
    /** Any of these people involved. */
    actorIds?: readonly string[];
    locationId?: string;
    factionId?: string;
    /** All of these tags present. */
    tags?: readonly string[];
    /** Case-insensitive substring over summary and detail. */
    text?: string;
    fromDay?: number;
    toDay?: number;
    minSalience?: number;
    limit?: number;
    /** 'salience' (default) or 'recent'. */
    order?: 'salience' | 'recent' | 'chronological';
}

/**
 * Search memories.
 *
 * Ordering is total and deterministic - the tiebreak runs down to the record id
 * - so the same query on the same store returns the same list in the same order
 * every time, which matters when the result is going into a prompt.
 */
export function searchMemories(store: MemoryStore, q: MemoryQuery = {}): MemoryRecord[] {
    const kinds = q.kinds ? new Set(q.kinds) : null;
    const actors = q.actorIds ? new Set(q.actorIds) : null;
    const text = q.text?.toLowerCase();

    const rows = store.records.filter(m => {
        if (q.ownerId && m.ownerId !== q.ownerId) return false;
        if (kinds && !kinds.has(m.kind)) return false;
        if (actors && !m.actorIds.some(a => actors.has(a))) return false;
        if (q.locationId && m.locationId !== q.locationId) return false;
        if (q.factionId && !m.factionIds.includes(q.factionId)) return false;
        if (q.tags && !q.tags.every(t => m.tags.includes(t))) return false;
        if (q.fromDay !== undefined && m.onDay < q.fromDay) return false;
        if (q.toDay !== undefined && m.onDay >= q.toDay) return false;
        if (q.minSalience !== undefined && m.salience < q.minSalience) return false;
        if (text && !(m.summary.toLowerCase().includes(text) || m.detail.toLowerCase().includes(text))) {
            return false;
        }
        return true;
    });

    const order = q.order ?? 'salience';
    rows.sort((a, b) => {
        if (order === 'chronological') return a.onDay - b.onDay || seq(a.id) - seq(b.id);
        if (order === 'recent') return b.onDay - a.onDay || seq(b.id) - seq(a.id);
        return b.salience - a.salience || b.onDay - a.onDay || seq(a.id) - seq(b.id);
    });

    return q.limit != null ? rows.slice(0, q.limit) : rows;
}

/**
 * What this person would bring to mind about somebody else.
 *
 * The retrieval a conversation actually needs: everything involving the other
 * party, strongest first, capped. Betrayals and debts come out on top because
 * their default salience is high, which is the correct behaviour for a
 * cultivator who has been waiting forty years to say something.
 */
export function recallAbout(
    store: MemoryStore,
    ownerId: string,
    subjectId: string,
    limit = 8
): MemoryRecord[] {
    return searchMemories(store, { ownerId, actorIds: [subjectId], limit });
}

function seq(id: string): number {
    const n = Number(id.slice(1));
    return Number.isFinite(n) ? n : 0;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
