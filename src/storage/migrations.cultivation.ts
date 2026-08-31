import type Database from 'better-sqlite3';

/**
 * Cultivation (xianxia) persistence subsystem.
 *
 * SQLite is the source of truth for the entire cultivation surface: the
 * cultivator record, the survival ratchet (satiety / meridian injuries /
 * lifespan), techniques, alchemy, sects, and the permadeath run ledger. The
 * runtime agent narrates from these rows; it never asserts them.
 *
 * Idempotent; safe on every startup. Wired into migrate() in migrations.ts:
 *   import { migrateCultivation } from './migrations.cultivation.js';
 *   // ...at the end of migrate():
 *   migrateCultivation(db);
 *
 * Two shape decisions worth stating up front, because they are load-bearing:
 *
 * 1. Injuries get their own table rather than a JSON blob on `cultivators`.
 *    Untreated injuries are queried (count them, are any crippling?) and
 *    mutated (treat exactly this one) far more often than they are read as a
 *    whole. A blob would force a read-modify-write of the cultivator row for
 *    every pill taken, and would make "how many untreated injuries" an
 *    application-side scan instead of an indexed COUNT.
 *
 * 2. `cultivators.run_id` carries no FOREIGN KEY, while `runs.cultivator_id`
 *    does. The relationship is genuinely circular — a run belongs to a
 *    cultivator and a cultivator belongs to a run — and SQLite can only
 *    satisfy a cycle with deferred constraints plus a mandatory transaction
 *    around every insert. Since a run is always started *for* an existing
 *    cultivator, the cultivator side is the safe one to enforce; the back
 *    reference is a plain indexed column.
 */
