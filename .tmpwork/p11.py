import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

# ── the header gains the rooms ───────────────────────────────────────────
s = s.replace(""" * ── AND ALL OF IT IS LENT THE SAME WAY ───────────────────────────────────""",
""" * ── AND THE ONLY REAL DIFFERENCE IS WHICH ROOM ───────────────────────────
 *
 * *"The only difference is that they are in different places. Some weapons are
 * in the treasury (the best ones), the counted ones in the armory."* And:
 * *"shitty cauldrons in the furnace area, idk what you call it."*
 *
 * So the room is not a second classification anybody maintains - it FALLS OUT
 * of the two facts already on the row. Tracked things are in the treasury,
 * whatever they are, because the treasury is the room with one of each thing in
 * it. Counted things are wherever that kind of thing is USED: blades in the
 * armoury, clay cauldrons in the refining hall, medicine in the dispensary,
 * copies on the library shelves.
 *
 * Which is also the honest reason a house's best sword and its four hundred
 * spears are not in the same place. Nobody decided that as a policy. One of
 * them is a thing you sign for and the others are a rack by the door.
 *
 * ── AND ALL OF IT IS LENT THE SAME WAY ───────────────────────────────────""")

anchor = """/**
 * The grades a house keeps medicine in at all."""

new = """/**
 * WHICH ROOM OF A HOUSE A THING SITS IN.
 *
 * Derived from the two facts the row already carries and stored nowhere. A
 * third classification would be a third thing to keep in step, and the first
 * time something was promoted from a rack to a vault somebody would forget it.
 *
 * The treasury is not "the expensive room". It is the room for things there is
 * ONE of - which is the same sentence as `tracked`, and why this needs no
 * separate notion of value.
 */
export type WhereInAHouse =
    | 'the_treasury'
    | 'the_armoury'
    /** 丹房. Where the furnaces are and where the clay ones are stacked. */
    | 'the_refining_hall'
    | 'the_dispensary'
    | 'the_library'
    | 'the_stores';

export function whereInTheHouseItSits(
    kind: ObjectKind,
    significance: ObjectSignificance,
    tags: readonly string[] = []
): WhereInAHouse {
    // One of it, and the house knows where it is. Whatever it is.
    if (keptAs(significance) === 'tracked') return 'the_treasury';
    // Otherwise: wherever that kind of thing is actually used.
    if (tags.includes('cauldron')) return 'the_refining_hall';
    switch (kind) {
        case 'pill':
            return 'the_dispensary';
        case 'manual':
            return 'the_library';
        case 'artifact':
            return 'the_armoury';
        default:
            return 'the_stores';
    }
}

/** The room said the way somebody standing in the compound would say it. */
export function whatThatRoomIsCalled(where: WhereInAHouse): string {
    switch (where) {
        case 'the_treasury':
            return 'the treasury';
        case 'the_armoury':
            return 'the armoury';
        case 'the_refining_hall':
            return 'the refining hall';
        case 'the_dispensary':
            return 'the dispensary';
        case 'the_library':
            return 'the library';
        case 'the_stores':
            return 'the stores';
    }
}

/**
 * The grades a house keeps medicine in at all."""

assert anchor in s, 'rooms anchor'
s = s.replace(anchor, new, 1)

s = s.replace(
    "import {\n"
    "    howMuchAGradeIsWorthTracking,\n"
    "    keptAs,\n"
    "    makeObject,\n"
    "    makeResourceLot,\n"
    "    type ObjectRecord\n"
    "} from './possessions.js';",
    "import {\n"
    "    howMuchAGradeIsWorthTracking,\n"
    "    keptAs,\n"
    "    makeObject,\n"
    "    makeResourceLot,\n"
    "    type ObjectKind,\n"
    "    type ObjectRecord,\n"
    "    type ObjectSignificance\n"
    "} from './possessions.js';")

# ── and every seeded row says which room it is in ────────────────────────
s = s.replace("""        plain.tags = ['cauldron', 'treasury'];
        out.push(plain);""",
"""        plain.tags = ['cauldron', whereInTheHouseItSits('other', 'mundane', ['cauldron'])];
        out.push(plain);""")

s = s.replace("""                tags: ['cauldron', 'treasury', 'defensive', `grade:${grade}`],""",
"""                tags: [
                    'cauldron',
                    'defensive',
                    whereInTheHouseItSits('artifact', howMuchACauldronIsWorthTracking(grade), ['cauldron']),
                    `grade:${grade}`
                ],""")

s = s.replace("""            lot.tags = [thing.kind, 'treasury', `grade:${thing.grade}`];""",
"""            lot.tags = [
                thing.kind,
                whereInTheHouseItSits(thing.kind, significance),
                `grade:${thing.grade}`
            ];""")

s = s.replace("""            tags: [thing.kind, 'treasury', `grade:${thing.grade}`],""",
"""            tags: [
                thing.kind,
                whereInTheHouseItSits(thing.kind, significance),
                `grade:${thing.grade}`
            ],""")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
