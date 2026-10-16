/**
 * How many times one turn reaches durability.
 *
 * Owner ruling: a year keeps one atomic body/world write, with a few surrounding
 * commits, so a crash during an appointment cannot leave part of the year saved.
 * Counting `db.transaction(` call sites cannot measure that property.
 *
 * This counts what actually happens: outermost transactions, plus every write
 * statement that ran with no transaction open, which is an autocommit and
 * therefore a commit of its own.
 *
 * It is a RATCHET, not a target. A plain inventory read costs one commit.
 * Looking at a new square also learns claims, each an atomic transition under
 * `transition-runner.ts`; those commits are bounded by the claims learned.
 * The old look fixture counted discovery as a plain read and failed at four
 * commits: three newly learned claims and the play log, not repeated writes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from 'better-sqlite3';

import { makeGameInWorld, type Harness } from './harness';
import * as worldClock from '../../src/server/state/cultivation-world.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { handleCultivate } from '../../src/server/consolidated/cultivation-manage.js';
import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { stillNeedsToEat } from '../../src/engine/cultivation/survival.js';

/** Outermost transactions and bare autocommitting writes, counted separately. */
interface Spy { commits: number; autocommits: number }

function spyOn(db: Database.Database): Spy {
    const spy: Spy = { commits: 0, autocommits: 0 };
    let depth = 0;

    const realTransaction = db.transaction.bind(db);
    (db as unknown as { transaction: unknown }).transaction =
        (fn: (...a: unknown[]) => unknown) => {
            const inner = realTransaction((((...args: unknown[]) => {
                depth++;
                try { return fn(...args); } finally { depth--; }
            }) as never));
            return (((...args: unknown[]) => {
                const outermost = depth === 0;
                const out = (inner as unknown as (...a: unknown[]) => unknown)(...args);
                if (outermost) spy.commits++;
                return out;
            }) as never);
        };

    const realPrepare = db.prepare.bind(db);
    (db as unknown as { prepare: unknown }).prepare = (sql: string) => {
        const stmt = realPrepare(sql);
        if (!/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql)) return stmt;
        const realRun = stmt.run.bind(stmt);
        (stmt as unknown as { run: unknown }).run = (...args: unknown[]) => {
            if (depth === 0) spy.autocommits++;
            return (realRun as unknown as (...a: unknown[]) => unknown)(...args);
        };
        return stmt;
    };

    return spy;
}

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

/**
 * MEASURED, NOT CHOSEN.
 *
 * The plan this refactor came from measured a plain `cultivate` turn at SIX
 * commit points minimum, 10-20 typical, and unbounded in the number of
 * encounters - plus an unknown number of bare autocommitting statements.
 *
 * Measured with an inventory read: ONE transaction and ZERO autocommits. A
 * full year is six and zero. The discovery bound above accounts
 * for learning new claims without raising either fixed high-water mark.
 *
 * Zero autocommits is the stronger half: it says every write in a turn is
 * inside some transaction, so there is no statement that can land alone.
 */
const A_PLAIN_TURN = { commits: 1, autocommits: 0 };
// The span itself is one transaction. World preparation and the surrounding
// ADMIN audit, current contact and transcript retain their separate boundaries.
// The old unfed novice stopped after roughly 60 days. This fixture uses the
// first real realm whose body no longer eats and asserts 365 actual lived days;
// its 111 actual body/world portions still require only six outer commits.
const A_YEAR_LONG_TURN = { commits: 6, autocommits: 0 };

