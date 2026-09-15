/**
 * The authoritative hard-state store.
 *
 * This is the source of truth. Everything the engine must be able to assert
 * without asking anybody lives here:
 *
 *   the current date          locations           faction membership
 *   where each actor is       factions            important relationships
 *   cultivation standing      NPC records         major world events
 *   inventory and resources   scheduled effects   persistent memories
 *
 * Nothing here is interpretive. There is no opinion, no mood, no narrative, no
 * inference and no behaviour model. If the LLM says a character is furious,
 * that is the LLM's business; if it says a character is holding four hundred
 * spirit stones, this store decides whether that is true.
 *
 * ── Shape ────────────────────────────────────────────────────────────────
 *
 * `WorldState` is a plain, serialisable object graph: arrays of records, no
 * Maps, no class instances, no cyclic references. That is a deliberate
 * constraint rather than an accident. It means a world can be written to SQLite
 * row by row (see `storage/migrations.world.ts`), diffed, snapshotted, and
 * compared byte-for-byte between two runs of the same seed - which is how the
 * determinism guarantee is actually checked rather than asserted.
 *
 * Every mutation is a pure function: state in, new state out, plus a
 * `StateChange` describing what moved. Persistence stays at the edges.
 *
 * ── Time ─────────────────────────────────────────────────────────────────
 *
 * One clock: `currentDay`, an absolute day count. Years are derived, never
 * stored, so nothing can drift out of agreement with anything else. Advancing
 * it is `time.ts`'s job and no function in this file moves it.
 *
 * ── Randomness ───────────────────────────────────────────────────────────
 *
 * `seed` is stored on the world and every stochastic decision anywhere in the
 * engine derives from it through `forStream`. The LLM never rolls anything.
 * That is not about reproducibility alone: a reasoning engine asked to pick a
 * number will pick the one that suits the story it is telling, every time.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import {
    createLedger,
    dayOfYear,
    eraForDay,
    openEra,
    placeName,
    seedPriorAges,
    yearOfDay,
    type HistoricalFact,
    type HistoryLedger,
    type PriorAgesOptions
} from './history.js';
import { forStream } from '../cultivation/rng.js';
import {
    locationsFromPriorAges,
    makeLocation,
    settleTheSeededPastIntoProvinces,
    type LocationRecord
} from './locations.js';
import { createMemoryStore, type MemoryStore } from './memory.js';
import { DEFAULT_LAYER, type AscensionRecord, type LayerKey } from './layers.js';
import {
    isTheWorldsToMove,
    somebodyTheCatalogWrote,
    type NpcRecord
} from './npc-state.js';
import type { LineageRecord } from './lineage.js';
import type { WorldRun } from './legacy.js';
import type { OpportunityWindow } from './opportunities.js';
import type { ObjectRecord } from './possessions.js';
import type { AreaStatus } from './what-is-true-of-a-place-right-now.js';
import type { Absence } from './when-somebody-does-not-come-back.js';

// ─────────────────────────────────────────────────────────────────────────
// FACTIONS
// ─────────────────────────────────────────────────────────────────────────

export interface FactionRecord {
    id: string;
    name: string;
    /** 'sect', 'clan', 'consortium', 'court', 'order', 'city', 'cult'. */
    kind: string;
    /**
     * Which layer this institution belongs to.
     *
     * An immortal sect and a village hall are rows in the same table, ordered
     * by the same fields, and the only difference is which side of the Lid they
     * are on. Keeping them in one table is deliberate: a mortal sect can be a
     * branch of an immortal lineage, and that relationship is unwritable if the
     * two live in separate catalogs.
     */
    layer: LayerKey;
    alignment: 'righteous' | 'neutral' | 'demonic';
    seatLocationId: string | null;
    controlledLocationIds: string[];
    /** Rank ladder, lowest first. Index into it is the authority on rank. */
    ranks: string[];
    /** Standing toward other factions, -1..1, keyed by faction id. */
    standing: Record<string, number>;
    /** Durable resource counts. Free-form keys; 'spirit_stones' is conventional. */
    resources: Record<string, number>;
    description: string;
    foundedOnDay: number | null;
    dissolvedOnDay: number | null;
    tags: string[];
}

export function makeFaction(
    init: Partial<FactionRecord> & Pick<FactionRecord, 'id' | 'name'>
): FactionRecord {
    return {
        kind: 'sect',
        layer: DEFAULT_LAYER,
        alignment: 'neutral',
        seatLocationId: null,
        controlledLocationIds: [],
        ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Patriarch'],
        standing: {},
        resources: {},
        description: '',
        foundedOnDay: null,
        dissolvedOnDay: null,
        tags: [],
        ...init
    };
}

// ─────────────────────────────────────────────────────────────────────────
// SCHEDULED EFFECTS
// ─────────────────────────────────────────────────────────────────────────

