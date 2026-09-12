/**
 * A disciple paying somebody else to do the work they took off the board.
 *
 * The board belongs to the house and a rogue cannot take from it: 30 of 47 rungs
 * show somebody off the roll nothing they can be handed, and that gate is
 * deliberate and stands. What was missing is the obvious thing that gate does
 * not forbid - nothing stops a disciple, in their personal capacity, from
 * subcontracting their own errand out.
 *
 * ── WHY THE TRADE EXISTS AT ALL ─────────────────────────────────────────
 *
 * Not because anybody is being generous. A duty pays in two currencies and the
 * two people value them differently: CONTRIBUTION is standing on a roll and is
 * worth exactly nothing to somebody who is not on one, and STONES are worth the
 * same to everybody. So the disciple keeps the half only they can spend and
 * pays out of the half they can. That asymmetry is the whole mechanic and it
 * was already in the ledger - `dutyTermsFor` has paid in both since it was
 * written.
 *
 * ── WHO ANSWERS FOR IT ──────────────────────────────────────────────────
 *
 * The house asked its own member, not the stranger. If the work is not done it
 * is the member who failed, on the member's `RefusalTerms`, and nothing about
 * hiring somebody moves that. This is what makes the price interesting rather
 * than a discount: the disciple is buying time and selling their own name.
 *
 * ── AND WHAT THE CONTRACTOR ASKS ────────────────────────────────────────
 *
 * Priced off the board's own figure for the same work, moved by the three
 * things that actually move it, and none of them is a table of jobs:
 *
 *   how far over their head it is   a rung of danger costs more to hire.
 *   who they are                    `openHandednessOf`, the scalar the world
 *                                   already rolls for how freely somebody parts
 *                                   with what they have.
 *   whether they have anything      somebody with nothing does not haggle
 *                                   better. They take less, which is the
 *                                   genre's own arrangement and the reason a
 *                                   rogue gets hired at all.
 *
 * What MEDIUM the contractor will take is not decided here.
 * `what-they-will-take-instead-of-money.ts` owns that ladder, and work for hire
 * sits at the mild end of it on purpose: being offered money is the good
 * outcome, and a contractor who wants something else has turned a screw.
 */

import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { contributionPerStoneOverDays } from './duties.js';

/** What a rung of danger over the contractor's own head adds to the ask. */
export const ASKED_PER_RUNG_OVER_THEIR_HEAD = 0.12;

/** The most somebody's disposition moves what they ask, either way. */
export const DISPOSITION_MOVES_THE_ASK = 0.25;

/**
 * What somebody with nothing will do the same work for.
 *
 * Not a discount they chose. `"I'll give you all my treasures. Please just
 * spare my life"` is the shape of it: having no choice does not make somebody a
 * better bargainer, it makes them offer more and ask less.
 */
export const NOTHING_IN_HAND_TAKES = 0.6;

/** Stones in hand below which somebody is taking what is offered. */
export const NOTHING_IN_HAND_UNDER = 20;

/** The duty, as this rule needs to read it. */
export interface ADutyBeingPassedOn {
    /** What the board pays its holder in stones on completion. */
    stones: number;
    /** And in contribution, which is worth nothing off the roll. */
    contribution: number;
    days: number;
    /** The rung the work is priced against: its threat, or its own pitch. */
    pitchOrdinal: number;
}

/** The person being offered the work. */
export interface WhoWouldDoItForYou {
    id: string;
    ordinal: number;
    /** What they are carrying. Somebody with nothing takes less. */
    spiritStones: number;
}

export interface WhatTheyWouldDoItFor {
    /** Stones the holder would have to hand over. */
    askStones: number;
    /** The whole of what the board pays the holder, in stones. */
    theBoardPaysTheHolder: number;
    /** What the contractor can see any value in, which is the stones alone. */
    whatTheContractorCanSpend: number;
    /** True where hiring costs the holder more stones than the board hands them. */
    outOfTheHoldersOwnPocket: boolean;
    /** True where the work is pitched above the contractor's own rung. */
    overTheirHead: boolean;
    line: string;
}

/**
 * What the whole duty is worth to somebody who can spend both halves.
 *
 * `contributionPerStoneOverDays` is the board's own exchange rate and is read
 * rather than restated, so a duty cannot be worth two different amounts
 * depending on who is doing the arithmetic.
 */
export function whatTheBoardPays(duty: ADutyBeingPassedOn): number {
    const rate = contributionPerStoneOverDays(duty.days);
    return duty.stones + (rate > 0 ? duty.contribution / rate : 0);
}

export function whatTheyWouldDoItFor(
    duty: ADutyBeingPassedOn,
    them: WhoWouldDoItForYou
): WhatTheyWouldDoItFor {
    const overTheirHead = duty.pitchOrdinal > them.ordinal;
    const rungs = duty.pitchOrdinal - them.ordinal;
    const danger = 1 + ASKED_PER_RUNG_OVER_THEIR_HEAD * rungs;
    const disposition = 1 - DISPOSITION_MOVES_THE_ASK * openHandednessOf(them.id);
    const desperate = them.spiritStones < NOTHING_IN_HAND_UNDER;

    const askStones = Math.max(1, Math.round(
        duty.stones * Math.max(0.1, danger) * disposition * (desperate ? NOTHING_IN_HAND_TAKES : 1)
    ));
    const whole = whatTheBoardPays(duty);

    return {
        askStones,
        theBoardPaysTheHolder: Math.round(whole),
        whatTheContractorCanSpend: duty.stones,
        outOfTheHoldersOwnPocket: askStones > duty.stones,
        overTheirHead,
        line: `${askStones} stones for ${duty.days} days of it. `
            + (overTheirHead
                ? `The work is pitched ${rungs} rung${rungs === 1 ? '' : 's'} over their head, `
                  + 'and they have priced that in rather than refused it. '
                : 'It is under them, and they have priced it as work rather than as a risk. ')
            + (desperate
                ? 'They are carrying almost nothing, and it shows in the figure. '
                : '')
            + 'The contribution is not part of the conversation: it goes to whoever is on the '
            + 'roll, which is you, and it is the reason this is worth doing at all.'
    };
}

/**
 * Who the house holds responsible, which is not who does the work.
 *
 * Stated as a sentence rather than as a flag because there is nothing to branch
 * on: it is always the member. Hiring somebody is not a transfer of the duty and
 * there is no version of it that is.
 */
export function whoAnswersForItAfterwards(
    holderName: string,
    houseName: string | null
): string {
    return `${houseName ?? 'The house'} asked ${holderName} and has not been told otherwise. `
        + `If it is not done, ${holderName} did not do it, on ${holderName}'s own terms for `
        + 'walking away - and whoever was hired is a stranger the house never heard of.';
}
