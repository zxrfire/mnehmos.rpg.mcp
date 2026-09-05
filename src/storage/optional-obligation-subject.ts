/**
 * `obligations.subject_id` becomes nullable, and accounts resting on nothing go.
 *
 * After this runs there is exactly one stored representation of no-name and it
 * is NULL. `NO_NAME_ON_IT` and `hasANameOnIt` stay as the read path.
 *
 * THE GUARD IS `notnull` ON THE COLUMN, not whether the column exists. Both
 * shapes have a `subject_id` and only one still refuses NULL. SQLite cannot
 * relax a NOT NULL with an ALTER, so editing the `CREATE TABLE IF NOT EXISTS` in
 * `migrations.social.ts` alone would give a fresh database the nullable column
 * and leave every existing one rejecting NULL - two schemas behind one
 * migration. Re-runnable from any state, including one where a previous attempt
 * died between the copy and the rename.
 *
 * THE NEW SCHEMA IS DERIVED FROM THE OLD ONE. Do not write a second copy of the
 * `obligations` DDL here: the rebuild reads the table's own
 * `sqlite_master.sql` and changes exactly one token, and the indexes are read
 * back off `sqlite_master` and replayed, so a rebuild carries forward whatever
 * the table actually had.
 *
 * THE ORDER MATTERS. `obligation_participants` holds `FOREIGN KEY
 * (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE` and the caller
 * turns enforcement on (`db.ts`), so dropping `obligations` with enforcement on
 * would cascade every participant row out of existence. Enforcement goes off
 * around the rebuild, OUTSIDE the transaction because `PRAGMA foreign_keys` is a
 * no-op inside one, and `foreign_key_check` runs before it goes back on. Drop
 * first, then rename: the other order asks SQLite to rewrite references to a
 * table name that is about to be taken.
 *
 * THE PARENT OF `triggering_event_id` IS `world_chronicle`, NOT `world_facts`.
 * They are different subsystems - see `migrations.world.ts`'s header on the
 * collision - and a foreign key written to the wrong one would delete the entire
 * ledger. Measured on a played database:
 *
 *     world_facts       0 rows        2 of 2 obligations orphaned
 *     world_chronicle   102 rows      0 of 2 obligations orphaned
 *
 * THERE IS STILL NO FOREIGN KEY ON IT, and SQLite will not accept one:
 * `world_chronicle`'s primary key is `(world_id, id)` because fact ids are
 * per-world sequential text, so `id` alone is not unique and
 *
 *     FOREIGN KEY (triggering_event_id) REFERENCES world_chronicle(id)
 *     -> SQLITE_ERROR: foreign key mismatch, on the first insert
 *
 * The composite form is accepted but needs a `world_id` on `obligations` and
 * therefore every writer in the repository to supply one. WHEN THAT IS DONE THE
 * `ON DELETE` CLAUSE MUST BE `SET NULL`, NOT `CASCADE`: an account that outlives
 * the record of what caused it is a real thing here - a grudge whose origin
 * nobody can produce - and deleting a world fact must not silently delete
 * somebody's reason to be angry. Until then the sweep below is the only
 * enforcement available, and it runs on every startup.
 */

import type Database from 'better-sqlite3';

/** What the pass did, so a caller or a test can say. */
export interface SubjectMadeOptional {
    /** True when the table was rebuilt on this call. */
    rebuilt: boolean;
    /** Rows whose empty-string subject became NULL. */
    converted: number;
    /** Indexes carried forward. */
    indexes: number;
    /**
     * Accounts deleted for resting on an event `world_chronicle` does not hold.
     *
     * Reported rather than logged, because the number is the finding: large
     * says something is writing bad references now, small says it was history.
     */
    orphansDropped: number;
}

const NOTHING: SubjectMadeOptional = {
    rebuilt: false, converted: 0, indexes: 0, orphansDropped: 0
};

/** The one token this rebuild exists to change. */
const CONSTRAINED = 'subject_id TEXT NOT NULL';
const RELAXED = 'subject_id TEXT         ';