export type ScheduledEffectKind =
    | 'lifespan_end'
    | 'seal_opens'
    | 'seal_closes'
    | 'debt_due'
    | 'promise_due'
    | 'meeting'
    | 'assessment'
    | 'war_resolves'
    | 'construction_finishes'
    | 'recovery_finishes'
    | 'concurrent_event'
    | 'custom';

/**
 * A durable consequence with a date on it.
 *
 * This is how the world stays in motion without simulating anybody. A debt
 * falls due in eight years; a sealed domain opens in three hundred; a war the
 * player has nothing to do with resolves next spring. `advanceTime` fires
 * whatever is due, in date order, at O(effects in range) - not O(days).
 */
export interface ScheduledEffect {
    id: string;
    kind: ScheduledEffectKind;
    dueOnDay: number;
    /** Factual statement of what falls due. */
    summary: string;
    actorIds: string[];
    locationId: string | null;
    factionId: string | null;
    /** Repeats this many days after firing. Null for one-shot. */
    repeatDays: number | null;
    /** Stop the advance and hand control back when this fires. */
    interrupts: boolean;
    /**
     * Probability the effect actually lands, 0..1. Resolved by the engine from
     * the world seed - the LLM does not get to decide whether its own scheduled
     * consequence happened.
     */
    chance: number;
    /** True once it has fired and is not repeating. */
    fired: boolean;
    firedOnDay: number | null;
    data: Record<string, string | number | boolean | null>;
}

