/**
 * The obligation ledger: grudges, debts, favours, oaths and blood feuds.
 *
 * The charter's requirement is a memory requirement, not a behaviour
 * requirement: *"An NPC must be able to conclude 'I cannot defeat him now; I
 * will remember this,' and act on it forty years later. Grudges outlive their
 * owners and are inherited."* The acting is the narrator's job. The
 * REMEMBERING is this module's, and it is the part a language model cannot do
 * on its own - a model that has to be reminded is a model that will eventually
 * not be.
 *
 * So this file stores records and does nothing else. There is no intensity
 * curve, no net-feeling arithmetic, no decision function. Four rules make the
 * memory trustworthy:
 *
 * ── 1. Nothing expires ────────────────────────────────────────────────────
 * There is no expiry column, no decay, and no "stale record" sweep. A record
 * leaves the open ledger exactly one way: something happens and somebody
 * writes a {@link Settlement} saying what. A grudge that quietly stopped
 * mattering because forty years went by is the exact failure this subsystem
 * exists to prevent, so the API offers no way to express it.
 *
 * ── 2. Severity is a stored word, not a computed number ───────────────────
 * {@link Severity} is `slight | serious | grave | unforgivable`. It is written
 * down once, when the record is created, and never recalculated. The engine
 * does not decide how much a killing is worth relative to a humiliation, and
 * does not adjust it as circumstances change - both are judgements, and both
 * belong to the narrator reading the record.
 *
 * ── 3. Inheritance copies the record; it does not discount it ─────────────
 * When the holder dies their heirs inherit the record as it stands, at the
 * same severity, with a provenance chain back to the original. There is no
 * generational weighting, because "how much does the grandson actually care"
 * is precisely the thing the LLM should be answering from the record's
 * contents - the date, the event, whose grudge it originally was - rather than
 * from a coefficient the engine invented.
 *
 * ── 4. Nothing is ranked by cultivation ───────────────────────────────────
 * This module does not import realms, ordinals or power, and stores none. Who
 * holds what against whom has nothing to do with where either of them stands
 * on the ladder.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HOLDER DIED STILL HOLDING IT, AND THAT IS NOT A SECOND STATUS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Rule 1 says settlement is the only exit, and it is written above as though
 * every record eventually meets one. Most do not. The design owner, on the
 * accounts an absence opens for people who never find out what happened:
 *
 *     you can die never knowing and then it just dies, that's fine too
 *
 * So a ledger that has been running for five centuries holds several hundred
 * rows that are `open`, will never be settled, and are held by people who are
 * dead. That is correct rather than a backlog: they are people who went to
 * their graves not knowing. It does raise a real question, because on the
 * strength of rule 1 alone those rows read as live business forever.
 *
 * **It is a DERIVED reading, and it is deliberately not a status.** Three
 * reasons, in the order they bind:
 *
 *   It would break inheritance. {@link inheritOnDeath} refuses a record that
 *   is not `open`, and it is called BECAUSE the holder died. A status that
 *   changed on death would close the row a moment before the only function
 *   that reads a death could hand it to an heir, and the whole inherited-feud
 *   half of this subsystem would go quiet.
 *
 *   It would be a second source of truth. Whether somebody is still in the
 *   world is `NpcRecord.status` and nothing else, and it moves: `missing` is
 *   not dead, a preserved soul still acts, and somebody presumed dead by a
 *   register may walk back through the door. Copying any of that onto the row
 *   means the ledger and the world can disagree, and the ledger will be the
 *   one that is stale.
 *
 *   And it is not a fact about the record. Nothing happened to the wrong. The
 *   row says exactly what it said the day it was written, which is the point
 *   of a ledger that never quietly shrinks anything.
 *
 * So the question "is anybody still carrying this" is asked of the WORLD, by
 * whoever is asking - `isActing` on the holder, or `isUnadjudicated` where
 * that matters - and a sweep over the ledger is the wrong shape twice, because
 * it would both write the derived answer down and have to be re-run whenever
 * the world moved. A row whose holder can no longer act is inert, and inert is
 * a reading rather than a state.
 */

