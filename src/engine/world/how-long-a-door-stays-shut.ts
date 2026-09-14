/**
 * How long a door stays shut, and how long it stands open when it comes round.
 *
 *   the wait     what is behind the door. Its qi band, stepped by how much went
 *                in with it when it was sealed. The best pocket below the Lid
 *                comes round once in six centuries; ordinary ground comes round
 *                every sixty years.
 *   the window   the wait's own band, and then how fiercely the place holds
 *                itself shut - the rung its trials were calibrated for - picking
 *                a place inside that band.
 *
 * THE WINDOW BELONGS TO THE WAIT, and that is the correction this file carries.
 * The window was read off danger alone and descended 90/60/30/14/7, so crossed
 * with the wait it produced the one door in the world nobody can use: the
 * richest, fiercest site waited six centuries and stood open SEVEN DAYS, and
 * seven days was the mode at 32 of 72 scheduled sites. The design owner's week
 * was said of a SIXTY year cycle and named explicitly as the fastest-to-close
 * case rather than the exemplar. A door that comes round once in six centuries
 * is a date the province has known for generations, and a week of it reaches
 * nobody.
 *
 * So a week is the FLOOR of the shortest wait, the fierce-ground instinct
 * survives inside each band, and the two figures are stated together in one
 * table so they cannot drift apart again.
 *
 * Pure. A ruin's own record in, a schedule out. Nothing here is stored.
 */

import { realmIndexOf } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import { ordinaryBandFor } from './qi-scale.js';

/** Days in a year, on the world clock. */
const YEAR = 365;

/** Share of ancient sites that are reachable only when the convergence comes. */
export const CONVERGENT_SHARE = 0.4;

/**
 * The three waits, in years. The design owner named these three.
 */
export const CYCLE_YEARS = { short: 60, middling: 120, long: 600 } as const;

/**
 * The wait, by how much is behind the door. Indexed by {@link worthBehindTheDoor}.
 */
export const CYCLE_YEARS_BY_WORTH: readonly number[] = [
    CYCLE_YEARS.short,
    CYCLE_YEARS.short,
    CYCLE_YEARS.middling,
    CYCLE_YEARS.long
];

/** Manuals and objects that make a hoard worth six centuries of waiting. */
export const A_HOARD_WORTH_WAITING_FOR = 4;

/** What a pocket's qi band is worth toward the wait. */
const QI_STEP = { thin: 0, normal: 0, dense: 1, spirit_tide: 2 } as const;

/**
 * What is behind the door, 0..3, off facts the ground already carries.
 */
export function worthBehindTheDoor(input: {
    qiDensity: number;
    /** Manuals and objects sealed in with it. */
    hoardCount: number;
}): number {
    const qi = QI_STEP[ordinaryBandFor(input.qiDensity)];
    return qi + (input.hoardCount >= A_HOARD_WORTH_WAITING_FOR ? 1 : 0);
}

/** The week the design owner named: the fastest-to-close case, and the floor. */
export const SHORTEST_WINDOW_DAYS = 7;

/**
 * Days a window runs, keyed by the wait in years and then by the realm tier the
 * trials were calibrated for.
 *
 * One table rather than two, because the window is a band of the wait's and
 * stating them apart is what let them contradict each other. Each row descends
 * by tier - the fiercer the ground, the less of its own band anybody gets - and
 * every row sits above the one below it, so no six-century door is ever shorter
 * than a sixty-year one however fierce it is. Indexed by
 * `realmIndexOf(dangerOrdinal)` and clamped to the end of the row, so the ladder
 * can grow a tier without this needing a column.
 */
export const WINDOW_DAYS_BY_WAIT: Readonly<Record<number, readonly number[]>> = {
    [CYCLE_YEARS.short]: [21, 18, 14, 10, SHORTEST_WINDOW_DAYS],
    [CYCLE_YEARS.middling]: [60, 50, 40, 30, 21],
    [CYCLE_YEARS.long]: [180, 150, 120, 90, 60]
};

/**
 * How long this site stands open once it opens, in days.
 */
export function windowDaysFor(waitYears: number, dangerOrdinal: number): number {
    const band = WINDOW_DAYS_BY_WAIT[waitYears] ?? WINDOW_DAYS_BY_WAIT[CYCLE_YEARS.short];
    const tier = Math.max(0, realmIndexOf(dangerOrdinal));
    return Math.max(SHORTEST_WINDOW_DAYS, band[Math.min(tier, band.length - 1)]);
}

