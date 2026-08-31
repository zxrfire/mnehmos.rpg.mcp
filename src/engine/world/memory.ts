/**
 * Durable memory: storage, retrieval, and the write path for compression.
 *
 * A memory is what a particular person is carrying. It is not the world's
 * record - that is `history.ts`, and it is ground truth. A memory can be wrong,
 * can outlive every other trace of the thing it is about, and can contradict
 * what everyone else believes. All three of those are correct and none of them
 * need reconciling, because they are answers to different questions:
 *
 *   what happened            history.ts, ground truth
 *   what can be recovered    history.ts, `fidelity`
 *   what a person carries    here
 *   what a person believes   the social layer's `knowledge.ts`
 *
 * The player remembers a mountain. Someone born later says there has never been
 * a mountain. The mountain's destruction is a fact with `fidelity: 'lost'`, the
 * player's memory of it is a record in this store, and the younger character's
 * belief is in the belief layer. Occasionally the player is the only remaining
 * witness to something, and that is a form of knowledge worth having.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * COMPRESSION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A long-lived character accumulates thousands of events. Almost all of it is
 * trivia. What has to survive is: relationships, betrayals, promises, debts,
 * major discoveries, major losses, important history, and faction changes.
 *
 * The compression itself is the LLM's job - deciding that nine years of
 * bickering with a fellow disciple amounts to "Wei Rongshan has never forgiven
 * him for the Cold Kiln assessment" is exactly the kind of judgement a
 * deterministic rule set is bad at. What this module provides is the three
 * things around it:
 *
 *   1. `planCompression` - the engine picks WHICH records are eligible, holds
 *      back the protected kinds, and states how many survivors it wants. The
 *      LLM never gets to choose to discard a debt.
 *   2. the write path - `applyCompression` validates that every new record
 *      cites sources from the plan, refuses ones that do not, and swaps the
 *      consumed records out atomically.
 *   3. the guard - a protected-kind record that the LLM failed to carry
 *      forward is KEPT rather than dropped. Losing a promise because a
 *      summariser was terse is not an acceptable failure mode.
 */

import type { HistoryLedger, HistoricalFact } from './history.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// RECORDS
// ─────────────────────────────────────────────────────────────────────────

export type MemoryKind =
    /** A tie formed, changed, or ended. */
    | 'relationship'
    /** Somebody broke faith. Survives everything. */
    | 'betrayal'
    /** Something was sworn. Survives everything. */
    | 'promise'
    /** Something is owed, in either direction. Survives everything. */
    | 'debt'
    /** Something was learned that changed what is possible. */
    | 'discovery'
    /** Something was lost: a person, a technique, a place, a limb. */
    | 'loss'
    /** A world event this person carries the memory of. */
    | 'history'
    /** A faction rose, fell, changed hands, or changed its mind about them. */
    | 'faction_change'
    /** Something they saw. Compressible. */
    | 'observation'
    /** Something they were told. May be false. Compressible. */
    | 'rumour'
    /** Day-to-day. Compressible, and usually the first thing to go. */
    | 'routine';

/**
 * Kinds that compression must never silently discard.
 *
 * These are the charter's list, and they are enforced rather than requested:
 * `planCompression` will not offer them as candidates, and `applyCompression`
 * keeps any that a compressed record failed to absorb.
 */
export const PROTECTED_MEMORY_KINDS: readonly MemoryKind[] = [
    'relationship', 'betrayal', 'promise', 'debt', 'discovery', 'loss', 'history', 'faction_change'
] as const;

const PROTECTED = new Set<MemoryKind>(PROTECTED_MEMORY_KINDS);

export function isProtectedKind(kind: MemoryKind): boolean {
    return PROTECTED.has(kind);
}

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
     * 0..1. How load-bearing this is for the owner. Compression sorts on it,
     * and retrieval orders on it, but nothing in the world reads it as a
     * mechanical effect - it is a property of the memory, not of the person.
     */
    salience: number;
    tags: string[];
    /** Ledger fact ids this memory is about. May be empty: memory outlives record. */
    sourceFactIds: string[];
    /** Ids of the memories this one replaced. Empty for original memories. */
    compressedFromIds: string[];
    /** True when this record is the product of a compression pass. */
    compressed: boolean;
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
        compressedFromIds: [],
        compressed: false,
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
    /** Include records that a compression pass has consumed. Default false. */
    includeConsumed?: boolean;
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

export function memoriesOf(store: MemoryStore, ownerId: string): MemoryRecord[] {
    return searchMemories(store, { ownerId, order: 'chronological' });
}

