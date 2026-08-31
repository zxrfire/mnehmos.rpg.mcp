/**
 * The world the runs happen inside.
 *
 * A cultivator sitting in a cave for forty years must come out into a world
 * that moved. That is the whole of what this module is for: it holds one
 * `WorldState` for the process, advances it by exactly the days the cultivation
 * time-skip spent, and hands back the small part of what happened that this
 * particular player was in a position to learn.
 *
 * ── The two clocks are one clock ──────────────────────────────────────────
 * `simulateTimeSkip` moves the cultivator; `advanceWorldForPlay` moves
 * everything else. They are joined only by the number of days, and they are
 * always given the same number, because a run where the player aged four
 * decades and the sects did not is not a simulation of anything.
 *
 * ── Why the digest is safe by construction ────────────────────────────────
 * `PlayerAccess` is the same three predicates `KnowledgeGate` already answers,
 * which is not a coincidence: the world layer's digest is discovery-gated on
 * its side with two gates, channel and then attribution, and `DigestLine.text`
 * structurally cannot contain a name the player has no record for. So wiring
 * the two together is connecting systems built to one contract rather than
 * translating between them, and the discovery rule holds across the seam
 * without anything here having to enforce it a second time.
 *
 * ── What is deliberately not surfaced ─────────────────────────────────────
 * Over five centuries the soak reports 614 digest lines, 777 unattributed
 * consequences and 1953 events that reached the player by no channel at all.
 * That ratio is the design working. The unheard count reaches the inspector and
 * never the narrator, because the moment it becomes prose the player stops
 * living in a world that is mostly none of their business.
 *
 * ── Persistence ───────────────────────────────────────────────────────────
 * There is no world repository yet, so this state is in memory and does not
 * survive a restart. Cross-run continuity works within a process and is
 * designed for the repo landing behind it; nothing here writes tables.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { advanceWorldForPlay, type PlayAdvanceResult } from '../engine/world/driver.js';
import type { PlayerAccess, PlayerDigest } from '../engine/world/digest.js';
import { planNextRun, recordRun, lastFinishedRun, type NextRunPlan, type WorldRun } from '../engine/world/legacy.js';
import { loadCultivationCatalog } from '../engine/world/catalog.js';
import { seedWorld, type SeededWorld } from '../engine/world/seeding.js';
import type { WorldState } from '../engine/world/world-state.js';
import { placeKey, type KnowledgeGate } from './knowledge.js';
import { placeName } from './facts.js';

/**
 * The seed for the deployment's world.
 *
 * Stable so that a restart rebuilds the same continent rather than a different
 * one. Overridable per session for tests, which want a world they can reason
 * about rather than the shipped one.
 */
export const DEFAULT_WORLD_SEED = 'the-vault';

/** How many people the world starts with. The seeder's own default. */
export const DEFAULT_POPULATION = 400;

export interface WorldSessionOptions {
    seed?: string;
    population?: number;
}

/**
 * One world, held for the life of the process.
 *
 * A class rather than a module of functions so that a test can build its own,
 * and so the eventual `world.repo.ts` has one obvious place to load into and
 * save from.
 */
export class WorldSession {
    readonly state: WorldState;
    /** Population and remnant counts from the seeding pass. For the admin view. */
    readonly stats: SeededWorld['stats'];

    constructor(seeded: SeededWorld) {
        this.state = seeded.state;
        this.stats = seeded.stats;
    }

    /** The world's own clock, in absolute days. */
    get day(): number {
        return this.state.currentDay;
    }

    /**
     * Move the world the same span the cultivator just spent.
     *
     * `access` decides what comes back in the digest and nothing else: the
     * world advances identically whether or not anybody was watching, which is
     * the point of it being a world rather than a backdrop.
     */
    advance(days: number, access: PlayerAccess | null, observer?: { id: string; bornOnDay: number }): PlayAdvanceResult {
        return advanceWorldForPlay(this.state, {
            days,
            access: access ?? undefined,
            observer,
            // A seclusion is not interrupted by distant politics. The
            // cultivation time-skip owns interruption; this owns consequence.
            stopOnInterrupt: false
        });
    }

    /** Plan the life after the last one, in the world the last one left. */
    planNext(previous: WorldRun | null, index: number): NextRunPlan {
        return planNextRun(this.state, { index, onDay: this.state.currentDay, previous });
    }

    /** The most recently finished life in this world, if any. */
    lastRun(): WorldRun | null {
        return lastFinishedRun(this.state);
    }

    /** How many lives have been played here. */
    get runCount(): number {
        return this.state.runs.length;
    }

