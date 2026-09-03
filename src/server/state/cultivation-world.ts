/**
 * The world the runs happen inside. One implementation, for every caller.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE WORLD IS THE OUTER OBJECT, AND IT OUTLIVES ITS RUNS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * That single sentence decides everything below, and two earlier designs got
 * it wrong in opposite directions:
 *
 *   seeded from `runs.seed`   gives every run its OWN world, which deletes
 *                             cross-run persistence outright. The whole point
 *                             is that your last cultivator's grave is on THIS
 *                             map, and it cannot be if the map is new.
 *   a default seed            gives every installation the identical world and
 *                             no way to start a different one.
 *
 * So: a world has its own seed, chosen once and persisted. Runs are its
 * children, and their seeds are derived from it through `runSeedFor`, exactly
 * as `legacy.ts` already specifies - which is what makes run three of a world
 * always the same run three, and what stops starting a new run perturbing any
 * stream the world has already drawn from.
 *
 *   world seed  -> runSeedFor(worldSeed, 0) -> run one
 *              -> runSeedFor(worldSeed, 1) -> run two
 *              -> runSeedFor(worldSeed, 2) -> run three
 *
 * A new run enters the EXISTING world. That is the default and it takes no
 * ceremony. Creating a fresh world is a separate, deliberate act
 * (`createWorld`), because it is one: it throws away every grave, every
 * inherited grudge and every ruin the previous lives left behind.
 *
 * ── PERSISTENCE: LOAD, ELSE REPLAY ───────────────────────────────────────
 *
 * `WorldStateRepository` is the source of truth. Determinism alone was enough
 * while nothing wrote to the world that the seed could not reproduce, and it
 * stopped being enough the moment `legacy.ts` landed: a grave, an ancestral
 * hall entry, memories on the survivors and an inherited goal are facts about
 * what happened, not functions of a seed.
 *
 * So the order is load, else replay:
 *
 *   1. `loadWorld(id)` returns everything, runs' writings included. Use it.
 *   2. Nothing stored under that id - a world that was created and never
 *      saved, or a database that has been swapped underneath us - and the seed
 *      still reproduces the BASE world exactly. Replay it and save.
 *
 * Replay can only ever reconstruct the base. It is a cold-start fallback and
 * never a substitute for the repository.
 *
 * ── WHAT A SEED REPRODUCES, AND WHAT IT DOES NOT ─────────────────────────
 *
 * AGENTS.md: runs must be reproducible from their seed. That is true and it is
 * narrower than it sounds, and the limit belongs here because this file is
 * where it comes from.
 *
 * A run seed fixes what the RUN draws: talent, birth, every stream
 * `forStream(run.seed, ...)` opens. It does not fix the world the run is lived
 * in. `createWorld` mints `randomUUID()` when no seed is given and `activeWorld`
 * calls it with none, so an installation with no world yet gets one nobody
 * chose - and the people in it are most of what a played run actually meets.
 *
 *   reproducible  =  same run seed  AND  same world.
 *
 * Measured, two fresh databases in one process on one run seed: `npc-0` was
 * "Duan Fuyan" at ordinal 10 in one and "Han Fulu" at ordinal 9 in the other,
 * and "I attack someone of my own rank" fought a different person each time.
 * Nothing was wrong; both halves of the input were not the same.
 *
 * This is the design and not a defect to be fixed. Seeding the world from the
 * run instead is one of the two rejected designs above - it gives every run its
 * own world and deletes cross-run persistence outright. Within one
 * installation the promise holds in full, because the world is created once and
 * persisted and every later run derives from it through `runSeedFor`.
 *
 * So: to replay a run somewhere else, carry the WORLD seed with it and
 * `createWorld({ seed })` before the run opens. That is what
 * `makeGameInWorld` in `tests/web/harness.ts` does, and why any played test
 * that wants one seed pinned to one outcome has to use it - a test that pins a
 * seed without pinning the world is pinning a coincidence.
 *
 * ── THE AUTHORITY BOUNDARY ───────────────────────────────────────────────
 *
 * Nothing here accepts an outcome. Callers pass a span in days and who is
 * watching; what happened comes back from the driver. The digest is filtered
 * through `knowledge_records` before it leaves, so no caller can be handed a
 * name this cultivator has never heard.
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../../storage/index.js';
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
 *
 * Hundreds, not thousands: the whole cost of a century of world time is linear
 * in this, and a province holds about this many people worth remembering.
 * It is a property of the world, fixed when the world is created, so changing
 * it never alters a world that already exists.
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
     * The world's seed. Omit and one is minted and then PERSISTED, which is
     * what makes it the world's own rather than a default every installation
     * shares. Supplying one reproduces a known world exactly.
     *
     * It is also the half of "reproducible from the seed" that a run seed does
     * not carry - see the header. Supply it whenever a run has to replay the
     * same life on another installation.
     */
    seed?: string;
    population?: number;
    presentYear?: number;
    /** Make this the world new runs enter. Default true. */
    makeActive?: boolean;
}

