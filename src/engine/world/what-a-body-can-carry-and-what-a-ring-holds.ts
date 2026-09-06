/**
 * WHAT A BODY CAN CARRY, AND WHAT A RING HOLDS.
 *
 * The design owner: *"objects have volume and weight"*, *"how much you can
 * carry is limited by volume and weight by cultivation level"*, and - on the
 * thing that lifts the limit - *"that falls out of volume (if you have a spirit
 * ring), because crafting exists"*, *"spirit rings require Void Tribulation or
 * above to refine, hence rare"*, *"and Void Tribulation gets you the smallest
 * mortal grade one."*
 *
 * ── WHY A RING IS HARDER THAN ITS GRADE ──────────────────────────────────
 *
 * Every other object in this world is gated by the grade of its materials, and
 * `who-can-refine-a-grade-of-medicine.ts` owns that ladder: mortal at Qi
 * Condensation, earth at Core Formation, heaven at Void Tribulation. A ring
 * breaks the pattern - the SMALLEST, cheapest, mortal-grade ring wants Void
 * Tribulation, four realms above what its materials would ask.
 *
 * And it is not an exception bolted on. The owner again, on why: *"artifact
 * crafting exists too, like ores for swords - so rings need heaven grade ore
 * ofc."*
 *
 * THE MATERIAL IS THE REASON, and it is the whole reason. A ring is a folded
 * space with a mouth on it, and nothing below heaven-grade ore will hold a fold
 * - so the cheapest ring in the world is still cut from heaven-grade material,
 * and therefore still answers to the rung heaven-grade material answers to. Its
 * own grade says how BIG the fold is; it does not say what the fold is made of.
 *
 * TWO NUMBERS THAT TURN OUT TO BE ONE. `refiningOrdinalFor('heaven')` is
 * twenty-nine, and `FOLD_FLOOR_ORDINAL` - the rung at which a cultivator can
 * fold space at all - is also twenty-nine. That is not a coincidence to be
 * tidied away: a hand that can work material capable of holding a fold is a
 * hand that can make one, because they are the same capability seen from the
 * material side and the person side. This module states the material wall,
 * because that is the one the owner gave, and asserts the other agrees.
 *
 * WHICH IS THE WHOLE REASON THEY ARE RARE. Not a drop rate and not a price.
 * There are very few hands in the world that can make one at all, every ring in
 * circulation was made by one of them, and the ones down here that nobody can
 * account for came from somewhere - the same sentence as every other object
 * above the Lid.
 *
 * ── AND THE BODY UNDERNEATH IT ───────────────────────────────────────────
 *
 * Without a ring, what somebody can carry is what a person can carry, and it
 * goes up with the body: a Qi Condensation disciple hauls what a strong mortal
 * hauls, and somebody four realms up carries a cart's worth without noticing.
 * Two limits and not one, because they bind differently - a bag of spirit
 * stones is heavy and small, and a bundle of spirit herbs is light and
 * enormous. Whichever runs out first is the one that stops you.
 */

import { FOLD_FLOOR_ORDINAL } from './how-far-somebody-can-fold-space-and-what-it-costs.js';
import { refiningOrdinalFor } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

/**
 * How big and how heavy a thing is.
 *
 * Litres and kilos, said plainly, because a made-up unit would be a second
 * thing every reader has to learn and would not make the arithmetic any
 * different. A sword is about two litres and one and a half kilos; a spirit
 * stone is small and dense; a bundle of dried herbs is the other way round.
 */
export interface HowMuchRoomItTakes {
    /** Litres. */
    volume: number;
    /** Kilograms. */
    weight: number;
}

/**
 * What one person can carry on their own body, before any ring.
 *
 * WEIGHT CLIMBS AND VOLUME BARELY DOES, which is the point of the pair. A
 * cultivator four realms up is enormously stronger and is still one person with
 * two arms: they can carry a boulder and they still cannot carry a cartload of
 * hay. So weight scales with the body and volume scales with how much a person
 * can physically get their arms around, which is nearly a constant.
 *
 * That is what makes a ring worth what it is worth. It does not make you
 * stronger; it removes the limit that never moved.
 */
export function whatABodyCanCarry(realmOrdinal: number): HowMuchRoomItTakes {
    const rung = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(realmOrdinal)));
    return {
        volume: WHAT_TWO_ARMS_HOLD + rung * WHAT_A_RUNG_ADDS_TO_VOLUME,
        weight: WHAT_A_MORTAL_CARRIES * Math.pow(WHAT_A_RUNG_MULTIPLIES_WEIGHT_BY, rung)
    };
}

