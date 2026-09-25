/**
 * Nobody is killed for no reason.
 *
 * The killing template drew any living person as a killer, and the First Seat
 * killed Lu Sheng. The owner: *"sect relation x things they fight over x odds of
 * fighting x odds of dying"*, and *"the target for time-based killings should not
 * be random."* Pinned here: the four factors read what is between two specific
 * people, and a world's killings each carry the motive that moved them.
 *
 * RED-CHECKED. Reading neutral houses as hostile (0.6 rather than 0.02) turns
 * the relation test red, and so does dropping the rank weighting; letting
 * somebody start a fight they expect to lose - the `gap < -3` refusal in
 * `whetherItComesToBlows` - turns the disciple test red; writing the open
 * killing without its motive turns the world test red; dropping the goods read
 * from `whatTheyWouldFightOver` turns the greed test red.
 */
import { describe, it, expect } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { soakedWorld } from '../../support/soaked-world.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    NEUTRAL_HOUSES_DRAW_SWORDS,
    howTheyStandToEachOther,
    whatTheyWouldFightOver,
    whetherItComesToBlows
} from '../../../src/engine/world/why-one-cultivator-kills-another.js';
import { theCatalogStatesGoodsDoNotRegister } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

async function world(): Promise<WorldState> {
    return seedWorld({ seed: 'afford-a', catalog: await loadCultivationCatalog() }).state;
}

describe('the four factors', () => {
    it('reads two people of neutral houses as all but unwilling to draw swords, and allies as not at all', async () => {
        const state = await world();
        const houses = new Map(state.factions.map(f => [f.id, f] as const));
        const [a, b] = state.factions.filter(f => f.dissolvedOnDay === null && state.npcs.some(n => n.factionId === f.id));
        const one = state.npcs.find(n => n.factionId === a!.id)!;
        const two = { ...state.npcs.find(n => n.factionId === b!.id)!, relationships: [] };
        const fresh = { ...one, relationships: [] };
        a!.standing[b!.id] = 0; b!.standing[a!.id] = 0;
        a!.tags = a!.tags.filter(t => t !== 'at_war'); b!.tags = b!.tags.filter(t => t !== 'at_war');
        // The figure, not the constant read back at itself: two houses at peace
        // that are neither friends nor enemies are as near to not drawing swords
        // as makes no difference.
        expect(NEUTRAL_HOUSES_DRAW_SWORDS).toBeLessThan(0.05);
        expect(howTheyStandToEachOther(state, fresh, two, houses).value).toBeLessThan(0.05);
        a!.standing[b!.id] = 0.6; b!.standing[a!.id] = 0.6;
        expect(howTheyStandToEachOther(state, fresh, two, houses).value).toBe(0);
        // A half nobody wrote is not a zero: a pass that warms one end only
        // leaves the other silent, and a patron is not a neutral.
        delete b!.standing[a!.id];
        expect(howTheyStandToEachOther(state, fresh, two, houses).value).toBe(0);
        a!.standing[b!.id] = -0.8; b!.standing[a!.id] = -0.8;
        expect(howTheyStandToEachOther(state, fresh, two, houses).value).toBeGreaterThan(0.1);
        // And their houses' quarrel is carried as far as the rung carries it:
        // an elder of an enemy house is an enemy, and a junior is mostly not.
        const top = a!.ranks.length - 1;
        const junior = { ...fresh, factionRankIndex: 0 };
        const elder = { ...fresh, factionRankIndex: top };
        expect(howTheyStandToEachOther(state, elder, two, houses).value)
            .toBeGreaterThan(howTheyStandToEachOther(state, junior, two, houses).value * 2);
    }, 120_000);

    it('finds nothing to fight over between strangers with nothing on them, in a town', async () => {
        const state = await world();
        const town = state.locations.find(l => l.kind === 'settlement')!;
        const [one, two] = state.npcs.filter(n => n.status === 'alive').map(n => ({ ...n, relationships: [], historyFactIds: [] }));
        expect(whatTheyWouldFightOver({ state, killer: one!, victim: two!, place: town, carried: [], standsInTheirSeat: false })).toBeNull();
    }, 120_000);

    it('offers no greed to somebody ordinary goods register as nothing to', async () => {
        const state = await world();
        const lu = state.npcs.find(n => n.name === 'Lu Sheng')!;
        expect(theCatalogStatesGoodsDoNotRegister(lu)).toBe(true);
        const ruin = state.locations.find(l => l.kind === 'ruin')!;
        const carrying = state.npcs.find(n => n.id !== lu.id && n.status === 'alive')!;
        const carried = [{ id: 'obj-a-legendary-thing', significance: 'legendary' }];
        // The same person, the same thing in the same hand: anybody else has a
        // reason and he has none.
        expect(whatTheyWouldFightOver({
            state, killer: { ...lu, relationships: [] }, victim: carrying, place: ruin, carried, standsInTheirSeat: false
        })?.motive).not.toBe('greed');
        const anybody = { ...state.npcs.find(n => n.id !== carrying.id && n.status === 'alive' && n.name !== 'Lu Sheng')!, relationships: [] };
        expect(whatTheyWouldFightOver({
            state, killer: anybody, victim: carrying, place: ruin, carried, standsInTheirSeat: false
        })?.motive).toBe('greed');
    }, 120_000);

    it('does not set a disciple on an elder two realms above them', async () => {
        const state = await world();
        const disciple = state.npcs.find(n => n.status === 'alive' && n.cultivation.realmOrdinal >= 1 && n.cultivation.realmOrdinal <= 6)!;
        const elder = state.npcs.find(n => n.status === 'alive' && n.cultivation.realmOrdinal >= 30)!;
        const chance = whetherItComesToBlows({
            relation: { value: 1, why: 'a grievance' },
            stakes: { motive: 'a grudge', weight: 1, evil: false, objectIds: [] },
            killer: disciple, killersHouse: null, attackers: [disciple], victim: elder, victimWorth: 0,
            place: state.locations.find(l => l.kind === 'wilds') ?? null
        });
        expect(chance).toBe(0);
    }, 120_000);
});

describe('a world that runs', () => {
    it('kills people, and every killing it writes names the reason', async () => {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        const before = new Set((await soakedWorld('afford-a', { years: 0 })).history.facts.map(f => f.id));
        const state = await soakedWorld('afford-a', { years: 150 });
        const killings = state.history.facts.filter(f => !before.has(f.id)
            && f.data?.pressure === 'killing' && f.actors.some(a => a.role === 'killer'));
        expect(killings.length).toBeGreaterThan(0);
        for (const f of killings) expect(['greed', 'a grudge', 'a place', 'a seat']).toContain(f.data?.motive);
        const lu = state.npcs.find(n => n.name === 'Lu Sheng')!;
        expect(lu.status).toBe('alive');
    }, 600_000);
});
