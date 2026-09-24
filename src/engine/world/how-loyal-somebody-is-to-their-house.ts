/**
 * HOW LOYAL SOMEBODY IS TO THEIR HOUSE, and what it is worth when a seat is
 * being filled.
 *
 * The design owner: a house choosing among people who all qualify weighs
 * loyalty, the way being `chosen` is already weighed - **never as a gate**. The
 * gates are the rung's realm bar and its merit minimum, and they stay exactly
 * what they are. This orders the people who have already cleared both.
 *
 * What leaving looks like from the person's side, and what a departure is
 * negotiated over, is `docs/world/climbing/past-the-ceiling.md`, *Leaving, and
 * what it costs*.
 *
 * ── IT IS READ, NOT STORED ───────────────────────────────────────────────
 *
 * Nothing new is written onto anybody. Loyalty is what the row already says
 * about this person, in three parts, none of which is invented here:
 *
 *   WHO THEY ARE      `openHandednessOf`, the world's own per-person
 *                     disposition on -1..+1, derived from their id and drawn
 *                     nowhere - somebody close-fisted about their own things is
 *                     the same person who leaves when it suits them.
 *   HOW THEY STAND    the ties they hold to their own house's people. Warmth
 *                     toward the people they serve beside is loyalty as the
 *                     world can see it; a grievance inside the house is the
 *                     opposite, and weighs double, because a rival under one
 *                     roof is the commonest reason anybody walks out
 *                     (`why-somebody-walks-out-of-a-compound.ts`).
 *   WHAT THEY HAVE
 *   ALREADY DONE      whether the house counts any service for them at all.
 *                     Not how much - that is merit, which the promotion order
 *                     already reads - only that they have served it.
 *
 * AND AN OATH BROKEN IS THE END OF IT. Somebody who gave their word to a house
 * and broke it does not read as loyal to it whatever else is true, which is why
 * the term is a floor rather than a subtraction: see `brokeTheirWord`.
 *
 * ── WHAT IT IS WORTH ─────────────────────────────────────────────────────
 *
 * Half of what being chosen is worth, and both are read the same way: as merit,
 * WITHIN a realm. A whole major realm still wins over anything
 * (`byStanding`), so loyalty cannot lift somebody over a stronger candidate -
 * it decides between people the house otherwise cannot choose between, which is
 * what the design owner asked for and what a house actually does.
 */

import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { meritWith } from './what-a-house-counts-in-somebodys-favour.js';
import type { NpcRecord } from './npc-state.js';

/** What the three parts are worth against each other. They sum to one. */
export const WHAT_LOYALTY_IS_READ_FROM = Object.freeze({
    /** The person they are, whoever they serve. */
    disposition: 0.4,
    /** How they stand with the people they serve beside. */
    theHouseTheyAreIn: 0.45,
    haveServedIt: 0.15
});

/** A grievance inside the house weighs this much more than warmth does. */
export const A_GRIEVANCE_UNDER_ONE_ROOF_WEIGHS = 2;

/**
 * What loyalty is worth when the house is choosing, as a share of the service a
 * rung asks for. Half of what being `chosen` is worth, which is a whole rung's.
 */
export const WHAT_LOYALTY_IS_WORTH_IN_AN_ORDER = 0.5;

/** The most loyal anybody reads who has broken their word to this house. */
export const WHAT_A_BROKEN_WORD_LEAVES = 0.1;

export interface WhatTheHouseCanSee {
    /** Ids of the people on this house's roll, for reading their ties. */
    membersOfTheHouse: ReadonlySet<string>;
    /** Whether they gave this house their word and broke it. */
    brokeTheirWord?: boolean;
}

/**
 * How loyal this person reads to the house they are on the roll of, 0..1.
 *
 * Zero for somebody on no roll: loyalty is held toward a house, like merit.
 */
export function howLoyalTheyAre(npc: NpcRecord, seen: WhatTheHouseCanSee): number {
    const houseId = npc.factionId;
    if (houseId === null) return 0;

    const disposition = (openHandednessOf(npc.id) + 1) / 2;

    // ONE READING PER PERSON. A pair holds a row per kind, so a brother who is
    // also a rival would otherwise be weighed twice in the same average. The
    // coldest thing standing between them is what they are to each other here:
    // somebody with a grievance against you is not made neutral by also being
    // kin.
    const coldestPerPerson = new Map<string, number>();
    for (const tie of npc.relationships) {
        if (!seen.membersOfTheHouse.has(tie.targetId)) continue;
        const held = coldestPerPerson.get(tie.targetId);
        if (held === undefined || tie.standing < held) coldestPerPerson.set(tie.targetId, tie.standing);
    }
    let warmth = 0;
    let weight = 0;
    for (const standing of coldestPerPerson.values()) {
        const against = standing < 0 ? A_GRIEVANCE_UNDER_ONE_ROOF_WEIGHS : 1;
        warmth += standing * against;
        weight += against;
    }
    const withTheHouse = weight === 0 ? 0.5 : clamp01(((warmth / weight) + 1) / 2);

    const served = meritWith(npc, houseId) > 0 ? 1 : 0;

    const loyal = clamp01(
        disposition * WHAT_LOYALTY_IS_READ_FROM.disposition
        + withTheHouse * WHAT_LOYALTY_IS_READ_FROM.theHouseTheyAreIn
        + served * WHAT_LOYALTY_IS_READ_FROM.haveServedIt
    );
    // A word broken to this house is a ceiling and not a subtraction: nothing
    // else they are makes them read loyal to the people they broke it with.
    return seen.brokeTheirWord === true ? Math.min(loyal, WHAT_A_BROKEN_WORD_LEAVES) : loyal;
}

/**
 * What their loyalty is worth in the order a house takes people, in the units
 * merit is counted in. Never a gate: see the header.
 */
export function whatLoyaltyIsWorthHere(loyalty: number, meritNeededForTheRung: number): number {
    return Math.round(clamp01(loyalty) * Math.max(1, meritNeededForTheRung) * WHAT_LOYALTY_IS_WORTH_IN_AN_ORDER);
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
