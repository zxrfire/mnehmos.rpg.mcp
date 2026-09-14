/**
 * The lid on a beast's climb is mortality, and there is no other one.
 *
 * `a-beast-climbs-by-sitting-where-it-is.ts` moves a tracked row up the ladder
 * over world time, and at a long horizon a hawk found at 17 reads as 35. Asked
 * whether to cap that, the design owner ruled the opposite: the same lid every
 * NPC has. One of these fights, and one of these dies, and what follows from a
 * death is what follows from anybody's.
 *
 * So there is no ceiling constant here and there must not be one. What is here
 * is the three things a death produces that a person's death does not:
 *
 *   THE BODY IS THE MATERIAL. A cultivator leaves what was in their pouch and
 *   `settleEstate` moves it. A beast's pouch is empty by construction and what
 *   it leaves is itself, so {@link whatABodyStillHasOnIt} reads the harvest
 *   table with nobody cutting - everything is still on it, because nothing has
 *   been off it.
 *
 *   AND IT LIES WHERE IT FELL. `possessorId: null, ownerId: null, locationId`
 *   is what `whatIsStandingFreeAt` already looks for, so a core on the ground
 *   is reachable by the taking verb with no new read anywhere. Only the tracked
 *   half gets a row: pelts and sinew are an amount, and an amount lying in open
 *   country is what scavengers are.
 *
 *   AND A KILL IS A MEAL. When what ended it was another of these, it climbs
 *   for it - {@link WHAT_A_MEAL_IS_WORTH}. That sticks without being stored
 *   twice, because `theRungThisRowShouldBeAt` takes the higher of where a row
 *   already stands and what sitting would have given it, so a rung reached by
 *   eating is never read back down.
 *
 * WHO WINS IS NOT DECIDED HERE and there is no beast branch anywhere in it.
 * `notFinishedChance` and `lostChance` price a gap for a house's party already,
 * and the same two functions price this one - see
 * `oneOfTheseFoughtOnItsOwnGround` in `the-world-changing-on-its-own.ts`, which
 * is where the world does the writing, on the review that already walks these
 * rows rather than on the weighted event table.
 */

import type { Beast, BeastMaterial } from '../../data/cultivation/beasts.js';
import { materialsOf } from '../../data/cultivation/beasts.js';
import { rankName } from '../cultivation/realms.js';
import {
    gradeOfWhatItYielded,
    howAMaterialIsStored,
    significanceOf
} from './hunting-a-spirit-beast.js';
import { makeObject, transferPossession, type ObjectRecord } from './possessions.js';
import type { AreaStatusInput } from './what-is-true-of-a-place-right-now.js';

/** Rungs the thing that ate one gains. A kill is a meal and a meal is advancement. */
export const WHAT_A_MEAL_IS_WORTH = 1;

/**
 * What is still on a body nobody has cut.
 *
 * Everything, which is the difference between this and `whatComesOffTheBody`:
 * that function asks what a particular person standing over it can get off it,
 * and nobody is standing over this one.
 */
export function whatABodyStillHasOnIt(species: Beast): readonly BeastMaterial[] {
    return materialsOf(species.id);
}

/** The id of one piece of an unclaimed body. Derived, so nothing mints twice. */
export function idOfAPieceOfTheBody(npcId: string, materialId: string): string {
    return `obj-body-${npcId}-${materialId}`;
}

/**
 * A piece of a body lying where the body fell.
 *
 * `how: 'lost'` with no holder is the link `estate-at-death.ts` already writes
 * for a thing nobody was there to pick up, and the same link read from the
 * other end is what makes this findable rather than owned.
 */
export function aPieceOfABodyNobodyHasTaken(init: {
    npcId: string;
    material: BeastMaterial;
    /** The species read at the rung the individual actually died on. */
    asItStands: Beast;
    /** What it was called. A row past the change died under a person's name. */
    itsName: string;
    locationId: string;
    placeName: string;
    onDay: number;
    /** What ended it, in the engine's words. Goes on the chain. */
    endedBy: string;
}): ObjectRecord {
    const { material, asItStands } = init;
    const grade = gradeOfWhatItYielded(asItStands.ordinal);
    const blank = makeObject({
        id: idOfAPieceOfTheBody(init.npcId, material.id),
        name: material.name,
        kind: 'material',
        significance: significanceOf(material),
        description: material.description,
        power: null,
        locationId: init.locationId,
        tags: [
            'beast_material',
            'off_a_body_nobody_claimed',
            `grade:${grade}`,
            `source:${asItStands.id}`,
            ...(material.core ? ['core'] : [])
        ],
        data: {
            materialId: material.id,
            beastId: asItStands.id,
            beastOrdinal: asItStands.ordinal,
            grade,
            value: material.value,
            core: material.core,
            fromNpcId: init.npcId
        }
    });
    const left = transferPossession(blank, {
        onDay: init.onDay,
        toHolderId: null,
        toHolderName: '',
        how: 'lost',
        source: `Off ${init.itsName} at ${rankName(asItStands.ordinal)}, at ${init.placeName}`,
        note: `${init.endedBy} Nobody was there to go through what was left, so it is `
            + 'lying where it fell and belongs to whoever walks up to it.'
    });
    return { ...left, locationId: init.locationId };
}

/** Only the half worth a row. The rest is an amount, and scavengers are the rest. */
export function whatIsWorthARowOffABody(species: Beast): readonly BeastMaterial[] {
    return whatABodyStillHasOnIt(species).filter(m => howAMaterialIsStored(m) === 'tracked');
}

/**
 * How long a body is a thing about the ground rather than a thing that was.
 *
 * A season. Long enough that somebody who hears about it can walk there, short
 * enough that the status lifts itself on `reviewOnDay` and nothing sweeps it.
 */
export const DAYS_A_BODY_IS_STILL_THERE = 90;

/**
 * What the ground says while a large dead thing is lying on it.
 *
 * `signs` and nothing else is what somebody standing there perceives. What
 * killed it is on the fact, not here: a person walking up reads carrion birds
 * and a smell, works out the rest or does not, and `causeKnownLocally` says
 * which.
 */
export function theGroundHasABodyOnIt(init: {
    npcId: string;
    areaId: string;
    itsName: string;
    ordinal: number;
    onDay: number;
    cause: string;
    factId: string | null;
    endedById: string | null;
    causeKnownLocally: boolean;
}): AreaStatusInput {
    return {
        id: `status-body-${init.npcId}`,
        areaId: init.areaId,
        kind: 'a_body_on_the_ground',
        statement: `${init.itsName} is dead on this ground, at `
            + `${rankName(init.ordinal)}, and nobody has cut it.`,
        cause: {
            what: init.cause,
            decidedById: init.endedById,
            factId: init.factId
        },
        signs: [
            'Birds over one place for days, and none of them settling.',
            'The ordinary animals have gone out and not come back.'
        ],
        causeKnownLocally: init.causeKnownLocally,
        beganOnDay: init.onDay,
        reviewOnDay: init.onDay + DAYS_A_BODY_IS_STILL_THERE,
        // What comes to eat it is what makes the ground worse while it is here.
        dangerDelta: 0.1
    };
}
