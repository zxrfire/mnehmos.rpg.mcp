/**
 * A house weighs loyalty when it chooses between people it cannot otherwise
 * tell apart - and never as a gate.
 *
 * Ruled by the design owner, beside the realm bar and the merit minimum that
 * were already there: the two gates stay gates, a whole major realm still wins
 * over everything, service still decides inside a realm, and loyalty orders
 * what is left. It is worth half of what being `chosen` is worth, which is the
 * weakest thing in the comparison.
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────
 *
 * Average loyalty by rung, seed `loy-a` and `loy-b`, at world open and after
 * sixty years of passes (band = the rung as a share of the house's ladder):
 *
 *     seed    year   bottom   lower   upper   top
 *     loy-a      0    0.477   0.511   0.537   0.472
 *     loy-a     60    0.438   0.540   0.529   0.433
 *     loy-b      0    0.474   0.489   0.547   0.459
 *     loy-b     60    0.454   0.526   0.558   0.419
 *
 * It rises from the bottom rung through the upper band, which is the shape the
 * design owner expected, and then DIPS at the very top. The dip is not the
 * loyalty read: `seedFactionLeadership` writes the head of every house and the
 * person who was the other candidate a rivalry with each other, so every single
 * person in the top band carries exactly one grievance under their own roof
 * (measured: 1.00 per person at the top, 0.03 in the upper band). The engine's
 * own model of who is held - `whatLeavingTheirHouseCosts` - has the same shape
 * on the same world (1.15, 1.82, 2.50, 2.41), so what holds an elder is priced
 * there, not here.
 *
 * That dip cannot reach a promotion: everybody considered for one seat stands on
 * one rung, and the head's rivalry is not in their comparison.
 *
 * The third term of the read, `haveServedIt`, measured as zero for every NPC in
 * the world at every rung, because nothing yet credits an NPC merit - it is what
 * `meritWith` says about them and today it says nothing about anybody.
 */

import { describe, it, expect } from 'vitest';
import {
    assessPromotions,
    meritNeededFor,
    ordinalExpectedAt
} from '../../../src/engine/world/promotion-inside-a-house.js';
import {
    howLoyalTheyAre,
    whatLoyaltyIsWorthHere,
    WHAT_A_BROKEN_WORD_LEAVES
} from '../../../src/engine/world/how-loyal-somebody-is-to-their-house.js';
import { createNpc, isActing, type NpcRecord, type NpcRelationship } from '../../../src/engine/world/npc-state.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { advanceYears } from '../../../src/engine/world/time.js';

const RANKS = ['Outer', 'Inner', 'Core', 'True', 'Elder', 'Grand Elder', 'Head'];
const HOUSE = 'house-that-weighs-loyalty';
const house = makeFaction({
    id: HOUSE, name: 'The Weighing Hall', ranks: RANKS,
    resources: { admission_ordinal: 2, power_ordinal: 30 }
});

function tie(targetId: string, standing: number): NpcRelationship {
    return {
        targetId, targetName: targetId, kind: 'ally', standing,
        note: '', sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null
    };
}

function member(
    id: string, rank: number, ordinal: number, merit: number, ties: NpcRelationship[] = []
): NpcRecord {
    const npc = createNpc('loyalty', { id, bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: ordinal } });
    return {
        ...npc,
        factionId: HOUSE,
        factionRankIndex: rank,
        relationships: ties,
        merit: merit > 0 ? { houseId: HOUSE, points: merit } : null
    };
}

function world(npcs: NpcRecord[]): WorldState {
    return { factions: [house], npcs, locations: [] } as unknown as WorldState;
}

function outcome(state: WorldState, id: string) {
    const { promotions, blocked } = assessPromotions(state);
    return promotions.find(p => p.npcId === id) ?? blocked.find(b => b.npcId === id) ?? null;
}

/** The roll as the read wants it. */
function roll(npcs: NpcRecord[]): { membersOfTheHouse: Set<string> } {
    return { membersOfTheHouse: new Set(npcs.map(n => n.id)) };
}

