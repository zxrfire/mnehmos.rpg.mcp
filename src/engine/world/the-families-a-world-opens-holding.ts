/**
 * The families a world already has on the day it opens.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `the-ties-an-ordinary-life-produces.ts` was written because a world of five
 * hundred people held six friendships and no families at all. It fixed that on
 * the YEARLY pass, and the yearly pass does not run at world creation - so the
 * measurement it was written against is still true of the only world most
 * players will ever see. Three fresh worlds, seeds `census-a/b/c`, 595 living
 * people each:
 *
 *     ties in the whole world            133 / 134 / 134
 *     of which ally ("Serves under")      99 / 100 / 100
 *     of which rival ("Was the other
 *       candidate")                       34 /  34 /  34
 *
 *     spouse   0        kin      0
 *     parent   0        child    0
 *     master   0        disciple 0
 *
 * Every one of those 133 rows is written by the same seven lines in
 * `seedFactions` - the five people nearest the top of each house. Nobody in a
 * fresh world has a brother, a mother, a teacher or a household.
 *
 * That is not a cosmetic gap. `whoTheyCarryFor` in `what-a-telling-lands-on.ts`
 * reads exactly six tie kinds - kin, spouse, parent, child, master, disciple -
 * and a hearer holding none of them carries for nobody but themselves. So on
 * turn one of a fresh world the `tell` verb, the absence layer, the inherited
 * grudge and every house-acts-for-its-own path reach a population of nought.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT THE LINEAGE RECORD, AND WHY THAT MATTERS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The obvious fix is to promote what `seedLineages` already asserts: it writes
 * 440-446 parent/child edges into `state.lineages` at creation, over 485-487 of
 * the 595 people. Reading ties off those would give 82% of the world a family
 * in one line of code, and it would be wrong. Measured on the same three seeds:
 *
 *     parent and child in the SAME PLACE       29-38
 *     parent and child in different places    402-415
 *     age gap p50                              22-23 years
 *     age gap p90                             107-129 years
 *     age gap max                             332-343 years
 *     children per "parent"                   up to 8
 *     parents per child                        exactly 1, always
 *
 * `seedLineages` pairs people on a shared SURNAME and an eighteen-year gap,
 * walking each surname oldest-first and attaching everybody to the nearest
 * earlier member. That is a defensible way to give the inheritance layer
 * somewhere to send an estate. It is not a family: nine tenths of its pairs have
 * never stood in the same settlement, its tail contains parents three centuries
 * older than their children, and nobody in the world has two parents.
 *
 * It also swallows the one family the catalog authors. `lin-duan` carries 27-30
 * edges over the 28-31 people in a world named Duan - of whom **nine** are
 * `THE_LINE_AT_OLD_RIVER` and the rest are procedural people who drew a common
 * surname. `a-family-that-came-down-from-a-changed-beast.ts` is explicit that
 * this must not happen: *"a stranger with the same name proves nothing at
 * all."* The lineage chain proves it anyway. That is a finding about
 * `seedLineages` and it is not fixed here - see WHAT THIS DELIBERATELY LEAVES.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A NEW FAMILY MODEL
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every rule this pass applies is imported from
 * `the-ties-an-ordinary-life-produces.ts` and none is restated:
 *
 *   WHO COULD BE A PARENT   {@link couldParent}, unchanged. Old enough by
 *                           {@link HOUSEHOLD_MIN_AGE}, still here, and not
 *                           already holding {@link SIBLINGS_PER_HOUSEHOLD}
 *                           children.
 *   WHAT THE TIES ARE       {@link bindNewbornToHousehold}, unchanged. It writes
 *                           both halves of parent/child, picks up the other
 *                           parent where there is a household, and binds the
 *                           siblings already in it - at the same standings a
 *                           birth in year 1,240 will write.
 *   WHERE A HOUSEHOLD IS    the same place, never the same province, which is
 *                           `applyHouseholds`'s own rule and its reason: *"a
 *                           household is people who live together."*
 *
 * So a tie this pass writes is byte-identical to one the yearly pass writes,
 * and nothing downstream can tell a seeded family from a lived one. That is the
 * requirement: the ledger, the grudge layer and the alignment reading must not
 * treat history differently from the present.
 *
 * The one thing this file decides for itself is HOW OFTEN, below.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RATE, AND THE ARGUMENT FOR IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A world where everybody has a brother is as broken as one where nobody does.
 * `the-ties-an-ordinary-life-produces.ts` says why in its own words: *"Some
 * people finish with nobody at all, which is a real state and an interesting
 * one."*
 *
 * The question this pass asks of each person is not *do you have a family* - it
 * is **is your family standing in this settlement.** Most of the seeded
 * population is somewhere their family is not: sect intake moves people, a
 * posting moves people, and a province with 74 populated places and 595 people
 * in it is a province people have walked across. So the honest answer for a
 * clear majority is no, and it is no for a reason rather than for want of a
 * roll.
 *
 * {@link BORN_TO_SOMEBODY_STANDING_HERE} is the chance for one person who HAS
 * an eligible parent standing beside them. The realised share of the world in a
 * family is lower than that number and is bounded by three things that are not
 * this file's: how many places have two generations in them at all, the
 * {@link SIBLINGS_PER_HOUSEHOLD} cap, and the eighteen-year bar. Measured, not
 * assumed - see `tests/engine/world/the-families-a-world-opens-holding.test.ts`,
 * which asserts the BAND rather than a number, because the band is the claim.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS DELIBERATELY LEAVES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * SPOUSES. `applyHouseholds` owns them and draws on `forStream(seed,
 * 'households', year)`. Running it at creation would spend the same stream at
 * the same years the driver is about to spend it at, so the first years of play
 * would re-roll draws already made against a roster that had moved. A household
 * a seeded parent is IN is honoured - `bindNewbornToHousehold` reads the spouse
 * tie and gives the child two parents when there is one - so this pass gains
 * that for free the moment marriages exist. It does not manufacture them.
 *
 * MASTERS AND DISCIPLES. `applyTeachingLines` is not a per-year roll at all: it
 * pairs whoever is currently unmatched against whoever can carry them, so it
 * lands in full on the first simulated year. It needs no seeding and would be a
 * second opinion if it got one.
 *
 * THE LINEAGE RECORD. Untouched, on purpose. `state.lineages` is what
 * `heirsOf` and `settleInheritance` read, and adding edges to it would change
 * who inherits in every world that already exists. The relationship layer's
 * families and the lineage layer's families are two different claims today and
 * this pass improves exactly one of them. The surname chain is the one that
 * should change, and it is somebody's to change deliberately.
 */