import { byId, stableId, type DayIndex } from './common.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A RECORD IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The six things this ledger keeps.
 *
 * A `blood_feud` is deliberately its own kind rather than a severe grudge: it
 * is held between LINES rather than between people, it is expected to be
 * inherited, and everyone involved knows it is running. A `debt` is owed by
 * the holder; a `favour` is owed to them. Keeping them apart matters because
 * "who owes whom" is the single most common question asked of this table.
 *
 * ── Why `leverage` is a kind and not a heavy favour ──────────────────────
 *
 * Because of its LIFECYCLE, which is unlike every other row here:
 *
 *   A FAVOUR is owed TO somebody. It is spent once and then it is gone.
 *   LEVERAGE is held OVER somebody. **Using it does not consume it.** They
 *   took the bribe, or their house covered a thing up, and you know - and you
 *   still know next year, and the year after.
 *
 * Nothing already in this union has that shape. `favor` is discharged, `debt`
 * is repaid, `grudge` can be settled, `oath` binds, `blood_feud` runs. Leverage
 * simply sits there, usable again, and is worth MORE unused than spent.
 *
 * It ends three ways and none of them is being used:
 *
 *   THE FACT STOPS BEING ONE   Everybody knows now, so knowing it is worth
 *                              nothing. Settle it `renounced`. Note that
 *                              disclosure destroys the asset - the threat is
 *                              worth more than the telling, which is the whole
 *                              decision the holder is sitting on.
 *   THEY STOP CARING, OR DIE   Though `InheritanceProvenance` means the
 *                              exposure may pass to whoever inherits it.
 *   THEY BUY IT                `compensated`, and the interesting one: the
 *                              position does not end, it INVERTS. Payment plus
 *                              an `oath` not to speak of it means they now hold
 *                              a broken word over you if you ever do. Both
 *                              parties end up held, which is exactly why either
 *                              would accept the bargain.
 *
 * `subjectId` may be a HOUSE, like every other row here - the columns are ids
 * and nothing in this file requires a person - which is how a nobody comes to
 * hold something over an apex.
 */
export type ObligationKind = 'grudge' | 'debt' | 'favor' | 'oath' | 'blood_feud' | 'leverage';

/**
 * What actually happened to cause it.
 *
 * Concrete and specific by design. A record whose cause is "conflict" is a
 * record nobody can narrate from in forty years.
 *
 * ── This list is DATA, and nothing in the engine branches on it ──────────
 *
 * Worth stating because the list keeps growing and the growth is harmless only
 * while that stays true. `what-a-deed-leaves.ts` prices a deed from what it
 * COST, whether it comes back, and whether a word was given first - never from
 * which of these words is on it - so a wrong nobody has thought of yet arrives
 * with a cost and gets a weight without anybody editing a table. If you ever
 * find a `switch` on one of these values deciding an outcome, that switch is
 * the bug and not this union.
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
     * A grave wrong done to their person.
     *
     * Deliberately one row rather than several, and deliberately at this level
     * of description. The severity is not carried by this word - it is computed
     * from what it cost - and the account of what happened is in the record's
     * own `description`, written once and read forever. The world narrates
     * consequence and aftermath: who holds it, what a house did about it, who
     * still carries it in eighty years.
     */
    | 'violated'
    /**
     * Their body, or their people's, taken for what it was made of.
     *
     * Kept apart from `robbery` and from a grave being emptied because the
     * MOTIVE is different and the motive is the whole point: grave-robbing
     * takes what somebody left behind, and this makes the body itself the
     * reason anybody came. A record that collapsed the two would lose exactly
     * the fact that makes a powerful corpse dangerous to be.
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
     * Brought their dead home, or what was left of them, or word of where.
     *
     * One row for the whole family of it - the body carried back, a burial, the
     * possessions returned, a name sent on without either. They differ in what
     * they cost the person who did it, which is the only axis
     * `what-a-deed-leaves.ts` reads, so none of them needs a row of its own.
     *
     * It is here because it is the OTHER thing that can be done with a corpse,
     * and it is usually the better trade. A house owes you for it, and a favour
     * owed by a house is above the cash line - `docs/world/things/items.md` is explicit
     * that up there money is not the medium. What was taken off the body
     * instead is a tracked object whose provenance damns whoever holds it, and
     * is hard to sell for exactly the reason it is worth anything.
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
 * How grave it is, as a word.
 *
 * A four-value vocabulary rather than a 0..1 float, so that nothing downstream
 * can be tempted to do arithmetic on it. It is written once and read forever.
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
 * One entry in the ledger.
 *
 * `holderId` and `subjectId` are the two parties. `participants` carries
 * everyone else the event touched - the sect-mates who were there, the brother
 * who died, the elder who ruled on it - so that a later query can find the
 * record from any of them, not only from the two principals.
 */
