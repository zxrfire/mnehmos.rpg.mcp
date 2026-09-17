/**
 * A house's own people take work off its board, and are paid what a player is.
 *
 * Ruled by the design owner: *"they ought to take them."* Most outer disciples
 * never earned merit, because the only service a house counted reached the top
 * of a roll. The board a player reads is the house's own reasons pitched at the
 * reader's rung and priced by `dutyTermsFor`; the same board and the same price
 * now reach the house's people. See `a-disciple-takes-work-off-the-board.ts`.
 *
 * Red-checked: pricing the taking off `whatServiceIsWorth` instead of the
 * notice's terms fails the terms assertion (it pays no stones), and a close that
 * does not pay the settled terms fails the payment assertion.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { SENDING_REASONS } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { aPostingAsAnOffer } from '../../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { dutyTermsFor } from '../../../src/engine/encounters/duties.js';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import {
    peopleTakeWorkOffTheirHousesBoard,
    theBoardWorkTheyAreOn,
    whatFinishingBoardWorkPays
} from '../../../src/engine/world/a-disciple-takes-work-off-the-board.js';

/** A seeded world, and a house in it with somebody standing well above its bottom rung. */
function aHouseWithASenior(seed: string): { state: WorldState; houseId: string; reach: number } {
    const { state } = seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 60 });
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || house.ranks.length === 0) continue;
        const reach = state.npcs
            .filter(n => n.status === 'alive' && n.factionId === house.id)
            .reduce((top, n) => Math.max(top, n.cultivation.realmOrdinal), -1);
        if (reach >= 10) return { state, houseId: house.id, reach };
    }
    throw new Error('no house with a senior in the fixture world');
}

function anOuterDisciple(state: WorldState, houseId: string, id: string, ordinal: number): NpcRecord {
    const row = state.npcs.find(n => n.status === 'alive' && n.factionId === houseId)!;
    const made: NpcRecord = {
        ...row,
        id,
        name: `Disciple ${id}`,
        factionId: houseId,
        factionRankIndex: 0,
        activity: null,
        merit: null,
        spiritStones: 0,
        tags: [],
        relationships: [],
        cultivation: { ...row.cultivation, realmOrdinal: ordinal }
    };
    state.npcs.push(made);
    return made;
}

/** Every price the board could quote a member at this rung, one per reason. */
function whatTheBoardQuotesAt(state: WorldState, houseId: string, ordinal: number, rankCount: number) {
    const house = state.factions.find(f => f.id === houseId)!;
    const membership = {
        factionId: houseId, factionName: house.name, rankIndex: 0, rankCount, contribution: 0
    };
    return SENDING_REASONS.map(reason => dutyTermsFor(
        aPostingAsAnOffer({ reason, house: { id: houseId, name: house.name }, pitchOrdinal: ordinal }),
        ordinal, membership, 'commission'
    )).map(t => ({ days: t.days, contribution: t.contribution, stones: t.stones }));
}

describe('an outer disciple takes work off their own house\'s board', () => {
    it('takes a notice with a term, on the terms a player at that rung is quoted', () => {
        const { state, houseId } = aHouseWithASenior('board-work-a');
        const rankCount = state.factions.find(f => f.id === houseId)!.ranks.length;
        const probe = anOuterDisciple(state, houseId, 'probe-outer', 3);
        const day = Math.floor(state.currentDay);

        peopleTakeWorkOffTheirHousesBoard(state, Math.floor(day / 365), day);

        const after = state.npcs.find(n => n.id === probe.id)!;
        expect(after.activity).not.toBeNull();
        const doing = after.activity!;
        expect(doing.untilDay).toBeGreaterThan(day);
        expect(doing.note.length).toBeGreaterThan(0);

        const terms = theBoardWorkTheyAreOn(after, doing.untilDay);
        expect(terms).not.toBeNull();
        expect(terms!.houseId).toBe(houseId);
        expect(whatTheBoardQuotesAt(state, houseId, 3, rankCount)).toContainEqual({
            days: doing.untilDay! - doing.sinceDay,
            contribution: terms!.contribution,
            stones: terms!.stones
        });
    });

    it('is paid those terms, merit and stones, when the term closes', () => {
        const { state, houseId } = aHouseWithASenior('board-work-b');
        const probe = anOuterDisciple(state, houseId, 'probe-paid', 4);
        const day = Math.floor(state.currentDay);

        peopleTakeWorkOffTheirHousesBoard(state, Math.floor(day / 365), day);
        const out = state.npcs.find(n => n.id === probe.id)!;
        const terms = theBoardWorkTheyAreOn(out, out.activity!.untilDay)!;
        expect(terms.contribution).toBeGreaterThan(0);

        const home = whatFinishingBoardWorkPays(out, out.activity!)!;
        expect(meritWith(home, houseId)).toBe(terms.contribution);
        expect(home.spiritStones).toBe(terms.stones);
        expect(theBoardWorkTheyAreOn(home, out.activity!.untilDay)).toBeNull();
    });

    it('is not taken by somebody already on a term, or by the top of the house', () => {
        const { state, houseId, reach } = aHouseWithASenior('board-work-c');
        const day = Math.floor(state.currentDay);
        const busy = anOuterDisciple(state, houseId, 'probe-busy', 3);
        busy.activity = {
            kind: 'out_with_a_party', note: 'Already out.', withIds: [],
            sinceDay: day, untilDay: day + 100, returnTo: null
        };
        const top = anOuterDisciple(state, houseId, 'probe-top', reach);

        peopleTakeWorkOffTheirHousesBoard(state, Math.floor(day / 365), day);

        expect(state.npcs.find(n => n.id === busy.id)!.activity!.untilDay).toBe(day + 100);
        expect(state.npcs.find(n => n.id === top.id)!.activity).toBeNull();
    });
});
