/**
 * WHAT A HOUSE REFINES IN: the cauldrons and refining furnaces a treasury is
 * seeded with.
 *
 * Every house makes medicine and every house makes artifacts, so every house
 * keeps both vessels: a counted cupboard of the plain ones in the room the craft
 * is done in (`REFINING_VESSELS[kind].keptIn`), and a graded vessel of each kind
 * with a history, filed where every tracked thing is filed.
 *
 * ── THE GRADE IS WHAT THE HOUSE CAN MAKE ─────────────────────────────────
 *
 * Read off the roll rather than off the catalog's standing: the best hand the
 * house actually has, and the best grade that hand can work (`canRefineGrade`,
 * through `bestFurnaceAHouseCouldKeep`, which stops at heaven because nothing
 * past it is made below the Lid). A vessel nobody in the house could work is an
 * ornament, which is the rule the treasury already keeps.
 *
 * ── AND A FOCUSED HOUSE KEEPS BETTER ONES ────────────────────────────────
 *
 * *"Almost everyone can do it, few focus exclusively on it."* So every house keeps
 * a graded vessel of each kind at the grade its best hand can work, and the few
 * houses `whatAHouseIsFocusedOn` names as making the craft their trade keep MORE
 * of them: twice the cupboard, the same twice their craft room is cut larger by,
 * and a second graded vessel. A difference of degree, as ruled.
 */

