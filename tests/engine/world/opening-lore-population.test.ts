/**
 * The opening census and residence ceiling were prose exports; world creation
 * never read either. A catalog outside those bounds must fail instead of quietly
 * making a different population. The bounds govern opening, and do not replace
 * the resolver's outcome when somebody later makes the crossing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const limits = vi.hoisted(() => ({ maximum: 3, residents: 1, protectors: 0 }));
vi.mock('../../../src/data/cultivation/false-immortals.js', async importOriginal => {
    const original = await importOriginal<typeof import('../../../src/data/cultivation/false-immortals.js')>();
    return {
        ...original,
        get MAX_RESIDENT_FALSE_IMMORTALS() { return limits.maximum; },
        THE_PRESENT_COUNT: {
            ...original.THE_PRESENT_COUNT,
            get residentsAtOpening() { return limits.residents; },
            get protectorsAtOpening() { return limits.protectors; }
        }
    };
});

import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { seedTheWanderers } from '../../../src/engine/world/the-wanderer-the-catalog-names-is-somebody.js';
import { HOME_REGION_ID, ADJACENT_REGION_ID } from '../../../src/data/cultivation/regions/region-ids.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../../src/engine/cultivation/realms.js';

function opening() {
    const world = createWorld({ seed: 'opening-lore', skipPriorAges: true, regionCount: 0 });
    world.locations = [HOME_REGION_ID, ADJACENT_REGION_ID].map(id => makeLocation({
        id: `loc-${id}`, name: id, kind: 'region'
    }));
    return world;
}

beforeEach(() => { Object.assign(limits, { maximum: 3, residents: 1, protectors: 0 }); });

describe('the opening population reads its lore bounds', () => {
    it('makes the recorded resident once', () => {
        const world = opening();
        const made = seedTheWanderers(world, 0);
        expect(made.filter(person => person.cultivation.realmOrdinal === FALSE_IMMORTAL_ORDINAL))
            .toHaveLength(limits.residents);
        expect(seedTheWanderers(world, 0)).toEqual([]);
    });

    it.each(['maximum', 'residents', 'protectors'] as const)('rejects a catalog outside %s', limit => {
        limits[limit] = limit === 'maximum' ? 0 : limits[limit] + 1;
        expect(() => seedTheWanderers(opening(), 0)).toThrow(/opening False Immortal population/);
    });
});