export function makeScheduledEffect(
    init: Partial<ScheduledEffect> & Pick<ScheduledEffect, 'id' | 'kind' | 'dueOnDay' | 'summary'>
): ScheduledEffect {
    return {
        actorIds: [],
        locationId: null,
        factionId: null,
        repeatDays: null,
        interrupts: false,
        chance: 1,
        fired: false,
        firedOnDay: null,
        data: {},
        ...init
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE WORLD
// ─────────────────────────────────────────────────────────────────────────

export interface WorldState {
    id: string;
    /** Every stochastic system in this world derives from here. */
    seed: string;
    /** Absolute day. The only clock. Years are derived. */
    currentDay: number;

    locations: LocationRecord[];
    factions: FactionRecord[];
    npcs: NpcRecord[];
    schedule: ScheduledEffect[];
    /** Parent/descendant edges, and what travels down them. */
    lineages: LineageRecord[];
    /** Dated windows that open and close whether or not anyone is watching. */
    opportunities: OpportunityWindow[];
    /** Things worth arguing about: possession, ownership, claim, provenance. */
    objects: ObjectRecord[];
    /**
     * What is true of an area now, and stops being true later.
     *
     * A famine, a pass held, a beast tide running, a district worked out, a
     * war. The counterpart to `LocationChange`, which is what a place BECAME
     * and is permanent: this is what is true of it for a while. Availability of
     * mundane goods is read off here rather than counted anywhere, which is the
     * whole of the design - a famine stops the millet; travellers buying meals
     * never caused one. See `what-is-true-of-a-place-right-now.ts`.
     */
    statuses: AreaStatus[];
    /**
     * Lives that have been played in this world, oldest first.
     *
     * The world outlives its runs. Permadeath is enforced on the cultivator -
     * a life is played once - and resetting the world with them was the wrong
     * half: the ruins a new character digs through should be the previous
     * character's. A run is a life lived inside this world, and this is the
     * world's record that it happened.
     */
    runs: WorldRun[];
    /**
     * Everyone who has gone through the Lid, and what became of them.
     *
     * The engine's own answer to a question the world below cannot ask. There
     * is no signal across the boundary, so a sect's claim to a living ancestor
     * is a claim - frequently an honest one made by people who do not know.
     * Nothing that renders to a player may read `afterCrossing`.
     */
    ascensions: AscensionRecord[];
    /**
     * People the world cannot currently account for, and what their being gone
     * is costing the people who held ties to them.
     *
     * Open ones and closed ones alike: an absence is never removed, because
     * the snapshot of who was waiting on the day somebody vanished is the only
     * thing that can answer "what did it cost me" two hundred years later, and
     * a homecoming is a question asked against it.
     *
     * It lives here rather than being carried beside the world because the
     * world is what fails to account for somebody, and because a list passed
     * as an argument does not survive a restart. `driver.ts` advances it on
     * the yearly line; `when-somebody-does-not-come-back.ts` owns the shape.
     */
    absences: Absence[];

    history: HistoryLedger;
    memories: MemoryStore;

    /**
     * Living NPCs the world drifts back toward.
     *
     * A population that only dies is not a world: run five centuries without
     * this and the roster empties, the factions fold for want of members, and
     * the simulation reports a collapse that is an artefact of the model rather
     * than anything that happened. Demography closes the gap each year.
     */
    populationTarget: number;

    nextNpcSeq: number;
    nextEffectSeq: number;
    nextProcessSeq: number;
    /** Bumped when the shape changes, so a loader can migrate a saved world. */
    version: number;
}

export const WORLD_STATE_VERSION = 1;

export interface CreateWorldOptions {
    id?: string;
    seed: string;
    /** Year the present age begins. Prior ages are laid out behind it. */
    presentYear?: number;
    /** Qi density of the present age. Low by default; the world is late. */
    qiDensity?: number;
    /** Ordinary inhabited regions to create alongside the seeded remnants. */
    regionCount?: number;
    priorAges?: PriorAgesOptions;
    /** Skip the seeded past entirely. Used by tests that want a bare world. */
    skipPriorAges?: boolean;
}

/**
 * Build a world with a past.
 *
 * `seedPriorAges` writes several ages of real history first, and the ruins and
 * scars it leaves become locations whose `originFactId` points back at the
 * dated event that produced them. Nothing in the world is decorative: a sealed
 * compound is sealed because a specific power ended on a specific day, and the
 * layered location history says so.
 */
export function createWorld(opts: CreateWorldOptions): WorldState {
    const presentYear = opts.presentYear ?? 0;
    const presentDay = dayOfYear(presentYear);
    const qiDensity = opts.qiDensity ?? 0.34;
    const regionCount = opts.regionCount ?? 6;

    const prior = opts.skipPriorAges
        ? null
        : seedPriorAges(opts.seed, { presentYear, ...(opts.priorAges ?? {}) });

    const history: HistoryLedger = prior ? prior.ledger : createLedger();
    openEra(history, {
        id: `era-${history.eras.length}`,
        name: 'the present age',
        startDay: presentDay,
        qiDensity,
        note:
            `Ambient qi stands at ${qiDensity.toFixed(2)} of the richest ground ` +
            `the world has carried. No confirmed ascension in living memory.`
    });

    const unplaced: LocationRecord[] = prior ? locationsFromPriorAges(prior) : [];
    for (let i = 0; i < regionCount; i++) {
        const rng = forStream(opts.seed, 'region', i);
        unplaced.push(
            makeLocation({
                id: `loc-region-${i}`,
                name: placeName(rng),
                kind: 'region',
                description: 'Inhabited ground. Somebody built the granary against a wall they did not make.',
                ambient: rng.weighted({ thin: 55, normal: 35, dense: 8, spirit_tide: 2 }),
                qiDensity
            })
        );
    }

    // The provinces exist only now, so this is the first moment the seeded past
    // can be told where it stands. `seedWorld` asks for no provinces here and
    // takes them from the catalog, so it runs this again once it has them.
    const locations = settleTheSeededPastIntoProvinces(unplaced, opts.seed);

    return {
        id: opts.id ?? `world-${opts.seed}`,
        seed: opts.seed,
        currentDay: presentDay,
        locations,
        factions: [],
        npcs: [],
        schedule: [],
        lineages: [],
        opportunities: [],
        objects: [],
        statuses: [],
        runs: [],
        ascensions: [],
        absences: [],
        populationTarget: 0,
        history,
        memories: createMemoryStore(),
        nextNpcSeq: 1,
        nextEffectSeq: 1,
        nextProcessSeq: 1,
        version: WORLD_STATE_VERSION
    };
}

// ─────────────────────────────────────────────────────────────────────────
// TIME READERS
// Reading the clock is free. Moving it belongs to `time.ts`.
// ─────────────────────────────────────────────────────────────────────────

export function currentYear(state: WorldState): number {
    return yearOfDay(state.currentDay);
}

export interface WorldDate {
    absoluteDay: number;
    year: number;
    dayOfYear: number;
}

export function dateOf(state: WorldState, day = state.currentDay): WorldDate {
    return {
        absoluteDay: day,
        year: yearOfDay(day),
        dayOfYear: day - yearOfDay(day) * DAYS_PER_YEAR
    };
}

export function currentEraQiDensity(state: WorldState): number {
    return eraForDay(state.history, state.currentDay)?.qiDensity ?? 1;
}

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

/**
 * A memo of id -> position, per row array, so a lookup is not a scan.
 *
 * These three were `Array.prototype.find`, which is O(rows) and is asked
 * millions of times in a long world advance. Measured with `--cpu-prof` on one
 * seed at 1,200 years: `highestOrdinalIn` - two `getNpc` calls per actor per
 * fact per teller - cost 0.04ms per simulated year at 100 years and 19.9ms at
 * 1,200, which was 26% of the whole per-year cost and the largest single term
 * in it. The growth is the product of two sizes: the ledger decides how many
 * lookups happen and the population decides what each one costs.
 *
 * THIS IS A MEMO, NOT A SECOND COPY. The arrays stay the only store. The map
 * is a hint that is VERIFIED on every read - the row at the remembered index
 * has to still carry the id asked for - and a hint that fails falls through to
 * the scan the function used to do. So no mutation anywhere can make a lookup
 * answer differently from the scan; the worst a stale map can do is cost one.
 *
 * Keyed on the array object rather than on the world, because that is what
 * actually decides whether the positions still hold: `upsertNpc` and
 * `cloneWorld` build new arrays and get fresh maps for free, and the one
 * in-place mutation the world performs is `push`, which is why a map built at
 * a shorter length is extended rather than rebuilt. Same shape as the
 * recurrence index in `a-fact-that-keeps-happening-is-one-row.ts` - a WeakMap
 * beside the rows, a cursor, a rebuild when the rows shrink - so the repo has
 * one way of holding an index and not two.
 */
const rowIndexes = new WeakMap<object, { map: Map<string, number>; built: number }>();

/**
 * Where this id sits, or -1. Exactly what `findIndex` answers.
 *
 * The index is the half the world actually needs most of the time, because a
 * row is changed by writing a new one over its slot - `state.npcs[at] = {
 * ...npc, ... }` - and twenty-odd call sites were each scanning the population
 * to find that slot.
 */
export function indexById<T extends { id: string }>(rows: readonly T[], id: string): number {
    let index = rowIndexes.get(rows);
    if (!index || index.built > rows.length) {
        index = { map: new Map(), built: 0 };
        rowIndexes.set(rows, index);
    }
    // First position wins, because `find` returns the first match and a
    // duplicated id must not start resolving to a different row than it did.
    for (let i = index.built; i < rows.length; i++) {
        if (!index.map.has(rows[i].id)) index.map.set(rows[i].id, i);
    }
    index.built = rows.length;

    const at = index.map.get(id);
    if (at !== undefined && rows[at] !== undefined && rows[at].id === id) return at;
    // The hint was wrong or absent: answer from the rows themselves, and
    // remember where the answer was.
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === id) {
            index.map.set(id, i);
            return i;
        }
    }
    return -1;
}