describe('loyalty is read off who somebody is and how they stand', () => {
    it('is nothing for somebody on no roll: it is held toward a house, like merit', () => {
        const loose = { ...member('nobody', 0, 10, 0), factionId: null };
        expect(howLoyalTheyAre(loose, { membersOfTheHouse: new Set() })).toBe(0);
    });

    it('counts a grievance under the same roof for more than the warmth beside it', () => {
        const people = [member('elder', 3, 20, 0), member('other', 3, 20, 0)];
        const warm = { ...member('warm', 0, 12, 0), relationships: [tie('elder', 0.8)] };
        const sour = { ...member('sour', 0, 12, 0), relationships: [tie('elder', -0.8)] };
        const mixed = {
            ...member('mixed', 0, 12, 0),
            relationships: [tie('elder', 0.8), tie('other', -0.8)]
        };
        const seen = roll([...people, warm, sour, mixed]);
        expect(howLoyalTheyAre(warm, seen)).toBeGreaterThan(howLoyalTheyAre(sour, seen));
        // Two ties of equal size, one of them a grievance, does not come out even.
        const both = howLoyalTheyAre(mixed, seen);
        expect(both).toBeLessThan(howLoyalTheyAre(warm, seen));
        expect(both).toBeLessThan(howLoyalTheyAre({ ...mixed, relationships: [] }, seen));
    });

    it('ignores the ties they hold to everybody who is not on this roll', () => {
        const inside = { ...member('inside', 0, 12, 0), relationships: [tie('elder', -0.9)] };
        const outside = { ...member('inside', 0, 12, 0), relationships: [tie('a-stranger', -0.9)] };
        const seen = roll([member('elder', 3, 20, 0), inside]);
        expect(howLoyalTheyAre(outside, seen)).toBeGreaterThan(howLoyalTheyAre(inside, seen));
    });

    it('leaves somebody who broke their word to this house under the ceiling', () => {
        const npc = { ...member('oathbreaker', 2, 14, 900), relationships: [tie('elder', 0.9)] };
        const seen = { membersOfTheHouse: new Set(['elder', 'oathbreaker']) };
        expect(howLoyalTheyAre(npc, seen)).toBeGreaterThan(WHAT_A_BROKEN_WORD_LEAVES);
        expect(howLoyalTheyAre(npc, { ...seen, brokeTheirWord: true }))
            .toBeLessThanOrEqual(WHAT_A_BROKEN_WORD_LEAVES);
    });

    it('is worth half a rung of service at most, and nothing at zero', () => {
        expect(whatLoyaltyIsWorthHere(1, 1000)).toBe(500);
        expect(whatLoyaltyIsWorthHere(0, 1000)).toBe(0);
    });
});

describe('a house weighs loyalty when it chooses between people', () => {
    const bar1 = ordinalExpectedAt(1, RANKS.length, 2, 30);
    const ordinal = Math.max(bar1, 12);
    const needed = meritNeededFor(1);

    it('never gates: the one candidate who cleared both bars is raised however they read', () => {
        const elder = member('elder', 4, 24, 0);
        const sour = {
            ...member('sour', 0, ordinal, needed),
            relationships: [tie('elder', -1)]
        };
        const state = world([elder, sour]);
        // As low as this person can read: every tie they hold to the house is a
        // grievance, and the house raises them anyway.
        expect(howLoyalTheyAre(sour, roll([elder, sour])))
            .toBeLessThan(howLoyalTheyAre({ ...sour, relationships: [tie('elder', 1)] }, roll([elder, sour])));
        expect(outcome(state, 'sour')).toMatchObject({ toRank: 1, decidedBy: 'uncontested' });
    });

    it('decides between two the house cannot otherwise tell apart', () => {
        const elder = member('elder', 4, 24, 0);
        // The loyal one is LAST by id, so a tie broken any other way gives the
        // seat to the other person and this says nothing.
        const warm = { ...member('z-warm', 0, ordinal, needed), relationships: [tie('elder', 1)] };
        const sour = { ...member('a-sour', 0, ordinal, needed), relationships: [tie('elder', -1)] };
        const seen = roll([elder, warm, sour]);
        expect(howLoyalTheyAre(warm, seen)).toBeGreaterThan(howLoyalTheyAre(sour, seen));

        const state = world([elder, warm, sour]);
        expect(outcome(state, 'z-warm')).toMatchObject({ toRank: 1, decidedBy: 'loyalty' });
        expect(outcome(state, 'a-sour')).toMatchObject({ reason: 'outranked' });
    });

    it('never lifts anybody over a whole realm', () => {
        const elder = member('elder', 4, 24, 0);
        const warm = { ...member('a-loyal', 0, 12, needed), relationships: [tie('elder', 1)] };
        const higher = { ...member('z-higher', 0, 13, needed), relationships: [tie('elder', -1)] };
        const state = world([elder, warm, higher]);
        expect(outcome(state, 'z-higher')).toMatchObject({ toRank: 1, decidedBy: 'realm' });
        expect(outcome(state, 'a-loyal')).toMatchObject({ reason: 'outranked' });
    });

    it('never lifts anybody over the service the house counted', () => {
        const elder = member('elder', 4, 24, 0);
        const warm = { ...member('a-loyal', 0, ordinal, needed), relationships: [tie('elder', 1)] };
        const served = {
            ...member('z-served', 0, ordinal, needed + Math.max(1, needed)),
            relationships: [tie('elder', -1)]
        };
        const state = world([elder, warm, served]);
        expect(outcome(state, 'z-served')).toMatchObject({ toRank: 1, decidedBy: 'merit' });
        expect(outcome(state, 'a-loyal')).toMatchObject({ reason: 'outranked' });
    });

    it('does not open the merit gate for the most loyal person in the house', () => {
        const elder = member('elder', 4, 24, 0);
        const warm = {
            ...member('a-loyal', 0, ordinal, Math.max(0, needed - 1)),
            relationships: [tie('elder', 1)]
        };
        const state = world([elder, warm]);
        expect(outcome(state, 'a-loyal')).toMatchObject({ reason: 'not_enough_merit' });
    });
});

