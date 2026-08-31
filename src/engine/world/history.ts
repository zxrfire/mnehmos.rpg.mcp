/**
 * The historical record - ground truth, and what survives of it.
 *
 * Every significant thing that happens is appended here as a FACT: a dated,
 * attributed, located statement about what occurred. Nothing here is narrative
 * and nothing here is simulation. The LLM decides what happens and what it
 * means; this module stores it, indexes it, and answers questions about it
 * centuries later.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE LAYERS, AND THIS MODULE OWNS TWO OF THEM
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   1. GROUND TRUTH        what actually happened          ← here
 *   2. THE SURVIVING RECORD what can still be recovered    ← here (`fidelity`)
 *   3. BELIEF              what a person or the public holds ← NOT here
 *
 * Layer 3 lives in the social layer's `knowledge.ts` (objective reality / what
 * an NPC knows / believes / suspects / what the public believes). Belief
 * records reference facts by `HistoricalFact.id`; this module deliberately does
 * not model belief, so there is exactly one place that can be wrong about who
 * thinks what.
 *
 * The separation is what lets lived memory diverge from the world's record. The
 * player remembers a mountain. Someone born later says there was never a
 * mountain. Both are correct: the fact is here with `fidelity: 'lost'`, the
 * player's memory is in their memory store, and the younger character's belief
 * is in the belief layer. Nothing has to be reconciled, because they are
 * answering different questions.
 *
 * ── Three kinds of world event ────────────────────────────────────────────
 *
 * `historical`, `concurrent` and `witnessed` are NOT properties of an event.
 * They are the relation between an event and one observer, so they are
 * computed, not stored - see {@link classifyForObserver}. The same mountain
 * breaking is historical to a child born afterwards, concurrent to a cultivator
 * two provinces away who hears about it from a refugee, and witnessed by the
 * three people who were standing under it. Storing one label on the fact would
 * make the world have a protagonist.
 *
 * What IS stored is `witnessIds`: who was physically present. That is a fact
 * about the world and not about anybody's point of view.
 *
 * ── The surviving record ──────────────────────────────────────────────────
 *
 * `fidelity` says how much of an event can still be recovered, and `causeKnown`
 * says whether the reason was ever written down. A fact with
 * `causeKnown: false` is the engine's way of storing "nobody knows why" as a
 * real state of the world - and `explainFact` is the path by which somebody,
 * three thousand years later, finds out.
 *
 * ── The Consequence Test ──────────────────────────────────────────────────
 *
 * An event with no consequences once the scene ends was not a major event.
 * {@link recordMajorEvent} nudges callers through the ten questions and reports
 * which ones went unanswered. It warns rather than refuses: the engine's job is
 * to make the omission visible, not to litigate the LLM's storytelling.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { QI_DENSITY_MAX, clampQiDensity } from './qi-scale.js';

// ─────────────────────────────────────────────────────────────────────────
// FACTS
// ─────────────────────────────────────────────────────────────────────────

export type HistoricalEventKind =
    // Individual lives
    | 'birth'
    | 'death'
    | 'breakthrough'
    | 'realm_crossing'
    | 'toll_paid'
    | 'marriage'
    | 'inheritance'
    | 'grudge_opened'
    | 'grudge_inherited'
    | 'grudge_settled'
    | 'oath_sworn'
    | 'debt_incurred'
    | 'opportunity'
    // Institutions
    | 'faction_founded'
    | 'faction_fallen'
    | 'war'
    | 'succession'
    | 'promotion'
    | 'expulsion'
    | 'betrayal'
    | 'territory_changed'
    | 'resource_contested'
    // The world
    | 'ascension'
    | 'spirit_tide'
    | 'catastrophe'
    | 'geography_changed'
    | 'zone_forbidden'
    | 'tribulation_scar'
    | 'technique_lost'
    | 'technique_recovered'
    | 'treasure_buried'
    | 'treasure_found'
    | 'ruin_sealed'
    | 'ruin_opened'
    | 'realm_opened'
    | 'migration'
    | 'era_opened';

/**
 * How far the physical consequence reached. Scale of destruction tracks the
 * power actually involved: low conflicts wreck buildings, higher ones break
 * mountains, and only the very top threatens anything planetary - and not
 * every high-level fight is apocalyptic.
 */
export type EventScale = 'personal' | 'local' | 'regional' | 'continental' | 'world';

/** How far the news travelled at the time. */
export type FactVisibility = 'public' | 'regional' | 'faction' | 'secret';

/**
 * How much of the record survives to the present.
 *
 * `lost` does not mean the event did not happen. It means the event happened,
 * it is ground truth, and nothing legible about it remains - which is the
 * normal condition of most of this world's past.
 */
export type RecordFidelity = 'full' | 'partial' | 'rumour' | 'lost';

/**
 * How the engine itself stands to this fact.
 *
 *   objective       the engine knows this happened as stated
 *   reconstructed   assembled from surviving evidence; may be wrong
 *   unresolved      the engine does not know, and is not pretending to
 *
 * The third is the important one, and it is a correction to the naive model.
 * Without it the simulation degrades into "the database secretly knows
 * everything and NPCs merely hold incorrect copies," which is a much smaller
 * idea than a world with real uncertainty in it.
 *
 *     year 430    an ancient sect disappeared
 *     known       it existed; its territory was abandoned
 *     claimed     destroyed / ascended / sealed itself / migrated
 *     truth       unresolved
 *
 * `summary` on an unresolved fact states only what is known. The candidate
 * answers go in `claimedOutcomes`, none of them endorsed. This also relieves
 * the narrator of inventing an answer prematurely and leaves room for one to be
 * found later - see {@link resolveFact}.
 *
 * Coordination note: the social layer owns the belief tables (`knowledge.ts`,
 * stance x holder kind). An unresolved fact here means there is no objective
 * statement for a belief to be measured against, so a `KnowledgeRecord` about
 * it is neither true nor false - which is exactly the state that layer needs to
 * be able to represent, and why the two are stored separately.
 */
