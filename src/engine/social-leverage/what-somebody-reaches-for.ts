/**
 * WHAT SOMEBODY REACHES FOR WHEN SOMETHING IS DONE TO THEM.
 *
 * The engine decides that a person answers; `moved-to-speak.ts` has said that
 * much since it was written. What it never said is WITH WHAT, so the narrator
 * was handed a person opening their mouth and nothing to put in it, and every
 * scene in the game read "They answer it out loud" and stopped.
 *
 * ── AND IT IS NOT ONE THING ──────────────────────────────────────────────
 *
 * The first cut of this hardcoded the house: somebody attacked names their sect,
 * because in this genre that is the threat. That is bespoke and it is also
 * wrong. What somebody reaches for depends on their position and the other
 * person's - they might beg for their life, swing back, offer money, or say
 * whose disciple they are - and which of those it is falls out of what they
 * actually hold.
 *
 * ── SO IT IS A READ, FROM THE OTHER SIDE ─────────────────────────────────
 *
 * `an-attempt-to-move-somebody.ts` already prices what one person can bring to
 * bear on another: a purse, a promise of harm, and what kind of person they are.
 * This asks the same question from the VICTIM'S side. Nothing new is measured
 * and no second scale is invented - `earningsPerYear` prices a purse here
 * exactly as `purseWeight` prices one there, and `HELPLESS_REALM_GAP` is the
 * combat module's own statement of when somebody cannot answer with force.
 *
 * The engine names the lever. The narrator writes the words. A person begging
 * and a person naming their house are the same function returning two answers,
 * and neither of them is a sentence this file wrote.
 */

import { HELPLESS_REALM_GAP } from '../cultivation/combat.js';
import { earningsPerYear } from '../cultivation/origin.js';
import { openHandednessOf } from './how-freely-somebody-parts-with-what-they-have.js';

/**
 * The levers somebody has. A closed set, because the point of naming them is
 * that they are countable - and an eleventh is a row here and a line beside the
 * other lines, with no code anywhere else.
 */
export type WhatTheyHave =
    /** Near enough in strength to answer in kind. */
    | 'answer_in_kind'
    /** A house whose name is worth more than their own arm. */
    | 'the_house_behind_them'
    /** Money, and a gap that money is the only thing that crosses. */
    | 'what_is_in_their_purse'
    /** Nothing that reaches, and no way out but asking. */
    | 'asking_to_be_let_go'
    /**
     * Nothing at all, and the not-reaching is the fact.
     *
     * Distinct from asking: somebody who will not ask is holding the one thing
     * that is left, and a reader must be able to tell the two apart.
     */
    | 'nothing_that_reaches';

/** One side of it, as any roster row already carries. */
export interface WhereTheyStand {
    id: string;
    ordinal: number;
    /** Their own stones. Zero for somebody a roster does not price. */
    stones?: number;
    /** The house at their back, if any, and how far up it they are. */
    houseId?: string | null;
    /** That house's weight, on the ordinal ladder. Zero where unknown. */
    houseOrdinal?: number;
}

export interface WhatTheyReachFor {
    lever: WhatTheyHave;
    /**
     * Engine truth, one clause. The narrator writes the speech, never this.
     *
     * KEPT TO THE FACT, and it was not. These read "They are near enough in
     * strength to answer it themselves, AND THAT IS WHAT THEY REACH FOR" -
     * which says the same thing twice, once in the sentence and once in
     * `lever` beside it, and spends a subordinate clause explaining a
     * threshold the narrator did not ask about. What the narrator needs is
     * which lever; what it does with it is its own.
     */
    line: string;
}

/**
 * How much better off a purse has to leave somebody before money is the answer.
 *
 * Two years of what they earn. Below that it is not an offer, it is a gesture,
 * and somebody who is frightened does not buy their way out with a gesture.
 */
export const WHAT_MAKES_A_PURSE_AN_ANSWER = 2;

/**
 * How much heavier the house at their back has to be than the person in front
 * of them before naming it is worth anything.
 *
 * Naming a house weaker than the person you are naming it to is worse than
 * silence: it tells them exactly how little is coming.
 */
export const A_HOUSE_WORTH_NAMING = 4;

/**
 * What this person reaches for, against the person in front of them.
 *
 * Ordered by what actually works rather than by what somebody would prefer:
 * force first where force is available, because somebody who can fight does,
 * and asking last because it is what is left.
 */
export function whatTheyReachFor(input: {
    them: WhereTheyStand;
    /** The person it is being done to them by. */
    theOther: WhereTheyStand;
}): WhatTheyReachFor {
    const gap = input.theOther.ordinal - input.them.ordinal;

    // CLOSE ENOUGH TO ANSWER. `HELPLESS_REALM_GAP` is the combat module's own
    // line for when somebody cannot, and this is the other side of it.
    if (gap < HELPLESS_REALM_GAP) {
        return {
            lever: 'answer_in_kind',
            line: 'They can answer this themselves.'
        };
    }

    // THE HOUSE, where the house is heavier than the person in front of them.
    const houseOrdinal = input.them.houseOrdinal ?? 0;
    if (input.them.houseId && houseOrdinal - input.theOther.ordinal >= A_HOUSE_WORTH_NAMING) {
        return {
            lever: 'the_house_behind_them',
            line: 'They name the house behind them.'
        };
    }

    // MONEY, where there is enough of it to be worth more than a gesture.
    const stones = Math.max(0, Math.trunc(input.them.stones ?? 0));
    const theirYear = earningsPerYear(Math.max(0, input.them.ordinal));
    if (theirYear > 0 && stones / theirYear >= WHAT_MAKES_A_PURSE_AN_ANSWER) {
        return {
            lever: 'what_is_in_their_purse',
            line: 'They offer what they are carrying.'
        };
    }

    // AND WHAT IS LEFT. Whether they will ask at all is the one thing here that
    // is about the person rather than the arithmetic, and it is read off the
    // same leaning everything else about them is.
    return openHandednessOf(input.them.id) >= 0
        ? {
            lever: 'asking_to_be_let_go',
            line: 'Nothing they hold reaches. They ask.'
        }
        : {
            lever: 'nothing_that_reaches',
            line: 'Nothing they hold reaches. They do not ask.'
        };
}
