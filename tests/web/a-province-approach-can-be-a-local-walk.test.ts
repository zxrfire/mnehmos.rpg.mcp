/** Combat15 diagnostic51857 recorded Buddha Precipice resolving to the actual
 * Iron Crest endpoint where the body already stood: native course.days=0,
 * road0 written, cursor reader correctly rejected it, foot check then threw.
 * Different names need not mean different physical vertices. This control asks
 * the existing province approach for its real endpoint, arranges a healthy SQL
 * body there and existing told route knowledge, then plays the printed name.
 * The actual fifteen-minute local walk must keep that body there with no ghost
 * cursor. Positive fractional continuation remains a road (retained sibling).
 * No catalog route, NPC, calendar, encounter or geometry is substituted.
 */
import { LOCAL_WALK_DAYS } from '../../src/engine/world/local-walking-cost.js';
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { whereTheRoadEndsIn } from '../../src/engine/world/public-transport-at-a-place.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { walkingRouteFrom } from '../../src/engine/world/locations.js';
import { positionOnRoad, roadContinuationTo } from '../../src/engine/world/road-course.js';
import { FLAG_ROAD_STOPPED, stoppedRoadFor, betweenRoadEndpoints } from '../../src/web/a-road-stopped-partway.js';
import { readFlag } from '../../src/server/consolidated/cultivation-support.js';

it('plays a known province name whose actual approach is the present settlement as a local walk', async () => {
    const { game, repos } = await makeGameInWorld({ seed: 'came-at-flee-movement', worldSeed: 'road-world' });
    await game.newRun('Traveller');
    game.atHand = await game.loadWorld();
    const world = game.atHand!;
    const province = world.locations.find(row => row.kind === 'region'
        && whereTheRoadEndsIn(world, row.name).name !== row.name)!;
    expect(province).toBeDefined();
    const endpoint = worldLocationFor(world, whereTheRoadEndsIn(world, province.name).name)!;
    expect(endpoint.kind).toBe('settlement');
    const me = game.currentRun().cultivator;
    repos.cultivators.update(me.id, { location: endpoint.name, realmOrdinal: 20,
        hp: 1000, maxHp: 1000, spiritStones: 5000 });
    repos.cultivators.standIn(me.id, null);
    game.noteEncounter(game.currentRun().cultivator, game.currentRun().run,
        { kind: 'place', id: province.name, name: province.name }, 'told', 'The province approach is known.');
    const route = walkingRouteFrom(world.locations, endpoint.id, endpoint.id)!;
    const course = roadContinuationTo(world.locations, positionOnRoad(route, 0), endpoint.id)!;
    expect(course.days).toBe(0);
    const before = game.currentRun();
    const result = await game.act(`I travel to ${province.name}`);
    const actual = game.currentRun();
    expect(result.narration).toContain(endpoint.name);
    expect(actual.cultivator.alive).toBe(true);
    expect(actual.cultivator.location).toBe(endpoint.name);
    expect(actual.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(LOCAL_WALK_DAYS);
    expect(readFlag(game.db, me.id, FLAG_ROAD_STOPPED)).toBeNull();
    expect(stoppedRoadFor(game.db, actual.cultivator, game.atHand)).toBeNull();
    expect(betweenRoadEndpoints(game.db, actual.cultivator)).toBe(false);
    expect(game.worldPlaceOf(actual.cultivator)).toBe(endpoint.id);
}, 120_000);
