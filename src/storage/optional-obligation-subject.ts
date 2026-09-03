/**
 * `obligations.subject_id` becomes nullable, and accounts resting on nothing go.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE COLUMN HAD TO CHANGE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * An account can be open against nobody. `accounts-with-no-name.ts` is the
 * state and the reason: somebody who knows they were wronged and cannot say by
 * whom holds a real record with a real weight and no subject, and that is what
 * makes a killing with no witness have a consequence.
 *
 * NULL is the honest way to store that. The column was `TEXT NOT NULL`, so the
 * empty string carried it for exactly as long as it took to get this written -
 * and an empty string is the shape of defect AGENTS.md files under *a field
 * nothing writes*: it reads as a value, and every query around it goes on
 * answering with total confidence.
 *
 * **After this runs there is exactly one stored representation of no-name, and
 * it is NULL.** `NO_NAME_ON_IT` and `hasANameOnIt` stay as the read path so
 * nothing outside that module compares to either form.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT IS A REBUILD, AND WHY THE GUARD IS THE CONSTRAINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * SQLite cannot relax a NOT NULL with an ALTER. Editing the `CREATE TABLE IF
 * NOT EXISTS` in `migrations.social.ts` alone would give a fresh database the
 * nullable column and leave every existing one rejecting NULL - two schemas
 * behind one migration, which is worse than either.
 *
 * So the guard is **`notnull` on the column**, not whether the column exists.
 * Both shapes have a `subject_id`; only one of them still refuses NULL, and
 * that is the only question worth asking. Re-runnable from any state,
 * including one where a previous attempt died between the copy and the rename.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE NEW SCHEMA IS DERIVED FROM THE OLD ONE, NOT WRITTEN OUT AGAIN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A second copy of the `obligations` DDL in this file would be a second place
 * for it to drift, and it would go stale the first time somebody adds a column
 * in `migrations.social.ts` and does not think to look here. So the rebuild
 * reads the table's own `sqlite_master.sql` and changes exactly one token in
 * it. Whatever the table is on the day this runs is what it stays, minus the
 * constraint.
 *
 * The same for the indexes: they are read back off `sqlite_master` and
 * replayed, so a rebuild carries forward every index the table had rather than
 * the ones this file remembered about.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ORDER MATTERS, AND SQLITE IS UNFORGIVING ABOUT IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `obligation_participants` holds `FOREIGN KEY (obligation_id) REFERENCES
 * obligations(id) ON DELETE CASCADE`, and the caller turns enforcement on
 * (`db.ts`, `pragma('foreign_keys = ON')`). **Dropping `obligations` with
 * enforcement on would cascade every participant row out of existence.** So
 * enforcement goes off around the rebuild - outside the transaction, because
 * `PRAGMA foreign_keys` is a no-op inside one - and `foreign_key_check` runs
 * before it goes back on.
 *
 * Drop first, then rename. The other order asks SQLite to rewrite references
 * to a table name that is about to be taken, and the rename would then have to
 * be done with `legacy_alter_table` on to stop it rewriting the child's FK
 * clause on the way past.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND AN ACCOUNT RESTING ON AN EVENT NOTHING HOLDS IS DELETED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `triggering_event_id` is the ground-truth row an account rests on, and it has
 * been unconstrained since it was written. A row naming an event the world does
 * not hold is not evidence to be preserved - it is the corruption a constraint
 * would exist to prevent, and the world it belongs to regenerates from its
 * seed. So the rebuild drops them and reports how many, because the COUNT is
 * the useful part: a large number says something is actively writing bad
 * references, and a small one says this was history.
 *
 * ── The parent is `world_chronicle`, and the schema comment says otherwise ──
 *
 * `migrations.social.ts` documents the column as `world_facts.id`. **It is not,
 * and a foreign key written to that comment would delete the entire ledger.**
 * Measured on a played database:
 *
 *     world_facts       0 rows        2 of 2 obligations orphaned
 *     world_chronicle   102 rows      0 of 2 obligations orphaned
 *
 * The two tables are different subsystems and `migrations.world.ts` says so in
 * its own header: `world_facts` is the social layer's claim-keyed
 * objective-reality table that BELIEFS file against, and the dated event log a
 * deed lands in is `world_chronicle`. So the orphan test here is against the
 * chronicle, and the schema comment is corrected in the same commit.
 *
 * ── Why there is still no FOREIGN KEY on it ────────────────────────────────
 *
 * **SQLite will not accept one, and the reason is structural rather than
 * fixable here.** `world_chronicle`'s primary key is `(world_id, id)` - fact
 * ids are per-world sequential text, `f1`, `f2`, so `id` alone is not unique
 * and two worlds in one database both hold an `f1`. A foreign key needs its
 * parent columns to be a primary key or carry a unique index, so:
 *
 *     FOREIGN KEY (triggering_event_id) REFERENCES world_chronicle(id)
 *     -> SQLITE_ERROR: foreign key mismatch, on the first insert
 *
 * The composite form is accepted and is the shape the constraint wants:
 *
 *     FOREIGN KEY (world_id, triggering_event_id)
 *       REFERENCES world_chronicle(world_id, id)
 *
 * which needs a `world_id` on `obligations`, and therefore needs every writer
 * of an obligation in the repository to supply one. That is a real change and
 * a good one; it is not this file's to make unilaterally. **When it is made,
 * the `ON DELETE` clause should not be `CASCADE`**: an account that outlives
 * the record of what caused it is a real thing in this world - a grudge whose
 * origin nobody can produce - and deleting a world fact must not silently
 * delete somebody's reason to be angry. `SET NULL` is the clause that says
 * that. Deleting rows that never had a valid reference, which is what this
 * file does, is a different act from cascading away rows that did.
 *
 * Until then the sweep below is the enforcement that is actually available,
 * and it runs on every startup.
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
 * The design owner, on why this is a delete and not a reconciliation: *the good
 * thing about a game is we can just nuke the stuff created from gameplay
 * because we have pre-seeded sects and npcs. This isn't mission critical
 * data.* A world regenerates from its seed; an account pointing at nothing does
 * not become correct by being kept.
 *
 * Two things it deliberately does not do.
 *
 * **It leaves a NULL `triggering_event_id` alone.** That is not a broken
 * reference, it is an account nobody attached one to - most of the ledger, and
 * every row written before `a-deed-enters-the-world-as-a-fact.ts` existed.
 *
 * **And it leaves everything alone when the chronicle is empty.** A database
 * whose world tables have not been written yet is not a database full of
 * corruption; it is one where the world has not been persisted. Deleting the
 * ledger on that reading is how a migration eats a save.
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
