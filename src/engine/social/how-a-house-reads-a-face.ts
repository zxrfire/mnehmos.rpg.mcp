/**
 * How a house's people read a face, on the trust model's axes.
 *
 * `docs/world/houses/trust.md`: being believed is read on independent axes and
 * never collapsed into one number. This is the one reading of a face, asked of
 * one person of the house at a time, and it answers two questions that are the
 * same axes read from opposite ends:
 *
 *   a lecture hall   does a stranger in the room stand out?
 *                    `a-teacher-giving-you-their-attention.ts`
 *   a gate           does the guard place this face as one of the house?
 *                    `standing-at-the-gate-of-a-house.ts`
 *
 * Moved here from `a-teacher-giving-you-their-attention.ts` when the gate needed
 * it, so the two cannot come to read faces differently. Pure.
 */

import { rankName } from '../cultivation/realms.js';
import { howManyPeopleAHouseHas } from '../world/how-many-people-a-house-has.js';
import { A_ROLL_A_PLAYER_COULD_KNOW } from '../world/a-house-raises-its-own.js';
import type { WorldState } from '../world/world-state.js';
import { noticesThatTheyAreThere } from './presence-recognition.js';
import { whatTheyCanPlaceAbout } from './what-they-can-place-about-you.js';

/**
 * How many people a house really has, which is not how many are on its roll.
 *
 * `a-house-and-who-is-in-it.md`: the roll is who a player could come to know,
 * and a sect has hundreds of outer disciples nobody models. The count is kept
 * by `how-many-people-a-house-has.ts`, seeded from the dormitory and moved by
 * the roll; a house that takes nobody in has no dormitory and no unmodelled
 * hundreds, and for that house the roll IS the house.
 */
export function howManyAHouseReallyHas(
    world: Pick<WorldState, 'locations' | 'npcs'> & { factions?: WorldState['factions'] },
    houseId: string
): number {
    return howManyPeopleAHouseHas(world, houseId);
}

export interface AFaceBeingLookedAt {
    /** Whether the face registers at all, from the witness's rung. */
    registers: boolean;
    /** Whether the witness has dealt with this person and knows who they are. */
    knowsThem: boolean;
    /** Whether they wear this house's robes. */
    inTheRobes: boolean;
    /**
     * Whether they are standing there with a blade out of its sheath.
     *
     * The same KIND of fact as the robes, which is why it sits beside them: a
     * thing a stranger can see without being told, and without asking. The
     * robes are what somebody blends in with; a drawn blade is what no amount
     * of blending survives.
     *
     * Optional so that no existing caller changes. Absent reads as sheathed,
     * which is what everybody in this world is unless they have said otherwise.
     */
    bladeInHand?: boolean;
    /** The rung the witness takes them for, which a concealment can lower. */
    takenForRung: number;
    /** The strongest living person of the house, or null for a house of nobody. */
    strongestOfTheHouse: number | null;
    /** `howManyAHouseReallyHas`. */
    houseSize: number;
    /** Whether the ground is having a bad year. */
    groundUnderDuress: boolean;
}

/** Which axis a reading turned on. The first one a look reaches, in order. */
export type WhatAFaceTurnedOn =
    | 'does_not_register'
    | 'known'
    | 'a_blade_in_the_hand'
    | 'not_in_the_robes'
    | 'above_the_house'
    | 'a_small_house'
    | 'a_bad_year'
    | 'nobody_in_particular';

/**
 * One witness's reading of a face, assembled off the two perception reads every
 * look is made of. The web layer supplies what it holds - the tie and the ledger
 * behind `knowsThem`, the robes, the house, the ground - and nothing else.
 */
export function aFaceAsOneOfTheHouseSeesIt(input: {
    witnessOrdinal: number;
    theirOrdinal: number;
    knowsThem: boolean;
    /** A declared concealment. `whatYouAreNotShowing`, where a sentence said one. */
    keepingItToThemselves: boolean;
    inTheRobes: boolean;
    /** Whether a blade is out of its sheath. Absent reads as sheathed. */
    bladeInHand?: boolean;
    strongestOfTheHouse: number | null;
    houseSize: number;
    groundUnderDuress: boolean;
}): AFaceBeingLookedAt {
    return {
        registers: noticesThatTheyAreThere({
            theirOrdinal: input.theirOrdinal,
            yourOrdinal: input.witnessOrdinal,
            known: input.knowsThem
        }),
        knowsThem: input.knowsThem,
        inTheRobes: input.inTheRobes,
        ...(input.bladeInHand === true ? { bladeInHand: true } : {}),
        takenForRung: whatTheyCanPlaceAbout({
            theirOrdinal: input.theirOrdinal,
            readerOrdinal: input.witnessOrdinal,
            keepingItToThemselves: input.keepingItToThemselves,
            hasDealtWithThemBefore: input.knowsThem
        }).rungTheyAreTakenFor,
        strongestOfTheHouse: input.strongestOfTheHouse,
        houseSize: input.houseSize,
        groundUnderDuress: input.groundUnderDuress
    };
}