/**
 * Create a world.
 *
 * A deliberate act, and the only one in this module that discards anything:
 * every run afterwards enters this world instead of the old one, and the old
 * one's graves, grudges and ruins are no longer the ones a new cultivator digs
 * through. The existing world is not deleted - `listWorlds` still shows it and
 * `setActiveWorld` still returns to it - but nothing walks into two at once.
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
    loaded.set(handle.id, handle);
    if (options.makeActive !== false) activeId = handle.id;

    return summarise(handle, true);
}

/**
 * The world new runs enter.
 *
 * No ceremony: if one exists it is used, and only a genuinely empty
 * installation causes one to be made. The seed for that first world is minted
 * once and written to `world_runtime`, so it is the world's own from then on
 * and a restart does not produce a different one.
 *
 * That minting is the ONLY randomness in this module, and it is why a run seed
 * reproduces a run only against the world it was played in. A caller who needs
 * a known world must `createWorld({ seed })` before the first run opens;
 * arriving here means the choice has already been left to chance.
 */
export async function activeWorld(): Promise<WorldHandle> {
    if (activeId !== null) {
        const held = loaded.get(activeId);
        if (held) return held;
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
 * Open a world: from the repository if it is there, by replaying its seed if
 * it is not.
 *
 * The fallback exists because a world can be known (its id and seed are on the
 * runtime row) without its body being loadable - a half-written save, or a
 * database rebuilt underneath a process that still holds the id. Replaying
 * reconstructs the BASE world, which is exactly and only what the seed can
 * produce; anything runs have since written onto it lives in the repository
 * and is lost if it was never saved. That is the honest limit of the fallback
 * and it is why the repository is the source of truth.
 */
async function open(worldId: string): Promise<WorldHandle | null> {
    const held = loaded.get(worldId);
    if (held) return held;

    const store = repo();
    const state = store.loadWorld(worldId);
    if (state) {
        const handle: WorldHandle = { id: state.id, seed: state.seed, state };
        loaded.set(handle.id, handle);
        return handle;
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
    loaded.set(handle.id, handle);
    return handle;
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
 *
 * Called by `create_cultivator` so a run's randomness hangs off the world's
 * rather than being minted beside it. A caller who supplies their own seed is
 * replaying a specific run and is honoured; everything else derives.
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
 *
 * Idempotent: a run already recorded is left alone, so re-entering an existing
 * run does not create a second entry or move its start day. The start day is
 * what joins the two clocks afterwards - a run's `elapsedDays` is measured from
 * it, and the world is behind by exactly the difference.
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
 *
 * This records how the life ended and what it reached. It does NOT enshrine:
 * putting the grave on the map, the entry in the ancestral hall and the
 * inherited goals into the world is `legacy.ts`'s `enshrineRun`, which needs
 * the dead cultivator to be a world NPC first. Two ways to persist a
 * consequence is two ways to persist half of it.
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
    repo().saveWorld(handle.state);
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
 *
 * A run's `elapsedDays` is measured from the world day it started on, so the
 * world is behind by `startedOnDay + elapsedDays - currentDay`. Both halves are
 * persisted, which is what makes the catch-up correct across a restart rather
 * than merely plausible.
 *
 * The catch-up produces no digest. Nothing that happened while this process was
 * not running is news the player is hearing for the first time.
 */
export async function worldForRun(run: Run): Promise<WorldState> {
    const handle = await worldHandleFor(run);
    catchUp(handle, run, 0);
    return handle.state;
}

/**
 * Write the world back, for a caller that changed it without spending a day.
 *
 * Every other write here rides on `advanceWorldForCultivator`, which persists
 * at the end of a span - correct while the only things that touched the world
 * were the passage of time and what the passage of time produced. It stopped
 * being sufficient once actions started changing the world in a single turn:
 * settling an abode above the Lid, a descent that opens the seam and is over
 * inside fifteen breaths, an object put down a channel. None of those spends a
 * day, and all of them are real state.
 *
 * Idempotent and cheap. The repository appends above its own high-water mark,
 * so a call that changed nothing writes nothing.
 */
export async function saveWorldForRun(run: Run): Promise<void> {
    const handle = await worldHandleFor(run);
    repo().appendWorld(handle.state);
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
 *
 * The span is the one the cultivator actually LIVED - a seclusion broken in
 * year three does not get seven more years of world - so callers pass the
 * simulated days the cultivation engine returned, never the requested ones.
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

    // ── AND WHAT THE SPAN PUT ON THE LEDGER ──────────────────────────────
    //
    // The design owner, on a war leaving nothing where a played killing left a
    // grudge: *this is bespoke. a war death is still a grudge. fix it.*
    //
    // A world tick cannot write one. There is no obligation ledger in
    // `WorldState` - the layer hands social rows to its caller the way it
    // already hands back estates and heirs - so the rows come out of
    // `advanceWorldForPlay` with the deaths, and this is the first place that
    // holds both a span's answer and a database.
    //
    // IT IS HERE AND NOT IN `GameService`, and that is the whole of why it
    // works. Two front doors advance a world: the played turn, and
    // `cultivation-manage.ts` on the MCP surface - which is what `ADMIN
    // advance_days` runs through. Writing it in the web layer left the operator
    // surface silently not writing, which is exactly how this was found.
    //
    // Measured before wiring, over five hundred years on two seeds: 118 and 105
    // war dead, leaving 154 and 148 rows. The ledger holds a world's worth of
    // war dead without noticing.
    //
    // Idempotent. `createObligation` derives its id from the pair, the cause,
    // the day and the triggering event, and the write is INSERT OR REPLACE, so
    // a span replayed after a restart writes the same rows over themselves.
    writeObligations(
        getDb(),
        result.accounts.map(row => createObligation(row))
    );

    return { result, fromDay, toDay: handle.state.currentDay, worldId: handle.id };
}

/**
 * The player as somebody the world can have happened to.
 *
 * `bornOnDay` is derived from their age against the WORLD clock, so a fact
 * dated before they existed is historical to them however recently the world
 * recorded it - including facts from previous runs, which is exactly the point.
 */
export function observerFor(cultivator: Cultivator, handle: WorldHandle): Observer {
    return {
        id: cultivator.id,
        bornOnDay: Math.max(0, Math.floor(handle.state.currentDay - cultivator.age * 365))
    };
}

function rankIndexOf(cultivator: Cultivator): number {
    return typeof cultivator.sectRank === 'number' ? cultivator.sectRank : 0;
}

/**
 * What this cultivator has standing to be told.
 *
 * Backed by `knowledge_records` through `KnowledgeGate`, which is the same
 * table the narrator layer's discovery gate reads. The three predicates are
 * asked live rather than snapshotted into sets, so a name learned DURING the
 * span is already known by the time the digest is built. A faction they have
 * never heard of reaches them as a closed road and never as a named report -
 * and that filtering happens here, before anything leaves, rather than as an
 * instruction to a model.
 *
 * ── `knowsNpc` is a question, not a set, and that is load-bearing ─────────
 * The other two can be sets because a sect and a place each have one id. A
 * PERSON out of the content catalogs has two - the catalog's and the world
 * row's - and `awareIds` can only report one of them, while the digest asks
 * with the world row's. So the set form answered `false` for every catalog
 * person the player had been told about, which is the whole of what this
 * comment's own promise about asking live was already claiming not to do.
 * `isAwareOf` folds both ids onto one claim; a set cannot.
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
 * Presentation - turning a digest into prose channels - is deliberately NOT
 * here. `src/web/game.ts` owns `reportFromDigest` and `WorldReport`, because
 * what a narrator is handed is a narrator-layer decision and this module's
 * remit stops at "what actually reached them". One implementation each, and
 * neither reaches into the other.
 */
