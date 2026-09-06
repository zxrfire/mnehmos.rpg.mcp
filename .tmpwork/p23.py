import io
p = 'src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.ts'
s = io.open(p, encoding='utf-8').read()

start = s.index("/**\n * WHAT A RING COSTS, WHICH IS THE FOLD AND NOT THE METAL.")
new = """/**
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
"""
s = s[:start] + new
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
