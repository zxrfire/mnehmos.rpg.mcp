/**
 * A member of a house has quarters at its seat, and the rung decides how good.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `promotion-inside-a-house.ts` rests its whole model on seats being scarce
 * because the things that fill them are - stipends, QUARTERS, a share of the
 * vein - and nothing anywhere gave anybody quarters. `seclusion-verbs.ts`
 * stated the opposite as settled fact in the same tree. The design owner:
 * sects assign you rooms, so you can put your things in your room.
 *
 * MEASURED ON A SEEDED WORLD (`quarters-probe`, 400 people, the real catalog)
 * before any of this existed:
 *
 *     38 houses, 1,154 locations
 *     37 dormitories   every one named `the <rank>s' quarters`
 *     38 residences    every one named `the <top rank>'s residence`
 *     0                assigned to anybody
 *
 * So the buildings were already there and already named for a rank. Only the
 * assignment was missing, which is what these assertions pin.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEHAVIOUR: a rung reaches as deep a room as its rank goes, the capacity a
 * house gives a rung rises with what that house pays that rung, and whether
 * somebody shares is counted off the roll rather than declared.
 *
 * NOT ASSERTED: which room index a given rank lands on, how many dormitories a
 * compound has, or any particular litre figure. Those are the compound's
 * business and they move when worldgen does. What must not move is that a
 * higher rung is housed at least as well as a lower one.
 *
 * RED-CHECKED. Reverting `whichRoomARungGets` to return `rooms[0]` turns the
 * deepest-room test red; dropping the stipend ratio out of
 * `howMuchRoomAQuartersHas` turns the capacity tests red.
 */

import { describe, expect, it } from 'vitest';

import {
    WHAT_A_CHEST_HOLDS,
    howMuchRoomAQuartersHas,
    theLodgingsOfAHouse,
    theQuartersOf,
    whereAHouseLetsYouKeepThings,
    whichRoomARungGets,
    type LodgingRoom
} from '../../../src/engine/world/the-room-a-house-gives-you';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { createNpc } from '../../../src/engine/world/npc-state';

const DAY = 400_000;
const HOUSE = 'sect-under-test';

