import io

p = 'src/storage/migrations.cultivation.ts'
s = io.open(p, encoding='utf-8').read()

# ── the table, as new databases get it ──────────────────────────────────
old_ddl = """    CREATE TABLE IF NOT EXISTS cultivator_pouch (
      cultivator_id TEXT NOT NULL,
      item_id TEXT NOT NULL,                         -- catalog pill or herb id
      item_kind TEXT NOT NULL,                       -- pill | herb
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (cultivator_id, item_id),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );"""
new_ddl = """    -- HOLDER, NOT CULTIVATOR, AND NO FOREIGN KEY. Counted stock is stock: a
    -- stack of herbs belongs to whoever is carrying it, and whoever is carrying
    -- it need not be somebody a run is being played through. The column was
    -- `cultivator_id` with `REFERENCES cultivators(id) ON DELETE CASCADE`, which
    -- said two things that are not true - that only a played character can hold
    -- a pill, and that a dead person's stock stops existing.
    --
    -- `estate-settlement.ts` documented the consequence against itself: a body
    -- was searched, the stones went to whoever was standing over it, and the
    -- pills and herbs were DELETED, because there was nowhere for them to go.
    CREATE TABLE IF NOT EXISTS cultivator_pouch (
      holder_id TEXT NOT NULL,
      item_id TEXT NOT NULL,                         -- catalog pill or herb id
      item_kind TEXT NOT NULL,                       -- pill | herb
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (holder_id, item_id)
    );"""
assert old_ddl in s
s = s.replace(old_ddl, new_ddl, 1)

# ── and the rebuild for databases that already have the old shape ───────
tail = """    if (!runColumns.includes('admin')) {
        console.error('[Migration] Adding admin column to runs table');
        db.exec('ALTER TABLE runs ADD COLUMN admin INTEGER NOT NULL DEFAULT 0;');
        db.exec('CREATE INDEX IF NOT EXISTS idx_runs_admin ON runs(admin);');
    }
}"""
new_tail = """    if (!runColumns.includes('admin')) {
        console.error('[Migration] Adding admin column to runs table');
        db.exec('ALTER TABLE runs ADD COLUMN admin INTEGER NOT NULL DEFAULT 0;');
        db.exec('CREATE INDEX IF NOT EXISTS idx_runs_admin ON runs(admin);');
    }

    thePouchBelongsToWhoeverIsCarryingIt(db);
}

/**
 * Rebuild `cultivator_pouch` so a holder need not be a cultivator.
 *
 * A REBUILD AND NOT AN ALTER, because the thing being removed is a FOREIGN KEY
 * and SQLite cannot drop one in place. The column rename comes with it.
 *
 * The old shape claimed two things that are not true: that only somebody a run
 * is played through can hold a pill, and that a dead person's stock stops
 * existing - `ON DELETE CASCADE` made the second one literal.
 */
function thePouchBelongsToWhoeverIsCarryingIt(db: Database.Database): void {
    const columns = (
        db.prepare('PRAGMA table_info(cultivator_pouch)').all() as { name: string }[]
    ).map(col => col.name);
    if (columns.includes('holder_id')) return;

    console.error('[Migration] Rebuilding cultivator_pouch on holder_id, without the cultivator key');
    // Foreign keys off for the swap: the old table's constraint would otherwise
    // fight the copy. Restored afterwards whatever it was.
    const enforcing = (db.pragma('foreign_keys', { simple: true }) as number) === 1;
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
        db.exec(`
            CREATE TABLE cultivator_pouch_rebuilt (
              holder_id TEXT NOT NULL,
              item_id TEXT NOT NULL,
              item_kind TEXT NOT NULL,
              quantity INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (holder_id, item_id)
            );
        `);
        db.exec(`
            INSERT INTO cultivator_pouch_rebuilt (holder_id, item_id, item_kind, quantity, updated_at)
            SELECT cultivator_id, item_id, item_kind, quantity, updated_at FROM cultivator_pouch;
        `);
        db.exec('DROP TABLE cultivator_pouch;');
        db.exec('ALTER TABLE cultivator_pouch_rebuilt RENAME TO cultivator_pouch;');
    })();
    if (enforcing) db.pragma('foreign_keys = ON');
}"""
assert tail in s
s = s.replace(tail, new_tail, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('migration written')
