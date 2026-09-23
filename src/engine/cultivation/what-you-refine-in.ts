/**
 * WHAT YOU REFINE IN.
 *
 * `recipes.ts` named cauldron quality as an input to a refinement from the day
 * it was written, and there was no cauldron. Every alchemist in the world
 * worked out of the same nothing, and a hall with a six-hundred-year furnace
 * could not be told from a disciple with a clay pot.
 *
 * WHAT IS HERE AND WHAT IS NOT. This file owns what a cauldron is WORTH. Who is
 * allowed to be holding one is `a-house-holds-its-own.ts` - a lent furnace, a
 * lent manual and a lent sword are one fact with three nouns in front of it,
 * and the ruling is that none of it is bespoke to cauldrons.
 *
 * Counted or tracked is `possessions.ts`, unchanged: a mortal-grade pot is one
 * you buy again, and anything above it was made by somebody for somebody and
 * both are answerable.
 *
 * AND IT IS A TREASURE, NOT ONLY A TOOL. The first cut gave every furnace
 * `power: null`, which is the engine saying it is worth nothing in a fight. A
 * cauldron is a sealed vessel of graded material with somebody's qi already
 * running through it; they get thrown up overhead, people get shut inside them,
 * and the good ones are fought over. `defensive` is a tag the ward code already
 * reads, so nothing new says what a stance is.
 *
 * Immortal and chaos grades are sent down rather than made, which
 * `madeBelowTheLid` already decides off the same table it decides for medicine.
 *
 * ── ONE VESSEL, OF A KIND ────────────────────────────────────────────────
 *
 * The design owner: *"we have cauldrons, what's the artifact crafting
 * equivalent?"* The genre's answer is the artifact refining furnace, a forge fed
 * by earth fire. It is the same thing as a cauldron in every respect this file
 * decides - a graded vessel, worth what its grade is worth, answering only a
 * hand at that grade's rung, counted or tracked by the one rule - so it is the
 * same model with the kind as data ({@link REFINING_VESSELS}) and not a second
 * copy of this file. The cauldron names below stay, and read the table.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import type { RoomPurpose, WhatIsBeingMade } from '../world/architecture.js';
import { howMuchAGradeIsWorthTracking } from '../world/possessions.js';
import { refiningOrdinalFor } from './who-can-refine-a-grade-of-medicine.js';

/** The kinds of vessel a thing is refined in. */
export type RefiningVesselKind = 'cauldron' | 'refining_furnace';

/** What a kind of vessel is, as data. */
export interface ARefiningVessel {
    kind: RefiningVesselKind;
    makes: WhatIsBeingMade;
    /** Its plain name, for a house's cupboard of the cheap ones. */
    plainName: string;
    /** The tag a row carries, which is what the treasury and a lending read. */
    tag: string;
    /** The room it is kept and worked in. */
    keptIn: RoomPurpose;
}

/**
 * Every kind of vessel. A third is a row here.
 *
 * The furnace is kept in the Artifact Refining Hall, which every compound has and
 * which `ROOMS_A_THING_IS_MADE_IN` reads a maker of artifacts into; the cauldron in
 * the furnace room, which is where `whereInTheHouseItSits` already puts one.
 */
export const REFINING_VESSELS: Readonly<Record<RefiningVesselKind, ARefiningVessel>> = {
    cauldron: {
        kind: 'cauldron', makes: 'medicine', plainName: 'fired clay cauldrons', tag: 'cauldron', keptIn: 'furnace_room'
    },
    refining_furnace: {
        kind: 'refining_furnace', makes: 'an_artifact', plainName: 'iron artifact furnaces',
        tag: 'refining_furnace', keptIn: 'artifact_refining_hall'
    }
};

/** The vessel a kind of making is done in. */
export function theVesselFor(making: WhatIsBeingMade): ARefiningVessel {
    return Object.values(REFINING_VESSELS).find(vessel => vessel.makes === making)!;
}