export type FactTruth = 'objective' | 'reconstructed' | 'unresolved';

export interface HistoricalActor {
    id: string;
    name: string;
    /** What this actor did: 'killer', 'victim', 'heir', 'claimant', 'witness'. */
    role: string;
}

/**
 * The ten questions. An event that cannot answer them was not a major event.
 *
 * Every field is free text or ids, because the answers are the LLM's to write.
 * The engine's contribution is that the shape exists, that it is stored beside
 * the fact, and that omissions are reported.
 */
export interface EventConsequences {
    /** 1. What changed immediately. */
    immediate: string;
    /** 2. What changed physically. Prefer citing locationChangeIds as well. */
    physical: string;
    /** 3. Who benefited. */
    beneficiaries: HistoricalActor[];
    /** 4. Who lost something. */
    losers: HistoricalActor[];
    /** 5. Which factions reacted, and how. */
    factionReactions: { factionId: string; reaction: string }[];
    /** 6. Which relationships changed. */
    relationshipChanges: { aId: string; bId: string; change: string }[];
    /** 7. What opportunities appeared. */
    opportunitiesOpened: string[];
    /** 8. What opportunities disappeared. */
    opportunitiesClosed: string[];
    /** 9. What rumours spread. Rumours may be true, partial, or fabricated. */
    rumours: string[];
    /** 10. What is still true in ten years. */
    tenYearsLater: string;
}

export const CONSEQUENCE_TEST_QUESTIONS: readonly { key: keyof EventConsequences; question: string }[] = [
    { key: 'immediate', question: 'What changed immediately?' },
    { key: 'physical', question: 'What changed physically?' },
    { key: 'beneficiaries', question: 'Who benefited?' },
    { key: 'losers', question: 'Who lost something?' },
    { key: 'factionReactions', question: 'Which factions reacted?' },
    { key: 'relationshipChanges', question: 'Which relationships changed?' },
    { key: 'opportunitiesOpened', question: 'What new opportunities appeared?' },
    { key: 'opportunitiesClosed', question: 'What old opportunities disappeared?' },
    { key: 'rumours', question: 'What rumours spread?' },
    { key: 'tenYearsLater', question: 'What is still true ten years later?' }
] as const;

export interface HistoricalFact {
    id: string;
    /** Absolute day. The canonical clock; `year` is a convenience mirror. */
    day: number;
    year: number;
    eraId: string;
    kind: HistoricalEventKind;
    scale: EventScale;

    actors: HistoricalActor[];
    /**
     * Who was physically present. Stored, because it is a property of the
     * world; whether an event is "witnessed" is then a question about an
     * observer rather than a label on the event.
     */
    witnessIds: string[];

    /** Location record id, when the place is one the world stores. */
    locationId: string | null;
    /** Free-text place name, for events at somewhere the world does not model. */
    place: string | null;
    factionIds: string[];

    /** Engine-authored factual statement. Never flavour, never a guess. */
    summary: string;
    /** Ids of earlier facts this one follows from. */
    causes: string[];
    /** Ids of the location changes this event physically produced. */
    locationChangeIds: string[];

    visibility: FactVisibility;
    fidelity: RecordFidelity;
    /**
     * Whether the true cause was ever recorded. False is a legitimate and
     * desirable state: a region is the way it is because of something three
     * thousand years ago that nobody alive can explain.
     */
    causeKnown: boolean;

    /** 0..1 reporting weight. Digests filter on it; simulation never reads it. */
    magnitude: number;
    consequences: EventConsequences | null;

    /**
     * This is a thing that ALMOST happened and did not.
     *
     * Not an alternate timeline and not a simulation artifact: an ordinary
     * history row with a flag on it. A sect that nearly unified the continent.
     * A cultivator who nearly ascended and died. A house that nearly recovered
     * its lost discipline and lost the last holder first. Someone who nearly
     * joined the player and chose otherwise.
     *
     * These cost one boolean and they are the strongest available antidote to a
     * world that looks built to produce the player's success. A world where
     * everything that was tried worked is a world with an author standing
     * visibly behind it.
     */
    nearMiss: boolean;
    /** How close it came, and what stopped it. Empty unless `nearMiss`. */
    nearMissNote: string;

    /** Whether the engine knows this, worked it out, or genuinely does not. */
    truth: FactTruth;
    /**
     * Competing candidate answers on an unresolved fact. None is endorsed.
     * Empty on objective facts, where the summary is the answer.
     */
    claimedOutcomes: string[];

    data: Record<string, string | number | boolean | null>;
}

/** A fact before it has an id, an era or a derived year. */
export type PendingFact =
    Omit<HistoricalFact, 'id' | 'eraId' | 'year'> &
    Partial<Pick<HistoricalFact, 'eraId'>>;

/** Fill the boilerplate so callers write only what they mean. */
export function makeFact(
    init: Partial<PendingFact> & Pick<PendingFact, 'day' | 'kind' | 'summary'>
): PendingFact {
    return {
        scale: 'personal',
        actors: [],
        witnessIds: [],
        locationId: null,
        place: null,
        factionIds: [],
        causes: [],
        locationChangeIds: [],
        visibility: 'regional',
        fidelity: 'full',
        causeKnown: true,
        magnitude: 0.3,
        consequences: null,
        nearMiss: false,
        nearMissNote: '',
        truth: 'objective',
        claimedOutcomes: [],
        data: {},
        ...init
    };
}

