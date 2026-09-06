/**
 * The run's clock and the world's clock are one clock, and nothing asserted it.
 *
 * `cultivation-world.ts` carries a banner saying THE TWO CLOCKS ARE ONE CLOCK
 * and a `catchUp` function that quietly reconciles them whenever anything
 * notices they have drifted - discarding its own return value, with no
 * observer and no digest, so the years it simulates reach nobody. A
 * reconciler that runs is a reconciler that had something to reconcile.
 *
 * The invariant it is silently repairing has never been written down:
 *
 *     world.currentDay === thisRun.startedOnDay + floor(run.elapsedDays)
 *
 * This file writes it down. It lands BEFORE the reconciler is removed,
 * deliberately: a test that only passes after the fix cannot tell you whether
 * the fix was needed, and this one is here to say which verbs break the
 * invariant today.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { worldForRun } from '../../src/server/state/cultivation-world';

async function withAdmin<T>(fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/** How far apart the two clocks are, in days. Zero is the invariant. */
async function drift(harness: Harness): Promise<number> {
    const run = harness.repos.runs.getById(harness.game.state().run.id)!;
    const world = await worldForRun(run);
    const record = world.runs.find(r => r.id === run.id);
    // A run the world has no row for has no start day to measure from, and
    // that is a different defect from drift. Reported as such.
    if (!record) return Number.NaN;
    return world.currentDay - (record.startedOnDay + Math.floor(run.elapsedDays));
}

describe('the two clocks are one clock', () => {
    it('is not on the world books at all until it spends its first day', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'clock-1', worldSeed: 'clock-world' });
            await harness.game.newRun('Shen Ke');
            // MEASURED, and a finding rather than a wrinkle: a fresh run has no
            // row in `world.runs`, so there is no start day to measure a drift
            // against. `beginRunInWorld` is called by the first span, not by
            // the creation - which means everything before that first span
            // happens to somebody the world does not know is there.
            expect(Number.isNaN(await drift(harness))).toBe(true);
        });
    });

    it('is joined from the moment it is', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'clock-1b', worldSeed: 'clock-world-1b' });
            await harness.game.newRun('Shen Ke');
            await harness.game.act('ADMIN advance_days years=1');
            expect(await drift(harness)).toBe(0);
        });
    });

    it('stays joined across a span that was cultivated', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'clock-2', worldSeed: 'clock-world-2' });
            await harness.game.newRun('Shen Ke');
            await harness.game.act('ADMIN advance_days years=5');
            expect(await drift(harness)).toBe(0);
            await harness.game.act('ADMIN advance_days years=20');
            expect(await drift(harness)).toBe(0);
        });
    });

    it('stays joined across several spans in a row', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'clock-3', worldSeed: 'clock-world-3' });
            await harness.game.newRun('Shen Ke');
            // Short spans, because a cultivator with no rations starves out of
            // a long one and a dead run stops the clock - which is correct
            // behaviour and not what this file is measuring.
            for (let i = 0; i < 6; i += 1) {
                if (!harness.game.state().cultivator.alive) break;
                await harness.game.act('ADMIN advance_days years=1');
                expect(await drift(harness), `after span ${i + 1}`).toBe(0);
            }
        });
    });

    it('stays joined across a turn that spent no time at all', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'clock-4', worldSeed: 'clock-world-4' });
            await harness.game.newRun('Shen Ke');
            await harness.game.act('ADMIN advance_days years=2');
            const before = await drift(harness);
            await harness.game.act('look');
            expect(await drift(harness)).toBe(before);
        });
    });

    it('and the world day never runs behind the run', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'clock-5', worldSeed: 'clock-world-5' });
            await harness.game.newRun('Shen Ke');
            await harness.game.act('ADMIN advance_days years=11');
            // A world BEHIND its run is the state `catchUp` exists to repair,
            // and the one that loses years of consequence: the span that
            // reaches the player is simulated with no observer and no digest.
            expect(await drift(harness)).toBeGreaterThanOrEqual(0);
        });
    });
});
