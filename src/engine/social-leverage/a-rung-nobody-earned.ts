/**
 * A rung given by the person whose call it is, to somebody who has not earned it.
 *
 * Cash used to buy a rung directly: `donate` converted spirit stones into
 * contribution and contribution is the whole of what `handlePromote` gates on.
 * That is struck. What is open instead is the road the genre actually runs on -
 * you move the PERSON, and the person moves the rung.
 *
 * ── NOTHING HERE IS NEW ──────────────────────────────────────────────────
 *
 * Every part of this already existed and was reaching nobody:
 *
 *   who decides          `whoseCallItIs` over `whoIsInChargeOfWhat`, which
 *                        deals the house's office rooms to its deciders
 *   what it costs them   `whatYourOwnHouseOpensAboutYou`, the row a house
 *                        opens about its own, and the punishment hall that
 *                        `whereAComplaintGoes` routes to
 *   who is passed over   the shape `who-can-put-your-name-up-for-a-posting.ts`
 *                        established: the grudge is held against the person
 *                        who CHOSE, never against the person chosen
 *   what they will take  `whatTheyWillTakeFor`, which refuses money for an
 *                        ask this heavy and names the rung that would have
 *                        worked
 *
 * This file is the three lines of glue between them and nothing else. It
 * decides no outcome: the resolver decides whether the attempt lands, and a
 * caller that does not check `taken` will raise somebody who was refused.
 *
 * ── AND THE ROOM IS THE MISSION HALL ─────────────────────────────────────
 *
 * A rung is bought with contribution and contribution is booked where work is
 * posted, so the person who can give one away is the person who holds that
 * room. It is also the only office of the six that is not a sealed room, which
 * is what makes this road reachable from the bottom of a ladder at all - the
 * other five are behind doors an outer disciple never gets through. A house
 * with no mission hall has nobody who can do this, and that is an answer
 * rather than a gap.
 */

import type { RoomPurpose } from '../world/architecture.js';
import {
    type APortfolio,
    type WhoseCallItIs,
    whoseCallItIs
} from './what-an-elder-is-in-charge-of.js';
import type { OnTheRoll } from './what-a-body-wants-is-what-its-deciders-want.js';
import {
    type IfCaught,
    whatYourOwnHouseOpensAboutYou
} from './what-a-house-does-when-it-catches-you.js';
import {
    type ObligationInput,
    type ObligationRecord,
    createGrudge
} from '../social/grudges.js';

/**
 * The room a rung is decided in. See the banner.
 */
export const THE_ROOM_A_RUNG_IS_DECIDED_IN: RoomPurpose = 'mission_hall';

/** The tag on every row a bought rung leaves, at both ends. */
export const A_RUNG_THAT_WAS_GIVEN = 'a_rung_that_was_given';

/**
 * Who in this house could raise somebody, and whether it is theirs alone.
 *
 * The forward read. `whoseCallItIs` already answers it for any room; this names
 * which room, so that the answer cannot differ between the place that offers
 * the road and the place that resolves it.
 */
export function whoCouldRaiseYou(input: {
    portfolios: readonly APortfolio[];
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    asOfDay?: number;
}): WhoseCallItIs {
    return whoseCallItIs({
        purpose: THE_ROOM_A_RUNG_IS_DECIDED_IN,
        portfolios: input.portfolios,
        roll: input.roll,
        rankCount: input.rankCount,
        ...(input.asking === undefined ? {} : { asking: input.asking }),
        ...(input.ledger === undefined ? {} : { ledger: input.ledger }),
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });
}

export interface WhatABoughtRungLeaves {
    /**
     * What the house holds about the person who gave it away.
     *
     * `null` where the house does nothing about this kind of thing at all,
     * which `ifCaughtAtSomethingTheHousePunishes` decides off alignment. An
     * input rather than a record: the caller writes it, or does not.
     */
    theGiverAnswersFor: ObligationInput | null;
    /**
     * Held by whoever was next in line for the rung, against THE PERSON WHO
     * CHOSE.
     *
     * Not against the person who got it, and this is the same ruling
     * `who-can-put-your-name-up-for-a-posting.ts` records: nobody is ever told
     * why, so there is nothing to hold against the one who went except that
     * they went. `null` where the caller knows of nobody passed over, which is
     * a fact about what the caller knows and not a claim that nobody was.
     */
    passedOver: ObligationRecord | null;
    /** Factual, for the ledger and the structure channel. Never narration. */
    line: string;
}

/**
 * The two records a rung nobody earned leaves behind.
 *
 * Returned rather than written, like `aNameGoesUp`: the engine layer has no
 * database and the caller's transaction is the only place a write belongs.
 */
export function whatABoughtRungLeaves(input: {
    houseId: string;
    houseName: string;
    /** The person whose call it was, who gave it. */
    giverId: string;
    /** The person who got the rung. */
    raisedId: string;
    raisedName: string;
    /** The rung they now hold. */
    toRankTitle: string;
    /** What the house does about its own, off its alignment. */
    doing: IfCaught;
    /** Whoever was standing on the rung it was given off, when there is one. */
    passedOverId?: string | null;
    onDay: number;
    /** Anybody who saw it, so the row is not a secret by default. */
    knownTo?: readonly string[];
}): WhatABoughtRungLeaves {
    const what =
        `${input.raisedName} was raised to ${input.toRankTitle} in ${input.houseName} by the `
        + 'person whose call it was, without the contribution the rung asks for.';

    const theGiverAnswersFor = whatYourOwnHouseOpensAboutYou({
        houseId: input.houseId,
        memberId: input.giverId,
        // The house's own ladder, sold. It is the house that was betrayed, and
        // the house is the holder of the row.
        cause: 'betrayal',
        severity: 'serious',
        onDay: input.onDay,
        description: what,
        doing: input.doing,
        ...(input.knownTo === undefined ? {} : { knownTo: input.knownTo })
    });
    if (theGiverAnswersFor) {
        theGiverAnswersFor.tags = [...(theGiverAnswersFor.tags ?? []), A_RUNG_THAT_WAS_GIVEN];
    }

    const passedOver = input.passedOverId
        ? createGrudge({
            holderId: input.passedOverId,
            subjectId: input.giverId,
            cause: 'blocked_advancement',
            severity: 'serious',
            onDay: input.onDay,
            description: what,
            participants: [input.raisedId, input.houseId],
            tags: [A_RUNG_THAT_WAS_GIVEN, `house:${input.houseId}`],
            terms: null,
            dueOnDay: null
        })
        : null;

    return {
        theGiverAnswersFor,
        passedOver,
        line:
            `${what} The house ${theGiverAnswersFor === null
                ? 'does nothing about this kind of thing and holds no record of it'
                : `holds it against ${input.giverId}`}`
            + `${passedOver === null ? '' : `, and ${input.passedOverId} holds it against them too`}.`
    };
}
