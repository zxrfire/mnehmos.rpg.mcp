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
 *    does. The relationship is genuinely circular - a run belongs to a
 *    cultivator and a cultivator belongs to a run - and SQLite can only
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
      -- The foundation laid at the 12 -> 13 crossing. Set once, by the engine,
      -- and never again: it is the quality of the thing every realm above it is
      -- built on. 'none' until Foundation Establishment is actually reached.
      foundation_quality TEXT NOT NULL DEFAULT 'none',
      -- Result of the last crossing. A 'false_immortal' stays at ordinal 44
      -- and is permanently barred from attempting again, so this column is
      -- what enforces the bar: without it the bar lasts only as long as the
      -- process, and the Lid would open twice for the same name.
      immortal_status TEXT NOT NULL DEFAULT 'none',

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

      -- Understanding: the axis that is not accumulation. Both JSON arrays,
      -- same convention as feuds / known_techniques. Insights are keyed by
      -- (domain, subject) inside the array and are never queried
      -- independently of their holder, so a table would buy nothing; an
      -- achievement is an immutable record of an event and is read only as
      -- part of the cultivator's own history.
      insights TEXT NOT NULL DEFAULT '[]',
      achievements TEXT NOT NULL DEFAULT '[]',

      -- Death is terminal. Once alive = 0 the row is a historical record.
      alive INTEGER NOT NULL DEFAULT 1,
      -- existence_state is authoritative; the alive flag above is the
      -- convenience boolean kept truthful beside it. A soul with no body is
      -- not alive in any ordinary sense and is very much still playing, which
      -- is exactly the case the boolean alone cannot express.
      existence_state TEXT NOT NULL DEFAULT 'alive',
      soul_state TEXT NOT NULL DEFAULT 'intact',
      identity_continuity REAL NOT NULL DEFAULT 1,
      body_id TEXT,
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
      -- Set the first time admin_manage touches this run. Admin lifts content
      -- gates, so a run that used it is no longer evidence about how hard the
      -- game is: the ledger and every balance statistic exclude it. The
      -- audit_logs row is the authoritative justification; this is the index.
      admin INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_runs_cultivator ON runs(cultivator_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    -- The death ledger reads finished, non-admin runs. Index the exclusion.
    CREATE INDEX IF NOT EXISTS idx_runs_admin ON runs(admin);
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

    -- -- DURABLE PER-CULTIVATOR SCALARS ------------------------------------
    -- Small facts that are neither vitals nor rows of their own: a pill held
    -- for the next bottleneck, the day grain abstinence expires, accumulated
    -- pill toxicity, the day the stipend was last drawn, whether a crossing has
    -- already taken the name. Key/value rather than columns because these are
    -- sparse, independently written, and expected to come and go as pills and
    -- subsystems are added.
    CREATE TABLE IF NOT EXISTS cultivator_flags (
      cultivator_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (cultivator_id, key),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    -- -- THE POUCH ---------------------------------------------------------
    -- Pills and herbs a cultivator carries. Deliberately NOT inventory_items:
    -- that table's character_id has a foreign key to characters, and a
    -- cultivator is not a character. Sharing it would mean either dropping the
    -- constraint for everyone or writing rows that violate it.
    CREATE TABLE IF NOT EXISTS cultivator_pouch (
      cultivator_id TEXT NOT NULL,
      item_id TEXT NOT NULL,                         -- catalog pill or herb id
      item_kind TEXT NOT NULL,                       -- pill | herb
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (cultivator_id, item_id),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    -- -- SITES AND ENCOUNTERS ----------------------------------------------
    -- Graves, caves, ruins, scars, spirit veins and instantiated encounters.
    -- The contents column is the engine's roll, written once at creation and never
    -- re-rolled, so reading a site twice cannot produce two different hauls.
    --
    -- run_id carries no FOREIGN KEY: a site outlives the run that turned it up.
    -- The map is pocked with other people's ambitions, and a scar
    -- does not stop existing because the cultivator who made it is dead.
    CREATE TABLE IF NOT EXISTS cultivation_sites (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      kind TEXT NOT NULL,                            -- grave | cave | ruin | scar | vein | encounter
      name TEXT NOT NULL,
      ordinal INTEGER NOT NULL DEFAULT 0,            -- realm ordinal the site belongs to
      location TEXT,
      contents TEXT NOT NULL DEFAULT '{}',           -- JSON, rolled once by the engine
      admin_spawned INTEGER NOT NULL DEFAULT 0,
      discovered INTEGER NOT NULL DEFAULT 0,
      created_on_day REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_cultivation_sites_run ON cultivation_sites(run_id);

    -- -- AMBIENT GATE LIFTS -------------------------------------------------
    -- Ambient qi is a pure function of (seed, place, day), so it cannot be set
    -- without lying about it. ADMIN instead relocates to a place the engine
    -- genuinely derives the requested band for, and records the substitution
    -- here for the block it covers. The band stays the engine's number.
    CREATE TABLE IF NOT EXISTS ambient_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      location TEXT NOT NULL,                        -- the place the cultivator calls home
      alias TEXT NOT NULL,                           -- the place the engine is actually asked about
      band TEXT NOT NULL,                            -- thin | normal | dense | spirit_tide
      from_day REAL NOT NULL,
      to_day REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ambient_aliases_run ON ambient_aliases(run_id, location);

    -- -- THE TOLL LEDGER ----------------------------------------------------
    -- The Price of Advancement is charged in instalments, one at every realm
    -- boundary, and what it takes is never a stat. "You can look at the ledger and see the shape of
    -- who you used to be" is a design requirement, so every instalment is
    -- recorded with what went, why that one, and the odds it was charged at --
    -- including the crossings where nothing was taken.
    CREATE TABLE IF NOT EXISTS cultivation_tolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      cultivator_id TEXT NOT NULL,
      from_ordinal INTEGER NOT NULL,
      to_ordinal INTEGER NOT NULL,
      boundary_index INTEGER NOT NULL,               -- 0 at the 12 -> 13 crossing
      outcome TEXT NOT NULL,                         -- clean | prepaid | taken | nothing_left
      risk REAL NOT NULL,
      roll REAL NOT NULL,
      taken_kind TEXT,                               -- bond | memory | technique | name
      taken_id TEXT,                                 -- null for a taken name
      taken_label TEXT,
      taken_reason TEXT,
      narration_hint TEXT NOT NULL DEFAULT '',
      charged_on_day REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cultivation_tolls_cultivator
      ON cultivation_tolls(cultivator_id);

    -- -- CONFRONTATIONS -----------------------------------------------------
    -- Combat is not a scene the narrator remembers, it is state. The encounter
    -- row holds the initiative order and the round; the participant rows hold
    -- who is in it and where they stand in that order.
    --
    -- Kept separate from the cultivator row on purpose: HP and injuries belong
    -- to the person and outlive the fight, while initiative and round belong to
    -- the fight and must not leak into anything that reads a cultivator.
    CREATE TABLE IF NOT EXISTS combat_encounters (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      seed TEXT NOT NULL,                            -- derived from the run seed
      status TEXT NOT NULL DEFAULT 'active',         -- active | ended
      round INTEGER NOT NULL DEFAULT 1,
      turn_index INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      ambient TEXT NOT NULL DEFAULT 'normal',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_combat_encounters_run ON combat_encounters(run_id);
    CREATE INDEX IF NOT EXISTS idx_combat_encounters_status ON combat_encounters(status);

    CREATE TABLE IF NOT EXISTS combat_participants (
      encounter_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,                  -- cultivator id, character id, or a free label
      name TEXT NOT NULL,
      cultivator_id TEXT,                            -- set when this participant is a cultivator
      ordinal INTEGER NOT NULL DEFAULT 0,
      initiative REAL NOT NULL DEFAULT 0,
      slot INTEGER NOT NULL DEFAULT 0,               -- position in the rolled order
      active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (encounter_id, participant_id),
      FOREIGN KEY (encounter_id) REFERENCES combat_encounters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_combat_participants_slot
      ON combat_participants(encounter_id, slot);

    -- -- WHAT A CULTIVATOR HAS SURVIVED --------------------------------------
    -- Experience is a form of power, so it has to be a fact rather than a
    -- recollection. One row per confrontation resolved, which is both the
    -- history a player can read back and the count assessPower prices.
    CREATE TABLE IF NOT EXISTS combat_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cultivator_id TEXT NOT NULL,
      opponent_id TEXT,
      opponent_name TEXT NOT NULL DEFAULT '',
      opponent_ordinal INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,                         -- ConfrontationOutcome
      won INTEGER NOT NULL DEFAULT 0,
      realm_gap INTEGER NOT NULL DEFAULT 0,
      edges TEXT NOT NULL DEFAULT '[]',              -- JSON array of Edge
      on_day REAL NOT NULL DEFAULT 0,
      turn INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cultivator_id) REFERENCES cultivators(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_combat_records_cultivator
      ON combat_records(cultivator_id);
  `);

    addCultivationColumns(db);
}

/**
 * Columns added to cultivation tables after their first release.
 *
 * CREATE TABLE IF NOT EXISTS is a no-op on a database that already has the
 * table, so a column added to the DDL above reaches new databases only. Every
 * post-release column therefore needs an explicit, guarded ALTER here - the
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

    // The foundation laid at the 12 -> 13 crossing. NOT NULL with a default of
    // 'none' rather than nullable: every cultivator has a foundation, and for
    // the overwhelming majority of them - everyone still in Qi Condensation,
    // which is most of the world - the honest value is that they have not laid
    // one. NULL would mean "unknown", and the engine is never unsure.
    if (!cultivatorColumns.includes('foundation_quality')) {
        console.error('[Migration] Adding foundation_quality column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN foundation_quality TEXT NOT NULL DEFAULT 'none';");
    }

    // The result of the last crossing: none | false_immortal | true_immortal.
    // Durable because both non-'none' values are permanent facts about the
    // cultivator - one bars every further attempt, the other is the only thing
    // in this engine that permits ending a run without dying.
    if (!cultivatorColumns.includes('immortal_status')) {
        console.error('[Migration] Adding immortal_status column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN immortal_status TEXT NOT NULL DEFAULT 'none';");
    }

    // Understanding. Both default to an empty array rather than NULL, and no
    // backfill is possible or wanted: an insight must name the achievement
    // that produced it, so there is nothing honest to invent for a row written
    // before the subsystem existed. Having comprehended nothing is the
    // ordinary case anyway - most cultivators live and die that way.
    if (!cultivatorColumns.includes('insights')) {
        console.error('[Migration] Adding insights column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN insights TEXT NOT NULL DEFAULT '[]';");
    }

    if (!cultivatorColumns.includes('achievements')) {
        console.error('[Migration] Adding achievements column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN achievements TEXT NOT NULL DEFAULT '[]';");
    }

    // Existence. These four were in CultivatorSchema before they were in the
    // table, which meant every load silently reset them to their defaults and
    // every save dropped them - a cultivator could be sealed or missing in
    // memory and read back as an ordinary living person. The schema defaults
    // are exactly right as column defaults: a row written before existence
    // states existed IS an ordinary living person.
    if (!cultivatorColumns.includes('existence_state')) {
        console.error('[Migration] Adding existence_state column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN existence_state TEXT NOT NULL DEFAULT 'alive';");
    }

    if (!cultivatorColumns.includes('soul_state')) {
        console.error('[Migration] Adding soul_state column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN soul_state TEXT NOT NULL DEFAULT 'intact';");
    }

    if (!cultivatorColumns.includes('identity_continuity')) {
        console.error('[Migration] Adding identity_continuity column to cultivators table');
        db.exec('ALTER TABLE cultivators ADD COLUMN identity_continuity REAL NOT NULL DEFAULT 1;');
    }

    // Nullable: the bodiless are a real state, not a missing value.
    if (!cultivatorColumns.includes('body_id')) {
        console.error('[Migration] Adding body_id column to cultivators table');
        db.exec('ALTER TABLE cultivators ADD COLUMN body_id TEXT;');
    }

    // Which road they walk. NOT NULL with a default rather than nullable: every
    // cultivator walks one of exactly two, and 'tradition-drawn' is what every
    // row written before the Cut Road existed always was. The column decides
    // whether soul-directed arts do anything to this person, so it has to be
    // durable - a tradition that reset to a default on every read would make a
    // carver killable by an art that cannot touch them.
    if (!cultivatorColumns.includes('tradition_id')) {
        console.error('[Migration] Adding tradition_id column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN tradition_id TEXT NOT NULL DEFAULT 'tradition-drawn';");
    }

    // Confrontations survived. Denormalised from `combat_records` because
    // `assessPower` asks for it on every exchange and a COUNT per strike is a
    // scan nobody needs. The table stays authoritative; this is the index.
    if (!cultivatorColumns.includes('battles_survived')) {
        console.error('[Migration] Adding battles_survived column to cultivators table');
        db.exec('ALTER TABLE cultivators ADD COLUMN battles_survived INTEGER NOT NULL DEFAULT 0;');
    }

    if (!cultivatorColumns.includes('battles_won')) {
        console.error('[Migration] Adding battles_won column to cultivators table');
        db.exec('ALTER TABLE cultivators ADD COLUMN battles_won INTEGER NOT NULL DEFAULT 0;');
    }

    // Where they were born - the third thing dealt at creation, beside the
    // spirit root and the attributes. NOT NULL with a default rather than
    // nullable, because everyone was born somewhere and 'thin_county' is both
    // the overwhelming majority of births and the honest reading of every row
    // written before this axis existed: no teacher, no manual, no vein.
    //
    // The column exists because the field does. A schema default with no
    // column behind it would have Zod filling `origin` on every read while the
    // value never survived a save, which is this repository's most-repeated
    // bug and is exactly the shape it takes.
    if (!cultivatorColumns.includes('origin_tier')) {
        console.error('[Migration] Adding origin_tier column to cultivators table');
        db.exec("ALTER TABLE cultivators ADD COLUMN origin_tier TEXT NOT NULL DEFAULT 'thin_county';");
    }

    const runColumns = (
        db.prepare('PRAGMA table_info(runs)').all() as { name: string }[]
    ).map(col => col.name);

    // Admin-touched runs are excluded from the death ledger and from balance
    // statistics. The audit_logs row written alongside is the authoritative
    // justification for the flag; this column exists so the ledger's exclusion
    // is an indexed read rather than a LIKE scan across every audit row.
    if (!runColumns.includes('admin')) {
        console.error('[Migration] Adding admin column to runs table');
        db.exec('ALTER TABLE runs ADD COLUMN admin INTEGER NOT NULL DEFAULT 0;');
        db.exec('CREATE INDEX IF NOT EXISTS idx_runs_admin ON runs(admin);');
    }
}
