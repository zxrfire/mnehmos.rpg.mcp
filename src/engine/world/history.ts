/**
 * The historical record - ground truth, and what survives of it.
 */

import { pluralOf } from '../../utils/a-count-agrees-with-what-it-counts.js';
import type { Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { RUIN_NAMES, SCAR_NAMES } from '../../data/cultivation/regions.js';
import { AGES, AGE_FIDELITY } from '../../data/cultivation/history.js';
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
    /**
     * A wound nothing in the world closes, on the day it was taken.
     */
    | 'injury'
    | 'toll_paid'
    | 'marriage'
    | 'inheritance'
    /**
     * Somebody who was expecting a return stopped expecting it.
     */
    | 'gave_up_waiting'
    /**
     * The world settled on an unexplained absence having been a death.
     *
     * Almost always written with `truth: 'unresolved'`, because the engine
     * frequently knows better and the record does not.
     */
    | 'presumed_dead'
    | 'grudge_opened'
    | 'grudge_inherited'
    | 'grudge_settled'
    /**
     * A house put a price on somebody's head: a paper on its walls. See
     * `a-house-puts-a-price-on-somebody.ts`.
     */
    | 'bounty_posted'
    | 'gathering'
    | 'oath_sworn'
    | 'debt_incurred'
    | 'opportunity'
    /**
     * Somebody said a thing out loud where people could hear it.
     *
     * The record of an UTTERANCE and never of what it was about: the engine
     * refusing to carry an act out does not unsay it, and words that reached
     * nothing still reached the ears in the room. What happens to it afterwards
     * is the ordinary business of `what-people-are-saying.ts`, which is to say
     * it gets repeated, it gets bigger, somebody attaches it to the wrong name,
     * and eventually it arrives somewhere the speaker was not.
     */
    | 'said_in_public'
    // Institutions
    | 'faction_founded'
    | 'faction_fallen'
    /**
     * A house's hold on ground it does not own came up for renewal.
     */
    | 'grant_renewed'
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
    /**
     * A thing stopped existing because somebody ended it.
     *
     * Written by whoever called `ruin`, which is the primitive, so a blade
     * broken in a fight and a hull broken on purpose are the same kind of row.
     */
    | 'object_destroyed'
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
 */
export type RecordFidelity = 'full' | 'partial' | 'rumour' | 'lost';

/**
 * How the engine itself stands to this fact.
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
     * Qi density of the age, 0..1, against the richest ground the world has ever
     * carried.
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

export function eraForDay(ledger: HistoryLedger, day: number): Era | null {
    for (let i = ledger.eras.length - 1; i >= 0; i--) {
        const era = ledger.eras[i];
        if (day >= era.startDay && (era.endDay === null || day < era.endDay)) return era;
    }
    return ledger.eras.length > 0 ? ledger.eras[ledger.eras.length - 1] : null;
}

/**
 * A place in the ledger taken now and written into later.
 *
 * For a writer whose consequences carry the fact id and whose sentence is not
 * known until those consequences have happened: a gathering writes every
 * relationship it creates while it runs, and each one names the row. Taking the
 * id first lets the row be appended ONCE, with its finished sentence, rather
 * than appended provisionally and rewritten - which is what
 * `a-fact-that-keeps-happening-is-one-row.ts` needs, since it decides whether
 * the ledger already says this from the statement itself.
 *
 * `at` as well as `id`, because facts written while the event runs are appended
 * in between. Without the position the event would sit after its own deaths.
 */
export interface ReservedFactSlot {
    id: string;
    at: number;
}

/** Take the next id and the next place, to be filled by `appendFact` later. */
export function reserveFactSlot(ledger: HistoryLedger): ReservedFactSlot {
    const slot = { id: `f${ledger.nextFactSeq}`, at: ledger.facts.length };
    ledger.nextFactSeq++;
    return slot;
}

/**
 * Append one fact, or fill a slot reserved earlier.
 */
export function appendFact(
    ledger: HistoryLedger,
    fact: PendingFact,
    slot: ReservedFactSlot | null = null
): HistoricalFact {
    const record: HistoricalFact = {
        id: slot ? slot.id : `f${ledger.nextFactSeq}`,
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
    if (slot) {
        ledger.facts.splice(Math.min(slot.at, ledger.facts.length), 0, record);
        return record;
    }
    ledger.nextFactSeq++;
    ledger.facts.push(record);
    return record;
}

// ─────────────────────────────────────────────────────────────────────────
// THE CONSEQUENCE TEST
// ─────────────────────────────────────────────────────────────────────────

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
 * Record something the engine does not know the answer to.
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

/** Everything the world tried and did not manage. */
export function nearMisses(ledger: HistoryLedger, q: FactQuery = {}): HistoricalFact[] {
    return queryFacts(ledger, { ...q, nearMiss: true });
}

/**
 * Somebody found out.
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

export interface ChronicleOptions extends FactQuery {
    observer?: Observer;
    /** Restrict to these relations. Default: everything but 'future'. */
    relations?: readonly EventRelation[];
}

/**
 * A chronological digest.
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
    /** What the province calls it. Never its kind - see `SCAR_NAMES`. */
    name: string;
    id: string;
    location: string;
    year: number;
    originFactId: string;
    failedName: string | null;
    radiusLi: number;
}

