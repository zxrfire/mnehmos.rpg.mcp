/**
 * What a world has still to find: the ruins it knows of and has not emptied,
 * and what is left in the ground under a province.
 *
 * Measurements of the discovery pass rather than parts of it, so they live
 * beside the test and the probe that read them.
 */

import {
    DEEPEST_BAND,
    foundKeyForBand,
    ruinsInGroundUnder
} from '../../src/engine/world/how-the-world-keeps-finding-more-ruins.js';
import type { LocationRecord } from '../../src/engine/world/locations.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

/**
 * Everything the world currently knows about and has not emptied.
 */
export function standingReserve(state: WorldState): LocationRecord[] {
    return state.locations.filter(
        l => l.kind === 'ruin' && l.sealed && l.discovered && !l.tags.includes('emptied')
    );
}

/** And what is left in it, across every band. Finite, and stated. */
export function stillInGroundUnder(region: LocationRecord): number {
    let total = 0;
    for (let band = 0; band <= DEEPEST_BAND; band++) {
        total += Math.max(0, ruinsInGroundUnder(region, band)
            - Number(region.data[foundKeyForBand(band)] ?? 0));
    }
    return total;
}
