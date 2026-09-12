/**
 * How much cultivation a body carries, counted in bodies at some other rung.
 *
 * Anything that consumes people as fuel needs a rate, and the ladder already
 * has one: `progressRequiredForOrdinal` is the qi a rung cost to reach, so what
 * somebody carries is the sum of every rung they climbed. A table of how many
 * Qi Condensation equal one Nascent Soul would be a second opinion about what a
 * rung is worth, and it would drift from the first.
 *
 * NOT power. `powerMultiplierForOrdinal` says what a rung is worth in a fight,
 * which is flat inside a realm - so it cannot tell a Layer 2 from a Layer 13
 * and would price a whole realm's climbing at nothing.
 *
 * What this does NOT say is what such a process YIELDS.
 * `gradeOfWhatABodyYields` owns that and answers `earth` for a Nascent Soul
 * body, so anything producing heaven grade out of them is doing what no hand
 * can - which is a fact about that process, not about the bodies.
 */

import { NASCENT_SOUL_ORDINAL } from './existence.js';
import { clampOrdinal, progressRequiredOrZero, realmForOrdinal } from './realms.js';

/**
 * The last rung of Nascent Soul.
 *
 * `existence.ts` gates the soul states on the FIRST rung of this realm: below
 * it a destroyed body is simply a death, because there is no soul that outlives
 * the body. This is the other end of the same band, and it is where a soul
 * stops being newborn.
 */
export const NASCENT_SOUL_LAST_ORDINAL = realmForOrdinal(NASCENT_SOUL_ORDINAL).ordinalEnd;

/**
 * Whether a soul at this rung is grown enough to refuse being taken.
 *
 * One band above `existence.ts`'s gate, and the two together are why the
 * Nascent Soul band is the only window in which a soul both exists and cannot
 * defend itself.
 */
export function aSoulThisOldCanRefuse(realmOrdinal: number): boolean {
    return clampOrdinal(realmOrdinal) > NASCENT_SOUL_LAST_ORDINAL;
}

/**
 * A recipe written as a count of bodies at a rung.
 */
export interface ACountOfBodies {
    bodies: number;
    ordinal: number;
}

/**
 * What one body at this rung carries, in qi-units: everything it spent getting
 * here.
 *
 * Rungs BELOW the one they stand on, because `progressRequiredForOrdinal(n)` is
 * what has to be accumulated while standing at n in order to leave it. What
 * somebody at the floor carries is therefore nothing, which is correct and is
 * why the fuel arithmetic prices a Layer 1 at zero rather than at one.
 */
export function whatABodyCarries(realmOrdinal: number): number {
    let total = 0;
    for (let rung = 0; rung < clampOrdinal(realmOrdinal); rung += 1) {
        total += progressRequiredOrZero(rung);
    }
    return total;
}

/**
 * The same quantity of cultivation, counted in bodies at a different rung.
 *
 * Rounds up, because a fraction of a person is not fuel. The curve is steep, so
 * the answer moves by orders of magnitude across the ladder - which is the
 * whole reason anything that burns people prefers the strongest fuel it can
 * hold down rather than the most of it.
 */
export function theSameCultivationIn(written: ACountOfBodies, atOrdinal: number): number {
    const wanted = written.bodies * whatABodyCarries(written.ordinal);
    const each = whatABodyCarries(atOrdinal);
    // The floor of the ladder has spent nothing, so no number of them adds up
    // to anything. Infinity rather than zero: zero would read as free.
    return each <= 0 ? Number.POSITIVE_INFINITY : Math.ceil(wanted / each);
}
