/**
 * Why somebody on a house's roll walks out of it, and where they go.
 *
 * A compound is safe, and that is not what a cultivator is for. Everything the
 * world already does with people on the road is a HOUSE dispatching them - a
 * door opens and houses race teams at it, a posting runs for twelve years, an
 * errand has a term and a place to come back to. Nobody has ever decided for
 * themselves that staying is the thing costing them.
 *
 * So the test for anything in this file: **who decided it?** The answer is the
 * person, every time. A house that loses somebody this way finds out afterwards.
 *
 * ── THE REASONS ARE READ, NEVER INVENTED ─────────────────────────────────
 *
 * There is no wanderlust score and there must not be. Every reason below is a
 * fact the world already holds about this person, and two of the readers it
 * comes off had no caller at all:
 *
 *   `houseTeachingCeiling`   the highest rung anything a house teaches could
 *                            carry somebody to. Authored, tested, and read by
 *                            NOTHING in `src/` - so a disciple standing at the
 *                            top of everything their house has was
 *                            indistinguishable from one at the bottom of it.
 *   `shortBy: 'somewhere_else'`  `howSomebodyStandsToAGround` answers, of every
 *                            dao ground in the world, that an outsider is short
 *                            of it BY BEING IN THE WRONG PROVINCE. The engine
 *                            has been saying "they would have this if they went
 *                            there" since it was written, and nothing in the
 *                            world has ever gone. `roadsInReachOf` is read by
 *                            `applyAdvancement` off the person's CURRENT
 *                            location, so walking there is the whole of the
 *                            fix: no new machinery, and the payoff is already
 *                            wired.
 *   `blocked`                `assessPromotions`' list of people who have
 *                            outgrown their rung and cannot be raised. It was
 *                            computed every year and thrown away, and the only
 *                            reason here about having no place in a house fired
 *                            on the bottom rung alone. Now it is its own reason
 *                            at any rung, weighed by how long and how far
 *                            (`being-held-back-in-a-house.ts`).
 *
 * ── AND THEY GO FOR SOMETHING ────────────────────────────────────────────
 *
 * Not out. TO something, and the first choice is the road they are a province
 * short of, because that is the one destination whose reward the engine already
 * computes. A place is preferred over a direction, and nothing here draws.
 *
 * ── A SMALL GROUP IS PEOPLE, NOT A UNIT ──────────────────────────────────
 *
 * Two or three who each had their own reason and hold a tie to each other. No
 * roster, no leader, no standing order: the party is `NpcActivity.withIds`,
 * which `who-is-on-the-road-with-you.ts` argues at length is the only place a
 * party may live, and it is read rather than stored.
 */

import type { CultivationRNG } from '../cultivation/rng.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT STAYING IS COSTING THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * The reasons somebody leaves, in the words somebody in the world could say.
 *
 * A closed set, and every entry is a reading of a fact rather than a mood. The
 * point of the phrasing is that the fact of a departure can be reported with
 * its reason attached - a house short of hands can say WHY it is short.
 */
export type WhyTheyWentOut =
    /** Everything the house teaches tops out at or below where they stand. */
    | 'the house cannot teach them further'
    /** The house did not pay the stipend this year. */
    | 'the house did not pay them'
    /** There is ground that would teach them a road, and it is not near here. */
    | 'a road a province away'
    /** Somebody they knew went out for the house and never came back. */
    | 'somebody they knew did not come back'
    /** No room, no office, and nothing in the purse. */
    | 'nothing in the hall is theirs'
    /**
     * Past the bar of the rung above, and the house cannot raise them - no
     * seat, somebody ahead, not enough service, or no room for another elder
     * without an office. At any rung. `being-held-back-in-a-house.ts`.
     */
    | 'the house has no room for them to rise';

export interface WhatStayingIsCostingThem {
    ordinal: number;
    /**
     * The top of what their house teaches, or null where nothing is written
     * down about it. `houseTeachingCeiling` is the one reading.
     */
    houseTeachingCeiling: number | null;
    /** Whether the house could pay its people this year. */
    theHousePaidThem: boolean;
    /** Ties of theirs whose other end is missing or dead. */
    peopleTheyKnewWhoDidNotComeBack: number;
    /** Their rung on the house's own ladder. Zero is the bottom of it. */
    factionRankIndex: number;
    /** What they are carrying. */
    spiritStones: number;
    /** Whether the world holds a road they are short of only by distance. */
    aRoadAProvinceAway: boolean;
    /**
     * How many reasons' worth being held back in the house is, or zero where
     * they are not. `howHardBeingHeldBackPresses`: it grows with how long they
     * have waited and how far past the bar they stand, and reads no rung.
     */
    beingHeldBack?: number;
}

/**
 * What somebody is carrying nothing at.
 *
 * A month of the stipend, which is the figure the economy already pays and
 * mostly takes straight back: somebody below it has not put anything by, which
 * is the fact this reason is about.
 */
export const NOTHING_PUT_BY = 4;

/**
 * Why this person would leave. Empty for somebody with no reason to.
 *
 * Order is stable so the first entry is the one a report leads with, and the
 * teaching ceiling is first because it is the one that never resolves itself:
 * a house that cannot teach you further will not start.
 */