export function rowById<T extends { id: string }>(rows: readonly T[], id: string): T | null {
    const at = indexById(rows, id);
    return at < 0 ? null : rows[at];
}

export function getLocation(state: WorldState, id: string): LocationRecord | null {
    return rowById(state.locations, id);
}

export function getFaction(state: WorldState, id: string): FactionRecord | null {
    return rowById(state.factions, id);
}

export function getNpc(state: WorldState, id: string): NpcRecord | null {
    return rowById(state.npcs, id);
}

/** The line a person belongs to, whichever it is. */
export function lineageOf(state: WorldState, memberId: string): LineageRecord | null {
    return state.lineages.find(l => l.memberIds.includes(memberId)) ?? null;
}

export function getObject(state: WorldState, id: string): ObjectRecord | null {
    return state.objects.find(o => o.id === id) ?? null;
}

export function upsertLineage(state: WorldState, lineage: LineageRecord): WorldState {
    return { ...state, lineages: replace(state.lineages, l => l.id === lineage.id, lineage) };
}

export function upsertObject(state: WorldState, object: ObjectRecord): WorldState {
    return { ...state, objects: replace(state.objects, o => o.id === object.id, object) };
}

export function getAreaStatus(state: WorldState, id: string): AreaStatus | null {
    return state.statuses.find(s => s.id === id) ?? null;
}

/**
 * Write a status. The only path, so beginning one, lifting one and extending
 * one are the same call with a different record.
 */
export function upsertAreaStatus(state: WorldState, status: AreaStatus): WorldState {
    return { ...state, statuses: replace(state.statuses, s => s.id === status.id, status) };
}

