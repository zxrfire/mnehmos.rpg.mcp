import { describe, it, expect } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { deriveOrdinal, histogram, livingPopulation, seedWorld } from '../../../src/engine/world/seeding.js';
import { densityFromProfile, dominantAmbient } from '../../../src/engine/world/catalog.js';
import { getSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { queryFacts } from '../../../src/engine/world/history.js';
import { locationHistory } from '../../../src/engine/world/locations.js';
import { nextWindow } from '../../../src/engine/world/opportunities.js';

const YEAR = 365;

function seeded(seed = 'seed-a', population = 300) {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population });
}

describe('seeding: a world that is already running', () => {
    it('is deterministic for a seed and different across seeds', () => {
        const a = seeded('seed-a');
        const b = seeded('seed-a');
        expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
        expect(JSON.stringify(seeded('seed-b').state)).not.toBe(JSON.stringify(a.state));
    });

    it('produces hundreds of NPCs, not tens of thousands', () => {
        const { state, stats } = seeded('seed-a', 300);
        expect(stats.npcs).toBeGreaterThan(250);
        expect(stats.npcs).toBeLessThan(400);
        expect(livingPopulation(state)).toBe(stats.npcs);
    });

    it('instantiates every faction with a seat, a treasury and its rivalries', () => {
        const { state } = seeded();
        expect(state.factions).toHaveLength(fixtureCatalog().factions.length);

        const azure = state.factions.find(f => f.id === 'sect-azure-cloud')!;
        expect(azure.seatLocationId).toBe('loc-region-low-fall');
        expect(azure.resources.spirit_stones).toBeGreaterThan(0);
        expect(azure.standing['sect-crimson-abyss']).toBeLessThan(0);
        // Federated: it answers to somebody, and the catalog says who.
        expect(azure.tags).toContain('federated');
        expect(azure.standing['court-third-sill']).toBeGreaterThan(0);

        const grove = state.factions.find(f => f.id === 'sect-standing-grove')!;
        expect(grove.tags).toContain('deference');
        expect(grove.tags).toContain('closed');
    });

    it('gives vein-holding factions an actual vein location they control', () => {
        const { state } = seeded();
        const veins = state.locations.filter(l => l.kind === 'vein');
        expect(veins.length).toBeGreaterThan(0);
        const held = veins.filter(v => v.controllingFactionId !== null);
        expect(held.length).toBeGreaterThan(0);
        for (const vein of held) {
            const owner = state.factions.find(f => f.id === vein.controllingFactionId)!;
            expect(owner.controlledLocationIds).toContain(vein.id);
        }
    });

    it('builds locations from the region data with gating and scars', () => {
        const { state } = seeded();
        const lowFall = state.locations.find(l => l.id === 'loc-region-low-fall')!;
        expect(lowFall.kind).toBe('region');
        expect(lowFall.thresholds.mastery).toBe(21);
        expect(lowFall.environment.historicalScars.length).toBeGreaterThan(0);
        expect(lowFall.tags).toContain('home');

        const scarwater = state.locations.find(l => l.id === 'loc-region-scarwater')!;
        expect(scarwater.qiDensity).toBeLessThan(lowFall.qiDensity);
        expect(scarwater.hazards).toContain('thin_qi');
        expect(scarwater.environment.specialRules.length).toBeGreaterThan(0);

        // Places are children of their region, and roads are symmetric.
        const sweptground = state.locations.find(l => l.name === 'Sweptground')!;
        expect(sweptground.parentId).toBe('loc-region-low-fall');
        expect(lowFall.links.some(l => l.toLocationId === 'loc-region-scarwater')).toBe(true);
        expect(scarwater.links.some(l => l.toLocationId === 'loc-region-low-fall')).toBe(true);
    });

    it('seeds several prior ages so ruins have real events behind them', () => {
        const { state, stats } = seeded();
        expect(stats.priorFacts).toBeGreaterThan(20);
        expect(state.history.eras.length).toBeGreaterThanOrEqual(4);

        const ruins = state.locations.filter(l => l.kind === 'ruin');
        expect(ruins.length).toBeGreaterThan(0);
        const factIds = new Set(state.history.facts.map(f => f.id));
        for (const ruin of ruins) {
            expect(factIds.has(ruin.originFactId!)).toBe(true);
            expect(locationHistory(ruin).length).toBeGreaterThanOrEqual(2);
        }
    });

    it('puts opportunity windows and grant renewals on the books at seeding', () => {
        const { state, stats } = seeded();
        expect(stats.opportunities).toBeGreaterThan(0);
        expect(stats.scheduledEffects).toBeGreaterThan(0);

        // Recruitment recurs annually and nobody has been told about any of it.
        const recruit = state.opportunities.find(o => o.kind === 'recruitment')!;
        expect(recruit.recurrenceDays).toBe(YEAR);
        expect(recruit.knownToIds).toHaveLength(0);
        expect(nextWindow(recruit, state.currentDay)).not.toBeNull();

        // The federated sect's grant expires on a date somebody else controls.
        const grant = state.schedule.find(e => e.data.kind === 'grant_renewal')!;
        expect(grant.factionId).toBe('sect-azure-cloud');
        expect(grant.repeatDays).toBe(12 * YEAR);
    });

    it('builds lineages so a death has somewhere to send what it leaves', () => {
        const { state, stats } = seeded();
        expect(stats.lineages).toBeGreaterThan(0);
        for (const lineage of state.lineages) {
            expect(lineage.edges.length).toBeGreaterThan(0);
            for (const edge of lineage.edges) {
                const parent = state.npcs.find(n => n.id === edge.parentId)!;
                const child = state.npcs.find(n => n.id === edge.childId)!;
                expect(child.identity.bornOnDay).toBeGreaterThan(parent.identity.bornOnDay);
            }
        }
    });
});