export interface Era {
    id: string;
    name: string;
    startDay: number;
    /** Null while the era is still running. */
    endDay: number | null;
    /**
     * Qi density of the age, 0..1, against the richest ground the world has
     * ever carried.
     *
     * It only ever falls. Veins that ran rich for a thousand years have been
     * drawn down; what the old civilisations did not consume they monopolised;
     * ancient wars killed whole regions outright and dead ground does not come
     * back. The present is thin because most places have already been used.
     */
    qiDensity: number;
    note: string;
}

export interface HistoryLedger {
    eras: Era[];
    facts: HistoricalFact[];
    /** Monotonic. Ids are `f${seq}` so replays compare byte-for-byte. */
    nextFactSeq: number;
}

export function createLedger(): HistoryLedger {
    return { eras: [], facts: [], nextFactSeq: 1 };
}

export function yearOfDay(day: number): number {
    return Math.floor(day / DAYS_PER_YEAR);
}

export function dayOfYear(year: number): number {
    return year * DAYS_PER_YEAR;
}

export function openEra(ledger: HistoryLedger, era: Omit<Era, 'endDay'> & { endDay?: number | null }): void {
    for (const e of ledger.eras) {
        if (e.endDay === null) e.endDay = era.startDay;
    }
    ledger.eras.push({ ...era, endDay: era.endDay ?? null });
}

export function eraForDay(ledger: HistoryLedger, day: number): Era | null {
    for (let i = ledger.eras.length - 1; i >= 0; i--) {
        const era = ledger.eras[i];
        if (day >= era.startDay && (era.endDay === null || day < era.endDay)) return era;
    }
    return ledger.eras.length > 0 ? ledger.eras[ledger.eras.length - 1] : null;
}

/**
 * Append one fact.
 *
 * Mutates the ledger in place. The ledger is owned by the world state and never
 * shared, and a world creation seeds thousands of facts, so copy-on-write here
 * shows up in a profile immediately. Everything else in this module is pure.
 */
export function appendFact(ledger: HistoryLedger, fact: PendingFact): HistoricalFact {
    const record: HistoricalFact = {
        id: `f${ledger.nextFactSeq}`,
        eraId: fact.eraId ?? eraForDay(ledger, fact.day)?.id ?? 'era-0',
        year: yearOfDay(fact.day),
        day: fact.day,
        kind: fact.kind,
        scale: fact.scale,
        actors: fact.actors,
        witnessIds: fact.witnessIds,
        locationId: fact.locationId,
        place: fact.place,
        factionIds: fact.factionIds,
        summary: fact.summary,
        causes: fact.causes,
        locationChangeIds: fact.locationChangeIds,
        visibility: fact.visibility,
        fidelity: fact.fidelity,
        causeKnown: fact.causeKnown,
        magnitude: fact.magnitude,
        consequences: fact.consequences,
        nearMiss: fact.nearMiss,
        nearMissNote: fact.nearMissNote,
        truth: fact.truth,
        claimedOutcomes: fact.claimedOutcomes,
        data: fact.data
    };
    ledger.nextFactSeq++;
    ledger.facts.push(record);
    return record;
}

// ─────────────────────────────────────────────────────────────────────────
// THE CONSEQUENCE TEST
// ─────────────────────────────────────────────────────────────────────────

/** Which of the ten questions this consequence block leaves unanswered. */
export function missingConsequences(c: Partial<EventConsequences> | null | undefined): string[] {
    if (!c) return CONSEQUENCE_TEST_QUESTIONS.map(q => q.question);
    const missing: string[] = [];
    for (const { key, question } of CONSEQUENCE_TEST_QUESTIONS) {
        const value = c[key];
        const empty =
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0);
        if (empty) missing.push(question);
    }
    return missing;
}

export interface MajorEventResult {
    fact: HistoricalFact;
    /** Unanswered Consequence Test questions. Empty means the event holds up. */
    warnings: string[];
}

/**
 * Record an event that claims to be major.
 *
 * The fact is stored either way - refusing would put the engine in the position
 * of arguing with the narrator about whether something happened. What it does
 * instead is answer, precisely, which of the ten questions were left blank, so
 * the caller can either fill them in or stop calling the event major.
 */
export function recordMajorEvent(
    ledger: HistoryLedger,
    fact: PendingFact,
    consequences?: Partial<EventConsequences>
): MajorEventResult {
    const filled = consequences ? fillConsequences(consequences) : null;
    const stored = appendFact(ledger, { ...fact, consequences: filled });
    return { fact: stored, warnings: missingConsequences(consequences) };
}

export function fillConsequences(c: Partial<EventConsequences>): EventConsequences {
    return {
        immediate: c.immediate ?? '',
        physical: c.physical ?? '',
        beneficiaries: c.beneficiaries ?? [],
        losers: c.losers ?? [],
        factionReactions: c.factionReactions ?? [],
        relationshipChanges: c.relationshipChanges ?? [],
        opportunitiesOpened: c.opportunitiesOpened ?? [],
        opportunitiesClosed: c.opportunitiesClosed ?? [],
        rumours: c.rumours ?? [],
        tenYearsLater: c.tenYearsLater ?? ''
    };
}

// ─────────────────────────────────────────────────────────────────────────
// OBSERVERS: historical, concurrent, witnessed
// ─────────────────────────────────────────────────────────────────────────

export type EventRelation = 'historical' | 'concurrent' | 'witnessed' | 'future';

export interface Observer {
    id: string;
    /** Absolute day this observer began. Events before it are historical to them. */
    bornOnDay: number;
    /** Absolute day they stopped. Null while alive. */
    diedOnDay?: number | null;
    /** Facts they were present for, beyond what the fact itself records. */
    witnessedFactIds?: readonly string[];
}

/**
 * How this observer stands in relation to this event.
 *
 * Computed, never stored. Only `witnessed` involves the observer at all - and
 * even then involvement is not participation.
 */