export function npcsAt(state: WorldState, locationId: string): NpcRecord[] {
    return state.npcs
        .filter(n => n.locationId === locationId && n.status === 'alive')
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function npcsInFaction(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs
        .filter(n => n.factionId === factionId && n.status === 'alive')
        .sort((a, b) => b.factionRankIndex - a.factionRankIndex || (a.id < b.id ? -1 : 1));
}

export function locationsControlledBy(state: WorldState, factionId: string): LocationRecord[] {
    return state.locations.filter(l => l.controllingFactionId === factionId);
}

// ─────────────────────────────────────────────────────────────────────────
// MUTATION
// Every one of these is pure and reports what it changed.
// ─────────────────────────────────────────────────────────────────────────

export interface StateChange {
    /** 'location', 'faction', 'npc', 'actor', 'schedule', 'history', 'memory'. */
    entity: string;
    entityId: string;
    field: string;
    from: string | number | boolean | null;
    to: string | number | boolean | null;
}

function replace<T>(items: readonly T[], match: (t: T) => boolean, next: T): T[] {
    const at = items.findIndex(match);
    if (at < 0) return items.concat(next);
    const out = items.slice();
    out[at] = next;
    return out;
}

export function upsertLocation(state: WorldState, location: LocationRecord): WorldState {
    return { ...state, locations: replace(state.locations, l => l.id === location.id, location) };
}

export function upsertFaction(state: WorldState, faction: FactionRecord): WorldState {
    return { ...state, factions: replace(state.factions, f => f.id === faction.id, faction) };
}

export function upsertNpc(state: WorldState, npc: NpcRecord): WorldState {
    return { ...state, npcs: replace(state.npcs, n => n.id === npc.id, npc) };
}

// ─────────────────────────────────────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────────────────────────────────────

export interface ScheduleInput {
    kind: ScheduledEffectKind;
    dueOnDay: number;
    summary: string;
    actorIds?: string[];
    locationId?: string | null;
    factionId?: string | null;
    repeatDays?: number | null;
    interrupts?: boolean;
    chance?: number;
    data?: Record<string, string | number | boolean | null>;
}

/** Put a dated consequence on the books. */
export function schedule(state: WorldState, input: ScheduleInput): { state: WorldState; effect: ScheduledEffect } {
    const effect = makeScheduledEffect({
        id: `e${state.nextEffectSeq}`,
        kind: input.kind,
        dueOnDay: input.dueOnDay,
        summary: input.summary,
        actorIds: input.actorIds ?? [],
        locationId: input.locationId ?? null,
        factionId: input.factionId ?? null,
        repeatDays: input.repeatDays ?? null,
        interrupts: input.interrupts ?? false,
        chance: input.chance ?? 1,
        data: input.data ?? {}
    });
    return {
        state: {
            ...state,
            schedule: state.schedule.concat(effect),
            nextEffectSeq: state.nextEffectSeq + 1
        },
        effect
    };
}

/** Effects due in a window, in fire order. The query `advanceTime` runs on. */
export function pendingEffects(
    state: WorldState,
    fromDay: number,
    toDay: number
): ScheduledEffect[] {
    return state.schedule
        .filter(e => !e.fired && e.dueOnDay > fromDay && e.dueOnDay <= toDay)
        .sort((a, b) => a.dueOnDay - b.dueOnDay || (a.id < b.id ? -1 : 1));
}

// ─────────────────────────────────────────────────────────────────────────
// THE MORTAL DEAD ARE NOT KEPT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this row is one the world has no way to speak of any more.
 *
 * The design owner, generalising the mortal ruling to death: *"if sibling dies
 * as a mortal, drop. if dies as a cultivator, mark as dead in entities. this is
 * true for everyone"*, and on being shown the pile it makes - *"nobody
 * remembers them"*.
 *
 * Four terms, and each excludes a population that is NOT what the ruling is
 * about:
 *
 *   `physically_dead`   death, and only death. `missing` is the engine saying
 *                       it does not know, which is the ordinary condition of
 *                       somebody who walked into a mountain - and an absence is
 *                       a live question `when-somebody-does-not-come-back.ts`
 *                       is still asking. Status and not `diedOnDay`: 110 rows
 *                       in the measured world below carry no `diedOnDay`
 *                       because they are missing rather than dead, so a
 *                       predicate reading that field would disagree with every
 *                       predicate reading this one.
 *   below foundation    the same line the kin and marriage passes use, and it
 *                       is not chosen here: `realms.ts` says below it a
 *                       character is a mortal with a party trick and above it
 *                       they are a cultivator.
 *   the world's to move the player's own row is a run, not a farmer.
 *   nobody wrote them   see {@link somebodyTheCatalogWrote}.
 *
 * And one term that is a question about the world rather than about the row,
 * so it is supplied by the caller: `remembered`. See {@link
 * theWorldForgetsTheMortalDead}.
 */
function theWorldHasNoWayToSpeakOf(npc: NpcRecord, remembered: ReadonlySet<string>): boolean {
    return npc.status === 'physically_dead'
        && npc.cultivation.realmOrdinal < FOUNDATION_ORDINAL
        && isTheWorldsToMove(npc)
        && !somebodyTheCatalogWrote(npc)
        && !remembered.has(npc.id);
}

/**
 * Everybody a priced deed names.
 *
 * The one exception to the drop, and it is the ruling's own reason rather than
 * a softening of it: what is being deleted is *the corpses of farmers the
 * engine was never able to say anything about*, and a man whose brother still
 * carries the account for his killing is not one of them. A priced deed IS an
 * account - `aDeedEntersTheWorld` stamps `deedWeight` on every fact it writes,
 * and `what-a-telling-lands-on.ts` reads the same field to decide what a person
 * can be told - so this asks the field rather than holding a second opinion
 * about which wrongs count.
 *
 * Measured over two hundred years of one seeded world: 928 rows swept, 9 kept
 * by this. It is the exception being small that makes it an exception.
 */
function whoIsStillCarriedFor(facts: readonly HistoricalFact[]): Set<string> {
    const remembered = new Set<string>();
    for (const fact of facts) {
        if (!('deedWeight' in fact.data)) continue;
        for (const actor of fact.actors) remembered.add(actor.id);
    }
    return remembered;
}

/** What one sweep took out. Reporting only; nothing in the simulation reads it. */
export interface WhatTheWorldForgot {
    people: number;
    facts: number;
    lineages: number;
    absences: number;
    memories: number;
}

const NOTHING_WAS_FORGOTTEN: WhatTheWorldForgot =
    Object.freeze({ people: 0, facts: 0, lineages: 0, absences: 0, memories: 0 });

/** Any id-shaped column whose value is somebody nobody remembers reads null. */
function withoutTheForgotten(
    data: Record<string, string | number | boolean | null>,
    gone: ReadonlySet<string>
): Record<string, string | number | boolean | null> {
    let out = data;
    for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'string' || !gone.has(value)) continue;
        if (out === data) out = { ...data };
        out[key] = null;
    }
    return out;
}

