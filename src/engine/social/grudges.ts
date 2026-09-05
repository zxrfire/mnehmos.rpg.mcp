/**
 * The obligation ledger: grudges, debts, favours, oaths and blood feuds.
 */

import { byId, stableId, type DayIndex } from './common.js';

/**
 * The six things this ledger keeps.
 */
export type ObligationKind = 'grudge' | 'debt' | 'favor' | 'oath' | 'blood_feud' | 'leverage';

/**
 * What actually happened to cause it.
 */
export type GrudgeCause =
    | 'humiliation'
    | 'betrayal'
    | 'robbery'
    | 'injury'
    | 'crippled'
    | 'killed_kin'
    | 'killed_sectmate'
    | 'killed_master'
    | 'stolen_inheritance'
    | 'blocked_advancement'
    | 'broken_oath'
    | 'destroyed_sect'
    | 'slander'
    /**
     * A grave wrong done to their person. One row rather than several: the
     * severity is computed from what it cost, and the account of what happened
     * is in the record's own `description`.
     */
    | 'violated'
    /**
     * Their body, or their people's, taken for what it was made of. Kept apart
     * from `robbery` because the MOTIVE is the point: grave-robbing takes what
     * somebody left behind, this makes the body itself the reason anybody came.
     */
    | 'harvested'
    | 'other';

export type FavorCause =
    | 'saved_life'
    | 'healed_injury'
    | 'sheltered'
    | 'gifted_resource'
    | 'taught_technique'
    | 'sponsored_admission'
    | 'spared'
    | 'avenged_kin'
    | 'defended_kin'
    | 'shielded_crossing'
    | 'lent_resource'
    | 'kept_a_secret'
    /**
     * Brought their dead home, or what was left of them, or word of where. One
     * row for the whole family of it - a body carried back, a burial, the
     * possessions returned - because they differ only in what they cost the
     * doer, which is the one axis `what-a-deed-leaves.ts` reads.
     */
    | 'returned_their_dead'
    | 'other';

export type OathCause =
    | 'sworn_brotherhood'
    | 'sect_vow'
    | 'debt_of_life'
    | 'marriage_pact'
    | 'blood_pact'
    | 'service_term'
    | 'silence'
    | 'other';

export type ObligationCause = GrudgeCause | FavorCause | OathCause;

/**
 * How grave it is, as a word. A four-value vocabulary rather than a 0..1 float
 * so nothing downstream can be tempted to do arithmetic on it.
 */
export type Severity = 'slight' | 'serious' | 'grave' | 'unforgivable';

export const SEVERITY_ORDER: readonly Severity[] = Object.freeze([
    'slight',
    'serious',
    'grave',
    'unforgivable'
] as const);

/** For sorting and filtering only. Never for weighting a decision. */
export function severityRank(severity: Severity): number {
    return SEVERITY_ORDER.indexOf(severity);
}

export type ObligationStatus = 'open' | 'settled';

export interface Settlement {
    /** What discharged it. The only way a record leaves the open ledger. */
    resolution:
        | 'avenged'
        | 'repaid'
        | 'forgiven'
        | 'compensated'
        | 'oath_fulfilled'
        | 'oath_released'
        | 'renounced'
        | 'proven_false';
    onDay: DayIndex;
    note: string;
    /** Who settled it, when that is not the holder. */
    byId?: string;
}

/** How an heir came by a record they did not personally earn. */
export type InheritanceRelation =
    | 'descendant'
    | 'sworn_sibling'
    | 'disciple'
    | 'clan'
    | 'sect'
    | 'successor';

export interface InheritanceProvenance {
    /** The record this was copied from. */
    fromRecordId: string;
    /** Who died, causing the handover. */
    deceasedId: string;
    relation: InheritanceRelation;
    onDay: DayIndex;
}

/**
 * One entry in the ledger. `holderId` and `subjectId` are the two parties;
 * `participants` carries everyone else the event touched, so a later query can
 * find the record from any of them and not only from the two principals.
 */
export interface ObligationRecord {
    id: string;
    kind: ObligationKind;
    /** Who carries it: the aggrieved party, the debtor, the oath-taker. */
    holderId: string;
    /**
     * Who it is about: the offender, the creditor, the oath's beneficiary.
     */
    subjectId: string | null;
    cause: ObligationCause;
    severity: Severity;
    /** Absolute day index. The whole point is that this stays comparable forever. */
    incurredOnDay: DayIndex;
    /** The triggering event: a ground-truth fact id from `knowledge.ts`. */
    triggeringEventId: string | null;
    /** What happened, in plain words. Written by the narrator, never parsed. */
    description: string;
    /** Everyone else involved. Indexed, so any of them can find this record. */
    participants: string[];
    /** Free handles for querying: ['public', 'sect_business', 'unproven']. */
    tags: string[];
    /**
     * The terms, for oaths and debts: what was promised, and by when.
     * Prose, because oaths in this world are sworn in words.
     */
    terms: string | null;
    /** Day the terms come due, when there is one. */
    dueOnDay: DayIndex | null;
    status: ObligationStatus;
    settlement: Settlement | null;
    /** Empty for a record earned first-hand; one entry per handover otherwise. */
    inheritance: InheritanceProvenance[];
    /** 0 for the person it happened to, 1 for their heirs, and onward. */
    generation: number;
    /** The first holder, carried unchanged through every handover. */
    originHolderId: string;
    /**
     * True when this was written on the strength of a BELIEF rather than a
     * confirmed fact. Not a discount - a feud founded on a lie kills people
     * exactly as thoroughly - but the record can be settled `proven_false`.
     */
    fromBelief: boolean;
    recordedOnDay: DayIndex;
}

