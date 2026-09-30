/** A costly house slip is one owned object, with the same address as an ordinary slip. */
import { THE_LONG_RANGE_COMMUNICATION_TALISMAN as SLIP } from '../../data/cultivation/communication-talismans.js';
import { makeObject, transferPossession, isRuined, howMuchAGradeIsWorthTracking, type ObjectRecord } from './possessions.js';
import { WHAT_A_SLIP_TAKES, WHAT_A_SLIP_WEIGHS } from './a-talisman-is-one-act-somebody-already-paid-for.js';

export function aLongRangeCommunicationSlip(input: {
    id: string; makerId: string; makerName: string; holderId: string; holderName: string;
    houseId: string; onDay: number;
}): ObjectRecord {
    return transferPossession(makeObject({
        id: input.id, name: SLIP.name, kind: 'other', significance: howMuchAGradeIsWorthTracking(SLIP.grade),
        description: SLIP.what, ownerId: input.holderId, ownerName: input.holderName,
        volume: WHAT_A_SLIP_TAKES, weight: WHAT_A_SLIP_WEIGHS,
        tags: ['single-use', 'long-range-communication', `house:${input.houseId}`],
        data: { talismanId: SLIP.id, grade: SLIP.grade, markedBy: input.houseId,
            keyedTo: input.holderId, cutBy: input.makerId, twinId: `${input.id}-twin` }
    }), { onDay: input.onDay, toHolderId: input.holderId, toHolderName: input.holderName,
        how: 'crafted', source: input.makerName });
}

export function theTwinOfALongSlip(slip: ObjectRecord, seatId: string): ObjectRecord {
    return makeObject({ id: String(slip.data.twinId), name: 'The hall twin of a heaven communication talisman',
        kind: 'other', significance: slip.significance, locationId: seatId,
        ownerId: String(slip.data.markedBy), ownerName: 'the marked house',
        volume: WHAT_A_SLIP_TAKES, weight: WHAT_A_SLIP_WEIGHS,
        tags: ['long-range-communication-twin'],
        data: { slipId: slip.id, keyedTo: slip.data.keyedTo, markedBy: slip.data.markedBy },
        provenance: slip.provenance.map(link => ({ ...link, holderId: null, holderName: 'the hall', source: 'paired when cut' })) });
}

export function twinOfLongSlip(objects: readonly ObjectRecord[], slip: ObjectRecord, seatId: string): ObjectRecord | null {
    return objects.find(row => row.id === slip.data.twinId && row.locationId === seatId
        && row.possessorId === null && !isRuined(row)) ?? null;
}

export function longRangeSlipHeld(objects: readonly ObjectRecord[], holderId: string, houseId: string): ObjectRecord | null {
    return objects.find(object => object.possessorId === holderId && object.data.keyedTo === holderId
        && object.data.markedBy === houseId && object.tags.includes('long-range-communication')
        && !isRuined(object) && object.data.spent !== true) ?? null;
}