import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { surnameOf } from './history.js';
import {
    bindNewbornToHousehold,
    couldParent,
    rosterOf,
    SIBLINGS_PER_HOUSEHOLD,
    type Roster
} from './the-ties-an-ordinary-life-produces.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ONE NUMBER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance that somebody with an eligible parent standing in their settlement was
 * actually born to them.
 *
 * Not the share of the world that ends up in a family - that is lower, and it
 * is measured rather than set. This is the conditional, and it is a statement
 * about migration: given that there IS somebody here old enough to be your
 * mother, is she. Somewhere near evens is the shape wanted, because both
 * answers have to stay ordinary. Push it toward 1 and every settlement becomes
 * one household; push it toward 0 and the layer that reads these ties is back
 * to reaching nobody.
 */
export const BORN_TO_SOMEBODY_STANDING_HERE = 0.35;

/**
 * People in one settlement before this pass stops looking at it.
 *
 * A guard rather than a rule. The pass is O(people in the place) per place and
 * the biggest settlement in a seeded world holds about two dozen, so this
 * never binds today - but the seeder's population is a parameter and a place
 * holding four hundred people should not become a single family tree.
 */
const HOUSEHOLDS_PER_PLACE_CAP = 12;

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

export interface FamiliesSeeded {
    /** Parent/child pairs written. Each is two rows plus any sibling rows. */
    households: number;
    /** Living people who now hold at least one blood tie. */
    peopleInAFamily: number;
    /** Places that produced at least one household. */
    places: number;
}

function ageInYears(npc: NpcRecord, onDay: number): number {
    return Math.floor((onDay - npc.identity.bornOnDay) / DAYS_PER_YEAR);
}