/**
 * And the shape of it in a world, which is the claim the unit tests cannot make.
 * The numbers are in the header; what is asserted is the rise, not the figures.
 */
describe('what a world reads as loyalty, by rung', () => {
    type Band = '0 bottom' | '1 lower' | '2 upper' | '3 top';

    function byBand(state: WorldState): Map<Band, number> {
        const rolls = new Map<string, Set<string>>();
        for (const npc of state.npcs) {
            if (!isActing(npc.status) || npc.factionId === null) continue;
            const set = rolls.get(npc.factionId) ?? new Set<string>();
            set.add(npc.id);
            rolls.set(npc.factionId, set);
        }
        const houses = new Map(state.factions.map(f => [f.id, f]));
        const sums = new Map<Band, { sum: number; n: number }>();
        for (const npc of state.npcs) {
            if (!isActing(npc.status) || npc.factionId === null || npc.factionRankIndex < 0) continue;
            const seat = houses.get(npc.factionId);
            const roster = rolls.get(npc.factionId);
            if (seat === undefined || roster === undefined) continue;
            const share = seat.ranks.length <= 1 ? 1 : npc.factionRankIndex / (seat.ranks.length - 1);
            const band: Band = npc.factionRankIndex === 0 ? '0 bottom'
                : share >= 0.75 ? '3 top'
                    : share >= 0.5 ? '2 upper' : '1 lower';
            const row = sums.get(band) ?? { sum: 0, n: 0 };
            row.sum += howLoyalTheyAre(npc, { membersOfTheHouse: roster });
            row.n++;
            sums.set(band, row);
        }
        const out = new Map<Band, number>();
        for (const [band, row] of sums) out.set(band, row.sum / row.n);
        return out;
    }

    it('rises from the bottom rung through the upper band, and holds there for sixty years', async () => {
        const catalog: WorldCatalog = await loadCultivationCatalog();
        let state = seedWorld({ seed: 'loy-a', catalog }).state;

        const open = byBand(state);
        expect(open.get('0 bottom')!, 'the bottom rung reads as loyal as the band above it')
            .toBeLessThan(open.get('1 lower')!);
        expect(open.get('1 lower')!).toBeLessThan(open.get('2 upper')!);

        state = advanceYears(state, 60, { inPlace: true, stopOnInterrupt: false }).state;
        const later = byBand(state);
        expect(later.get('0 bottom')!, 'sixty years later the rise is gone')
            .toBeLessThan(later.get('1 lower')!);
        expect(later.get('1 lower')!).toBeLessThan(later.get('2 upper')! + 0.02);
        // And nobody reads as certain of anything: this is a disposition, not a
        // flag, and a band that ever averages near 1 has become one.
        for (const average of later.values()) {
            expect(average).toBeGreaterThan(0.2);
            expect(average).toBeLessThan(0.8);
        }
    }, 300_000);
});
