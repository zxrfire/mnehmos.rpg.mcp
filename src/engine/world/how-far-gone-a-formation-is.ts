/**
 * How far gone a formation is, and therefore how hard the door still is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE NUMBER, READ FROM TWO DIRECTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module exists because two subsystems need the same answer and must not
 * each invent one:
 *
 *   A PROSPECTOR asking whether they can get into a sealed place they have
 *   found, which is the whole of what a delve costs before anything inside it
 *   is considered.
 *
 *   SOMEBODY ARRIVING AT A CLOSED-DOOR SECLUSION, which is the same question
 *   from the far side. A sealed door is not a ward. From outside, a live
 *   cultivator's sealed cave and a dead one's sealed cave are the same object:
 *   a door somebody put a formation on and did not open again. The prospector
 *   cannot tell which they are looking at, and the only way to find out is to
 *   open it.
 *
 * So THE ODDS OF GETTING INTO A SEALED CAVE AND THE ODDS OF GETTING INTO AN OLD
 * RUIN ARE THE SAME NUMBER. {@link oddsOfGettingThroughTheDoor} is that number.
 * Anything that wants a second one is wrong.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DECAY IS THE CLOCK THAT DRIVES THE WHOLE CATEGORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Formations weaken. That single fact is what makes closed ground one system
 * rather than three:
 *
 *   IT IS WHY THE RESERVE ARRIVES ON A SCHEDULE. The wards on a dead
 *   cultivator's cave hold, and then they do not. The door stops being a door
 *   some decades after the person behind it stopped being alive, and that is
 *   when the place becomes findable - which is why new ground turns up steadily
 *   instead of all at once when somebody dies.
 *
 *   IT IS WHY AN INHERITANCE BECOMES A RUIN. An inheritance's trial IS a live
 *   formation. As it weakens the sorting fails, and a trial that was built to
 *   admit only the worthy stops being able to refuse anybody. A decayed
 *   inheritance is a ruin precisely because its formations no longer enforce
 *   the intent. That is convergence with a cause rather than two tables that
 *   happen to look alike.
 *
 *   IT IS WHY THE DIFFICULTY CURVE IS HONEST. A recently sealed place is nearly
 *   impossible and holds everything. An ancient one is enterable by ordinary
 *   people and has been picked over by them. Dangerous-and-empty and
 *   intact-and-lethal are both real, both reachable, and both interesting, and
 *   neither of them had to be authored.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT DECIDES HOW LONG IT HOLDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two things and no others: WHO SET IT and HOW LONG AGO. There is no faction
 * branch, no importance term and no site-specific constant - a patriarch's seal
 * and a bandit's are the same function of the same two numbers, and what is
 * different about the patriarch is the ordinal. That is the same rule
 * `AGENTS.md` states about combat and for the same reason.
 *
 * The half-life rises steeply with the setter's rung because that is what the
 * ladder means: each realm is roughly four times the last, so a seal set four
 * realms up outlasts one below it by a great deal rather than by a little. It
 * is stated as a half-life rather than an expiry because a formation does not
 * fail on a date - it gets thinner, and somebody gets through it earlier than
 * anybody expected.
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
 * The odds a claimant at this rung gets through this door.
 *
 * THE ONE NUMBER. A prospector at a sealed ruin and an intruder at a closed-door
 * seclusion both read this, with the same arguments, and get the same answer -
 * which is the point, because from outside the two places are the same object.
 *
 * Shaped so that meeting the effective ward is most of the way there and
 * exceeding it comfortably is nearly certain, while being well under it is
 * small but never nil: somebody weak gets into something old occasionally, and
 * that occasional case is where half the interesting things in this world come
 * from.
 */
export function oddsOfGettingThroughTheDoor(
    input: { setByOrdinal: number; yearsSince: number; claimantOrdinal: number }
): number {
    const ward = effectiveWardOrdinal(input);
    const gap = input.claimantOrdinal - ward;
    // A logistic on the gap in rungs. Four rungs either side of the ward covers
    // most of the range, which is about one realm and is the unit the rest of
    // the engine reasons in.
    const odds = 1 / (1 + Math.exp(-gap / 3));
    return Number(Math.min(0.99, Math.max(0.01, odds)).toFixed(4));
}

// ─────────────────────────────────────────────────────────────────────────
// HOW FAR GONE, IN WORDS
// ─────────────────────────────────────────────────────────────────────────

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

/** What each band looks like from outside, in the catalog's register. */
export const WHAT_A_DOOR_LOOKS_LIKE: Readonly<Record<WardCondition, string>> = {
    as_set:
        'The formation is lit and even and there is no gap anywhere in it. Whatever this is, it was closed recently enough that the person who closed it may still be behind it.',
    holding:
        'Lit, and drawing, and a reader can see where the lines have gone slightly out of true. It will hold for a good deal longer than anybody standing here is going to live.',
    thin:
        'The lines are legible and the draw is not even. There are places a careful party could work at, and the fact that it is worth working at is why the ground around the door is trodden.',
    nearly_gone:
        'Barely answering. Somebody who knows what they are looking at can see the shape of what it used to be and can also see that it is not going to stop them.',
    a_wall:
        'Nothing is running. What is left is masonry and a door, which is still an obstacle, and is an obstacle of an entirely ordinary kind that anybody can price.'
};

/**
 * The intent axis, and the reason it is an axis rather than two categories.
 *
 * Stated here rather than in the catalog because DECAY is what moves a place
 * along it, and decay lives in this file.
 */
export const INTENT_HAS_A_HALF_LIFE = {
    principle:
        'An inheritance is a ruin plus an intent, and intent has a half-life. Given enough time the two categories are the same thing, so they are one kind of place with an axis running along it rather than two tables that happen to look alike.',
    whatWearsOut:
        'The addressee never came. The house that was supposed to send somebody fell. The conditions were written against a world that no longer exists, and the sorting mechanism that enforced them is a live formation which is now thin. After long enough nobody alive knows the place was addressed to anybody and it is simply somewhere with things in it.',
    theSortingIsTheFormation:
        'This is the mechanical statement and it is what makes the convergence honest: a trial admits only the worthy because a working formation refuses everybody else. A trial whose formation is nearly gone cannot refuse anybody, so it is not sorting, so it is not a trial. A decayed inheritance is a ruin for a reason rather than by reclassification.',
    andItIsTheBestDiscoveryInTheGame:
        'Finding out that the ruin being looted was a message, and that the looter is not who it was for. That beat is only available because the two are one kind of place: if they were two catalogs the player would know which one they were standing in before they went in.'
} as const;
