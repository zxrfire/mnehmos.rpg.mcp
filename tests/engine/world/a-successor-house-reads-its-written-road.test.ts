/**
 * Generated houses formerly read an empty catalog shelf even while holding
 * real manuals. The long ladder census showed 94% at the floor at 1,500 years,
 * with empty Nascent/Deity bands. A year-500 checkpoint held 136 physical
 * library rows at its ten surviving new houses, but no unruined gifted founder
 * books: their actual replacement stock was written by masters. Arrange that
 * stock through applyManualCopying and ask its shelf.
 * isANewHouseWithAWrittenRoad defines all relevant arranged facts; the separate
 * cached ladder reachability test requires exactly the same predicate in lived
 * worlds and retains the population, narrowing, decline and turnover checks.
 */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { applyManualCopying } from '../../../src/engine/world/manuals.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { isANewHouseWithAWrittenRoad } from '../../support/ladder-precondition.js';
import { aSuccessorReadsItsPhysicalRoad } from '../../support/ladder-scenario.js';

it('reads the physical written road as the new house shelf without a catalog entry', () => {
    const world = createWorld({ seed: 'successor-library', presentYear: 1, regionCount: 0, skipPriorAges: true });
    const house = makeFaction({ id: 'successor-library-house', name: 'Reed Hall', foundedOnDay: 100 });
    const road = TECHNIQUES.find(art => art.cap === 13 && !art.element)!;
    const founder = createNpc(world.seed, { id: 'founder', factionId: house.id, onDay: world.currentDay,
        bornOnDay: -20 * 365, cultivation: { realmOrdinal: 13, techniqueIds: [road.id] } });
    world.npcs.push(founder); world.factions.push(house);
    expect(applyManualCopying(world, 1, world.currentDay)).toHaveLength(1);
    expect(isANewHouseWithAWrittenRoad(world, house.id, 0)).toBe(true);
    aSuccessorReadsItsPhysicalRoad(world, house.id, 0);
});