import { SECTS } from '../../data/cultivation/sects.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import {
    REFINING_VESSELS,
    howMuchACauldronIsWorthTracking,
    whatACauldronIsWorthInAFight,
    type RefiningVesselKind
} from '../cultivation/what-you-refine-in.js';
import {
    A_HOUSE_FOCUSED_ON_A_CRAFT_CUTS_ITS_ROOM_THIS_MUCH_LARGER,
    whatAHouseIsFocusedOn,
    type RoomPurpose
} from './architecture.js';
import { makeObject, makeResourceLot, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/** Whether this house's trade is the craft this kind of vessel is for. */
export function isFocusedOnTheCraftOf(houseId: string, kind: RefiningVesselKind): boolean {
    const focus = whatAHouseIsFocusedOn({ specialities: SECTS.find(s => s.id === houseId)?.specialities ?? [] });
    return REFINING_VESSELS[kind].makes === 'medicine' ? focus.pills : focus.artifacts;
}

/** The best rung anybody alive on this house's roll stands at, or -1 for nobody. */
export function theBestHandOnTheRoll(state: Pick<WorldState, 'npcs'>, houseId: string): number {
    let best = -1;
    for (const npc of state.npcs) {
        if (npc.factionId !== houseId || npc.status !== 'alive') continue;
        best = Math.max(best, npc.cultivation.realmOrdinal);
    }
    return best;
}

/**
 * The grade of the graded vessels of a kind a house keeps, or null where it keeps
 * only the plain ones: nobody on the roll, or nobody past mortal grade.
 */
export function theGradeOfTheVesselAHouseKeeps(input: {
    bestHand: number;
    /** `bestFurnaceAHouseCouldKeep`, passed in so this file does not import the treasury. */
    bestItCouldKeep: (ordinal: number) => TechniqueGrade;
}): TechniqueGrade | null {
    if (input.bestHand < 0) return null;
    const kept = input.bestItCouldKeep(input.bestHand);
    return kept === 'mortal' ? null : kept;
}

/** How many graded vessels of a kind a house keeps: one, and a second where the craft is its trade. */
export function howManyGradedVesselsAHouseKeeps(focused: boolean): number {
    return focused ? 2 : 1;
}

/**
 * Both kinds of vessel for one house.
 *
 * The cauldron rows keep the ids they have always had (`cauldrons-plain-<id>`,
 * `furnace-<id>`), so anything that already names one still finds it. The furnace
 * is `vessel-refining-furnace-<id>` and a focused house's second vessel of either
 * kind is `vessel-<kind>-second-<id>`: a house lends its tracked things in id
 * order (`whatIsWorthLending`), and names that sorted ahead of the treasury would
 * have put more vessels in the loans a house makes than it ever put there before.
 */
export function theVesselsAHouseKeeps(input: {
    state: Pick<WorldState, 'npcs' | 'currentDay'>;
    houseId: string;
    houseName: string;
    foundedOnDay: number;
    /** How many plain ones an unfocused house of this standing has. */
    plainCount: number;
    /** Days since the house last had a peak, for how long a vessel has been its. */
    heldSinceDay: number;
    roomFor: (purpose: RoomPurpose | null) => string | null;
    /** Where the treasury files a row of this kind and significance. */
    filedIn: (kind: ObjectRecord['kind'], significance: ObjectRecord['significance'], tags: string[]) => RoomPurpose | null;
    bestItCouldKeep: (ordinal: number) => TechniqueGrade;
}): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const name = input.houseName;
    const bestHand = theBestHandOnTheRoll(input.state, input.houseId);
    for (const vessel of Object.values(REFINING_VESSELS)) {
        const focused = isFocusedOnTheCraftOf(input.houseId, vessel.kind);
        const isCauldron = vessel.kind === 'cauldron';

        // ── THE COUNTED HALF ─────────────────────────────────────────────
        const plain = makeResourceLot({
            id: isCauldron ? `cauldrons-plain-${input.houseId}` : `${vessel.kind}s-plain-${input.houseId}`,
            resource: vessel.plainName,
            quantity: focused
                ? input.plainCount * A_HOUSE_FOCUSED_ON_A_CRAFT_CUTS_ITS_ROOM_THIS_MUCH_LARGER
                : input.plainCount,
            source: `the ${name} stores`,
            acquiredOnDay: input.foundedOnDay,
            holderId: null,
            holderName: name,
            how: 'crafted',
            significance: 'mundane'
        });
        plain.ownerId = input.houseId;
        plain.ownerName = name;
        plain.tags = [vessel.tag];
        plain.locationId = input.roomFor(input.filedIn('other', 'mundane', plain.tags));
        plain.description =
            `The ${vessel.plainName} a house hands out without writing anything down. They crack, `
            + 'they get replaced, and nobody has ever asked which one they were given.';
        out.push(plain);

        // ── AND THE TRACKED HALF ─────────────────────────────────────────
        const grade = theGradeOfTheVesselAHouseKeeps({ bestHand, bestItCouldKeep: input.bestItCouldKeep });
        if (grade === null) continue;
        for (let nth = 0; nth < howManyGradedVesselsAHouseKeeps(focused); nth++) {
        const significance = howMuchACauldronIsWorthTracking(grade);
        const tags = [vessel.tag, 'defensive', `grade:${grade}`];
        // BARE `furnace` NAMED THE WRONG ONE OF THREE. The design owner's
        // ruling is that the word does not stand unqualified where a player
        // reads it: the alchemy vessel is a **cauldron** (*"honestly we say
        // cauldron, both can work"* - a pill furnace is the same thing said the
        // other way), the forging vessel is an **artifact furnace**, and a
        // **cultivation furnace** is a person. This line called the cauldron a
        // bare furnace, which is the one reading that could be any of the three.
        const what = isCauldron ? 'cauldron' : 'artifact furnace';
        out.push(makeObject({
            id: nth > 0
                ? `vessel-${vessel.kind}-second-${input.houseId}`
                : isCauldron ? `furnace-${input.houseId}` : `vessel-refining-furnace-${input.houseId}`,
            name: nth > 0 ? `the ${name}'s second ${what}` : `the ${name} ${what}`,
            kind: 'artifact',
            significance,
            description:
                `The ${what} the ${name} halls work at, which is one ${what} and not a cupboard of `
                + 'them. Who is standing at it on a given day is a question the house answers, and '
                + 'changes its mind about.',
            possessorId: null,
            ownerId: input.houseId,
            ownerName: name,
            power: whatACauldronIsWorthInAFight(grade),
            locationId: input.roomFor(input.filedIn('artifact', significance, tags)),
            tags,
            data: { grade, heldSinceDay: input.heldSinceDay }
        }));
        }
    }
    return out;
}
