/**
 * A storage ring is worn, and what is in it goes where the ring goes. The owner: "wear, but you
 * can also unequip it and put it in your pouch (then you can't retrieve stuff)", and a stolen
 * ring's mark is broken with "same math as the sealing".
 */
import { describe, expect, it } from 'vitest';

import {
    aStorageRing,
    breakTheMark,
    canReachInto,
    howFullTheRingIs,
    putIntoTheRing,
    takeOutOfTheRing,
    whatIsInTheRing,
    whoseMarkIsOn
} from '../../../src/engine/world/a-storage-ring.js';
import { hadAs, makeObject, transferPossession, type ObjectRecord } from '../../../src/engine/world/possessions.js';

const CORE_FORMATION = 18;
const worn = (row: ObjectRecord) => hadAs(row, 'worn');

function aRingWithASwordIn(ownerOrdinal = CORE_FORMATION) {
    const ring = worn(aStorageRing({ id: 'ring', grade: 'mortal', ownerId: 'lu', ownerName: 'Lu Hanbo', ownerOrdinal }));
    const sword = makeObject({ id: 'sword', name: 'an iron sword', kind: 'artifact', power: 2, possessorId: 'lu', ownerId: 'lu', volume: 3 });
    const objects = [ring, sword];
    expect(putIntoTheRing(objects, 'lu', ring, sword)).toBe('stored');
    return objects;
}

describe('a storage ring', () => {
    it('holds a thing, which is the ring\'s until it is taken out', () => {
        const objects = aRingWithASwordIn();
        expect(whatIsInTheRing(objects, 'ring').map(o => o.id)).toEqual(['sword']);
        expect(howFullTheRingIs(objects, objects[0]!)).toEqual({ holds: 200, taken: 3 });
        expect(takeOutOfTheRing(objects, 'lu', objects[0]!, objects[1]!)).toBe('taken_out');
        expect(objects[1]!.possessorId).toBe('lu');
    });

    it('cannot be reached into once it is off the hand', () => {
        const objects = aRingWithASwordIn();
        objects[0] = hadAs(objects[0]!, 'inventory');
        expect(canReachInto(objects[0]!, 'lu')).toBe(false);
        expect(takeOutOfTheRing(objects, 'lu', objects[0]!, objects[1]!)).toBe('cannot_reach_into_it');
    });

    it('takes what is in it along when it is stolen, and a thief cannot open it past the mark', () => {
        const objects = aRingWithASwordIn();
        objects[0] = hadAs(transferPossession(objects[0]!, { toHolderId: 'you', toHolderName: 'Shen Wuyou', onDay: 3, how: 'stolen' } as never), 'worn');
        expect(whatIsInTheRing(objects, 'ring').map(o => o.id)).toEqual(['sword']);
        expect(canReachInto(objects[0]!, 'you')).toBe(false);
    });

    it('breaks for somebody far enough above the hand that marked it, with the seal\'s odds, and takes their mark', () => {
        const low = aRingWithASwordIn(3);
        const ring = { ...hadAs(low[0]!, 'worn'), possessorId: 'you' };
        low[0] = ring;
        const broke = breakTheMark(low, ring, { id: 'you', ordinal: CORE_FORMATION }, 0);
        expect(broke.lifted).toBe(true);
        expect(broke.theCasterKnows).toBe(true);
        expect(whoseMarkIsOn(low[0]!)?.by).toBe('you');
        expect(canReachInto(low[0]!, 'you')).toBe(true);

        const high = aRingWithASwordIn(CORE_FORMATION);
        const theirs = { ...hadAs(high[0]!, 'worn'), possessorId: 'you' };
        high[0] = theirs;
        const failed = breakTheMark(high, theirs, { id: 'you', ordinal: 3 }, 0);
        expect(failed.lifted).toBe(false);
        expect(failed.odds).toBe(0);
        expect(whoseMarkIsOn(high[0]!)?.by).toBe('lu');
    });

    it('will not take more than it holds', () => {
        const ring = worn(aStorageRing({ id: 'ring', grade: 'mortal', ownerId: 'lu', ownerName: 'Lu Hanbo', ownerOrdinal: 9 }));
        const boat = makeObject({ id: 'boat', name: 'a spirit boat', kind: 'artifact', possessorId: 'lu', volume: 120_000 });
        expect(putIntoTheRing([ring, boat], 'lu', ring, boat)).toBe('no_room');
    });
});
