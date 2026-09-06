import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

old = """ * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────
 *
 * No pills and no manuals. Both already have their own systems that place them
 * - `readWhatIsOnOfferHere` and the shelves - and a second seeder writing rows
 * for the same nouns is the duplication `items.md` names. What a treasury holds
 * that nothing else places is the WORKING equipment of a house: what its
 * alchemists refine in, what its people are lent, and the one or two things it
 * would go to war over.
 */"""
new = """ * ── AND IT IS ALL ONE NOUN ───────────────────────────────────────────────
 *
 * A first cut kept pills and manuals out of here, on the grounds that both have
 * their own systems already. The owner rejected it: *"group pills and manuals
 * together, it's all items"*, *"I don't see why any of them should remain
 * separate"*, *"merge it all into a more general class."*
 *
 * Which is right, and the reason is that the systems that already exist do a
 * DIFFERENT job. `readWhatIsOnOfferHere` says what a counter will sell you and
 * the shelves say what a hall will teach you; neither says what a house OWNS. A
 * house's own stock of medicine is not for sale and is not on a shelf, and it
 * is what a war chest actually is.
 *
 * So every kind goes in, on one line, and the line is grade:
 * `howMuchAGradeIsWorthTracking` in `possessions.ts` decides counted or tracked
 * for a pill exactly as it does for a furnace. The owner, on that: *"the pill
 * logic (esp the immortal pill logic) should fall out of its IMPORTANCE."* It
 * does. Nothing below knows what a pill is.
 *
 * ── AND ALL OF IT IS LENT THE SAME WAY ───────────────────────────────────
 *
 * *"The treasury holds everything in terms of items, right? And it's lent the
 * same way - even pills, where you COULD lend a pill: you'd have to give it
 * back. Possible, like borrowing a pill to take at Foundation and giving a new
 * one at Core. That works because pills are fungible."*
 *
 * Which is the case that proves the design rather than the exception to it. A
 * loan is `ownerId` staying with the house while `possessorId` moves, and a
 * `lent` link on the chain saying the house agreed - see `whoseThisIs`. None of
 * that asks whether the thing survives being used. A borrowed furnace comes
 * back as itself; a borrowed pill comes back as ANOTHER ONE, years later, at a
 * realm the borrower could not reach when they took it. The debt is the same
 * debt and the house calls it in the same way, because what was lent was a
 * counted stack and one of those is as good as another.
 *
 * That is exactly why the counted/tracked line matters and is not cosmetic.
 * Counted things can be repaid in kind. A tracked thing cannot: there is one of
 * it, and giving back a different one is not giving it back.
 */"""
assert old in s, 'header not found'
s = s.replace(old, new)

s = s.replace(
    "import { SECTS, sectThreat } from '../../data/cultivation/sects.js';",
    "import { getPillsByGrade } from '../../data/cultivation/pills.js';\n"
    "import { getTechnique } from '../../data/cultivation/techniques.js';\n"
    "import { SECTS, sectThreat } from '../../data/cultivation/sects.js';")
s = s.replace(
    "import { makeObject, makeResourceLot, type ObjectRecord } from './possessions.js';",
    "import {\n"
    "    howMuchAGradeIsWorthTracking,\n"
    "    keptAs,\n"
    "    makeObject,\n"
    "    makeResourceLot,\n"
    "    type ObjectRecord\n"
    "} from './possessions.js';")