/** A compound with a shared hall low down and one room at the far end. */
function aCompound(): WorldState {
    const state = createWorld({ seed: 'quarters-engine', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    for (const [index, purpose, name] of [
        [1, 'dormitory', "the outer disciples' quarters"],
        [6, 'residence', "the sect master's residence"]
    ] as const) {
        state.locations.push(makeLocation({
            id: `${HOUSE}-p${index}-${purpose}`,
            name: `A House: ${name}`,
            kind: 'hall',
            controllingFactionId: HOUSE,
            data: { purpose, precinctIndex: index, rank: index === 1 ? 'Outer Disciple' : 'Master' }
        }));
    }
    return state;
}

function memberAt(state: WorldState, id: string, rankIndex: number): void {
    const npc = createNpc(state.seed, {
        id, name: id, bornOnDay: DAY - 40 * 365, onDay: DAY, locationId: null
    });
    npc.factionId = HOUSE;
    npc.factionRankIndex = rankIndex;
    state.npcs.push(npc);
}

describe('a house lodges its own, and the rung says where', () => {
    it('finds the rooms a compound already had, outermost first', () => {
        const rooms = theLodgingsOfAHouse(aCompound(), HOUSE);
        expect(rooms.map(room => room.purpose)).toEqual(['dormitory', 'residence']);
        expect(rooms[0].precinctIndex).toBeLessThan(rooms[1].precinctIndex);
    });

    it('gives a rung the deepest room it reaches, and the top rung the far one', () => {
        const rooms = theLodgingsOfAHouse(aCompound(), HOUSE);
        expect(whichRoomARungGets(rooms, 6)!.purpose).toBe('residence');
        expect(whichRoomARungGets(rooms, 3)!.purpose).toBe('dormitory');
    });

    it('still lodges somebody whose rung is outside every lodging wall', () => {
        // A servant at rank 0 stands outside the first quartered precinct and
        // still sleeps somewhere. Nowhere at all would be the engine saying a
        // house takes people in and does not house them.
        const rooms = theLodgingsOfAHouse(aCompound(), HOUSE);
        expect(whichRoomARungGets(rooms, 0)).not.toBeNull();
        expect(whichRoomARungGets(rooms, 0)!.purpose).toBe('dormitory');
    });

    it('answers nothing for a house that lodges nobody', () => {
        expect(whichRoomARungGets([] as LodgingRoom[], 3)).toBeNull();
    });
});

describe('what the room holds is what the house pays that rung', () => {
    it('gives the bottom rung a chest and nothing less', () => {
        expect(howMuchRoomAQuartersHas(4, 4)).toBe(WHAT_A_CHEST_HOLDS);
        // A house that states no stipend at all still houses somebody. A floor
        // is honest where a zero is not.
        expect(howMuchRoomAQuartersHas(0, 0)).toBe(WHAT_A_CHEST_HOLDS);
    });

    it('rises with the house\'s own ladder rather than with a table here', () => {
        // Azure Cloud pays 4 at the bottom and 380 at Sword Elder.
        const disciple = howMuchRoomAQuartersHas(4, 4);
        const elder = howMuchRoomAQuartersHas(380, 4);
        expect(elder).toBeGreaterThan(disciple);
        expect(elder / disciple).toBeCloseTo(380 / 4, 5);
    });

    it('houses a generous house\'s rung better than a mean one\'s same rung', () => {
        // The whole reason a seat is worth having is that houses differ. A flat
        // figure per rank index would make every house's elder identical.
        const generous = howMuchRoomAQuartersHas(750, 3);
        const mean = howMuchRoomAQuartersHas(170, 3);
        expect(generous).toBeGreaterThan(mean);
    });

    it('never falls as the rung rises', () => {
        const ladder = [4, 12, 35, 110, 380, 650, 1_100];
        const rooms = ladder.map(pay => howMuchRoomAQuartersHas(pay, ladder[0]));
        for (let i = 1; i < rooms.length; i++) expect(rooms[i]).toBeGreaterThanOrEqual(rooms[i - 1]);
    });
});

describe('sharing is counted off the roll, not declared on a rank', () => {
    it('has an outer disciple sharing and the seat alone', () => {
        const state = aCompound();
        memberAt(state, 'npc-a', 1);
        memberAt(state, 'npc-b', 2);
        memberAt(state, 'npc-c', 3);
        memberAt(state, 'npc-head', 6);

        const disciple = theQuartersOf(state, {
            factionId: HOUSE, personId: 'npc-a', rankIndex: 1,
            stipendAtRung: 4, stipendAtEntry: 4
        })!;
        const head = theQuartersOf(state, {
            factionId: HOUSE, personId: 'npc-head', rankIndex: 6,
            stipendAtRung: 1_100, stipendAtEntry: 4
        })!;

        expect(disciple.shareWith).toBeGreaterThan(0);
        expect(head.shareWith).toBe(0);
        expect(head.room).toBeGreaterThan(disciple.room);
    });

    it('does not count the dead, who are not in the room', () => {
        const state = aCompound();
        memberAt(state, 'npc-a', 1);
        memberAt(state, 'npc-b', 2);
        const dead = state.npcs.find(npc => npc.id === 'npc-b')!;
        dead.status = 'physically_dead';

        expect(theQuartersOf(state, {
            factionId: HOUSE, personId: 'npc-a', rankIndex: 1,
            stipendAtRung: 4, stipendAtEntry: 4
        })!.shareWith).toBe(0);
    });
});

describe('the pack key moves with the person and not with the room', () => {
    it('is the same key at every rung, so promotion strands nothing', () => {
        const state = aCompound();
        const low = theQuartersOf(state, {
            factionId: HOUSE, personId: 'npc-a', rankIndex: 1,
            stipendAtRung: 4, stipendAtEntry: 4
        })!;
        const high = theQuartersOf(state, {
            factionId: HOUSE, personId: 'npc-a', rankIndex: 6,
            stipendAtRung: 1_100, stipendAtEntry: 4
        })!;
        expect(low.locationId).not.toBe(high.locationId);
        expect(low.holderId).toBe(high.holderId);
    });

    it('is a different key for two people in one hall', () => {
        expect(whereAHouseLetsYouKeepThings(HOUSE, 'npc-a'))
            .not.toBe(whereAHouseLetsYouKeepThings(HOUSE, 'npc-b'));
    });
});