export function classifyForObserver(fact: HistoricalFact, observer: Observer): EventRelation {
    if (fact.day < observer.bornOnDay) return 'historical';
    const died = observer.diedOnDay;
    if (died != null && fact.day > died) return 'future';
    if (
        fact.witnessIds.includes(observer.id) ||
        (observer.witnessedFactIds ?? []).includes(fact.id)
    ) {
        return 'witnessed';
    }
    return 'concurrent';
}

/**
 * Everything that happened while this observer was alive and elsewhere.
 *
 * This is what a player gets on the way out of a thirty-year seclusion: the
 * events they were alive for and were not present at. They reach the player as
 * rumour, refugees, shifted trade and changed borders - and some of them never
 * reach the player at all, which is why `visibility` filtering is the caller's
 * choice rather than a default.
 */
export function concurrentEventsFor(
    ledger: HistoryLedger,
    observer: Observer,
    fromDay: number,
    toDay: number,
    opts: { minMagnitude?: number; visibility?: readonly FactVisibility[] } = {}
): HistoricalFact[] {
    const minMag = opts.minMagnitude ?? 0;
    const vis = opts.visibility ? new Set(opts.visibility) : null;
    return ledger.facts.filter(f => {
        if (f.day < fromDay || f.day >= toDay) return false;
        if (f.magnitude < minMag) return false;
        if (vis && !vis.has(f.visibility)) return false;
        return classifyForObserver(f, observer) === 'concurrent';
    });
}

/** Facts this observer was physically present for. */
export function witnessedEventsFor(ledger: HistoryLedger, observer: Observer): HistoricalFact[] {
    return ledger.facts.filter(f => classifyForObserver(f, observer) === 'witnessed');
}

/**
 * Mark an observer as having been present.
 *
 * A witnessed catastrophe writes real state elsewhere - the location changes,
 * its history gains an entry. This only records who was standing there, which
 * is the part the ledger owns.
 */
export function addWitness(fact: HistoricalFact, observerId: string): void {
    if (!fact.witnessIds.includes(observerId)) fact.witnessIds.push(observerId);
}

// ─────────────────────────────────────────────────────────────────────────
// QUERIES
// The present is supposed to be explicable. These are how it gets explained.
// ─────────────────────────────────────────────────────────────────────────

export interface FactQuery {
    fromDay?: number;
    toDay?: number;
    kinds?: readonly HistoricalEventKind[];
    actorId?: string;
    factionId?: string;
    locationId?: string;
    scales?: readonly EventScale[];
    visibility?: readonly FactVisibility[];
    /** Only facts still recoverable at this fidelity or better. */
    minFidelity?: RecordFidelity;
    minMagnitude?: number;
    /** Case-insensitive substring over the summary. */
    text?: string;
    /** true for only near-misses, false to exclude them. Omit for both. */
    nearMiss?: boolean;
    /** Restrict by how the engine stands to the fact. */
    truth?: readonly FactTruth[];
    limit?: number;
}

const FIDELITY_ORDER: Record<RecordFidelity, number> = {
    lost: 0,
    rumour: 1,
    partial: 2,
    full: 3
};

export function queryFacts(ledger: HistoryLedger, q: FactQuery = {}): HistoricalFact[] {
    const kinds = q.kinds ? new Set(q.kinds) : null;
    const scales = q.scales ? new Set(q.scales) : null;
    const vis = q.visibility ? new Set(q.visibility) : null;
    const minFid = q.minFidelity ? FIDELITY_ORDER[q.minFidelity] : -1;
    const text = q.text?.toLowerCase();

    const rows = ledger.facts.filter(f => {
        if (q.fromDay !== undefined && f.day < q.fromDay) return false;
        if (q.toDay !== undefined && f.day >= q.toDay) return false;
        if (kinds && !kinds.has(f.kind)) return false;
        if (scales && !scales.has(f.scale)) return false;
        if (vis && !vis.has(f.visibility)) return false;
        if (minFid >= 0 && FIDELITY_ORDER[f.fidelity] < minFid) return false;
        if (q.minMagnitude !== undefined && f.magnitude < q.minMagnitude) return false;
        if (q.nearMiss !== undefined && f.nearMiss !== q.nearMiss) return false;
        if (q.truth && !q.truth.includes(f.truth)) return false;
        if (q.actorId && !f.actors.some(a => a.id === q.actorId) && !f.witnessIds.includes(q.actorId)) {
            return false;
        }
        if (q.factionId && !f.factionIds.includes(q.factionId)) return false;
        if (q.locationId && f.locationId !== q.locationId) return false;
        if (text && !f.summary.toLowerCase().includes(text)) return false;
        return true;
    });

    rows.sort((a, b) => a.day - b.day || factSeq(a.id) - factSeq(b.id));
    return q.limit != null ? rows.slice(0, q.limit) : rows;
}

/**
 * Record something that almost happened.
 *
 * An ordinary fact with the flag set. It is stored, dated, attributed and
 * queryable exactly like anything else, and it appears in a chronicle beside
 * the things that did happen - which is the point. A history containing only
 * successes reads as authored, because it is.
 */
export function recordNearMiss(
    ledger: HistoryLedger,
    fact: PendingFact,
    note: string
): HistoricalFact {
    return appendFact(ledger, { ...fact, nearMiss: true, nearMissNote: note });
}

/**
 * Record something the engine does not know the answer to.
 *
 * `summary` says what IS known. `claimedOutcomes` lists the candidate answers
 * people offer, none of them endorsed by the engine. Nothing anywhere in this
 * codebase secretly holds the real answer, because there is not one yet.
 */
export function recordUnresolved(
    ledger: HistoryLedger,
    fact: PendingFact,
    claimedOutcomes: readonly string[]
): HistoricalFact {
    return appendFact(ledger, {
        ...fact,
        truth: 'unresolved',
        causeKnown: false,
        claimedOutcomes: claimedOutcomes.slice()
    });
}

