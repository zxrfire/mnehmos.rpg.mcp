/**
 * The first vein pass allowed sales and left surrendered veins empty for five
 * years. Measured at year 500, zone_forbidden had consumed every shipped vein.
 * The 30 September ruling replaces sales and claims with apex/court grants,
 * distributes every opening vein, and keeps forbidden ground separate.
 */
import { describe, it, expect } from 'vitest';
import { whoseVeinsChangeHands, whoGrantsThisVein } from '../../../src/engine/world/a-vein-is-taken-given-up-or-granted.js';
import { applyPressure, PRESSURE_TEMPLATES } from '../../../src/engine/world/pressure.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { whatAHouseCanPutOut } from '../../../src/engine/world/war-melee.js';
import { fixtureCatalog } from './fixtures.js';

const YEAR = 365;
type House = Parameters<typeof whoseVeinsChangeHands>[0]['houses'][number];
type Vein = Parameters<typeof whoseVeinsChangeHands>[0]['veins'][number];

function house(id: string, init: Partial<House> = {}): House {
    return { id, live: true, members: 10, purse: 100_000, payroll: 450,
        strongest: 20, war: null, ...init };
}
function vein(init: Partial<Vein> = {}): Vein {
    return { id: 'vein', worksAt: 15, holderId: 'holder', grantorId: 'apex', ...init };
}
function run(veins: Vein[], houses: House[], far: Record<string, number | null> = {}) {
    return whoseVeinsChangeHands({ veins, houses,
        daysFrom: id => Object.hasOwn(far, id) ? far[id] : 1 });
}

describe('veins are held on grants', () => {
    it('keeps a working holder at peace even when it cannot pay and a neighbour is rich', () => {
        const houses = [house('holder', { purse: 100 }), house('rich', { purse: 1_000_000 })];
        const before = JSON.stringify(houses);
        expect(run([vein()], houses)).toEqual([]);
        expect(JSON.stringify(houses)).toBe(before);
    });

    it('takes the losing house’s vein in an open war', () => {
        expect(run([vein()], [
            house('holder', { war: { againstId: 'enemy', losing: 0.3, settled: false } }),
            house('enemy')
        ])).toEqual([{ veinId: 'vein', how: 'taken_in_war', fromId: 'holder', toId: 'enemy' }]);
    });

    it('takes a narrow loss only when the war is settled', () => {
        const narrow = (settled: boolean) => run([vein()], [
            house('holder', { war: { againstId: 'enemy', losing: 0.01, settled } }), house('enemy')
        ]);
        expect(narrow(true).map(c => c.how)).toEqual(['taken_in_war']);
        expect(narrow(false)).toEqual([]);
    });

    it('can take a vein the grantor itself is holding in a war', () => {
        expect(run([vein({ holderId: 'apex' })], [
            house('apex', { war: { againstId: 'enemy', losing: 0.3, settled: false } }),
            house('enemy')
        ])).toEqual([{ veinId: 'vein', how: 'taken_in_war', fromId: 'apex', toId: 'enemy' }]);
    });

    it('does not let a winner take a vein it cannot work or reach', () => {
        const houses = [house('holder', { war: { againstId: 'enemy', losing: 0.9, settled: true } }),
            house('enemy', { strongest: 10 })];
        expect(run([vein()], houses)).toEqual([]);
        houses[1].strongest = 20;
        expect(run([vein()], houses, { enemy: null })).toEqual([]);
    });

    it('returns a broke holder’s unworkable vein to its grantor', () => {
        expect(run([vein()], [house('holder', { purse: 100, strongest: 10 }), house('apex')]))
            .toEqual([{ veinId: 'vein', how: 'given_up', fromId: 'holder', toId: 'apex' }]);
    });

    it('returns an ended house’s vein even when its purse was full', () => {
        expect(run([vein()], [house('holder', { live: false }), house('apex')]))
            .toEqual([{ veinId: 'vein', how: 'given_up', fromId: 'holder', toId: 'apex' }]);
    });

    it('grants returned and never-held veins to the nearest house that can work them', () => {
        const houses = [house('apex'), house('near'), house('far'), house('weak', { strongest: 5 }),
            house('broke', { purse: 0 }), house('fighting', { war: { againstId: 'far', losing: 0, settled: false } })];
        const far = { near: 3, far: 20, weak: 1, broke: 1, fighting: 1 };
        for (const holderId of ['apex', null]) {
            expect(run([vein({ holderId })], houses, far))
                .toEqual([{ veinId: 'vein', how: 'granted', fromId: 'apex', toId: 'near' }]);
        }
    });

    it('keeps the returned vein with the grantor when no house can work it', () => {
        expect(run([vein({ holderId: 'apex' })], [house('apex'), house('weak', { strongest: 1 })]))
            .toEqual([]);
    });
});