/**
 * Whether a stranger's face stands out to one person of the house, and why.
 *
 * Every clause is one of the trust model's axes, kept apart, and they are asked
 * in the order a look reaches them. Nothing here is a chance: the reads it is
 * made of are facts, and a stranger either fits the room or does not.
 *
 *   no register      a face the witness does not register cannot stand out
 *   known            somebody who has dealt with you knows you are not of it
 *   a drawn blade    what no amount of blending in survives
 *   no robes         the house's people dress as the house; a stranger in
 *                    their own clothes is the first thing anybody sees
 *   above the house  a face taken for a rung nobody of the house stands at
 *   a small house    `A_ROLL_A_PLAYER_COULD_KNOW` is how many faces one person
 *                    holds; a house no bigger than that knows all of its own
 *   a bad year       a house in trouble looks twice at every face
 *
 * Past all seven an unfamiliar face in the right robes is ordinary.
 */
export function whetherAFaceIsRemarkable(
    face: AFaceBeingLookedAt
): { remarkable: boolean; because: string; turnedOn: WhatAFaceTurnedOn } {
    if (!face.registers) {
        return {
            remarkable: false, turnedOn: 'does_not_register',
            because: 'the face does not register from where they stand.'
        };
    }
    if (face.knowsThem) {
        return {
            remarkable: true, turnedOn: 'known',
            because: 'they have dealt with you and know you are not of the house.'
        };
    }
    // ── AND A BLADE IN THE HAND, WHICH THE ROBES DO NOT COVER ────────────
    //
    // Above the robes and below a known face, and the order is the whole rule.
    // The owner's ruling about walking into a house you do not belong to turns
    // on blending in; the robes are what somebody blends in WITH, and a sword
    // already drawn is the one thing no amount of blending survives. Somebody
    // the house already knows is still better answered with "they know you",
    // which is why that clause keeps its place above this one.
    //
    // Read off `FLAG_BLADE_IN_HAND`, which the player sets by saying so and
    // clears by saying so. Nothing here decides what a drawn blade is worth -
    // it decides only that it is seen, which is what this whole function is.
    if (face.bladeInHand === true) {
        return {
            remarkable: true, turnedOn: 'a_blade_in_the_hand',
            because: 'you are standing there with a blade out, and nobody of the house is.'
        };
    }
    if (!face.inTheRobes) {
        return {
            remarkable: true, turnedOn: 'not_in_the_robes',
            because: 'you are not in the house\'s robes, and everybody else is.'
        };
    }
    if (face.strongestOfTheHouse !== null && face.takenForRung > face.strongestOfTheHouse) {
        return {
            remarkable: true, turnedOn: 'above_the_house',
            because: `you are taken for ${rankName(face.takenForRung)}, and nobody of the house stands `
                + 'that high.'
        };
    }
    if (face.houseSize <= A_ROLL_A_PLAYER_COULD_KNOW) {
        return {
            remarkable: true, turnedOn: 'a_small_house',
            because: `the house is ${face.houseSize} people, few enough that every face in it is known.`
        };
    }
    if (face.groundUnderDuress) {
        return {
            remarkable: true, turnedOn: 'a_bad_year',
            because: 'the place is having a bad year, and every face is looked at twice.'
        };
    }
    return {
        remarkable: false, turnedOn: 'nobody_in_particular',
        because: `an unfamiliar face in the robes of a house of ${face.houseSize} is nobody in particular.`
    };
}

/**
 * Whether this witness places the face as one they know, from the same reading.
 *
 * THE OTHER END OF THE SAME AXES. The two that make a stranger stand out are the
 * two that let one of the house be recognised: somebody who has dealt with you
 * knows who you are, and a house small enough that every face in it is known
 * knows yours. Both are asked only past the robes, so an unrobed face is placed
 * by nobody. `nobody in particular` - an unfamiliar face in the robes of a big
 * house - is exactly the face a gate cannot place, and it asks for a token.
 *
 * WHETHER THE FACE IS THE HOUSE'S is the caller's half, because the same reading
 * means opposite things about a stranger: somebody who knows a stranger knows
 * they are not of the house.
 */
export function theyKnowTheFace(face: AFaceBeingLookedAt): { known: boolean; because: string } {
    if (!face.inTheRobes) {
        return { known: false, because: 'you are not in the house\'s robes.' };
    }
    const read = whetherAFaceIsRemarkable(face);
    if (read.turnedOn === 'known') {
        return { known: true, because: 'they have dealt with you and know your face.' };
    }
    if (read.turnedOn === 'a_small_house') {
        return {
            known: true,
            because: `the house is ${face.houseSize} people, few enough that every face in it is known.`
        };
    }
    return { known: false, because: read.because };
}
