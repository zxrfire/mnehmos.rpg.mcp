import { describe, it, expect } from 'vitest';
import { whoseVeinsChangeHands } from '../../../src/engine/world/a-vein-is-taken-sold-given-up-or-claimed.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { fixtureCatalog } from './fixtures.js';

const YEAR = 365;

type House = Parameters<typeof whoseVeinsChangeHands>[0]['houses'][number];
type Vein = Parameters<typeof whoseVeinsChangeHands>[0]['veins'][number];

function house(id: string, init: Partial<House> = {}): House {
    return {
        id,
        live: true,
        members: 10,
        purse: 100_000,
        payroll: 450,
        strongest: 20,
        aVeinPaysIt: 4_000,
        war: null,
        onTermsWith: [],
        holdsOnAGrant: false,
        ...init
    };
}

function vein(init: Partial<Vein> = {}): Vein {
    return { id: 'vein', worksAt: 15, holderId: 'holder', unheldSinceDay: null, ...init };
}

function run(veins: Vein[], houses: House[], onDay = 100 * YEAR, far: Record<string, number> = {}) {
    return whoseVeinsChangeHands({
        veins,
        houses,
        daysFrom: id => far[id] ?? 1,
        onDay,
        daysPerYear: YEAR
    });
}

describe('how a vein changes hands', () => {
    it('a solvent holder at peace with nobody richer on terms keeps its vein', () => {
        expect(run([vein()], [house('holder'), house('other')])).toEqual([]);
    });

    it('a house losing a war loses the vein to the house it is fighting', () => {
        const out = run([vein()], [
            house('holder', { war: { againstId: 'enemy', losing: 0.3, settled: false } }),
            house('enemy', { war: { againstId: 'holder', losing: -0.3, settled: false } })
        ]);
        expect(out).toEqual([{ veinId: 'vein', how: 'taken_in_war', fromId: 'holder', toId: 'enemy', price: 0 }]);
    });

    it('a war settled against the holder takes the vein even by a narrow margin, but not an open one', () => {
        const narrow = (settled: boolean) => run([vein()], [
            house('holder', { war: { againstId: 'enemy', losing: 0.05, settled } }),
            house('enemy')
        ]);
        expect(narrow(true).map(c => c.how)).toEqual(['taken_in_war']);
        expect(narrow(false)).toEqual([]);
    });

    it('a winner that cannot work the vein does not take it', () => {
        const out = run([vein()], [
            house('holder', { war: { againstId: 'enemy', losing: 0.9, settled: true } }),
            house('enemy', { strongest: 10 })
        ]);
        expect(out).toEqual([]);
    });

    it('a short holder sells to a house on terms, which pays ten years of what the vein would pay it', () => {
        const out = run([vein()], [
            house('holder', { purse: 100, onTermsWith: ['buyer'] }),
            house('buyer', { aVeinPaysIt: 5_000 })
        ]);
        expect(out).toEqual([{ veinId: 'vein', how: 'sold', fromId: 'holder', toId: 'buyer', price: 50_000 }]);
    });

    it('nobody buys who would be left unable to keep its own wages in hand', () => {
        const out = run([vein()], [
            house('holder', { purse: 100, onTermsWith: ['buyer'] }),
            house('buyer', { purse: 40_000 })
        ]);
        expect(out).toEqual([]);
    });

    it('a thinning holder sells to a rich buyer, and a solvent one does not sell at all', () => {
        const thinning = run([vein()], [
            house('holder', { purse: 900, onTermsWith: ['buyer'] }),
            house('buyer', { purse: 1_000_000, aVeinPaysIt: 6_000 })
        ]);
        expect(thinning.map(c => c.how)).toEqual(['sold']);

        const solvent = run([vein()], [
            house('holder', { onTermsWith: ['buyer'] }),
            house('buyer', { purse: 1_000_000, aVeinPaysIt: 6_000 })
        ]);
        expect(solvent).toEqual([]);
    });

    it('a vein held on a grant is not the holder\'s to sell', () => {
        const out = run([vein()], [
            house('holder', { purse: 100, onTermsWith: ['buyer'], holdsOnAGrant: true }),
            house('buyer')
        ]);
        expect(out).toEqual([]);
    });

    it('a holder that cannot pay and cannot work its vein gives it up', () => {
        const out = run([vein()], [house('holder', { purse: 100, strongest: 10 })]);
        expect(out).toEqual([{ veinId: 'vein', how: 'given_up', fromId: 'holder', toId: null, price: 0 }]);
    });

    it('a vein whose holder has ended is given up', () => {
        const out = run([vein()], [house('holder', { live: false })]);
        expect(out.map(c => c.how)).toEqual(['given_up']);
    });

    it('a vein given up lies unheld for years, then the nearest house that can work it claims it', () => {
        const left = vein({ holderId: null, unheldSinceDay: 100 * YEAR });
        const houses = [house('near'), house('far'), house('weak', { strongest: 5 })];
        const far = { near: 3, far: 20, weak: 1 };
        expect(run([left], houses, 102 * YEAR, far)).toEqual([]);
        expect(run([left], houses, 106 * YEAR, far)).toEqual(
            [{ veinId: 'vein', how: 'claimed', fromId: null, toId: 'near', price: 0 }]);
    });

    it('a vein nobody ever held and gave up is left as the world was made', () => {
        expect(run([vein({ holderId: null })], [house('near')])).toEqual([]);
    });
});

describe('a vein sale, written into the world', () => {
    it('moves the vein, the stones between the two treasuries, and a fact naming both houses', () => {
        const state = seedWorld({ seed: 'vein-sale', catalog: fixtureCatalog(), presentYear: 1000, population: 250 }).state;
        const seller = state.factions.find(f => f.id === 'sect-clearwater-ward')!;
        const buyer = state.factions.find(f => f.id === 'sect-fallen-grain-caravan')!;
        // A tribute it cannot meet empties the seller's purse at the year's
        // accounts; the buyer is rich and the two stand on ordinary terms.
        seller.resources.spirit_stones = 5_000;
        seller.resources.tribute_owed_per_year = 1_000_000;
        buyer.resources.spirit_stones = 1_000_000;
        seller.standing[buyer.id] = 0;
        buyer.standing[seller.id] = 0;

        const out = applyPressure(state, state.currentDay, state.currentDay + YEAR);

        const sale = out.events.find(e => e.kind === 'vein_sold');
        expect(sale, 'no sale this year').toBeDefined();
        expect(sale!.fact.factionIds).toEqual([seller.id, buyer.id]);
        expect(sale!.fact.summary).toBe(
            'The Clearwater Ward sold the Clear River Ferry vein to the Bountiful Sheaf Sect.');
        const price = Number(sale!.fact.data.price);
        expect(price).toBeGreaterThan(0);
        expect(state.locations.find(l => l.id === sale!.fact.locationId)!.controllingFactionId).toBe(buyer.id);
        // Other passes spend and earn in the same year, so the purses are read
        // against half the price rather than to the stone.
        expect(Number(buyer.resources.spirit_stones)).toBeLessThan(1_000_000 - price / 2);
        expect(Number(seller.resources.spirit_stones)).toBeGreaterThan(price / 2);
    });
});
