/**
 * A dao-ground completion used to vanish with the visitor: the ground could
 * fill for forty years and then empty without anybody elsewhere ever having a
 * fact to repeat. This plays the ordinary news verb after a forty-year visit.
 * A listener at the ground hears the named comprehension; the same listener in
 * another province, with no house tie, does not. The fact is deliberately a
 * low-rung one, so the distance gate rather than an exceptional achievement
 * decides the negative arm.
 */

import { describe, expect, it } from 'vitest';

import { PLACES_THAT_TEACH_A_DAO } from '../../src/data/cultivation/places-that-teach-a-dao.js';
import { YEARS_A_ROAD_COSTS } from '../../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { applyDaoGroundStints } from '../../src/engine/world/dao-ground-stints.js';
import { daoGroundLocationId } from '../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { regionOf } from '../../src/engine/world/what-people-are-saying.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { makeGameInWorld } from './harness.js';

const STEPS = PLACES_THAT_TEACH_A_DAO.find(place => place.id === 'dao-ground-drowning-steps')!;
const STEPS_ID = daoGroundLocationId(STEPS);

describe('a dao-ground comprehension reaches play as ordinary news', () => {
    it('is heard at the ground after its years, but not in an unrelated province', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'dao-comprehension-news-run', worldSeed: 'dao-comprehension-news-world'
        });
        const { cultivator } = await game.newRun('Listener');
        const world = (await game.loadWorld())!;
        const day = Math.floor(world.currentDay);
        const steps = world.locations.find(place => place.id === STEPS_ID)!;
        const stepRegion = regionOf(world, STEPS_ID);
        const far = world.locations.find(place => place.kind === 'settlement'
            && regionOf(world, place.id) !== stepRegion)!;
        const visitorAt = world.npcs.findIndex(npc => npc.status === 'alive'
            && npc.locationId !== null && npc.locationId !== STEPS_ID
            && npc.cultivation.realmOrdinal < 8);
        const witnessAt = world.npcs.findIndex((npc, at) => at !== visitorAt
            && npc.status === 'alive' && npc.locationId !== null);
        expect(visitorAt).toBeGreaterThanOrEqual(0);
        expect(witnessAt).toBeGreaterThanOrEqual(0);

        // This turn tests one new piece of news, not which older seeded fact wins a market's two slots.
        world.history.facts = [];

        const visitor = world.npcs[visitorAt]!;
        world.npcs[visitorAt] = {
            ...visitor,
            locationId: STEPS_ID,
            activity: {
                kind: 'comprehending', note: `Studying ${STEPS.subject}.`, withIds: [],
                sinceDay: day - YEARS_A_ROAD_COSTS.ground_open * 365,
                untilDay: null, returnTo: visitor.locationId
            }
        };
        // Somebody who was there answers the player through the ordinary crowd read.
        world.npcs[witnessAt] = {
            ...world.npcs[witnessAt]!, locationId: STEPS_ID, activity: null
        };

        expect(applyDaoGroundStints(world, day).comprehended).toBeGreaterThanOrEqual(1);
        world.currentDay = day + 20;
        const fact = world.history.facts.find(row => row.kind === 'dao_comprehension'
            && row.actors.some(actor => actor.id === visitor.id));
        expect(fact?.witnessIds).toContain(world.npcs[witnessAt]!.id);
        new WorldStateRepository(db).saveWorld(world);

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(far.name, cultivator.id);
        const distant = await game.act('what are people saying');
        expect(distant.narration).not.toContain(visitor.name);
        expect(distant.narration).not.toContain('life-and-death dao');

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(steps.name, cultivator.id);
        const near = await game.act('what are people saying');
        expect(near.narration).toContain(visitor.name);
        expect(near.narration).toContain('comprehended');
        expect(near.narration).toContain('life-and-death dao');
        expect(near.toolCalls.some(call => call.name === 'world.whatTheySay' && call.ok)).toBe(true);
        expect(new KnowledgeGate(db).isAwareOf(cultivator.id, 'cultivator', visitor.id)).toBe(true);
    }, 180_000);
});
