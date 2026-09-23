/**
 * The oath a house offers somebody walking out of its door.
 *
 * The design (`docs/world/climbing/past-the-ceiling.md`, the two ways out) and
 * the owner: *"not necessarily a betrayal, but likely you'd have to swear an
 * oath not to leak your arts"*, and *"oaths go through the oath system."* A
 * house offers it first, because losing a person is survivable and losing the
 * road is not:
 *
 *   sworn     a `silence` oath held by the leaver toward the house, whose terms
 *             say what is sworn: the house's arts transmitted to nobody. It
 *             forbids transmission, never possession - practising the old road
 *             is fine. Teaching it breaks the oath through the ledger's own
 *             break path, at that moment.
 *   refused   the house holds it against them from the day they walk: a grudge
 *             the ledger carries, which the house's ordinary reactions to what it
 *             holds read from then on.
 *
 * Pure: a record out, written by the caller onto the ledger.
 */

import { createGrudge, createOath, type ObligationRecord } from './grudges.js';

export type AnswerAtTheDoor = 'swear' | 'refuse';

export interface WhatWasSaidAtTheDoor {
    answer: AnswerAtTheDoor;
    record: ObligationRecord;
    /** Engine-authored and factual. */
    line: string;
}

export function theOathAHouseOffersAtItsDoor(input: {
    leaverId: string;
    leaverName: string;
    houseId: string;
    houseName: string;
    answer: AnswerAtTheDoor;
    onDay: number;
}): WhatWasSaidAtTheDoor {
    const terms = `Not to transmit the arts of ${input.houseName} to anybody. Holding and practising them is not forbidden.`;
    if (input.answer === 'swear') {
        return {
            answer: 'swear',
            record: createOath({
                holderId: input.leaverId,
                subjectId: input.houseId,
                cause: 'silence',
                severity: 'grave',
                onDay: input.onDay,
                terms,
                description: `${input.leaverName} swore silence about the arts of ${input.houseName} on leaving it.`,
                tags: ['left-a-house', input.houseId]
            }),
            line: `${input.houseName} offered the oath and it was sworn: ${terms}`
        };
    }
    return {
        answer: 'refuse',
        record: createGrudge({
            holderId: input.houseId,
            subjectId: input.leaverId,
            cause: 'other',
            severity: 'grave',
            onDay: input.onDay,
            description: `${input.leaverName} walked out of ${input.houseName} with its arts and would not swear to keep them.`,
            tags: ['left-a-house', 'refused-the-oath', input.houseId]
        }),
        line: `${input.houseName} offered the oath and it was refused. The house holds that from today.`
    };
}
