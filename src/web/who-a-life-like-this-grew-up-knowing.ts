/**
 * THE PEOPLE A CULTIVATOR ALREADY KNOWS ON THE DAY THE RUN OPENS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A new run knew nine to fourteen PLACES and not one PERSON. Measured on three
 * seeds, with thirteen, five and seventeen people standing in the square:
 *
 *     known 9:   place x 8, sect x 1     cultivator: 0
 *     known 14:  place x 13, sect x 1    cultivator: 0
 *     known 9:   place x 8, sect x 1     cultivator: 0
 *
 * `company()` splits a square into `named` - people the holder has a record
 * for - and `strangers`, who are reported as an ordinal and nothing else. With
 * no person on the roll at birth, every single body in the world was a
 * stranger, permanently, until something happened to introduce one. So the
 * verbs that need somebody to be pointed at - a bout, a favour asked, a bribe,
 * a threat - all resolved and none of them could find a target, and the game
 * said so in the best line in it:
 *
 *     "You have no name to ask for, which is the whole of what is stopping you."
 *
 * Four working verbs behind one missing thing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "you aren't dropped as a nobody, you have presumably grown up in the area
 *   you are in. you at least know SOMETHING to start. some names, some local
 *   areas, at a minimum."
 *
 * The blank slate was never neutrality. It was a person with no past, which is
 * a thing the rest of this setting does not otherwise permit: everybody in the
 * world has a birth, a place, a history and ties, and the player alone arrived
 * from nowhere at twenty with no one who had ever said their name.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It does not weaken the gate. `docs/world/discovery.md` is intact and so is
 * the refusal that enforces it - a name nobody has said in front of you is
 * still a name you cannot use. What changes is only WHICH names have been said,
 * and the answer is the one the fiction already implies: the people on the road
 * you grew up on.
 *
 * Three properties keep it honest.
 *
 *   ORDINARY PEOPLE, NEAR YOUR OWN HEIGHT. Candidates are world NPCs standing
 *   at the birthplace, and a childhood does not put a farm child in a room with
 *   somebody twenty rungs up. `A_CHILDHOOD_REACHES` is the ceiling on the gap,
 *   and it is the only thing an origin buys here.
 *
 *   IT SCALES WITH ORIGIN, AND BUYS INPUTS RATHER THAN RANK. `origin.md`'s own
 *   rule. A better birth knows MORE PEOPLE and knows people who stand HIGHER,
 *   which is exactly the advantage that makes surviving the climb likelier and
 *   is not a rung on anything.
 *
 *   NOTHING IS GRANTED BUT ACQUAINTANCE. No standing, no favour owed, no
 *   membership and no relationship row. These are knowledge records at the
 *   stance somebody has for a face they have known since before either of them
 *   was anybody, and everything past that - whether the person will do anything
 *   for you - is the social layer's to decide, on the day you ask.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import { getOrigin, type OriginTierKey } from '../engine/cultivation/origin.js';
import { isBelowTheLid } from '../engine/world/layers.js';
import { npcsAt, type WorldState } from '../engine/world/world-state.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { worldLocationFor } from './entities.js';

/**
 * How many faces a childhood in each band leaves behind.
 *
 * Banded on `placement.reach`, which is the one number the origin table already
 * uses for how far a family's word carries. A farm knows three people worth
 * naming; a house's child grew up being introduced to everybody who came
 * through, which is most of the advantage of being one.
 *
 * The floor is deliberately not zero. The ruling is "at a minimum, some names",
 * and a run that opens with nobody is the state this module exists to end.
 */
export const FACES_A_CHILDHOOD_LEAVES: readonly { reach: number; faces: number }[] = [
    { reach: 0, faces: 3 },
    { reach: 12, faces: 4 },
    { reach: 20, faces: 5 },
    { reach: 29, faces: 6 },
    { reach: 38, faces: 8 }
];

/**
 * How far above a child a childhood acquaintance can stand.
 *
 * The gap, in rungs, between the player at ordinal 0 and the tallest person
 * they could plausibly have grown up around. A farm child knows the carter and
 * the man who mends the wall; they did not grow up being spoken to by anybody
 * at Foundation Establishment, and a seeder that handed them one would be
 * handing over an introduction that is supposed to cost something.
 *
 * This is the whole of what a good birth buys in this module, and it is the
 * setting's own thesis rather than an exception to it: an origin buys inputs
 * and never rank. Knowing somebody higher up is an input. It is not a rung, it
 * confers no admission, and the person may still refuse you.
 */
