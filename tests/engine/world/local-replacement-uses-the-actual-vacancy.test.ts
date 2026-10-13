/**
 * Century census volumes diagnosed local drain hidden behind a full global
 * population. Arrange one full and one vacant ordinary settlement while the
 * global target is already met, then run the actual yearly birth appointment.
 * The separate population-census reachability test uses this exact shared
 * hasLocalReplacementSituation predicate on aged, source-keyed worlds.
 * Its contract sends a real qualifying pair into the same appointment function.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { hasLocalReplacementSituation } from '../../support/population-precondition.js';
import { localVacanciesCanReplaceResidents } from '../../support/population-scenario.js';

it('replaces local vacancies despite a full world and does not overfill the other settlement', () => {
    const world = createWorld({ seed: 'local-census-window', presentYear: 0, regionCount: 0, skipPriorAges: true });
    world.populationTarget = 1;
    world.locations.push(makeLocation({ id: 'province', name: 'Province', kind: 'region' }),
        makeLocation({ id: 'full', name: 'Full Village', kind: 'settlement', parentId: 'province', data: { populationWeight: 2 } }),
        makeLocation({ id: 'vacant', name: 'Vacant Town', kind: 'settlement', parentId: 'province', data: { populationWeight: 60 } }));
    for (let i = 0; i < 2; i++) world.npcs.push(createNpc(world.seed, { id: `resident-${i}`,
        locationId: 'full', onDay: 0, bornOnDay: -20 * 365 }));
    expect(hasLocalReplacementSituation(world, 'full', 'vacant')).toBe(true);
    localVacanciesCanReplaceResidents(world, 'full', 'vacant');
});
