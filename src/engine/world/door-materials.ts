/**
 * What the door somebody shuts on a sealed seclusion is made of, and the rung it stands at.
 *
 * Somebody who comes for a sealed cultivator breaks the door when their strength
 * reaches the rung it stands at, and is stopped by it otherwise - `canUnmake`,
 * the engine's one rule for force put through a rated thing
 * (`src/engine/encounters/at-a-sealed-door.ts`). The rung is on the one ladder,
 * the same ladder a person, a beast part and a ward stand on. This is the
 * material only: somebody working at a ward over time is
 * `how-far-gone-a-formation-is.ts`, a different act.
 *
 * WHOSE DOOR IT IS DECIDES WHAT IT CAN BECOME:
 *
 *   an inn's       the inn's planks, fixed. Not the sitter's to improve.
 *   a house's      the room the house gives at the sitter's rank
 *                  (`the-room-a-house-gives-you.ts`). A residence is better
 *                  than a dormitory and a deeper precinct better than an outer
 *                  one, so promotion is how this door gets stronger.
 *   the sitter's   a cave, a residence, or ground no house holds. It starts as a
 *                  slab across the way in and can be reinforced with spirit-beast
 *                  parts, and the result is a record on the PLACE, never a flag
 *                  on the person: whoever shuts that door next shuts the same one.
 *
 * A door is not a hall. `WHAT_ORDINARY_MATERIALS_STAND_AT` in
 * `what-a-house-is-made-of-and-what-brings-it-down.ts` is what it takes to bring
 * a building down; putting a shoulder through one door of it is a lesser thing,
 * which is why every row below stands well under it.
 */

import { whatImperfectMasteryCosts } from './a-formation-stands-at-the-lower-of-the-art-and-the-builder.js';
import type { LocationRecord } from './locations.js';
import type { RoomPurpose } from './architecture.js';

/** Whose door it is, which decides whether the sitter can do anything about it. */
export type WhoseDoor = 'the_inn' | 'the_house' | 'yours';

export type DoorMaterial =
    | 'inn_planks'
    | 'dormitory_door'
    | 'residence_door'
    | 'stone_slab'
    | 'beast_reinforced';

export interface DoorMaterialRow {
    /** How the door is referred to in a sentence. */
    readonly name: string;
    /** The rung it stands at. Somebody must reach it to break it. */
    readonly standsAt: number;
}

/**
 * The materials and the rungs they stand at.
 *
 * Read against the bottom of the ladder, where these matter: Qi Condensation runs
 * 0 to 12 and Foundation opens at 13. An inn door stops a passer-by and nobody
 * who has cultivated for long; a house residence stops most of Qi Condensation;
 * a slab across a cave mouth sits between the two. A beast-reinforced row has no
 * fixed figure - its rung is whatever the reinforcing made it, stored on the place.
 */
export const DOOR_MATERIALS: Readonly<Record<DoorMaterial, DoorMaterialRow>> = Object.freeze({
    inn_planks: { name: 'the plank door of an inn room', standsAt: 2 },
    dormitory_door: { name: 'the door of a shared dormitory', standsAt: 5 },
    residence_door: { name: 'the door of a residence', standsAt: 9 },
    stone_slab: { name: 'the stone slab across the way in', standsAt: 6 },
    beast_reinforced: { name: 'the door reinforced with beast parts', standsAt: 6 }
});

/**
 * Rungs a house room's door gains for each precinct it sits behind.
 *
 * A deeper precinct is a higher rank's room, cut and kept better; two rungs a
 * precinct puts the innermost residence of a seven-rung house near Foundation.
 */
export const A_PRECINCT_OF_DOOR = 2;

/** The door, as the rest of the engine reads it. */
export interface TheDoor {
    readonly material: DoorMaterial;
    readonly name: string;
    readonly standsAt: number;
    readonly whose: WhoseDoor;
}

/** An inn's door: fixed, and not the sitter's. */
export function anInnDoor(): TheDoor {
    const row = DOOR_MATERIALS.inn_planks;
    return { material: 'inn_planks', name: row.name, standsAt: row.standsAt, whose: 'the_inn' };
}