export const A_CHILDHOOD_REACHES: readonly { reach: number; rungs: number }[] = [
    { reach: 0, rungs: 6 },
    { reach: 12, rungs: 10 },
    { reach: 20, rungs: 14 },
    { reach: 29, rungs: 20 },
    { reach: 38, rungs: 26 }
];

/**
 * How somebody comes to have been a fixture since before anybody was anybody.
 *
 * Provenance for the record, in the same register as every other `sourceNote`
 * in the knowledge table. Deliberately says nothing about family structure,
 * obligation or affection - the engine models none of those, and a note that
 * asserted one would be the prose layer inventing a system.
 */
const HOW_YOU_KNOW_THEM: readonly string[] = [
    'Grew up on the same road.',
    'Has been at the far end of that street since before either of them was anybody.',
    'Worked the same ground in the same seasons.',
    'One of the faces that was always at the well.',
    'Known by sight and by name since childhood, and by nothing else.',
    'The two families have been in each other\'s way for as long as either remembers.'
];

/** One person a life like this starts already able to name. */
export interface FaceFromHome {
    id: string;
    name: string;
    /** Their standing, for the caller that wants to report the band. */
    realmOrdinal: number;
    sourceNote: string;
    statement: string;
}

export interface HomeFacesInput {
    world: WorldState;
    cultivator: Cultivator;
    /** The birth tier. Falls back to the thinnest, which grants the least. */
    origin: OriginTierKey;
    /** The run seed. The draw must be reproducible from it like everything else. */
    seed: string;
}

/**
 * Who this cultivator grew up around, drawn off the live world.
 *
 * The candidates are real rows standing in a real place, so every name this
 * hands back resolves through `resolveCultivator` the moment the player types
 * it - which is the point. A seeded list of catalog notables would have given
 * them names they could say and nobody they could reach.
 *
 * Empty is a legitimate answer and happens: a birthplace the world has no
 * location for, or a hamlet with nobody in it but the player.
 */
export function facesFromHome(input: HomeFacesInput): FaceFromHome[] {
    const { world, cultivator, origin, seed } = input;

    const here = worldLocationFor(world, cultivator.location);
    if (!here) return [];

    const reach = getOrigin(origin).placement.reach;
    const wanted = bandFor(FACES_A_CHILDHOOD_LEAVES, reach, f => f.faces);
    const rungs = bandFor(A_CHILDHOOD_REACHES, reach, r => r.rungs);

    const candidates = npcsAt(world, here.id)
        .filter(npc => npc.id !== cultivator.id)
        .filter(npc => npc.status === 'alive' && isBelowTheLid(npc))
        .filter(npc => npc.cultivation.realmOrdinal - cultivator.realmOrdinal <= rungs)
        // Nearest in standing first, then by id. The neighbour before the
        // notable: somebody far above you was not in your kitchen, and if the
        // ceiling above lets one through they are still the last one picked.
        .sort((a, b) =>
            Math.abs(a.cultivation.realmOrdinal - cultivator.realmOrdinal)
            - Math.abs(b.cultivation.realmOrdinal - cultivator.realmOrdinal)
            || (a.id < b.id ? -1 : 1));

    const rng = forStream(seed, 'childhood', here.id);
    return candidates.slice(0, wanted).map(npc => toFace(npc, rng.int(0, HOW_YOU_KNOW_THEM.length - 1)));
}

function toFace(npc: NpcRecord, at: number): FaceFromHome {
    return {
        id: npc.id,
        name: npc.name,
        realmOrdinal: npc.cultivation.realmOrdinal,
        sourceNote: HOW_YOU_KNOW_THEM[at],
        // What the holder ends up carrying. A face and a name, and the explicit
        // statement that it is nothing more than that - because it is not, and
        // a record that implied otherwise would be granting a favour nobody has
        // asked for yet.
        statement:
            `${npc.name} is from home. Knowing them is not the same as being owed anything by them.`
    };
}

/** The highest band this reach qualifies for. */
function bandFor<T extends { reach: number }>(
    table: readonly T[],
    reach: number,
    read: (row: T) => number
): number {
    let out = read(table[0]);
    for (const row of table) {
        if (reach >= row.reach) out = read(row);
    }
    return out;
}
