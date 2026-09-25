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
import { asCarried } from './object-damage.js';
import { combatPowerForOrdinal, type CarriedObject } from '../cultivation/combat.js';
import { whatItStillDoes } from '../cultivation/whether-a-weapon-survives-being-used.js';

/** Whether this is something to fight with: a made thing with a rating, not something worn. */
export function isAWeapon(object: Pick<ObjectRecord, 'kind' | 'power' | 'tags'>): boolean {
    return object.kind === 'artifact' && object.power !== null && object.power !== undefined && !isWorn(object);
}

/** What a carried thing adds in a fight, which is what "best" is measured by. */
export function whatItAddsInAFight(carried: CarriedObject): number {
    return whatItStillDoes(carried, combatPowerForOrdinal);
}

function best(rows: readonly ObjectRecord[]): ObjectRecord | null {
    let top: ObjectRecord | null = null;
    for (const row of rows) {
        if (top === null || whatItAddsInAFight(asCarried(row)) > whatItAddsInAFight(asCarried(top))) top = row;
    }
    return top;
}

/** The weapon somebody has drawn, the best if they hold two, or null. */
export function theBladeInTheirHand(objects: readonly ObjectRecord[], personId: string): ObjectRecord | null {
    return best(objects.filter(object => object.possessorId === personId && isHeld(object) && isAWeapon(object)));
}

/**
 * What a fight swings for them: the best weapon in hand, else the best on them,
 * or null. `pouch` is the best rated thing in their pouch, when they have one,
 * and counts as on them.
 */
export function theWeaponTheyFightWith(
    objects: readonly ObjectRecord[],
    personId: string,
    pouch: CarriedObject | null = null
): CarriedObject | null {
    const inHand = theBladeInTheirHand(objects, personId);
    if (inHand !== null) return asCarried(inHand);
    const row = best(objects.filter(object => object.possessorId === personId && isAWeapon(object)));
    const onThem = row === null ? null : asCarried(row);
    const pouched = atTheRungItStandsAt(pouch, objects);
    if (onThem === null || pouched === null) return onThem ?? pouched;
    return whatItAddsInAFight(pouched) > whatItAddsInAFight(onThem) ? pouched : onThem;
}

/**
 * A thing carried in the pouch under an id the world also keeps a row for is
 * that row: its rung, its holes and whether it is broken (`object-damage.ts`).
 * The pouch keeps only the catalog's rating.
 */
function atTheRungItStandsAt(
    carried: CarriedObject | null,
    objects: readonly ObjectRecord[]
): CarriedObject | null {
    if (carried === null) return null;
    const row = objects.find(object => object.id === carried.id);
    return row === undefined || row.power === null ? carried : asCarried(row);
}