/** Litres a person can get their arms and their pack around. A rucksack. */
export const WHAT_TWO_ARMS_HOLD = 40;

/**
 * Litres each rung adds, which is deliberately almost nothing.
 *
 * A stronger person carries a bigger pack and not a different shape of body.
 * Over forty-four rungs this roughly doubles the volume while the weight goes
 * up by orders of magnitude, which is the asymmetry that makes a ring matter.
 */
export const WHAT_A_RUNG_ADDS_TO_VOLUME = 1;

/** Kilos an ordinary strong person carries and walks with. */
export const WHAT_A_MORTAL_CARRIES = 30;

/** What each rung multiplies carried weight by. Compounding, like everything. */
export const WHAT_A_RUNG_MULTIPLIES_WEIGHT_BY = 1.12;

// ═════════════════════════════════════════════════════════════════════════
// AND THE RING
// ═════════════════════════════════════════════════════════════════════════

/**
 * The rung a hand has to stand at to fold a ring of this grade.
 *
 * The HIGHER of two walls, and both already exist. A ring is made of materials,
 * so it answers to `refiningOrdinalFor` like anything else - and it is a folded
 * space, so it answers to `FOLD_FLOOR_ORDINAL` as well. For every grade up to
 * heaven the fold is the binding one, which is exactly the owner's *"spirit
 * rings require Void Tribulation or above"*; above that the materials take over
 * again, which is why an immortal-grade ring is not merely a bigger one.
 */
export function whoCanFoldARing(grade: TechniqueGrade): number {
    return Math.max(WHAT_ORE_A_FOLD_NEEDS_RUNG(), refiningOrdinalFor(grade));
}

/**
 * The rung the ORE a fold needs answers to, which is heaven-grade.
 *
 * A function rather than a constant so it moves with the refining table: repice
 * what heaven-grade material costs a hand and every ring in the world moves
 * with it, which is the behaviour a derived rule should have.
 */
function WHAT_ORE_A_FOLD_NEEDS_RUNG(): number {
    return refiningOrdinalFor(WHAT_ORE_A_FOLD_NEEDS);
}

/**
 * The grade of ore that will hold a fold. *"Rings need heaven grade ore ofc."*
 *
 * Below this the metal simply does not take the working - which is why there is
 * no such thing as a cheap ring made badly, only a ring and a ring-shaped piece
 * of metal.
 */
export const WHAT_ORE_A_FOLD_NEEDS: TechniqueGrade = 'heaven';

/**
 * That the ore wall and the folding wall are the same rung.
 *
 * Held here rather than assumed, because the argument in this file's header
 * rests on it: if a repricing ever moved them apart, the honest thing is a
 * failing check rather than a paragraph that has quietly stopped being true.
 */
export const THE_TWO_WALLS_AGREE =
    refiningOrdinalFor(WHAT_ORE_A_FOLD_NEEDS) === FOLD_FLOOR_ORDINAL;

/**
 * WHAT A RING IS MADE OF, WHICH IS NOT WHAT IT IS CALLED.
 *
 * The design owner: *"like a mortal grade ring is obviously heaven grade (to
 * destroy), but classified as mortal grade due to their storage space."*
 *
 * So a ring is the one object in this world carrying TWO grades, and they
 * answer two different questions:
 *
 *   its CLASS      how much it holds. This is the grade on the row, the grade
 *                  a merchant quotes, and the only thing that varies between
 *                  one ring and another.
 *   its MATERIAL   what it is cut from, which is heaven-grade in the cheapest
 *                  ring ever made. This is what somebody trying to BREAK it
 *                  runs into.
 *
 * Which is why a mortal-grade ring is not a mortal-grade object. Somebody who
 * can shatter a mortal-grade sword bounces off the smallest ring in the world,
 * and the reason is not that rings are special-cased anywhere: it is that the
 * thing in their hand is heaven-grade metal with a small fold in it.
 *
 * Everything that asks how hard a thing is to destroy should read THIS and not
 * the class.
 */
export function whatARingIsMadeOf(ringClass: TechniqueGrade): TechniqueGrade {
    return refiningOrdinalFor(ringClass) > refiningOrdinalFor(WHAT_ORE_A_FOLD_NEEDS)
        ? ringClass
        : WHAT_ORE_A_FOLD_NEEDS;
}

