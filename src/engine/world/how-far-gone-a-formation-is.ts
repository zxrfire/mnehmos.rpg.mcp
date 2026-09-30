/**
 * Formation decay supplies the rung that a ward still answers at.
 *
 * Entry windows are read by `isOpenOn`; force against a closed door is
 * decided by `canUnmake`. Decay supplies the remaining rung, not a second
 * chance to bypass either gate. The half-life grows with the setter's rung.
 */

import { MAX_ORDINAL } from '../cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CLOCK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Years a formation set at ordinal 0 takes to lose half its strength.
 *
 * Deliberately short. A mortal's chalk line is gone in a lifetime, which is
 * what makes the ordinal term below the interesting one rather than a
 * decoration on a constant.
 */
export const WARD_HALF_LIFE_AT_THE_BOTTOM_YEARS = 12;

/**
 * What each rung multiplies the half-life by.
 *
 * A seal at Core Formation holds roughly forty times as long as one at the
 * bottom of Qi Condensation; a seal at the top of the ladder holds for tens of
 * thousands of years, which is what makes the Late Age's own work still
 * dangerous and is the reason the deepest ground is the ground nobody has been
 * able to get into rather than the ground nobody has found.
 */
export const WARD_HALF_LIFE_PER_ORDINAL = 1.24;

/**
 * How much of a formation is still standing, 0..1.
 *
 * 1 is the day it was set. 0.5 is one half-life later, and it never quite
 * reaches zero, because a formation that is entirely gone is a wall - and a
 * wall is still something a person has to climb, which the caller prices as
 * force rather than as a ward.
 */
export function wardIntegrityOf(
    input: { setByOrdinal: number; yearsSince: number }
): number {
    const ordinal = Math.max(0, Math.min(MAX_ORDINAL, input.setByOrdinal));
    const halfLife = wardHalfLifeYears(ordinal);
    const elapsed = Math.max(0, input.yearsSince);
    return Number(Math.pow(0.5, elapsed / halfLife).toFixed(6));
}

/** Years this setter's work takes to halve. The whole of the ordinal term. */
export function wardHalfLifeYears(setByOrdinal: number): number {
    const ordinal = Math.max(0, Math.min(MAX_ORDINAL, setByOrdinal));
    return WARD_HALF_LIFE_AT_THE_BOTTOM_YEARS * Math.pow(WARD_HALF_LIFE_PER_ORDINAL, ordinal);
}

/**
 * The rung a door still answers at, which is not the rung it was set at.
 *
 * A seal set at Deity Transformation and half gone asks what a Nascent Soul
 * seal asks. This is the number a claimant is actually measured against, and it
 * is why an ancient site set by somebody enormous can be opened by ordinary
 * people while a fresh one set by a merely competent person cannot.
 */
export function effectiveWardOrdinal(
    input: { setByOrdinal: number; yearsSince: number }
): number {
    const integrity = wardIntegrityOf(input);
    return Math.max(0, Math.round(input.setByOrdinal * integrity));
}

/**
 * Bands a narrator can say out loud, and the only place the thresholds live.
 *
 * A party standing at a door can read this off the door - a formation that is
 * nearly gone LOOKS nearly gone, which is a thing formation readers are for.
 * What it does not tell anybody is whether there is somebody alive behind it.
 */
export type WardCondition = 'as_set' | 'holding' | 'thin' | 'nearly_gone' | 'a_wall';

export function wardConditionOf(integrity: number): WardCondition {
    if (integrity >= 0.85) return 'as_set';
    if (integrity >= 0.5) return 'holding';
    if (integrity >= 0.2) return 'thin';
    if (integrity >= 0.03) return 'nearly_gone';
    return 'a_wall';
}

/**
 * What each band looks like from outside. Read by `describeFoundGround`, so a
 * found ruin's wards are said in these bands and at these thresholds only.
 */
export const WHAT_A_DOOR_LOOKS_LIKE: Readonly<Record<WardCondition, string>> = {
    as_set:
        'The formation on the door is lit and even, with no gap in it anywhere.',
    holding:
        'The formation on the door is lit and drawing, and its lines have gone slightly out of true.',
    thin:
        'The formation on the door is legible and draws unevenly, with gaps in its lines.',
    nearly_gone:
        'The formation on the door barely answers. Its lines remain visible.',
    a_wall:
        'Nothing in the formation on the door is running. What is left is masonry and a door.'
};

// Decay's intent axis is explained in docs/world/places/closed-ground.md.
