/**
 * The room settles a complaint, and the sentence happens to somebody.
 *
 * `complaintsBroughtTo` reads what a house holds about its own and
 * `settleAComplaint` marks one upheld or dismissed, and nothing followed from
 * upholding it: the row closed and the person it was about paid nothing. This is
 * the half that costs them something.
 *
 * `whatTheRoomDecides` does the deciding and this file does not repeat a word of
 * it. What is here is the two ordinary outcomes carried out end to end - the
 * rebuke and the fine - and the honest report of where the other five land,
 * which comes off `WHO_CARRIES_IT_OUT` rather than being restated.
 *
 * ── A fine is the work it would take to make it good ─────────────────────
 *
 * Priced off `duties.ts` and not invented here: `CONTRIBUTION_BASE +
 * ordinal * CONTRIBUTION_PER_ORDINAL` is what this house pays for one errand at
 * this person's rung, and the fine is that many errands, one per band of
 * severity. So a fine at the bottom of the ladder and a fine at the top are the
 * same number of mornings, which is what makes it read as a sanction rather than
 * as a number that stops mattering at Core Formation.
 *
 * Stones move at the rate the same module already converts at. Both fall to what
 * the person actually has - `addContribution` floors at zero and `applyDeltas`
 * floors stones at zero - so a fine larger than somebody's whole standing takes
 * everything and does not go negative, and what was not paid is reported rather
 * than carried as a debt the ledger has no row for.
 */

import {
    CONTRIBUTION_BASE,
    CONTRIBUTION_PER_ORDINAL,
    STONES_PER_ERRAND_OF_CONTRIBUTION
} from '../engine/encounters/duties.js';
import {
    createObligation,
    settleObligation,
    severityRank,
    type ObligationRecord,
    type Severity
} from '../engine/social/grudges.js';
import {
    whatTheRoomDecides,
    type TheSentence,
    type WhatWasBrought
} from '../engine/social-leverage/what-a-room-decides-about-one-of-its-own.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { AGAINST_THEIR_OWN } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { settleAComplaint } from './false-decree-reports.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { type DatabaseHandle } from './encounters.js';

/** The tag on the row a rebuke leaves, so a later read can tell one from a complaint. */
export const A_REBUKE_ON_THE_RECORD = 'a_rebuke_on_the_record';
/** The tag on the row a fine leaves. The row is the receipt, not the punishment. */
export const A_FINE_WAS_PAID = 'a_fine_was_paid';

export interface WhatWasHandedDown {
    decided: TheSentence;
    /** The complaint, settled. Null where the room decided there was no case. */
    settled: ObligationRecord | null;
    /** The row the sentence itself left, where it leaves one. */
    wrote: ObligationRecord | null;
    /** Contribution actually taken. Zero where the sentence was not a fine. */
    contributionTaken: number;
    /** Stones actually taken. Zero where the sentence was not a fine. */
    stonesTaken: number;
    /**
     * Set where the sentence is one this file does not carry out, naming the
     * module that would. Never a silent success.
     */
    notCarriedOutHere: string | null;
    line: string;
}

export interface HandDownInput {
    repos: CultivationRepos;
    /** The complaint, from `complaintsBroughtTo`. */
    complaint: ObligationRecord;
    /** Who is settling it - the holder of the room, or the head. */
    byId: string;
    offenderId: string;
    offenderName: string;
    offenderOrdinal: number;
    houseId: string;
    houseName: string;
    onDay: number;
    /** Everything the room reads, minus the severity, which comes off the row. */
    brought: Omit<WhatWasBrought, 'severity'>;
}

/**
 * What a fine comes to, at this rung and this band.
 *
 * Exported so a refusal can say the figure before it is taken: a player told
 * what a fine would be and then fined is being told twice by one function, and
 * two functions is how the two answers start to differ.
 */
export function whatAFineComesTo(ordinal: number, severity: Severity): { contribution: number; stones: number } {
    const perErrand = CONTRIBUTION_BASE + Math.max(0, ordinal) * CONTRIBUTION_PER_ORDINAL;
    const errands = severityRank(severity) + 1;
    return {
        contribution: Math.max(1, Math.round(perErrand * errands)),
        stones: Math.max(1, Math.round(perErrand * STONES_PER_ERRAND_OF_CONTRIBUTION * errands))
    };
}

/**
 * Weigh it, settle the complaint, and do what was decided.
 *
 * The complaint is settled in both directions: upheld where a sentence followed,
 * `proven_false` where the room found no case. A complaint left open after the
 * room has read it is the officeless-elder problem again - standing with nothing
 * attached - and it is the state this whole arc exists to leave behind.
 */