/**
 * Years between openings for this site.
 */
export function yearsBetweenOpeningsFor(input: {
    qiDensity: number;
    hoardCount: number;
}): number {
    const worth = worthBehindTheDoor(input);
    return CYCLE_YEARS_BY_WORTH[Math.min(worth, CYCLE_YEARS_BY_WORTH.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────
// THREE KINDS OF GROUND, AND ONLY ONE OF THEM HAS A DOOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * How a piece of ancient ground is kept shut, which is a fact about WHY it was
 * closed rather than about how hard it is.
 */
export type HowThisGroundIsKept =
    /** A door on a schedule. It shuts itself and opens itself. */
    | 'a_season'
    /** Shut, and nothing opens it but somebody going and opening it. */
    | 'shut_until_somebody_opens_it'
    /**
     * Standing open, and always has been. Somebody built it to be found.
     */
    | 'never_shut';

/**
 * Which of the three this ground is.
 *
 * ── GROUND THAT NEVER SHUTS ──────────────────────────────────────────────
 *
 * A door that comes round once in six centuries is a place sealing itself
 * against the world. A tomb is not doing that, and neither is a legacy a master
 * left for whoever proved able to take it: both were built to be reached. So
 * they have no season and no seal, and NOTHING ABOUT THAT MAKES THEM EASY -
 * their gate is inside. `locationFromRuin` already writes it: the thresholds
 * are a statement about who survives being somewhere, the formation is still
 * running and still calibrated for the rung it was set at, and whatever was
 * left walking around is still walking around. No second mechanism is needed
 * and none is added here.
 *
 * ── WHY THESE ROWS ───────────────────────────────────────────────────────
 *
 * Derived, not rolled: a hoard behind it and a name on it is a legacy. Ground
 * whose builder the world never recorded is nobody's bequest, and ground with
 * nothing in it is not worth being one. Both columns already exist - the hoard
 * is the same count `worthBehindTheDoor` steps the wait on, and the name is
 * `ruinProvenance`'s own standing, which is why `documented` is the bar rather
 * than a fourth draw: the world recorded who built it and that record survives.
 */
export function howThisGroundIsKept(input: {
    id: string;
    hoardCount: number;
    /** Whether the world still holds a record of who built it. */
    leftByName: boolean;
}): HowThisGroundIsKept {
    if (input.leftByName && input.hoardCount >= A_HOARD_WORTH_WAITING_FOR) return 'never_shut';
    // The same stream and the same draw the schedule takes below, so deciding
    // this first moves no phase anywhere.
    return forStream('ruin-convergence', input.id).chance(CONVERGENT_SHARE)
        ? 'a_season'
        : 'shut_until_somebody_opens_it';
}

/** The shape `LocationRecord.cycle` holds. Restated structurally to keep the
 *  derivation out of the module that owns the record. */
export interface ADoorsSchedule {
    periodDays: number;
    openDays: number;
    phaseDay: number;
}

/**
 * The schedule for one ancient site, or null for everything with no door on a
 * season - both the ground somebody has to go and open and the ground that
 * never shut. {@link howThisGroundIsKept} tells those two apart.
 */
export function scheduleForAnAncientSite(input: {
    id: string;
    qiDensity: number;
    dangerOrdinal: number;
    hoardCount: number;
    /** The year it was sealed. The phase is a property of its own history. */
    sealedYear: number;
    /** Whether the world still holds a record of who built it. */
    leftByName?: boolean;
}): ADoorsSchedule | null {
    if (howThisGroundIsKept({
        id: input.id,
        hoardCount: input.hoardCount,
        leftByName: input.leftByName ?? false
    }) !== 'a_season') return null;
    // THE DRAW ABOVE IS RE-TAKEN RATHER THAN SKIPPED, and the order is
    // load-bearing: the phase comes off this stream one position in, and
    // reading it from position zero would move every schedule in every world
    // for no reason anybody asked for.
    const rng = forStream('ruin-convergence', input.id);
    rng.chance(CONVERGENT_SHARE);
    const waitYears = yearsBetweenOpeningsFor(input);
    const periodDays = waitYears * YEAR;
    return {
        periodDays,
        openDays: windowDaysFor(waitYears, input.dangerOrdinal),
        // Phased off the day it was sealed, so the schedule is a property of
        // the site's own history rather than of when the simulation started.
        phaseDay: input.sealedYear * YEAR + rng.int(0, periodDays - 1)
    };
}
