/**
 * Who ends up standing in a house's protector chair.
 *
 * `HouseProtectorSchema` has been on `SectSchema` for some time, fully
 * designed - the policy, the vacancy, the three roads into the seat, the rule
 * that a member is never told who is in it. Nothing in the catalog wrote one
 * and nothing in `src/` read one, which is AGENTS.md's "a field nothing writes"
 * exactly. This is the writer.
 *
 * ── IT IS A ROLE WITH AN OCCUPANT, AND THERE IS NO BRANCH ON WHICH ─────────
 *
 * The design owner: protectors are not only beasts, they CAN be beasts, and a
 * retired grand patriarch is one too. So this produces a `heldBy` id and says
 * nothing else about what is standing there. `false-immortals.ts` already
 * describes the ordinary case - "a Nascent Soul who does not travel, a Core
 * Formation veteran who has been there forty years" - and
 * `a-family-that-came-down-from-a-changed-beast.ts` is explicit that a branch
 * on "is this a beast" near a social question means the design went wrong.
 *
 * ── THE RATE IS THE POPULATION, AND THERE IS NO DIAL ──────────────────────
 *
 * AGENTS.md: rarity is a population statement, not a price. Nothing here rolls
 * and nothing here is a probability. A chair is filled when the world happens
 * to hold somebody who could stand in it, so the count falls out of two counts
 * that were already fixed - how many things stand at `BEAST_CHANGE_ORDINAL` on
 * ground a house also wanted, and how many houses have somebody of their own
 * sealed at strength. If the number is wrong the fix is in those catalogs.
 *
 * ── WHY GROUND IS THE WHOLE PREMISE ───────────────────────────────────────
 *
 * A beast sits on the best ground it can hold; a house wants the best ground it
 * can hold. They were always going to meet, and what happened after the meeting
 * is the history. `powerOrdinal` is the house's half of that - see the field -
 * and `beastsOnThisGround` is the beast's, the same reader hunting already
 * uses, so there is no second opinion about what survives where.
 *
 * ── ELEMENT IS PREFERRED AND NEVER REQUIRED ───────────────────────────────
 *
 * "If available" is load-bearing: six kinds stand at 29 or above against
 * thirty-five houses, so requiring a shared element would make the arrangement
 * a hunt for a coincidence. A shared element decides WHICH house a thing sits
 * beside when more than one is open to it. It never decides whether.
 *
 * Nothing here reads which element either value is. They are compared.
 *
 * Pure and deterministic: same catalog, same pairings, in every world.
 */

import type { Element } from '../cultivation/spirit-roots.js';
import { BEAST_CHANGE_ORDINAL } from '../../data/cultivation/beasts.js';
import { beastsOnThisGround } from './hunting-a-spirit-beast.js';

/** A house, as the ground question needs it. */
export interface HouseOnItsGround {
    factionId: string;
    /**
     * THIS IS THE GROUND READ, and it is the seeder's own sentence rather than
     * a proxy invented here: a sect took the best ground it could hold, and
     * `powerOrdinal` is exactly how much it could hold - `seedSectGround` feeds
     * this number straight into the qi density of the compound it builds. So
     * the house standing on the ground a thing at this rung also wanted is the
     * strongest house, and no threshold has to be picked.
     *
     * TWO OTHER GROUND FIELDS WERE TRIED AND BOTH ARE WRONG.
     * `CatalogFaction.holdsVein` is `Boolean(parent.holds)` over a description
     * string every faction carries, so it reads true for all thirty-five and
     * separates nobody. A region's `qiDensity` is province-wide and puts the
     * White Ape beside the Stonewright Consortium, when its own entry says it
     * holds the gorge above the Jade Gorge - which is the Pavilion's. Power
     * lands on the catalog's stated answer; the other two do not.
     */
    powerOrdinal: number;
    /** From its manuals - `houseElementalCharacterOf`. Null where it has none. */
    element: Element | null;
}

/** Whoever could stand in a chair, reduced to what the pairing reads. */
export interface CouldStandInAChair {
    id: string;
    ordinal: number;
    element: Element | null;
}

export interface ProtectorPairing {
    factionId: string;
    /** The occupant's id. What kind of thing it is is not this module's business. */
    heldBy: string;
    /** Both carry the same element. A reading, never a condition of the pairing. */
    sharedElement: boolean;
}

/**
 * What could keep a house company at all.
 *
 * Three readings off the catalog, none of them written for protectors:
 *
 *   ordinal          at or past the change it is somebody, and only somebody
 *                    can be a party to an arrangement.
 *   disposition      demonic is the catalog's own word for taking from people
 *                    who did not agree. That is the thing under a mountain
 *                    rather than the thing beside a house, and it is the one
 *                    exclusion here.
 *   veinRelation     `holds` means territorial about one vein and will not be
 *                    moved off it. A thing indifferent to ground never ends up
 *                    beside anybody; a fox that prices everything including you
 *                    is a trading partner and not a guardian.
 *
 * The ground is a house's ground: on a vein, not inside closed ground. That
 * drops every `sealed_only` entry, which is correct and is also the module's
 * sharpest limitation - see the note at the bottom of the file.
 */
export function thingsThatCouldStandOverAHouse(): CouldStandInAChair[] {
    return beastsOnThisGround({ onAVein: true, sealed: false })
        .filter(b =>
            b.ordinal >= BEAST_CHANGE_ORDINAL
            && b.disposition !== 'demonic'
            && b.veinRelation === 'holds')
        .map(b => ({ id: b.id, ordinal: b.ordinal, element: b.element ?? null }))
        .sort((a, b) => (b.ordinal - a.ordinal) || a.id.localeCompare(b.id));
}

/**
 * Match each thing to at most one house, and each house to at most one thing.
 *
 * Deepest first, because the strongest thing took the ground it wanted before
 * anything else had a say. Among the houses still open to it, one that shares
 * its element; failing that, the strongest. The tiebreak runs
 * to the id so two houses that are otherwise identical resolve the same way in
 * every world.
 */
export function pairProtectors(
    houses: readonly HouseOnItsGround[],
    pool: readonly CouldStandInAChair[]
): ProtectorPairing[] {
    const open = [...houses].sort((a, b) =>
        (b.powerOrdinal - a.powerOrdinal) || a.factionId.localeCompare(b.factionId));
    const taken = new Set<string>();
    const out: ProtectorPairing[] = [];

    for (const thing of pool) {
        const free = open.filter(h => !taken.has(h.factionId));
        if (free.length === 0) break;
        const shared = thing.element === null
            ? undefined
            : free.find(h => h.element === thing.element);
        const house = shared ?? free[0];
        taken.add(house.factionId);
        out.push({
            factionId: house.factionId,
            heldBy: thing.id,
            sharedElement: house.element !== null && house.element === thing.element
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS CANNOT SEE YET
//
// A house's ground is read as open ground on a vein, so a house whose ground
// INCLUDES closed ground is invisible here. The Weir Office has refused four
// applications to open the cut face and has not written down why, and the
// Sleeper is walled into that face at ordinal 30 - which is the plainest truce
// in the catalog and this module cannot produce it, because a `sealed_only`
// entry is filtered out one line above. Giving a faction a "and the sealed
// pockets it holds the grant over" fact would fix it and is a catalog change
// rather than a change here.
// ─────────────────────────────────────────────────────────────────────────