/**
 * Take the mortal dead out of the world, and the memory of them with it.
 *
 * ── WHY A SWEEP AND NOT A DELETE AT THE DEATH SITE ───────────────────────
 *
 * `markDead` has six call sites and the yearly pass holds NPC positions as
 * indexes across hundreds of lines (`state.npcs[at] = ...`). Splicing a row out
 * from under that shifts every index above it, so the deletion happens once,
 * between passes, when nothing is holding a position. It also means the
 * estate, the goals and the accounts a death hands on have all already been
 * settled against a row that was still there - which is the order
 * `settleNpcDeath` requires and the wrongs seeder had to be taught once
 * already.
 *
 * ── WHAT GOES WITH THEM ──────────────────────────────────────────────────
 *
 * Everything, because the ruling is not tidiness - it is that this world has no
 * way to speak of a farmer who died and so does not hold one. Measured on a
 * seeded world at two hundred years, 1,007 dead mortals were named 24,000
 * times: 10,413 as a witness to somebody else's event, 3,762 as an actor in
 * one, 2,345 as somebody's living relative, and the rest across lineages,
 * objects, absences and goals.
 *
 * A fact goes when everybody it names is forgotten. One that also names
 * somebody the world keeps stays, with the forgotten struck off its actors;
 * its `summary` is prose already written and may still contain the name, the
 * way a summary may still name a village that burned down. No priced deed is
 * ever dropped by construction, because everybody one names is kept - see
 * {@link whoIsStillCarriedFor}.
 *
 * Mutates in place. Every other sweep at this layer does, the caller holds one
 * world handle, and the arrays are REPLACED rather than spliced so the row
 * index cache in {@link indexById} rebuilds instead of going stale.
 */
