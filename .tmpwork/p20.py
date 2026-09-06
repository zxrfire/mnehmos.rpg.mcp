import io
p = 'src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace(""" * And it is not an exception bolted on. A storage ring is a folded space with a
 * mouth on it, so what it costs to make is what folding space costs, and this
 * world already has a floor for that: `FOLD_FLOOR_ORDINAL`, twenty-nine, which
 * is the opening rung of Void Tribulation. The same wall that stops a Core
 * Formation cultivator stepping across a province stops them making a bag that
 * is bigger inside. One rule, stated once, in the file about folding space -
 * and this module imports it rather than restating the number.""",
""" * And it is not an exception bolted on. The owner again, on why: *"artifact
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
 * because that is the one the owner gave, and asserts the other agrees.""")

s = s.replace("""export function whoCanFoldARing(grade: TechniqueGrade): number {
    return Math.max(FOLD_FLOOR_ORDINAL, refiningOrdinalFor(grade));
}""",
"""export function whoCanFoldARing(grade: TechniqueGrade): number {
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
    refiningOrdinalFor(WHAT_ORE_A_FOLD_NEEDS) === FOLD_FLOOR_ORDINAL;""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
