/**
 * The yearly witness pass once tried every person against every fact. On the
 * full catalog its witness work took 1.3-1.5 seconds per year and grew with the
 * ledger. Background incidents now draw from evidence at a capped rate, while
 * selected incidents still use ordinary witness, account and report resolution.
 * Measured on `demography` over fifty years after the change: 66 witness reports
 * and 5 posted prices. The canonical soaked walk keeps the yearly bound and
 * circulation checks without repeating fifty years merely for byte identity;
 * the game no longer promises that two runs produce identical records.
 */
import { expect, it } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';

it('draws bounded background incidents without losing reports or prices', async () => {
    const state = await soakedWorld('demography', { years: 50 });
    const openingDay = state.currentDay - 50 * 365;
    const opportunities = Array<number>(50).fill(0);
    for (const fact of state.history.facts) {
        if (fact.day <= openingDay || fact.day > state.currentDay ||
            !(fact.data.seenWithBody === true || fact.data.seenWithEvidence !== undefined)) continue;
        opportunities[Math.ceil((fact.day - openingDay) / 365) - 1]!++;
    }
    for (const count of opportunities) expect(count).toBeLessThanOrEqual(6);
    expect(state.history.facts.filter(fact => fact.data.witnessReport).length).toBeGreaterThan(0);
    expect(state.history.facts.filter(fact => fact.kind === 'bounty_posted').length).toBeGreaterThan(0);
}, 120_000);
