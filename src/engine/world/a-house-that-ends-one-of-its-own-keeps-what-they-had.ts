/**
 * What a house takes off somebody it has just executed.
 *
 * `a-house-takes-back-what-it-handed-over.ts` answers the narrower question and
 * cannot answer this one: it is scoped to things the house lent or bestowed,
 * because a recall is a sanction over the house's own property and stops there.
 * A death sentence does not stop there. The design owner: *"the artifacts go to
 * the sect treasury."*
 *
 * ── WHY THIS IS NOT `settleWhatTheyWereCarrying` ─────────────────────────
 *
 * That path settles a dead CULTIVATOR - it reads `cultivator_pouch`, zeroes the
 * `cultivators` purse, and writes a grave into the cache ledger. The offender a
 * room sentences is usually somebody the world holds and no run was ever played
 * through, so there is no pouch row, no purse column and nothing to empty. More
 * to the point, the two answer different questions: a body on the ground goes to
 * whoever is standing over it or into the earth, and an execution is the house
 * taking. Routing one through the other would have to teach the estate path
 * about sentences.
 *
 * So this is the narrow act, over the one possessions table, through the one
 * transfer function, with `confiscated` on the chain - the same word
 * `takeItBack` writes, because it is the same kind of event and a later reader
 * of the chain should not have to know which module wrote the link.
 *
 * ── EVERYTHING, AND OWNERSHIP WITH IT ────────────────────────────────────
 *
 * `transferPossession` defaults `transfersOwnership` to false because taking a
 * thing does not make it yours. A sentence is the exception the default exists
 * to be contrasted with: the room decided in front of the house, and what the
 * house is asserting is title rather than custody. What that leaves is a chain
 * anybody can read - the dead person's name, then the house's, with the word
 * for it in between.
 *
 * What is NOT taken is anything the house does not have standing over: a thing
 * some other house owns and this one merely found on the body is moved in
 * possession and left in that house's register, so the register still says
 * whose it is and the other house still has a claim to make.
 */

import { isRuined, transferPossession, type ObjectRecord } from './possessions.js';

export interface WhatAnEndingLeavesToTheHouse {
    /** The moved rows, ready to be written back. Empty is the common answer. */
    objects: ObjectRecord[];
    /** Stones that were on the person's row, for the caller to move. */
    stones: number;
}

/**
 * Everything the sentenced person was holding, in the house's hands.
 *
 * Pure: rows in, rows out, nothing written. The caller owns the world.
 */
export function whatAnEndingLeavesToTheHouse(input: {
    objects: readonly ObjectRecord[];
    /** Stones on the sentenced person's own row. */
    stones: number;
    offenderId: string;
    houseId: string;
    houseName: string;
    onDay: number;
    /** Why, in the house's own words. Goes on every chain this writes. */
    note: string;
}): WhatAnEndingLeavesToTheHouse {
    const moved: ObjectRecord[] = [];
    for (const object of input.objects) {
        if (object.possessorId !== input.offenderId) continue;
        // A thing that has already been destroyed is not property. Leaving it
        // out is what stops a treasury filling up with wreckage nobody can
        // spend, and `isRuined` is the engine's own stored answer rather than
        // a second reading of the row.
        if (isRuined(object)) continue;
        const someoneElsesTitle =
            object.ownerId !== null
            && object.ownerId !== input.offenderId
            && object.ownerId !== input.houseId;
        moved.push(transferPossession(object, {
            onDay: input.onDay,
            toHolderId: input.houseId,
            toHolderName: input.houseName,
            how: 'confiscated',
            source: input.houseName,
            transfersOwnership: !someoneElsesTitle,
            note: someoneElsesTitle
                ? `${input.note} Whose it is does not move: it was not theirs to lose.`
                : input.note
        }));
    }
    return { objects: moved, stones: Math.max(0, Math.round(input.stones)) };
}
