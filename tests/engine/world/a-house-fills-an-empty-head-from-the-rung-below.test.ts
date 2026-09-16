/**
 * A house whose head is gone fills the chair from the rung below.
 *
 * `seatsAtRank` returned 0 for the head rung, on the grounds that succession
 * "lives elsewhere". Nothing anywhere did it. Measured with
 * `scripts/probe-does-a-house-keep-its-shape.ts` on seed `shape-a` over 2,500
 * years: the head rung took in nobody by promotion, lost about 0.18 people per
 * house per century, and the 38 catalog houses went from 38 heads to 0 while
 * every other rung stayed between 0.7 and 0.95 filled. The only heads left were
 * founders of houses a splinter had just made.
 *
 * What the rule is NOT allowed to do is the reason the 0 was there: install a
 * weaker head over a living one. The chair is one seat, and a held seat has no
 * room.
 */

import { describe, it, expect } from 'vitest';
import { assessPromotions, ordinalExpectedAt } from '../../../src/engine/world/promotion-inside-a-house.js';
import { createNpc, PLAYER_ROW_TAG, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const RANKS = ['Outer', 'Inner', 'Core', 'Elder', 'Grand Elder', 'Head'];
const HEAD = RANKS.length - 1;
const house = makeFaction({
    id: 'house-not-in-any-catalog', name: 'The Test Hall', ranks: RANKS,
    resources: { admission_ordinal: 2, power_ordinal: 30 }
});
const headBar = ordinalExpectedAt(HEAD, RANKS.length, 2, 30);

function member(id: string, rank: number, ordinal: number): NpcRecord {
    const npc = createNpc('succession', { id, bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: ordinal } });
    // Served past every rung's minimum, so only the chair and the bar are being asked.
    return { ...npc, factionId: house.id, factionRankIndex: rank, merit: { houseId: house.id, points: 1e9 } };
}

function world(npcs: NpcRecord[]): WorldState {
    return { factions: [house], npcs } as unknown as WorldState;
}

const below = [member('o', 0, 3), member('i', 1, 8), member('c', 2, 14), member('e', 3, 20)];

describe('the head rung', () => {
    it('is filled from the rung below when it stands empty', () => {
        const grand = member('g', HEAD - 1, headBar);
        const { promotions } = assessPromotions(world([...below, grand]));
        expect(promotions).toContainEqual(expect.objectContaining({ npcId: 'g', toRank: HEAD }));
    });

    it('never takes somebody over a living head, however strong', () => {
        const grand = member('g', HEAD - 1, headBar + 10);
        const head = member('h', HEAD, headBar);
        const { promotions, blocked } = assessPromotions(world([...below, grand, head]));
        expect(promotions.some(p => p.toRank === HEAD)).toBe(false);
        expect(blocked).toContainEqual(expect.objectContaining({ npcId: 'g', reason: 'no_seat' }));
    });

    it('is not held open for the player, whom the world never raises', () => {
        // The player's row counted as a candidate, took the room and was never
        // written, so the chair stood empty behind them every year.
        const player = { ...member('p', HEAD - 1, headBar + 5), tags: [PLAYER_ROW_TAG] };
        const grand = member('g', HEAD - 1, headBar);
        const { promotions } = assessPromotions(world([...below, player, grand]));
        expect(promotions.some(p => p.npcId === 'p')).toBe(false);
        expect(promotions).toContainEqual(expect.objectContaining({ npcId: 'g', toRank: HEAD }));
    });

    it('stays empty when nobody below clears the head bar', () => {
        const grand = member('g', HEAD - 1, headBar - 1);
        const { promotions } = assessPromotions(world([...below, grand]));
        expect(promotions.some(p => p.toRank === HEAD)).toBe(false);
    });
});
