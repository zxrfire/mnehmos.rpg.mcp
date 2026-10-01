/** Cached canonical walks must preserve their catalog, population and clock. */
import { describe, expect, it } from 'vitest';
import { soakedWorld } from './soaked-world.js';
import { fixtureCatalog } from '../engine/world/fixtures.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';

describe('canonical fixture walks', () => {
    it('matches a direct walk and returns isolated copies', async () => {
        const setup = { catalog: fixtureCatalog(), presentYear: 1000, population: 40 };
        const seed = 'cached-fixture-equivalence';
        const fresh = seedWorld({ seed, ...setup }).state;
        advanceWorldForPlay(fresh, { days: 365 * 2 });
        const first = await soakedWorld(seed, { years: 2 }, setup);
        const second = await soakedWorld(seed, { days: 365 * 2 }, setup);
        expect(first).toEqual(fresh);
        first.npcs[0]!.name = 'Changed in one copy';
        first.history.facts.pop();
        expect(second).toEqual(fresh);
    });

    it('keeps different populations and starting ages separate', async () => {
        const seed = 'cached-fixture-inputs';
        const catalog = fixtureCatalog();
        const a = await soakedWorld(seed, { years: 0 }, { catalog, presentYear: 1000, population: 40 });
        const b = await soakedWorld(seed, { years: 0 }, { catalog, presentYear: 2000, population: 80 });
        expect(a).toEqual(seedWorld({ seed, catalog, presentYear: 1000, population: 40 }).state);
        expect(b).toEqual(seedWorld({ seed, catalog, presentYear: 2000, population: 80 }).state);
    });
});
