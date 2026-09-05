/**
 * An account held against nobody, and what it makes its holder want.
 */

import type { DayIndex } from './common.js';
import type { ObligationInput, ObligationRecord } from './grudges.js';

/**
 * The subject of an account nobody can put a name to. Exported rather than
 * written out at each site so a change of storage is one edit, and so a reader
 * who meets a null subject has a name to search for.
 */
export const NO_NAME_ON_IT = null;

/** Whether this account is against somebody, or against whoever it was. */
export function hasANameOnIt(record: { subjectId: string | null }): boolean {
    return record.subjectId !== NO_NAME_ON_IT;
}

/** The tag every unnamed account carries, so the ledger is queryable for them. */
export const NO_NAME_TAG = 'no-name-on-it';

/** The tag a row gets on the day a name finally attaches to it. */
export const NAME_ATTACHED_TAG = 'name-attached';

/**
 * What the engine knows about how the wrong was done, for this one question.
 * All three are facts the deed layer or the caller already holds, and none of
 * them is what the wrong was called.
 */
export interface HowItWasDone {
    /**
     * A word was given first. `Deed.promised`. This is the field that makes a
     * betrayal name its own subject without anybody writing "betrayal" down.
     */
    promised?: boolean;
    /** The two already had dealings. The relationship layer's answer. */
    priorTie?: boolean;
    /**
     * Somebody who would tell them saw it. Not the same as a witness existing:
     * one who will never speak to this person leaves the account as unnamed as
     * no witness at all.
     */
    seenBySomebodyWhoWouldSay?: boolean;
}

/**
 * True when the wronged party has the name by the nature of the act. Where it
 * is, state 2 does not exist for them: there was never a moment where the deed
 * was legible and its author was not.
 */
export function theWrongedPartyAlreadyHasTheName(how: HowItWasDone): boolean {
    return Boolean(how.promised || how.priorTie || how.seenBySomebodyWhoWouldSay);
}

/**
 * Turn an account somebody would hold into one they hold against nobody.
 */
export function withNoNameOnIt(row: ObligationInput): ObligationInput {
    return {
        ...row,
        subjectId: NO_NAME_ON_IT,
        tags: [...(row.tags ?? []), NO_NAME_TAG]
    };
}

export interface ANameArrives {
    /** The row to write back, at the same id, with the name on it. */
    row: ObligationInput;
    /** The name it attached to, as they were told it. Never checked. */
    againstAsTold: string;
    note: string;
}

/**
 * Put a name on an account that had none.
 */
export function aNameAttaches(
    held: ObligationRecord,
    input: { subjectId: string; onDay: DayIndex; fromHolderId?: string | null }
): ANameArrives {
    return {
        row: {
            id: held.id,
            kind: held.kind,
            holderId: held.holderId,
            subjectId: input.subjectId,
            cause: held.cause,
            severity: held.severity,
            onDay: held.incurredOnDay,
            triggeringEventId: held.triggeringEventId,
            description:
                `${held.description} A name was put to it on day ${input.onDay}`
                + (input.fromHolderId ? ` by ${input.fromHolderId}.` : '.'),
            participants: [
                ...held.participants,
                ...(input.fromHolderId ? [input.fromHolderId] : [])
            ],
            tags: [
                ...held.tags.filter(t => t !== NO_NAME_TAG),
                `${NAME_ATTACHED_TAG}:${input.onDay}`,
                ...(input.fromHolderId ? [`told-by:${input.fromHolderId}`] : [])
            ],
            terms: held.terms,
            dueOnDay: held.dueOnDay,
            // It rested on nothing but the fact of the loss; now it rests on
            // what somebody said. Either way it is not something they saw.
            fromBelief: true
        },
        againstAsTold: input.subjectId,
        note:
            `The account they have carried since day ${held.incurredOnDay} now has a name on `
            + `it, as of day ${input.onDay}. It is the same account, at the same weight, and `
            + 'the name is the one they were given.'
    };
}

/**
 * One thing they now want, in the world's own vocabulary for wanting things.
 */
export interface TheSearchItOpens {
    kind: 'revenge';
    text: string;
    priority: number;
    progress: string;
    obstacles: string[];
    targetId: null;
    note: string;
}

/**
 * How hard somebody looks, by what it was worth. The one read of severity in
 * this file, and it decides priority rather than any outcome.
 */
const PRIORITY_AT: Readonly<Record<string, number>> = Object.freeze({
    slight: 0.2,
    serious: 0.45,
    grave: 0.75,
    unforgivable: 0.95
});

/**
 * What an account with no name on it makes its holder want. Null where the account
 * already has a name.
 */
export function theSearchItOpens(
    record: ObligationRecord,
    what: { lost: string }
): TheSearchItOpens | null {
    if (hasANameOnIt(record)) return null;
    return {
        kind: 'revenge',
        text: `Find out who is behind ${what.lost}.`,
        priority: PRIORITY_AT[record.severity] ?? 0.5,
        progress: 'Knows it was done. Has no name for it.',
        obstacles: ['Nobody has put a name to it.'],
        targetId: null,
        note:
            `Opened off an account carried since day ${record.incurredOnDay} with no subject `
            + 'on it.'
    };
}