export interface ObligationRecord {
    id: string;
    kind: ObligationKind;
    /** Who carries it: the aggrieved party, the debtor, the oath-taker. */
    holderId: string;
    /**
     * Who it is about: the offender, the creditor, the oath's beneficiary.
     *
     * NULL for an account nobody can put a name to - somebody who knows they
     * were wronged and cannot say by whom. `accounts-with-no-name.ts` owns that
     * state and `hasANameOnIt` is the read: nothing else should compare this to
     * null directly, because there was briefly a second way of saying it and
     * one stored representation is the whole point.
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
     * True when this was written down on the strength of a BELIEF rather than
     * a confirmed fact. Not a discount - a feud founded on a lie kills people
     * exactly as thoroughly. It is here so the record can be settled as
     * `proven_false` if the truth ever surfaces.
     */
    fromBelief: boolean;
    recordedOnDay: DayIndex;
}

// ─────────────────────────────────────────────────────────────────────────
// CREATION
// ─────────────────────────────────────────────────────────────────────────

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
 * Write a record.
 *
 * Severity and description are required rather than defaulted: an entry
 * nobody bothered to characterise is an entry that will be useless in forty
 * years, and silently defaulting it would hide that at write time.
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
 *
 * Held BY the person who knows, ABOUT the person or the house it is on - the
 * same direction as a favour, because both are positions rather than burdens.
 * `severity` is what it would cost the subject if it came out, decided once,
 * and it is the figure a buyout negotiates against.
 *
 * Nothing about using it changes the row. That is the point of the kind.
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

// ─────────────────────────────────────────────────────────────────────────
// INHERITANCE
// ─────────────────────────────────────────────────────────────────────────

export interface Heir {
    id: string;
    relation: InheritanceRelation;
}

/**
 * Hand a record on when one of its two parties dies.
 *
 * Both directions, because both happen:
 *
 *   - the HOLDER died  -> their heirs now hold it against the same subject.
 *     "My father died with this unpaid. It is mine now."
 *   - the SUBJECT died -> the holder now holds it against the subject's heirs.
 *     "He is beyond me. His grandson is not."
 *
 * The copy is faithful. Same severity, same cause, same description, same
 * triggering event, with `generation` incremented and a provenance entry
 * appended. `originHolderId` never changes, which is how the engine can still
 * name whose grudge this originally was three generations after everyone who
 * could have explained it stopped being alive.
 *
 * `incurredOnDay` is preserved too, not reset to the handover date: the wrong
 * happened when it happened, and an inherited feud that appears to date from
 * last spring is a feud the narrator will misread.
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
 * Every open record touching a dead party, handed on in one pass.
 *
 * Called once when someone dies. Linear in that person's own ledger, not in
 * the world's - which is what lets a world clock advance a century of deaths
 * without the social layer becoming the bottleneck.
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

// ─────────────────────────────────────────────────────────────────────────
// THE LEDGER
// ─────────────────────────────────────────────────────────────────────────

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
 * Indexed store of obligation records.
 *
 * Indexes mirror the SQLite indexes in `migrations.social.ts`. Every query is
 * O(matches). Nothing here scans, ages, sweeps or compacts: a ledger that has
 * been accumulating for three hundred years of world time is the normal case,
 * and it stays cheap because the reads are all keyed.
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
     * Walk an inherited record back to the original.
     *
     * Returns the chain newest-first. The last entry is the record as it was
     * first written, by the person it actually happened to.
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
