/**
 * The packaged binary has to nest, because production already does.
 *
 * This runs the SAME three-deep scenario against two drivers on one real
 * connection: the one the bundle shipped, and the one it ships now. The first
 * assertion is that the old one fails - a test that only proved the new driver
 * works would not explain why the file exists.
 *
 * vitest loads the real better-sqlite3 module, so nothing else in this suite can
 * see the packaged driver at all. That is the hole this file closes.
 */

import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
    packagedTransaction,
    theDriverThatCouldNotNest
} from '../../scripts/packaged-better-sqlite3-driver.mjs';

type Conn = Database.Database & { transaction: unknown };

function aLedger(): Conn {
    const db = new Database(':memory:') as Conn;
    db.exec('CREATE TABLE ledger (id INTEGER PRIMARY KEY, note TEXT)');
    return db;
}

function noteCount(db: Conn): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM ledger').get() as { n: number }).n;
}

/**
 * The shape both production paths have: an outer transaction that wraps a
 * repo method which opens its own.
 */
function joiningAHouse(db: Conn, andThenThrow: boolean): void {
    const inner = (db.transaction as (fn: () => void) => () => void)(() => {
        db.prepare('INSERT INTO ledger (note) VALUES (?)').run('the membership row');
        if (andThenThrow) throw new Error('the stipend clock could not be written');
    });
    const outer = (db.transaction as (fn: () => void) => () => void)(() => {
        db.prepare('INSERT INTO ledger (note) VALUES (?)').run('the run turn');
        inner();
    });
    outer();
}

describe('the driver the bundle used to ship', () => {
    it('cannot open a transaction inside a transaction at all', () => {
        const db = aLedger();
        db.transaction = theDriverThatCouldNotNest;
        expect(() => joiningAHouse(db, false)).toThrow(/within a transaction/i);
        db.close();
    });
});

describe('the driver it ships now', () => {
    it('nests, and commits everything when nothing throws', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        joiningAHouse(db, false);
        expect(noteCount(db)).toBe(2);
        db.close();
    });

    it('rolls the whole thing back when the inner body throws', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        expect(() => joiningAHouse(db, true)).toThrow(/stipend clock/);
        // Not one row and not two. A half-joined disciple is the state this
        // exists to make impossible.
        expect(noteCount(db)).toBe(0);
        db.close();
    });

    it('rolls back only the inner one when the outer catches', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        const inner = db.transaction(() => {
            db.prepare('INSERT INTO ledger (note) VALUES (?)').run('doomed');
            throw new Error('no');
        });
        db.transaction(() => {
            db.prepare('INSERT INTO ledger (note) VALUES (?)').run('kept');
            try {
                inner();
            } catch {
                // The outer decided this was survivable, which is the whole
                // reason a savepoint is not a second BEGIN.
            }
        })();
        expect(noteCount(db)).toBe(1);
        db.close();
    });

    it('goes three deep, which is what a turn actually does', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        const write = (note: string) =>
            db.prepare('INSERT INTO ledger (note) VALUES (?)').run(note);
        const third = db.transaction(() => write('third'));
        const second = db.transaction(() => { write('second'); third(); });
        db.transaction(() => { write('first'); second(); })();
        expect(noteCount(db)).toBe(3);
        db.close();
    });

    it('and unwinds all three together when the deepest throws', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        const write = (note: string) =>
            db.prepare('INSERT INTO ledger (note) VALUES (?)').run(note);
        const third = db.transaction(() => { write('third'); throw new Error('deep'); });
        const second = db.transaction(() => { write('second'); third(); });
        const first = db.transaction(() => { write('first'); second(); });
        expect(() => first()).toThrow(/deep/);
        expect(noteCount(db)).toBe(0);
        db.close();
    });

    it('leaves the connection usable afterwards, having released every savepoint', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        expect(() => joiningAHouse(db, true)).toThrow();
        // A leaked savepoint would make this the second statement of a
        // transaction nobody opened.
        joiningAHouse(db, false);
        expect(noteCount(db)).toBe(2);
        expect(db.inTransaction).toBe(false);
        db.close();
    });

    it('runs siblings at the same depth without reusing an open savepoint name', () => {
        const db = aLedger();
        db.transaction = packagedTransaction;
        const write = (note: string) =>
            db.prepare('INSERT INTO ledger (note) VALUES (?)').run(note);
        const doomed = db.transaction(() => { write('doomed'); throw new Error('x'); });
        const fine = db.transaction(() => write('fine'));
        db.transaction(() => {
            try { doomed(); } catch { /* survivable */ }
            fine();
        })();
        expect(noteCount(db)).toBe(1);
        db.close();
    });
});
