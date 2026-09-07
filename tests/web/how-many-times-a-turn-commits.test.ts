/**
 * How many times one turn reaches durability.
 *
 * The refactor's own target is one turn, one commit. Nothing has ever measured
 * it, so nobody could say whether a change moved the number - and the obvious
 * proxy, counting `db.transaction(` call sites, moves the WRONG WAY when the
 * work is going well.
 *
 * This counts what actually happens: outermost transactions, plus every write
 * statement that ran with no transaction open, which is an autocommit and
 * therefore a commit of its own.
 *
 * It is a RATCHET, not a target. The numbers here are what a plain turn costs
 * today; lower them when you join writes together, and never raise them.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';

import { makeGameInWorld, type Harness } from './harness';

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
 * Measured now: a plain turn is ONE transaction and ZERO autocommits, and a
 * turn that spends a year is five and zero. One turn, one commit, which was the
 * target.
 *
 * Zero autocommits is the stronger half: it says every write in a turn is
 * inside some transaction, so there is no statement that can land alone.
 */
const A_PLAIN_TURN = { commits: 1, autocommits: 0 };
const A_YEAR_LONG_TURN = { commits: 5, autocommits: 0 };

describe('what one turn costs to make durable', () => {
    let harness: Harness;

    beforeEach(async () => {
        harness = await makeGameInWorld({ seed: 'commits-1', worldSeed: 'commits-world' });
    });

    it('does not cost more than it did', async () => {
        await withAdmin(async () => {
            await harness.game.newRun('Shen Ke');
            // Spy AFTER the run exists, so world seeding is not counted: the
            // claim is about a turn, not about building a world.
            const spy = spyOn(harness.db);
            await harness.game.act('look');

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

    it('and a turn that spends a year does not cost unboundedly more', async () => {
        await withAdmin(async () => {
            await harness.game.newRun('Shen Ke');
            const spy = spyOn(harness.db);
            await harness.game.act('ADMIN advance_days years=1');
            // A span is a span whatever its length: the world advance is one
            // append and the accounts are one write. If this ever scales with
            // the number of days, something is committing per day.
            expect(spy.commits).toBeLessThanOrEqual(A_YEAR_LONG_TURN.commits);
            expect(spy.autocommits).toBeLessThanOrEqual(A_YEAR_LONG_TURN.autocommits);
        });
    });
});
