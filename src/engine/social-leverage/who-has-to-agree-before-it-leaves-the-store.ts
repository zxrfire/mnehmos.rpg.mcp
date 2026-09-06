/**
 * WHO HAS TO AGREE BEFORE IT LEAVES THE STORE.
 *
 * The design owner: *"the difference between borrowing a counted vs tracked
 * object is WHO CAN APPROVE IT."* And on each end of that:
 *
 *   *"A new outer disciple needs to borrow an iron sword, so it asks the armory
 *   elder and then just takes it. The armory elder is just a rubber stamp,
 *   typically - he wouldn't stop you, he's permissive by default. (Unless you
 *   wanted to borrow a sword to melt it down or sell it, he'd say no, duh.)"*
 *
 *   *"But the stuff in the treasury, the elders and patriarch have to agree.
 *   That falls into sect authority. Remember we talked about even elders can
 *   refuse a patriarch asking for something from the treasury? The rare
 *   immortal medicines? IT ALL FALLS OUT. This gives offices a reason to
 *   exist."*
 *
 * ── AND IT DOES ALL FALL OUT, WITH ONE FUNCTION ADDED ────────────────────
 *
 * Every piece of this already existed and none of them had been introduced to
 * each other:
 *
 *   `keptAs`               counted or tracked, off the grade. The whole split.
 *   `whereInTheHouseItSits` which room a thing is in, off that same split.
 *   `whoIsInChargeOfWhat`  deals the SEALED rooms out to the deciders, which is
 *                          what an office IS here - there is no title table,
 *                          the armoury elder is whoever holds that room.
 *   `whoseCallItIs`        narrows a room's question to the holder plus the
 *                          head. Written, tested, and with no production caller
 *                          until this file.
 *   `whatTheBodyWants`     the whole house, and it can already return `'the
 *                          elders, unanimous against the head'` - which is the
 *                          owner's *"even elders can refuse a patriarch"*,
 *                          implemented before anybody asked for it here.
 *
 * So this file adds one decision and no machinery: WHICH of those a request
 * goes to. That is the counted/tracked line, and nothing else.
 *
 * ── WHY THE ARMOURY ELDER IS A RUBBER STAMP AND IS NOT A FORMALITY ───────
 *
 * A counted thing is repayable in kind - one iron sword is as good as another -
 * so there is nothing at stake in the lending and no reason to refuse. The
 * default is yes and the office is real anyway, because of the exception the
 * owner named: *"unless you wanted to borrow a sword to melt it down or sell
 * it, he'd say no, duh."*
 *
 * That is not a special case either. What makes it a refusal is that MELTING IT
 * DOWN IS NOT BORROWING. A loan is a thing that comes back, and an intent that
 * ends the object is a request to be given it - which is a different question,
 * asked of different people, and gets routed as one. Hence `WhatTheyMeanToDo`.
 */

import type { RoomPurpose } from '../world/architecture.js';
import { keptAs, type ObjectSignificance } from '../world/possessions.js';
import {
    whoseCallItIs,
    type APortfolio,
    type WhoseCallItIs
} from './what-an-elder-is-in-charge-of.js';
import {
    whatTheBodyWants,
    type OnTheRoll,
    type WhereTheBodyLands
} from './what-a-body-wants-is-what-its-deciders-want.js';

/**
 * What the asker means to do with it, which decides what they are asking for.
 *
 * Not a motive and not a judgement. The difference between the first and the
 * other two is whether the object still exists afterwards, and that is what
 * makes one of them a loan.
 */
export type WhatTheyMeanToDo =
    /** Use it and bring it back. The only one of these that is borrowing. */
    | 'use_it_and_return_it'
    /** Consume it, melt it, spend it. The house does not get it back. */
    | 'use_it_up'
    /** Sell it, gift it on, trade it. The house does not get it back either. */
    | 'pass_it_on';

/** Whether what they described is a loan at all. */
export function isActuallyBorrowing(meaning: WhatTheyMeanToDo): boolean {
    return meaning === 'use_it_and_return_it';
}

/**
 * How high a request has to go.
 *
 * Three, and the third is the one that gives the top of a house something to
 * disagree about.
 */
export type HowHighItGoes =
    /** The office holder alone, and they say yes unless there is a reason. */
    | 'the_officer_of_that_room'
    /** The office holder, and the head can take it back off them. */
    | 'that_officer_and_the_head'
    /** The whole body, where the elders can stand against the head. */
    | 'the_elders_and_the_head';

/**
 * How high this request goes, off two facts already on the row and one about
 * the asker's intent.
 *
 * COUNTED AND BORROWING is the rubber stamp: one iron sword is as good as
 * another and it is coming back.
 *
 * COUNTED AND NOT BORROWING goes a rung up, because it is not a loan. Wanting
 * to melt down a house sword is a small request and it is a request to be GIVEN
 * something, and the officer is not the last word on giving house property
 * away.
 *
 * TRACKED goes to the body whatever the intent, because there is one of it.
 * Even returning it intact is a question about the only one the house has.
 */
export function howHighThisGoes(input: {
    significance: ObjectSignificance;
    meaning: WhatTheyMeanToDo;
}): HowHighItGoes {
    if (keptAs(input.significance) === 'tracked') return 'the_elders_and_the_head';
    return isActuallyBorrowing(input.meaning)
        ? 'the_officer_of_that_room'
        : 'that_officer_and_the_head';
}