describe('seeding: nobody is flagged important', () => {
    it('carries no importance field anywhere on an NPC', () => {
        const { state } = seeded();
        const serialised = JSON.stringify(state.npcs[0]);
        expect(serialised).not.toMatch(/important|isProdigy|protagonist|plotArmou?r|chosen/i);
    });

    it('derives realm from rolled inputs rather than assigning it', () => {
        // Same age, same everything except the root. The muddled root is the
        // most common draw in the world and it is the one that goes nowhere.
        const attrs = { might: 2, insight: 2, fortune: 1, charm: 2 };
        const rngFor = () => forStream('x', 'derive', 1);
        const single = deriveOrdinal('single_fire', attrs, 90, 1, 44, rngFor());
        const muddled = deriveOrdinal('muddled_five_element', attrs, 90, 1, 44, rngFor());
        expect(getSpiritRoot('single_fire').cultivationSpeed)
            .toBeGreaterThan(getSpiritRoot('muddled_five_element').cultivationSpeed);
        expect(single).toBeGreaterThan(muddled);
    });

    it('caps everyone at the ceiling of the province they were born in', () => {
        const attrs = { might: 3, insight: 4, fortune: 3, charm: 3 };
        const capped = deriveOrdinal('single_fire', attrs, 200, 2, 13, forStream('x', 'a', 1));
        expect(capped).toBeLessThanOrEqual(13);

        const { state } = seeded();
        for (const npc of state.npcs) {
            const region = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
            const ceiling = fixtureCatalog().regions.find(r => r.id === region)?.localCeilingOrdinal ?? 44;
            expect(npc.cultivation.realmOrdinal).toBeLessThanOrEqual(ceiling);
        }
    });

    it('makes the leader whoever came out strongest, and says so when that is weak', () => {
        const { state } = seeded();
        for (const faction of state.factions) {
            const members = state.npcs.filter(n => n.factionId === faction.id && n.status === 'alive');
            if (members.length === 0) continue;
            const top = members.reduce((a, b) =>
                b.cultivation.realmOrdinal > a.cultivation.realmOrdinal ? b : a);
            const leader = members.reduce((a, b) => (b.factionRankIndex > a.factionRankIndex ? b : a));
            expect(leader.cultivation.realmOrdinal).toBe(top.cultivation.realmOrdinal);
        }
        // A faction whose draw came out weak is recorded as being in trouble,
        // which nobody decided.
        const weak = state.factions.filter(f => f.tags.includes('underpowered'));
        for (const f of weak) {
            expect(queryFacts(state.history, { factionId: f.id, kinds: ['succession'] }).length)
                .toBeGreaterThan(0);
        }
    });

    it('produces a population most of which never leaves the first realm', () => {
        const { state } = seeded('seed-a', 350);
        const bands = histogram(state);
        const total = bands.reduce((a, b) => a + b, 0);
        // Qi Condensation is band zero. The overwhelming majority stay there.
        expect(bands[0] / total).toBeGreaterThan(0.6);
        // And some do get out, or the world has no cultivators in it.
        expect(bands.slice(1).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    });

    it('makes a poor province a worse place to be born than a rich one', () => {
        const { state } = seeded('seed-a', 350);
        const meanFor = (regionId: string) => {
            const rows = state.npcs.filter(n => n.tags.includes(`region:${regionId}`));
            return rows.reduce((s, n) => s + n.cultivation.realmOrdinal, 0) / Math.max(1, rows.length);
        };
        expect(meanFor('region-highstair')).toBeGreaterThan(meanFor('region-scarwater'));
    });

    it('gives everyone a goal with the five fields filled in', () => {
        const { state } = seeded();
        for (const npc of state.npcs.slice(0, 40)) {
            expect(npc.goals.length).toBeGreaterThan(0);
            const goal = npc.goals[0];
            expect(goal.text.length).toBeGreaterThan(0);
            expect(goal.priority).toBeGreaterThan(0);
            expect(goal.originHolderId).toBe(npc.id);
            expect(goal.generation).toBe(0);
        }
    });
});

describe('catalog adapter', () => {
    it('reads a density and a dominant band out of an ambient profile', () => {
        expect(dominantAmbient({ thin: 70, normal: 30 })).toBe('thin');
        expect(dominantAmbient({ thin: 10, dense: 60, normal: 30 })).toBe('dense');
        expect(densityFromProfile({ thin: 100 })).toBeLessThan(densityFromProfile({ dense: 100 }));
        expect(densityFromProfile({})).toBeCloseTo(0.35, 5);
    });
});
