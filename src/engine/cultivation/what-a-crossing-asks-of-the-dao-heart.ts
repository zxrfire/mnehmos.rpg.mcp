/**
 * 道心 - what a crossing asks about the life that arrived at it.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import { WHAT_A_RECORD_COUNTS_FOR } from '../social-leverage/personal-alignment.js';

// THE SCALE

/**
 * The weight at which a life reads as nothing but loose ends.
 */
export const A_LIFE_THAT_IS_ALL_LOOSE_ENDS = 4;

/**
 * The most an unsettled record may cost a crossing.
 */
export const MAX_DAO_HEART_STRAIN = 0.12;

// THE READ

export interface WhatTheCrossingAsks {
    /** Distinct unfinished things, after kin copies are collapsed onto the deed. */
    open: number;
    /** Their total on the ledger's own scale, with the direction thrown away. */
    weight: number;
    /** The heaviest one standing, or null where the ledger holds nothing. */
    heaviest: Severity | null;
    /**
     * What the crossing is handed, 0..1.
     */
    share: number;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What the ledger says is unfinished about this person, as of a day.
 */
export function whatACrossingAsksOfTheDaoHeart(input: {
    personId: string;
    ledger: readonly ObligationRecord[];
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhatTheCrossingAsks {
    // Collapsed onto the DEED rather than the record, on
    // `personal-alignment.ts`'s rule and for its stated reason: a wrong done to
    // a man with nine brothers is not nine times the wrong done to an orphan,
    // and `inheritOnDeath` writes a copy per heir. Heaviest copy stands.
    const unfinished = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;
        // A PARTY TO IT, either way round. The direction is read here and
        // nowhere else, and it is read only to decide whether this row is about
        // them at all - never to decide which of the two it is.
        if (record.holderId !== input.personId && record.subjectId !== input.personId) continue;

        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const standing = unfinished.get(key);
        if (standing === undefined
            || WHAT_A_RECORD_COUNTS_FOR[record.severity] > WHAT_A_RECORD_COUNTS_FOR[standing]) {
            unfinished.set(key, record.severity);
        }
    }

    let weight = 0;
    let heaviest: Severity | null = null;
    for (const severity of unfinished.values()) {
        weight += WHAT_A_RECORD_COUNTS_FOR[severity];
        if (heaviest === null
            || WHAT_A_RECORD_COUNTS_FOR[severity] > WHAT_A_RECORD_COUNTS_FOR[heaviest]) {
            heaviest = severity;
        }
    }
    // Two places, so two callers comparing readings compare the same arithmetic
    // and not a float tail. Same rounding `personal-alignment.ts` uses.
    weight = Math.round(weight * 100) / 100;

    const share = Math.min(1, weight / A_LIFE_THAT_IS_ALL_LOOSE_ENDS);
    const open = unfinished.size;

    return { open, weight, heaviest, share, line: lineFor(open, weight, heaviest) };
}

function lineFor(open: number, weight: number, heaviest: Severity | null): string {
    if (open === 0) {
        return 'Nothing on the record is unfinished. A wall asks and there is nothing to answer.';
    }
    return `${open} unfinished ${open === 1 ? 'account' : 'accounts'} (${weight.toFixed(2)} of `
        + `${A_LIFE_THAT_IS_ALL_LOOSE_ENDS}), the heaviest ${heaviest}. Direction is not read: `
        + 'a thing owed and a thing owing weigh the same, and settling one is settling it '
        + 'whichever way it was settled.';
}
