/**
 * An obligation ledger held in memory, indexed the way the SQLite tables are.
 *
 * The game reads obligations out of SQL (`obligation.repo.ts`). Tests that want
 * a ledger without a database use this one.
 */

import {
    severityRank,
    type ObligationCause,
    type ObligationKind,
    type ObligationRecord,
    type Severity
} from '../../src/engine/social/grudges.js';
import { byId, type DayIndex } from '../../src/engine/social/common.js';

export interface ObligationQuery {
    kind?: ObligationKind;
    kinds?: readonly ObligationKind[];
    cause?: ObligationCause;
    /** Minimum severity, by the fixed order. Filtering only, never weighting. */
    minSeverity?: Severity;
    /** Include settled records. Default false - the open ledger is the usual read. */
    includeSettled?: boolean;
    /** Only records incurred on or before this day. */
    asOfDay?: DayIndex;
    /** Only records due on or before this day. Finds oaths coming due. */
    dueByDay?: DayIndex;
    /** Match records carrying every one of these tags. */
    tags?: readonly string[];
    /** Only records at or beyond this generation. `1` finds inherited business. */
    minGeneration?: number;
}

/**
 * Indexed store of obligation records. Indexes mirror the SQLite indexes in
 * `migrations.social.ts`, and every query is O(matches). Nothing here scans,
 * ages, sweeps or compacts: a ledger three hundred years of world time deep is
 * the normal case and stays cheap only because the reads are all keyed.
 */
export class ObligationLedger {
    private readonly records = new Map<string, ObligationRecord>();
    private readonly byHolder = new Map<string, Set<string>>();
    private readonly bySubject = new Map<string, Set<string>>();
    private readonly byParticipant = new Map<string, Set<string>>();
    private readonly byEvent = new Map<string, Set<string>>();

    put(record: ObligationRecord): ObligationRecord {
        this.records.set(record.id, record);
        index(this.byHolder, record.holderId, record.id);
        // A nameless account is not filed against anybody, which is the
        // truthful index: "who is carrying something about this person" must
        // not return a record that names nobody.
        if (record.subjectId !== null) index(this.bySubject, record.subjectId, record.id);
        for (const participant of record.participants) {
            index(this.byParticipant, participant, record.id);
        }
        if (record.triggeringEventId) index(this.byEvent, record.triggeringEventId, record.id);
        return record;
    }

    putAll(records: readonly ObligationRecord[]): ObligationRecord[] {
        return records.map(r => this.put(r));
    }

    get(id: string): ObligationRecord | null {
        return this.records.get(id) ?? null;
    }

    /** Everything this person carries. */
    heldBy(holderId: string, query: ObligationQuery = {}): ObligationRecord[] {
        return this.resolve(this.byHolder.get(holderId), query);
    }

    /** Everything held against this person - including by people they never met. */
    against(subjectId: string, query: ObligationQuery = {}): ObligationRecord[] {
        return this.resolve(this.bySubject.get(subjectId), query);
    }

    /** One direction of one pair. */
    between(holderId: string, subjectId: string, query: ObligationQuery = {}): ObligationRecord[] {
        return this.heldBy(holderId, query).filter(r => r.subjectId === subjectId);
    }

    /** Everything touching this person in any capacity, principal or bystander. */
    involving(characterId: string, query: ObligationQuery = {}): ObligationRecord[] {
        const keys = new Set<string>([
            ...(this.byHolder.get(characterId) ?? []),
            ...(this.bySubject.get(characterId) ?? []),
            ...(this.byParticipant.get(characterId) ?? [])
        ]);
        return this.resolve(keys, query);
    }

    /** Everything that came out of one event. */
    fromEvent(eventId: string, query: ObligationQuery = {}): ObligationRecord[] {
        return this.resolve(this.byEvent.get(eventId), query);
    }

    /**
     * Walk an inherited record back to the original, newest-first. The last
     * entry is the record as first written, by the person it happened to.
     */
    lineage(recordId: string): ObligationRecord[] {
        const chain: ObligationRecord[] = [];
        const seen = new Set<string>();
        let cursor = this.records.get(recordId) ?? null;
        while (cursor && !seen.has(cursor.id)) {
            seen.add(cursor.id);
            chain.push(cursor);
            const parentId = cursor.inheritance[cursor.inheritance.length - 1]?.fromRecordId;
            cursor = parentId ? (this.records.get(parentId) ?? null) : null;
        }
        return chain;
    }

    all(query: ObligationQuery = {}): ObligationRecord[] {
        return this.resolve(new Set(this.records.keys()), query);
    }

    size(): number {
        return this.records.size;
    }

    private resolve(
        keys: Iterable<string> | undefined,
        query: ObligationQuery
    ): ObligationRecord[] {
        if (!keys) return [];
        const out: ObligationRecord[] = [];
        for (const key of keys) {
            const record = this.records.get(key);
            if (!record) continue;
            if (!matches(record, query)) continue;
            out.push(record);
        }
        return out.sort((a, b) => a.incurredOnDay - b.incurredOnDay || byId(a, b));
    }
}

function matches(record: ObligationRecord, query: ObligationQuery): boolean {
    if (!query.includeSettled && record.status !== 'open') return false;
    if (query.kind && record.kind !== query.kind) return false;
    if (query.kinds && !query.kinds.includes(record.kind)) return false;
    if (query.cause && record.cause !== query.cause) return false;
    if (query.minSeverity && severityRank(record.severity) < severityRank(query.minSeverity)) {
        return false;
    }
    if (query.asOfDay !== undefined && record.incurredOnDay > query.asOfDay) return false;
    if (query.dueByDay !== undefined) {
        if (record.dueOnDay === null || record.dueOnDay > query.dueByDay) return false;
    }
    if (query.minGeneration !== undefined && record.generation < query.minGeneration) return false;
    if (query.tags) {
        for (const tag of query.tags) {
            if (!record.tags.includes(tag)) return false;
        }
    }
    return true;
}

function index(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (set) set.add(value);
    else map.set(key, new Set([value]));
}
