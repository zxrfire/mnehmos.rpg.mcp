import io
p = 'src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.ts'
s = io.open(p, encoding='utf-8').read()
s += """
/**
 * WHAT A RING COSTS, WHICH IS THE FOLD AND NOT THE METAL.
 *
 * The design owner: *"the difference between ring grades is QUANTITY"*, and *"a
 * heaven grade ring should be absurdly expensive."*
 *
 * Both fall out of one observation this file already makes. Every ring in the
 * world is cut from heaven-grade ore - see `whatARingIsMadeOf` - so the
 * material is a CONSTANT across the whole range and cannot be what separates a
 * small ring from a large one. The only thing that varies is how much space is
 * folded into it. So the price is the fold, and the fold is the quantity.
 *
 * AND IT IS SUPERLINEAR, which is what makes the top of the range absurd rather
 * than merely large. A ring eight hundred times the size is not eight hundred
 * times the work: each doubling of the fold is harder to hold than the last,
 * and the hand that can hold it is rarer by the same argument. The exponent is
 * what turns *"holds more"* into *"almost nobody has one."*
 */
export function whatARingCosts(ringClass: TechniqueGrade): number {
    const held = WHAT_A_RING_HOLDS[ringClass];
    return Math.round(
        WHAT_THE_SMALLEST_FOLD_COSTS
        * Math.pow(held / WHAT_A_RING_HOLDS.mortal, WHAT_EACH_DOUBLING_COSTS)
    );
}

/**
 * Spirit stones for the smallest ring anybody can make.
 *
 * Already a fortune to a disciple, because it is heaven-grade ore worked by a
 * Void Tribulation hand, and that floor is the same for every ring in the world.
 */
export const WHAT_THE_SMALLEST_FOLD_COSTS = 30_000;

/**
 * How the price climbs against the space held.
 *
 * Above one, so it compounds. At 1.35 a heaven-grade ring runs to some tens of
 * millions of stones - a house's whole treasury several times over, which is
 * the honest reading of *"absurdly expensive"*: not a thing anybody saves up
 * for, a thing a house owns or a person inherits.
 */
export const WHAT_EACH_DOUBLING_COSTS = 1.35;
"""
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
