/**
 * The world the runs happen inside. One implementation, for every caller.
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../../storage/index.js';
import { readWorldRevision } from './world-revision.js';
import { SectRepository } from '../../storage/repos/sect.repo.js';
import {
    advanceWorldForPlay,
    loadCultivationCatalog,
    recordRun as recordRunOnState,
    runSeedFor,
    seedWorld,
    simpleAccess,
    type Observer,
    type PlayAdvanceResult,
    type PlayerAccess,
    type WorldCatalog,
    type WorldRun,
    type WorldState
} from '../../engine/world/index.js';
import { WorldStateRepository } from '../../storage/repos/world-state.repo.js';
import { writeObligations } from '../../storage/repos/obligation.repo.js';
import { createObligation } from '../../engine/social/grudges.js';
import type { Cultivator, Run } from '../../schema/cultivation.js';
import { KnowledgeGate, placeKey } from '../../web/knowledge.js';

/**
 * Living NPCs a new world keeps records for.
 */
export const WORLD_POPULATION = 240;

// ─────────────────────────────────────────────────────────────────────────
// PROCESS STATE
// ─────────────────────────────────────────────────────────────────────────

export interface WorldHandle {
    id: string;
    /** The world's own seed. Not derived from any run. */
    seed: string;
    state: WorldState;
}

export interface WorldSummary {
    id: string;
    seed: string;
    currentDay: number;
    year: number;
    runs: number;
    active: boolean;
}

/** Worlds held open in this process, by world id. */
const loaded = new Map<string, WorldHandle>();
/** What revision each held handle was loaded at. See `open`. */
const revisionOf = new Map<string, number>();

/**
 * Hold a handle, and record what revision it is of.
 *
 * ONE PATH, because the two maps must never disagree: a handle held with no
 * recorded revision looks stale on every read and is evicted the moment
 * anything asks for it, which silently turns a cache into a reload loop.
 */
function hold(handle: WorldHandle): WorldHandle {
    loaded.set(handle.id, handle);
    revisionOf.set(handle.id, readWorldRevision(getDb(), handle.id));
    return handle;
}
/** Which world a run lives in. Resolved from `world_runs`, then cached. */
const runToWorld = new Map<string, string>();
/** The world new runs enter. Persisted implicitly as "the first one created". */
let activeId: string | null = null;
let catalog: WorldCatalog | null = null;
const repos = new WeakMap<Database.Database, WorldStateRepository>();

/**
 * Discard everything held in this process.
 *
 * For tests and for a database swap. It does not delete anything: the worlds
 * are in SQLite and come back on the next touch.
 */
export function resetCultivationWorlds(): void {
    loaded.clear();
    revisionOf.clear();
    runToWorld.clear();
    activeId = null;
    catalog = null;
}

function repo(): WorldStateRepository {
    const db = getDb();
    let existing = repos.get(db);
    if (!existing) {
        existing = new WorldStateRepository(db);
        repos.set(db, existing);
    }
    return existing;
}

async function cultivationCatalog(): Promise<WorldCatalog> {
    if (catalog === null) catalog = await loadCultivationCatalog();
    return catalog;
}

// ─────────────────────────────────────────────────────────────────────────
// CREATING AND CHOOSING A WORLD
// ─────────────────────────────────────────────────────────────────────────

export interface CreateWorldOptions {
    /**
     * The world's seed. Omit and one is minted and then PERSISTED, which is what
     * makes it the world's own rather than a default every installation shares.
     * Supplying one reproduces a known world exactly.
     */
    seed?: string;
    population?: number;
    presentYear?: number;
    /** Make this the world new runs enter. Default true. */
    makeActive?: boolean;
}

/**
 * Create a world.
 */
export async function createWorld(options: CreateWorldOptions = {}): Promise<WorldSummary> {
    const seed = options.seed ?? randomUUID();
    const seeded = seedWorld({
        seed,
        catalog: await cultivationCatalog(),
        population: options.population ?? WORLD_POPULATION,
        presentYear: options.presentYear
    });

    const handle: WorldHandle = { id: seeded.state.id, seed, state: seeded.state };
    repo().saveWorld(handle.state);
    hold(handle);
    if (options.makeActive !== false) activeId = handle.id;

    return summarise(handle, true);
}

/**
 * The world new runs enter.
 */
