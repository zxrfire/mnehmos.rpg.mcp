import io
p = 'src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""export const THE_TWO_WALLS_AGREE =
    refiningOrdinalFor(WHAT_ORE_A_FOLD_NEEDS) === FOLD_FLOOR_ORDINAL;""",
"""export const THE_TWO_WALLS_AGREE =
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
}""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
