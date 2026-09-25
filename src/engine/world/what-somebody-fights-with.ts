/**
 * What somebody fights with: a weapon, held or carried.
 *
 * The owner: "weapons would use held state too, it's not bespoke". A weapon is a made thing with
 * a rating, and it is had like anything else: held when it is drawn, in the inventory when it is
 * sheathed. What a fight swings is the best one in hand, or else the best one on them, drawn as
 * the fight opens. Every live way of coming by a weapon (the bench, a purchase, a theft, a
 * yielding) writes the world's object table, so this reads there.
 *
 * A drawn blade stays drawn until it is put away or let go: somebody who drew a sword and walked
 * across a province is still holding it. It is read by `attack` (no concealed opening with a blade
 * out) and by the face a house reads (`howTheirPeopleSeeYourFace`). Still owed, and belonging to
 * other files: a challenge put with a blade drawn says which `DuelTerms` are meant before anybody
 * names them (`whetherTheyAnswer`, `holdADuel`), and refusing a demand to get off somebody's ground
 * with a blade in hand is the same refusal one step nearer a fight (`whatRefusingLooksLike`).
 */

import { isHeld, isWorn, type ObjectRecord } from './possessions.js';

/** Whether this is something to fight with: a made thing with a rating, not something worn. */
export function isAWeapon(object: Pick<ObjectRecord, 'kind' | 'power' | 'tags'>): boolean {
    return object.kind === 'artifact' && object.power !== null && object.power !== undefined && !isWorn(object);
}

function best(rows: readonly ObjectRecord[]): ObjectRecord | null {
    let top: ObjectRecord | null = null;
    for (const row of rows) if (top === null || (row.power ?? 0) > (top.power ?? 0)) top = row;
    return top;
}

/** The weapon somebody has drawn, the best if they hold two, or null. */
export function theBladeInTheirHand(objects: readonly ObjectRecord[], personId: string): ObjectRecord | null {
    return best(objects.filter(object => object.possessorId === personId && isHeld(object) && isAWeapon(object)));
}

/** What a fight swings for them: the best weapon in hand, else the best on them, or null. */
export function theWeaponTheyFightWith(
    objects: readonly ObjectRecord[],
    personId: string
): { id: string; name: string; power: number } | null {
    const row = theBladeInTheirHand(objects, personId)
        ?? best(objects.filter(object => object.possessorId === personId && isAWeapon(object)));
    return row === null ? null : { id: row.id, name: row.name, power: row.power ?? 0 };
}

/**
 * A thing carried in the pouch under an id the world also keeps a row for is
 * that row, and the row says the rung it stands at now: a hole takes one off
 * (`object-damage.ts`). The pouch keeps only the catalog's rating, so without
 * this a holed blade carried in the pouch would fight as if whole.
 */
export function atTheRungItStandsAt<T extends { id: string; power: number }>(
    carried: T | null,
    objects: readonly ObjectRecord[]
): T | null {
    if (carried === null) return null;
    const row = objects.find(object => object.id === carried.id);
    return row === undefined || row.power === null ? carried : { ...carried, power: row.power };
}
