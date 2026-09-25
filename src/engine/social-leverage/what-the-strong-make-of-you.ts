/**
 * What somebody on the demonic path makes of you: might makes right.
 *
 * The owner: "a demonic house doesn't reward harm done. they reward personal power regardless
 * of the means." So this reads POWER, not deeds. Stronger than them and they defer, however you
 * got there; nothing here counts what you took from others, for or against you. The one deed
 * that does count is the other end of power: a wrong done to you that you still hold, unanswered,
 * is weakness shown, and they think the less of you for it.
 *
 * `what-they-feel-about-you.ts` reads what passed between two people and never an alignment.
 * This is the layer on top of it for a reader whose house measures by strength. A righteous or
 * neutral reader gets null. A person's opinion, not heaven's: heaven has none.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import { WHAT_A_RECORD_COUNTS_FOR } from './personal-alignment.js';
import { ENOUGH_TO_MUDDY_IT } from './what-they-feel-about-you.js';

export type WhatTheStrongMakeOfYou =
    /** You stand above them. Strength is the measure, and they defer to it. */
    | 'defers'
    /** Something was taken from you and never taken back, and you are not above them. */
    | 'contempt'
    /** Level with them or beneath them, with nothing left standing: the rung says it already. */
    | 'nothing_either_way';

export interface HowTheStrongReadYou {
    regard: WhatTheStrongMakeOfYou;
    /** Your rung over theirs, in ordinals. Negative when they stand above you. */
    above: number;
    /** What was taken from you and never taken back, on `WHAT_A_RECORD_COUNTS_FOR`'s scale. */
    suffered: number;
    /** Engine truth, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What this person makes of that one, if this person is on the demonic path.
 *
 * `ledger` is every record naming `aboutId`. Only the rows `aboutId` HOLDS are read: what they
 * did to anybody else is not the measure.
 */
export function whatTheStrongMakeOfYou(input: {
    observerAlignment: SectAlignment | null;
    observerOrdinal: number;
    aboutId: string;
    aboutOrdinal: number;
    ledger: readonly ObligationRecord[];
}): HowTheStrongReadYou | null {
    if (input.observerAlignment !== 'demonic') return null;

    const sufferedBy = new Map<string, Severity>();
    for (const record of input.ledger) {
        if (record.status !== 'open' || record.holderId !== input.aboutId) continue;
        if (record.kind !== 'grudge' && record.kind !== 'blood_feud') continue;
        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const standing = sufferedBy.get(key);
        if (standing === undefined || WHAT_A_RECORD_COUNTS_FOR[record.severity] > WHAT_A_RECORD_COUNTS_FOR[standing]) {
            sufferedBy.set(key, record.severity);
        }
    }
    let suffered = 0;
    for (const severity of sufferedBy.values()) suffered += WHAT_A_RECORD_COUNTS_FOR[severity];
    suffered = Math.round(suffered * 100) / 100;

    const above = input.aboutOrdinal - input.observerOrdinal;
    const regard: WhatTheStrongMakeOfYou = above > 0
        ? 'defers'
        : suffered >= ENOUGH_TO_MUDDY_IT ? 'contempt' : 'nothing_either_way';
    return {
        regard,
        above,
        suffered,
        line: `On the demonic path, measured by strength: ${above > 0 ? `${above} rung(s) above them` : above < 0 ? `${-above} rung(s) below them` : 'level with them'}, `
            + `${suffered.toFixed(2)} taken from them and never taken back. How it was come by is not counted.`
    };
}
