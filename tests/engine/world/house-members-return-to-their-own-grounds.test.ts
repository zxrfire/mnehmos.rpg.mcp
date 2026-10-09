/** The capital census found only 249/588 members home at ten years. Actual
 * writes assigned seeded membership without moving into the house and erased
 * overdue post activities at their town. A post is still an obligation until
 * a replacement arrives; the warning is a ledger fact, not a cancelled route.
 * A stronger head does not multiply a catalog house's external establishments.
 * These small native cases protect those causes without walking a century. */
import { expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { fixtureCatalog } from './fixtures.js';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { applyPostings } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { getSect } from '../../../src/data/cultivation/sects.js';

it('ordinary seeded house members live at their house unless its actual activity places them away', () => {
    const state = seedWorld({ seed: 'ordinary-members-live-at-home', catalog: fixtureCatalog(), population: 120 }).state;
    const members = state.npcs.filter(n => /^npc-\d+$/.test(n.id) && n.factionId);
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) {
        if (member.activity?.kind === 'stationed' || member.activity?.kind === 'out_with_a_party'
            || member.activity?.kind === 'travelling') continue;
        expect(member.locationId).toBe(state.factions.find(h => h.id === member.factionId)!.seatLocationId);
    }
});

it('an overdue standing post keeps its real binding and is reported only once while awaiting relief', () => {
    const state = createWorld({ seed: 'an-overdue-post-is-still-a-post', skipPriorAges: true, regionCount: 0 });
    state.populationTarget = 0;
    const home = makeLocation({ id: 'home', name: 'House grounds', kind: 'sect_seat' });
    const town = makeLocation({ id: 'town', name: 'Market', kind: 'settlement' });
    linkLocations(home, town, 'road', 3); state.locations.push(home, town);
    const house = makeFaction({ id: 'watch-house', name: 'Cloud Reed House', seatLocationId: home.id,
        resources: { power_ordinal: 8, spirit_stones: 0 } });
    state.factions.push(house);
    const start = state.currentDay;
    const person = createNpc(state.seed, { id: 'watcher', locationId: town.id, factionId: house.id,
        onDay: start, bornOnDay: start - 25 * 365 });
    person.activity = { kind: 'stationed', note: 'Holding the market post.', withIds: [],
        sinceDay: start - 10, untilDay: start + 1, returnTo: home.id };
    state.npcs.push(person);
    advanceWorldForPlay(state, { days: 2 * 365, stopOnInterrupt: false,
        pressure: { intensity: 0, peopleWalkOutOnTheirOwnAccount: false } });
    const actual = state.npcs.find(n => n.id === person.id)!;
    expect(actual.locationId).toBe(town.id);
    expect(actual.activity?.kind).toBe('stationed');
    expect(actual.activity?.sinceDay).toBe(start - 10);
    expect(state.history.facts.filter(f => f.data.pressure === 'overdue'
        && f.actors.some(a => a.id === person.id))).toHaveLength(1);
    expect(state.history.facts.some(f => f.data.postRelief === true)).toBe(false);
});

it('a catalog house keeps the same number of posts when its head grows stronger', () => {
    const catalog = getSect('sect-six-li-patrol')!;
    const counts = [catalog.powerOrdinal, 60].map(power => {
        const state = createWorld({ seed: 'catalog-post-weight', skipPriorAges: true, regionCount: 0 });
        const home = makeLocation({ id: 'home', name: 'House grounds', kind: 'sect_seat' });
        state.locations.push(home);
        for (let i = 0; i < 8; i++) {
            const town = makeLocation({ id: `town-${i}`, name: `Market ${i}`, kind: 'settlement' });
            linkLocations(home, town, 'road', 1); state.locations.push(town);
        }
        const house = makeFaction({ id: catalog.id, name: catalog.name, ranks: catalog.ranks,
            seatLocationId: home.id, resources: { power_ordinal: power, spirit_stones: 0 } });
        state.factions.push(house);
        for (let i = 0; i < 12; i++) state.npcs.push(createNpc(state.seed, { id: `hand-${i}`,
            locationId: home.id, factionId: house.id, factionRankIndex: 0,
            onDay: state.currentDay, bornOnDay: state.currentDay - 25 * 365 }));
        applyPostings(state, Math.floor(state.currentDay / 365), state.currentDay, { initialPlacement: true });
        return state.npcs.filter(n => n.activity?.kind === 'stationed').length;
    });
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBe(counts[0]);
});