export function getMemory(store: MemoryStore, id: string): MemoryRecord | null {
    return store.records.find(m => m.id === id) ?? null;
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

/**
 * What the owner still carries about a place, including things the world's
 * record no longer supports.
 */
export function recallLocation(
    store: MemoryStore,
    ownerId: string,
    locationId: string,
    limit = 8
): MemoryRecord[] {
    return searchMemories(store, { ownerId, locationId, limit });
}

/**
 * Memories whose backing fact has gone, or that never had one.
 *
 * These are the ones where lived memory and the world's record have diverged:
 * the owner is the last witness, and nothing outside their head agrees. The
 * query exists because that divergence is a designed feature and needs to be
 * findable rather than merely possible.
 */
export function unsupportedMemories(
    store: MemoryStore,
    ledger: HistoryLedger,
    ownerId?: string
): MemoryRecord[] {
    const known = new Set<string>();
    for (const f of ledger.facts) {
        if (f.fidelity !== 'lost') known.add(f.id);
    }
    return store.records.filter(
        m =>
            (!ownerId || m.ownerId === ownerId) &&
            (m.sourceFactIds.length === 0 || !m.sourceFactIds.some(id => known.has(id)))
    );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPRESSION
// ─────────────────────────────────────────────────────────────────────────

/** Records per owner above which a compression pass is worth running. */
export const COMPRESSION_THRESHOLD = 40;
/** Survivors a compression pass should aim for. The charter's five to ten. */
export const COMPRESSION_TARGET_MIN = 5;
export const COMPRESSION_TARGET_MAX = 10;

export interface CompressionOptions {
    /** Only compress memories older than this many days. Default one year. */
    olderThanDays?: number;
    /** Records above which the pass triggers. */
    threshold?: number;
    /** How many survivors to ask for. */
    targetCount?: number;
    /** Compress despite the owner being under the threshold. */
    force?: boolean;
    /** Absolute day the pass is being run on. */
    onDay: number;
}

export interface CompressionPlan {
    ownerId: string;
    /** Whether a pass is warranted at all. */
    needed: boolean;
    /**
     * Records the LLM must fold together. Only these may be cited as sources,
     * and only these will be removed.
     */
    candidates: MemoryRecord[];
    /**
     * Records held back from the pass entirely: protected kinds, and anything
     * too recent. They survive untouched.
     */
    retained: MemoryRecord[];
    /** How many compressed records to produce. */
    targetCount: number;
    /**
     * The instruction handed to the LLM alongside the candidates. Stated here
     * rather than at the call site so every compression pass in the system asks
     * for the same thing.
     */
    instructions: string;
}

/**
 * Decide what a compression pass may touch.
 *
 * The engine holds back everything the charter says must survive - relationships,
 * betrayals, promises, debts, discoveries, losses, important history, faction
 * changes - plus anything recent enough that its significance is not yet
 * settled. What is left is observation, rumour and routine, which is the trivia
 * the pass exists to collapse.
 */
export function planCompression(
    store: MemoryStore,
    ownerId: string,
    opts: CompressionOptions
): CompressionPlan {
    const olderThan = opts.olderThanDays ?? DAYS_PER_YEAR;
    const threshold = opts.threshold ?? COMPRESSION_THRESHOLD;
    const targetCount = clampInt(
        opts.targetCount ?? COMPRESSION_TARGET_MAX,
        COMPRESSION_TARGET_MIN,
        COMPRESSION_TARGET_MAX
    );
    const cutoff = opts.onDay - olderThan;

    const owned = store.records.filter(m => m.ownerId === ownerId);
    const candidates: MemoryRecord[] = [];
    const retained: MemoryRecord[] = [];
    for (const m of owned) {
        if (isProtectedKind(m.kind) || m.onDay > cutoff) retained.push(m);
        else candidates.push(m);
    }

    // Oldest and least salient first: the pass should be eating the bottom of
    // the pile, not the most recent thing that happened.
    candidates.sort((a, b) => a.salience - b.salience || a.onDay - b.onDay || seq(a.id) - seq(b.id));
    retained.sort((a, b) => a.onDay - b.onDay || seq(a.id) - seq(b.id));

    const needed = (opts.force ?? false) || (owned.length >= threshold && candidates.length > targetCount);

    return {
        ownerId,
        needed,
        candidates,
        retained,
        targetCount,
        instructions:
            `Fold these ${candidates.length} memories into at most ${targetCount} durable memories ` +
            `for ${ownerId}. Preserve anything that establishes a relationship, a betrayal, a promise, ` +
            `a debt, a major discovery, a major loss, important history, or a change in a faction. ` +
            `Discard trivia. Each memory you produce must cite, in compressedFromIds, the ids of the ` +
            `memories it absorbs; ids not listed here will be rejected. Write each summary as what this ` +
            `person would say, not as a chronicle entry.`
    };
}

export interface CompressedMemoryInput {
    kind: MemoryKind;
    summary: string;
    detail?: string;
    /** Ids of the candidate memories this record absorbs. Must be non-empty. */
    compressedFromIds: string[];
    salience?: number;
    tags?: string[];
}

export interface CompressionResult {
    ownerId: string;
    addedIds: string[];
    removedIds: string[];
    /** Inputs the write path refused, with the reason. */
    rejected: { input: CompressedMemoryInput; reason: string }[];
    /**
     * Candidates the LLM did not absorb. They are kept, not dropped - a
     * compression pass may summarise, and may not delete by omission.
     */
    keptUnabsorbedIds: string[];
}

/**
 * The write path.
 *
 * Validates every compressed record against the plan, writes the survivors,
 * and removes exactly the candidates that were actually absorbed. Three rules,
 * all of them there because the alternative loses data:
 *
 *  - a compressed record citing an id that was not a candidate is REJECTED
 *    whole, rather than partially applied;
 *  - a candidate nobody absorbed is KEPT, so a terse summariser cannot delete
 *    a memory by leaving it out;
 *  - the new record's date is the EARLIEST of its sources, because a memory of
 *    something from forty years ago is forty years old however recently it was
 *    summarised, and everything downstream sorts on that.
 */
export function applyCompression(
    store: MemoryStore,
    plan: CompressionPlan,
    compressed: readonly CompressedMemoryInput[],
    onDay: number
): CompressionResult {
    const candidateById = new Map(plan.candidates.map(c => [c.id, c]));
    const addedIds: string[] = [];
    const absorbed = new Set<string>();
    const rejected: CompressionResult['rejected'] = [];

    for (const input of compressed) {
        if (!input.compressedFromIds || input.compressedFromIds.length === 0) {
            rejected.push({ input, reason: 'cites no source memories' });
            continue;
        }
        const unknown = input.compressedFromIds.filter(id => !candidateById.has(id));
        if (unknown.length > 0) {
            rejected.push({
                input,
                reason: `cites ids that were not compression candidates: ${unknown.join(', ')}`
            });
            continue;
        }
        if (isProtectedKind(input.kind) === false && input.compressedFromIds.length === 1) {
            // Collapsing one record into one record is not compression; it is a
            // rewrite, and it loses the original for nothing.
            rejected.push({ input, reason: 'a single source is a rewrite, not a compression' });
            continue;
        }

        const sources = input.compressedFromIds.map(id => candidateById.get(id)!);
        const record: MemoryRecord = {
            id: `m${store.nextSeq}`,
            ownerId: plan.ownerId,
            kind: input.kind,
            summary: input.summary,
            detail: input.detail ?? '',
            onDay: Math.min(...sources.map(s => s.onDay)),
            actorIds: unique(sources.flatMap(s => s.actorIds)),
            locationId: sources.find(s => s.locationId)?.locationId ?? null,
            factionIds: unique(sources.flatMap(s => s.factionIds)),
            salience: clamp01(input.salience ?? Math.max(...sources.map(s => s.salience))),
            tags: unique((input.tags ?? []).concat(sources.flatMap(s => s.tags))),
            sourceFactIds: unique(sources.flatMap(s => s.sourceFactIds)),
            compressedFromIds: input.compressedFromIds.slice(),
            compressed: true,
            createdOnDay: onDay,
            updatedOnDay: onDay
        };
        store.nextSeq++;
        store.records.push(record);
        addedIds.push(record.id);
        for (const id of input.compressedFromIds) absorbed.add(id);
    }

    const keptUnabsorbedIds = plan.candidates.filter(c => !absorbed.has(c.id)).map(c => c.id);
    store.records = store.records.filter(m => !absorbed.has(m.id));

    return {
        ownerId: plan.ownerId,
        addedIds,
        removedIds: Array.from(absorbed).sort(),
        rejected,
        keptUnabsorbedIds
    };
}

/** How many memories this owner is carrying. The trigger for a pass. */
export function memoryCount(store: MemoryStore, ownerId: string): number {
    let n = 0;
    for (const m of store.records) if (m.ownerId === ownerId) n++;
    return n;
}

/** Owners over the threshold, worst first. What a maintenance pass works from. */
export function ownersNeedingCompression(
    store: MemoryStore,
    threshold = COMPRESSION_THRESHOLD
): { ownerId: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const m of store.records) counts.set(m.ownerId, (counts.get(m.ownerId) ?? 0) + 1);
    return Array.from(counts.entries())
        .filter(([, count]) => count >= threshold)
        .map(([ownerId, count]) => ({ ownerId, count }))
        .sort((a, b) => b.count - a.count || (a.ownerId < b.ownerId ? -1 : 1));
}

function unique(items: readonly string[]): string[] {
    return Array.from(new Set(items)).sort();
}

function seq(id: string): number {
    const n = Number(id.slice(1));
    return Number.isFinite(n) ? n : 0;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function clampInt(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, Math.floor(n)));
}
