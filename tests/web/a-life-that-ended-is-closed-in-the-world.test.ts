/**
 * A life that ended is closed in the world's record of runs.
 *
 * The entry was opened at birth and never closed: every run stayed `active`,
 * so `lastFinishedRun` - what the next life inherits from - found nothing,
 * and no life was ever anybody's predecessor.
 */

import { describe, expect, it } from 'vitest';

import { lastFinishedRun } from '../../src/engine/world/legacy';
import { worldForRun } from '../../src/server/state/cultivation-world';
import { makeGameInWorld } from './harness';

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

describe('a life that ended is closed in the world', () => {
    it('closes a reset life, and the next life finds it as the one before', async () => {
        await withAdmin(async () => {
            const { game, repos } = await makeGameInWorld({ seed: 'closed-1', worldSeed: 'closed-world' });
            const first = await game.newRun('Shen Ke');
            // A run enters the world's record on its first span of days.
            await game.act('ADMIN advance_days years=1');

            await game.act('ADMIN reset Lu Wen');
            const second = game.state();
            expect(second.run.id).not.toBe(first.run.id);

            const world = await worldForRun(repos.runs.getById(second.run.id)!);
            const entry = world.runs.find(r => r.id === first.run.id);
            expect(entry?.outcome).toBe('abandoned');
            expect(entry?.endedOnDay).not.toBeNull();
            expect(lastFinishedRun(world)?.id).toBe(first.run.id);
        });
    }, 300_000);
});
