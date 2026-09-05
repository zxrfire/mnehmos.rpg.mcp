/**
 * What a person is, read off what they have done rather than off whose roll they
 * are on.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';

/**
 * What each band of record is worth towards a reading of somebody.
 */
export const WHAT_A_RECORD_COUNTS_FOR: Readonly<Record<Severity, number>> =
    Object.freeze({
        slight: 0.05,
        serious: 0.25,
        grave: 1,
        unforgivable: 2
    });

/**
 * The point at which a run of deeds stops being events and reads as a method.
 */
export const WHAT_MAKES_IT_A_METHOD = 2;

export interface WhatSomebodyIs {
    /**
     * The word, and it is the SAME word a house wears. A person and a house are
     * being asked the same question about method, so a fourth alignment tomorrow
     * reaches both without this file changing.
     */
    alignment: SectAlignment;
    /** What they have taken out of other people, on the scale above. */
    taken: number;
    /** What they have paid out of themselves for other people. */
    paid: number;
    /** Distinct wrongs standing open against them. */
    wrongs: number;
    /** Distinct kindnesses standing open in their favour. */
    kindnesses: number;
    /** True where the ledger holds nothing either way about them. */
    nothingEitherWay: boolean;
    /** The heaviest thing standing against them, or null. */
    worst: Severity | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * Read the ledger and say what the person in it has made of themselves.
 */
export function whatTheirRecordMakesThem(input: {
    personId: string;
    /** Everything the ledger holds that names them, in any capacity. */
    ledger: readonly ObligationRecord[];
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhatSomebodyIs {
    const against = new Map<string, Severity>();
    const forThem = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;

        const took = (record.kind === 'grudge' || record.kind === 'blood_feud')
            && record.subjectId === input.personId;
        const paid = record.kind === 'favor' && record.holderId === input.personId;
        if (!took && !paid) continue;

        // A record and a deed are not the same thing. See the header.
        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const into = took ? against : forThem;
        const standing = into.get(key);
        if (standing === undefined || heavier(record.severity, standing)) {
            into.set(key, record.severity);
        }
    }

    const taken = total(against);
    const paidOut = total(forThem);
    const worst = heaviestOf(against);

    // ORDER, NOT ARITHMETIC. Demonic is asked first and asked of `taken`
    // alone, so nothing anybody gives away answers for what they took.
    const alignment: SectAlignment = taken >= WHAT_MAKES_IT_A_METHOD
        ? 'demonic'
        : paidOut >= WHAT_MAKES_IT_A_METHOD
            ? 'righteous'
            : 'neutral';

    return {
        alignment,
        taken,
        paid: paidOut,
        wrongs: against.size,
        kindnesses: forThem.size,
        nothingEitherWay: against.size === 0 && forThem.size === 0,
        worst,
        line: lineFor(alignment, against.size, forThem.size, taken, paidOut, worst)
    };
}

function total(bands: ReadonlyMap<string, Severity>): number {
    let sum = 0;
    for (const severity of bands.values()) sum += WHAT_A_RECORD_COUNTS_FOR[severity];
    // Two decimal places, so a caller comparing two readings is comparing the
    // same arithmetic and not a float tail.
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
    alignment: SectAlignment,
    wrongs: number,
    kindnesses: number,
    taken: number,
    paid: number,
    worst: Severity | null
): string {
    const ledger =
        `${wrongs} open against them (${taken.toFixed(2)}), `
        + `${kindnesses} in their favour (${paid.toFixed(2)}), `
        + `at ${WHAT_MAKES_IT_A_METHOD} for a method.`;

    if (alignment === 'demonic') {
        return 'What they have taken out of other people is not a run of bad afternoons any '
            + `more, it is how they get things done${worst ? `, and the worst of it is ${worst}` : ''}. `
            + ledger;
    }
    if (alignment === 'righteous') {
        return 'They have paid for other people out of themselves often enough and heavily '
            + 'enough that it is what they do rather than what they once did. '
            + ledger;
    }
    if (wrongs === 0 && kindnesses === 0) {
        return 'The world holds nothing either way about them. That is not innocence and it is '
            + 'not virtue - nobody has anything on them because they have not done anything. '
            + ledger;
    }
    return 'They have done things in both directions and neither is a pattern yet. '
        + ledger;
}