    /** Write a life into the world's record of itself. */
    record(run: WorldRun): void {
        recordRun(this.state, run);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// THE PROCESS-WIDE SESSION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a world from the shipped content.
 *
 * Async because the catalog is loaded from the data modules rather than
 * hard-coded, which is what makes the sects in the world the same sects the
 * rest of the game knows about. Called once at startup so that every path
 * downstream of it can stay synchronous.
 */
export async function createWorldSession(options: WorldSessionOptions = {}): Promise<WorldSession> {
    const catalog = await loadCultivationCatalog();
    return new WorldSession(seedWorld({
        seed: options.seed ?? DEFAULT_WORLD_SEED,
        population: options.population ?? DEFAULT_POPULATION,
        catalog
    }));
}

let ambient: WorldSession | null = null;

/**
 * The world this process is playing in.
 *
 * Process-wide on purpose and for the same reason the database is: this is a
 * single-operator deployment, and two front doors onto one save must not be
 * two different worlds. The MCP tool surface should reach the world through
 * THIS accessor rather than calling `advanceWorldForPlay` on a state of its
 * own, or the two paths will silently diverge on the first time-skip.
 */
export async function worldSession(options: WorldSessionOptions = {}): Promise<WorldSession> {
    if (!ambient) ambient = await createWorldSession(options);
    return ambient;
}

/** The process world, if one has been built. Null before startup finishes. */
export function currentWorldSession(): WorldSession | null {
    return ambient;
}

/** Replace the process world. Tests, and a future load-from-repo. */
export function setWorldSession(session: WorldSession | null): void {
    ambient = session;
}

// ─────────────────────────────────────────────────────────────────────────
// ACCESS
// ─────────────────────────────────────────────────────────────────────────

/**
 * A `PlayerAccess` backed by the knowledge layer.
 *
 * The three predicates are `KnowledgeGate.isAwareOf` with the kind fixed, which
 * is the whole wiring. Nothing is copied into a set first: the digest asks
 * about the handful of ids that actually came up in the span, and asking the
 * table directly means a name learned during the span is already known by the
 * time the digest is built.
 */
export function accessFor(gate: KnowledgeGate, cultivator: Cultivator): PlayerAccess {
    const here = placeKey(placeName(cultivator));
    return {
        actorId: cultivator.id,
        locationId: here,
        visibleLocationIds: [here],
        factionId: cultivator.sectId,
        knowsFaction: id => gate.isAwareOf(cultivator.id, 'sect', id),
        knowsNpc: id => gate.isAwareOf(cultivator.id, 'cultivator', id),
        knowsPlace: id => gate.isAwareOf(cultivator.id, 'place', id)
    };
}

/** The player as somebody the world can have happened to. */
export function observerFor(cultivator: Cultivator, run: Run): { id: string; bornOnDay: number } {
    return {
        id: cultivator.id,
        // Birth is the run's start less however old they were when it began.
        bornOnDay: Math.max(0, Math.floor(run.elapsedDays - cultivator.age * 365))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER GETS OUT OF IT
// ─────────────────────────────────────────────────────────────────────────

export interface WorldReport {
    /** Narratable. Every line is already safe to name what it names. */
    lines: string[];
    /** Inspector only: the shape of what was withheld. */
    structure: string[];
}

/**
 * Turn a digest into the two channels the rest of this layer uses.
 *
 * The lines go to the narrator verbatim, because the world layer has already
 * done the redaction and doing it twice would only risk disagreeing with it.
 * The counts go to the inspector: how much of the span the player never heard
 * about is a fact about the simulation, and a player who wants it can look,
 * but it must not become a sentence in the prose.
 */
export function reportFromDigest(digest: PlayerDigest | null): WorldReport {
    if (!digest || digest.lines.length === 0) {
        return {
            lines: [],
            structure: digest
                ? [`World digest: nothing reached this cultivator. ${digest.unheard} events passed unheard.`]
                : []
        };
    }

    const lines = digest.lines.map(line => {
        const many = line.occurrences > 1 ? ` (${line.occurrences} times over the span)` : '';
        return `Year ${line.year}: ${line.text}${many}`;
    });

    return {
        lines,
        structure: [
            `World digest: ${digest.lines.length} line(s) reached this cultivator; ` +
            `${digest.unheard} event(s) reached them by no channel at all.`,
            ...digest.lines.map(line =>
                `  ${line.kind} via ${line.channel}, form=${line.form}, ` +
                `magnitude=${line.magnitude}, occurrences=${line.occurrences}.`)
        ]
    };
}
