/** One native birth-appointment scenario for an arranged or a lived replacement situation. */
import { expect } from 'vitest';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { populationWeightOf } from '../../src/engine/world/locations.js';
import { applyPressure } from '../../src/engine/world/the-world-changing-on-its-own.js';
import { hasLocalReplacementSituation } from './population-precondition.js';

export function localVacanciesCanReplaceResidents(world: WorldState, fullId: string, vacantId: string): void {
    expect(hasLocalReplacementSituation(world, fullId, vacantId)).toBe(true);
    const before = new Set(world.npcs.map(person => person.id));
    const yearStart = Math.floor(world.currentDay / 365) * 365;
    expect(applyPressure(world, yearStart + 179, yearStart + 180, { intensity: 0 }).born).toBeGreaterThan(0);
    const newPeople = world.npcs.filter(person => !before.has(person.id));
    expect(newPeople.length).toBeGreaterThan(0);
    const full = world.locations.find(place => place.id === fullId)!;
    // A full settlement was not supplied another ordinary demographic resident.
    expect(newPeople.filter(person => person.locationId === fullId)).toEqual([]);
    expect(world.npcs.filter(person => person.status === 'alive' && person.locationId === fullId).length)
        .toBeLessThanOrEqual(populationWeightOf(full));
}
