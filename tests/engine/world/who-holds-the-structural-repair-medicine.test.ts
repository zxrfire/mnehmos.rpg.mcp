/**
 * The holdings, live, and the measurement they exist to satisfy.
 *
 * Two things are asserted here and the second is the one the design is judged
 * on:
 *
 *   THE HOLDINGS ARE LIVE. A house's stock is state, not a catalog line. Seeding
 *   puts the authored doses in exactly the authored places and nowhere else;
 *   spending one moves the count; and the spent row stays behind, so a dose that
 *   moved is findable two centuries later.
 *
 *   ALMOST NOBODY IS EVER MENDED. Measured over a large cohort of real derived
 *   lives, with the two scarcities kept separate: how many doses exist, and how
 *   many of the broken are in a relationship where one would be spent on them.
 */
import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import {
    seedStructuralRepairMedicine,
    repairMedicineHeldBy,
    everyRepairHolding,
    sentDownDosesStanding,
    worldCountOfRepairMedicine,
    doseAHouseWouldUse,
    spendRepairDose,
    repairStorageModel,
    repairStockKey,
    allDoses,
    isUnspentDose
} from '../../../src/engine/world/who-holds-the-structural-repair-medicine.js';
import {
    STRUCTURAL_REPAIR_MEDICINES,
    STRUCTURAL_REPAIR_HOLDINGS
} from '../../../src/data/cultivation/structural-repair-medicine.js';
import { sentDownLedgerTotals } from '../../../src/engine/cultivation/what-structural-repair-medicine-can-reach.js';
import {
    measureWhoGetsMended,
    HOUSEHOLD_ORIGINS
} from '../../../src/engine/world/how-many-of-the-broken-are-ever-mended.js';
import { willTheHouseSpendOnThem, chosenOf, CHOSEN_PER_HOUSE } from '../../../src/engine/cultivation/who-a-house-will-spend-a-repair-dose-on.js';

const catalog = await loadCultivationCatalog();
const world = () => seedWorld({ seed: 'repair-holdings', catalog }).state;

describe('the holdings are live state', () => {
    it('seeds exactly the authored doses, in exactly the authored places', () => {
        const state = world();
        const tracked = STRUCTURAL_REPAIR_HOLDINGS.filter(h => {
            const m = STRUCTURAL_REPAIR_MEDICINES.find(x => x.id === h.medicineId)!;
            return repairStorageModel(m) === 'row';
        });
        const expected = tracked.reduce((n, h) => n + h.count, 0);
        expect(allDoses(state)).toHaveLength(expected);
        // Nobody outside the table holds a single one.
        const holders = new Set(allDoses(state).map(o => o.possessorId));
        for (const id of holders) {
            expect(tracked.some(h => h.factionId === id), `${id} holds a dose`).toBe(true);
        }
    });

    it('never scatters a dose onto a house the catalog did not name', () => {
        const state = world();
        const named = new Set(STRUCTURAL_REPAIR_HOLDINGS.map(h => h.factionId));
        for (const faction of state.factions) {
            if (named.has(faction.id)) continue;
            expect(repairMedicineHeldBy(state, faction.id), faction.id).toHaveLength(0);
        }
    });

    it('carries the sent-down count, and it is the ledger figure', () => {
        const state = world();
        expect(sentDownDosesStanding(state)).toBe(sentDownLedgerTotals().standing);
    });

    it('places tracked doses on holders the world does not instantiate as factions', () => {
        // The Deep Survey and the Long Cut carry `factionId: null` in the
        // governance catalog on purpose, so they never become faction rows -
        // and they hold most of the sent-down stock. If this ever returns zero,
        // the seeder has started requiring a faction and the count is wrong.
        const state = world();
        expect(worldCountOfRepairMedicine(state, 'repair-unbroken-pattern')).toBeGreaterThan(2);
        expect(repairMedicineHeldBy(state, 'apex-deep-survey').length).toBeGreaterThan(0);
    });

    it('answers what a house holds today, and the answer changes when it spends', () => {
        const state = world();
        const before = repairMedicineHeldBy(state, 'sect-azure-cloud-pavilion');
        const soulSeating = before.find(h => h.medicineId === 'repair-soul-seating');
        expect(soulSeating?.count).toBe(1);

        const spent = spendRepairDose(
            state, 'sect-azure-cloud-pavilion', 'npc-someone', 'Somebody',
            'unformed-nascent-soul', 21, 400
        );
        expect(spent?.medicineId).toBe('repair-soul-seating');

        const after = repairMedicineHeldBy(state, 'sect-azure-cloud-pavilion');
        expect(after.find(h => h.medicineId === 'repair-soul-seating')).toBeUndefined();
    });

    it('leaves the spent row behind, with who took it and when', () => {
        const state = world();
        const spent = spendRepairDose(
            state, 'apex-deep-survey', 'npc-first-mark', 'A First Mark',
            'unsealed-seam', 33, 900
        );
        expect(spent?.doseId).not.toBeNull();
        const row = state.objects.find(o => o.id === spent!.doseId)!;
        expect(isUnspentDose(row)).toBe(false);
        expect(row.data.spentBy).toBe('npc-first-mark');
        expect(row.data.spentOnDay).toBe(900);
        // And the chain says where it went, which is the part that outlives it.
        expect(row.provenance.length).toBeGreaterThan(1);
        expect(sentDownDosesStanding(state)).toBe(sentDownLedgerTotals().standing - 1);
    });

    it('reaches for the cheapest thing that works, never the best thing on the shelf', () => {
        const state = world();
        // The Pavilion holds a sent-down dose and an earth-grade one. A cracked
        // core gets the earth-grade one.
        const choice = doseAHouseWouldUse(state, 'sect-azure-cloud-pavilion', 'cracked-core', 17);
        expect(choice?.medicine.id).toBe('repair-core-knitting');
    });

    it('refuses where the house has nothing that reaches, rather than substituting', () => {
        const state = world();
        // A house with only the cheap grades cannot answer a Deity
        // Transformation break at any price.
        expect(doseAHouseWouldUse(state, 'house-held-names', 'incomplete-transformation', 25)).toBeNull();
        expect(spendRepairDose(
            state, 'house-held-names', 'x', 'X', 'incomplete-transformation', 25, 1
        )).toBeNull();
        // And nobody anywhere can answer a broken step.
        for (const holding of everyRepairHolding(state)) {
            expect(doseAHouseWouldUse(
                state, holding.factionId, 'unformed-tribulation-body', 41
            ), holding.factionId).toBeNull();
        }
    });

    it('keeps counted stock as a number on the holder, with no rows', () => {
        const state = world();
        const guild = state.factions.find(f => f.id === 'sect-cinnabar-crucible-guild')!;
        expect(guild.resources[repairStockKey('repair-second-pour')]).toBe(3);
        expect(allDoses(state).some(o => o.data.medicineId === 'repair-second-pour')).toBe(false);
    });
});