/** The door of the room a house gives at this rung. */
export function aHouseRoomDoor(room: { purpose: RoomPurpose; precinctIndex: number }): TheDoor {
    const material: DoorMaterial = room.purpose === 'residence' ? 'residence_door' : 'dormitory_door';
    const row = DOOR_MATERIALS[material];
    return {
        material,
        name: row.name,
        standsAt: row.standsAt + Math.max(0, room.precinctIndex) * A_PRECINCT_OF_DOOR,
        whose: 'the_house'
    };
}

/**
 * What a reinforced door carries on its place's record, as flat keys on
 * `LocationRecord.data`: the rung it stands at, the catalog id of the part it
 * was last reinforced with, and the world day.
 */
export interface ADoorOnRecord {
    doorStandsAt: number;
    doorReinforcedWith: string;
    doorReinforcedOnDay: number;
}

/** The door recorded on this place, or null where nobody has reinforced one. */
export function theDoorOnRecord(location: LocationRecord | null): ADoorOnRecord | null {
    const data = location?.data ?? {};
    const standsAt = data.doorStandsAt;
    if (typeof standsAt !== 'number' || !Number.isFinite(standsAt)) return null;
    return {
        doorStandsAt: standsAt,
        doorReinforcedWith: typeof data.doorReinforcedWith === 'string' ? data.doorReinforcedWith : '',
        doorReinforcedOnDay: typeof data.doorReinforcedOnDay === 'number' ? data.doorReinforcedOnDay : 0
    };
}

/** The sitter's own door: whatever is on the place's record, or a bare slab. */
export function yourOwnDoor(location: LocationRecord | null): TheDoor {
    const recorded = theDoorOnRecord(location);
    if (recorded) {
        return {
            material: 'beast_reinforced',
            name: DOOR_MATERIALS.beast_reinforced.name,
            standsAt: recorded.doorStandsAt,
            whose: 'yours'
        };
    }
    const row = DOOR_MATERIALS.stone_slab;
    return { material: 'stone_slab', name: row.name, standsAt: row.standsAt, whose: 'yours' };
}

export interface AReinforcedDoor {
    /** The rung the door stands at afterwards. */
    standsAt: number;
    /** Rungs gained. At least one whenever {@link whatThePartCouldMakeOfIt} beat the door. */
    gained: number;
    /** The lower of the part and the hand, before the work cost anything. */
    theLowerOfTheTwo: number;
    limitedBy: 'the part' | 'the hands';
    rungsTheWorkCost: number;
}

/**
 * The most this part could make of a door in these hands: the lower of the part's
 * rung and the hand's, which is the rule a formation already keeps
 * (`whereAFormationStands`). A part stronger than the person working it is
 * worked at the person's rung, and a hand stronger than the part cannot put in
 * what the part does not hold.
 */
export function whatThePartCouldMakeOfIt(partRung: number, handRung: number): number {
    return Math.max(0, Math.min(Math.floor(partRung), Math.floor(handRung)));
}

/**
 * Reinforce a door with one beast part, worked by the sitter's own hands.
 *
 * Every sitter is an artisan and the result differs: `mastery` is how well this
 * piece of work went, a seeded draw the caller takes, and imperfect work costs
 * rungs off the lower of the two exactly as an imperfectly held formation does
 * (`whatImperfectMasteryCosts`). The work always uses the part and always
 * strengthens the door - poorer work only gains less - so the caller refuses
 * BEFORE spending anything when the part could not beat the door at all.
 */
export function aDoorReinforcedWith(input: {
    doorStandsAt: number;
    partRung: number;
    handRung: number;
    /** 0..1, how well it went. */
    mastery: number;
}): AReinforcedDoor {
    const lower = whatThePartCouldMakeOfIt(input.partRung, input.handRung);
    const cost = whatImperfectMasteryCosts({ lowerOfTheTwo: lower, mastery: input.mastery });
    const worked = Math.max(0, lower - cost);
    const standsAt = lower > input.doorStandsAt
        ? Math.max(input.doorStandsAt + 1, worked)
        : input.doorStandsAt;
    return {
        standsAt,
        gained: standsAt - input.doorStandsAt,
        theLowerOfTheTwo: lower,
        limitedBy: input.partRung <= input.handRung ? 'the part' : 'the hands',
        rungsTheWorkCost: Math.max(0, lower - standsAt)
    };
}
