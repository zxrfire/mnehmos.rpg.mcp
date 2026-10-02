/**
 * Cached canonical walks must preserve their catalog, population and clock.
 * A cold 200-year worker ended without publishing a world. Checkpoints now
 * preserve completed spans; crossing one and reloading JSON must leave the
 * exact direct-walk state.
 */
import { describe, expect, it } from 'vitest';
import { soakedWorld } from './soaked-world.js';
import { fixtureCatalog } from '../engine/world/fixtures.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';

describe('canonical fixture walks', () => {
    it('matches a direct walk across an intermediate checkpoint', async () => {
        const setup = { catalog: fixtureCatalog(), presentYear: 1000, population: 40 };
        const seed = 'cached-fixture-checkpoint-equivalence';
        const direct = seedWorld({ seed, ...setup }).state;
        advanceWorldForPlay(direct, { days: 365 * 26 });
        const beforeCheckpoint = seedWorld({ seed, ...setup }).state;
        advanceWorldForPlay(beforeCheckpoint, { days: 365 * 25 });
        const resumed = JSON.parse(JSON.stringify(beforeCheckpoint)) as typeof direct;
        advanceWorldForPlay(resumed, { days: 365 });
        expect(resumed).toEqual(direct);
        const checkpointed = await soakedWorld(seed, { years: 26 }, setup);
        expect(checkpointed).toEqual(direct);
    });

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

    it('keeps a long walk identical across the ten-year boundary', async () => {
        const setup = { catalog: fixtureCatalog(), presentYear: 1000, population: 40 };
        const fresh = seedWorld({ seed: 'cached-fixture-chunks', ...setup }).state;
        advanceWorldForPlay(fresh, { days: 365 * 12 });
        expect(await soakedWorld('cached-fixture-chunks', { years: 12 }, setup)).toEqual(fresh);
    });

});