export interface WhetherItLeavesTheStore {
    /** How high it had to go. */
    height: HowHighItGoes;
    /** The room it came out of, and therefore whose office it was. */
    room: RoomPurpose | null;
    /** Who answered first, or null where nobody holds that room. */
    officerId: string | null;
    /** Where the house landed, or null where nobody had to be asked. */
    answer: WhereTheBodyLands | null;
    /** Whether it goes. */
    allowed: boolean;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Whether it leaves the store, and who said so.
 *
 * The engine decides and does not grade. A refusal here names what stopped it -
 * an officer, a head, or a room of elders - because those are three different
 * things to do something about.
 */
export function whetherItLeavesTheStore(input: {
    significance: ObjectSignificance;
    meaning: WhatTheyMeanToDo;
    /** The room it sits in, from `whereInTheHouseItSits`. */
    room: RoomPurpose | null;
    portfolios: readonly APortfolio[];
    roll: readonly OnTheRoll[];
    rankCount: number;
    askerId?: string | null;
    ledger?: Parameters<typeof whatTheBodyWants>[0]['ledger'];
    asOfDay?: number;
    /**
     * How each decider reads on THIS question.
     *
     * Forwarded and never interpreted. A caller with a reason the room would
     * answer differently - a house half burned down being asked for its swords
     * - supplies it here rather than growing a second approval path beside this
     * one. Defaults to the one leaning the world writes for everybody.
     */
    readingOf?: (personId: string) => number;
}): WhetherItLeavesTheStore {
    const height = howHighThisGoes(input);
    const shared = {
        ...(input.askerId === undefined ? {} : { asking: input.askerId }),
        ...(input.ledger === undefined ? {} : { ledger: input.ledger }),
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay }),
        ...(input.readingOf === undefined ? {} : { readingOf: input.readingOf })
    };

    // ── THE WHOLE BODY ───────────────────────────────────────────────────
    //
    // One of it, so everybody who could be asked is asked. This is the path
    // where `'the elders, unanimous against the head'` can come back, which is
    // the owner's rare immortal medicine: a patriarch asking for the only dose
    // in the house, and a room that will not hand it over.
    if (height === 'the_elders_and_the_head') {
        const answer = whatTheBodyWants({
            roll: input.roll,
            rankCount: input.rankCount,
            ...shared
        });
        return {
            height,
            room: input.room,
            officerId: null,
            answer,
            allowed: (answer.leaning ?? 0) > 0,
            line: `tracked: the body settled it ${answer.settledBy}, leaning `
                + `${answer.leaning === null ? 'nowhere' : answer.leaning.toFixed(2)}.`
        };
    }

    // ── AND THE OFFICE ───────────────────────────────────────────────────
    const call: WhoseCallItIs | null = input.room === null
        ? null
        : whoseCallItIs({
            purpose: input.room,
            portfolios: input.portfolios,
            roll: input.roll,
            rankCount: input.rankCount,
            ...shared
        });

    // A room nobody holds, in a house with nobody to ask. Nothing stops it, and
    // saying otherwise would invent an officer the house does not have.
    if (call === null || call.holderId === null) {
        return {
            height,
            room: input.room,
            officerId: null,
            answer: call?.answer ?? null,
            allowed: true,
            line: `counted: nobody holds ${input.room ?? 'that store'}, so nobody had to be asked.`
        };
    }

    // ── PERMISSIVE BY DEFAULT, AND ONLY ON THE LOAN ──────────────────────
    //
    // *"He wouldn't stop you, he's permissive by default."* A counted thing
    // coming back is a yes unless the officer positively does not want to -
    // which `whatTheBodyWants` already measures, and which is a real state:
    // somebody who holds a grudge against this asker is not a rubber stamp for
    // this asker. So the floor is a yes and the reading can still take it away.
    if (height === 'the_officer_of_that_room') {
        const grudging = (call.answer.leaning ?? 0) <= -A_REASON_TO_SAY_NO;
        return {
            height,
            room: input.room,
            officerId: call.holderId,
            answer: call.answer,
            allowed: !grudging,
            line: grudging
                ? `counted, borrowed: the officer of ${input.room} refused, at `
                  + `${(call.answer.leaning ?? 0).toFixed(2)}.`
                : `counted, borrowed: the officer of ${input.room} stamped it.`
        };
    }

    // Not a loan. The head is in the room now, and the default is not a yes.
    return {
        height,
        room: input.room,
        officerId: call.holderId,
        answer: call.answer,
        allowed: (call.answer.leaning ?? 0) > 0,
        line: `counted, not returning: ${input.room} plus the head, settled `
            + `${call.answer.settledBy}, leaning `
            + `${call.answer.leaning === null ? 'nowhere' : call.answer.leaning.toFixed(2)}.`
    };
}

/**
 * How far against an asker an officer has to be before a routine loan is
 * refused.
 *
 * Deliberately most of the way to the end of the axis. A rubber stamp that
 * stops stamping whenever the holder is mildly unenthusiastic is not a rubber
 * stamp, and the design owner was explicit that this is the default-yes case.
 * What gets through this is somebody with a real reason.
 */
export const A_REASON_TO_SAY_NO = 0.6;