/**
 * What a ring of this grade holds, in litres.
 *
 * ── CALIBRATED AGAINST A THING THAT ALREADY EXISTS ───────────────────────
 *
 * The owner: *"you can imagine a rich man just taking a spirit boat out of his
 * heaven grade storage ring."*
 *
 * So that is the measurement, and it turns out to be a rule rather than a
 * number: A RING OF A GRADE HOLDS A CONVEYANCE OF THAT GRADE. `A spirit boat`
 * in `what-a-house-moves-its-people-on.ts` is heaven grade and carries thirty
 * heads, which at `WHAT_ONE_BERTH_TAKES` is a hundred and twenty thousand
 * litres of hull - so the heaven-grade ring is set above that with room to
 * spare, and the rich man gets his boat out. The grades below fall in the same
 * relation to the conveyances of their own grade.
 *
 * That is worth more than a tuned figure because it stays true. Repricing a
 * conveyance moves what a ring has to hold, and the reason the ring is that big
 * is a sentence anybody can check rather than a constant somebody once picked.
 *
 * THE MORTAL ONE IS SMALL ON PURPOSE. *"Void Tribulation gets you the smallest
 * mortal grade one"* - the first ring anybody in the world can make is worth
 * having and is not the end of the problem, which is what keeps the better ones
 * worth going after.
 *
 * Weight is not on this table because a folded space does not have one. What is
 * inside a ring is not being carried, and that is the whole of what a ring is
 * for - see `whatSomebodyCanCarryInAll`.
 */
export const WHAT_A_RING_HOLDS: Readonly<Record<TechniqueGrade, number>> = {
    // A travelling chest. Everything a person owns, and not a cart.
    mortal: 200,
    // A cart and what is on it.
    earth: 4_000,
    // A spirit boat, and the reason to want one.
    heaven: 160_000,
    immortal: 4_000_000,
    chaos: 100_000_000
};

/**
 * Litres of hull one berth on a conveyance amounts to.
 *
 * A person, their gear, and the share of deck, hull and rail that carries them.
 * Used to say how big a conveyance is without putting a volume on every row of
 * a catalog that has never needed one.
 */
export const WHAT_ONE_BERTH_TAKES = 4_000;

/** How much room a conveyance of this many heads takes up, folded or not. */
export function howBigAConveyanceIs(heads: number): number {
    return Math.max(1, Math.round(heads)) * WHAT_ONE_BERTH_TAKES;
}

/**
 * Whether this hand could make one at all.
 *
 * Below the fold floor the answer is no for every grade, including the
 * cheapest, and that is not a shortage of skill. Somebody who cannot fold space
 * is not making a small fold; they are not making a fold.
 */
export function couldFoldARing(grade: TechniqueGrade, realmOrdinal: number): boolean {
    return realmOrdinal >= whoCanFoldARing(grade);
}

/**
 * Why the ring cannot be made, in words, or null where it can.
 *
 * Names the honest route and does not suggest one. Somebody at Core Formation
 * asking why their ring failed is owed the real answer, which is that the
 * problem was never the ring.
 */
export function whyTheFoldWillNotHold(
    grade: TechniqueGrade,
    realmOrdinal: number
): string | null {
    if (couldFoldARing(grade, realmOrdinal)) return null;
    if (realmOrdinal < FOLD_FLOOR_ORDINAL) {
        return 'A ring is a folded space with a mouth on it, and folding space is not '
            + 'something this body does yet. The materials are not the difficulty and a '
            + 'cheaper ring is not an easier one: there is no small fold, there is a fold '
            + 'or there is a ring-shaped piece of metal.';
    }
    return `A ${grade}-grade ring wants materials this hand cannot work, whatever it can do `
        + 'with the space around them.';
}

/**
 * What somebody can carry in total, body and ring together.
 *
 * The ring's volume is ADDED and its weight is not, because what is inside a
 * fold is not on anybody's back. That asymmetry is the entire mechanical
 * consequence of owning one and it needs no other rule.
 */
export function whatSomebodyCanCarryInAll(input: {
    realmOrdinal: number;
    /** The grades of every ring they are actually wearing. Usually none or one. */
    rings: readonly TechniqueGrade[];
}): HowMuchRoomItTakes {
    const body = whatABodyCanCarry(input.realmOrdinal);
    let volume = body.volume;
    for (const grade of input.rings) volume += WHAT_A_RING_HOLDS[grade];
    return { volume, weight: body.weight };
}

