/**
 * What one person feels about another, read off what has passed between them.
 *
 * The design owner:
 *
 *   > emotion needs to be tracked, that's where llm's are beautiful ... for
 *   > every npc you do stuff to, of course. and emotions can change - like if i
 *   > rob her, she's sad. if i kill her father she's despondent (and acts that
 *   > way) but if i give her something good, she's conflicted like why???
 *   >
 *   > this should fall out of what's available today
 *
 * It does, and the shape it falls out of is the one beside it.
 * `personal-alignment.ts` reads the ledger for what a person IS; this reads the
 * same rows for what one person feels about ONE other. Same table, same
 * severities, same dedupe by deed. Nothing is stored: an emotion column is a
 * number that drifts from the deeds behind it, and a read cannot.
 *
 * ── THE THIRD AXIS IS THE ONE THAT MATTERS ───────────────────────────────
 *
 * Taking and giving are not opposite ends of one scale, and the design owner's
 * example is precisely why. Somebody you robbed and then gave something good to
 * has not moved back along a line towards neutral - they are holding two things
 * at once, and *why???* is the whole of it. So both directions are counted
 * separately and CONFLICTED is what it is called when both are heavy.
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────
 *
 * It does not decide what they say, or whether they say it. That is
 * `moved-to-speak.ts`, which already prices what a moment asks of somebody.
 * It does not decide how much they let show: `emotional-reticence.ts` owns
 * that, and a despondent stoic and a despondent open book feel the same thing
 * and are read differently by anybody watching. This answers one question and
 * hands the rest on.
 */

import { WHAT_A_RECORD_COUNTS_FOR } from './personal-alignment.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';

/**
 * What somebody feels, in the words a person watching them would use.
 *
 * A closed set, and short. Every one of these is something a stranger in the
 * room could name without being told why - which is the test for anything the
 * engine states as fact.
 */
export type WhatTheyFeel =
    /** Nothing has passed between them. Not warmth and not coldness. */
    | 'nothing_either_way'
    /** Something small was taken, and they have not forgotten it. */
    | 'sore'
    /** Something serious was taken. They are carrying it. */
    | 'bitter'
    /** Something they cannot be paid back for. */
    | 'despondent'
    /** Something small was given, and they noticed. */
    | 'warm'
    /** Something serious was given. They are in your debt and know it. */
    | 'grateful'
    /** Their life, or their people's. There is no word for it that is smaller. */
    | 'devoted'
    /** Heavy in BOTH directions, which is not a middle and does not average. */
    | 'conflicted';

/**
 * The point at which what has passed between two people is a fact about them
 * rather than a thing that happened once.
 *
 * The same figure `personal-alignment.ts` calls `WHAT_MAKES_IT_A_METHOD`, and
 * deliberately not a second number: one grave deed, or four serious ones.
 */
export const ENOUGH_TO_CARRY = 1;

/**
 * Above this in BOTH directions and the two do not cancel. Lower than
 * `ENOUGH_TO_CARRY` on purpose: it takes less to be confused by somebody than
 * it takes to have settled how you feel about them.
 */
export const ENOUGH_TO_MUDDY_IT = 0.25;

/** The four weights are on `WHAT_A_RECORD_COUNTS_FOR`'s scale, not a second one. */
export interface HowTheyFeel {
    feeling: WhatTheyFeel;
    taken: number;
    given: number;
    worstTaken: Severity | null;
    bestGiven: Severity | null;
    /**
     * Deliberately not part of the feeling: a grudge does not fade on a timer
     * in this world, and `personal-alignment.ts` says the same. It is here
     * because a narrator writing somebody robbed this morning and somebody
     * robbed nine years ago needs to know which.
     */
    daysSince: number | null;
    /** Engine truth, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What this person feels about that one, off the rows between them.
 *
 * `theirId` is who is doing the feeling. `aboutId` is who they feel it about -
 * usually the player, and never assumed to be.
 */
export function whatTheyFeelAboutYou(input: {
    theirId: string;
    aboutId: string;
    /** Every record the ledger holds. Filtered here, so callers need not. */
    ledger: readonly ObligationRecord[];
    /** Ignore anything after this day, and measure `daysSince` from it. */
    asOfDay?: DayIndex;
}): HowTheyFeel {
    const takenBy = new Map<string, Severity>();
    const givenBy = new Map<string, Severity>();
    let latest: DayIndex | null = null;

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;

        // THEY HOLD IT, AND IT IS ABOUT THE OTHER PERSON. Both halves matter:
        // a grudge this person is the SUBJECT of is something they did, and
        // what somebody did is not what they feel about the person they did it
        // to. That is `personal-alignment.ts`'s question and not this one.
        if (record.holderId !== input.theirId) continue;
        if (record.subjectId !== input.aboutId) continue;

        const took = record.kind === 'grudge' || record.kind === 'blood_feud';
        const gave = record.kind === 'favor';
        if (!took && !gave) continue;

        // A record and a deed are not the same thing, and two people grieving
        // one killing are one killing. The same key `personal-alignment.ts`
        // uses, for the same reason.
        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const into = took ? takenBy : givenBy;
        const standing = into.get(key);
        if (standing === undefined || heavier(record.severity, standing)) {
            into.set(key, record.severity);
        }
        if (latest === null || record.incurredOnDay > latest) latest = record.incurredOnDay;
    }