/**
 * Somebody settled it.
 *
 * Promotes an unresolved fact to `reconstructed` (or, where the evidence is
 * conclusive, `objective`), replaces the summary with the answer, and keeps the
 * candidate list so the record can still show what people used to say. Finding
 * out is a state change like any other.
 */
export function resolveFact(
    ledger: HistoryLedger,
    factId: string,
    answer: string,
    truth: Exclude<FactTruth, 'unresolved'> = 'reconstructed',
    causeFactIds: readonly string[] = []
): HistoricalFact | null {
    const fact = ledger.facts.find(f => f.id === factId);
    if (!fact) return null;
    fact.truth = truth;
    fact.summary = answer;
    fact.causeKnown = true;
    for (const id of causeFactIds) if (!fact.causes.includes(id)) fact.causes.push(id);
    if (FIDELITY_ORDER[fact.fidelity] < FIDELITY_ORDER.partial) fact.fidelity = 'partial';
    return fact;
}

/** Everything the engine itself cannot answer. */
export function unresolvedFacts(ledger: HistoryLedger): HistoricalFact[] {
    return ledger.facts.filter(f => f.truth === 'unresolved');
}

/** Everything the world tried and did not manage. */
export function nearMisses(ledger: HistoryLedger, q: FactQuery = {}): HistoricalFact[] {
    return queryFacts(ledger, { ...q, nearMiss: true });
}

export function factsAbout(ledger: HistoryLedger, actorId: string): HistoricalFact[] {
    return queryFacts(ledger, { actorId });
}

export function factsAtLocation(ledger: HistoryLedger, locationId: string): HistoricalFact[] {
    return queryFacts(ledger, { locationId });
}

/**
 * Walk a fact's causal chain back to its roots.
 *
 * The query that makes an old feud legible: hand it the killing this year and
 * it returns the killing forty years ago and the contested vein before that.
 * Facts whose cause was never recorded terminate the walk, which is exactly
 * the shape of a world where some things are simply not known.
 */
export function causalChain(
    ledger: HistoryLedger,
    factId: string,
    maxDepth = 16
): HistoricalFact[] {
    const byId = new Map(ledger.facts.map(f => [f.id, f]));
    const out: HistoricalFact[] = [];
    const seen = new Set<string>();
    let frontier = [factId];
    for (let depth = 0; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const id of frontier) {
            if (seen.has(id)) continue;
            seen.add(id);
            const fact = byId.get(id);
            if (!fact) continue;
            out.push(fact);
            next.push(...fact.causes);
        }
        frontier = next;
    }
    return out;
}

/**
 * Facts whose cause was never recorded.
 *
 * "Nobody knows why" as a queryable state of the world. This is the list a
 * scholar, a grave-reader or a very old cultivator is working from.
 */
export function unexplainedFacts(ledger: HistoryLedger): HistoricalFact[] {
    return ledger.facts.filter(f => !f.causeKnown || f.fidelity === 'lost');
}

/**
 * Somebody found out.
 *
 * Attaches the recovered cause to a fact that did not have one and raises its
 * fidelity. This is the payoff for three thousand years of "nobody knows why",
 * and it is a state change like any other rather than a narrative flourish.
 */
export function explainFact(
    ledger: HistoryLedger,
    factId: string,
    causeFactIds: readonly string[],
    fidelity: RecordFidelity = 'partial'
): HistoricalFact | null {
    const fact = ledger.facts.find(f => f.id === factId);
    if (!fact) return null;
    for (const id of causeFactIds) {
        if (!fact.causes.includes(id)) fact.causes.push(id);
    }
    fact.causeKnown = true;
    if (FIDELITY_ORDER[fidelity] > FIDELITY_ORDER[fact.fidelity]) fact.fidelity = fidelity;
    return fact;
}

/** Degrade a record as the centuries pass. Called explicitly, never on a timer. */
export function degradeFidelity(fact: HistoricalFact, to: RecordFidelity): void {
    if (FIDELITY_ORDER[to] < FIDELITY_ORDER[fact.fidelity]) fact.fidelity = to;
}

export interface ChronicleOptions extends FactQuery {
    observer?: Observer;
    /** Restrict to these relations. Default: everything but 'future'. */
    relations?: readonly EventRelation[];
}

/**
 * A chronological digest.
 *
 * What a player who vanished for thirty years is handed on the way out: not a
 * diff of world state, but an account of what happened while they were not
 * looking, filtered by what could plausibly have reached them.
 */
export function chronicle(ledger: HistoryLedger, opts: ChronicleOptions = {}): HistoricalFact[] {
    const rows = queryFacts(ledger, opts);
    if (!opts.observer) return rows;
    const wanted = new Set<EventRelation>(
        opts.relations ?? ['historical', 'concurrent', 'witnessed']
    );
    return rows.filter(f => wanted.has(classifyForObserver(f, opts.observer!)));
}

function factSeq(id: string): number {
    const n = Number(id.slice(1));
    return Number.isFinite(n) ? n : 0;
}

// ─────────────────────────────────────────────────────────────────────────
// REMNANTS
// What a fact leaves lying on the ground afterwards. These become locations;
// see `locations.ts`, which builds records from them and points each one back
// at the fact that produced it.
// ─────────────────────────────────────────────────────────────────────────