describe('the standard a house applies', () => {
    it('is closed to anybody who is not the house\'s own, at any price', () => {
        const outsider = willTheHouseSpendOnThem({
            id: 'nobody',
            realmOrdinal: 21,
            woundKey: 'unformed-nascent-soul',
            houseId: 'sect-azure-cloud-pavilion',
            onTheHouseRoll: false,
            kinOfSomebodyWhoMatters: false,
            chosenOfTheHouse: false,
            yearsTheHouseHasSpent: 400
        });
        expect(outsider.meetsTheStandard).toBe(false);
        expect(outsider.claim).toBe('none');
    });

    it('opens for blood, for a chosen, and for a century of investment', () => {
        const base = {
            id: 'someone',
            realmOrdinal: 21,
            woundKey: 'unformed-nascent-soul',
            houseId: 'sect-azure-cloud-pavilion',
            onTheHouseRoll: true,
            kinOfSomebodyWhoMatters: false,
            chosenOfTheHouse: false,
            yearsTheHouseHasSpent: 10
        };
        expect(willTheHouseSpendOnThem({ ...base, kinOfSomebodyWhoMatters: true }).claim).toBe('blood');
        expect(willTheHouseSpendOnThem({ ...base, chosenOfTheHouse: true }).claim).toBe('chosen');
        expect(willTheHouseSpendOnThem({ ...base, yearsTheHouseHasSpent: 200 }).claim).toBe('sunk_cost');
        expect(willTheHouseSpendOnThem(base).meetsTheStandard).toBe(false);
    });

    it('is not the answer to a wound that is not structural', () => {
        expect(willTheHouseSpendOnThem({
            id: 'someone',
            realmOrdinal: 21,
            woundKey: 'heart-demon',
            houseId: 'sect-azure-cloud-pavilion',
            onTheHouseRoll: true,
            kinOfSomebodyWhoMatters: true,
            chosenOfTheHouse: true,
            yearsTheHouseHasSpent: 900
        }).meetsTheStandard).toBe(false);
    });

    it('caps the chosen, so the claim keeps meaning something', () => {
        const roll = Array.from({ length: 40 }, (_, i) => ({ id: `d${i}`, realmOrdinal: i }));
        const chosen = chosenOf(roll, 30);
        expect(chosen).toHaveLength(CHOSEN_PER_HOUSE);
        expect(chosen.every(m => m.realmOrdinal < 30)).toBe(true);
        expect(chosen[0].realmOrdinal).toBe(29);
    });
});

describe('how many of the broken are ever mended', () => {
    it('is almost none, and the binding constraint is standing rather than supply', () => {
        // 200,000 derived lives. Bigger runs give the same answer with a
        // tighter interval: at 1,600,000 lives the figures were 59,074 lives
        // clearing a realm wall, 284 arriving broken, and ONE of those born
        // inside a body that could hold a dose - 0.35% mended.
        const result = measureWhoGetsMended({ sample: 200_000, seed: 'guard' });

        expect(result.broken).toBeGreaterThan(0);
        // The target: rare to a degree where most people just live with it.
        expect(result.mendedShare).toBeLessThan(0.05);
        // And it is the standing that binds, not the doses. If this ever
        // inverts, the holdings have been seeded too widely.
        expect(result.connectedShare).toBeLessThan(0.1);
        expect(result.mended).toBeLessThanOrEqual(result.connected);

        // Nobody is ever mended at the last wall, whatever the supply.
        const brokenStep = result.byBreak.find(r => r.woundKey === 'unformed-tribulation-body');
        if (brokenStep) {
            expect(brokenStep.dosesAvailable).toBeNull();
            expect(brokenStep.mended).toBe(0);
        }
    }, 120_000);

    it('counts only the births that put somebody inside a body that could hold one', () => {
        // Three of the world's eight origin tiers, and they are the top three.
        expect(HOUSEHOLD_ORIGINS).toEqual([
            'dao_house_bloodline',
            'apex_sect_members_child',
            'fostered_on_a_word'
        ]);
    });
});
