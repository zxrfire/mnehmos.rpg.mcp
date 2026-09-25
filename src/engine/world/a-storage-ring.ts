/**
 * A storage ring: a folded space you wear, with things inside it.
 *
 * The owner: rings are worn, "but you can also unequip it and put it in your pouch (then you
 * can't retrieve stuff). then it's not bespoke right? just like a sword can be equipped or not".
 * So a ring is an item like any other, worn, held or in the inventory, and what makes it a ring is
 * that things can be IN it: a thing stored in a ring is possessed by the ring, not by the person,
 * and goes wherever the ring goes. Steal a ring and you have everything in it. Take a ring off and
 * nothing in it can be reached until it is back on.
 *
 * A ring carries its owner's mark, and reaching into somebody else's means breaking it first:
 * "break the mark. same math as the sealing". The mark is a seal laid at its owner's strength,
 * broken by `whatBreakingASealTakes` with the same odds over the same realm gap, and the owner
 * feels it go, as a seal's caster does. A broken mark takes the breaker's.
 *
 * What a ring holds is `WHAT_A_RING_HOLDS` by grade: volume, and no weight, because what is in a
 * folded space is not being carried.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { whatBreakingASealTakes, type BreakingASeal } from '../social/what-laying-a-qi-seal-takes.js';
import { isWorn, makeObject, type ObjectRecord } from './possessions.js';
import { WHAT_A_RING_HOLDS } from './what-a-body-can-carry-and-what-a-ring-holds.js';

/** The tag on a ring. */
export const STORAGE_RING_TAG = 'storage-ring';

/** Whether this thing is a storage ring. */
export function isAStorageRing(object: Pick<ObjectRecord, 'tags'>): boolean {
    return object.tags.includes(STORAGE_RING_TAG);
}

/** A ring of a grade, marked by whoever it is made for. */
export function aStorageRing(input: {
    id: string;
    grade: TechniqueGrade;
    ownerId: string;
    ownerName: string;
    /** The ordinal the owner marks it at, which is what a breaker is measured against. */
    ownerOrdinal: number;
}): ObjectRecord {
    return makeObject({
        id: input.id,
        name: `a ${input.grade}-grade storage ring`,
        kind: 'artifact',
        significance: 'significant',
        possessorId: input.ownerId,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        volume: 0.01,
        weight: 0.01,
        tags: [STORAGE_RING_TAG],
        data: { grade: input.grade, markedBy: input.ownerId, markedAtOrdinal: input.ownerOrdinal }
    });
}

/** Whose mark is on a ring, and the strength it was laid at, or null for an unmarked one. */
export function whoseMarkIsOn(ring: Pick<ObjectRecord, 'data'>): { by: string; atOrdinal: number } | null {
    const by = ring.data?.markedBy;
    const at = ring.data?.markedAtOrdinal;
    return typeof by === 'string' && typeof at === 'number' ? { by, atOrdinal: at } : null;
}

/** Whether this person can reach into this ring: it is on their hand and the mark is theirs. */
export function canReachInto(ring: ObjectRecord, personId: string): boolean {
    if (!isAStorageRing(ring) || ring.possessorId !== personId || !isWorn(ring)) return false;
    const mark = whoseMarkIsOn(ring);
    return mark === null || mark.by === personId;
}

/** What is inside a ring. */
export function whatIsInTheRing(objects: readonly ObjectRecord[], ringId: string): ObjectRecord[] {
    return objects.filter(object => object.possessorId === ringId);
}

/** How much a ring holds, and how much of it is taken. */
export function howFullTheRingIs(objects: readonly ObjectRecord[], ring: ObjectRecord): { holds: number; taken: number } {
    const grade = ring.data?.grade as TechniqueGrade | undefined;
    const holds = grade !== undefined && grade in WHAT_A_RING_HOLDS ? WHAT_A_RING_HOLDS[grade] : 0;
    const taken = whatIsInTheRing(objects, ring.id).reduce((sum, object) => sum + object.volume, 0);
    return { holds, taken: Math.round(taken * 100) / 100 };
}

/**
 * Putting a thing of theirs into a ring they can reach into. The thing leaves their hands, their
 * body and their inventory, and is the ring's until it is taken out.
 */
export function putIntoTheRing(
    objects: ObjectRecord[],
    personId: string,
    ring: ObjectRecord,
    thing: ObjectRecord
): 'stored' | 'cannot_reach_into_it' | 'no_room' | 'not_theirs_to_put' {
    if (!canReachInto(ring, personId)) return 'cannot_reach_into_it';
    if (thing.possessorId !== personId || thing.id === ring.id) return 'not_theirs_to_put';
    const { holds, taken } = howFullTheRingIs(objects, ring);
    if (taken + thing.volume > holds) return 'no_room';
    const at = objects.findIndex(object => object.id === thing.id);
    objects[at] = { ...thing, possessorId: ring.id, tags: thing.tags.filter(tag => tag !== 'worn' && tag !== 'held') };
    return 'stored';
}

/** Taking a thing out of a ring they can reach into, into their inventory. */
export function takeOutOfTheRing(
    objects: ObjectRecord[],
    personId: string,
    ring: ObjectRecord,
    thing: ObjectRecord
): 'taken_out' | 'cannot_reach_into_it' | 'not_in_it' {
    if (!canReachInto(ring, personId)) return 'cannot_reach_into_it';
    if (thing.possessorId !== ring.id) return 'not_in_it';
    const at = objects.findIndex(object => object.id === thing.id);
    objects[at] = { ...thing, possessorId: personId };
    return 'taken_out';
}

/**
 * Breaking the mark on somebody else's ring: the seal's own contest, measured against the hand
 * that laid the mark. `roll` is the caller's draw in 0..1. A broken mark takes the breaker's, and
 * the one whose mark it was feels it go.
 */
export function breakTheMark(
    objects: ObjectRecord[],
    ring: ObjectRecord,
    breaker: { id: string; ordinal: number },
    roll: number
): BreakingASeal & { theirsNow: boolean; whoseItWas: string | null } {
    const mark = whoseMarkIsOn(ring);
    if (mark === null || mark.by === breaker.id) {
        return {
            lifted: true, odds: 1, realmGapOverTheCaster: 0, theCasterKnows: false,
            line: 'There is no mark on it but their own.', theirsNow: true, whoseItWas: mark?.by ?? null
        };
    }
    const contest = whatBreakingASealTakes({
        how: 'force_of_arms',
        breakerOrdinal: breaker.ordinal,
        casterOrdinal: mark.atOrdinal,
        isTheCaster: false
    });
    const broke = contest.odds >= 1 || (contest.odds > 0 && roll < contest.odds);
    if (broke) {
        const at = objects.findIndex(object => object.id === ring.id);
        objects[at] = { ...ring, data: { ...ring.data, markedBy: breaker.id, markedAtOrdinal: breaker.ordinal } };
    }
    return { ...contest, lifted: broke, theirsNow: broke, whoseItWas: mark.by };
}