/**
 * Give the world the families it should already have had.
 *
 * Called once, from `seedWorld`, after everybody has been placed. Mutates
 * `state.npcs` in place, which is what every write path in this layer does.
 *
 * The walk is per settlement, youngest first. Youngest first is not cosmetic:
 * `couldParent` refuses anybody already holding
 * {@link SIBLINGS_PER_HOUSEHOLD} children, so whoever is drawn on early
 * consumes capacity - and drawing the children in age order means a household
 * fills from the bottom, which is what a household looks like.
 */
export function seedTheFamiliesStandingInAPlace(
    state: WorldState,
    presentDay: number,
    roster: Roster = rosterOf(state)
): FamiliesSeeded {
    const { at, living } = roster;

    const byPlace = new Map<string, NpcRecord[]>();
    for (const npc of living) {
        if (npc.locationId === null) continue;
        const list = byPlace.get(npc.locationId);
        if (list) list.push(npc); else byPlace.set(npc.locationId, [npc]);
    }

    let households = 0;
    let places = 0;
    const touched = new Set<string>();

    // Sorted, so the pass is a function of the world and not of push order -
    // the same discipline `applyHouseholds` states for the same reason.
    for (const placeId of [...byPlace.keys()].sort()) {
        // Its own stream, keyed on the place. A new name, so no draw anywhere
        // else in any already-seeded world moves; keyed on the place rather
        // than on a counter, so adding a settlement to the gazetteer does not
        // reshuffle the families in every other one.
        const rng = forStream(state.seed, 'families-standing-here', placeId);

        const here = byPlace.get(placeId)!
            .slice()
            .sort((a, b) =>
                b.identity.bornOnDay - a.identity.bornOnDay || (a.id < b.id ? -1 : 1));
        if (here.length < 2) continue;

        let madeHere = 0;
        for (const child of here) {
            if (madeHere >= HOUSEHOLDS_PER_PLACE_CAP) break;
            // Read the record as it stands rather than the snapshot: an earlier
            // child in this same place may already have given them a parent.
            const childAt = at.get(child.id);
            if (childAt === undefined) continue;
            const current = state.npcs[childAt];
            if (current.relationships.some(r => r.kind === 'parent')) continue;
            if (!rng.chance(BORN_TO_SOMEBODY_STANDING_HERE)) continue;

            const childAge = ageInYears(current, presentDay);
            // Fresh records, because `couldParent` counts the parent's own
            // `child` ties and this pass has been writing them.
            // Never touches a tie this pass did not make, which is
            // `deepenService`'s rule and is load-bearing here for a measured
            // reason: `bind` upserts on the target id, so binding the head of a
            // house to the person standing next to them as a child would
            // OVERWRITE the `rival` row `seedFactions` wrote - "Was the other
            // candidate" - with "Their child." Measured before the guard: the
            // world's 34 seeded rivals fell to 15 and its 99 allies to 84.
            // A family does not get to eat the world's only other ties.
            const spoken = new Set(current.relationships.map(r => r.targetId));
            const candidates: NpcRecord[] = [];
            for (const other of here) {
                if (other.id === current.id) continue;
                if (spoken.has(other.id)) continue;
                const j = at.get(other.id);
                if (j === undefined) continue;
                const record = state.npcs[j];
                if (record.relationships.some(r => r.targetId === current.id)) continue;
                candidates.push(record);
            }
            const eligible = couldParent(candidates, childAge, presentDay);
            if (eligible.length === 0) continue;

            // A child is named for a parent where one of them is standing here.
            // Not a rule about families - it is the rule `seedLineages` and
            // `readALineageOffAName` already run on, applied in the one place it
            // is actually evidence: two people with the same name in the same
            // settlement, one old enough to be the other's parent.
            const surname = surnameOf(current.name);
            const named = eligible.filter(n => surnameOf(n.name) === surname);
            const pool = named.length > 0 ? named : eligible;
            const parent = pool[rng.int(0, pool.length - 1)];

            const household = bindNewbornToHousehold(
                state, current, parent.id, presentDay, roster);
            // The child's half is RETURNED rather than written, because the
            // function exists for a newborn that is not in `state.npcs` yet.
            // This one is, so it goes back.
            state.npcs[childAt] = household.child;

            touched.add(current.id);
            for (const id of household.parentIds) touched.add(id);
            for (const id of household.siblingIds) touched.add(id);
            households++;
            madeHere++;
        }
        if (madeHere > 0) places++;
    }

    return { households, peopleInAFamily: touched.size, places };
}