export async function activeWorld(): Promise<WorldHandle> {
    if (activeId !== null) {
        // Through `open` and not off the map: `open` is where the staleness
        // check lives, and a second door past it is a cache nobody validates.
        const reopened = await open(activeId);
        if (reopened) return reopened;
        // The active id no longer resolves - a database swap, or a deletion.
        // Fall through and choose again rather than failing the call.
        activeId = null;
    }

    // Oldest first, so "the world this installation has been playing in" is a
    // stable answer rather than whichever row came back first.
    const stored = repo().listWorlds();
    if (stored.length > 0) {
        const handle = await open(stored[0].id);
        if (handle) {
            activeId = handle.id;
            return handle;
        }
    }

    const created = await createWorld();
    return loaded.get(created.id)!;
}

/** Point new runs at a different existing world. */
export async function setActiveWorld(worldId: string): Promise<WorldSummary | null> {
    const handle = await open(worldId);
    if (!handle) return null;
    activeId = handle.id;
    return summarise(handle, true);
}

export function activeWorldId(): string | null {
    return activeId;
}

/** Every world this installation holds, oldest first. */
export function listWorlds(): WorldSummary[] {
    const store = repo();
    return store.listWorlds().map(row => ({
        id: row.id,
        seed: row.seed,
        currentDay: row.currentDay,
        year: Math.floor(row.currentDay / 365),
        runs: store.runsOf(row.id).length,
        active: row.id === activeId
    }));
}

/**
 * Open a world: from the repository if it is there, by replaying its seed if it is
 * not.
 */
async function open(worldId: string): Promise<WorldHandle | null> {
    const held = loaded.get(worldId);
    // A HELD HANDLE IS NOT AUTOMATICALLY THE WORLD. This map is process-global
    // and nothing else revalidates it, so another process, a migration or a
    // test that wrote through the repository leaves it holding a world that is
    // no longer the one on disk - and the next append writes the stale copy
    // back over the real one. The revision is what makes that answerable.
    if (held) {
        if (readWorldRevision(getDb(), worldId) === revisionOf.get(worldId)) return held;
        loaded.delete(worldId);
        revisionOf.delete(worldId);
    }

    const store = repo();
    const state = store.loadWorld(worldId);
    if (state) {
        return hold({ id: state.id, seed: state.seed, state });
    }

    const known = store.listWorlds().find(row => row.id === worldId);
    if (!known) return null;

    const seeded = seedWorld({
        seed: known.seed,
        catalog: await cultivationCatalog(),
        population: WORLD_POPULATION
    });
    const handle: WorldHandle = { id: seeded.state.id, seed: known.seed, state: seeded.state };
    store.saveWorld(handle.state);
    return hold(handle);
}

