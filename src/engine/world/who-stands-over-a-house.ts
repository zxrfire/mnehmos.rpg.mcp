/**
 * The protector's chair: who is in it, and why most of them are empty.
 *
 * THE OFFICE AND ITS RULES ARE NOT HERE, and none of them is restated:
 * `docs/world/houses/offices-and-succession.md`, "The Protector", is the
 * design; `THE_OFFICE` in `false-immortals.ts` carries the ruling and the
 * count of who is serving; `HouseProtectorSchema` says what a declared null
 * means. This file is the reader those three never had.
 *
 * WHAT WAS MISSING, measured: three of thirty-eight houses declared the office
 * at all, all of them filled, none reserved - so the case the doc calls
 * universal could not be represented, and thirty-five houses read as having no
 * office rather than an empty one. `pairProtectors` calls itself the writer in
 * its own banner and has never had a caller. Neither has `protectorsOf`.
 *
 * ONE RULE AND ONLY THE BAR MOVES. The design owner: *"just treat empty
 * protector offices as an open office that nobody meets the criteria ... same
 * as the merit bar, just a different scale. for lesser sects it's reachable."*
 * Reserved where the lore reserves it, ordinary everywhere else, and a vacancy
 * is a bar nobody cleared rather than a branch.
 *
 * WHO MAY STAND IN IT IS NOT A KIND OF PERSON - rogues and beasts included, and
 * `a-family-that-came-down-from-a-changed-beast.ts` says why there is no branch
 * on which. WHETHER THEY GET IT is `theRoomAgreesTo`, the read that already
 * covers a headless house.
 *
 * DERIVED, NEVER STORED, so a chair empties and refills as the world moves.
 */

import { APEX_INSTITUTIONS } from '../../data/cultivation/governance-and-water-rights.js';
import { protectorsOf } from '../../data/cultivation/false-immortals.js';
import { WANDERERS } from '../../data/cultivation/wanderers.js';
import { isElderRank } from '../cultivation/leadership.js';
import { theRoomAgreesTo } from './somebody-covers-a-house-with-no-head.js';
import type { FactionRecord, WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';

/** What a house asks of whoever stands over it. */
export type ProtectorBar = 'reserved' | 'ordinary';

export interface TheChairOverAHouse {
    factionId: string;
    bar: ProtectorBar;
    /** Whoever is in it, or null for an office nobody currently meets. */
    heldBy: string | null;
    /** How many cleared the bar before the elders were asked. */
    considered: number;
}

/**
 * Whether this house holds its chair for a False Immortal.
 *
 * Two facts, both already in the catalog and neither written for this:
 * whether one ever served here, and whether the house is an apex.
 */
export function theChairIsHeldForAFalseImmortal(factionId: string): boolean {
    if (protectorsOf(factionId).length > 0) return true;
    return APEX_INSTITUTIONS.some(apex => apex.factionId === factionId);
}

/**
 * The rung somebody has to stand at to be worth putting in the chair.
 *
 * A protector stands for the house when something comes for it, so the bar is
 * what the house itself fields: somebody it could already field is not adding
 * anything, and that is the difference between a protector and a senior elder.
 *
 * The reserved bar is not a number here. Nobody in the world is a False
 * Immortal in post - `THE_OFFICE` says so and the schema refuses to seat
 * one - so the answer is that the bar is not met, and saying it in ordinals
 * would be inventing a figure for a condition that is already decided.
 */
export function whatTheChairAsks(house: FactionRecord): number {
    return Math.max(0, Number(house.resources.power_ordinal ?? 0)) + 1;
}

/**
 * Everybody the world holds who could stand over this house.
 *
 * Its own people, the people of other houses, and the unaffiliated alike: the
 * chair is not a promotion and nothing here asks where somebody is from.
 *
 * Anybody the record says is not serving is out of the pool: `servingNow` is a
 * field on each False Immortal and it is theirs, not a rule about their kind.
 * Measured, without reading it, the search seated Lu Sheng in the Empyrean
 * Court's chair.
 */
function whoClearsTheBar(state: WorldState, bar: number): NpcRecord[] {
    const walking = new Set(WANDERERS.filter(w => w.theCatalogStatesTheyAreStanding).map(w => w.recordName));
    return state.npcs
        .filter(npc => npc.status === 'alive'
            && npc.cultivation.realmOrdinal >= bar
            && !walking.has(npc.name))
        .sort((a, b) => (b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)
            || a.id.localeCompare(b.id));
}

/**
 * Who stands over this house, asked fresh.
 */
export function whoStandsOverThisHouse(
    state: WorldState,
    house: FactionRecord,
    /**
     * People already standing over somebody else.
     *
     * ONE PERSON, ONE CHAIR. Asked house by house with no memory between, the
     * same strongest person in the province came back for four houses at once -
     * measured, one rogue standing over the Verdant Spring Valley, the Clear
     * River Alliance, the Burnt Earth Temple and the Azure Dew Sect. A
     * protector stands for a house when something comes for it and cannot be in
     * four compounds, which is why `pairProtectors` matched each thing to at
     * most one house. See `theChairsOfTheWorld`, which threads this.
     */
    taken: ReadonlySet<string> = new Set()
): TheChairOverAHouse {
    const bar: ProtectorBar =
        theChairIsHeldForAFalseImmortal(house.id) ? 'reserved' : 'ordinary';

    // THE RESERVED CHAIR IS NOT SEARCHED. Not as an optimisation: there is
    // nobody to find, and running the ordinary search over it would seat the
    // strongest cultivator in the world in a chair the house has refused to
    // give to anybody who is not a False Immortal for eight hundred years.
    if (bar === 'reserved') {
        return { factionId: house.id, bar, heldBy: null, considered: 0 };
    }

    const roll = state.npcs
        .filter(npc => npc.status === 'alive' && npc.factionId === house.id
            && isElderRank(npc.factionRankIndex, Math.max(1, house.ranks.length)))
        .map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex }));

    const able = whoClearsTheBar(state, whatTheChairAsks(house)).filter(who => !taken.has(who.id));
    let considered = 0;
    for (const who of able) {
        considered++;
        if (theRoomAgreesTo(who.id, { roll, rankCount: Math.max(1, house.ranks.length) })) {
            return { factionId: house.id, bar, heldBy: who.id, considered };
        }
    }
    return { factionId: house.id, bar, heldBy: null, considered };
}

/**
 * Every chair in the world, which is one per house because the office always
 * exists.
 */
export function theChairsOfTheWorld(state: WorldState): TheChairOverAHouse[] {
    // STRONGEST HOUSE FIRST, which is the order `pairProtectors` already used
    // and for its reason: the house with the most to offer had the first call
    // on whoever was available. Ties run to the id so two identical houses
    // resolve the same way in every world.
    const houses = state.factions
        .filter(house => house.dissolvedOnDay === null)
        .sort((a, b) => (Number(b.resources.power_ordinal ?? 0) - Number(a.resources.power_ordinal ?? 0))
            || a.id.localeCompare(b.id));
    const taken = new Set<string>();
    const out: TheChairOverAHouse[] = [];
    for (const house of houses) {
        const chair = whoStandsOverThisHouse(state, house, taken);
        if (chair.heldBy !== null) taken.add(chair.heldBy);
        out.push(chair);
    }
    return out;
}
