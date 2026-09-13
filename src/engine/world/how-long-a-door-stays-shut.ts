/**
 * How long a door stays shut, and how long it stands open when it comes round.
 *
 * TWO FIGURES OFF TWO DIFFERENT RECORDS, which is the point of the file. Both
 * were one uniform draw before - 120 to 600 years between openings and 20 to 90
 * days open - so the ruin the world most wanted somebody to reach was as easy to
 * be standing at as the shallowest one, and neither figure said anything about
 * the ground it belonged to.
 *
 *   the wait     what is behind the door. Its qi band, stepped by how much went
 *                in with it when it was sealed. The best pocket below the Lid
 *                comes round once in six centuries; ordinary ground comes round
 *                every sixty years.
 *   the window   how fiercely the place holds itself shut, which is the rung its
 *                trials were calibrated for and nothing else. Ground left to
 *                Qi Condensation disciples stands open a season. Ground left to
 *                a Spirit Severing formation gives a week.
 *
 * They are kept apart deliberately. Reading both off one number would be one
 * axis wearing two names, and the correlation that does exist - the oldest ages
 * sealed the richest pockets behind the highest trials - is a fact about this
 * world's history rather than an identity in this arithmetic. A rich site with
 * a mild seal is a real row and stands open for a season.
 *
 * THE RATIO IS THE MECHANIC. A week against sixty years is the tight extreme and
 * it has to stay reachable: a door open a season can be walked to, and a door
 * open a week cannot, which is the whole reason somebody at Void Tribulation is
 * asked to escort and a junior burns a talisman to be there on the day.
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

/**
 * Days a window runs, by the realm tier the trials were calibrated for.
 *
 * Descending, and that is the design: the fiercer the ground, the less of it
 * anybody gets. Indexed by `realmIndexOf(dangerOrdinal)` and clamped to the end
 * of the table, so the ladder can grow a tier without this needing a row.
 */
export const WINDOW_DAYS_BY_TIER: readonly number[] = [90, 60, 30, 14, 7];

/**
 * How long this site stands open once it opens, in days.
 */
export function windowDaysFor(dangerOrdinal: number): number {
    const tier = Math.max(0, realmIndexOf(dangerOrdinal));
    return WINDOW_DAYS_BY_TIER[Math.min(tier, WINDOW_DAYS_BY_TIER.length - 1)];
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

/** The shape `LocationRecord.cycle` holds. Restated structurally to keep the
 *  derivation out of the module that owns the record. */
export interface ADoorsSchedule {
    periodDays: number;
    openDays: number;
    phaseDay: number;
}

/**
 * The schedule for one ancient site, or null for the three fifths of them that
 * are simply shut and stay that way until somebody opens them.
 */
export function scheduleForAnAncientSite(input: {
    id: string;
    qiDensity: number;
    dangerOrdinal: number;
    hoardCount: number;
    /** The year it was sealed. The phase is a property of its own history. */
    sealedYear: number;
}): ADoorsSchedule | null {
    const rng = forStream('ruin-convergence', input.id);
    if (!rng.chance(CONVERGENT_SHARE)) return null;
    const periodDays = yearsBetweenOpeningsFor(input) * YEAR;
    return {
        periodDays,
        openDays: windowDaysFor(input.dangerOrdinal),
        // Phased off the day it was sealed, so the schedule is a property of
        // the site's own history rather than of when the simulation started.
        phaseDay: input.sealedYear * YEAR + rng.int(0, periodDays - 1)
    };
}
