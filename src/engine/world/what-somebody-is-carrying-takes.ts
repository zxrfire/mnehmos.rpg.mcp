/**
 * What everything somebody carries takes up: the pouch AND every thing they hold.
 *
 * The owner: "give everything a physical size number too ... give each person's inventory a
 * fixed size (if no storage ring) and storage rings increase that size". The capacity side was
 * built (`whatABodyCanCarry`, `WHAT_A_RING_HOLDS`) and the load side counted the pouch only, so
 * a sword, a spare robe or a stolen token took no room at all. Every object row already carries
 * a volume and a weight (`makeObject` defaults them), so this adds them in.
 *
 * What is WORN or HELD takes no room in the inventory and still weighs: robes on your back, a
 * drawn blade and a thing too big for the pouch are not in the pouch, and the body still carries
 * them. A thing that stands where it was made, or is moored, is carried by nobody.
 */

import type { HowMuchRoomItTakes } from './what-a-body-can-carry-and-what-a-ring-holds.js';
import { isHeld, isWorn, WHAT_TWO_HANDS_HOLD, type ObjectRecord } from './possessions.js';
import { isAVehicle } from './a-vehicle.js';

/** The kinds that are never on anybody, whoever the row names. */
const NEVER_CARRIED_KINDS = new Set(['formation', 'territory']);

/** What the things this person holds take up, worn ones by weight only. */
export function whatTheirThingsTake(objects: readonly ObjectRecord[], personId: string): HowMuchRoomItTakes {
    let volume = 0;
    let weight = 0;
    for (const object of objects) {
        if (object.possessorId !== personId) continue;
        if (NEVER_CARRIED_KINDS.has(object.kind) || object.tags.includes('never-carried')) continue;
        // A vehicle is ridden and loaded, not carried, even one taken into their hands.
        if (isAVehicle(object)) continue;
        weight += object.weight;
        if (!isWorn(object) && !isHeld(object)) volume += object.volume;
    }
    return { volume: Math.round(volume * 100) / 100, weight: Math.round(weight * 100) / 100 };
}

/** Two loads, added. */
export function together(a: HowMuchRoomItTakes, b: HowMuchRoomItTakes): HowMuchRoomItTakes {
    return {
        volume: Math.round((a.volume + b.volume) * 100) / 100,
        weight: Math.round((a.weight + b.weight) * 100) / 100
    };
}

/**
 * Where one more thing goes: the inventory if there is room, held if there is not and a hand is
 * free, and nowhere if the body cannot take its weight or both hands are full.
 */
export function whereItWouldGo(
    already: HowMuchRoomItTakes,
    thing: Pick<ObjectRecord, 'volume' | 'weight'>,
    capacity: HowMuchRoomItTakes,
    heldAlready: number
): 'inventory' | 'held' | 'too_heavy' | 'hands_full' {
    if (already.weight + thing.weight > capacity.weight) return 'too_heavy';
    if (already.volume + thing.volume <= capacity.volume) return 'inventory';
    return heldAlready < WHAT_TWO_HANDS_HOLD ? 'held' : 'hands_full';
}

/** How many things this person is holding. */
export function howManyHeld(objects: readonly ObjectRecord[], personId: string): number {
    return objects.filter(object => object.possessorId === personId && isHeld(object)).length;
}
