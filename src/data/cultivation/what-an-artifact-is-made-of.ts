/**
 * WHAT AN ARTIFACT IS MADE OF, and whether anybody is holding it.
 *
 * The material economy was authored and unenforced. `whetherTheirHandsCanDoIt`
 * carried the comment "The material gate first" and then asked only whether the
 * maker had the RUNG for the grade; nothing anywhere asked whether a single
 * gram of anything was on the bench. So a Void Tribulation elder could turn out
 * heaven-grade work from an empty room.
 *
 * ── A SLOT IS A PREDICATE, NEVER A LIST OF IDS ───────────────────────────
 *
 * A recipe here is a handful of SLOTS, and a slot says what KIND of thing fills
 * it rather than naming rows. `everyIngredientThatIs` resolves it against the
 * two catalogs at the moment it is asked, so a row regraded, renamed, split or
 * added arrives in every recipe that should have it and in none that should
 * not. A list of ids would be a second copy of the catalogs and would go stale
 * the first time one moved - which is a live risk rather than a hypothetical:
 * a drop's grade follows the rung its source stood at when it died, so the same
 * part of the same species exists at two grades and the set behind a slot moves
 * on its own.
 *
 * The only two axes both catalogs carry are GRADE and whether the thing was
 * GROWN or TAKEN OFF SOMETHING. That is enough, and nothing here invents a
 * third: there is no element on a herb and no element on a beast material, so a
 * fire slot would be a classification this file made up.
 *
 * ── AND THE RECIPE TAKES WHAT IT NAMES ───────────────────────────────────
 *
 * The first cut of this file was a gate and only a gate: it could say a bench
 * was short and nothing anywhere ever took a gram of anything off one. The
 * design owner: *"recipes should take stuff out of your inventory."*
 * `whatTheRecipeSpends` is that, and it is the SAME WALK as the shortfall -
 * `howTheBenchReadsAgainst` does it once and both are reads of the answer - so
 * the gate and the spend cannot come to disagree about which unit fills which
 * slot. `web/taking-the-materials-off-the-bench.ts` is what acts on it.
 *
 * ── AND SUBSTITUTION IS THE WHOLE POINT ──────────────────────────────────
 *
 * Measured against the catalogs as they stand: the thinnest slot in either
 * recipe has ten materials that fill it and the widest has twenty. A recipe
 * that wants six named rare things is a recipe nobody finishes, and it would
 * make the artifact economy poorer rather than richer.
 *
 * ── WHY HEAVEN GRADE ASKS FOR ONE HEAVEN THING AND NOT THREE ─────────────
 *
 * Heaven-grade material comes off something that stood at `BEAST_CHANGE_ORDINAL`
 * or above, which is the rung at which a beast has a shape and a voice and can
 * decline - so taking one is a thing done to a person, and which houses may do
 * it is a fact about their alignment. A recipe that demanded three of them
 * would route every heaven-grade artifact in the world through that act. It
 * demands one, and the slot takes a grown thing as readily as a taken one, so
 * the herb road is open to anybody who will not hunt a person.
 */

import {
    everyIngredientThatIs,
    howYouWouldComeByIt,
    whatAnIngredientIs,
    type WhatTheCauldronIsBeingHanded,
    type WhereAMaterialComesFrom
} from '../../engine/cultivation/what-a-cauldron-will-take.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

/**
 * One place in a recipe, and everything that could stand in it.
 */
export interface ASlot {
    /** What it is for, in the words a refusal says out loud. */
    readonly what: string;
    readonly grade: TechniqueGrade;
    /** Where it has to have come from, or null where either will do. */
    readonly from: WhereAMaterialComesFrom | null;
}

export type Recipe = readonly ASlot[];

/**
 * The grades a recipe exists for.
 *
 * Mortal is off it because a mortal-grade thing is roadside work and the gate
 * would refuse nobody. Immortal and chaos are off it because nothing below the
 * Lid makes one at all - `madeBelowTheLid` decides that and refuses those two
 * before a recipe is ever reached. Written as an `Exclude` rather than a
 * literal union so a sixth grade added to the ladder fails to compile here
 * until somebody has said which side of the line it is on.
 */
export type AWorkedGrade = Exclude<TechniqueGrade, 'mortal' | 'immortal' | 'chaos'>;