/**
 * Somebody who finished, and the ground they left better than they found it.
 */
export interface Crossing {
    id: string;
    /** The seat it happened at, as the province names it. */
    location: string;
    year: number;
    originFactId: string;
    /** Null where nobody kept the name, which is most of them. */
    crossedName: string | null;
    /**
     * The ruin that grew on the same seat, which is the ground this lifted.
     */
    groundRuinId: string;
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
    /** Everybody who finished, and the ground each of them lent something to. */
    crossings: Crossing[];
    /**
     * The year the world opens on, carried so a consumer can price how long ago
     * something was without being told separately and getting it wrong. The
     * present AGE opened long before it: see `historyEras`.
     */
    presentYear: number;
    lostTechniques: RemnantDescriptor[];
    buriedTreasures: RemnantDescriptor[];
    /** Factions that no longer exist but whose compounds are still standing. */
    deadFactionNames: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// NAMING
// Deterministic, cheap, and physical. Places in this world are named for what
// they are: Burnt Earth, the Jade Gorge, Clear River Ferry.
// ─────────────────────────────────────────────────────────────────────────

export const SURNAMES = [
    'Yun', 'Bai', 'Shen', 'Lu', 'Xiao', 'Han', 'Mo', 'Qiu', 'Tang', 'Wei',
    'Jiang', 'Cao', 'Ning', 'Fang', 'Duan', 'Gu', 'He', 'Ji', 'Kong', 'Liang'
] as const;

/**
 * Surnames that belong to somebody, and so must never be handed to a stranger.
 */
export const RESERVED_SURNAMES: ReadonlyMap<string, string> = new Map([
    ['Ru', 'Azure Cloud Pavilion'],
    ['Meng', 'Nine Peaks Ascetic Sect'],
]);

/**
 * A NAME SAYS WHICH THEY ARE, AND THIS ONE DID NOT.
 *
 * `personName` drew from one pool and `createNpc` rolled the sex separately, so
 * every generated person in the world - hundreds of them - carried a name with
 * no relation to who they were. The design owner, on a woman whose entry calls
 * her "Half Cup Lian": *"that's a very weird name ... just give the npc's
 * masculine or feminine names. you know what they sound like."*
 *
 * It costs more than the reading. `senior sister` and `senior brother` are how
 * this genre addresses somebody whose name you have, and a player who cannot
 * tell from the name cannot use either of them.
 *
 * SORTED, NOT REPLACED. Every syllable below was already in the two pools; none
 * has been added and none dropped, so the world's names read exactly as they
 * did - the same palette, drawn in two halves instead of one. Ten and ten each
 * way, so neither sex has the narrower set of names.
 *
 * The tail carries most of it, which is why it is split first and why the heads
 * that go with it are chosen to agree: a peak, waves, a mountain and the
 * martial word are what men are named for here, and the quiet words, the
 * weather and the plants are what women are named for. None of this is a rule
 * about a language - it is the palette this world was authored in, read off the
 * catalog's own 196 people.
 */
export const GIVEN_HEAD_MALE = [
    'Zhen', 'Xu', 'Ke', 'Zhao', 'Min', 'Tian', 'Fu', 'Lie', 'An', 'Sui'
] as const;

export const GIVEN_HEAD_FEMALE = [
    'Ci', 'Wan', 'Shu', 'Rong', 'Lan', 'Yao', 'Pei', 'Nuo', 'Jing', 'Hui'
] as const;

export const GIVEN_TAIL_MALE = [
    'shan', 'he', 'ming', 'bo', 'feng', 'tao', 'lu', 'wu', 'chen', 'kuan'
] as const;

export const GIVEN_TAIL_FEMALE = [
    'ru', 'qing', 'yi', 'lin', 'zhi', 'yan', 'xue', 'ping', 'shi', 'ya'
] as const;

/**
 * The modifier. Colour, mineral, weather and number - never a texture or a
 * relative position, which are the two English habits (Sweptfall, Nearford,
 * Underhollow). Every word here is one the authored map already uses.
 */
export const PLACE_HEAD = [
    'Frigid', 'Black', 'Jasper', 'White', 'Jade', 'Iron', 'Bronze', 'Azure', 'Vermilion',
    'Deep', 'Barren', 'Broken', 'Old', 'Dry', 'Salt', 'Cloud', 'Frost', 'Grey',
    'Nine', 'Seven', 'Three', 'Autumn', 'Sorghum', 'Silent', 'Hidden', 'Bitter'
] as const;

/**
 * The feature the name ends in, and it is a WORD rather than a suffix.
 *
 * These were welded onto the head - Sweptfall, Coldmouth, Lowhollow - which is
 * the English habit (Blackpool, Sheffield) and not the one this world's names
 * are translated out of. `docs/world/writing/place-names.md` is explicit that
 * the type noun is what makes a name read as translated at all, and a type noun
 * fused into the modifier stops being one. Every generated toponym in every
 * world came out of this table, so every one of them read English.
 *
 * `reach`, `fall` and `shelf` are gone with the compounding, by the same
 * document's rule: they are English landscape words with no type noun behind
 * them, where Terrace, Ferry, Cliff and Crag are the same features under words a
 * reader takes as translated.
 */
/**
 * The feature the name ends in, and it is a WORD rather than a suffix.
 *
 * These were welded onto the head - Sweptfall, Coldmouth, Lowhollow - which is
 * the English habit (Blackpool, Sheffield) and not the one this world's names
 * are translated out of. Splitting them was not enough on its own and the
 * design owner said so: HALF ROOF IS NOT XIANXIA. The NOUNS were the problem.
 * Roof, Well, Bank, Yard, Hollow and Reach are English domestic and
 * agricultural words, and a space between two of them is still an English
 * village. What is left here is the set the authored map uses, and nothing
 * else: Gorge, Terrace, Cliff, Crag, Gate, Ferry, Pass, Crest, Stair, Spring,
 * Vein, Sands.
 *
 * Crag, Crest and Ferry were Peak, Ridge and Ford, and every word in these
 * lists was swapped one for one so every seeded draw stayed where it was: a
 * name word is never a word the player types or a typo of one (AGENTS.md,
 * "A name evokes what it is"), and `peak` is one letter from *speak*, `ridge`
 * from *ride*, `ford` from *food*. The heads lost Cold, Green, Thin and Grain
 * for the same reason.
 */
export const PLACE_TAIL = [
    'Crag', 'Crest', 'Gorge', 'Valley', 'Cliff', 'Terrace', 'Stair',
    'Ferry', 'Pass', 'Gate', 'Spring', 'Sands', 'Stream', 'Rock', 'Face'
] as const;

export const FACTION_ADJ = [
    'Ninefold', 'Grey Vein', 'Iron Quince', 'Idle Censer', 'Long Lantern', 'Cleft Stone',
    'Quiet Wheel', 'Falling Rope', 'Second Ledger', 'Bone Orchard', 'Grey Millet',
    'Empty Reed', 'Breach Gate', 'Thousand Furrow', 'Salt Gong', 'Low Hearth'
] as const;

export const FACTION_FORM = ['Sect', 'Hall', 'Pavilion', 'Court', 'Stone Marrow Hall'] as const;

/**
 * A person's name, unique within `taken` when one is supplied.
 */
export function personName(
    rng: CultivationRNG,
    /**
     * Who this is, so the name says so.
     *
     * Optional because the world is full of callers that name a thing rather
     * than a person - and because a caller with no sex to hand is better off
     * drawing from both halves than being made to invent one. See the pools.
     */
    sex?: Sex,
    taken?: ReadonlySet<string>
): string {
    const heads = sex === 'male'
        ? GIVEN_HEAD_MALE
        : sex === 'female' ? GIVEN_HEAD_FEMALE : [...GIVEN_HEAD_MALE, ...GIVEN_HEAD_FEMALE];
    const tails = sex === 'male'
        ? GIVEN_TAIL_MALE
        : sex === 'female' ? GIVEN_TAIL_FEMALE : [...GIVEN_TAIL_MALE, ...GIVEN_TAIL_FEMALE];
    const draw = (): string => `${rng.pick(SURNAMES)} ${rng.pick(heads)}${rng.pick(tails)}`;

    const base = draw();
    if (!taken || !taken.has(base)) return base;

    for (let attempt = 0; attempt < 24; attempt++) {
        const retry = draw();
        if (!taken.has(retry)) return retry;
    }
    for (let attempt = 0; attempt < 24; attempt++) {
        // THE SAME HALF FOR BOTH SYLLABLES. A third syllable drawn from the
        // other pool is how a name stops saying anything, which is the whole
        // defect this is here to end.
        const wider = `${draw()}${rng.pick(tails)}`;
        if (!taken.has(wider)) return wider;
    }
    return base;
}

export function surnameOf(fullName: string): string {
    const space = fullName.indexOf(' ');
    return space > 0 ? fullName.slice(0, space) : fullName;
}

/** The heads that count, which is the one case the tail has to agree with. */
const A_NUMBER = new Set(['Nine', 'Seven', 'Three']);

export function placeName(rng: CultivationRNG): string {
    const head = rng.pick(PLACE_HEAD);
    const tail = rng.pick(PLACE_TAIL);
    // Nine Peaks, not Nine Peak. The authored map has the model - Nine Peaks,
    // Three Walls, Six Li - and a counted feature is plural in
    // both languages. The rule used to be a private three-liner here and got
    // `Pass` wrong, reading its final s as a plural already there and minting
    // Nine Pass; the shared one knows that a Witness is one person.
    return `${head} ${A_NUMBER.has(head) ? pluralOf(tail) : tail}`;
}

export function factionName(rng: CultivationRNG): string {
    return `${rng.pick(FACTION_ADJ)} ${rng.pick(FACTION_FORM)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// SEEDING THE PAST
// ─────────────────────────────────────────────────────────────────────────

export interface PriorAgesOptions {
    /** The year the world opens on. The written ages are laid out backwards from here. */
    presentYear?: number;
}

/**
 * Great powers founded and destroyed in an age whose row gives no count. The
 * generator's own figure, kept where the written history says nothing.
 */
const GREAT_POWERS_IN_AN_AGE = 4;

/** The chance a great power of an age that had `some` crossings produced one. */
const A_GREAT_POWER_CROSSED = 0.45;

/**
 * THE WRITTEN AGES, AS THE LEDGER'S ERAS, ENDING ON THE DAY THE WORLD OPENS.
 *
 * Every world is laid on them. The design owner: *"we need the history to be
 * used as well to keep it in sync with the schema migrations"*, and *"so always
 * use the history on a fresh template"*. The ages are authored in
 * `data/cultivation/history.ts` in years before the present; `presentYear` is
 * the year the world opens on, so the Lasting Peace, which began 1,517 years
 * before it, is the era still running and the others are closed behind it.
 *
 * The oldest age has no dateable beginning, so its start is a placeholder twice
 * as far back as its end, and the note says so, so nobody quotes it as a date.
 */
export function historyEras(presentYear: number): Era[] {
    const out: Era[] = [];
    for (const age of AGES) {
        const endYearsAgo = age.endedYearsAgo;
        const beganYearsAgo = age.beganYearsAgo ?? (endYearsAgo === null ? 0 : endYearsAgo * 2);
        out.push({
            id: age.id,
            name: age.name,
            startDay: dayOfYear(presentYear - beganYearsAgo),
            endDay: endYearsAgo === null ? null : dayOfYear(presentYear - endYearsAgo),
            qiDensity: age.qiDensity,
            note:
                age.beganYearsAgo === null
                    ? `${age.note} The beginning is not dateable; the start day here is a placeholder and must not be quoted as a date.`
                    : age.note
        });
    }
    return out;
}

/**
 * Generate what happened inside the written ages.
 *
 * The ages themselves are the catalog's - their names, spans, qi and how well
 * each is remembered (`AGE_FIDELITY`) - and so is what each one's record holds
 * (`record` on the age row): how many great powers, whether they warred,
 * whether a failed crossing scarred the ground, whether they went through the
 * Lid. The seed fills in who, where and when, inside those. Where the two used
 * to disagree the written age won; the commit that laid this down lists each
 * place they did.
 */
/**
 * Take a name off a table without repeating one inside a world.
 */
function drawPlaceName(
    worldSeed: string,
    table: readonly { name: string }[],
    used: Set<string>,
    key: string
): string | null {
    const rng = forStream(worldSeed, 'place-name', key);
    const free = table.filter(t => !used.has(t.name));
    if (free.length === 0) return null;
    const picked = free[rng.int(0, free.length - 1)].name;
    used.add(picked);
    return picked;
}

export function seedPriorAges(seed: string, opts: PriorAgesOptions = {}): PriorAges {
    const ruinNames = new Set<string>();
    const scarNames = new Set<string>();
    const presentYear = opts.presentYear ?? 0;
    const ledger = createLedger();
    ledger.eras.push(...historyEras(presentYear));
    const ruins: Ruin[] = [];
    const scars: Scar[] = [];
    const crossings: Crossing[] = [];
    const lostTechniques: RemnantDescriptor[] = [];
    const buriedTreasures: RemnantDescriptor[] = [];
    const deadFactionNames: string[] = [];

    // The ages before the present, oldest first. The present is filled by the
    // world's own houses and has no generated powers.
    const prior = AGES.filter(age => age.record !== null);
    for (let ageIndex = 0; ageIndex < prior.length; ageIndex++) {
        const age = prior[ageIndex];
        const record = age.record!;
        const era = ledger.eras.find(e => e.id === age.id)!;
        const ageStart = yearOfDay(era.startDay);
        const ageEnd = yearOfDay(era.endDay ?? dayOfYear(presentYear));
        const yearsPerAge = ageEnd - ageStart;
        const qiDensity = era.qiDensity;
        const fidelity: RecordFidelity = AGE_FIDELITY[age.id] ?? 'rumour';
        // Only the latest age before the present still knows why things
        // happened in it.
        const causeKnown = ageIndex >= prior.length - 1;
        const powers = record.greatPowers ?? GREAT_POWERS_IN_AN_AGE;

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

        for (let s = 0; s < powers; s++) {
            const srng = forStream(seed, 'prior-faction', ageIndex, s);
            const name = factionName(srng);
            const seat = placeName(srng);
            const factionId = `dead-faction-${ageIndex}-${s}`;
            deadFactionNames.push(name);

            const foundedYear = ageStart + srng.int(5, Math.floor(yearsPerAge * 0.4));
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
            const crossed = record.crossings === 'every_power'
                || (record.crossings === 'some' && srng.chance(A_GREAT_POWER_CROSSED));
            if (crossed) {
                const ascendedYear = foundedYear + srng.int(50, Math.floor(yearsPerAge * 0.4));
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
                    // THE MISATTRIBUTION IS ABOUT THE RECORD, NOT ABOUT EVERY
                    // LIVING PERSON, and the difference is the content.
                    causeKnown: false,
                    magnitude: 1,
                    data: { days: 11 }
                }));

                // And the ground it left, which outlasts every record of it.
                // See `crossing-enrichment.ts`: a completed crossing lends the
                // ground some qi back for 999 years, decaying from this date,
                // so most of these are already spent and a few are not.
                crossings.push({
                    id: `crossing-${ageIndex}-${s}`,
                    location: seat,
                    year: ascendedYear,
                    originFactId: ascFact.id,
                    crossedName: who,
                    // The house fell later and its compound is on the map as a
                    // ruin at the same seat. Same id this loop pushes below.
                    groundRuinId: `ruin-${ageIndex}-${s}`
                });
            }

            // Failed tribulations leave dead ground the qi never returns to.
            if (record.scars && srng.chance(0.5)) {
                const scarYear = foundedYear + srng.int(20, Math.floor(yearsPerAge * 0.5));
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
                    // Named here rather than where the location is built, so
                    // every scar in a world draws from one pool and no two
                    // share a name. Naming them independently downstream
                    // collided repeatedly - ten scars against fourteen names,
                    // shuffled separately per age, produced duplicates in most
                    // seeds.
                    name: drawPlaceName(seed, SCAR_NAMES, scarNames, `scar-${ageIndex}-${s}`)
                        ?? `the scar at ${scarSite}`,
                    location: scarSite,
                    year: scarYear,
                    originFactId: scarFact.id,
                    failedName: failed,
                    radiusLi: srng.int(2, 30)
                });
            }

            // War over something scarce, then the fall - or, in an age that
            // fought none, the fall alone.
            const warYear = foundedYear + srng.int(60, Math.floor(yearsPerAge * 0.6));
            const warFact = record.wars ? (() => {
                const rival = factionName(srng);
                const contested = placeName(srng);
                return appendFact(ledger, makeFact({
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
            })() : null;

            const fallYear = Math.min(ageEnd - 1, warYear + srng.int(5, 200));
            const fallFact = appendFact(ledger, makeFact({
                day: dayOfYear(fallYear),
                eraId: era.id,
                kind: 'faction_fallen',
                scale: 'regional',
                place: seat,
                factionIds: [factionId],
                summary:
                    `The ${name} ended at ${seat}${warFact ? '' : ' without a war'}. ` +
                    `The compound is still standing; nobody alive can work its formations.`,
                causes: [(warFact ?? foundFact).id],
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
                    gradeBand: Math.max(0, Math.min(4, 3 - ageIndex + srng.int(0, 1))),
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
                    gradeBand: Math.max(0, Math.min(4, 2 - ageIndex + srng.int(0, 2))),
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
                // A place is called something. It is not called its own kind.
                name: drawPlaceName(seed, RUIN_NAMES, ruinNames, `ruin-${ageIndex}-${s}`)
                    ?? `the sealed compound at ${seat}`,
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

    openTheShallowestRuin(seed, presentYear, ledger, ruins);

    return {
        ledger, ruins, scars, crossings, lostTechniques, buriedTreasures, deadFactionNames,
        presentYear
    };
}

// ONE OF THEM IS ALREADY OPEN

/**
 * How long ago somebody got in.
 */
const OPENED_WITHIN_LIVING_MEMORY_YEARS = { min: 40, max: 120 } as const;

function openTheShallowestRuin(
    seed: string,
    presentYear: number,
    ledger: HistoryLedger,
    ruins: Ruin[]
): void {
    if (ruins.length === 0) return;

    const shallowest = ruins.reduce((best, ruin) =>
        ruin.dangerOrdinal < best.dangerOrdinal
        || (ruin.dangerOrdinal === best.dangerOrdinal && ruin.id < best.id)
            ? ruin
            : best);

    // Its own stream. A draw added to an existing one shifts every draw after
    // it, and every prior-age stream is keyed to an age or a faction anyway.
    const rng = forStream(seed, 'ruin-already-open');
    const openedYear = presentYear - rng.int(
        OPENED_WITHIN_LIVING_MEMORY_YEARS.min,
        OPENED_WITHIN_LIVING_MEMORY_YEARS.max
    );
    const who = personName(rng);

    shallowest.opened = true;
    shallowest.openedYear = openedYear;
    shallowest.openedByName = who;

    // The last era, because this happened in the age the world is standing in
    // rather than in the one that sealed the place.
    const era = ledger.eras[ledger.eras.length - 1];
    appendFact(ledger, makeFact({
        day: dayOfYear(openedYear),
        eraId: era?.id ?? null,
        kind: 'ruin_opened',
        // Regional rather than local: this is the thing the province tells
        // strangers about, and a name that never leaves the county is a name
        // nobody can aim at.
        scale: 'regional',
        place: shallowest.location,
        // The house that sealed it, so the opening and the sealing are one
        // story rather than two facts about the same field.
        factionIds: shallowest.formerFactionId ? [shallowest.formerFactionId] : [],
        causes: [shallowest.originFactId],
        summary:
            `${who} got into ${shallowest.name} and came back out. `
            + 'The way in has been open ever since, and what is down there has not '
            + 'moved: it was cut for people nobody in this province can field.',
        visibility: 'public',
        fidelity: 'partial',
        causeKnown: false,
        // High on purpose. This is the one piece of closed ground anybody local
        // can point at, and the news layer weights a fact by how big the world
        // thought it was.
        magnitude: 0.9,
        data: { ruinId: shallowest.id, openedByName: who, openedYear }
    }));
}
