/**
 * The world the cultivator is standing in, for the play loop.
 *
 * `src/engine/world/` builds and advances a world; nothing was calling it. This
 * module is the join: it owns one `WorldState` per run, seeded from the run's
 * own seed, and it is what `cultivate` advances so that a decade of seclusion
 * costs the player a decade of world.
 *
 * ── WHY THERE IS NO TABLE HERE ────────────────────────────────────────────
 *
 * A world is a pure function of `(seed, days advanced)`. `seedWorld` derives
 * everything from the seed through `forStream`, `advanceTime` and
 * `applyPressure` are keyed to absolute days, and the driver guarantees that
 * advancing ten years then twenty lands on the same world as advancing thirty.
 * So the world does not need to be written down to survive a restart - it needs
 * to be REBUILT, from the two numbers that are already durable: `runs.seed` and
 * `runs.elapsed_days`.
 *
 * That is deliberately the cheap correct thing rather than the fast one. The
 * world layer has a full relational schema waiting for it in
 * `storage/migrations.world.ts` and no repository behind it yet; when that
 * repository exists, this module should load and save through it and keep the
 * rebuild only as the cold-start path. Until then, replaying is honest: a
 * restart cannot silently produce a DIFFERENT world, because the same two
 * numbers cannot produce one.
 *
 * ── OVERLAP TO RESOLVE: `src/web/world.ts` ────────────────────────────────
 *
 * The narrator layer grew a `WorldSession` doing the same join for the web
 * surface while this was being written, and the two should become one. They are
 * not interchangeable as they stand, and the difference is worth keeping on the
 * way in:
 *
 *   `web/world.ts`  one session for the process, seeded from a default seed.
 *                   Right for a single narrator serving one player.
 *   this module      one world per RUN, seeded from `runs.seed`, rebuilt from
 *                   `(seed, elapsed_days)` on a cold start. Right for a tool
 *                   surface, where two runs must not share a world and the
 *                   process may restart between calls.
 *
 * Whichever survives has to keep the run-seeding and the rebuild. Merging the
 * other way silently gives every run the same world.
 *
 * ── THE AUTHORITY BOUNDARY ────────────────────────────────────────────────
 *
 * Nothing here accepts an outcome. Callers pass a span in days and the identity
 * of who is watching; what happened comes back from the driver. The digest is
 * filtered through `knowledge_records` before it leaves, so a tool cannot hand
 * the narrator a name the cultivator has never heard.
 */

import { getDb } from '../../storage/index.js';
import {
    advanceWorldForPlay,
    loadCultivationCatalog,
    seedWorld,
    simpleAccess,
    type Observer,
    type PlayAdvanceResult,
    type PlayerAccess,
    type WorldCatalog,
    type WorldState
} from '../../engine/world/index.js';
import type { Cultivator, Run } from '../../schema/cultivation.js';
import { KnowledgeGate, placeKey } from '../../web/knowledge.js';

/**
 * Living NPCs the world keeps records for.
 *
 * Hundreds, not thousands: the whole cost of a century of world time is linear
 * in this, and a province holds about this many people worth remembering.
 */
export const WORLD_POPULATION = 240;

interface WorldEntry {
    seed: string;
    state: WorldState;
    /** Absolute world day the run began on. Run day 0 is this day. */
    startDay: number;
    /** Run days already folded into the world. */
    advancedDays: number;
}

const worlds = new Map<string, WorldEntry>();
let catalog: WorldCatalog | null = null;

/** Discard every cached world. For tests and for a database swap. */
export function resetCultivationWorlds(): void {
    worlds.clear();
    catalog = null;
}

async function cultivationCatalog(): Promise<WorldCatalog> {
    if (catalog === null) catalog = await loadCultivationCatalog();
    return catalog;
}

/**
 * The world for this run, caught up to the run's clock.
 *
 * Rebuilds from the seed on a cold start and then fast-forwards to
 * `run.elapsedDays`, so a tool never sees a world that is behind the
 * cultivator. The catch-up produces no digest: nothing that happened while the
 * process was not running is news the player is hearing for the first time.
 */
export async function worldForRun(run: Run): Promise<WorldState> {
    const entry = await ensureWorld(run);
    const behind = Math.floor(run.elapsedDays) - entry.advancedDays;
    if (behind > 0) {
        advanceWorldForPlay(entry.state, { days: behind, stopOnInterrupt: false });
        entry.advancedDays += behind;
    }
    return entry.state;
}

