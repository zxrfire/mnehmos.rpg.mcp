/**
 * The yearly witness pass once tried every person against every fact. On the
 * full catalog its witness work took 1.3-1.5 seconds per year and grew with the
 * ledger. Background incidents now draw from evidence at a capped rate, while
 * selected incidents still use ordinary witness, account and report resolution.
 * Measured on `demography` over fifty years after the change: 66 witness reports
 * and 5 posted prices. These assertions keep both circulation and the seeded
 * draw alive without pinning which person the world happened to choose.
 */
import { expect, it } from 'vitest';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';

it('draws bounded background incidents without losing reports or prices', async () => {
    const catalog = await loadCultivationCatalog();
    const run = () => {
        const state = seedWorld({ seed: 'demography', catalog }).state;
        for (let year = 0; year < 50; year++) {
            const fromDay = state.currentDay;
            advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
            const opportunities = state.history.facts.filter(fact => fact.day > fromDay
                && (fact.data.seenWithBody === true || fact.data.seenWithEvidence !== undefined));
            expect(opportunities.length).toBeLessThanOrEqual(6);
        }
        return state;
    };
    const first = run();
    expect(first.history.facts.filter(fact => fact.data.witnessReport).length).toBeGreaterThan(0);
    expect(first.history.facts.filter(fact => fact.kind === 'bounty_posted').length).toBeGreaterThan(0);
    expect(run()).toEqual(first);
}, 120_000);
