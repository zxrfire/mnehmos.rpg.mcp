/**
 * A house's counted wound medicine is spent on its own wounded, elder first, and
 * the count goes down; a house with a hand that can work the grade refines it
 * back out of its purse.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    countedWoundMedicine,
    housesRefineTheirWoundMedicine,
    onTheShelf
} from '../../../src/engine/world/house-wound-medicine.js';
import { woundsCloseThisYear } from '../../../src/engine/world/what-a-house-does-about-its-people-being-hurt.js';
import { pillStockKey, theShelfAHouseKeeps, theHeightAHouseWorksAt } from '../../../src/engine/world/where-the-pills-actually-are.js';
import { medicineReaches } from '../../../src/engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { Injury } from '../../../src/schema/cultivation.js';
import { soakedWorld } from '../../support/soaked-world.js';

const PILL = 'pill-clear-meridian';
const WALKED = 30 * 365 + 170;

function aTear(id: string): Injury {
    return {
        id,
        severity: 'serious',
        source: 'combat',
        description: 'A torn meridian.',
        sustainedOnTurn: 0,
        treated: false,
        cultivationPenalty: 0.1,
        breakthroughPenalty: 0.05,
        woundType: null
    } as unknown as Injury;
}

function wound(state: WorldState, npc: NpcRecord, id: string): void {
    const i = state.npcs.findIndex(n => n.id === npc.id);
    state.npcs[i] = {
        ...npc,
        cultivation: { ...npc.cultivation, injuries: [aTear(id)], untreatedInjuries: 1 }
    };
}

const totalOnShelves = (state: WorldState): number => state.factions.reduce(
    (n, f) => n + countedWoundMedicine().reduce((m, p) => m + onTheShelf(f, p.id), 0), 0);

describe('one dose on the shelf and two wounded', () => {
    it('goes to the one who stands higher, and the shelf is empty after', async () => {
        const { state } = seedWorld({ seed: 'one-dose-two-wounded', catalog: await loadCultivationCatalog() });
        // Two of one house whom a mortal-grade pill reaches, at different ranks.
        const house = state.factions.find(f => {
            const low = state.npcs.filter(n => n.factionId === f.id && n.status === 'alive'
                && medicineReaches('mortal', 'serious', n.cultivation.realmOrdinal));
            return f.dissolvedOnDay === null && new Set(low.map(n => n.factionRankIndex)).size >= 2;
        })!;
        const roll = state.npcs
            .filter(n => n.factionId === house.id && n.status === 'alive'
                && medicineReaches('mortal', 'serious', n.cultivation.realmOrdinal))
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex);
        const elder = roll[0]!;
        const junior = roll.find(n => n.factionRankIndex < elder.factionRankIndex)!;
        wound(state, junior, 'junior-tear');
        wound(state, elder, 'elder-tear');
        for (const pill of countedWoundMedicine()) house.resources[pillStockKey(pill.id)] = 0;
        house.resources[pillStockKey(PILL)] = 1;
        // No purse, so nothing else pays for either and nothing is refined back.
        house.resources.spirit_stones = 0;

        const care = woundsCloseThisYear(state, 1, 365);

        const tearOf = (npc: NpcRecord) => state.npcs.find(n => n.id === npc.id)!.cultivation.injuries[0]!;
        expect(care.dosesFromTheShelf).toBe(1);
        expect(tearOf(elder).treated, 'the elder is seen to first').toBe(true);
        expect(onTheShelf(house, PILL)).toBe(0);
    });
});

describe('a walked world', () => {
    it('closes a fresh tear on every member whose house shelves a pill for it, and the shelves are down by the doses', async () => {
        const state = await soakedWorld('a-house-heals-its-own', { days: WALKED });
        // What a walk leaves open is what no shelf reaches: the pass has run every
        // year of it. So tear a meridian on every member a mortal-grade pill
        // reaches, in every house holding one, and run the next pass.
        const torn: string[] = [];
        for (const npc of [...state.npcs]) {
            const house = state.factions.find(f => f.id === npc.factionId && f.dissolvedOnDay === null);
            if (npc.status !== 'alive' || !house || onTheShelf(house, PILL) === 0) continue;
            if (!medicineReaches('mortal', 'serious', npc.cultivation.realmOrdinal)) continue;
            if (npc.cultivation.injuries.some(w => !w.treated)) continue;
            wound(state, npc, `torn-${npc.id}`);
            torn.push(npc.id);
        }
        expect(torn.length).toBeGreaterThan(0);
        const before = totalOnShelves(state);

        const care = woundsCloseThisYear(state, 31, WALKED + 9);

        const stillOpen = torn.filter(id => !state.npcs.find(n => n.id === id)!.cultivation.injuries[0]!.treated);
        expect(stillOpen, 'torn members left open').toEqual([]);
        expect(care.dosesFromTheShelf).toBeGreaterThanOrEqual(torn.length);
        expect(totalOnShelves(state)).toBe(before - care.dosesFromTheShelf + care.refined);
    }, 600_000);

    it('refines back no higher than the shelf a house of its reach keeps, and pays for it', async () => {
        const state = await soakedWorld('a-house-heals-its-own', { days: WALKED });
        for (const f of state.factions) f.resources[pillStockKey(PILL)] = 0;
        const purses = state.factions.reduce((n, f) => n + Number(f.resources.spirit_stones ?? 0), 0);

        const made = housesRefineTheirWoundMedicine(state, 31);

        expect(made.set).toBeGreaterThan(0);
        expect(state.factions.reduce((n, f) => n + Number(f.resources.spirit_stones ?? 0), 0)).toBe(purses - made.stones);
        const pill = countedWoundMedicine().find(p => p.id === PILL)!;
        for (const f of state.factions) {
            expect(onTheShelf(f, PILL)).toBeLessThanOrEqual(theShelfAHouseKeeps(theHeightAHouseWorksAt(f), pill));
        }
    }, 600_000);
});
