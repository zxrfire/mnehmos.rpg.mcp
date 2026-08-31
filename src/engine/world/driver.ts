/**
 * The driver: one call, and the world moves with the cultivator.
 *
 * Everything else in this layer is a part. This is the whole, and it exists so
 * that wiring the world into the play loop is a single call rather than an
 * order-of-operations puzzle that each call site gets slightly wrong.
 *
 *     const out = advanceWorldForPlay(world, { days, access, observer });
 *     // out.state    the world, moved
 *     // out.digest   what the player learns
 *     // out.events   what actually happened, for the record
 *
 * ── The order, and why it is that order ──────────────────────────────────
 *
 *  1. `advanceTime` moves the clock, fires what was already on the books, and
 *     may TRUNCATE the span at an interrupt. It runs first precisely so that
 *     the span the rest of the pass works on is the span the player actually
 *     lived through - a seclusion broken in year three does not get seven more
 *     years of consequences.
 *
 *  2. `applyPressure` runs over exactly that span, making new things happen and
 *     writing real state.
 *
 *  3. The digest is built last, over the union of both, and filtered through
 *     the player's knowledge.
 *
 * ── In place ─────────────────────────────────────────────────────────────
 *
 * The pass mutates the world it is given. A play loop advances the same world
 * over and over, and cloning a four-hundred-NPC world on every call costs more
 * than the entire simulation does. Callers that want the old world back should
 * `cloneWorld` before calling, which makes the copy explicit and rare instead
 * of implicit and constant.
 *
 * ── What the caller still owns ───────────────────────────────────────────
 *
 * The cultivator. This module does not touch the player's own record: their
 * progress, injuries, satiety and breakthroughs belong to the cultivation
 * engine's own time-skip, which the play loop runs alongside this. The two are
 * joined only by the number of days.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { HistoricalFact, Observer } from './history.js';
import { buildPlayerDigest, type DigestOptions, type PlayerAccess, type PlayerDigest } from './digest.js';
import { applyPressure, type PressureEvent, type PressureOptions } from './pressure.js';
import {
    advanceTime,
    type DeathHandoff,
    type InterruptPolicy,
    type TimeAdvanceResult
} from './time.js';
import type { WorldState } from './world-state.js';

export interface AdvanceForPlayOptions {
    /** In-world days to advance. The same span the cultivator is spending. */
    days: number;
    /** Who is asking, for the digest. Omit and no digest is built. */
    access?: PlayerAccess;
    /**
     * The player as an observer, for the historical / concurrent / witnessed
     * split. Usually `{ id, bornOnDay }` for the player's own cultivator.
     */
    observer?: Observer;
    /** What should hand control back. Omit and only flagged effects interrupt. */
    interruptPolicy?: InterruptPolicy;
    /** Whether the world may be interrupted at all. A sealed cave passes false. */
    stopOnInterrupt?: boolean;
    pressure?: PressureOptions;
    digest?: DigestOptions;
    /** Wired to the social layer's `inheritLedgerOnDeath`. */
    onDeath?: (handoff: DeathHandoff) => void;
}

export interface PlayAdvanceResult {
    state: WorldState;
    fromDay: number;
    toDay: number;
    daysRequested: number;
    daysAdvanced: number;
    interrupted: boolean;
    interruptReason: string | null;

    /** Everything that happened, named and dated. The world's own record. */
    events: HistoricalFact[];
    /** The subset the pressure layer generated, with what each one touched. */
    pressure: PressureEvent[];
    time: TimeAdvanceResult;
    deaths: DeathHandoff[];

    /** What the player learns. Null when no access was supplied. */
    digest: PlayerDigest | null;
}

/**
 * Advance the world alongside the cultivator.
 *
 * Deterministic: the same world, seed and span produce the same result, and
 * advancing ten years then twenty produces the same world as advancing thirty,
 * because both halves of the pass are keyed to absolute days and years.
 */
