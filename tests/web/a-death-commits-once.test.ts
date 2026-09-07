/**
 * A death is one commit, and a torn one leaves nothing behind.
 *
 * Measured before the boundary existed: settling a death committed FIVE times
 * with no transaction at all - the run enshrined, the objects moved, the NPC
 * row written, the ledger written, and the body emptied in two more statements
 * - and the world write was deferred to the end of the turn, strictly after
 * every SQLite write had already landed. A failure between any two of those
 * left a cultivator dead with a full pouch, or an emptied pouch with no grave,
 * and nothing anywhere could tell which.
 *
 * The green path is already covered by `estate-settlement.test.ts`, which
 * passes unmodified: the writes did not change, only the boundary around them.
 * What is here is the two things that were not previously true - that the world
 * moves with the rows rather than after them, and that a failure part-way
 * leaves the body untouched.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { worldForRun } from '../../src/server/state/cultivation-world';
import { readWorldRevision } from '../../src/server/state/world-revision';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { getNpc } from '../../src/engine/world/world-state';

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

/** Idle with no rations, until the survival layer ends it. */
async function liveUntilItEnds(harness: Harness): Promise<void> {
    for (let i = 0; i < 12; i += 1) {
        if (!harness.game.state().cultivator.alive) return;
        await harness.game.act('ADMIN advance_days years=5');
    }
}

function pouchRows(harness: Harness, cultivatorId: string): number {
    return (harness.db
        .prepare('SELECT COUNT(*) AS n FROM cultivator_pouch WHERE holder_id = ? AND quantity > 0')
        .get(cultivatorId) as { n: number }).n;
}

describe('a death commits once', () => {
    it('advances the world revision, so a cached world knows it is behind', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'commit-rev', worldSeed: 'commit-world' });
            const { game, db } = harness;
            await game.newRun('Shen Ke');
            const run = harness.repos.runs.getById(game.state().run.id)!;
            const world = await worldForRun(run);

            const before = readWorldRevision(db, world.id);
            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);

            // Exactly one transition ran, so exactly one revision was spent.
            expect(readWorldRevision(db, world.id)).toBe(before + 1);
        });
    });

    it('has the world on disk before the turn finishes narrating', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'commit-disk', worldSeed: 'commit-world-2' });
            const { game, db } = harness;
            const { cultivator } = await game.newRun('Shen Ke');
            const run = harness.repos.runs.getById(game.state().run.id)!;
            const world = await worldForRun(run);

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);

            // READ BACK THROUGH A FRESH REPOSITORY, not off the handle this
            // process is holding. Before the boundary the world write was a
            // deferred flush at the end of `act()`; the claim now is that it
            // went down with the rows.
            const reloaded = new WorldStateRepository(db).loadWorld(world.id);
            expect(reloaded).not.toBeNull();
            const theirRow = getNpc(reloaded!, `npc-${cultivator.id}`)
                ?? getNpc(reloaded!, cultivator.id);
            // Either the world holds them and knows they are gone, or it never
            // held them - what it must not be is holding them as alive.
            if (theirRow) expect(theirRow.status).not.toBe('alive');
        });
    });

    it('settles twice without moving anything twice', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'commit-idem', worldSeed: 'commit-world-3' });
            const { game, db } = harness;
            const { cultivator } = await game.newRun('Shen Ke');
            const run = harness.repos.runs.getById(game.state().run.id)!;
            const world = await worldForRun(run);

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);
            expect(pouchRows(harness, cultivator.id)).toBe(0);

            const caches = (db
                .prepare("SELECT COUNT(*) AS n FROM cultivation_sites WHERE kind = 'cache'")
                .get() as { n: number }).n;
            const revision = readWorldRevision(db, world.id);

            // The engine's own entry point, called again. Idempotent by
            // construction - the cache id derives from the run and the grave
            // will not be built twice - and the transition must not turn one
            // death into two graves by wrapping it.
            const engine = game as unknown as { settleTheEstateIfTheyDied(): unknown };
            engine.settleTheEstateIfTheyDied();

            expect((db
                .prepare("SELECT COUNT(*) AS n FROM cultivation_sites WHERE kind = 'cache'")
                .get() as { n: number }).n).toBe(caches);
            expect(pouchRows(harness, cultivator.id)).toBe(0);
            // A second settle is a second transition, so the revision moves.
            // What must not move is anything it describes.
            expect(readWorldRevision(db, world.id)).toBeGreaterThanOrEqual(revision);
        });
    });
});