function summarise(handle: WorldHandle, active: boolean): WorldSummary {
    return {
        id: handle.id,
        seed: handle.seed,
        currentDay: handle.state.currentDay,
        year: Math.floor(handle.state.currentDay / 365),
        runs: handle.state.runs.length,
        active
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RUNS AS CHILDREN OF A WORLD
// ─────────────────────────────────────────────────────────────────────────

export interface NextRunSeed {
    worldId: string;
    /** Run one, run two, run three. */
    index: number;
    /** `runSeedFor(worldSeed, index)`. Never independent of the world. */
    seed: string;
    /** World day the run will begin on. */
    startsOnDay: number;
}

/**
 * The seed the next run in the active world gets.
 */
export async function seedForNextRun(): Promise<NextRunSeed> {
    const handle = await activeWorld();
    const index = handle.state.runs.length;
    return {
        worldId: handle.id,
        index,
        seed: runSeedFor(handle.seed, index),
        startsOnDay: handle.state.currentDay
    };
}

/**
 * Record that this life is being lived here.
 */
export async function beginRunInWorld(
    run: Run,
    cultivator: Cultivator
): Promise<WorldRun> {
    const handle = await worldHandleFor(run);
    const existing = handle.state.runs.find(r => r.id === run.id);
    if (existing) return existing;

    const index = handle.state.runs.length;
    const record: WorldRun = {
        id: run.id,
        seed: run.seed,
        index,
        cultivatorId: cultivator.id,
        cultivatorName: cultivator.name,
        startedOnDay: handle.state.currentDay,
        endedOnDay: null,
        outcome: 'active',
        peakOrdinal: cultivator.realmOrdinal,
        graveLocationId: null,
        successorRelation: null
    };

    recordRunOnState(handle.state, record);
    runToWorld.set(run.id, handle.id);
    // A run beginning is a checkpoint, not a tick.
    repo().saveWorld(handle.state);
    return record;
}

/**
 * Close a run's entry against the world.
 */
export async function endRunInWorld(
    run: Run,
    outcome: WorldRun['outcome'],
    peakOrdinal: number
): Promise<WorldRun | null> {
    const handle = await worldHandleFor(run);
    const record = handle.state.runs.find(r => r.id === run.id);
    if (!record) return null;

    record.outcome = outcome;
    record.peakOrdinal = Math.max(record.peakOrdinal, peakOrdinal);
    record.endedOnDay = handle.state.currentDay;
    // `appendWorld` and not `saveWorld`. Three fields moved on one row; a full
    // save clears all 25 world tables before re-inserting, which is a lifecycle
    // operation and not what closing a run is.
    repo().appendWorld(handle.state);
    return record;
}

/** Which world this run lives in, resolved from `world_runs` and then cached. */
async function worldHandleFor(run: Run): Promise<WorldHandle> {
    const cached = runToWorld.get(run.id);
    if (cached) {
        const handle = await open(cached);
        if (handle) return handle;
        runToWorld.delete(run.id);
    }

    const store = repo();
    for (const row of store.listWorlds()) {
        if (!store.runsOf(row.id).some(r => r.id === run.id)) continue;
        const handle = await open(row.id);
        if (handle) {
            runToWorld.set(run.id, handle.id);
            return handle;
        }
    }

    // Not recorded anywhere yet: this run enters the world that is already
    // running. That is the default, and it is what cross-run persistence is.
    const handle = await activeWorld();
    runToWorld.set(run.id, handle.id);
    return handle;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TWO CLOCKS ARE ONE CLOCK
// ─────────────────────────────────────────────────────────────────────────

/**
 * The world this run lives in, caught up to the run's clock.
 */
export async function worldForRun(run: Run): Promise<WorldState> {
    const handle = await worldHandleFor(run);
    catchUp(handle, run, 0);
    return handle.state;
}

/**
 * Write a world back, synchronously, with the state already in hand.
 *
 * For a caller INSIDE a transition, which cannot await. `appendWorld` and never
 * `saveWorld` - see `transition-runner.ts` ruling 2.
 */
export function writeTheWorldNow(state: WorldState): void {
    repo().appendWorld(state);
}

/**
 * Tell the cache what revision the held handle is now at.
 *
 * A transition commits a revision bump alongside its writes. Without this the
 * cached handle - which IS the one that made those writes and is therefore
 * exactly current - reads as stale on the next touch and is thrown away, and
 * the world reloads from disk after every single transition.
 */
export function noteWorldRevision(worldId: string, revision: number): void {
    if (loaded.has(worldId)) revisionOf.set(worldId, revision);
}

/**
 * Drop a cached world so the next touch reloads it.
 *
 * For a transition whose transaction rolled back: SQLite is clean and the
 * in-memory graph the body already mutated is not. See `transition-runner.ts`
 * ruling 3.
 */
export function forgetWorld(worldId: string): void {
    loaded.delete(worldId);
    revisionOf.delete(worldId);
}

/**
 * Write the world back, for a caller that changed it without spending a day.
 */
export async function saveWorldForRun(run: Run): Promise<void> {
    const handle = await worldHandleFor(run);
    repo().appendWorld(handle.state);
}

/**
 * DAYS A HANDLER SPENT, SPENT IN THE WORLD TOO.
 *
 * Four places moved the run's clock and never touched the world's - refining a
 * pill, leading a house, siphoning a treasury, learning an art. The world was
 * left behind by exactly those days, and the next thing to notice ran `catchUp`,
 * which simulates the gap with NO access and NO observer.
 *
 * That is the loss, and it is not a bookkeeping one: a span simulated without an
 * observer writes the player no knowledge and no memory of anything in it. A
 * month at a furnace and a decade running a sect were years that happened to
 * everybody except the person who spent them.
 *
 * So a handler that spends days says so here, and the span runs the same way a
 * cultivated one does. The digest comes back for a caller that wants to show it;
 * a caller that does not is still strictly better off, because the knowledge and
 * the accounts were written either way.
 */
export async function theseDaysPassedInTheWorldToo(
    run: Run,
    cultivator: Cultivator,
    days: number
): Promise<WorldAdvance | null> {
    return advanceWorldForCultivator(run, cultivator, days);
}

/** Advance the world to where the run's clock says it should be, less `less`. */
function catchUp(handle: WorldHandle, run: Run, less: number): number {
    const record = handle.state.runs.find(r => r.id === run.id);
    // A run with no world entry yet has no start day to measure from, and
    // guessing one would move the world by the whole of its history.
    if (!record) return 0;

    const target = record.startedOnDay + Math.floor(run.elapsedDays) - Math.floor(less);
    const behind = target - handle.state.currentDay;
    if (behind <= 0) return 0;

    advanceWorldForPlay(handle.state, { days: behind, stopOnInterrupt: false });
    return behind;
}

export interface WorldAdvance {
    result: PlayAdvanceResult;
    /** Absolute world day the span started on. */
    fromDay: number;
    toDay: number;
    worldId: string;
}

/**
 * Advance the world alongside the cultivator, and report what reached them.
 */
export async function advanceWorldForCultivator(
    run: Run,
    cultivator: Cultivator,
    days: number,
    options: { limit?: number } = {}
): Promise<WorldAdvance | null> {
    const span = Math.floor(days);
    if (span <= 0) return null;

    const handle = await worldHandleFor(run);
    // The run may not have been recorded yet - a cultivator created before this
    // module existed, or an NPC-only run. Record it now so the clocks join.
    if (!handle.state.runs.some(r => r.id === run.id)) {
        await beginRunInWorld(run, cultivator);
    }

    // Fold in anything the run clock already knows about but the world does
    // not, so the span below is genuinely this call's span.
    catchUp(handle, run, span);

    const fromDay = handle.state.currentDay;
    const result = advanceWorldForPlay(handle.state, {
        days: span,
        access: accessForCultivator(cultivator),
        observer: observerFor(cultivator, handle),
        stopOnInterrupt: false,
        digest: { limit: options.limit ?? 12, factionRankIndex: rankIndexOf(cultivator) }
    });

    // A tick, not a checkpoint: the append path skips the chronicle and memory
    // bulk below its high-water mark, which is the difference between a
    // five-century soak costing one write and costing five hundred.
    repo().appendWorld(handle.state);

    // AND WHAT THE SPAN PUT ON THE LEDGER
    writeObligations(
        getDb(),
        result.accounts.map(row => createObligation(row))
    );

    return { result, fromDay, toDay: handle.state.currentDay, worldId: handle.id };
}

/**
 * The player as somebody the world can have happened to.
 */
export function observerFor(cultivator: Cultivator, handle: WorldHandle): Observer {
    return {
        id: cultivator.id,
        bornOnDay: Math.max(0, Math.floor(handle.state.currentDay - cultivator.age * 365))
    };
}

/**
 * What rung this cultivator stands on in their house.
 *
 * READ OFF THE MEMBERSHIP, which is where it lives. This used to be
 * `typeof cultivator.sectRank === 'number' ? cultivator.sectRank : 0`, and
 * `sectRank` is `z.string().nullable()` - so the test was false for every
 * cultivator who has ever existed and the answer was 0, always.
 *
 * `sectThreshold` in `digest.ts` reads it to decide what a person is told: an
 * elder is told the awkward things and an outer disciple hears the notices. So
 * a Sect Head's world digest has been identical to an outer disciple's for the
 * whole life of every run, and nothing looked wrong - it just quietly said less
 * to the people the world should have been telling most.
 */
function rankIndexOf(cultivator: Cultivator): number {
    const membership = new SectRepository(getDb()).getMembership(cultivator.id);
    return membership?.rankIndex ?? 0;
}

/**
 * What this cultivator has standing to be told.
 */
export function accessForCultivator(cultivator: Cultivator): PlayerAccess {
    const gate = new KnowledgeGate(getDb());
    const here = cultivator.location ? placeKey(cultivator.location) : null;

    return {
        ...simpleAccess({
            actorId: cultivator.id,
            locationId: here,
            visibleLocationIds: here === null ? [] : [here],
            factionId: cultivator.sectId ?? null,
            knownFactionIds: gate.awareIds(cultivator.id, 'sect'),
            knownPlaceIds: gate.awareIds(cultivator.id, 'place')
        }),
        knowsNpc: (id: string) => gate.isAwareOf(cultivator.id, 'cultivator', id)
    };
}

/**
 * Presentation - turning a digest into prose channels - is deliberately NOT here.
 * `src/web/game.ts` owns `reportFromDigest` and `WorldReport`, because what a
 * narrator is handed is a narrator-layer decision and this module's remit stops at
 * "what actually reached them". One implementation each, and neither reaches into
 * the other.
 */
