/**
 * Somebody with standing speaks for the accused, and what that costs them.
 *
 * `whatTheRoomDecides` has moved a sentence one rung down for an intercession
 * since it was written, and nothing in `src/` ever built one - so the branch was
 * reachable by construction and nobody had ever pleaded for anybody. This is the
 * road to it, and it adds no currency: the offer ladder in
 * `what-they-will-take-instead-of-money.ts` prices what a word costs, exactly as
 * it prices a rung, a piece of a beast and a posting.
 *
 * ── WHY IT IS PRICED AT `against_their_interest` ─────────────────────────
 *
 * The same reading `advancement` gets, for the same reason. A rung is off the
 * house's own ladder and a sentence is the house's own decision; asking for
 * either to be moved asks somebody to spend the body's interest on one person.
 * `PURSE_REACH` at that weight is where `whatTheyWillTakeFor` stops taking money,
 * which settles the mechanic without a rule being written for it: a purse put in
 * front of an elder does not buy leniency, and the refusal has a rung of the
 * ladder to name instead of a blank look.
 *
 * ── AND IT MOVES ONE RUNG, WHICH IS NOT THIS FILE'S TO DECIDE ────────────
 *
 * `whatTheRoomDecides` moves it, and by one, and only where the offer is the
 * right KIND of thing. Nothing here knows what a sentence is.
 */

import type { AskWeight } from './an-attempt-to-move-somebody.js';
import type { AnIntercession } from './what-a-room-decides-about-one-of-its-own.js';
import type { WhoseCallItIs } from './what-an-elder-is-in-charge-of.js';
import {
    whatTheyWillTakeFor,
    type WhatTheyWillTake
} from './what-they-will-take-instead-of-money.js';

/** What asking for a sentence to be lightened costs the person asked. */
export const WHAT_A_WORD_FOR_SOMEBODY_COSTS: AskWeight = 'against_their_interest';

/**
 * Which rung of the offer ladder this person is on for a word.
 *
 * The backward read: given the person, what would reach them. The forward one -
 * given an offer, did it land - is `whereTheOfferLanded`, and both are used
 * here so an engine that says what would have worked cannot disagree with the
 * engine that decided whether it did.
 */
export function whatSpeakingForSomebodyWouldTake(holderId: string): WhatTheyWillTake {
    return whatTheyWillTakeFor(holderId, {
        ask: WHAT_A_WORD_FOR_SOMEBODY_COSTS,
        hasACashPrice: false,
        theyNeedSomethingDone: false
    });
}

export type WhyTheWordIsNotTheirsToSay =
    /** The accused. Pleading for yourself is a defence and not an intercession. */
    | 'the accused cannot speak for themselves'
    /** Their word IS the sentence, so there is nothing to ask them for. */
    | 'the room is already theirs';

/**
 * Whether this person's word is an intercession at all.
 *
 * Two people it is not. The accused, because `complaintsBrought` already refuses
 * somebody their own case at the deciding end and a plea from the dock is the
 * same claim at the other; and whoever holds the room, whose word is the
 * sentence rather than a request to move it.
 */
export function whyTheWordIsNotTheirsToSay(input: {
    speakerId: string;
    accusedId: string;
    room: WhoseCallItIs | null;
}): WhyTheWordIsNotTheirsToSay | null {
    if (input.speakerId === input.accusedId) return 'the accused cannot speak for themselves';
    if (input.room?.holderId === input.speakerId) return 'the room is already theirs';
    return null;
}

/**
 * The word, put together.
 *
 * Pure, and the only thing it decides is what the person holding the room would
 * take. What was PUT UP is the caller's, in the ladder's own vocabulary, the way
 * `asking-something-that-can-refuse-for-a-piece-of-it.ts` reads an offer.
 */
export function anIntercessionFor(
    room: WhoseCallItIs | null,
    offered: WhatTheyWillTake
): AnIntercession {
    const holderId = room?.holderId ?? null;
    return {
        room,
        offered,
        // With nobody holding the room nothing is being asked of anybody, and
        // what would have been wanted is not a fact about a person. The room
        // answers 'nobody to speak to' before this is read.
        wants: holderId === null ? offered : whatSpeakingForSomebodyWouldTake(holderId)
    };
}
