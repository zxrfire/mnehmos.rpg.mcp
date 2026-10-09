/** A 1,200-year canonical checkpoint exceeded JavaScript's string limit.
 * Bound each publication string while preserving all records and fresh copies. */
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { soakedWorld } from './soaked-world.js';

it('publishes a world without a world-sized string and returns independent JSON copies', async () => {
    const seed = `bounded-cache-${randomUUID()}`;
    const stringify = JSON.stringify;
    const expected = stringify(seedWorld({ seed, catalog: await loadCultivationCatalog() }).state);
    expect(expected.length).toBeGreaterThan(4 * 1024 * 1024);
    const limit = vi.spyOn(JSON, 'stringify').mockImplementation((value, replacer, space) => {
        const result = stringify(value, replacer as never, space);
        if (result?.length > 4 * 1024 * 1024) throw new RangeError('publication string exceeds limit');
        return result;
    });
    try {
        const first = await soakedWorld(seed, { years: 0 });
        const second = await soakedWorld(seed, { years: 0 });
        expect(stringify(first)).toBe(expected);
        expect(stringify(second)).toBe(expected);
        first.npcs[0]!.name = 'changed copy';
        expect(second.npcs[0]!.name).not.toBe('changed copy');
        const direct = JSON.parse(expected) as WorldState;
        advanceWorldForPlay(direct, { days: 1, stopOnInterrupt: false });
        expect(stringify(await soakedWorld(seed, { days: 1 }))).toBe(stringify(direct));
    } finally {
        limit.mockRestore();
    }
});
