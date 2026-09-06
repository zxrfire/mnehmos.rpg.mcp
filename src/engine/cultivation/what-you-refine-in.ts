/**
 * WHAT YOU REFINE IN.
 *
 * The design owner: *"cauldrons are items too, with crappy ones counted and
 * good ones tracked"*, and *"give them to sects (in their treasury, can be
 * borrowed) and people (owned in their own right)."*
 *
 * `recipes.ts` has named cauldron quality as an input to a refinement since the
 * file was written - *"`baseSuccessRate` is the floor the engine starts from
 * before alchemy skill, cauldron quality, spirit root and ambient qi are
 * applied"* - and there was no cauldron. Every alchemist in the world was
 * working out of the same nothing, and the difference between a hall with a
 * six-hundred-year furnace in it and a disciple with a clay pot was not a
 * difference the engine could state.
 *
 * ── COUNTED AND TRACKED, WHICH IS ALREADY THE LINE ───────────────────────
 *
 * `possessions.ts` draws it once for everything: `mundane` is a holder and a
 * number, and anything above it is a row with a history. A cauldron falls on
 * that line exactly where the owner put it. A mortal-grade cauldron is a fired
 * clay pot; you buy another one, and asking whose it was is not a question.
 * Anything above it was made by somebody, for somebody, and both of those are
 * answerable - which is what `tracked` MEANS here and why it is not a separate
 * mechanism invented for cauldrons.
 *
 * ── AND WHOSE IT IS, WHICH IS NOT A CAULDRON QUESTION ────────────────────
 *
 * *"Give them to sects (in their treasury, can be borrowed) and people (owned
 * in their own right)"*, then: *"a sect may be given too - that's the
 * distinction between the sect treasury and a personal item (perhaps bestowed
 * by the sect). This isn't bespoke. This is true for everything in the sect
 * treasury."*
 *
 * So none of it lives here. A lent furnace, a lent manual and a lent sword are
 * one fact with three nouns in front of it, and it is stated once, over any
 * object at all, in `a-house-holds-its-own.ts`. What this file owns is what a
 * cauldron is WORTH; who is allowed to be holding it is the treasury's
 * business.
 *
 * ── AND A CAULDRON IS A TREASURE, NOT ONLY A TOOL ────────────────────────
 *
 * The design owner: *"cauldrons can be used to defend in battle, basically a
 * spirit ship type thing too. Duh."*
 *
 * Duh, and the first cut had `power: null` on every furnace in the world -
 * which is `possessions.ts` saying, in the field whose whole job is to say it,
 * that the thing is worth nothing in a fight. That is wrong about the genre and
 * wrong about the object: a cauldron is a sealed vessel of graded material that
 * somebody's qi already runs through, which is the same sentence as a defensive
 * treasure. It gets thrown up overhead, people get shut inside one, and the
 * good ones are named and fought over.
 *
 * So it carries `power` on the ordinal ladder like anything else that matters
 * in a fight, off the one thing that decides everything else about it - its
 * grade. Defensive rather than offensive is not a second field: a cauldron with
 * a `defensive` tag is read by the same code that reads a ward with one, which
 * is why `seedHouseWards` and this agree about what a stance is.
 *
 * ── AND THE LID APPLIES HERE TOO ─────────────────────────────────────────
 *
 * The owner, on immortal and chaos: *"immortal needs to be worked on by
 * immortals and sent down, for everything of that grade"*, *"and found in
 * ruins"*, *"chaos is the same."* A cauldron is of that grade too. Nothing
 * below the Lid makes one, and the ones down here came down or came out of
 * something sealed - which `madeBelowTheLid` already decides, off the same
 * table that decides it for medicine.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { howMuchAGradeIsWorthTracking, type KeptAs } from '../world/possessions.js';
import { madeBelowTheLid, refiningOrdinalFor } from './who-can-refine-a-grade-of-medicine.js';

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
 * The best a cauldron can ever be worth, held where it is checkable.
 *
 * Equal to the top of the table on purpose: a reader who wants to know the
 * ceiling should not have to scan a record for the largest number in it.
 */
export const WHAT_THE_BEST_CAULDRON_ADDS = 0.18;

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
    return realmOrdinal >= refiningOrdinalFor(grade) ? WHAT_A_CAULDRON_ADDS[grade] : 0;
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

/** Whether a cauldron of this grade is one anybody down here could have made. */
export function couldBeMadeHere(grade: TechniqueGrade): boolean {
    return madeBelowTheLid(grade);
}

/** The counted/tracked answer, for callers that only want the one word. */
export function howACauldronIsKept(grade: TechniqueGrade): KeptAs {
    return howMuchACauldronIsWorthTracking(grade) === 'mundane' ? 'counted' : 'tracked';
}
