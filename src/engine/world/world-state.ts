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
import {
    createLedger,
    dayOfYear,
    eraForDay,
    openEra,
    placeName,
    seedPriorAges,
    yearOfDay,
    type HistoryLedger,
    type PriorAgesOptions
} from './history.js';
import { forStream } from '../cultivation/rng.js';
import {
    locationsFromPriorAges,
    makeLocation,
    type LocationRecord
} from './locations.js';
import { createMemoryStore, type MemoryStore } from './memory.js';
import { DEFAULT_LAYER, type AscensionRecord, type LayerKey } from './layers.js';
import type { NpcRecord } from './npc-state.js';
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

export function getLocation(state: WorldState, id: string): LocationRecord | null {
    return state.locations.find(l => l.id === id) ?? null;
}

export function getFaction(state: WorldState, id: string): FactionRecord | null {
    return state.factions.find(f => f.id === id) ?? null;
}

export function getNpc(state: WorldState, id: string): NpcRecord | null {
    return state.npcs.find(n => n.id === id) ?? null;
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

export function cancelScheduled(state: WorldState, effectId: string): WorldState {
    return { ...state, schedule: state.schedule.filter(e => e.id !== effectId) };
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