export function theWorldForgetsTheMortalDead(state: WorldState): WhatTheWorldForgot {
    const remembered = whoIsStillCarriedFor(state.history.facts);
    const gone = new Set<string>();
    for (const npc of state.npcs) {
        if (theWorldHasNoWayToSpeakOf(npc, remembered)) gone.add(npc.id);
    }
    if (gone.size === 0) return NOTHING_WAS_FORGOTTEN;

    const kept = (id: string): boolean => !gone.has(id);
    const nulled = (id: string | null): string | null =>
        id !== null && gone.has(id) ? null : id;

    // The facts first: the ids of the ones that go have to be struck off
    // everything that cites them, and every later table does that strike.
    const dropped = new Set<string>();
    for (const fact of state.history.facts) {
        if (fact.actors.length > 0 && fact.actors.every(a => gone.has(a.id))) {
            dropped.add(fact.id);
        }
    }
    const isDropped = (id: string): boolean => dropped.has(id);
    const stillOnRecord = (id: string): boolean => !dropped.has(id);

    state.history.facts = state.history.facts
        .filter(fact => stillOnRecord(fact.id))
        .map(fact => ({
            ...fact,
            actors: fact.actors.filter(actor => kept(actor.id)),
            witnessIds: fact.witnessIds.filter(kept),
            causes: fact.causes.filter(stillOnRecord),
            data: withoutTheForgotten(fact.data, gone),
            consequences: fact.consequences === null ? null : {
                ...fact.consequences,
                beneficiaries: fact.consequences.beneficiaries.filter(a => kept(a.id)),
                losers: fact.consequences.losers.filter(a => kept(a.id)),
                relationshipChanges: fact.consequences.relationshipChanges
                    .filter(change => kept(change.aId) && kept(change.bId))
            }
        }));

    const forgottenMemories = new Set(
        state.memories.records.filter(m => gone.has(m.ownerId)).map(m => m.id));
    state.memories.records = state.memories.records
        .filter(m => !forgottenMemories.has(m.id))
        .map(m => ({
            ...m,
            actorIds: m.actorIds.filter(kept),
            sourceFactIds: m.sourceFactIds.filter(stillOnRecord),
            compressedFromIds: m.compressedFromIds.filter(id => !forgottenMemories.has(id))
        }));

    state.npcs = state.npcs
        .filter(npc => kept(npc.id))
        .map(npc => ({
            ...npc,
            bodyId: nulled(npc.bodyId),
            relationships: npc.relationships
                .filter(tie => kept(tie.targetId))
                .map(tie => ({
                    ...tie,
                    inheritedFromId: nulled(tie.inheritedFromId),
                    factIds: tie.factIds.filter(stillOnRecord)
                })),
            // A goal handed on by somebody nobody remembers, or aimed at one, is
            // a memory of them wearing a goal. `settleNpcDeath` is what put it
            // here, and it goes back out the same door the person did.
            goals: npc.goals.filter(goal =>
                kept(goal.originHolderId)
                && (goal.inheritedFromId === null || kept(goal.inheritedFromId))
                && (goal.targetId === null || kept(goal.targetId))),
            activity: npc.activity === null
                ? null
                : { ...npc.activity, withIds: npc.activity.withIds.filter(kept) },
            historyFactIds: npc.historyFactIds.filter(stillOnRecord),
            memoryIds: npc.memoryIds.filter(id => !forgottenMemories.has(id))
        }));

    const lineagesBefore = state.lineages.length;
    state.lineages = state.lineages
        .map(line => {
            const memberIds = line.memberIds.filter(kept);
            return {
                ...line,
                memberIds,
                // The earliest member the world still holds. A line whose
                // founder is forgotten still has people in it, and they are
                // still a family; what is gone is how far back it can be traced.
                founderId: kept(line.founderId) ? line.founderId : (memberIds[0] ?? line.founderId),
                edges: line.edges.filter(e => kept(e.parentId) && kept(e.childId)),
                inheritedEnemyIds: line.inheritedEnemyIds.filter(kept)
            };
        })
        .filter(line => line.memberIds.length > 0);

    state.objects = state.objects.map(object => ({
        ...object,
        possessorId: nulled(object.possessorId),
        ownerId: nulled(object.ownerId),
        // Null is a real answer here and often the correct one: nobody's.
        ownerName: object.ownerId !== null && gone.has(object.ownerId) ? '' : object.ownerName,
        claims: object.claims
            .filter(claim => kept(claim.claimantId))
            .map(claim => ({
                ...claim,
                acknowledgedByIds: claim.acknowledgedByIds.filter(kept),
                evidenceFactIds: claim.evidenceFactIds.filter(stillOnRecord)
            })),
        // The NAME columns are checked too, and that is not belt and braces:
        // `currentHolderName` falls back to the possessor's id when no link in
        // the chain names them, so a name column legitimately holds an id.
        provenance: object.provenance
            .filter(link =>
                (link.holderId === null || kept(link.holderId))
                && (link.previousHolderId === null || kept(link.previousHolderId))
                && kept(link.holderName)
                && (link.previousHolderName === null || kept(link.previousHolderName)))
            .map(link => ({
                ...link,
                factId: link.factId !== null && isDropped(link.factId) ? null : link.factId
            })),
        knownOwnershipBy: object.knownOwnershipBy.filter(kept),
        data: withoutTheForgotten(object.data, gone)
    }));

    const absencesBefore = (state.absences ?? []).length;
    state.absences = (state.absences ?? [])
        .filter(absence => kept(absence.absenteeId))
        .map(absence => ({
            ...absence,
            witnessIds: absence.witnessIds.filter(kept),
            toldIds: absence.toldIds.filter(kept),
            ties: absence.ties.filter(tie => kept(tie.holderId))
        }));

    state.opportunities = state.opportunities.map(window => ({
        ...window,
        claimedById: nulled(window.claimedById),
        knownToIds: window.knownToIds.filter(kept),
        data: withoutTheForgotten(window.data, gone)
    }));

    state.locations = state.locations.map(location => ({
        ...location,
        data: withoutTheForgotten(location.data, gone),
        changes: location.changes.map(change => ({
            ...change,
            causeFactId: change.causeFactId !== null && isDropped(change.causeFactId)
                ? null
                : change.causeFactId
        }))
    }));

    // An effect that was about somebody and is now about nobody would fire on
    // an empty cast. One that never named anybody is about a place and stays.
    state.schedule = state.schedule
        .filter(effect => effect.actorIds.length === 0 || effect.actorIds.some(kept))
        .map(effect => ({
            ...effect,
            actorIds: effect.actorIds.filter(kept),
            data: withoutTheForgotten(effect.data, gone)
        }));

    state.ascensions = state.ascensions.filter(a => kept(a.residentId));

    return {
        people: gone.size,
        facts: dropped.size,
        lineages: lineagesBefore - state.lineages.length,
        absences: absencesBefore - state.absences.length,
        memories: forgottenMemories.size
    };
}