export function makeTheObligationSubjectOptional(
    db: Database.Database
): SubjectMadeOptional {
    const columns = db.prepare('PRAGMA table_info(obligations)').all() as {
        name: string;
        notnull: number;
    }[];
    // No table yet: `migrateSocial` has not run, or this is not that database.
    if (columns.length === 0) return NOTHING;

    // Runs on every startup and independently of the rebuild below, because the
    // two answer different questions: the rebuild is a one-time shape change and
    // this is a standing sweep for the constraint SQLite will not let us
    // declare. Ordered first so the rebuild copies across a table that is
    // already clean.
    const orphansDropped = dropAccountsRestingOnNothing(db);

    const subject = columns.find(c => c.name === 'subject_id');
    // Already nullable. The whole guard, and it is about the CONSTRAINT rather
    // than the column, so a fresh database and an old one converge.
    if (!subject || subject.notnull === 0) return { ...NOTHING, orphansDropped };

    const existing = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'obligations'"
    ).get() as { sql: string } | undefined;
    if (!existing?.sql) return { ...NOTHING, orphansDropped };

    // If the DDL is not the shape this file was written against, do nothing at
    // all. A rebuild that guessed would be a rebuild that silently dropped
    // whatever it failed to recognise, and leaving the constraint in place is
    // recoverable where that is not.
    if (!existing.sql.includes(CONSTRAINED)) return { ...NOTHING, orphansDropped };

    const rebuiltDdl = existing.sql
        .replace(/CREATE TABLE\s+"?obligations"?/i, 'CREATE TABLE obligations_migrating')
        .replace(CONSTRAINED, RELAXED);

    const indexes = (db.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'obligations' "
        + 'AND sql IS NOT NULL'
    ).all() as { sql: string }[]).map(row => row.sql);

    const columnList = columns.map(c => c.name);
    // The one value that changes on the way across. Everything else is copied.
    const select = columnList
        .map(name => (name === 'subject_id' ? "NULLIF(subject_id, '')" : `"${name}"`))
        .join(', ');
    const target = columnList.map(name => `"${name}"`).join(', ');

    const converted = (db.prepare(
        "SELECT COUNT(*) AS n FROM obligations WHERE subject_id = ''"
    ).get() as { n: number }).n;

    // Outside the transaction. Inside one it does nothing, and the cascade it
    // is here to prevent would take `obligation_participants` with the table.
    const enforcementWasOn = db.pragma('foreign_keys', { simple: true }) === 1;
    db.pragma('foreign_keys = OFF');
    try {
        db.transaction(() => {
            // A previous attempt that died mid-way leaves this behind.
            db.exec('DROP TABLE IF EXISTS obligations_migrating');
            db.exec(rebuiltDdl);
            db.exec(
                `INSERT INTO obligations_migrating (${target}) SELECT ${select} FROM obligations`
            );
            db.exec('DROP TABLE obligations');
            db.exec('ALTER TABLE obligations_migrating RENAME TO obligations');
            for (const sql of indexes) db.exec(sql);
        })();

        const broken = db.pragma('foreign_key_check') as unknown[];
        if (broken.length > 0) {
            // Loud rather than silent. Enforcement is about to go back on and
            // the next write would fail somewhere far away from here.
            throw new Error(
                `obligations rebuild left ${broken.length} foreign key violation(s): `
                + JSON.stringify(broken.slice(0, 3))
            );
        }
    } finally {
        if (enforcementWasOn) db.pragma('foreign_keys = ON');
    }

    return { rebuilt: true, converted, indexes: indexes.length, orphansDropped };
}

/**
 * Delete accounts whose triggering event `world_chronicle` does not hold.
 *
 * Design owner, on why this is a delete and not a reconciliation: *the good
 * thing about a game is we can just nuke the stuff created from gameplay
 * because we have pre-seeded sects and npcs. This isn't mission critical data.*
 *
 * Two things it deliberately does NOT do. It leaves a NULL
 * `triggering_event_id` alone - that is an account nobody attached one to, which
 * is most of the ledger. And it leaves everything alone when the chronicle is
 * empty: a database whose world tables have not been written yet is not
 * corrupt, and deleting the ledger on that reading is how a migration eats a
 * save.
 */
function dropAccountsRestingOnNothing(db: Database.Database): number {
    const chronicle = db.prepare(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' "
        + "AND name = 'world_chronicle'"
    ).get() as { n: number };
    if (chronicle.n === 0) return 0;

    const held = (db.prepare('SELECT COUNT(*) AS n FROM world_chronicle')
        .get() as { n: number }).n;
    if (held === 0) return 0;

    const doomed = db.prepare(
        'DELETE FROM obligations WHERE triggering_event_id IS NOT NULL '
        + 'AND triggering_event_id NOT IN (SELECT id FROM world_chronicle)'
    ).run();
    return doomed.changes;
}
