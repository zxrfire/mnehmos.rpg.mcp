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
 * The clock and the world's own affairs advance TOGETHER, a year at a time,
 * and then the digest is built once over everything that happened.
 *
 * Advancing the clock the whole way first and running pressure afterwards is
 * the obvious shape and it is wrong: it does all of a century's dying before
 * any of its politics, and pressure binds to whoever is alive when it fires. It
 * also breaks decomposability - ten years then thirty stops equalling forty -
 * which is the property this entire layer rests on. Interleaving costs nothing,
 * because `advanceTime` is a function of what is on the books rather than of
 * how many days are in the step.
 *
 * An interrupt stops the loop, so a seclusion broken in year three gets three
 * years of consequences and not forty.
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

import type { NpcStatus } from './npc-state.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { HistoricalFact, Observer } from './history.js';
import { buildPlayerDigest, type DigestOptions, type PlayerAccess, type PlayerDigest } from './digest.js';
import { advanceImmortalLayer, type ImmortalPeril } from './immortal-world.js';
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
    /** People born across the span. */
    born: number;
    time: TimeAdvanceResult;
    deaths: DeathHandoff[];

    /**
     * What happened on the far side of the Lid in the same span.
     *
     * Empty on almost every world, because almost no world has anybody up
     * there. When it is not empty it is the other half of "both layers keep
     * running": an ascended cultivator does not leave a snapshot behind and
     * does not become one.
     */
    immortalPerils: ImmortalPeril[];
    /** People who stopped being above the Lid. Nobody below can learn this. */
    immortalDeaths: string[];

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
    const requested = Math.max(0, Math.floor(opts.days));

    // ── Why this is a loop and not two calls ─────────────────────────────
    //
    // The obvious shape is: move the clock the whole way, then run pressure
    // over the whole span. It is wrong, and subtly: doing all of a century's
    // dying before any of its politics is a different world from interleaving
    // them, because pressure binds to whoever is alive when it fires. That also
    // makes the pass non-decomposable - ten years then thirty stops equalling
    // forty, which is the property the whole layer is built on.
    //
    // So the two advance together, a year at a time. `advanceTime` is O(what is
    // on the books) rather than O(days), so five hundred one-year steps cost
    // about what one five-hundred-year step costs, and the result is
    // order-independent.
    const STEP = DAYS_PER_YEAR;
    const pressureEvents: PressureEvent[] = [];
    const timeSlices: TimeAdvanceResult[] = [];
    const immortalPerils: ImmortalPeril[] = [];
    const immortalDeaths: string[] = [];
    let born = 0;
    let remaining = requested;
    let interrupted = false;
    let interruptReason: string | null = null;

    while (remaining > 0) {
        const slice = Math.min(STEP, remaining);
        const before = state.currentDay;
        const time = advanceTime(state, slice, {
            inPlace: true,
            observer: opts.observer,
            interruptPolicy: opts.interruptPolicy,
            stopOnInterrupt: opts.stopOnInterrupt,
            onDeath: opts.onDeath
        });
        timeSlices.push(time);

        const pressure = applyPressure(state, before, time.toDay, opts.pressure);
        pressureEvents.push(...pressure.events);
        born += pressure.born;

        // The far side, on the same slice. A no-op on any world nobody has
        // ascended from, which is nearly all of them - and the reason "the
        // lower world does not pause" and "the immortal world does not pause"
        // are one statement rather than two.
        const above = advanceImmortalLayer(state, before, time.toDay);
        immortalPerils.push(...above.perils);
        immortalDeaths.push(...above.deaths);
        for (const event of pressure.events) {
            for (const handoff of event.deaths) opts.onDeath?.(handoff);
        }

        remaining -= time.daysAdvanced;
        if (time.interrupted) {
            interrupted = true;
            interruptReason = time.interruptReason;
            break;
        }
        // A slice that advanced nothing would spin forever.
        if (time.daysAdvanced <= 0) break;
    }

    const last = timeSlices[timeSlices.length - 1];
    const time: TimeAdvanceResult = last ?? advanceTime(state, 0, { inPlace: true });
    const events = state.history.facts.slice(factsBefore);
    const deaths = timeSlices.flatMap(t => t.deathHandoffs)
        .concat(pressureEvents.flatMap(e => e.deaths));
    const pressure = { events: pressureEvents, born };

    // What of it reached the player.
    const digest = opts.access
        ? buildPlayerDigest(events, opts.access, fromDay, state.currentDay, opts.digest)
        : null;

    return {
        state,
        fromDay,
        toDay: state.currentDay,
        daysRequested: requested,
        daysAdvanced: state.currentDay - fromDay,
        interrupted,
        interruptReason,
        events,
        pressure: pressure.events,
        born,
        time,
        deaths,
        immortalPerils,
        immortalDeaths,
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
    /**
     * Highest ordinal the ENGINE knows is out there, counting people the
     * world cannot currently account for. See `EXTANT_STATES`.
     */
    strongestOrdinal: number;
    /** Extant but not `alive`: missing, sealed, between bodies. */
    unaccountedFor: number;
}

/**
 * States in which the ENGINE knows somebody still exists, whatever the world
 * believes about it.
 *
 * `missing` is the load-bearing one and it is why this predicate exists at all.
 * At the top of the ladder almost nobody is seen from one century to the next,
 * so being unaccounted for is the ORDINARY condition of a Tribulation
 * Transcendence figure rather than a loss - `ExistenceState` says as much in
 * its own comment: whereabouts unknown, aliveness genuinely unresolved.
 *
 * Counting only `alive` conflated two different questions and made the
 * instrument unable to see the state the world is supposed to produce: a
 * perfectly ordinary disappearance read as the ceiling dropping, so a drift
 * audit reported collapse where the setting was working correctly. The engine
 * is allowed to know things the world cannot - that is the same licence
 * `afterCrossing` takes when it records `still_above` about somebody no house
 * can confirm - and the ceiling is an engine fact.
 */
const EXTANT_STATES = new Set<NpcStatus>([
    'alive',
    'missing',
    'sealed',
    'soul_preserved',
    'possessing',
    'reconstructed'
]);

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
    let unaccountedFor = 0;
    let inheritedGoals = 0;
    let inheritedGrudges = 0;

    for (const npc of state.npcs) {
        for (const goal of npc.goals) if (goal.generation > 0) inheritedGoals++;
        for (const rel of npc.relationships) {
            if (rel.inheritedFromId !== null && rel.standing < 0) inheritedGrudges++;
        }
        // The ceiling is what the engine knows is out there. The headcount is
        // what the world can see. They are different questions and were being
        // answered by one filter.
        if (EXTANT_STATES.has(npc.status)) {
            const reach = npc.cultivation.realmOrdinal;
            if (reach > strongest) strongest = reach;
            if (npc.status !== 'alive') unaccountedFor++;
        }
        if (npc.status !== 'alive') continue;
        living++;
        const o = npc.cultivation.realmOrdinal;
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
        strongestOrdinal: strongest,
        unaccountedFor
    };
}
