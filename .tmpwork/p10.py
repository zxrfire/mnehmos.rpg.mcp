import io

# ── 1. A cauldron is a treasure, not only a tool ─────────────────────────
p = 'src/engine/cultivation/what-you-refine-in.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace(""" * ── AND THE LID APPLIES HERE TOO ─────────────────────────────────────────""",
""" * ── AND A CAULDRON IS A TREASURE, NOT ONLY A TOOL ────────────────────────
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
 * ── AND THE LID APPLIES HERE TOO ─────────────────────────────────────────""")

anchor = """/** Whether a cauldron of this grade is one anybody down here could have made. */"""
new = """/**
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

/** Whether a cauldron of this grade is one anybody down here could have made. */"""
assert anchor in s, 'cauldron anchor'
s = s.replace(anchor, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. The seeded furnace stops being worth nothing in a fight ───────────
p2 = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s2 = io.open(p2, encoding='utf-8').read()
old2 = """                ownerName: name,
                power: null,
                locationId: where,
                tags: ['cauldron', 'treasury', `grade:${grade}`],"""
new2 = """                ownerName: name,
                // A CAULDRON IS A TREASURE AND NOT ONLY A TOOL. `power: null`
                // is `possessions.ts` saying a thing is worth nothing in a
                // fight, and a house's furnace is exactly the object people go
                // to war over and hide behind. See `whatACauldronIsWorthInAFight`.
                power: whatACauldronIsWorthInAFight(grade),
                locationId: where,
                tags: ['cauldron', 'treasury', 'defensive', `grade:${grade}`],"""
assert old2 in s2, 'furnace power'
s2 = s2.replace(old2, new2)
s2 = s2.replace(
    "import { howMuchACauldronIsWorthTracking } from '../cultivation/what-you-refine-in.js';",
    "import {\n"
    "    howMuchACauldronIsWorthTracking,\n"
    "    whatACauldronIsWorthInAFight\n"
    "} from '../cultivation/what-you-refine-in.js';")
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