// The wording of a slot is held to what the predicate actually says. A serpent
// gland and a stone ox horn are both earth grade off a beast, and calling the
// slot "a body to hold the shape" would be the file claiming a structural
// property neither catalog carries.
const A_BODY: ASlot = {
    what: 'an earth-grade thing off a beast, for the substance of it',
    grade: 'earth',
    from: 'a_beast'
};

const A_TEMPER: ASlot = {
    what: 'an earth-grade thing that grew, to temper it with',
    grade: 'earth',
    from: 'a_growing_thing'
};

const A_CARRIER: ASlot = {
    what: 'a roadside carrier, grown or taken',
    grade: 'mortal',
    from: null
};

const A_HEART: ASlot = {
    what: 'a heaven-grade heart, grown or taken',
    grade: 'heaven',
    from: null
};

/**
 * The recipes. Three slots each, and the two share two of them - earth grade is
 * what heaven grade is built on rather than a separate stock.
 */
export const WHAT_AN_ARTIFACT_IS_MADE_OF: Readonly<Record<AWorkedGrade, Recipe>> = {
    earth: [A_BODY, A_TEMPER, A_CARRIER],
    heaven: [A_HEART, A_BODY, A_TEMPER]
};

/** Whether a grade is one anything is worked out of materials for. */
export function isAWorkedGrade(grade: TechniqueGrade): grade is AWorkedGrade {
    return grade === 'earth' || grade === 'heaven';
}

/**
 * What this grade is made of, or null where the question does not arise.
 */
export function whatItIsMadeOf(grade: TechniqueGrade): Recipe | null {
    return isAWorkedGrade(grade) ? WHAT_AN_ARTIFACT_IS_MADE_OF[grade] : null;
}

/**
 * What closing one hole in a thing of this grade takes: the first slot of the
 * recipe that made it, which is the slot its grade is. Null where the grade
 * has no recipe - mortal work asks for nothing, and immortal and chaos are
 * made nowhere below the Lid. Owner ruling 2026-09-25: mending costs material.
 */
export function whatMendingAHoleTakes(grade: TechniqueGrade): Recipe | null {
    const recipe = whatItIsMadeOf(grade);
    return recipe === null ? null : recipe.slice(0, 1);
}

/** Everything that fills this slot, cheapest first. */
export function whatWouldFill(slot: ASlot): readonly WhatTheCauldronIsBeingHanded[] {
    return everyIngredientThatIs({
        grade: slot.grade,
        ...(slot.from === null ? {} : { from: slot.from })
    });
}

/** Whether this material is one of the things that fills this slot. */
export function fillsTheSlot(slot: ASlot, materialId: string): boolean {
    const row = whatAnIngredientIs(materialId);
    if (row === null) return false;
    if (row.grade !== slot.grade) return false;
    return slot.from === null || row.from === slot.from;
}

export interface ASlotNobodyFilled {
    slot: ASlot;
    /** What would have filled it. Never empty while the catalogs have rows. */
    wouldHaveDone: readonly WhatTheCauldronIsBeingHanded[];
}

/** A slot and the one unit of the haul that goes into it. */
export interface ASlotSomethingFills {
    slot: ASlot;
    materialId: string;
    /**
     * WHICH UNIT, as an index into the haul that was handed in.
     *
     * The id alone is not enough to spend anything by. A haul is one entry per
     * unit, so two Stone Ox Horns are two entries with one id, and they can sit
     * in two different places - one in the asker's pouch, one on the maker's
     * belt. A caller taking the materials off has to know which of the two went
     * in, and an id would make it pick.
     */
    at: number;
}

/**
 * How this haul reads against this recipe: what fills each slot and what fills
 * none.
 *
 * ONE MATERIAL FILLS ONE SLOT. Two of a kind is two of a kind, and a single
 * Stone Ox Horn is not both the body and the temper. The slots of both recipes
 * are disjoint by construction - no two share a grade and a source - and a test
 * holds them to it, because the moment two overlap this greedy pass has to
 * become a matching and would quietly start giving the wrong answer instead.
 *
 * ── ONE PASS, AND THE GATE AND THE SPEND ARE BOTH READS OF IT ────────────
 *
 * The gate ("is anything missing") and the spend ("what comes off the bench")
 * are the same walk, and they used to be one walk and no walk: the gate existed
 * and nothing ever took anything. Writing the spend as a second walk would be
 * the second copy AGENTS.md names - two greedy passes that agree today and
 * disagree the first time a slot's predicate moves, and disagreeing means
 * refusing over a thing you took or taking a thing you refused over.
 */
