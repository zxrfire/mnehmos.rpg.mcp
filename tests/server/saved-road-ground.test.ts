/**
 * Road ground originally reached only fresh seeding. A saved installation would
 * therefore keep travelling between endpoints without any intermediate ground.
 * Opening its real persisted world must add the same priced ground once, without
 * reseeding its people or clock; a second restart must leave that upgrade intact.
 * The later conditional-infirmary and fixed-at-founding rulings overturn the
 * former automatic dispensary append. Existing quarters supply care without
 * changing any other room, its people or its clock. That fixture first applies
 * the independently tested road/metric migration, so missing metric coordinates
 * cannot be mistaken for rebuilt clinical rooms.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { closeDb, getDb } from '../../src/storage/index.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { activeWorld, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { linkLocations, makeLocation, walkingDaysFrom } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { roomForHouseWork } from '../../src/engine/world/where-a-house-does-its-work.js';
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

it('keeps founded rooms and uses ordinary care ground when an old infirmary is absent', async () => {
    let state = seedWorld({ seed: 'saved-infirmary-ground', catalog: fixtureCatalog(), population: 12 }).state;
    const store = new WorldStateRepository(getDb());
    store.saveWorld(state);
    state = (await activeWorld()).state;
    resetCultivationWorlds();
    const old = state.locations.find(place => place.data.purpose === 'infirmary'
        && state.factions.some(house => house.id === place.data.factionId && house.dissolvedOnDay === null))!;
    expect(old).toBeDefined();
    state.locations = state.locations.filter(place => place.id !== old.id);
    for (const place of state.locations) place.links = place.links.filter(link => link.toLocationId !== old.id);
    const before = structuredClone(state);
    store.saveWorld(state);

    const opened = (await activeWorld()).state;
    expect(opened.locations.some(place => place.data.factionId === old.data.factionId
        && place.data.purpose === 'infirmary')).toBe(false);
    const care = roomForHouseWork(opened.locations, String(old.data.factionId), 'infirmary');
    expect(care).not.toBeNull();
    expect(care!.data.purpose).not.toBe('infirmary');
    expect(before.locations.some(place => place.id === care!.id)).toBe(true);
    expect(opened.npcs).toEqual(before.npcs);
    expect(opened.currentDay).toBe(before.currentDay);
    for (const place of before.locations) {
        const after = opened.locations.find(row => row.id === place.id)!;
        const changed = [...new Set([...Object.keys(place), ...Object.keys(after)])]
            .filter(key => key !== 'links' && JSON.stringify(after[key as keyof typeof after]) !== JSON.stringify(place[key as keyof typeof place]))
            .map(key => ({ key, before: place[key as keyof typeof place], after: after[key as keyof typeof after] }));
        expect({ ...after, links: [] }, JSON.stringify(changed)).toEqual({ ...place, links: [] });
        expect(after.links).toEqual(expect.arrayContaining(place.links));
    }
    const persisted = store.loadWorld(state.id)!;
    resetCultivationWorlds();
    expect((await activeWorld()).state).toEqual(persisted);
});