    const taken = total(takenBy);
    const given = total(givenBy);
    const worstTaken = heaviestOf(takenBy);
    const bestGiven = heaviestOf(givenBy);

    return {
        feeling: theFeeling(taken, given, worstTaken, bestGiven),
        taken,
        given,
        worstTaken,
        bestGiven,
        daysSince: latest === null || input.asOfDay === undefined
            ? null
            : Math.max(0, input.asOfDay - latest),
        line: lineFor(taken, given, worstTaken, bestGiven)
    };
}

/**
 * Which of the eight, and the order the questions are asked in is the whole of
 * it.
 *
 * CONFLICTED IS ASKED FIRST. It is not a band between bitter and grateful, it
 * is the state of holding both, and asking it after either would let one side
 * answer for a person who has not settled anything.
 */
function theFeeling(
    taken: number,
    given: number,
    worstTaken: Severity | null,
    bestGiven: Severity | null
): WhatTheyFeel {
    if (taken >= ENOUGH_TO_MUDDY_IT && given >= ENOUGH_TO_MUDDY_IT) return 'conflicted';
    if (taken === 0 && given === 0) return 'nothing_either_way';

    if (taken > given) {
        if (worstTaken === 'grave' || worstTaken === 'unforgivable') return 'despondent';
        return taken >= ENOUGH_TO_CARRY || worstTaken === 'serious' ? 'bitter' : 'sore';
    }
    if (bestGiven === 'grave' || bestGiven === 'unforgivable') return 'devoted';
    return given >= ENOUGH_TO_CARRY || bestGiven === 'serious' ? 'grateful' : 'warm';
}

function total(bands: ReadonlyMap<string, Severity>): number {
    let sum = 0;
    for (const severity of bands.values()) sum += WHAT_A_RECORD_COUNTS_FOR[severity];
    return Math.round(sum * 100) / 100;
}

function heavier(a: Severity, b: Severity): boolean {
    return WHAT_A_RECORD_COUNTS_FOR[a] > WHAT_A_RECORD_COUNTS_FOR[b];
}

function heaviestOf(bands: ReadonlyMap<string, Severity>): Severity | null {
    let worst: Severity | null = null;
    for (const severity of bands.values()) {
        if (worst === null || heavier(severity, worst)) worst = severity;
    }
    return worst;
}

function lineFor(
    taken: number,
    given: number,
    worstTaken: Severity | null,
    bestGiven: Severity | null
): string {
    const ledger = `${taken.toFixed(2)} taken out of them`
        + `${worstTaken ? ` (worst: ${worstTaken})` : ''}, `
        + `${given.toFixed(2)} given to them${bestGiven ? ` (best: ${bestGiven})` : ''}.`;

    if (taken >= ENOUGH_TO_MUDDY_IT && given >= ENOUGH_TO_MUDDY_IT) {
        return 'They are holding two things about this person at once and have not settled '
            + `which one they are. Neither cancels the other. ${ledger}`;
    }
    if (taken === 0 && given === 0) {
        return `Nothing has passed between these two in either direction. ${ledger}`;
    }
    return taken > given
        ? `What this person is to them is what was taken. ${ledger}`
        : `What this person is to them is what was given. ${ledger}`;
}

/**
 * What a person in the room would observe, in one clause.
 *
 * Observable, never interior: nobody sees despondency, they see somebody who
 * has stopped keeping up appearances. `null` where nothing has passed, because
 * a sentence about somebody feeling nothing in particular about a stranger is a
 * sentence about nothing.
 */
export function howTheyCarryIt(felt: HowTheyFeel): string | null {
    switch (felt.feeling) {
        case 'nothing_either_way':
            return null;
        case 'sore':
            return 'They have not forgotten what this one took, and it is small enough '
                + 'that they are embarrassed to be carrying it.';
        case 'bitter':
            return 'They are carrying what this one took out of them, and they are not '
                + 'carrying it quietly.';
        case 'despondent':
            return 'What this one took cannot be given back, and they have stopped '
                + 'behaving as though anything about the day matters.';
        case 'warm':
            return 'They remember a small kindness from this one and it has not worn off.';
        case 'grateful':
            return 'They are in this one\'s debt, they know the size of it, and they '
                + 'behave like somebody who has not repaid it.';
        case 'devoted':
            return 'This one gave them something there is no repaying, and everything '
                + 'they do around them is downstream of that.';
        case 'conflicted':
            return 'They are holding two things about this one at once and have settled '
                + 'neither. What is on their face is the question rather than an answer.';
    }
}
