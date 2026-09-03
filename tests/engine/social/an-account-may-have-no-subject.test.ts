/**
 * The `obligations.subject_id` rebuild, proved forward from the old shape.
 *
 * AGENTS.md is not explicit about migrations, but the rule it would give is the
 * one that caught this: **a migration tested only forward from empty is a
 * migration that has not been tested.** Every assertion here starts from a
 * database built with the PRE-CHANGE schema and rows already in it, because
 * that is the only database this code will ever meet in the wild - a fresh one
 * gets the new shape from `CREATE TABLE` and never enters the rebuild at all.
 *
 * The four things that would each have been a silent disaster:
 *
 *   THE CASCADE       `obligation_participants` holds an `ON DELETE CASCADE`
 *                     against `obligations(id)`. Dropping the table with
 *                     enforcement on takes every participant row with it.
 *   THE IDS           the rebuild must not re-derive a primary key. An account
 *                     that changes id is an account nothing can find again, and
 *                     `aNameAttaches` writes back at the held id.
 *   THE INDEXES       they are dropped with the table. A rebuild that forgets
 *                     them leaves a ledger that still answers and answers slowly.
 *   THE TWO FORMS     an empty string that survives is a second way of saying
 *                     no-name, and the reader that misses it is confident.
 */

import Database from 'better-sqlite3';
import {
    makeTheObligationSubjectOptional
} from '../../../src/storage/optional-obligation-subject';

/**
 * The `obligations` table as it stood before the rebuild.
 *
 * Trimmed to the columns the rebuild actually reasons about, plus the child
 * table and the indexes, because what is being tested is the SHAPE CHANGE and
 * a faithful thirty-column copy would go stale without testing anything more.
 * The one column that has to be exact is `subject_id TEXT NOT NULL`, which is
 * the token the rebuild keys on.
 */