/**
 * What a vessel of this kind and grade adds to the work, for this hand.
 *
 * One table for every kind: a vessel of a grade is made of that grade whatever
 * it is for, so what it is worth and the rung it answers to do not change with
 * the noun. See {@link WHAT_A_CAULDRON_ADDS}.
 */
export function whatThisVesselAddsFor(
    _kind: RefiningVesselKind,
    grade: TechniqueGrade,
    realmOrdinal: number
): number {
    return realmOrdinal >= refiningOrdinalFor(grade) ? WHAT_A_CAULDRON_ADDS[grade] : 0;
}

/**
 * How much a cauldron of this grade is worth bookkeeping.
 *
 * A RE-EXPORT AND NOT A RULE. The design owner: *"group pills and manuals
 * together, it's all items"*, *"I don't see why any of them should remain
 * separate"*, *"merge it all into a more general class."* A cauldron does not
 * get its own answer to a question every object in the world is asked - the
 * rule is `howMuchAGradeIsWorthTracking` in `possessions.ts`, over any noun,
 * and this name exists only so a reader following the cauldron thread lands on
 * it rather than reinventing one here.
 */
export const howMuchACauldronIsWorthTracking = howMuchAGradeIsWorthTracking;

/**
 * What a cauldron of this grade adds to a refinement, as a delta on the chance.
 *
 * SMALL, AND SMALLER THAN THE HAND HOLDING IT. A furnace is worth about as much
 * as two rungs of standing above the requirement, which is the honest reading
 * of the genre: a great cauldron in the hands of somebody who cannot work the
 * materials is a great cauldron full of slag. It is worth having and it is not
 * worth more than knowing what you are doing.
 *
 * Nothing is subtracted for the clay pot. Working out of one is the baseline
 * every `baseSuccessRate` in `recipes.ts` was written against, and taxing it
 * would silently reprice the whole table.
 */
export const WHAT_A_CAULDRON_ADDS: Readonly<Record<TechniqueGrade, number>> = {
    mortal: 0,
    earth: 0.06,
    heaven: 0.12,
    immortal: 0.18,
    chaos: 0.18
};

/**
 * A cauldron cannot be worked above the hand holding it either.
 *
 * The same wall as the materials and for the same reason - a cauldron of a
 * grade is made of that grade - so somebody standing below the rung gets
 * nothing from it rather than a bonus they could not have earned. Not a
 * penalty: the furnace simply does not answer.
 */
export function whatThisCauldronAddsFor(
    grade: TechniqueGrade,
    realmOrdinal: number
): number {
    return whatThisVesselAddsFor('cauldron', grade, realmOrdinal);
}

/**
 * What a cauldron of this grade is worth standing behind.
 *
 * On the ordinal ladder, like everything else measured in a fight, and read off
 * the rung its materials answer to: a cauldron is made of its grade, so the
 * rung that decides who can WORK one is the rung it is worth. That is one
 * number doing two jobs on purpose - a furnace nobody in the house can refine
 * in is also a furnace nobody in the house can raise over their head.
 *
 * A SHIELD AND NOT A SWORD. Worth a fraction of the rung rather than the whole
 * of it, because the thing is a pot: it is somewhere to be while something is
 * happening, and standing behind one has never won anybody a fight.
 */
export function whatACauldronIsWorthInAFight(grade: TechniqueGrade): number {
    return Math.round(refiningOrdinalFor(grade) * WHAT_A_POT_IS_WORTH_TO_HIDE_BEHIND);
}

/**
 * How much of its own rung a cauldron is worth in a fight.
 *
 * Under half. Somebody who brings a furnace to a killing is bringing cover, and
 * an engine that rated it at its full rung would be saying a hall's cookware
 * fights like the person who made it.
 */
export const WHAT_A_POT_IS_WORTH_TO_HIDE_BEHIND = 0.4;

