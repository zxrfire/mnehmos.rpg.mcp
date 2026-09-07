import io

p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

# ── stock talismans alongside pills and manuals ─────────────────────────
old = """    // AND WHAT IT TEACHES OUT OF, which the catalog already states. So a house
    // holds copies of exactly the arts it is known for and of nothing it is not.
    for (const artId of SECTS.find(s => s.id === houseId)?.teaches ?? []) {
        const art = getTechnique(artId);
        if (art === undefined) continue;
        wanted.push({ id: art.id, name: art.name, grade: art.grade, kind: 'manual' });
    }
"""
new = """    // AND WHAT IT TEACHES OUT OF, which the catalog already states. So a house
    // holds copies of exactly the arts it is known for and of nothing it is not.
    for (const artId of SECTS.find(s => s.id === houseId)?.teaches ?? []) {
        const art = getTechnique(artId);
        if (art === undefined) continue;
        wanted.push({ id: art.id, name: art.name, grade: art.grade, kind: 'manual' });
    }

    // AND THE SLIPS, which are what a house actually hands somebody before it
    // sends them anywhere. A talisman is one act already paid for - a strike at
    // the maker's strength, or a way out for somebody who could never fold - so
    // stocking them is the same decision as stocking medicine and is made off
    // the same ceiling. Mortal ones are counted; anything better is one of it.
    for (const grade of GRADES_A_HOUSE_STOCKS) {
        if (refiningOrdinalFor(grade) > refiningOrdinalFor(ceiling)) continue;
        for (const what of WHAT_A_HOUSE_KEEPS_SLIPS_FOR) {
            out.push(aStockOfSlips({
                houseId,
                houseName,
                grade,
                what,
                acting,
                today,
                roomFor
            }));
        }
    }
"""
assert old in s
s = s.replace(old, new, 1)

# ── and the function that cuts them ─────────────────────────────────────
anchor = """/**
 * WHICH ROOM OF A HOUSE A THING SITS IN."""
addition = """/**
 * The two things a house bothers keeping slips for.
 *
 * Both, always, because they answer the two questions a house has about
 * somebody it is sending out: can they hurt what they meet, and can they get
 * home. A house that stocked only one of them would be making a statement.
 */
const WHAT_A_HOUSE_KEEPS_SLIPS_FOR: readonly WhatIsInTheSlip[] = ['a_strike', 'a_way_out'];

/**
 * A house's stock of one kind of slip at one grade.
 *
 * The maker is the house's own best hand, which is what `acting` is - so a hill
 * sect's escape slips carry a hill sect's reach, and a court's carry a court's.
 * Nothing here decides who may cut one; `couldCutATalisman` does, off the same
 * table that decides it for medicine.
 */
function aStockOfSlips(input: {
    houseId: string;
    houseName: string;
    grade: TechniqueGrade;
    what: WhatIsInTheSlip;
    acting: number;
    today: number;
    roomFor: (purpose: RoomPurpose | null) => string | null;
}): ObjectRecord {
    const slip = cutATalisman({
        id: `treasury-${input.houseId}-talisman-${input.what}-${input.grade}`,
        name: `${input.grade}-grade ${input.what === 'a_strike' ? 'strike' : 'departure'} talisman`,
        grade: input.grade,
        what: input.what,
        crafterId: null,
        crafterOrdinal: input.acting,
        onDay: input.today,
        ownerId: input.houseId,
        ownerName: input.houseName
    });
    return {
        ...slip,
        locationId: input.roomFor(whereInTheHouseItSits(slip.kind, slip.significance, slip.tags)),
        data: {
            ...slip.data,
            // A counted stack of slips is repayable in kind; a tracked one is
            // the only one the house has. `keptAs` already draws that line.
            quantity: keptAs(slip.significance) === 'counted'
                ? howManyOfACommonThing(input.acting)
                : 1
        }
    };
}

/**
 * WHICH ROOM OF A HOUSE A THING SITS IN."""
assert anchor in s
s = s.replace(anchor, addition, 1)

# ── the import ──────────────────────────────────────────────────────────
s = s.replace(
    "import { whereInTheHouseItSits",
    "import { whereInTheHouseItSits",
    1
)
marker = "import {\n    WHERE_THE_PLATES_HANG,"
assert marker in s, 'plate import not found'
s = s.replace(marker,
    "import {\n"
    "    cutATalisman,\n"
    "    type WhatIsInTheSlip\n"
    "} from './a-talisman-is-one-act-somebody-already-paid-for.js';\n"
    + marker, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
