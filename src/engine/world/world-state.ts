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
import { rankName } from '../cultivation/realms.js';
import {
    appendFact,
    createLedger,
    dayOfYear,
    eraForDay,
    openEra,
    placeName,
    queryFacts,
    seedPriorAges,
    yearOfDay,
    type EventConsequences,
    type HistoricalFact,
    type HistoryLedger,
    type PendingFact,
    type PriorAgesOptions
} from './history.js';
import { forStream } from '../cultivation/rng.js';
import {
    locationsFromPriorAges,
    makeLocation,
    type LocationRecord
} from './locations.js';
import { createMemoryStore, type MemoryStore } from './memory.js';
import type { NpcRecord, NpcRelationship } from './npc-state.js';
import type { LineageRecord } from './lineage.js';
import type { WorldRun } from './legacy.js';
import type { OpportunityWindow } from './opportunities.js';
import type { ObjectRecord } from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// FACTIONS
// ─────────────────────────────────────────────────────────────────────────

export interface FactionRecord {
    id: string;
    name: string;
    /** 'sect', 'clan', 'consortium', 'court', 'order', 'city', 'cult'. */
    kind: string;
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
// ACTORS
// ─────────────────────────────────────────────────────────────────────────

export interface InventoryItem {
    itemId: string;
    name: string;
    /** 'pill', 'manual', 'artifact', 'material', 'token', 'key'. */
    kind: string;
    quantity: number;
    note: string;
}

/**
 * The world-facing hard state of one actor.
 *
 * Deliberately separate from the cultivator record in `schema/cultivation.ts`,
 * which owns the body - hp, qi, satiety, injuries, progress. This owns where
 * they are in the world and what they are holding, for both the player and any
 * NPC whose inventory the world actually tracks. The two are joined by
 * `actorId` and neither duplicates the other.
 */
export interface ActorWorldState {
    actorId: string;
    locationId: string | null;
    factionId: string | null;
    factionRankIndex: number;
    inventory: InventoryItem[];
    /** Durable counts: 'spirit_stones', 'contribution', 'rations'. */
    resources: Record<string, number>;
    /** Ties this actor holds. Same shape NPCs use, so inheritance can move them. */
    relationships: NpcRelationship[];
    memoryIds: string[];
    historyFactIds: string[];
    /** Keys, tokens and permits, for sealed doors and gated links. */
    keyIds: string[];
    updatedOnDay: number;
}

export function makeActor(
    init: Partial<ActorWorldState> & Pick<ActorWorldState, 'actorId'>
): ActorWorldState {
    return {
        locationId: null,
        factionId: null,
        factionRankIndex: -1,
        inventory: [],
        resources: {},
        relationships: [],
        memoryIds: [],
        historyFactIds: [],
        keyIds: [],
        updatedOnDay: 0,
        ...init
    };
}

// ─────────────────────────────────────────────────────────────────────────
// SCHEDULE
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
// DURABLE PROCESSES
// ─────────────────────────────────────────────────────────────────────────

export type DurableProcessKind =
    | 'cultivating'
    | 'seclusion'
    | 'travelling'
    | 'recovering'
    | 'imprisoned'
    | 'working'
    | 'custom';

/**
 * Something an actor is doing continuously, stored as a rate.
 *
 * This is the other half of how the world moves without being simulated. A
 * thirty-year seclusion is not thirty years of cultivation ticks; it is one
 * record saying "gaining 1.4 progress and spending 0.6 stones per day, from
 * day X", and `advanceTime` applies it with a multiplication. The cost of a
 * decade is the cost of a day.
 *
 * `perDay` keys are resource names on the actor's `resources` map, so a process
 * can add and subtract several things at once, and a caller can invent a
 * resource without the engine needing to know what it means.
 */
export interface DurableProcess {
    id: string;
    actorId: string;
    kind: DurableProcessKind;
    startedOnDay: number;
    /** Null while open-ended. Applied only up to this day. */
    endsOnDay: number | null;
    perDay: Record<string, number>;
    note: string;
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
    actors: ActorWorldState[];
    schedule: ScheduledEffect[];
    processes: DurableProcess[];
    /** Parent/descendant edges, and what travels down them. */
    lineages: LineageRecord[];
    /** Dated windows that open and close whether or not anyone is watching. */
    opportunities: OpportunityWindow[];
    /** Things worth arguing about: possession, ownership, claim, provenance. */
    objects: ObjectRecord[];
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