export function whyTheyWouldLeave(
    them: WhatStayingIsCostingThem
): readonly WhyTheyWentOut[] {
    const why: WhyTheyWentOut[] = [];
    if (them.houseTeachingCeiling !== null && them.houseTeachingCeiling <= them.ordinal) {
        why.push('the house cannot teach them further');
    }
    // Second, because it is the other one that does not resolve itself: a hall
    // full of people who will not die for six centuries does not empty.
    if ((them.beingHeldBack ?? 0) > 0) why.push('the house has no room for them to rise');
    if (them.aRoadAProvinceAway) why.push('a road a province away');
    if (!them.theHousePaidThem) why.push('the house did not pay them');
    if (them.peopleTheyKnewWhoDidNotComeBack > 0) {
        why.push('somebody they knew did not come back');
    }
    // The bottom of the ladder AND nothing put by. Either alone is ordinary.
    if (them.factionRankIndex <= 0 && them.spiritStones < NOTHING_PUT_BY) {
        why.push('nothing in the hall is theirs');
    }
    return why;
}

/**
 * How likely one reason is to move somebody in one year.
 *
 * Deliberately small, and it multiplies. Somebody with one grievance mostly
 * stays; somebody with four is on the road inside a working lifetime, which is
 * the shape the reasons are for. There is no threshold anywhere - the
 * difference between staying and going is how much is wrong.
 */
export const WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR = 0.012;

/**
 * How many reasons' worth of grievance this is.
 *
 * One apiece, except being held back, which weighs what
 * `howHardBeingHeldBackPresses` says - nothing in the first year it is true and
 * up to four grievances after long enough - because how long somebody has been
 * passed over is the whole of how much it costs them.
 */
export function howMuchTheirReasonsWeigh(
    reasons: readonly WhyTheyWentOut[],
    beingHeldBack = 0
): number {
    const others = reasons.filter(r => r !== 'the house has no room for them to rise').length;
    return others + (reasons.includes('the house has no room for them to rise') ? beingHeldBack : 0);
}

/** Whether they go this year. Seeded on the person and the year by the caller. */
export function whetherTheyGoThisYear(
    reasons: readonly WhyTheyWentOut[],
    rng: CultivationRNG,
    /** `howMuchTheirReasonsWeigh`. One per reason where the caller has nothing better. */
    weight: number = reasons.length
): boolean {
    if (reasons.length === 0) return false;
    return rng.chance(Math.min(1, weight * WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR));
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE THEY GO
// ─────────────────────────────────────────────────────────────────────────

/**
 * A place somebody would set out for, and what it asks of them.
 *
 * `why` is a sentence, because the requirement on this whole feature is that
 * of anybody out in the world you can say what they went for.
 */
export interface SomewhereWorthGoing {
    locationId: string;
    name: string;
    why: string;
    /**
     * The rung the ground asks of anybody standing on it. Below it, they do not
     * come back from the trip - which is the same `thresholds.survival` every
     * other reader of a place uses and not a second notion of danger.
     */
    survivalOrdinal: number;
}

/**
 * Where this person would set out for, or null where there is nowhere.
 *
 * A ROAD BEFORE A RUIN, and both before nothing. The road is the destination
 * whose reward the engine already computes - stand there and `roadsInReachOf`
 * answers differently at the next review - and a ruin is a chance at one. A
 * person with neither has nowhere worth walking to and stays, which is why
 * most people stay.
 */
export function whereTheyWouldGo(
    roads: readonly SomewhereWorthGoing[],
    ruins: readonly SomewhereWorthGoing[]
): SomewhereWorthGoing | null {
    return roads[0] ?? ruins[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHO GOES WITH THEM
// ─────────────────────────────────────────────────────────────────────────

/** How many can leave together before it stops being a few people. */
export const A_FEW_PEOPLE = 3;

export interface SomebodyElseLeaving {
    id: string;
    /** They set out for the same place. */
    goingTheSameWay: boolean;
    /** They already knew each other, or walked off the same roll. */
    knownToThem: boolean;
}

/**
 * The two ways a few people end up on one road.
 *
 * NOT A PARTY BEING RAISED. Each of these had their own reason and each could
 * have gone alone. There is no leader, no roster and no standing order: this is
 * a list of who is walking the same way, and the caller writes it onto each of
 * their own activities, which is the only place a party lives.
 */
export interface WhoElseIsWalkingThisWay {
    /** Left together, because they already knew each other. */
    setOutTogether: readonly string[];
    /**
     * Fell in on the road, because they were going the same way and nothing
     * else. Two people out of two different halls for two different reasons,
     * which is the version of this the genre is actually about.
     */
    fellInOnTheRoad: readonly string[];
}

/**
 * Who is on this road too.
 *
 * Known first, because somebody you already trust is who you set out with, and
 * a stranger going the same way is somebody you end up with.
 */
export function whoWouldGoWithThem(
    others: readonly SomebodyElseLeaving[]
): WhoElseIsWalkingThisWay {
    const together: string[] = [];
    const road: string[] = [];
    for (const other of others) {
        if (!other.goingTheSameWay) continue;
        if (together.length + road.length >= A_FEW_PEOPLE - 1) break;
        if (other.knownToThem) together.push(other.id); else road.push(other.id);
    }
    return { setOutTogether: together, fellInOnTheRoad: road };
}