export function migrateCultivation(db: Database.Database): void {
    db.exec(`
    -- ── SECTS ────────────────────────────────────────────────────────────
    -- Created first: cultivators.sect_id points here.
    CREATE TABLE IF NOT EXISTS sects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      alignment TEXT NOT NULL DEFAULT 'neutral',
      power_ordinal INTEGER NOT NULL DEFAULT 17,
      ranks TEXT NOT NULL DEFAULT '[]',              -- JSON array of rank titles, outer disciple upward
      admission_ordinal INTEGER NOT NULL DEFAULT 3,
      stipend TEXT NOT NULL DEFAULT '[]',            -- JSON array of spirit stones, indexed by rank
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── CULTIVATORS ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cultivators (
      id TEXT PRIMARY KEY,
      run_id TEXT,                                   -- see header note 2: deliberately unconstrained
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'pc',

      -- Talent: rolled once at creation, never editable afterward.
      spirit_root TEXT NOT NULL,
      attributes TEXT NOT NULL DEFAULT '{}',         -- JSON: might/insight/fortune/charm

      -- Position on the 45-rank ladder.
      realm_ordinal INTEGER NOT NULL DEFAULT 0,
      cultivation_progress REAL NOT NULL DEFAULT 0,

      -- Vitals. REAL is wrong for these; they are integer resources by schema.
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      qi INTEGER NOT NULL DEFAULT 0,
      max_qi INTEGER NOT NULL DEFAULT 0,
      satiety INTEGER NOT NULL DEFAULT 100,
      starvation_turns INTEGER NOT NULL DEFAULT 0,

      -- Time and mortality. REAL because a time-skip may advance a fraction
      -- of a year, and rounding those to integers would silently lose lifespan.
      age REAL NOT NULL DEFAULT 16,
      years_at_current_realm REAL NOT NULL DEFAULT 0,

      -- Wealth and standing.
      spirit_stones INTEGER NOT NULL DEFAULT 30,
      sect_id TEXT,
      sect_rank TEXT,
      location TEXT,                                 -- free-text place name; geography here is narrative
      feuds TEXT NOT NULL DEFAULT '[]',              -- JSON array of ids/names holding a grudge
      known_techniques TEXT NOT NULL DEFAULT '[]',   -- JSON array, denormalised mirror of cultivator_techniques

      -- Death is terminal. Once alive = 0 the row is a historical record.
      alive INTEGER NOT NULL DEFAULT 1,
      death_cause TEXT,
      died_on_turn INTEGER,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      -- A disbanded sect must not orphan its disciples into a dangling id.
      FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cultivators_run ON cultivators(run_id);
    CREATE INDEX IF NOT EXISTS idx_cultivators_sect ON cultivators(sect_id);
    CREATE INDEX IF NOT EXISTS idx_cultivators_alive ON cultivators(alive);

    -- ── RUNS: THE PERMADEATH LEDGER ──────────────────────────────────────
    -- Rows here outlive the cultivator conceptually but not physically: the
    -- ledger exists to answer "how do cultivators die", and a run detached
    -- from its cultivator cannot answer that, so it cascades.
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      cultivator_id TEXT NOT NULL,
      seed TEXT NOT NULL,                            -- every stochastic system in the run derives from this
      status TEXT NOT NULL DEFAULT 'active',         -- active | dead | ascended
      turn INTEGER NOT NULL DEFAULT 0,
      elapsed_days REAL NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      death_cause TEXT,
      death_description TEXT,
      peak_ordinal INTEGER NOT NULL DEFAULT 0,       -- preserved for the ledger after death
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_runs_cultivator ON runs(cultivator_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    -- The death-ledger screen reads finished runs newest-first; index the sort.
    CREATE INDEX IF NOT EXISTS idx_runs_ended ON runs(ended_at DESC);
    -- There is at most one live run per cultivator. Enforced, not assumed.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_one_active
      ON runs(cultivator_id) WHERE status = 'active';

    -- ── INJURIES ─────────────────────────────────────────────────────────
    -- The ratchet: injuries accumulate, do not heal on their own, and are
    -- what turn a survivable run into a fatal one.
    CREATE TABLE IF NOT EXISTS cultivator_injuries (
      id TEXT PRIMARY KEY,
      cultivator_id TEXT NOT NULL,
      severity TEXT NOT NULL,                        -- minor | serious | crippling
      source TEXT NOT NULL,                          -- combat | qi_deviation | failed_breakthrough | ...
      description TEXT NOT NULL,
      sustained_on_turn INTEGER NOT NULL DEFAULT 0,
      treated INTEGER NOT NULL DEFAULT 0,
      cultivation_penalty REAL NOT NULL DEFAULT 0.1,
      breakthrough_penalty REAL NOT NULL DEFAULT 0.05,
      treated_on_turn INTEGER,                       -- audit trail; not part of the domain schema
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_injuries_cultivator ON cultivator_injuries(cultivator_id);
    -- "How many untreated injuries does this cultivator carry" is asked before
    -- every fight and every breakthrough. A partial index keeps it O(matches).
    CREATE INDEX IF NOT EXISTS idx_injuries_untreated
      ON cultivator_injuries(cultivator_id) WHERE treated = 0;

    -- ── TECHNIQUES ───────────────────────────────────────────────────────
    -- The catalog is world data: one row per art that exists at all.
    CREATE TABLE IF NOT EXISTS techniques (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,                        -- attack | defense | movement | support | cultivation | forbidden
      grade TEXT NOT NULL,                           -- mortal | earth | heaven | immortal | chaos
      element TEXT,                                  -- NULL = elementless, safe for any spirit root
      required_ordinal INTEGER NOT NULL DEFAULT 0,
      qi_cost INTEGER NOT NULL DEFAULT 0,
      damage TEXT,                                   -- dice expression resolved by the dice engine
      mastery REAL NOT NULL DEFAULT 0,               -- catalog baseline; per-cultivator mastery lives on the join
      description TEXT NOT NULL DEFAULT '',
      cooldown INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_techniques_category ON techniques(category);
    CREATE INDEX IF NOT EXISTS idx_techniques_required_ordinal ON techniques(required_ordinal);

    -- Who knows what, and how well. Mastery and cooldown are per-cultivator
    -- state, not properties of the art, so they belong on the join and not on
    -- the catalog row two cultivators share.
    CREATE TABLE IF NOT EXISTS cultivator_techniques (
      cultivator_id TEXT NOT NULL,
      technique_id TEXT NOT NULL,
      mastery REAL NOT NULL DEFAULT 0,               -- 0..1, raised by practice
      cooldown_remaining INTEGER NOT NULL DEFAULT 0, -- turns until usable again
      last_used_turn INTEGER,
      learned_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (cultivator_id, technique_id),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE,
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cultivator_techniques_technique
      ON cultivator_techniques(technique_id);

    -- ── ALCHEMY ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,                           -- same tier ladder as techniques
      effect TEXT NOT NULL,                          -- heal_hp | treat_injury | grain_abstinence | ...
      potency REAL NOT NULL DEFAULT 0,
      toxicity REAL NOT NULL DEFAULT 0,
      value INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pills_effect ON pills(effect);

    -- A recipe that produces a pill which no longer exists is not a recipe,
    -- it is a crash waiting for an alchemist. Cascade it away.
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      produces_pill_id TEXT NOT NULL,
      ingredients TEXT NOT NULL DEFAULT '[]',        -- JSON array of { itemId, quantity }
      base_success_rate REAL NOT NULL DEFAULT 0.5,
      required_ordinal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (produces_pill_id) REFERENCES pills(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_pill ON recipes(produces_pill_id);

    -- ── SECT MEMBERSHIP ──────────────────────────────────────────────────
    -- rank_index is the authority (it indexes into sects.ranks and
    -- sects.stipend); rank_title is denormalised for display and for the
    -- cultivators.sect_rank mirror.
    CREATE TABLE IF NOT EXISTS sect_members (
      sect_id TEXT NOT NULL,
      cultivator_id TEXT NOT NULL,
      rank_index INTEGER NOT NULL DEFAULT 0,
      rank_title TEXT NOT NULL DEFAULT '',
      contribution INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (sect_id, cultivator_id),
      FOREIGN KEY (sect_id) REFERENCES sects(id) ON DELETE CASCADE,
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    -- A cultivator belongs to at most one sect; the lookup is by cultivator.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sect_members_cultivator
      ON sect_members(cultivator_id);
  `);

    addCultivationColumns(db);
}

/**
 * Columns added to cultivation tables after their first release.
 *
 * CREATE TABLE IF NOT EXISTS is a no-op on a database that already has the
 * table, so a column added to the DDL above reaches new databases only. Every
 * post-release column therefore needs an explicit, guarded ALTER here — the
 * same shape runMigrations() in migrations.ts uses for the `characters` table.
 * Checking PRAGMA table_info rather than catching the duplicate-column error
 * keeps startup quiet on the overwhelmingly common already-migrated path.
 */
function addCultivationColumns(db: Database.Database): void {
    const cultivatorColumns = (
        db.prepare('PRAGMA table_info(cultivators)').all() as { name: string }[]
    ).map(col => col.name);

    // Where the cultivator is. Nullable with no default: an existing world has
    // no recorded locations, and inventing one for every legacy row would be
    // the engine asserting geography it never simulated.
    if (!cultivatorColumns.includes('location')) {
        console.error('[Migration] Adding location column to cultivators table');
        db.exec('ALTER TABLE cultivators ADD COLUMN location TEXT;');
    }
}
