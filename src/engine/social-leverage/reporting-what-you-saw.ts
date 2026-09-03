/**
 * What somebody does about a thing they watched you do.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner, on the servant who worked out that an Outer Disciple does
 * not speak for the house and went back to what they were doing:
 *
 *   > or rat him out to the punishment elder
 *
 * Which is what a person would actually do, and it is what turns a false decree
 * from a standing tick into an event. Forging a mandate cost 3.36 standing and
 * nothing else; the servant is the only witness, they know exactly what they
 * saw, and they have somewhere to take it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS A READING, NOT A CERTAINTY AND NOT A DIE ROLL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ruled in the same breath, and it is the whole of the gameplay:
 *
 *   > Do not make reporting automatic, and do not make it a die roll with no
 *   > inputs - it should read off what that particular person holds against you
 *   > and what you hold over them, so a player learns that WHO you tried it on
 *   > mattered more than THAT you tried it.
 *
 * So there is no RNG in this file. Every branch reads a row that already exists
 * for other reasons - the relationship the encounter layer accumulates, the
 * open obligations either way, the rival tie the world seeded - and the three
 * people the owner named fall out of them rather than being enumerated:
 *
 *   A SERVANT WHO OWES YOU may swallow it. You hold an open row over them and
 *   spending it costs them more than telling costs you.
 *   ONE WHO RESENTS YOU takes it straight up the hill. A negative standing, a
 *   rival tie, a grievance on the record - any of the three is a reason, and a
 *   tenth reason is another row rather than another branch.
 *   ONE WHO IS FRIGHTENED OF YOU says nothing and remembers. The remembering is
 *   the part that matters and it is not a mood: it is a row, held by them,
 *   about you, that somebody can read in forty years.
 *
 * ── AND FEAR IS NOT WHAT SILENCES SOMEBODY ───────────────────────────────
 *
 * Worth stating because the obvious model has it backwards. Being frightened of
 * you is a reason not to CONFRONT you, and reporting is precisely the route
 * that avoids confrontation - you take it to somebody bigger than both of you.
 * So fear does not damp this and must not: what silences a witness is owing you
 * something, or there being nowhere to take it, and those are different facts
 * with different rows behind them.
 *
 * That also keeps the rule the whole setting runs on: a large enough rung buys
 * advantage and never exemption. A player who is terrifying still gets reported
 * by somebody who dislikes them, because the person they are reported TO is
 * terrifying as well.
 */

import type { ObligationRecord } from '../social/grudges.js';
import type { APortfolio } from './what-an-elder-is-in-charge-of.js';
import { whoAnswersAbout } from './what-an-elder-is-in-charge-of.js';

/** The room a complaint about a member goes to. */
export const THE_ROOM_COMPLAINTS_GO_TO = 'punishment_hall' as const;

export type WhatTheWitnessDoes =
    /** Up the hill, to whoever holds the room complaints go to. */
    | 'reports'
    /** They owe you more than the telling is worth to them. */
    | 'swallows_it'
    /** Nothing said. A row opens anyway, held by them. */
    | 'says_nothing_and_remembers'
    /** Nobody to tell. The seat is empty, or it is the offender's own. */
    | 'nowhere_to_take_it';

export interface TheWitness {
    id: string;
    name: string;
    /**
     * The relationship as the record has it. Negative is resentment.
     *
     * `standingsFor` accumulates this per person, so the twelfth meeting knows
     * about the previous eleven. Null where they have never met.
     */
    standing: number | null;
    /** `rival` is the tie the world seeds on whoever was the other candidate. */
    role: 'peer' | 'rival' | 'master' | 'senior';
    /** What `members.ts` already says they hold against somebody. */
    grievance?: string | null;
}

export interface WhatHappensNext {
    does: WhatTheWitnessDoes;
    /** Who it goes to, where it goes anywhere. */
    toId: string | null;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Where a complaint about this person goes.
 *
 * The room, and then the exception that makes the room mean something: nobody
 * is brought a complaint about themselves. Where the offender holds the
 * punishment hall it goes over their head, and where there is neither a holder
 * nor a head above them it goes nowhere - which is a real answer and is what
 * being the most senior person in a small house buys.
 */
export function whereAComplaintGoes(input: {
    portfolios: readonly APortfolio[];
    aboutId: string;
    headId: string | null;
}): string | null {
    const holder = whoAnswersAbout(input.portfolios, THE_ROOM_COMPLAINTS_GO_TO);
    if (holder !== null && holder !== input.aboutId) return holder;
    // Their own room, or no room. The head is in every room - `whoseCallItIs`
    // keeps them there deliberately, so that a portfolio never puts its holder
    // beyond their own head.
    return input.headId !== null && input.headId !== input.aboutId ? input.headId : null;
}

/** Open rows on this pair, split by who is holding what. */
export function whatStandsBetween(
    ledger: readonly ObligationRecord[],
    witnessId: string,
    offenderId: string
): { theyOweYou: number; theyHoldAboutYou: number } {
    let theyOweYou = 0;
    let theyHoldAboutYou = 0;
    for (const row of ledger) {
        if (row.status !== 'open') continue;
        if (row.holderId === offenderId && row.subjectId === witnessId) theyOweYou++;
        if (row.holderId === witnessId && row.subjectId === offenderId) theyHoldAboutYou++;
    }
    return { theyOweYou, theyHoldAboutYou };
}

/**
 * What this particular person does about what they just watched.
 *
 * Pure, and deliberately ordered. The debt is checked before the resentment
 * because a person who owes you and dislikes you is a person who owes you -
 * that is what an obligation IS, and a model where it never binds anybody is a
 * ledger nobody has a reason to write into.
 */
export function whatTheWitnessDoesAboutIt(input: {
    witness: TheWitness;
    theyOweYou: number;
    theyHoldAboutYou: number;
    /** From {@link whereAComplaintGoes}. Null means nobody to tell. */
    toId: string | null;
    /** Rungs the offender stands above them. Carried for the LINE, not the branch. */
    rungsAbove: number;
}): WhatHappensNext {
    const { witness, toId } = input;

    if (toId === null) {
        return {
            does: 'nowhere_to_take_it',
            toId: null,
            line: `${witness.name} saw it and there is nobody in this house to tell. The room `
                + 'that would hear it is the offender\'s own, or there is no room.'
        };
    }

    if (input.theyOweYou > 0) {
        return {
            does: 'swallows_it',
            toId: null,
            line: `${witness.name} owes ${input.theyOweYou} open thing(s) and says nothing about `
                + 'this one. A debt that never binds anybody is a ledger with no reason to exist.'
        };
    }

    const resents =
        (witness.standing !== null && witness.standing < 0)
        || witness.role === 'rival'
        || (witness.grievance ?? '').length > 0
        || input.theyHoldAboutYou > 0;

    if (resents) {
        return {
            does: 'reports',
            toId,
            line: `${witness.name} takes it up the hill. Standing `
                + `${witness.standing === null ? 'unrecorded' : witness.standing.toFixed(2)}, `
                + `role ${witness.role}, ${input.theyHoldAboutYou} open row(s) held about the `
                + 'offender. Any one of those is a reason and they had more than one.'
        };
    }

    return {
        does: 'says_nothing_and_remembers',
        toId: null,
        line: `${witness.name} says nothing. `
            + (input.rungsAbove > 0
                ? `They stand ${input.rungsAbove} rung(s) below and this is not a fight they `
                  + 'were looking for. '
                : 'It is not their business and they have nothing against anybody. ')
            + 'The remembering is a row rather than a mood.'
    };
}
