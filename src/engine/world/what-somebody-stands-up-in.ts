/**
 * What somebody has on: the clothes they stand up in, and a house's robes over them.
 *
 * The owner: "we need the inventory system working and the engine tracking it. i need to know
 * what's on me." A house's robes were already rows (`aUniformFor`), and somebody with no house
 * had nothing: the inventory said "what you are standing in", which answers nothing. So
 * everybody's own clothes are a row too, mundane like the robes and owned by the person wearing
 * them, which is what makes them theirs to lose.
 *
 * Clothes are equipment like anything else: worn, held or in somebody's inventory (`howItIsHad`).
 */

import { hadAs, isWorn, makeObject, WORN_TAG, type ObjectRecord } from './possessions.js';

/** The tag on anything somebody wears that is not a house's robes. */
export const CLOTHING_TAG = 'clothing';

/** Whether this row is a garment, plain clothes or a house's robes, whether or not it is on. */
export function isAGarment(object: Pick<ObjectRecord, 'tags'>): boolean {
    return object.tags.includes(CLOTHING_TAG) || object.tags.includes('uniform');
}

/** Everything this person has on, robes first, because they are what other people read. */
export function whatTheyHaveOn(objects: readonly ObjectRecord[], personId: string): ObjectRecord[] {
    return objects
        .filter(object => object.possessorId === personId && isAGarment(object) && isWorn(object))
        .sort((a, b) => Number(b.tags.includes('uniform')) - Number(a.tags.includes('uniform')));
}

/**
 * The clothes somebody stands up in, as a row they own. One per issuing, like the robes: a set
 * handed out again is a new set, so `among` is every row already in the world, and the id counts
 * past any set this person was given on the same day.
 */
export function theClothesTheyStandUpIn(input: {
    personId: string;
    personName: string;
    onDay: number;
    among?: readonly Pick<ObjectRecord, 'id'>[];
}): ObjectRecord {
    const stem = `clothes-${input.personId}-${Math.floor(input.onDay)}`;
    const before = (input.among ?? []).filter(object => object.id === stem || object.id.startsWith(`${stem}-`)).length;
    return makeObject({
        id: before === 0 ? stem : `${stem}-${before + 1}`,
        name: 'plain clothes',
        kind: 'other',
        significance: 'mundane',
        description: 'Ordinary clothes.',
        possessorId: input.personId,
        ownerId: input.personId,
        ownerName: input.personName,
        tags: [CLOTHING_TAG, WORN_TAG]
    });
}

/**
 * What was taken off somebody who now has nothing on, or null if they have something on or
 * nothing of theirs is in anybody else's hands. What they wore is theirs by ownership (their own
 * clothes) or by issue (a house's robes, tagged with the member), so it can be found in a
 * thief's inventory.
 */
export function theClothesTakenOffThem(objects: readonly ObjectRecord[], personId: string): ObjectRecord[] | null {
    if (whatTheyHaveOn(objects, personId).length > 0) return null;
    const taken = objects.filter(object => isAGarment(object)
        && object.possessorId !== personId
        && (object.ownerId === personId || object.tags.includes(`member:${personId}`)));
    return taken.length > 0 ? taken : null;
}

/** The status line for what somebody has on. */
export function theLineForWhatTheyHaveOn(on: readonly Pick<ObjectRecord, 'name'>[]): string {
    return on.length === 0
        ? 'You have nothing on.'
        : `Wearing: ${on.map(object => object.name).join(', ')}.`;
}

/**
 * Puts one garment on and every other one this person has on into their inventory: one outfit at a
 * time. The owner, on a disciple changing out of the house's robes: "if they did wear plain
 * clothes they'd unequip the sect robes". Changes `objects` in place, as every writer of the
 * world's object table does, and returns what came off.
 */
export function changeInto(objects: ObjectRecord[], personId: string, garmentId: string): ObjectRecord[] {
    const cameOff: ObjectRecord[] = [];
    for (let i = 0; i < objects.length; i++) {
        const object = objects[i]!;
        if (object.possessorId !== personId || !isAGarment(object)) continue;
        const on = object.id === garmentId;
        if (on === isWorn(object)) continue;
        if (!on) cameOff.push(object);
        objects[i] = hadAs(object, on ? 'worn' : 'inventory');
    }
    return cameOff;
}