/**
 * Deep copy.
 *
 * Used by `advanceTime` and by any caller that wants to keep the old state.
 * Structured rather than JSON round-tripped so the shape stays checked by the
 * compiler and an accidental `undefined` cannot silently vanish.
 */
export function cloneWorld(state: WorldState): WorldState {
    return {
        ...state,
        locations: state.locations.map(l => ({
            ...l,
            thresholds: { ...l.thresholds },
            hazards: l.hazards.slice(),
            affinities: l.affinities.map(a => ({ ...a })),
            links: l.links.map(k => ({ ...k })),
            tags: l.tags.slice(),
            data: { ...l.data },
            origin: {
                ...l.origin,
                thresholds: { ...l.origin.thresholds },
                hazards: l.origin.hazards.slice(),
                affinities: l.origin.affinities.map(a => ({ ...a }))
            },
            changes: l.changes.map(c => ({
                ...c,
                attributedCauses: c.attributedCauses.slice(),
                patch: { ...c.patch }
            }))
        })),
        factions: state.factions.map(f => ({
            ...f,
            controlledLocationIds: f.controlledLocationIds.slice(),
            ranks: f.ranks.slice(),
            standing: { ...f.standing },
            resources: { ...f.resources },
            tags: f.tags.slice()
        })),
        npcs: state.npcs.map(n => ({
            ...n,
            identity: { ...n.identity, titles: n.identity.titles.slice(), aliases: n.identity.aliases.slice() },
            cultivation: {
                ...n.cultivation,
                attributes: { ...n.cultivation.attributes },
                techniqueIds: n.cultivation.techniqueIds.slice(),
                specialties: n.cultivation.specialties.slice()
            },
            goals: n.goals.map(g => ({ ...g })),
            relationships: n.relationships.map(r => ({ ...r, factIds: r.factIds.slice() })),
            historyFactIds: n.historyFactIds.slice(),
            memoryIds: n.memoryIds.slice(),
            tags: n.tags.slice()
        })),
        schedule: state.schedule.map(e => ({ ...e, actorIds: e.actorIds.slice(), data: { ...e.data } })),
        lineages: state.lineages.map(l => ({
            ...l,
            memberIds: l.memberIds.slice(),
            edges: l.edges.map(e => ({ ...e })),
            traits: l.traits.map(t => ({ ...t, modifiers: t.modifiers.map(m => ({ ...m })) })),
            holdings: { ...l.holdings },
            obligationIds: l.obligationIds.slice(),
            inheritedEnemyIds: l.inheritedEnemyIds.slice(),
            tags: l.tags.slice()
        })),
        opportunities: state.opportunities.map(o => ({
            ...o,
            factionIds: o.factionIds.slice(),
            requirements: { ...o.requirements },
            knownToIds: o.knownToIds.slice(),
            tags: o.tags.slice(),
            data: { ...o.data }
        })),
        statuses: state.statuses.map(s => ({
            ...s,
            cause: { ...s.cause },
            signs: s.signs.slice(),
            stops: s.stops.slice()
        })),
        runs: state.runs.map(r => ({ ...r })),
        ascensions: state.ascensions.map(a => ({ ...a })),
        absences: (state.absences ?? []).map(a => ({
            ...a,
            witnessIds: a.witnessIds.slice(),
            toldIds: a.toldIds.slice(),
            ties: a.ties.map(t => ({ ...t }))
        })),
        objects: state.objects.map(o => ({
            ...o,
            claims: o.claims.map(c => ({
                ...c,
                acknowledgedByIds: c.acknowledgedByIds.slice(),
                evidenceFactIds: c.evidenceFactIds.slice()
            })),
            provenance: o.provenance.map(v => ({ ...v })),
            knownOwnershipBy: o.knownOwnershipBy.slice(),
            tags: o.tags.slice(),
            data: { ...o.data }
        })),
        history: {
            eras: state.history.eras.map(e => ({ ...e })),
            facts: state.history.facts.map(f => ({
                ...f,
                actors: f.actors.map(a => ({ ...a })),
                witnessIds: f.witnessIds.slice(),
                factionIds: f.factionIds.slice(),
                causes: f.causes.slice(),
                locationChangeIds: f.locationChangeIds.slice(),
                data: { ...f.data },
                consequences: f.consequences ? { ...f.consequences } : null
            })),
            nextFactSeq: state.history.nextFactSeq
        },
        memories: {
            records: state.memories.records.map(m => ({
                ...m,
                actorIds: m.actorIds.slice(),
                factionIds: m.factionIds.slice(),
                tags: m.tags.slice(),
                sourceFactIds: m.sourceFactIds.slice(),
                compressedFromIds: m.compressedFromIds.slice()
            })),
            nextSeq: state.memories.nextSeq
        }
    };
}