export function advanceWorldForPlay(
    state: WorldState,
    opts: AdvanceForPlayOptions
): PlayAdvanceResult {
    const fromDay = state.currentDay;
    const factsBefore = state.history.facts.length;

    // 1. The clock, and whatever was already due. May truncate.
    const time = advanceTime(state, opts.days, {
        inPlace: true,
        observer: opts.observer,
        interruptPolicy: opts.interruptPolicy,
        stopOnInterrupt: opts.stopOnInterrupt,
        onDeath: opts.onDeath
    });

    // 2. New things, over exactly the span that was lived through.
    const pressure = applyPressure(time.state, fromDay, time.toDay, opts.pressure);
    for (const event of pressure.events) {
        for (const handoff of event.deaths) opts.onDeath?.(handoff);
    }

    const events = time.state.history.facts.slice(factsBefore);
    const deaths = time.deathHandoffs.concat(pressure.events.flatMap(e => e.deaths));

    // 3. What of it reached the player.
    const digest = opts.access
        ? buildPlayerDigest(events, opts.access, fromDay, time.toDay, opts.digest)
        : null;

    return {
        state: time.state,
        fromDay,
        toDay: time.toDay,
        daysRequested: time.daysRequested,
        daysAdvanced: time.daysAdvanced,
        interrupted: time.interrupted,
        interruptReason: time.interruptReason,
        events,
        pressure: pressure.events,
        time,
        deaths,
        digest
    };
}

/** The same, phrased in years. */
export function advanceWorldYears(
    state: WorldState,
    years: number,
    opts: Omit<AdvanceForPlayOptions, 'days'> = {}
): PlayAdvanceResult {
    return advanceWorldForPlay(state, { ...opts, days: Math.round(years * DAYS_PER_YEAR) });
}

// ─────────────────────────────────────────────────────────────────────────
// A SUMMARY OF THE WHOLE WORLD, FOR COMPARING TWO ERAS
// ─────────────────────────────────────────────────────────────────────────

export interface WorldShape {
    day: number;
    year: number;
    livingNpcs: number;
    liveFactions: number;
    dissolvedFactions: number;
    /** Faction ids alive right now. */
    factionIds: string[];
    /** Locations whose current kind differs from what they started as. */
    changedLocations: number;
    locationChanges: number;
    facts: number;
    unresolvedFacts: number;
    /** Relationship rows carrying an inherited account. */
    inheritedGrudges: number;
    /** Goals that have outlived at least one holder. */
    inheritedGoals: number;
    /** Living NPCs by realm tier, lowest first. */
    realmHistogram: number[];
    strongestOrdinal: number;
}

/**
 * A compact shape of the world, for asking whether it is recognisably
 * descended from an earlier one.
 *
 * The acceptance test compares two of these across five centuries. It is
 * reporting only - nothing in the simulation reads it.
 */
export function worldShape(state: WorldState): WorldShape {
    const tiers = [0, 13, 17, 21, 25, 29, 33, 37, 41, 45];
    const histogram = new Array(tiers.length - 1).fill(0);
    let living = 0;
    let strongest = 0;
    let inheritedGoals = 0;
    let inheritedGrudges = 0;

    for (const npc of state.npcs) {
        for (const goal of npc.goals) if (goal.generation > 0) inheritedGoals++;
        for (const rel of npc.relationships) {
            if (rel.inheritedFromId !== null && rel.standing < 0) inheritedGrudges++;
        }
        if (npc.status !== 'alive') continue;
        living++;
        const o = npc.cultivation.realmOrdinal;
        if (o > strongest) strongest = o;
        for (let i = 0; i < histogram.length; i++) {
            if (o >= tiers[i] && o < tiers[i + 1]) {
                histogram[i]++;
                break;
            }
        }
    }

    let changedLocations = 0;
    let locationChanges = 0;
    for (const loc of state.locations) {
        locationChanges += loc.changes.length;
        if (loc.kind !== loc.origin.kind) changedLocations++;
    }

    const live = state.factions.filter(f => f.dissolvedOnDay === null);

    return {
        day: state.currentDay,
        year: Math.floor(state.currentDay / DAYS_PER_YEAR),
        livingNpcs: living,
        liveFactions: live.length,
        dissolvedFactions: state.factions.length - live.length,
        factionIds: live.map(f => f.id).sort(),
        changedLocations,
        locationChanges,
        facts: state.history.facts.length,
        unresolvedFacts: state.history.facts.filter(f => f.truth === 'unresolved').length,
        inheritedGrudges,
        inheritedGoals,
        realmHistogram: histogram,
        strongestOrdinal: strongest
    };
}