anchor = """    }

    return out;
}"""
tail = """
        // ── AND THE SAME LINE OVER EVERY OTHER NOUN ──────────────────────
        //
        // Nothing below knows what a pill is or what a manual is. Each reaches
        // it as a thing with a GRADE, and one call decides how much of a record
        // it deserves - so a house's healing pills are a stack with a number on
        // it and its heaven-grade dose is a row with a history, for the same
        // reason and by the same call.
        out.push(...whatElseTheHouseKeeps(house.id, name, where, acting, today));
    }

    return out;
}

/**
 * The rest of a treasury: what the house dispenses, and what it teaches out of.
 *
 * ONE LOOP OVER TWO CATALOGS AND NO BRANCH ON WHICH. A pill and a manual both
 * reach here as `{ id, name, grade }`, which is every field the counted/tracked
 * decision needs. A third catalog that wants to be in a treasury joins the list
 * above and changes nothing below it.
 */
function whatElseTheHouseKeeps(
    houseId: string,
    houseName: string,
    where: string | null,
    acting: number,
    today: number
): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const ceiling = bestFurnaceAHouseCouldKeep(acting);
    const wanted: {
        id: string;
        name: string;
        grade: TechniqueGrade;
        kind: 'pill' | 'manual';
    }[] = [];

    // WHAT IT DISPENSES, up to what it could field somebody to use. A hill sect
    // holding a heaven-grade dose nobody in it could survive taking is the
    // ornament problem again.
    for (const grade of GRADES_A_HOUSE_STOCKS) {
        if (refiningOrdinalFor(grade) > refiningOrdinalFor(ceiling)) continue;
        for (const pill of getPillsByGrade(grade).slice(0, HOW_MANY_KINDS_OF_EACH)) {
            wanted.push({ id: pill.id, name: pill.name, grade, kind: 'pill' });
        }
    }

    // AND WHAT IT TEACHES OUT OF, which the catalog already states. So a house
    // holds copies of exactly the arts it is known for and of nothing it is not.
    for (const artId of SECTS.find(s => s.id === houseId)?.teaches ?? []) {
        const art = getTechnique(artId);
        if (art === undefined) continue;
        wanted.push({ id: art.id, name: art.name, grade: art.grade, kind: 'manual' });
    }

    for (const thing of wanted) {
        const significance = howMuchAGradeIsWorthTracking(thing.grade);
        const rowId = `treasury-${houseId}-${thing.id}`;
        if (keptAs(significance) === 'counted') {
            // A stack, and repayable in kind - which is the whole of why a
            // borrowed pill can be given back as a different pill.
            const lot = makeResourceLot({
                id: rowId,
                resource: thing.name,
                quantity: howManyOfACommonThing(acting),
                source: `the ${houseName} stores`,
                acquiredOnDay: today,
                holderId: houseId,
                holderName: houseName,
                how: 'crafted',
                significance
            });
            lot.ownerId = houseId;
            lot.ownerName = houseName;
            lot.locationId = where;
            lot.tags = [thing.kind, 'treasury', `grade:${thing.grade}`];
            out.push(lot);
            continue;
        }
        // One of it, and giving back a different one is not giving it back.
        out.push(makeObject({
            id: rowId,
            name: thing.name,
            kind: thing.kind,
            significance,
            description:
                `Held by ${houseName}, and held rather than stocked: there is one of these and `
                + 'the house knows where it is.',
            possessorId: houseId,
            ownerId: houseId,
            ownerName: houseName,
            power: null,
            locationId: where,
            tags: [thing.kind, 'treasury', `grade:${thing.grade}`],
            data: { grade: thing.grade, sourceId: thing.id }
        }));
    }

    return out;
}

/**
 * The grades a house keeps medicine in at all.
 *
 * Immortal and chaos are not on it, and that is not a budget decision. Nothing
 * below the Lid makes one and no process adds another, so a dose down here is a
 * thing that CAME from somewhere - sent down, or dug out of a sealed site - and
 * the systems that place those own it. Seeding one into every house in the
 * world would make the finite thing routine, which is the one property it has.
 */
const GRADES_A_HOUSE_STOCKS: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven'];

/** How many distinct formulas of a grade a house bothers keeping. */
const HOW_MANY_KINDS_OF_EACH = 3;

/** How deep a stack of an ordinary thing goes, off what the house is. */
function howManyOfACommonThing(acting: number): number {
    return Math.max(5, Math.round(acting * 2));
}"""
assert anchor in s, 'tail anchor not found'
s = s.replace(anchor, tail, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
