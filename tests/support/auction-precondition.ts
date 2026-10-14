/** A retained object's provenance holds a lot whose actual closing receipt is still in history. */
import type { WorldState } from '../../src/engine/world/world-state.js';

export function isAClosedReferencedLot(world: WorldState, lotId: string): boolean {
    const lot = world.history.facts.find(fact => fact.id === lotId);
    if (lot?.data.auctionLot !== true || typeof lot.data.objectId !== 'string'
        || typeof lot.data.closesOnDay !== 'number' || lot.data.closesOnDay >= world.currentDay - 365) return false;
    const object = world.objects.find(object => object.id === lot.data.objectId);
    return !!object && object.provenance.some(link => link.factId === lotId)
        && world.history.facts.some(fact => fact.data.auctionResult === true && fact.data.lotId === lotId);
}
