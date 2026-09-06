import io

# ── 1. The grade -> significance rule, stated once, over everything ──────
p = 'src/engine/world/possessions.ts'
s = io.open(p, encoding='utf-8').read()
anchor = """/** Whether this row carries a provenance anybody can be asked about. */"""
new = """/**
 * HOW MUCH A THING OF THIS GRADE IS WORTH BOOKKEEPING.
 *
 * The design owner: *"group pills and manuals together, it's all items"*, *"I
 * don't see why any of them should remain separate"*, and - on the shape the
 * rule should have - *"the pill logic (esp the immortal pill logic) should fall
 * out of its IMPORTANCE."*
 *
 * So it falls out, here, once, for every noun in the world. A pill, a manual, a
 * cauldron, a sword and a lot of ore are all objects, they are all graded on
 * one five-step ladder, and how much of a record each deserves is a function of
 * that grade and of nothing else. There is no pill rule, no manual rule and no
 * cauldron rule, and the moment there is one of those the other twelve nouns
 * start needing theirs.
 *
 * WHY THE TOP TWO ARE NOT A BAND BUT A FACT. Immortal and chaos are the grades
 * nothing below the Lid makes - `who-can-refine-a-grade-of-medicine.ts` decides
 * that, off the realm a hand has to stand in to work the materials at all - so
 * every one of them down here came down or came out of something sealed. There
 * is a finite number in the world and no process that adds another. A thing
 * like that is never a stack with a quantity on it; asking whose it was and
 * where it has been is the ONLY interesting question about it, and `legendary`
 * is how this file says a row must be able to answer that.
 */
export function howMuchAGradeIsWorthTracking(grade: TechniqueGrade): ObjectSignificance {
    switch (grade) {
        // Roadside. You buy another one and nobody writes it down.
        case 'mortal':
            return 'mundane';
        // Made by somebody, for somebody, and both are answerable.
        case 'earth':
            return 'notable';
        case 'heaven':
            return 'significant';
        case 'immortal':
        case 'chaos':
            return 'legendary';
    }
}

/** Whether this row carries a provenance anybody can be asked about. */"""
assert anchor in s
s = s.replace(anchor, new, 1)
s = s.replace("import type { ObjectRecord } from",  "import type { ObjectRecord } from")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('possessions ok')