export function handDownWhatTheRoomDecided(input: HandDownInput): WhatWasHandedDown {
    const decided = whatTheRoomDecides({ ...input.brought, severity: input.complaint.severity });
    const db = input.repos.db as unknown as DatabaseHandle;

    if (decided.sentence === 'no case') {
        const settled = settleAComplaint(input.repos, input.complaint, {
            verdict: 'dismissed',
            byId: input.byId,
            onDay: input.onDay,
            note: decided.line
        });
        return {
            decided, settled, wrote: null,
            contributionTaken: 0, stonesTaken: 0, notCarriedOutHere: null,
            line: decided.line
        };
    }

    const settled = settleAComplaint(input.repos, input.complaint, {
        verdict: 'upheld',
        byId: input.byId,
        onDay: input.onDay,
        note: decided.line
    });

    // ── A REBUKE IS A ROW AND NOTHING ELSE ───────────────────────────────
    //
    // Which is not nothing: it is held by the house about the person, it is
    // open, and everything that reads what a house holds about its own will
    // find it - `whatTheyFeelAboutYou`, the next complaint's
    // `whatStandsBetween`, and any room that later asks what this person has
    // already been brought up for.
    if (decided.sentence === 'a rebuke') {
        const wrote = createObligation({
            kind: 'grudge',
            holderId: input.houseId,
            subjectId: input.offenderId,
            cause: input.complaint.cause,
            severity: input.complaint.severity,
            onDay: input.onDay,
            description:
                `${input.houseName} rebuked ${input.offenderName} for it and took nothing else. `
                + 'The record is the sanction.',
            participants: [input.houseId, input.byId],
            tags: [AGAINST_THEIR_OWN, A_REBUKE_ON_THE_RECORD],
            triggeringEventId: input.complaint.triggeringEventId ?? null
        });
        writeOneObligation(db, wrote);
        return {
            decided, settled, wrote,
            contributionTaken: 0, stonesTaken: 0, notCarriedOutHere: null,
            line: `${decided.line} ${input.offenderName} is rebuked, and it is on the record.`
        };
    }

    // ── A FINE MOVES WHAT THE HOUSE PAYS WORK IN ─────────────────────────
    if (decided.sentence === 'a fine') {
        const asked = whatAFineComesTo(input.offenderOrdinal, input.complaint.severity);

        const before = input.repos.sects.getMembership(input.offenderId);
        const had = before?.contribution ?? 0;
        input.repos.sects.addContribution(input.houseId, input.offenderId, -asked.contribution);
        const after = input.repos.sects.getMembership(input.offenderId);
        const contributionTaken = Math.max(0, had - (after?.contribution ?? 0));

        const hadStones = input.repos.cultivators.getById(input.offenderId)?.spiritStones ?? 0;
        input.repos.cultivators.applyDeltas(input.offenderId, { spiritStones: -asked.stones });
        const stonesLeft = input.repos.cultivators.getById(input.offenderId)?.spiritStones ?? 0;
        const stonesTaken = Math.max(0, hadStones - stonesLeft);

        const short = (asked.contribution - contributionTaken) + (asked.stones - stonesTaken);
        const receipt = createObligation({
            kind: 'debt',
            // The person owes it, so they hold it and the house is the subject -
            // `whichWayItPoints` reads a debt that way and this is not the place
            // to disagree with it.
            holderId: input.offenderId,
            subjectId: input.houseId,
            cause: 'other',
            severity: input.complaint.severity,
            onDay: input.onDay,
            description:
                `${input.houseName} fined ${input.offenderName} `
                + `${asked.contribution} contribution and ${asked.stones} stones. `
                + (short > 0
                    ? `They had ${contributionTaken} and ${stonesTaken} of it.`
                    : 'Paid in full.'),
            participants: [input.houseId, input.byId],
            tags: [AGAINST_THEIR_OWN, A_FINE_WAS_PAID],
            triggeringEventId: input.complaint.triggeringEventId ?? null,
            terms: short > 0
                ? 'What was not paid is what they did not have. The house is not owed the '
                  + 'remainder: a fine takes what is there.'
                : null
        });
        // A fine paid is a receipt, not an account. Left open it would read as
        // an unpaid debt to every reader of the ledger, which is the opposite
        // of what happened.
        const wrote = short > 0 ? receipt : settleObligation(receipt, {
            resolution: 'repaid',
            onDay: input.onDay,
            byId: input.byId,
            note: 'Taken on the day it was handed down.'
        });
        writeOneObligation(db, wrote);

        return {
            decided, settled, wrote, contributionTaken, stonesTaken, notCarriedOutHere: null,
            line: `${decided.line} ${input.offenderName} pays ${contributionTaken} contribution `
                + `and ${stonesTaken} stones`
                + (short > 0 ? ', which is everything they had and less than was asked.' : '.')
        };
    }

    // ── AND THE REST ARE ROUTED, NOT PRETENDED ───────────────────────────
    //
    // The complaint is settled because the room settled it. The sentence itself
    // belongs to the module that owns the instrument, and saying so is worth
    // more than a half-built version of it here.
    return {
        decided, settled, wrote: null,
        contributionTaken: 0, stonesTaken: 0,
        notCarriedOutHere: decided.carriedOutBy,
        line: `${decided.line} It is carried out in ${decided.carriedOutBy}, which this `
            + 'handler does not reach yet.'
    };
}