    const locations: LocationRecord[] = prior ? locationsFromPriorAges(prior) : [];
    for (let i = 0; i < regionCount; i++) {
        const rng = forStream(opts.seed, 'region', i);
        locations.push(
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

    return {
        id: opts.id ?? `world-${opts.seed}`,
        seed: opts.seed,
        currentDay: presentDay,
        locations,
        factions: [],
        npcs: [],
        actors: [],
        schedule: [],
        processes: [],
        lineages: [],
        opportunities: [],
        objects: [],
        runs: [],
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

export function getLocation(state: WorldState, id: string): LocationRecord | null {
    return state.locations.find(l => l.id === id) ?? null;
}

export function getFaction(state: WorldState, id: string): FactionRecord | null {
    return state.factions.find(f => f.id === id) ?? null;
}

export function getNpc(state: WorldState, id: string): NpcRecord | null {
    return state.npcs.find(n => n.id === id) ?? null;
}

export function getActor(state: WorldState, id: string): ActorWorldState | null {
    return state.actors.find(a => a.actorId === id) ?? null;
}

export function getLineage(state: WorldState, id: string): LineageRecord | null {
    return state.lineages.find(l => l.id === id) ?? null;
}

/** The line a person belongs to, whichever it is. */
export function lineageOf(state: WorldState, memberId: string): LineageRecord | null {
    return state.lineages.find(l => l.memberIds.includes(memberId)) ?? null;
}

export function getObject(state: WorldState, id: string): ObjectRecord | null {
    return state.objects.find(o => o.id === id) ?? null;
}

export function getOpportunity(state: WorldState, id: string): OpportunityWindow | null {
    return state.opportunities.find(o => o.id === id) ?? null;
}

export function upsertLineage(state: WorldState, lineage: LineageRecord): WorldState {
    return { ...state, lineages: replace(state.lineages, l => l.id === lineage.id, lineage) };
}

export function upsertObject(state: WorldState, object: ObjectRecord): WorldState {
    return { ...state, objects: replace(state.objects, o => o.id === object.id, object) };
}

export function upsertOpportunity(state: WorldState, opp: OpportunityWindow): WorldState {
    return { ...state, opportunities: replace(state.opportunities, o => o.id === opp.id, opp) };
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

export interface MutationResult {
    state: WorldState;
    changes: StateChange[];
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

export function upsertActor(state: WorldState, actor: ActorWorldState): WorldState {
    return { ...state, actors: replace(state.actors, a => a.actorId === actor.actorId, actor) };
}

/** Move an actor. The single write path for "where is this character". */
export function moveActor(state: WorldState, actorId: string, locationId: string): MutationResult {
    const actor = getActor(state, actorId);
    if (!actor) return { state, changes: [] };
    const next = { ...actor, locationId, updatedOnDay: state.currentDay };
    return {
        state: upsertActor(state, next),
        changes: [{
            entity: 'actor', entityId: actorId, field: 'locationId',
            from: actor.locationId, to: locationId
        }]
    };
}

export function setActorFaction(
    state: WorldState,
    actorId: string,
    factionId: string | null,
    rankIndex = 0
): MutationResult {
    const actor = getActor(state, actorId);
    if (!actor) return { state, changes: [] };
    const next = {
        ...actor,
        factionId,
        factionRankIndex: factionId ? rankIndex : -1,
        updatedOnDay: state.currentDay
    };
    return {
        state: upsertActor(state, next),
        changes: [
            { entity: 'actor', entityId: actorId, field: 'factionId', from: actor.factionId, to: factionId },
            { entity: 'actor', entityId: actorId, field: 'factionRankIndex', from: actor.factionRankIndex, to: next.factionRankIndex }
        ]
    };
}

/**
 * Change a durable resource count.
 *
 * Clamped at zero, because a negative spirit-stone balance is not a debt - a
 * debt is a `ScheduledEffect` with a due date and somebody's name on it, which
 * is a different thing and is stored differently.
 */
export function adjustResource(
    state: WorldState,
    actorId: string,
    key: string,
    delta: number
): MutationResult {
    const actor = getActor(state, actorId);
    if (!actor) return { state, changes: [] };
    const from = actor.resources[key] ?? 0;
    const to = Math.max(0, from + delta);
    const next = {
        ...actor,
        resources: { ...actor.resources, [key]: to },
        updatedOnDay: state.currentDay
    };
    return {
        state: upsertActor(state, next),
        changes: [{ entity: 'actor', entityId: actorId, field: `resources.${key}`, from, to }]
    };
}

export function addItem(state: WorldState, actorId: string, item: InventoryItem): MutationResult {
    const actor = getActor(state, actorId);
    if (!actor) return { state, changes: [] };
    const at = actor.inventory.findIndex(i => i.itemId === item.itemId);
    const inventory = actor.inventory.slice();
    const from = at >= 0 ? inventory[at].quantity : 0;
    if (at >= 0) inventory[at] = { ...inventory[at], quantity: from + item.quantity };
    else inventory.push({ ...item });
    const next = { ...actor, inventory, updatedOnDay: state.currentDay };
    return {
        state: upsertActor(state, next),
        changes: [{
            entity: 'actor', entityId: actorId, field: `inventory.${item.itemId}`,
            from, to: from + item.quantity
        }]
    };
}

export function removeItem(
    state: WorldState,
    actorId: string,
    itemId: string,
    quantity = 1
): MutationResult {
    const actor = getActor(state, actorId);
    if (!actor) return { state, changes: [] };
    const at = actor.inventory.findIndex(i => i.itemId === itemId);
    if (at < 0) return { state, changes: [] };
    const from = actor.inventory[at].quantity;
    const to = Math.max(0, from - quantity);
    const inventory = actor.inventory.slice();
    if (to === 0) inventory.splice(at, 1);
    else inventory[at] = { ...inventory[at], quantity: to };
    const next = { ...actor, inventory, updatedOnDay: state.currentDay };
    return {
        state: upsertActor(state, next),
        changes: [{ entity: 'actor', entityId: actorId, field: `inventory.${itemId}`, from, to }]
    };
}

export function grantKey(state: WorldState, actorId: string, keyId: string): WorldState {
    const actor = getActor(state, actorId);
    if (!actor || actor.keyIds.includes(keyId)) return state;
    return upsertActor(state, { ...actor, keyIds: actor.keyIds.concat(keyId).sort() });
}

// ─────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────

export interface RecordEventOptions {
    /** Attach the fact to these actors' and NPCs' history lists. */
    linkToActorIds?: readonly string[];
    /** Ten-questions block. Omitted for events that do not claim to be major. */
    consequences?: Partial<EventConsequences>;
}

export interface RecordEventResult {
    state: WorldState;
    fact: HistoricalFact;
    /** Unanswered Consequence Test questions, when consequences were supplied. */
    warnings: string[];
}

/**
 * Write a world event.
 *
 * The single path by which anything becomes true about the past. Appends the
 * fact, links it to whoever it happened to, and - when the caller supplied a
 * consequences block - reports which of the ten questions went unanswered. An
 * event with no consequences once the scene ends was not a major event; the
 * engine's job is to make that visible, not to argue about it.
 */
export function recordEvent(
    state: WorldState,
    fact: PendingFact,
    opts: RecordEventOptions = {}
): RecordEventResult {
    const history = state.history;
    const stored = appendFact(history, {
        ...fact,
        consequences: opts.consequences ? fillConsequenceBlock(opts.consequences) : fact.consequences
    });

    let next = state;
    const linkIds = new Set<string>([
        ...(opts.linkToActorIds ?? []),
        ...fact.actors.map(a => a.id),
        ...fact.witnessIds
    ]);
    for (const id of Array.from(linkIds).sort()) {
        const npc = getNpc(next, id);
        if (npc && !npc.historyFactIds.includes(stored.id)) {
            next = upsertNpc(next, {
                ...npc,
                historyFactIds: npc.historyFactIds.concat(stored.id),
                lastConfirmedOnDay: Math.max(npc.lastConfirmedOnDay, fact.day),
                updatedOnDay: fact.day
            });
        }
        const actor = getActor(next, id);
        if (actor && !actor.historyFactIds.includes(stored.id)) {
            next = upsertActor(next, {
                ...actor,
                historyFactIds: actor.historyFactIds.concat(stored.id),
                updatedOnDay: fact.day
            });
        }
    }

    return {
        state: next,
        fact: stored,
        warnings: opts.consequences ? missingConsequenceQuestions(opts.consequences) : []
    };
}

function fillConsequenceBlock(c: Partial<EventConsequences>): EventConsequences {
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

function missingConsequenceQuestions(c: Partial<EventConsequences>): string[] {
    const out: string[] = [];
    const check = (v: unknown, q: string) => {
        const empty =
            v === undefined || v === null ||
            (typeof v === 'string' && v.trim() === '') ||
            (Array.isArray(v) && v.length === 0);
        if (empty) out.push(q);
    };
    check(c.immediate, 'What changed immediately?');
    check(c.physical, 'What changed physically?');
    check(c.beneficiaries, 'Who benefited?');
    check(c.losers, 'Who lost something?');
    check(c.factionReactions, 'Which factions reacted?');
    check(c.relationshipChanges, 'Which relationships changed?');
    check(c.opportunitiesOpened, 'What new opportunities appeared?');
    check(c.opportunitiesClosed, 'What old opportunities disappeared?');
    check(c.rumours, 'What rumours spread?');
    check(c.tenYearsLater, 'What is still true ten years later?');
    return out;
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

export function cancelScheduled(state: WorldState, effectId: string): WorldState {
    return { ...state, schedule: state.schedule.filter(e => e.id !== effectId) };
}

export interface ProcessInput {
    actorId: string;
    kind: DurableProcessKind;
    perDay: Record<string, number>;
    startedOnDay?: number;
    endsOnDay?: number | null;
    note?: string;
}

/** Begin a continuous activity. Applied by `advanceTime` as a rate times a span. */
export function startProcess(
    state: WorldState,
    input: ProcessInput
): { state: WorldState; process: DurableProcess } {
    const process: DurableProcess = {
        id: `p${state.nextProcessSeq}`,
        actorId: input.actorId,
        kind: input.kind,
        startedOnDay: input.startedOnDay ?? state.currentDay,
        endsOnDay: input.endsOnDay ?? null,
        perDay: { ...input.perDay },
        note: input.note ?? ''
    };
    return {
        state: {
            ...state,
            processes: state.processes.concat(process),
            nextProcessSeq: state.nextProcessSeq + 1
        },
        process
    };
}

export function endProcess(state: WorldState, processId: string, onDay: number): WorldState {
    return {
        ...state,
        processes: state.processes.map(p =>
            p.id === processId ? { ...p, endsOnDay: Math.min(p.endsOnDay ?? onDay, onDay) } : p
        )
    };
}

export function activeProcesses(state: WorldState, onDay = state.currentDay): DurableProcess[] {
    return state.processes.filter(
        p => p.startedOnDay <= onDay && (p.endsOnDay === null || p.endsOnDay > onDay)
    );
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
// SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────

export interface WorldSnapshot {
    worldId: string;
    date: WorldDate;
    /** Where the actor is, and what the place currently is. */
    location: {
        id: string;
        name: string;
        kind: string;
        ambient: string;
        hazards: string[];
        controllingFactionId: string | null;
    } | null;
    actor: {
        id: string;
        factionId: string | null;
        factionRank: string | null;
        resources: Record<string, number>;
        inventory: InventoryItem[];
        keyIds: string[];
        relationships: { name: string; kind: string; standing: number }[];
    } | null;
    /** Who else is here. Names and ranks only; briefs are fetched separately. */
    presentNpcs: { id: string; name: string; rank: string; factionId: string | null }[];
    /** The last few things that happened around here. */
    recentLocalEvents: { id: string; year: number; summary: string }[];
    nextScheduled: { id: string; dueInDays: number; summary: string }[];
}

/**
 * The compact bundle handed to the LLM so it can reason about the present.
 *
 * Small on purpose. The LLM is the reasoning engine, but it reasons from what
 * the database says is true, and the database's job is to hand over the true
 * things that are relevant rather than everything it knows.
 */
export function worldSnapshot(state: WorldState, actorId: string): WorldSnapshot {
    const actor = getActor(state, actorId);
    const location = actor?.locationId ? getLocation(state, actor.locationId) : null;
    const faction = actor?.factionId ? getFaction(state, actor.factionId) : null;

    return {
        worldId: state.id,
        date: dateOf(state),
        location: location
            ? {
                id: location.id,
                name: location.name,
                kind: location.kind,
                ambient: location.ambient,
                hazards: location.hazards.slice(),
                controllingFactionId: location.controllingFactionId
            }
            : null,
        actor: actor
            ? {
                id: actor.actorId,
                factionId: actor.factionId,
                factionRank:
                    faction && actor.factionRankIndex >= 0
                        ? faction.ranks[Math.min(actor.factionRankIndex, faction.ranks.length - 1)]
                        : null,
                resources: { ...actor.resources },
                inventory: actor.inventory.map(i => ({ ...i })),
                keyIds: actor.keyIds.slice(),
                relationships: actor.relationships
                    .slice()
                    .sort((a, b) => Math.abs(b.standing) - Math.abs(a.standing) || (a.targetId < b.targetId ? -1 : 1))
                    .slice(0, 8)
                    .map(r => ({ name: r.targetName, kind: r.kind, standing: r.standing }))
            }
            : null,
        presentNpcs: location
            ? npcsAt(state, location.id).slice(0, 12).map(n => ({
                id: n.id,
                name: n.name,
                rank: rankName(n.cultivation.realmOrdinal),
                factionId: n.factionId
            }))
            : [],
        recentLocalEvents: location
            ? queryFacts(state.history, { locationId: location.id, toDay: state.currentDay + 1 })
                .slice(-6)
                .map(f => ({ id: f.id, year: f.year, summary: f.summary }))
            : [],
        nextScheduled: state.schedule
            .filter(e => !e.fired && e.dueOnDay > state.currentDay)
            .sort((a, b) => a.dueOnDay - b.dueOnDay || (a.id < b.id ? -1 : 1))
            .slice(0, 5)
            .map(e => ({ id: e.id, dueInDays: e.dueOnDay - state.currentDay, summary: e.summary }))
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
        actors: state.actors.map(a => ({
            ...a,
            inventory: a.inventory.map(i => ({ ...i })),
            resources: { ...a.resources },
            relationships: a.relationships.map(r => ({ ...r, factIds: r.factIds.slice() })),
            memoryIds: a.memoryIds.slice(),
            historyFactIds: a.historyFactIds.slice(),
            keyIds: a.keyIds.slice()
        })),
        schedule: state.schedule.map(e => ({ ...e, actorIds: e.actorIds.slice(), data: { ...e.data } })),
        processes: state.processes.map(p => ({ ...p, perDay: { ...p.perDay } })),
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
        runs: state.runs.map(r => ({ ...r })),
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
