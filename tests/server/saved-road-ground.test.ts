/**
 * Road ground originally reached only fresh seeding. A saved installation would
 * therefore keep travelling between endpoints without any intermediate ground.
 * Opening its real persisted world must add the same priced ground once, without
 * reseeding its people or clock; a second restart must leave that upgrade intact.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { closeDb, getDb } from '../../src/storage/index.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { activeWorld, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { linkLocations, makeLocation, walkingDaysFrom } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { fixtureCatalog } from '../engine/world/fixtures.js';

beforeEach(() => { closeDb(); resetCultivationWorlds(); getDb(':memory:'); });
afterEach(() => { resetCultivationWorlds(); closeDb(); });

it('upgrades persisted roads without changing their price or the lives already held', async () => {
    const state = createWorld({ seed: 'saved-road-ground', regionCount: 0, skipPriorAges: true });
    const a = makeLocation({ id: 'saved-a', name: 'Saved A', kind: 'settlement' });
    const b = makeLocation({ id: 'saved-b', name: 'Saved B', kind: 'settlement' });
    linkLocations(a, b, 'road', 4);
    state.locations = [a, b];
    state.currentDay = 73;
    state.npcs = [createNpc(state.seed, { id: 'saved-resident', onDay: 73, bornOnDay: -7300,
        locationId: a.id, occupation: 'unknown' })];
    const people = structuredClone(state.npcs);
    const store = new WorldStateRepository(getDb());
    store.saveWorld(state);

    const opened = await activeWorld();
    expect(walkingDaysFrom(opened.state.locations, a.id).get(b.id)).toBe(4);
    expect(opened.state.locations.some(place => place.tags.includes('route-stop'))).toBe(true);
    expect(opened.state.npcs).toEqual(people);
    expect(opened.state.currentDay).toBe(73);
    const upgraded = store.loadWorld(state.id)!;
    expect(upgraded.locations).toEqual(opened.state.locations);

    resetCultivationWorlds();
    expect((await activeWorld()).state).toEqual(upgraded);
});

it('opens an older occupied compound with its missing infirmary without rebuilding other rooms', async () => {
    const state = seedWorld({ seed: 'saved-infirmary-ground', catalog: fixtureCatalog(), population: 12 }).state;
    const old = state.locations.find(place => place.data.purpose === 'infirmary'
        && state.factions.some(house => house.id === place.data.factionId && house.dissolvedOnDay === null))!;
    expect(old).toBeDefined();
    state.locations = state.locations.filter(place => place.id !== old.id);
    for (const place of state.locations) place.links = place.links.filter(link => link.toLocationId !== old.id);
    const before = structuredClone(state);
    const store = new WorldStateRepository(getDb());
    store.saveWorld(state);

    const opened = (await activeWorld()).state;
    expect(opened.locations.some(place => place.data.factionId === old.data.factionId
        && place.data.purpose === 'infirmary')).toBe(true);
    expect(opened.npcs).toEqual(before.npcs);
    expect(opened.currentDay).toBe(before.currentDay);
    for (const place of before.locations) {
        const after = opened.locations.find(row => row.id === place.id)!;
        expect({ ...after, links: [] }).toEqual({ ...place, links: [] });
        expect(after.links).toEqual(expect.arrayContaining(place.links));
    }
    const persisted = store.loadWorld(state.id)!;
    resetCultivationWorlds();
    expect((await activeWorld()).state).toEqual(persisted);
});