function aDatabaseFromBeforeTheChange(): Database.Database {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
        CREATE TABLE world_chronicle (
          id TEXT NOT NULL,
          world_id TEXT NOT NULL,
          PRIMARY KEY (world_id, id)
        );
        CREATE TABLE obligations (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          holder_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          cause TEXT NOT NULL,
          severity TEXT NOT NULL,
          incurred_on_day INTEGER NOT NULL,
          triggering_event_id TEXT,
          description TEXT NOT NULL DEFAULT '',
          participants TEXT NOT NULL DEFAULT '[]',
          tags TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'open',
          recorded_on_day INTEGER NOT NULL
        );
        CREATE INDEX idx_obligations_pair ON obligations(holder_id, subject_id);
        CREATE INDEX idx_obligations_subject ON obligations(subject_id);
        CREATE INDEX idx_obligations_open ON obligations(holder_id) WHERE status = 'open';
        CREATE INDEX idx_obligations_event ON obligations(triggering_event_id);
        CREATE TABLE obligation_participants (
          obligation_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'participant',
          PRIMARY KEY (obligation_id, character_id),
          FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE
        );
    `);

    db.prepare('INSERT INTO world_chronicle VALUES (?, ?)').run('f1', 'w1');
    db.prepare('INSERT INTO world_chronicle VALUES (?, ?)').run('f2', 'w1');

    const put = db.prepare(
        'INSERT INTO obligations (id, kind, holder_id, subject_id, cause, severity, '
        + 'incurred_on_day, triggering_event_id, recorded_on_day) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    // An ordinary named account.
    put.run('g1', 'grudge', 'brother', 'killer', 'killed_kin', 'grave', 400, 'f1', 400);
    // The empty-string stand-in, which is what has to become NULL.
    put.run('g2', 'grudge', 'brother', '', 'killed_kin', 'grave', 400, 'f2', 400);
    // A second one, so the count is not one.
    put.run('g3', 'grudge', 'sister', '', 'killed_kin', 'serious', 410, null, 410);
    // An account resting on an event nothing holds.
    put.run('g4', 'grudge', 'cousin', 'somebody', 'robbery', 'slight', 420, 'f-gone', 420);

    db.prepare('INSERT INTO obligation_participants VALUES (?, ?, ?)')
        .run('g1', 'a-witness', 'witness');
    db.prepare('INSERT INTO obligation_participants VALUES (?, ?, ?)')
        .run('g2', 'another-witness', 'witness');
    return db;
}

function columnIsNullable(db: Database.Database): boolean {
    const columns = db.prepare('PRAGMA table_info(obligations)').all() as
        { name: string; notnull: number }[];
    return columns.find(c => c.name === 'subject_id')?.notnull === 0;
}

describe('an account may have no subject', () => {
    it('relaxes the constraint on a database that predates the change', () => {
        const db = aDatabaseFromBeforeTheChange();
        expect(columnIsNullable(db), 'the fixture really is the old shape').toBe(false);

        const done = makeTheObligationSubjectOptional(db);

        expect(done.rebuilt).toBe(true);
        expect(columnIsNullable(db)).toBe(true);
        // And the column now actually accepts one, which the PRAGMA alone does
        // not prove.
        expect(() => db.prepare(
            'INSERT INTO obligations (id, kind, holder_id, subject_id, cause, severity, '
            + 'incurred_on_day, recorded_on_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run('g5', 'grudge', 'nephew', null, 'other', 'slight', 500, 500)).not.toThrow();
    });

    it('converts every empty-string subject and leaves exactly one form behind', () => {
        const db = aDatabaseFromBeforeTheChange();
        const done = makeTheObligationSubjectOptional(db);

        expect(done.converted, 'the two stand-ins').toBe(2);
        const empties = db.prepare(
            "SELECT COUNT(*) AS n FROM obligations WHERE subject_id = ''"
        ).get() as { n: number };
        expect(empties.n, 'no second way of saying no-name survives').toBe(0);
        const nulls = db.prepare(
            'SELECT id FROM obligations WHERE subject_id IS NULL ORDER BY id'
        ).all() as { id: string }[];
        expect(nulls.map(r => r.id)).toEqual(['g2', 'g3']);
    });

    it('deletes accounts resting on an event the chronicle does not hold', () => {
        const db = aDatabaseFromBeforeTheChange();
        const done = makeTheObligationSubjectOptional(db);

        expect(done.orphansDropped).toBe(1);
        expect(db.prepare('SELECT id FROM obligations WHERE id = ?').get('g4')).toBeUndefined();
        // And a NULL triggering event is not a broken reference. Most of the
        // ledger is that, and deleting it would be the migration eating a save.
        expect(db.prepare('SELECT id FROM obligations WHERE id = ?').get('g3')).toBeDefined();
    });

    it('does not touch the ledger when the chronicle has not been written yet', () => {
        const db = aDatabaseFromBeforeTheChange();
        db.exec('DELETE FROM world_chronicle');
        const done = makeTheObligationSubjectOptional(db);
        expect(done.orphansDropped, 'an unwritten world is not a corrupt one').toBe(0);
        expect((db.prepare('SELECT COUNT(*) AS n FROM obligations').get() as { n: number }).n)
            .toBe(4);
    });

    it('keeps the ids, so nothing that pointed at a row stops finding it', () => {
        const db = aDatabaseFromBeforeTheChange();
        makeTheObligationSubjectOptional(db);
        const ids = (db.prepare('SELECT id FROM obligations ORDER BY id').all() as
            { id: string }[]).map(r => r.id);
        expect(ids).toEqual(['g1', 'g2', 'g3']);
    });

    it('does not cascade the participants away with the old table', () => {
        const db = aDatabaseFromBeforeTheChange();
        makeTheObligationSubjectOptional(db);
        const kept = db.prepare(
            'SELECT obligation_id, character_id FROM obligation_participants ORDER BY obligation_id'
        ).all();
        expect(kept, 'the child rows survived the drop').toEqual([
            { obligation_id: 'g1', character_id: 'a-witness' },
            { obligation_id: 'g2', character_id: 'another-witness' }
        ]);
    });

    it('carries every index forward', () => {
        const db = aDatabaseFromBeforeTheChange();
        const before = (db.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'obligations' "
            + 'AND sql IS NOT NULL ORDER BY name'
        ).all() as { name: string }[]).map(r => r.name);

        const done = makeTheObligationSubjectOptional(db);
        const after = (db.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'obligations' "
            + 'AND sql IS NOT NULL ORDER BY name'
        ).all() as { name: string }[]).map(r => r.name);

        expect(after).toEqual(before);
        expect(done.indexes).toBe(before.length);
    });

    it('leaves foreign key enforcement exactly as it found it', () => {
        const db = aDatabaseFromBeforeTheChange();
        expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
        makeTheObligationSubjectOptional(db);
        expect(db.pragma('foreign_keys', { simple: true }), 'turned back on').toBe(1);
    });

    it('is a no-op the second time, and every time after', () => {
        const db = aDatabaseFromBeforeTheChange();
        const first = makeTheObligationSubjectOptional(db);
        expect(first.rebuilt).toBe(true);

        const second = makeTheObligationSubjectOptional(db);
        expect(second.rebuilt, 'the guard is the constraint, not the column').toBe(false);
        expect(second.converted).toBe(0);
        expect(second.orphansDropped).toBe(0);

        const third = makeTheObligationSubjectOptional(db);
        expect(third.rebuilt).toBe(false);
        expect((db.prepare('SELECT COUNT(*) AS n FROM obligations').get() as { n: number }).n)
            .toBe(3);
    });

    it('recovers from a previous attempt that died mid-rebuild', () => {
        const db = aDatabaseFromBeforeTheChange();
        // The state a crash between the copy and the drop leaves behind.
        db.exec('CREATE TABLE obligations_migrating (id TEXT PRIMARY KEY)');
        db.prepare('INSERT INTO obligations_migrating VALUES (?)').run('leftover');

        const done = makeTheObligationSubjectOptional(db);
        expect(done.rebuilt).toBe(true);
        expect(columnIsNullable(db)).toBe(true);
        expect((db.prepare('SELECT COUNT(*) AS n FROM obligations').get() as { n: number }).n)
            .toBe(3);
    });

    it('does nothing at all on a database with no obligations table', () => {
        const db = new Database(':memory:');
        const done = makeTheObligationSubjectOptional(db);
        expect(done).toEqual({ rebuilt: false, converted: 0, indexes: 0, orphansDropped: 0 });
    });
});