async function ensureWorld(run: Run): Promise<WorldEntry> {
    const existing = worlds.get(run.id);
    if (existing && existing.seed === run.seed) return existing;

    const seeded = seedWorld({
        seed: run.seed,
        catalog: await cultivationCatalog(),
        population: WORLD_POPULATION
    });
    const entry: WorldEntry = {
        seed: run.seed,
        state: seeded.state,
        startDay: seeded.state.currentDay,
        advancedDays: 0
    };
    worlds.set(run.id, entry);

    const behind = Math.floor(run.elapsedDays);
    if (behind > 0) {
        advanceWorldForPlay(entry.state, { days: behind, stopOnInterrupt: false });
        entry.advancedDays = behind;
    }
    return entry;
}

export interface WorldAdvance {
    result: PlayAdvanceResult;
    /** Absolute world day the span started on. */
    fromDay: number;
    toDay: number;
}

/**
 * Advance the world alongside the cultivator, and report what reached them.
 *
 * The span is the span the cultivator actually lived through - a seclusion
 * broken in year three does not get seven more years of world - so callers pass
 * the SIMULATED days the cultivation engine returned, never the requested ones.
 */
export async function advanceWorldForCultivator(
    run: Run,
    cultivator: Cultivator,
    days: number,
    options: { limit?: number } = {}
): Promise<WorldAdvance | null> {
    const span = Math.floor(days);
    if (span <= 0) return null;

    const entry = await ensureWorld(run);
    // Fold in anything the run clock already knows about but the world does
    // not, so the span below is genuinely this call's span.
    const alreadyElapsed = Math.floor(run.elapsedDays) - span;
    const behind = alreadyElapsed - entry.advancedDays;
    if (behind > 0) {
        advanceWorldForPlay(entry.state, { days: behind, stopOnInterrupt: false });
        entry.advancedDays += behind;
    }

    const fromDay = entry.state.currentDay;
    const result = advanceWorldForPlay(entry.state, {
        days: span,
        access: accessForCultivator(cultivator),
        observer: observerFor(cultivator, entry),
        stopOnInterrupt: false,
        digest: { limit: options.limit ?? 12, factionRankIndex: rankIndexOf(cultivator) }
    });
    entry.advancedDays += result.daysAdvanced;

    return { result, fromDay, toDay: entry.state.currentDay };
}

/**
 * The player as an observer.
 *
 * `bornOnDay` is derived from their age against the world clock, so a fact
 * dated before they existed is historical to them however recently the world
 * recorded it.
 */
function observerFor(cultivator: Cultivator, entry: WorldEntry): Observer {
    const bornOnDay = Math.max(
        0,
        Math.floor(entry.startDay + entry.advancedDays - cultivator.age * 365)
    );
    return { id: cultivator.id, bornOnDay };
}

function rankIndexOf(cultivator: Cultivator): number {
    return typeof cultivator.sectRank === 'number' ? cultivator.sectRank : 0;
}

/**
 * What this cultivator has standing to be told.
 *
 * Backed by `knowledge_records` through `KnowledgeGate`, which is the same
 * table the narrator layer's discovery gate reads. A faction they have never
 * heard of reaches them as a closed road and never as a named report - and that
 * filtering happens HERE, before the digest leaves the tool, rather than as an
 * instruction to the model.
 */
export function accessForCultivator(cultivator: Cultivator): PlayerAccess {
    const gate = new KnowledgeGate(getDb());
    const factions = gate.awareIds(cultivator.id, 'sect');
    const npcs = gate.awareIds(cultivator.id, 'cultivator');
    const places = gate.awareIds(cultivator.id, 'place');

    const here = cultivator.location ? placeKey(cultivator.location) : null;
    // The location ids the world layer uses are its own; a cultivator standing
    // in a place they have a record for sees it, and everything else has to
    // reach them by a channel.
    const visible = here === null ? [] : [here, ...places];

    return simpleAccess({
        actorId: cultivator.id,
        locationId: here,
        visibleLocationIds: visible,
        factionId: cultivator.sectId ?? null,
        knownFactionIds: factions,
        knownNpcIds: npcs,
        knownPlaceIds: places
    });
}
