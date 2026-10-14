/** Run the same physical offer scenario on a constructed or lived visiting factor. */
import { expect } from 'vitest';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { exchangeOffers } from '../../src/engine/world/wares-at-a-capital-exchange.js';
import { isAnActualCapitalFactor, theActualFactorsCargo } from './capital-precondition.js';

export function anActualCapitalFactorOffersItsCargo(world: WorldState, personId: string, cityId: string): void {
    expect(isAnActualCapitalFactor(world, personId, cityId)).toBe(true);
    const person = world.npcs.find(person => person.id === personId)!;
    const offers = exchangeOffers(world, person, undefined, undefined, world.currentDay);
    const cargo = theActualFactorsCargo(world, personId, cityId);
    expect(new Set(offers.map(offer => offer.objectId))).toEqual(new Set(cargo));
    expect(offers).toHaveLength(cargo.length);
    expect(offers.every(offer => offer.sellerId === personId)).toBe(true);
}
