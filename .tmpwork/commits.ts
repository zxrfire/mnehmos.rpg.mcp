/**
 * How many times does one turn actually COMMIT?
 *
 * A spy over better-sqlite3's transaction wrapper: count the outermost
 * transactions (depth 0 -> 1) plus every statement that runs with no
 * transaction open at all, which is an autocommit and therefore its own commit.
 */
import Database from 'better-sqlite3';

type Spy = { commits: number; autocommits: number };

export function spyOn(db: Database.Database): Spy {
    const spy: Spy = { commits: 0, autocommits: 0 };
    let depth = 0;

    const realTransaction = db.transaction.bind(db);
    (db as unknown as { transaction: unknown }).transaction = (fn: (...a: unknown[]) => unknown) => {
        const wrapped = realTransaction(((...args: unknown[]) => {
            depth++;
            try { return fn(...args); } finally { depth--; }
        }) as never);
        return ((...args: unknown[]) => {
            const outermost = depth === 0;
            const out = (wrapped as (...a: unknown[]) => unknown)(...args);
            if (outermost) spy.commits++;
            return out;
        }) as never;
    };

    const realPrepare = db.prepare.bind(db);
    (db as unknown as { prepare: unknown }).prepare = (sql: string) => {
        const stmt = realPrepare(sql);
        const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
        if (!isWrite) return stmt;
        const realRun = stmt.run.bind(stmt);
        (stmt as unknown as { run: unknown }).run = (...args: unknown[]) => {
            if (depth === 0) spy.autocommits++;
            return (realRun as (...a: unknown[]) => unknown)(...args);
        };
        return stmt;
    };

    return spy;
}