function howTheBenchReadsAgainst(
    recipe: Recipe | null,
    materialsToHand: readonly string[]
): { filled: readonly ASlotSomethingFills[]; short: readonly ASlotNobodyFilled[] } {
    if (recipe === null) return { filled: [], short: [] };
    const spent = new Set<number>();
    const filled: ASlotSomethingFills[] = [];
    const short: ASlotNobodyFilled[] = [];
    for (const slot of recipe) {
        const at = materialsToHand.findIndex(
            (id, i) => !spent.has(i) && fillsTheSlot(slot, id)
        );
        if (at >= 0) {
            spent.add(at);
            filled.push({ slot, materialId: materialsToHand[at], at });
            continue;
        }
        short.push({ slot, wouldHaveDone: whatWouldFill(slot) });
    }
    return { filled, short };
}

/** Which slots the haul does not reach. */
export function whatTheBenchIsShortOf(
    grade: TechniqueGrade,
    materialsToHand: readonly string[]
): readonly ASlotNobodyFilled[] {
    return howTheBenchReadsAgainst(whatItIsMadeOf(grade), materialsToHand).short;
}

/**
 * What the recipe TAKES, or null where it takes nothing because it cannot be
 * finished.
 *
 * NULL AND AN EMPTY LIST ARE TWO ANSWERS, and a caller that treats them alike
 * has written the bug this function is shaped against. Empty is a real spend:
 * mortal grade is roadside work and asks for nothing, so it takes nothing and
 * is made. Null is a bench that is short, and the whole of what it means is
 * NOTHING COMES OFF THIS BENCH - not the two slots that were filled, not one of
 * them. A craft that is refused after the materials were taken is the defect
 * players are right to hate, and the only safe shape is one that cannot express
 * a partial answer.
 */
export function whatTheRecipeSpends(
    grade: TechniqueGrade,
    materialsToHand: readonly string[],
    /** A recipe other than the grade's own, such as `whatMendingAHoleTakes`. */
    recipe: Recipe | null = whatItIsMadeOf(grade)
): readonly ASlotSomethingFills[] | null {
    const read = howTheBenchReadsAgainst(recipe, materialsToHand);
    return read.short.length > 0 ? null : read.filled;
}

/**
 * How many substitutes a refusal names before it stops.
 *
 * The rest are counted rather than listed. A refusal that reads out twenty rows
 * is a catalog dump and the player stops reading it; four and a number is the
 * shape the rest of this repo's refusals use.
 */
const HOW_MANY_SUBSTITUTES_A_REFUSAL_NAMES = 4;

/**
 * Why the bench is short, naming what is missing and what would stand in for
 * it, or null where nothing is missing.
 *
 * The standing rule for a refusal in this repo: what is actually wanted, why
 * this is not it, and what would change that. A bare "you cannot" carries none
 * of the three.
 */
export function whyTheBenchIsShort(
    grade: TechniqueGrade,
    materialsToHand: readonly string[],
    /**
     * How the sentence names the hands.
     *
     * A commission speaks ABOUT somebody, and somebody at their own bench is
     * being spoken TO. One sentence read out in the wrong person - "their hands
     * can work earth grade", said to the person whose hands they are - reads as
     * the engine talking about the player in the third person, which is exactly
     * the seam this repo keeps finding.
     */
    whoseHands = 'Their hands'
): string | null {
    const short = whatTheBenchIsShortOf(grade, materialsToHand);
    if (short.length === 0) return null;
    const lines = short.map(missing => {
        const named = missing.wouldHaveDone.slice(0, HOW_MANY_SUBSTITUTES_A_REFUSAL_NAMES);
        const rest = missing.wouldHaveDone.length - named.length;
        const substitutes = named.map(row => row.name).join(', ')
            + (rest > 0 ? `, or ${rest} more` : '');
        const route = named[0] === undefined ? '' : ` ${howYouWouldComeByIt(named[0])}.`;
        // The slot's words are written to sit mid-sentence and this is the one
        // place they open one.
        const what = missing.slot.what.charAt(0).toUpperCase() + missing.slot.what.slice(1);
        return `${what}: nothing here is one. ${substitutes} would each do.${route}`;
    });
    return `${whoseHands} can work ${grade} grade and the bench is short by `
        + `${short.length} of ${whatItIsMadeOf(grade)?.length ?? 0}. ${lines.join(' ')}`;
}