export interface Ruin {
    id: string;
    name: string;
    /** Free-text place name; the location record carries the id. */
    location: string;
    sealedYear: number;
    originFactId: string;
    formerFactionId: string | null;
    /**
     * Qi density inside, 1..100 on the ground scale: a pocket nothing has
     * drawn on since the seal. The best ground in the world is in here, and
     * every bit of it is behind a survival threshold - which is the answer to
     * why nobody has simply gone and taken it.
     */
    qiDensity: number;
    /** Realm ordinal the guardians and trials were calibrated for. */
    dangerOrdinal: number;
    techniqueIds: string[];
    treasureIds: string[];
    opened: boolean;
    openedYear: number | null;
    openedByName: string | null;
}

export interface Scar {
    id: string;
    location: string;
    year: number;
    originFactId: string;
    failedName: string | null;
    radiusLi: number;
}

/** Descriptor for something that will become a technique or treasure record. */
export interface RemnantDescriptor {
    id: string;
    name: string;
    /** Grade band 0..4, mapping onto mortal/earth/heaven/immortal/chaos. */
    gradeBand: number;
    originFactId: string;
    year: number;
}

export interface PriorAges {
    ledger: HistoryLedger;
    ruins: Ruin[];
    scars: Scar[];
    lostTechniques: RemnantDescriptor[];
    buriedTreasures: RemnantDescriptor[];
    /** Factions that no longer exist but whose compounds are still standing. */
    deadFactionNames: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// NAMING
// Deterministic, cheap, and physical. Places in this world are named for what
// they are: Sweptground, the Low Fall, Scarwater.
// ─────────────────────────────────────────────────────────────────────────

const SURNAMES = [
    'Yun', 'Bai', 'Shen', 'Lu', 'Xiao', 'Han', 'Mo', 'Qiu', 'Tang', 'Wei',
    'Jiang', 'Cao', 'Ning', 'Fang', 'Duan', 'Gu', 'He', 'Ji', 'Kong', 'Liang'
] as const;

const GIVEN_HEAD = [
    'Zhen', 'Ci', 'Wan', 'Shu', 'Rong', 'Xu', 'Lan', 'Ke', 'Yao', 'Pei',
    'Zhao', 'Min', 'Tian', 'Nuo', 'Jing', 'Fu', 'Hui', 'Lie', 'An', 'Sui'
] as const;

const GIVEN_TAIL = [
    'shan', 'he', 'ming', 'ru', 'qing', 'yi', 'lin', 'bo', 'zhi', 'yan',
    'xue', 'feng', 'tao', 'lu', 'ping', 'wu', 'chen', 'shi', 'ya', 'kuan'
] as const;

const PLACE_HEAD = [
    'Swept', 'Low', 'Scar', 'Grey', 'Dry', 'Cold', 'Salt', 'Broken', 'Old', 'Wide',
    'Black', 'Still', 'Thin', 'Deep', 'Sour', 'Flat', 'Long', 'Near', 'Under', 'Wet'
] as const;

const PLACE_TAIL = [
    'ground', 'fall', 'water', 'reach', 'ridge', 'hollow', 'mouth', 'crossing',
    'stair', 'shelf', 'gate', 'furrow', 'bank', 'quarry', 'pass', 'yard'
] as const;

const FACTION_ADJ = [
    'Ninefold', 'Grey Vein', 'Iron Pear', 'Cold Kiln', 'Long Lantern', 'Split Stone',
    'Quiet Wheel', 'Falling Rope', 'Second Ledger', 'Bone Orchard', 'Grey Millet',
    'Hollow Reed', 'Wound Gate', 'Thousand Furrow', 'Salt Bell', 'Low Hearth'
] as const;

const FACTION_FORM = ['Sect', 'Hall', 'Pavilion', 'Court', 'Consortium'] as const;

const ERA_ADJ = [
    'Standing', 'Bright', 'Drowned', 'Iron', 'Counting', 'Quiet', 'Burning',
    'Wide', 'Last', 'Middle', 'Broken', 'Waking'
] as const;

/**
 * A person's name, unique within `taken` when one is supplied.
 *
 * Twenty surnames by twenty heads by twenty tails is eight thousand names, and
 * a seeded world holds about four hundred people. By the birthday paradox that
 * is around ten collisions every time, and it was reliably producing six - two
 * different people, same name, in the same province.
 *
 * That is not a cosmetic problem here. The knowledge system is keyed by id but
 * everything the player reads is keyed by NAME, so a duplicate quietly breaks
 * the guarantee the whole system rests on: that a name you were told is a name
 * you have. It surfaced as an intermittent test failure - the narrator would
 * correctly name somebody the player knew, and a different person standing in
 * the room happened to share it.
 *
 * The re-roll is bounded and the fallback widens the given name to two tails
 * rather than looping forever: a hundred and sixty thousand names, still in the
 * same style, and deterministic for the same stream.
 */
export function personName(rng: CultivationRNG, taken?: ReadonlySet<string>): string {
    const base = `${rng.pick(SURNAMES)} ${rng.pick(GIVEN_HEAD)}${rng.pick(GIVEN_TAIL)}`;
    if (!taken || !taken.has(base)) return base;

    for (let attempt = 0; attempt < 24; attempt++) {
        const retry = `${rng.pick(SURNAMES)} ${rng.pick(GIVEN_HEAD)}${rng.pick(GIVEN_TAIL)}`;
        if (!taken.has(retry)) return retry;
    }
    for (let attempt = 0; attempt < 24; attempt++) {
        const wider =
            `${rng.pick(SURNAMES)} ${rng.pick(GIVEN_HEAD)}${rng.pick(GIVEN_TAIL)}${rng.pick(GIVEN_TAIL)}`;
        if (!taken.has(wider)) return wider;
    }
    return base;
}

export function surnameOf(fullName: string): string {
    const space = fullName.indexOf(' ');
    return space > 0 ? fullName.slice(0, space) : fullName;
}

export function placeName(rng: CultivationRNG): string {
    return `${rng.pick(PLACE_HEAD)}${rng.pick(PLACE_TAIL)}`;
}

export function factionName(rng: CultivationRNG): string {
    return `${rng.pick(FACTION_ADJ)} ${rng.pick(FACTION_FORM)}`;
}

export function eraName(rng: CultivationRNG): string {
    return `The ${rng.pick(ERA_ADJ)} Age`;
}

// ─────────────────────────────────────────────────────────────────────────
// SEEDING THE PAST
// ─────────────────────────────────────────────────────────────────────────

export interface PriorAgesOptions {
    /** How many ages to generate before the present. Three is the default shape. */
    ages?: number;
    /** In-world years each prior age spans. */
    yearsPerAge?: number;
    /** Year the present age begins. Prior ages are laid out backwards from here. */
    presentYear?: number;
    /** Great factions founded and destroyed per prior age. */
    factionsPerAge?: number;
}

const DEFAULT_PRIOR_AGES: Required<PriorAgesOptions> = {
    ages: 3,
    yearsPerAge: 900,
    presentYear: 0,
    factionsPerAge: 4
};

/**
 * Generate several prior ages of real history.
 *
 * Everything a modern cultivator trips over - a wall someone else built, a
 * sealed door nobody can read, dead ground where the qi does not return - is
 * produced here as the consequence of a dated event with names attached, so
 * that ruins are ordinary rather than special and the true cause of a place is
 * recoverable in principle.
 *
 * Fidelity falls with age. The oldest events are stored at `rumour` or `lost`
 * with `causeKnown: false`: they are ground truth, and nothing legible about
 * them survives - until somebody digs.
 */
export function seedPriorAges(seed: string, opts: PriorAgesOptions = {}): PriorAges {
    const o = { ...DEFAULT_PRIOR_AGES, ...opts };
    const ledger = createLedger();
    const ruins: Ruin[] = [];
    const scars: Scar[] = [];
    const lostTechniques: RemnantDescriptor[] = [];
    const buriedTreasures: RemnantDescriptor[] = [];
    const deadFactionNames: string[] = [];

    const firstYear = o.presentYear - o.ages * o.yearsPerAge;

    for (let ageIndex = 0; ageIndex < o.ages; ageIndex++) {
        const ageStart = firstYear + ageIndex * o.yearsPerAge;
        const ageEnd = ageStart + o.yearsPerAge;
        const rng = forStream(seed, 'prior-age', ageIndex);

        // Qi thins monotonically toward the present. The current age is not
        // unlucky; it is late. Most places have already been used.
        const qiDensity = Number((0.95 - ageIndex * (0.65 / Math.max(1, o.ages))).toFixed(4));
        // The further back, the less survives.
        const fidelity: RecordFidelity =
            ageIndex === 0 ? 'lost' : ageIndex === 1 ? 'rumour' : 'partial';
        const causeKnown = ageIndex >= o.ages - 1;

        const era: Era = {
            id: `era-${ageIndex}`,
            name: eraName(rng),
            startDay: dayOfYear(ageStart),
            endDay: dayOfYear(ageEnd),
            qiDensity,
            note:
                `Qi density ${qiDensity.toFixed(2)}. ` +
                `${o.factionsPerAge} great powers held the region; none of them still stand.`
        };
        ledger.eras.push(era);

        const openFact = appendFact(ledger, makeFact({
            day: dayOfYear(ageStart),
            eraId: era.id,
            kind: 'era_opened',
            scale: 'world',
            summary:
                `${era.name} began. Ambient qi stood at ${qiDensity.toFixed(2)} of the ` +
                `richest ground the world has carried.`,
            visibility: 'public',
            fidelity,
            causeKnown,
            magnitude: 1,
            data: { qiDensity }
        }));

        for (let s = 0; s < o.factionsPerAge; s++) {
            const srng = forStream(seed, 'prior-faction', ageIndex, s);
            const name = factionName(srng);
            const seat = placeName(srng);
            const factionId = `dead-faction-${ageIndex}-${s}`;
            deadFactionNames.push(name);

            const foundedYear = ageStart + srng.int(5, Math.floor(o.yearsPerAge * 0.4));
            const founder = personName(srng);
            const foundFact = appendFact(ledger, makeFact({
                day: dayOfYear(foundedYear),
                eraId: era.id,
                kind: 'faction_founded',
                scale: 'regional',
                actors: [{ id: `${factionId}-founder`, name: founder, role: 'founder' }],
                place: seat,
                factionIds: [factionId],
                summary: `${founder} founded the ${name} at ${seat}.`,
                causes: [openFact.id],
                visibility: 'public',
                fidelity,
                causeKnown,
                magnitude: 0.7,
                data: { factionName: name }
            }));

            // Somebody got out. It is remembered as a golden year by people
            // whose great-grandparents were not born for it.
            if (srng.chance(0.45)) {
                const ascendedYear = foundedYear + srng.int(50, Math.floor(o.yearsPerAge * 0.4));
                const who = personName(srng);
                const ascFact = appendFact(ledger, makeFact({
                    day: dayOfYear(ascendedYear),
                    eraId: era.id,
                    kind: 'ascension',
                    scale: 'continental',
                    actors: [{ id: `${factionId}-ascended`, name: who, role: 'ascended' }],
                    place: seat,
                    factionIds: [factionId],
                    summary: `${who} of the ${name} punched through the Lid and did not come back.`,
                    causes: [foundFact.id],
                    visibility: 'public',
                    fidelity,
                    causeKnown,
                    magnitude: 1,
                    data: {}
                }));
                appendFact(ledger, makeFact({
                    day: dayOfYear(ascendedYear),
                    eraId: era.id,
                    kind: 'spirit_tide',
                    scale: 'continental',
                    place: seat,
                    factionIds: [factionId],
                    summary:
                        `A spirit tide ran through ${seat} for eleven days. ` +
                        `A vein shifting, or a seal failing; nobody agreed which.`,
                    causes: [ascFact.id],
                    visibility: 'public',
                    fidelity,
                    causeKnown,
                    magnitude: 1,
                    data: { days: 11 }
                }));
            }

            // Failed tribulations leave dead ground the qi never returns to.
            if (srng.chance(0.5)) {
                const scarYear = foundedYear + srng.int(20, Math.floor(o.yearsPerAge * 0.5));
                const failed = personName(srng);
                const scarSite = placeName(srng);
                const scarFact = appendFact(ledger, makeFact({
                    day: dayOfYear(scarYear),
                    eraId: era.id,
                    kind: 'tribulation_scar',
                    scale: 'regional',
                    actors: [{ id: `${factionId}-scarred`, name: failed, role: 'failed' }],
                    place: scarSite,
                    factionIds: [factionId],
                    summary:
                        `${failed} failed heavenly tribulation at ${scarSite}. ` +
                        `No body. The qi has not returned since.`,
                    causes: [foundFact.id],
                    visibility: 'public',
                    // A scar is physically obvious forever; the reason for it
                    // is exactly the sort of thing that gets forgotten.
                    fidelity: 'partial',
                    causeKnown,
                    magnitude: 0.9,
                    data: {}
                }));
                scars.push({
                    id: `scar-${ageIndex}-${s}`,
                    location: scarSite,
                    year: scarYear,
                    originFactId: scarFact.id,
                    failedName: failed,
                    radiusLi: srng.int(2, 30)
                });
            }

            // War over something scarce, then the fall.
            const warYear = foundedYear + srng.int(60, Math.floor(o.yearsPerAge * 0.6));
            const rival = factionName(srng);
            const contested = placeName(srng);
            const warFact = appendFact(ledger, makeFact({
                day: dayOfYear(warYear),
                eraId: era.id,
                kind: 'war',
                scale: 'regional',
                place: contested,
                factionIds: [factionId],
                summary:
                    `The ${name} and the ${rival} fought over the ${contested} vein for ` +
                    `${srng.int(2, 40)} years. Both counted it worth the cost at the time.`,
                causes: [foundFact.id],
                visibility: 'public',
                fidelity,
                causeKnown,
                magnitude: 0.8,
                data: { rival, resource: contested }
            }));

            const fallYear = Math.min(ageEnd - 1, warYear + srng.int(5, 200));
            const fallFact = appendFact(ledger, makeFact({
                day: dayOfYear(fallYear),
                eraId: era.id,
                kind: 'faction_fallen',
                scale: 'regional',
                place: seat,
                factionIds: [factionId],
                summary:
                    `The ${name} ended at ${seat}. ` +
                    `The compound is still standing; nobody alive can work its formations.`,
                causes: [warFact.id],
                visibility: 'public',
                fidelity,
                causeKnown,
                magnitude: 0.9,
                data: { factionName: name }
            }));

            // What they sealed on the way out.
            const techCount = srng.int(1, 3);
            const treasureCount = srng.int(0, 2);
            const techIds: string[] = [];
            const treasureIds: string[] = [];

            for (let t = 0; t < techCount; t++) {
                const id = `lost-tech-${ageIndex}-${s}-${t}`;
                const artName = `${srng.pick(FACTION_ADJ)} ${srng.pick([
                    'Severing', 'Stance', 'Breath', 'Ledger', 'Turning', 'Watching', 'Binding'
                ] as const)}`;
                lostTechniques.push({
                    id,
                    name: artName,
                    gradeBand: Math.min(4, 3 - ageIndex + srng.int(0, 1)),
                    originFactId: fallFact.id,
                    year: fallYear
                });
                techIds.push(id);
            }
            for (let t = 0; t < treasureCount; t++) {
                const id = `buried-treasure-${ageIndex}-${s}-${t}`;
                buriedTreasures.push({
                    id,
                    name: `${srng.pick(PLACE_HEAD)} ${srng.pick([
                        'Cauldron', 'Bell', 'Needle', 'Rope', 'Mirror', 'Ledger', 'Key'
                    ] as const)}`,
                    gradeBand: Math.min(4, 2 - ageIndex + srng.int(0, 2)),
                    originFactId: fallFact.id,
                    year: fallYear
                });
                treasureIds.push(id);
            }

            const ruinFact = appendFact(ledger, makeFact({
                day: dayOfYear(fallYear),
                eraId: era.id,
                kind: 'ruin_sealed',
                scale: 'local',
                place: seat,
                factionIds: [factionId],
                summary:
                    `The inner compound at ${seat} was sealed from the inside. ` +
                    `${techCount} manual${techCount === 1 ? '' : 's'} and ` +
                    `${treasureCount} object${treasureCount === 1 ? '' : 's'} went in with it.`,
                causes: [fallFact.id],
                visibility: 'regional',
                fidelity,
                causeKnown: false,
                magnitude: 0.6,
                data: {}
            }));

            ruins.push({
                id: `ruin-${ageIndex}-${s}`,
                name: `the sealed compound at ${seat}`,
                location: seat,
                sealedYear: fallYear,
                originFactId: ruinFact.id,
                formerFactionId: factionId,
                // The era's open air plus what the seal has preserved, put on
                // the 1..100 ground scale. An old seal over a rich age is the
                // best ground anywhere below the Lid.
                qiDensity: clampQiDensity((Math.min(1, qiDensity + 0.2)) * QI_DENSITY_MAX),
                dangerOrdinal: Math.max(4, 30 - ageIndex * 6 - srng.int(0, 6)),
                techniqueIds: techIds,
                treasureIds,
                opened: false,
                openedYear: null,
                openedByName: null
            });
        }
    }

    return { ledger, ruins, scars, lostTechniques, buriedTreasures, deadFactionNames };
}