/**
 * Whether a load fits, and which limit stopped it.
 *
 * Two answers rather than a boolean, because *"it will not fit"* and *"you
 * cannot lift it"* send somebody to do two completely different things.
 */
export type WhyItWillNotGoIn = 'no_room' | 'too_heavy' | null;

export function whatStopsThemCarryingIt(
    load: HowMuchRoomItTakes,
    capacity: HowMuchRoomItTakes
): WhyItWillNotGoIn {
    if (load.weight > capacity.weight) return 'too_heavy';
    if (load.volume > capacity.volume) return 'no_room';
    return null;
}

/**
 * WHAT A RING COSTS, WHICH IS THE FOLD AND NOT THE METAL.
 *
 * The design owner: *"the difference between ring grades is QUANTITY"*, *"a
 * heaven grade ring should be absurdly expensive"*, and then the measurement
 * that settles it - *"equivalent to a heaven grade spirit boat. That's classic
 * xianxia."*
 *
 * ── WHY IT IS THE FOLD ───────────────────────────────────────────────────
 *
 * Every ring in the world is cut from heaven-grade ore - see
 * `whatARingIsMadeOf` - so the material is a CONSTANT across the whole range
 * and cannot be what separates a small ring from a large one. The only thing
 * that varies is how much space is folded in. Price is the fold, and the fold
 * is the quantity.
 *
 * ── AND TWO ANCHORS, WITH THE CURVE AS THE CONSEQUENCE ───────────────────
 *
 * Both ends are things somebody said rather than numbers somebody picked, and
 * the exponent between them is DERIVED rather than tuned - so it cannot drift
 * away from either.
 *
 *   the floor    the smallest fold anybody can make, which is already heaven-
 *                grade ore worked by a Void Tribulation hand
 *   the top      a heaven-grade ring costs a heaven-grade spirit boat
 *
 * A first cut picked an exponent of 1.35 by eye and put a heaven-grade ring at
 * two hundred and forty-nine million stones - several times a great house's
 * entire treasury, and roughly six hundred boats. Anchoring to the owner's own
 * comparison brings it back to one boat, and the curve turns out to be
 * SUBLINEAR: capacity gets cheaper per litre as it goes up, because the hard
 * part is making a fold at all rather than making a big one. That reads as
 * wrong until you remember what the floor is made of, and then it is the only
 * thing it could have been.
 */
export function whatARingCosts(ringClass: TechniqueGrade): number {
    const held = WHAT_A_RING_HOLDS[ringClass];
    return Math.round(
        WHAT_THE_SMALLEST_FOLD_COSTS
        * Math.pow(held / WHAT_A_RING_HOLDS.mortal, howTheFoldPricesOut())
    );
}

/**
 * Spirit stones for the smallest ring anybody can make.
 *
 * Already a fortune to a disciple, because it is heaven-grade ore worked by a
 * Void Tribulation hand - and that floor is identical for every ring in the
 * world, which is exactly why the curve above it is not steep.
 */
export const WHAT_THE_SMALLEST_FOLD_COSTS = 30_000;

/**
 * What a heaven-grade ring costs, and it is not a figure about rings.
 *
 * *"Equivalent to a heaven grade spirit boat."* A boat is a hundred and twenty
 * heaven-grade components and six cores - about four hundred and twenty
 * thousand stones of material - and two thousand four hundred work days from
 * one of a few dozen hands in the world qualified to lay one down. The labour
 * is most of it, which is why `what-a-house-moves-its-people-on.ts` calls a
 * hull *"an undertaking rather than a purchase."*
 */
export const WHAT_A_HEAVEN_GRADE_HULL_COSTS = 2_800_000;

/**
 * The exponent, derived from the two anchors rather than chosen.
 *
 * Solved so that a heaven-grade ring lands on a heaven-grade hull. Repricing
 * either end moves this, which is the property a tuned constant would not have.
 */
function howTheFoldPricesOut(): number {
    return Math.log(WHAT_A_HEAVEN_GRADE_HULL_COSTS / WHAT_THE_SMALLEST_FOLD_COSTS)
        / Math.log(WHAT_A_RING_HOLDS.heaven / WHAT_A_RING_HOLDS.mortal);
}

/** Exported so a test can pin the curve without recomputing the solve. */
export const HOW_THE_FOLD_PRICES_OUT = howTheFoldPricesOut();