describe('what one turn costs to make durable', () => {
    let harness: Harness;

    beforeEach(async () => {
        harness = await makeGameInWorld({ seed: 'commits-1', worldSeed: 'commits-world' });
    });

    it('does not cost more than it did', async () => {
        await withAdmin(async () => {
            await harness.game.newRun('Shen Ke');
            // Opening marked-property observations are discovery, covered by
            // the next test. Measure this ordinary read after actually seeing
            // the starting scene, rather than relabeling new claims as plain.
            await harness.game.act('I look around');
            // Spy AFTER the run exists, so world seeding is not counted: the
            // claim is about a turn, not about building a world.
            const spy = spyOn(harness.db);
            await harness.game.act('what am I carrying');

            expect(
                spy.commits,
                `a plain turn opened ${spy.commits} outermost transactions, `
                + `against a high-water mark of ${A_PLAIN_TURN.commits}`
            ).toBeLessThanOrEqual(A_PLAIN_TURN.commits);
            expect(
                spy.autocommits,
                `a plain turn made ${spy.autocommits} writes with no transaction open, `
                + `against a high-water mark of ${A_PLAIN_TURN.autocommits}. Each one is its `
                + 'own commit and its own tear point.'
            ).toBeLessThanOrEqual(A_PLAIN_TURN.autocommits);
        });
    });

    it('bounds discovery commits by the knowledge actually learned', async () => {
        await harness.game.newRun('Shen Ke');
        const countClaims = () => Number((harness.db.prepare(
            'SELECT COUNT(*) AS n FROM knowledge_records'
        ).get() as { n: number }).n);
        const before = countClaims();
        const spy = spyOn(harness.db);
        await harness.game.act('look');
        const learned = countClaims() - before;
        expect(learned, 'the fixture must discover something').toBeGreaterThan(0);
        expect(spy.commits).toBeLessThanOrEqual(learned + A_PLAIN_TURN.commits);
        expect(spy.autocommits).toBe(A_PLAIN_TURN.autocommits);
    });

    it('and a turn that spends a year does not cost unboundedly more', async () => {
        await withAdmin(async () => {
            await harness.game.newRun('Shen Ke');
            const fedByQi = REALM_TIERS.find(realm => !stillNeedsToEat(realm.ordinalStart))!;
            await harness.game.act('ADMIN set_realm ordinal=' + fedByQi.ordinalStart);
            const initial = harness.game.currentRun();
            const spy = spyOn(harness.db);
            await harness.game.act('ADMIN advance_days years=1');
            const after = harness.game.currentRun();
            expect(after.run.elapsedDays - initial.run.elapsedDays).toBe(365);
            expect(after.cultivator.alive).toBe(true);
            // A span is a span whatever its length: the world advance is one
            // append and the accounts are one write. If this ever scales with
            // the number of days, something is committing per day.
            expect(spy.commits).toBe(A_YEAR_LONG_TURN.commits);
            expect(spy.autocommits).toBeLessThanOrEqual(A_YEAR_LONG_TURN.autocommits);
        });
    });

    for (const failedAt of ['appointment', 'final_world_append'] as const) {
        it('rolls back every body and world portion after failure at ' + failedAt, async () => {
            await withAdmin(async () => {
                await harness.game.newRun('Shen Ke');
                const original = harness.game.currentRun();
                harness.repos.cultivators.update(original.cultivator.id, { spiritStones: 1000 });
                // Complete preparation first: rollback protects the requested span,
                // not an already owed fractional clock correction.
                const world = await worldClock.prepareWorldClockForPreciseSpan(original.run, original.cultivator);
                const beforeBody = harness.repos.cultivators.getById(original.cultivator.id);
                const beforeRun = harness.repos.runs.getById(original.run.id);
                const worlds = new WorldStateRepository(harness.db);
                const beforeWorld = worlds.loadWorld(world.id);
                const advance = worldClock.advancePreparedWorldForCultivator;
                let portions = 0;
                const atBoundary = vi.spyOn(worldClock, 'advancePreparedWorldForCultivator').mockImplementation((...args) => {
                    const receipt = advance(...args);
                    if (++portions === 3 && failedAt === 'appointment') throw new Error('Selected span write failed.');
                    return receipt;
                });
                const append = WorldStateRepository.prototype.appendWorld;
                const atAppend = vi.spyOn(WorldStateRepository.prototype, 'appendWorld').mockImplementation(function(this: WorldStateRepository, state) {
                    append.call(this, state);
                    if (failedAt === 'final_world_append' && state.currentDay > beforeDay)
                        throw new Error('Selected span write failed.');
                });
                const beforeDay = world.currentDay;
                try {
                    await expect(handleCultivate({ action: 'cultivate', cultivatorId: original.cultivator.id,
                        days: 365, focus: 'idle', autoBreakthrough: false, randomEvents: false,
                        rations: 2, carriedRations: 0 }))
                        .rejects.toThrow('Selected span write failed.');
                    if (failedAt === 'appointment') expect(portions).toBe(3);
                    else expect(portions).toBeGreaterThan(0);
                    expect(harness.repos.cultivators.getById(original.cultivator.id)).toEqual(beforeBody);
                    expect(harness.repos.runs.getById(original.run.id)).toEqual(beforeRun);
                    expect(worlds.loadWorld(world.id)).toEqual(beforeWorld);
                    const reloaded = await worldClock.worldForRun(original.run);
                    expect(reloaded.currentDay).toBe(beforeWorld!.currentDay);
                    expect(reloaded).not.toBe(world);
                } finally { atBoundary.mockRestore(); atAppend.mockRestore(); }
            });
        });
    }
});
