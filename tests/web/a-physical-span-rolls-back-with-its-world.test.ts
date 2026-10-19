/**
 * The age-300 short-flight profile showed separate full-world appends during
 * physical boundaries and arrival. They now share the ordinary prepared-span
 * transaction. A thrown boundary must restore the body, run and world together,
 * and discard the uncommitted in-memory graph before another action can use it.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { spendWithPhysicalCarrier } from '../../src/web/a-physical-span.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';

it('rolls back an actual physical boundary and evicts its world when the adapter throws', async () => {
    const h = await makeGameInWorld({ seed: 'physical-rollback-run', worldSeed: 'physical-rollback-world', worldEnabled: true });
    try {
        await h.game.newRun('The passenger');
        const initial = h.game.currentRun();
        const world = h.game.atHand = await prepareWorldClockForPreciseSpan(initial.run, initial.cultivator);
        const before = h.game.currentRun();
        const store = new WorldStateRepository(h.db);
        const persisted = JSON.stringify(store.loadWorld(world.id));
        const now = routineTime(world);
        const place = world.locations.find(row => row.name === before.cultivator.location)!;
        expect(place).toBeTruthy();
        const advance = h.game.advancePreparedWorld.bind(h.game);
        let reached = false;
        h.game.advancePreparedWorld = (...args) => {
            advance(...args);
            reached = true;
            throw new Error('physical boundary failed');
        };
        await expect(spendWithPhysicalCarrier(h.game, before.run, before.cultivator, .125, 0,
            () => ({ locationId: place.id, endsOnDay: now + .125, unavailable: null })))
            .rejects.toThrow('physical boundary failed');
        expect(reached).toBe(true);
        expect(h.game.currentRun()).toEqual(before);
        expect(JSON.stringify(store.loadWorld(world.id))).toBe(persisted);
        expect(h.game.atHand).toBeNull();
    } finally { h.db.close(); }
}, 30_000);
