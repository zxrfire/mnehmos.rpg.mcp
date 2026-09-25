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
import {
    applyAbsence,
    openAbsencesForTheUnaccountedFor,
    type Absence,
    type AbsenceConsequence
} from './when-somebody-does-not-come-back.js';
import type { KnowledgeRecord } from '../social/knowledge.js';
import type { ObligationInput } from '../social/grudges.js';
import { theWorldForgetsTheMortalDead } from './world-state.js';
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
    /**
     * Absences to advance that are not on the world's own list.
     *
     * `state.absences` is where they live, and this pass sweeps up everybody
     * the world has marked missing and opens one for them - so an NPC needs
     * nothing here. What this is for is an absentee the WORLD does not hold a
     * record of: a played cultivator sealing a door, who is an actor and not
     * an NPC, and whose caller knows who they told.
     *
     * Mutated in place, and advanced exactly once even if the same object is
     * also on the world's list.
     */
    absences?: Absence[];
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
     * Accounts the span opened, ready for the ledger.
     *
     * The world cannot write these - there is no obligation ledger in
     * `WorldState` - so they come out with the deaths and the estates for
     * whoever holds a database. Today it is a war's dead and the people who
     * gave up waiting for somebody who never came back - the second lot with
     * NO NAME on the row, which is the point of them - and anything else that
     * decides an account inside a tick lands here beside them.
     *
     * The rows carry `triggeringEventId`, so the same death arriving twice is
     * the same row: `createObligation` derives its id from the pair, the cause
     * and that event, and the write path is INSERT OR REPLACE.
     */
    accounts: ObligationInput[];

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

    /**
     * What the span did to the people who were waiting for somebody absent.
     *
     * Empty unless `absences` was passed. These are the consequences of the
     * absence itself - who stopped waiting, who died waiting, when the world
     * wrote the absentee off - and are separate from `events` because most of
     * them are not chronicle-visible to anybody but the person they happened to.
     */
    absenceConsequences: AbsenceConsequence[];
    /**
     * Dated, sourced, possibly-false accounts of an absence, for the caller to
     * file in a `KnowledgeLedger`. Nothing in this layer stores them.
     */
    absenceAccounts: KnowledgeRecord[];
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
    // BY ID, BECAUSE THE LEDGER CAN NOW GET SHORTER.
    //
    // This was a length, and the year's events were whatever sat past that
    // index at the end. `theWorldForgetsTheMortalDead` removes facts as well as
    // rows - 1,850 of 4,670 at two hundred years named nobody but people the
    // world cannot speak of - so a positional window silently returns the wrong
    // slice and the digest under-reports the year it just simulated. Nothing
    // would have thrown.
    const factsBefore = new Set(state.history.facts.map(f => f.id));
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
    const absenceConsequences: AbsenceConsequence[] = [];
    const absenceAccounts: KnowledgeRecord[] = [];
    const absenceOpens: ObligationInput[] = [];
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

        // After the deaths and the politics of the slice, not before: somebody
        // who died this year has to be dead by the time the absence pass asks
        // whether they are still waiting, or they die waiting a year late. It
        // is also after the pressure layer, which is what MARKS people missing
        // - so somebody who walked into the hills this year has an absence
        // opened for them this year rather than next.
        //
        // Opening first and advancing second is deliberate and costs nothing:
        // a brand-new absence has elapsed zero years and the pass is a no-op
        // on it. Doing it the other way round would date every absence a year
        // after the world stopped being able to see the person.
        openAbsencesForTheUnaccountedFor(state, state.currentDay);
        for (const absence of absencesToAdvance(state, opts)) {
            const pass = applyAbsence(state, absence, state.currentDay);
            absenceConsequences.push(...pass.consequences);
            absenceAccounts.push(...pass.accounts);
            absenceOpens.push(...pass.opens);
        }

        // AND THE WORLD DOES NOT KEEP A FARMER WHO DIED. After the deaths, the
        // politics and the absences of this slice.
        //
        // PER SLICE, BECAUSE ONCE PER CALL IS A FACT ABOUT THE CALLER. This
        // sweep deletes people and the facts naming nobody else, so where it
        // runs decides what the next year is simulated against. Run once at the
        // end of an advance it was the whole of the decomposability defect:
        // forty fixture years in one call against two diverged at 285 facts to
        // 291, and with the sweep removed entirely three hundred years in 1, 3,
        // 5 and 10 calls were identical to the character. A played game advances
        // in whatever slices a player's turns make. A world year is a fact about
        // the clock, so forgetting on one cannot be read back to the caller.
        //
        // It lived here before and was moved out for breaking fact linkage - 332
        // facts at eighty years naming somebody who did not carry them. That was
        // two caches keyed on the objects HOLDING the roster and the ledger
        // rather than on those arrays, which this replaces; both are now keyed
        // on the array, and the same measurement is 0.
        //
        // Anybody a priced deed names is kept: a man whose brother still
        // carries the account is not one of the corpses this is for.
        theWorldForgetsTheMortalDead(state);
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
    const events = state.history.facts.filter(f => !factsBefore.has(f.id));
    const deaths = timeSlices.flatMap(t => t.deathHandoffs)
        .concat(pressureEvents.flatMap(e => e.deaths));
    // The war dead, and now the people who stopped waiting. Both are rows the
    // world decided and cannot write, and they leave by the same door.
    const accounts = pressureEvents.flatMap(e => e.opens ?? []).concat(absenceOpens);
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
        accounts,
        immortalPerils,
        immortalDeaths,
        digest,
        absenceConsequences,
        absenceAccounts
    };
}

/**
 * The world's own absences, plus whatever the caller is carrying separately.
 *
 * Identity, not id: an absence is mutated in place and advancing the same
 * object twice in one slice would step it two years for one year of world. A
 * caller that passes an object already on `state.absences` - the natural thing
 * to do while migrating - gets it advanced once.
 */
function absencesToAdvance(state: WorldState, opts: AdvanceForPlayOptions): Absence[] {
    const own = state.absences ?? [];
    const extra = (opts.absences ?? []).filter(a => !own.includes(a));
    return own.concat(extra);
}

/** The same, phrased in years. */
export function advanceWorldYears(
    state: WorldState,
    years: number,
    opts: Omit<AdvanceForPlayOptions, 'days'> = {}
): PlayAdvanceResult {
    return advanceWorldForPlay(state, { ...opts, days: Math.round(years * DAYS_PER_YEAR) });
}

