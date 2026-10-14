/** The same local replacement situation in a small arrangement and a lived census. */
import type { WorldState } from '../../src/engine/world/world-state.js';
import { populationWeightOf } from '../../src/engine/world/locations.js';
import { theChildrenAnActConceived } from '../../src/engine/world/a-child-an-act-conceived.js';
import { isBelowTheLid } from '../../src/engine/world/layers.js';

export function hasLocalReplacementSituation(world: WorldState, fullId: string, vacantId: string): boolean {
    const eligible = (id: string) => world.locations.find(place => place.id === id && isBelowTheLid(place)
        && place.kind === 'settlement' && !place.sealed && place.thresholds.entry <= 0
        && place.thresholds.survival <= 0 && populationWeightOf(place) > 0);
    const full = eligible(fullId), vacant = eligible(vacantId);
    if (!full || !vacant || fullId === vacantId || world.populationTarget <= 0
        || !world.locations.some(place => place.kind === 'region' && isBelowTheLid(place))) return false;
    const appointment = Math.floor(world.currentDay / 365) * 365 + 180;
    if (theChildrenAnActConceived(world, appointment).length > 0) return false;
    const alive = world.npcs.filter(person => person.status === 'alive');
    return alive.length >= world.populationTarget
        && alive.filter(person => person.locationId === fullId).length === populationWeightOf(full)
        && alive.filter(person => person.locationId === vacantId).length < populationWeightOf(vacant);
}
