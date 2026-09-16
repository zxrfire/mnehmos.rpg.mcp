/**
 * Who a house raises: two gates, then realm, then merit.
 *
 * Ruled by the design owner. A rung has a minimum realm and a MINIMUM MERIT, and
 * both are gates before any ordering - "don't forget there is a min merit". Of
 * the people through both, somebody a whole major realm up wins; within a
 * realm the early, middle and late stages do not decide, service does; being
 * chosen counts as service within a realm and never lifts anybody across one.
 * Before this, merit did not exist on a world row at all and the order was
 * "chosen first, then the tallest".
 *
 * And the elder band seats as many WITH an office as the house has offices. An
 * exceptional candidate - a whole realm above the elder bar, with the merit - can
 * be made an elder with no office when every office is held, up to a small share
 * the house will carry: "if you're REALLY good you get elder with no office (they
 * don't want too many of those obviously)".
 *
 * Merit is `NpcRecord.merit`, in the units a player's `contribution` is in, held
 * against one house and read through `meritWith`. The minimum is the player's
 * own curve, `requiredContributionForRank`.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { assessPromotions, meritNeededFor, ordinalExpectedAt } from '../../../src/engine/world/promotion-inside-a-house.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { creditMerit, meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { giveThisYearsAttention } from '../../../src/engine/world/who-is-given-attention-this-year.js';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';

const RANKS = ['Outer', 'Inner', 'Core', 'True', 'Elder', 'Grand Elder', 'Head'];
const HOUSE = 'house-not-in-any-catalog';
const house = makeFaction({
    id: HOUSE, name: 'The Test Hall', ranks: RANKS,
    resources: { admission_ordinal: 2, power_ordinal: 30 }
});

function member(id: string, rank: number, ordinal: number, merit: number, tags: string[] = []): NpcRecord {
    const npc = createNpc('merit', { id, bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: ordinal } });
    return { ...npc, factionId: HOUSE, factionRankIndex: rank, tags, merit: merit > 0 ? { houseId: HOUSE, points: merit } : null };
}

/** Rooms the way the architecture writes them: a location naming the house and what it is for. */
function rooms(...purposes: string[]) {
    return purposes.map(purpose => ({ id: `room-${purpose}`, data: { factionId: HOUSE, purpose } }));
}

function world(npcs: NpcRecord[], locations: unknown[] = []): WorldState {
    return { factions: [house], npcs, locations } as unknown as WorldState;
}

function outcome(state: WorldState, id: string) {
    const { promotions, blocked } = assessPromotions(state);
    return promotions.find(p => p.npcId === id) ?? blocked.find(b => b.npcId === id) ?? null;
}

describe('merit is held against the house that counts it', () => {
    it('reads as nothing for any other house, and starts again in a new one', () => {
        const npc = member('m', 0, 5, 400);
        expect(meritWith(npc, HOUSE)).toBe(400);
        expect(meritWith(npc, 'another-house')).toBe(0);
        const moved = creditMerit({ ...npc, factionId: 'another-house' }, 30);
        expect(moved.merit).toEqual({ houseId: 'another-house', points: 30 });
    });

    it('survives a save', () => {
        const db = new Database(':memory:');
        migrate(db);
        const repo = new WorldStateRepository(db);
        const state = createWorld({ seed: 'merit-save', presentYear: 1000, regionCount: 1 });
        state.npcs.push(member('served', 2, 14, 1234));
        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        expect(loaded.npcs.find(n => n.id === 'served')!.merit).toEqual({ houseId: HOUSE, points: 1234 });
        expect(loaded).toEqual(state);
        db.close();
    });

    it('is credited to somebody who gives attention', () => {
        const state = createWorld({ seed: 'merit-teach', presentYear: 1000, regionCount: 1 });
        const here = state.locations[0]!.id;
        const master = { ...member('master', 4, 22, 0), locationId: here, activity: null };
        const disciple = {
            ...member('disciple', 1, 9, 0), locationId: here, activity: null,
            relationships: [{
                targetId: 'master', targetName: 'master', kind: 'master' as const, standing: 0.6,
                note: '', sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null
            }]
        };
        state.factions.push(house);
        state.npcs.push(master, disciple);
        giveThisYearsAttention(state, Math.floor(state.currentDay / 365), state.currentDay);
        const after = state.npcs.find(n => n.id === 'master')!;
        expect(after.activity?.kind).toBe('teaching');
        expect(meritWith(after, HOUSE)).toBeGreaterThan(0);
    });
});

describe('the order a house raises people in', () => {
    const bar1 = ordinalExpectedAt(1, RANKS.length, 2, 30);

    it('blocks somebody tall enough who has not served, and says so', () => {
        const state = world([member('tall', 0, 20, meritNeededFor(1) - 1)]);
        expect(outcome(state, 'tall')).toMatchObject({ reason: 'not_enough_merit' });
    });

    it('gives the seat to a whole realm up over more merit', () => {
        const state = world([member('higher', 0, 13, meritNeededFor(1)), member('served', 0, 12, 50_000)]);
        expect(outcome(state, 'higher')).toMatchObject({ toRank: 1, decidedBy: 'realm' });
        expect(outcome(state, 'served')).toMatchObject({ reason: 'outranked' });
    });

    it('decides by merit within a realm, not by the stage inside it', () => {
        const state = world([member('later', 0, 12, 150), member('served', 0, Math.max(bar1, 8), 1000)]);
        expect(outcome(state, 'served')).toMatchObject({ toRank: 1, decidedBy: 'merit' });
        expect(outcome(state, 'later')).toMatchObject({ reason: 'outranked' });
    });

    it('counts being chosen as merit within a realm and never across one', () => {
        const within = world([member('chosen', 0, 12, 150, ['chosen']), member('served', 0, 12, 200)]);
        expect(outcome(within, 'chosen')).toMatchObject({ toRank: 1 });

        const across = world([member('chosen', 0, 12, 150, ['chosen']), member('higher', 0, 13, 100)]);
        expect(outcome(across, 'higher')).toMatchObject({ toRank: 1, decidedBy: 'realm' });
    });
});

describe('an elder with no office', () => {
    // Three offices; the head and the grand elder hold two, one elder holds the
    // third. Every office is held.
    const posts = [member('head', 6, 30, 90_000), member('grand', 5, 28, 90_000), member('elder', 4, 22, 9_000)];
    const offices = rooms('archive', 'treasury', 'punishment_hall');
    const elderNeeds = meritNeededFor(4);

    it('is made of somebody a whole realm above the elder bar when the offices are full', () => {
        const state = world([...posts, member('exceptional', 3, 26, elderNeeds), member('ordinary', 3, 22, elderNeeds * 5)], offices);
        expect(outcome(state, 'exceptional')).toMatchObject({ toRank: 4, withoutAnOffice: true });
        expect(outcome(state, 'ordinary')).toMatchObject({ reason: 'no_seat' });
    });

    it('stops at what the house will carry, and says why', () => {
        const state = world([
            ...posts, member('first', 3, 27, elderNeeds), member('second', 3, 26, elderNeeds)
        ], offices);
        expect(outcome(state, 'first')).toMatchObject({ withoutAnOffice: true });
        expect(outcome(state, 'second')).toMatchObject({ reason: 'no_room_without_office' });
    });

    it('still has to have served', () => {
        const state = world([...posts, member('unserved', 3, 30, elderNeeds - 1)], offices);
        expect(outcome(state, 'unserved')).toMatchObject({ reason: 'not_enough_merit' });
    });
});