describe('vein grants are written into the running world', () => {
    it('writes a war taking on the annual path within 120 years', () => {
        const state = seedWorld({ seed: 'vein-war', catalog: fixtureCatalog(), population: 250 }).state;
        const ground = state.locations.find(l => l.kind === 'vein'
            && l.controllingFactionId === 'sect-clearwater-ward')!;
        const holder = state.factions.find(f => f.id === ground.controllingFactionId)!;
        const enemy = state.factions.find(f => f.id === 'sect-ancient-bough-grove')!;
        holder.tags.push('at_war');
        enemy.tags.push('at_war');
        state.schedule.push({
            id: 'test-vein-war', kind: 'war_resolves', dueOnDay: state.currentDay + 120 * YEAR,
            summary: 'The war ended.', actorIds: [], locationId: holder.seatLocationId,
            factionId: holder.id, repeatDays: null, interrupts: false, chance: 1,
            fired: false, firedOnDay: null,
            data: { kind: 'war_resolution', sideA: holder.id, sideB: enemy.id,
                openedOnDay: state.currentDay - YEAR,
                musteredA: whatAHouseCanPutOut(state, holder.id).summed * 10,
                musteredB: whatAHouseCanPutOut(state, enemy.id).summed }
        });
        const out = applyPressure(state, state.currentDay, state.currentDay + YEAR);
        const taking = out.events.find(e => e.kind === 'vein_taken_in_war' && e.fact.locationId === ground.id)!;
        expect(taking).toBeDefined();
        expect(taking.fact.factionIds).toEqual([holder.id, enemy.id]);
        expect(state.locations.find(l => l.id === ground.id)!.controllingFactionId).toBe(enemy.id);
        expect(enemy.controlledLocationIds).toContain(ground.id);
        expect(holder.controlledLocationIds).not.toContain(ground.id);
    });

    it('returns a failing holding, then grants it with a fact naming the grantor and new holder', () => {
        const state = seedWorld({ seed: 'vein-return', catalog: fixtureCatalog(), presentYear: 1000, population: 250 }).state;
        const ground = state.locations.find(l => l.kind === 'vein'
            && l.controllingFactionId === 'sect-clearwater-ward')!;
        const holder = state.factions.find(f => f.id === ground.controllingFactionId)!;
        const grantor = whoGrantsThisVein(state, ground)!;
        holder.resources.spirit_stones = 0;
        holder.resources.tribute_owed_per_year = 1_000_000;
        holder.resources.power_ordinal = 0;
        const first = applyPressure(state, state.currentDay, state.currentDay + YEAR);
        const returned = first.events.find(e => e.kind === 'vein_given_up' && e.fact.locationId === ground.id)!;
        expect(returned).toBeDefined();
        expect(returned.fact.factionIds).toEqual([holder.id, grantor.id]);
        expect(returned.fact.summary).toContain(grantor.name.replace(/^the\s+/i, ''));
        expect(state.locations.find(l => l.id === ground.id)!.controllingFactionId).toBe(grantor.id);
        expect(holder.controlledLocationIds).not.toContain(ground.id);
        expect(grantor.controlledLocationIds).toContain(ground.id);

        const second = applyPressure(state, state.currentDay + YEAR, state.currentDay + 2 * YEAR);
        const granted = second.events.find(e => e.kind === 'vein_granted' && e.fact.locationId === ground.id)!;
        expect(granted).toBeDefined();
        const recipient = state.factions.find(f => f.id === granted.fact.data.toId)!;
        expect(granted.fact.factionIds).toEqual([grantor.id, recipient.id]);
        expect(granted.fact.summary).toContain('granted');
        expect(granted.fact.summary).toContain(recipient.name.replace(/^the\s+/i, ''));
        expect(granted.fact.data).not.toHaveProperty('price');
        expect(state.locations.find(l => l.id === ground.id)!.controllingFactionId).toBe(recipient.id);
        expect(recipient.controlledLocationIds).toContain(ground.id);
        expect(grantor.controlledLocationIds).not.toContain(ground.id);
        expect(state.history.facts.map(f => f.id)).toContain(granted.fact.id);
    });

    it('lets a stronger rival seize a workable vein without changing its grant authority', () => {
        const state = seedWorld({ seed: 'vein-rival', catalog: fixtureCatalog(), population: 250 }).state;
        const holder = state.factions.find(f => f.id === 'sect-azure-cloud')!;
        const rival = state.factions.find(f => f.id === 'sect-crimson-abyss')!;
        const ground = state.locations.find(l => l.kind === 'vein' && l.controllingFactionId === holder.id)!;
        const grantor = whoGrantsThisVein(state, ground)!.id;
        for (const f of state.factions) {
            if (f.id !== holder.id && f.id !== rival.id) f.dissolvedOnDay = state.currentDay;
        }
        holder.resources.power_ordinal = ground.thresholds.operational;
        rival.resources.power_ordinal = ground.thresholds.operational + 1;
        const event = PRESSURE_TEMPLATES.find(t => t.kind === 'vein_lost')!
            .apply(state, state.currentDay + 1, forStream(state.seed, 'test-vein-seizure', ground.id));
        expect(event).not.toBeNull();
        expect(state.locations.find(l => l.id === ground.id)!.controllingFactionId).toBe(rival.id);
        // Revive the authority to ask the jurisdiction question again.
        state.factions.find(f => f.id === grantor)!.dissolvedOnDay = null;
        expect(whoGrantsThisVein(state, ground)!.id).toBe(grantor);
    });

    it('distributes every shipped vein at opening, including the ocean and eastern plain', async () => {
        const catalog = await loadCultivationCatalog();
        const state = seedWorld({ seed: 'all-veins-held', catalog, population: 300 }).state;
        const veins = state.locations.filter(l => l.kind === 'vein');
        expect(veins.length).toBeGreaterThan(0);
        for (const ground of veins) {
            expect(ground.tags).not.toContain('forbidden');
            const holder = state.factions.find(f => f.id === ground.controllingFactionId);
            expect(holder, ground.name).toBeDefined();
            expect(holder!.controlledLocationIds).toContain(ground.id);
        }
        for (const region of ['region-drowned-reach', 'region-wide-field']) {
            const ground = veins.find(l => l.data.catalogRegionId === region)!;
            const fact = state.history.facts.find(f => f.locationId === ground.id
                && f.data.howAVeinChangedHands === 'granted')!;
            expect(fact).toBeDefined();
            expect(fact.factionIds).toContain(whoGrantsThisVein(state, ground)!.id);
            expect(fact.factionIds).toContain(ground.controllingFactionId);
            expect(Number(state.factions.find(f => f.id === ground.controllingFactionId)!.resources.power_ordinal))
                .toBeGreaterThanOrEqual(ground.thresholds.operational);
        }
    });
});