export interface ObligationInput {
    kind: ObligationKind;
    holderId: string;
    /** Null for an account with no name on it. See `ObligationRecord.subjectId`. */
    subjectId: string | null;
    cause: ObligationCause;
    severity: Severity;
    onDay: DayIndex;
    description: string;
    triggeringEventId?: string | null;
    participants?: readonly string[];
    tags?: readonly string[];
    terms?: string | null;
    dueOnDay?: DayIndex | null;
    fromBelief?: boolean;
    /** Overrides the derived id. Use when replaying a persisted record. */
    id?: string;
}

/**
 * Write a record. Severity and description are required rather than defaulted:
 * an entry nobody bothered to characterise is useless in forty years, and
 * defaulting it would hide that at write time.
 */
export function createObligation(input: ObligationInput): ObligationRecord {
    return {
        id:
            input.id ??
            stableId(
                input.kind,
                input.holderId,
                // Empty rather than 'null' for a nameless account, so an id
                // derived before the column was nullable still resolves to the
                // same row. `aNameAttaches` carries the id explicitly, so a
                // name arriving later never re-derives it.
                input.subjectId ?? '',
                input.cause,
                input.onDay,
                input.triggeringEventId ?? ''
            ),
        kind: input.kind,
        holderId: input.holderId,
        subjectId: input.subjectId,
        cause: input.cause,
        severity: input.severity,
        incurredOnDay: input.onDay,
        triggeringEventId: input.triggeringEventId ?? null,
        description: input.description,
        participants: [...(input.participants ?? [])],
        tags: [...(input.tags ?? [])],
        terms: input.terms ?? null,
        dueOnDay: input.dueOnDay ?? null,
        status: 'open',
        settlement: null,
        inheritance: [],
        generation: 0,
        originHolderId: input.holderId,
        fromBelief: input.fromBelief ?? false,
        recordedOnDay: input.onDay
    };
}

/** Convenience constructors. Identical records; the kind is what differs. */
export function createGrudge(
    input: Omit<ObligationInput, 'kind' | 'cause'> & { cause: GrudgeCause }
): ObligationRecord {
    return createObligation({ ...input, kind: 'grudge' });
}

export function createFavor(
    input: Omit<ObligationInput, 'kind' | 'cause'> & { cause: FavorCause }
): ObligationRecord {
    return createObligation({ ...input, kind: 'favor' });
}

export function createDebt(
    input: Omit<ObligationInput, 'kind' | 'cause'> & { cause: ObligationCause }
): ObligationRecord {
    return createObligation({ ...input, kind: 'debt' });
}

export function createOath(
    input: Omit<ObligationInput, 'kind' | 'cause'> & { cause: OathCause }
): ObligationRecord {
    return createObligation({ ...input, kind: 'oath' });
}

/**
 * Something you know about somebody that they would rather you did not.
 */
export function createLeverage(
    input: Omit<ObligationInput, 'kind'>
): ObligationRecord {
    return createObligation({ ...input, kind: 'leverage' });
}

export function createBloodFeud(
    input: Omit<ObligationInput, 'kind' | 'cause'> & { cause: GrudgeCause }
): ObligationRecord {
    return createObligation({ ...input, kind: 'blood_feud' });
}

/** Discharge a record. The only exit from the open ledger. */
export function settleObligation(
    record: ObligationRecord,
    settlement: Settlement
): ObligationRecord {
    return { ...record, status: 'settled', settlement };
}

export interface Heir {
    id: string;
    relation: InheritanceRelation;
}

/**
 * Hand a record on when one of its two parties dies. Both directions: the holder's
 * heirs hold it against the same subject, or the holder now holds it against the
 * dead subject's heirs.
 */
export function inheritOnDeath(
    record: ObligationRecord,
    deceasedId: string,
    heirs: readonly Heir[],
    onDay: DayIndex
): ObligationRecord[] {
    if (record.status !== 'open') return [];
    const holderDied = record.holderId === deceasedId;
    const subjectDied = record.subjectId === deceasedId;
    if (!holderDied && !subjectDied) return [];

    const out: ObligationRecord[] = [];
    for (const heir of heirs) {
        const holderId = holderDied ? heir.id : record.holderId;
        const subjectId = subjectDied ? heir.id : record.subjectId;
        // Nobody inherits a record against themselves. A disciple of both
        // houses simply gets nothing, which is its own kind of correct.
        if (holderId === subjectId) continue;
        out.push({
            ...record,
            id: stableId('inherit', record.id, heir.id, heir.relation, onDay),
            holderId,
            subjectId,
            participants: [...record.participants],
            tags: [...record.tags],
            inheritance: [
                ...record.inheritance,
                { fromRecordId: record.id, deceasedId, relation: heir.relation, onDay }
            ],
            generation: record.generation + 1,
            originHolderId: record.originHolderId,
            status: 'open',
            settlement: null,
            recordedOnDay: onDay
        });
    }
    return out;
}

/**
 * Every open record touching a dead party, handed on in one pass. Linear in
 * that person's own ledger, not in the world's, which is what lets a world
 * clock advance a century of deaths without this layer becoming the bottleneck.
 */
export function inheritLedgerOnDeath(
    records: readonly ObligationRecord[],
    deceasedId: string,
    heirs: readonly Heir[],
    onDay: DayIndex
): ObligationRecord[] {
    const out: ObligationRecord[] = [];
    for (const record of records) {
        out.push(...inheritOnDeath(record, deceasedId, heirs, onDay));
    }
    return out;
}

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
