import type Database from 'better-sqlite3';

/**
 * World persistence subsystem.
 *
 * SQLite is the source of truth for the world layer: the date, locations and
 * everything that has been done to them, factions, NPC records, actor hard
 * state, the historical ledger, durable memories, and the schedule of dated
 * consequences. The runtime agent reasons from these rows; it never asserts
 * them.
 *
 * Idempotent; safe on every startup. Wired into migrate() in migrations.ts:
 *   import { migrateWorld } from './migrations.world.js';
 *   // ...at the end of migrate():
 *   migrateWorld(db);
 *
 * ── NAMING: EVERY TABLE HERE IS PREFIXED, AND THAT IS LOAD-BEARING ────────
 *
 * This module runs LAST in migrate(), after the base schema, the cultivation
 * schema and the social schema. Every statement is CREATE TABLE IF NOT EXISTS,
 * so a name collision does not error - the second definition silently no-ops
 * and the loser's columns simply never exist. The failure then surfaces
 * hundreds of lines away as `no such column`, on a table that looks fine.
 *
 * Two collisions were found and fixed this way:
 *
 *   worlds       the base schema's worlds(id, name, seed, width, height, ...).
 *                This module's runtime row is `world_runtime`.
 *   world_facts  the social layer's claim-keyed objective-reality table, which
 *                beliefs file against. This module's dated event log is
 *                `world_chronicle`; the social layer keeps `world_facts`, and
 *                a chronicle row is referenced from there by id.
 *
 * So: every table added here MUST carry the `world_` prefix AND must be
 * checked against the ~65 tables the other four migrations create. The
 * full-migrate test in tests/engine/world/world.test.ts is what enforces it -
 * it runs migrate(db), not migrateWorld(db) alone, because standalone is
 * exactly the arrangement in which this class of bug is invisible.
 *
 * Five shape decisions worth stating up front, because they are load-bearing:
 *
 * 1. LOCATION HISTORY IS ITS OWN TABLE, not a JSON blob on `world_locations`.
 *    A location is stored as `origin -> changes -> current state`, and the
 *    layers must be SEPARATELY QUERYABLE: "what happened at Blackwater Valley",
 *    "which changes here have no recorded cause", "what did this place look
 *    like in year 8,412". A blob answers none of those without loading and
 *    parsing every location in the region.
 *
 * 2. THE ORIGIN IS DENORMALISED ONTO THE LOCATION ROW rather than stored as a
 *    change with index 0. Replaying to a past state needs the origin every
 *    time and the changes only sometimes, so one row read beats a join for the
 *    common case, and "what was this before anyone touched it" stays a single
 *    column read.
 *
 * 3. FACT IDS ARE SEQUENTIAL TEXT (`f7`), not UUIDs. Seeding several prior ages
 *    writes thousands of facts, and the whole layer has to be byte-identical
 *    across replays of the same seed. A random id makes two runs of one seed
 *    incomparable and quietly destroys the determinism guarantee. Same for
 *    memories (`m7`), effects (`e7`) and location changes (`loc-x-c7`).
 *
 * 4. BELIEF IS NOT HERE. These tables hold ground truth and the surviving
 *    record - `fidelity` and `cause_known`. What an NPC knows, believes or
 *    suspects, and what the public believes, live in the social layer's
 *    knowledge tables and reference `world_chronicle.id`. One place to be wrong
 *    about who thinks what.
 *
 * 5. MEMORY COMPRESSION IS LOSSY BY DESIGN AND AUDITED ANYWAY.
 *    `world_memories.compressed_from` keeps the ids a compressed record
 *    absorbed even though those rows are gone, so a compression pass can be
 *    inspected after the fact. Protected kinds are enforced in the engine, not
 *    by a constraint here, because the kind list is content and a CHECK would
 *    have to be migrated every time it grew.
 */
export function migrateWorld(db: Database.Database): void {
    db.exec(`
    -- ── WORLDS ───────────────────────────────────────────────────────────
    -- One row per world. "current_day" is the only clock; years are derived
    -- everywhere and never stored, so nothing can drift out of agreement.
    CREATE TABLE IF NOT EXISTS world_runtime (
      id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,                            -- every stochastic system derives from this
      current_day INTEGER NOT NULL DEFAULT 0,        -- absolute day
      version INTEGER NOT NULL DEFAULT 1,
      next_npc_seq INTEGER NOT NULL DEFAULT 1,
      next_effect_seq INTEGER NOT NULL DEFAULT 1,
      next_process_seq INTEGER NOT NULL DEFAULT 1,
      next_fact_seq INTEGER NOT NULL DEFAULT 1,
      next_memory_seq INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── ERAS ─────────────────────────────────────────────────────────────
    -- Qi pools in spiritual veins, and "qi_density" only ever falls: veins that
    -- ran rich for a thousand years have been drawn down, what the old
    -- civilisations did not consume they monopolised, and ancient wars killed
    -- whole regions outright. Dead ground does not recover. The present age is
    -- thin because most places have already been used, not because it is
    -- unlucky. It is late.
    CREATE TABLE IF NOT EXISTS world_eras (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_day INTEGER NOT NULL,
      end_day INTEGER,                               -- NULL while the era is running
      qi_density REAL NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_eras_span ON world_eras(world_id, start_day);

    -- ── HISTORY: GROUND TRUTH AND WHAT SURVIVES OF IT ────────────────────
    -- "fidelity = 'lost'" does not mean it did not happen. It means it happened
    -- and nothing legible remains, which is the normal condition of this
    -- world's past. "cause_known = 0" is "nobody knows why", stored as a real
    -- state - right up until someone finds out and it is updated.
    CREATE TABLE IF NOT EXISTS world_chronicle (
      id TEXT NOT NULL,                              -- sequential: f1, f2, ... see header note 3
      world_id TEXT NOT NULL,
      day INTEGER NOT NULL,                          -- absolute day; "year" is derived in code
      era_id TEXT NOT NULL DEFAULT 'era-0',
      kind TEXT NOT NULL,
      scale TEXT NOT NULL DEFAULT 'personal',        -- personal|local|regional|continental|world
      summary TEXT NOT NULL,
      location_id TEXT,                              -- NULL for events at unmodelled places
      place TEXT,                                    -- free-text place name
      visibility TEXT NOT NULL DEFAULT 'regional',   -- public|regional|faction|secret
      fidelity TEXT NOT NULL DEFAULT 'full',         -- full|partial|rumour|lost
      cause_known INTEGER NOT NULL DEFAULT 1,
      -- How the ENGINE stands to this fact, as distinct from how well the
      -- record survives. 'unresolved' is the important one: without it the
      -- simulation degrades into "the database secretly knows everything and
      -- NPCs merely hold incorrect copies".
      truth TEXT NOT NULL DEFAULT 'objective',       -- objective|reconstructed|unresolved
      claimed_outcomes TEXT NOT NULL DEFAULT '[]',   -- JSON: candidates, none endorsed
      -- Something that almost happened and did not. An ordinary row with a
      -- flag, and the cheapest available antidote to a history in which
      -- everything anyone tried worked.
      near_miss INTEGER NOT NULL DEFAULT 0,
      near_miss_note TEXT NOT NULL DEFAULT '',
      magnitude REAL NOT NULL DEFAULT 0.3,
      actors TEXT NOT NULL DEFAULT '[]',             -- JSON [{id,name,role}]
      witness_ids TEXT NOT NULL DEFAULT '[]',        -- JSON: who was physically present
      faction_ids TEXT NOT NULL DEFAULT '[]',        -- JSON
      causes TEXT NOT NULL DEFAULT '[]',             -- JSON: ids of earlier facts
      location_change_ids TEXT NOT NULL DEFAULT '[]',-- JSON: the physical half of the record
      consequences TEXT,                             -- JSON: the ten-question block, or NULL
      data TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    -- The chronicle reads a date window; every other access is by subject.
    CREATE INDEX IF NOT EXISTS idx_world_chronicle_day ON world_chronicle(world_id, day);
    CREATE INDEX IF NOT EXISTS idx_world_chronicle_kind ON world_chronicle(world_id, kind);
    CREATE INDEX IF NOT EXISTS idx_world_chronicle_location ON world_chronicle(world_id, location_id);
    -- "What does nobody know?" is a real query a scholar or grave-reader runs.
    CREATE INDEX IF NOT EXISTS idx_world_chronicle_unexplained
      ON world_chronicle(world_id) WHERE cause_known = 0;
    -- "What does the engine itself not know?" is a different, smaller list.
    CREATE INDEX IF NOT EXISTS idx_world_chronicle_unresolved
      ON world_chronicle(world_id) WHERE truth = 'unresolved';
    CREATE INDEX IF NOT EXISTS idx_world_chronicle_near_miss
      ON world_chronicle(world_id) WHERE near_miss = 1;

    -- Actor participation is many-to-many and is queried from both ends
    -- ("what happened to her", "who was involved in that"), so it is a join
    -- table rather than only the JSON mirror on the fact row.
    CREATE TABLE IF NOT EXISTS world_chronicle_actors (
      world_id TEXT NOT NULL,
      fact_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'involved',
      witnessed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (world_id, fact_id, actor_id, role),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_chronicle_actors_actor
      ON world_chronicle_actors(world_id, actor_id);

    -- ── LOCATIONS: CURRENT STATE PLUS ORIGIN ─────────────────────────────
    -- The four thresholds are stored separately because they fail differently:
    -- below entry you are turned away, below survival you get in and die,
    -- between survival and operational you are alive and useless.
    CREATE TABLE IF NOT EXISTS world_locations (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- region|ruin|secret_realm|forbidden_zone|...
      parent_id TEXT,
      description TEXT NOT NULL DEFAULT '',

      ambient TEXT NOT NULL DEFAULT 'normal',        -- thin|normal|dense|spirit_tide
      qi_density REAL NOT NULL DEFAULT 0.35,

      threshold_entry INTEGER NOT NULL DEFAULT 0,
      threshold_survival INTEGER NOT NULL DEFAULT 0,
      threshold_operational INTEGER NOT NULL DEFAULT 0,
      threshold_mastery INTEGER NOT NULL DEFAULT 0,

      hazards TEXT NOT NULL DEFAULT '[]',            -- JSON tags, matched by specialist counters
      affinities TEXT NOT NULL DEFAULT '[]',         -- JSON [{tag,multiplier,thresholdOffset,note}]

      -- A location is an environmental modifier, not just a name. These are
      -- what make "cultivate for ten years" resolve differently in a city, on a
      -- spirit mountain, and on a poisoned battlefield.
      -- Two different numbers, and the gap between them is the entire economy
      -- of exploration. qi_density is what the vein under this place holds;
      -- env_spiritual_density is what anybody can actually draw on today. A
      -- sealed ruin is a pocket nothing has drawn on: rich on the first, near
      -- zero on the second, until somebody gets the seal open.
      env_spiritual_density REAL NOT NULL DEFAULT 0.35,
      env_danger REAL NOT NULL DEFAULT 0.2,
      env_resources TEXT NOT NULL DEFAULT '[]',      -- JSON
      env_climate TEXT NOT NULL DEFAULT 'temperate',
      env_political_control TEXT NOT NULL DEFAULT '',
      env_special_rules TEXT NOT NULL DEFAULT '[]',  -- JSON: local laws of the place
      env_known_secrets TEXT NOT NULL DEFAULT '[]',  -- JSON
      env_historical_scars TEXT NOT NULL DEFAULT '[]', -- JSON
      links TEXT NOT NULL DEFAULT '[]',              -- JSON; portals are links on the same planet

      -- Secret realms and sealed domains: a period, a window and a phase, so
      -- "is it open in year 900" is arithmetic rather than three centuries of
      -- ticking.
      cycle_period_days INTEGER,
      cycle_open_days INTEGER,
      cycle_phase_day INTEGER,

      sealed INTEGER NOT NULL DEFAULT 0,
      sealed_on_day INTEGER,
      discovered INTEGER NOT NULL DEFAULT 1,
      discovered_on_day INTEGER,

      controlling_faction_id TEXT,
      origin_fact_id TEXT,

      -- Origin: what the place was before anything was done to it. See header
      -- note 2 for why this is denormalised rather than change index zero.
      origin_kind TEXT NOT NULL DEFAULT 'region',
      origin_name TEXT NOT NULL DEFAULT '',
      origin_description TEXT NOT NULL DEFAULT '',
      origin_ambient TEXT NOT NULL DEFAULT 'normal',
      origin_qi_density REAL NOT NULL DEFAULT 0.35,
      origin_thresholds TEXT NOT NULL DEFAULT '{}',  -- JSON
      origin_hazards TEXT NOT NULL DEFAULT '[]',     -- JSON
      origin_affinities TEXT NOT NULL DEFAULT '[]',  -- JSON
      origin_environment TEXT NOT NULL DEFAULT '{}', -- JSON: the whole block, as it began
      origin_from_day INTEGER,

      next_change_seq INTEGER NOT NULL DEFAULT 1,
      tags TEXT NOT NULL DEFAULT '[]',
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_locations_kind ON world_locations(world_id, kind);
    CREATE INDEX IF NOT EXISTS idx_world_locations_parent ON world_locations(world_id, parent_id);
    CREATE INDEX IF NOT EXISTS idx_world_locations_faction
      ON world_locations(world_id, controlling_faction_id);
    -- Undiscovered places are not listed to anyone; the partial index keeps the
    -- "what can I see from here" query off the rows that do not exist yet.
    CREATE INDEX IF NOT EXISTS idx_world_locations_discovered
      ON world_locations(world_id) WHERE discovered = 1;

    -- ── LOCATION HISTORY: THE MIDDLE LAYER ───────────────────────────────
    -- Append-only. A catastrophe patches the location row AND writes a row
    -- here, in one operation, so the two can never disagree. The map does not
    -- grow when something is destroyed; it gains a change and scars.
    CREATE TABLE IF NOT EXISTS world_location_changes (
      id TEXT NOT NULL,                              -- '<locationId>-c<n>'
      world_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      on_day INTEGER NOT NULL,
      kind TEXT NOT NULL,                            -- destroyed|forbidden|corrupted|sunk|...
      summary TEXT NOT NULL,
      cause_fact_id TEXT,                            -- NULL when the cause is not on record
      cause_known INTEGER NOT NULL DEFAULT 0,
      -- Competing explanations the locals hold. NOT truth: belief proper lives
      -- in the social layer. These are stories attached to the place.
      attributed_causes TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
      fidelity TEXT NOT NULL DEFAULT 'full',
      witnessed INTEGER NOT NULL DEFAULT 0,
      patch TEXT NOT NULL DEFAULT '{}',              -- JSON; replayed by stateAsOfDay
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    -- Replay is a prefix scan in day order, so the index carries the sort.
    CREATE INDEX IF NOT EXISTS idx_world_location_changes_seq
      ON world_location_changes(world_id, location_id, on_day);
    CREATE INDEX IF NOT EXISTS idx_world_location_changes_unexplained
      ON world_location_changes(world_id, location_id) WHERE cause_known = 0;

    -- ── FACTIONS ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS world_factions (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'sect',
      alignment TEXT NOT NULL DEFAULT 'neutral',
      seat_location_id TEXT,
      controlled_location_ids TEXT NOT NULL DEFAULT '[]',  -- JSON mirror of world_locations
      ranks TEXT NOT NULL DEFAULT '[]',              -- JSON; rank_index indexes into this
      standing TEXT NOT NULL DEFAULT '{}',           -- JSON {factionId: -1..1}
      resources TEXT NOT NULL DEFAULT '{}',          -- JSON {resourceKey: count}
      description TEXT NOT NULL DEFAULT '',
      founded_on_day INTEGER,
      dissolved_on_day INTEGER,                      -- set rather than deleted; ruins outlive sects
      tags TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_factions_live
      ON world_factions(world_id) WHERE dissolved_on_day IS NULL;

    -- ── NPCS: SMALL DURABLE RECORDS ──────────────────────────────────────
    -- Not simulated agents. Identity, cultivation, location, faction, goals,
    -- relationships, history and memories - enough for the LLM to reason about
    -- behaviour without anything here ever having to decide it.
    CREATE TABLE IF NOT EXISTS world_npcs (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,

      born_on_day INTEGER NOT NULL,                  -- age is a subtraction, never stored
      occupation TEXT NOT NULL DEFAULT 'unknown',
      titles TEXT NOT NULL DEFAULT '[]',             -- JSON
      aliases TEXT NOT NULL DEFAULT '[]',            -- JSON; rumours attach to these
      description TEXT NOT NULL DEFAULT '',

      realm_ordinal INTEGER NOT NULL DEFAULT 0,
      spirit_root TEXT NOT NULL,
      attributes TEXT NOT NULL DEFAULT '{}',         -- JSON might/insight/fortune/charm
      foundation TEXT NOT NULL DEFAULT 'incomplete', -- a history, not a rank
      untreated_injuries INTEGER NOT NULL DEFAULT 0,
      technique_ids TEXT NOT NULL DEFAULT '[]',      -- JSON
      specialties TEXT NOT NULL DEFAULT '[]',        -- JSON; matched against location affinities
      lifespan_ends_on_day INTEGER NOT NULL,         -- a stored date, so time advance is one pass
      last_advanced_on_day INTEGER NOT NULL DEFAULT 0,

      location_id TEXT,
      faction_id TEXT,
      faction_rank_index INTEGER NOT NULL DEFAULT -1,

      -- Existence is multi-valued once cultivation is profound: above Nascent
      -- Soul, body destroyed is no longer the same as dead. 'missing' and
      -- 'unknown' are CORRECT ANSWERS rather than placeholders for a decision
      -- the engine is avoiding, and the world may hold several incompatible
      -- beliefs about such a person at once.
      status TEXT NOT NULL DEFAULT 'alive',          -- alive|physically_dead|soul_preserved|
                                                     -- remnant|sealed|possessing|reincarnated|
                                                     -- reconstructed|missing|unknown
      body_id TEXT,                                  -- which body, when not their own
      soul_state TEXT NOT NULL DEFAULT 'intact',     -- intact|damaged|fragmented|fading
      -- How much of the original person this actually is. A remnant is not the
      -- person, and that distinction is frequently the whole encounter.
      identity_continuity REAL NOT NULL DEFAULT 1,
      died_on_day INTEGER,
      end_note TEXT NOT NULL DEFAULT '',

      last_confirmed_on_day INTEGER NOT NULL DEFAULT 0,  -- staleness is a fact about the record
      updated_on_day INTEGER NOT NULL DEFAULT 0,
      next_goal_seq INTEGER NOT NULL DEFAULT 1,
      tags TEXT NOT NULL DEFAULT '[]',

      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_npcs_location ON world_npcs(world_id, location_id);
    CREATE INDEX IF NOT EXISTS idx_world_npcs_faction ON world_npcs(world_id, faction_id);
    -- "Who is due to die" is answered by a range scan rather than a roster walk.
    CREATE INDEX IF NOT EXISTS idx_world_npcs_lifespan
      ON world_npcs(world_id, lifespan_ends_on_day) WHERE status = 'alive';

    -- Goals are the main thing the LLM reads to decide how somebody behaves,
    -- and they carry their own dates because "he has wanted this for forty
    -- years" is a fact about the world rather than a mood.
    CREATE TABLE IF NOT EXISTS world_npc_goals (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- cultivation|revenge|wealth|status|...
      -- The five fields, and no psychology: goal, priority, progress,
      -- obstacles, deadline. "Avenge a father. High. Has identified the
      -- killer's faction. Insufficient strength. No deadline."
      text TEXT NOT NULL,
      priority REAL NOT NULL DEFAULT 0.5,
      progress TEXT NOT NULL DEFAULT '',
      obstacles TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
      deadline_on_day INTEGER,                       -- NULL is common and correct
      status TEXT NOT NULL DEFAULT 'active',         -- active|achieved|abandoned|blocked|impossible
      target_id TEXT,
      opened_on_day INTEGER NOT NULL,
      closed_on_day INTEGER,
      note TEXT NOT NULL DEFAULT '',
      -- A goal does not end with its holder. A disciple continues the revenge;
      -- a descendant inherits the search. opened_on_day is preserved across the
      -- handoff, which is what makes a three-hundred-year-old goal legible as
      -- three hundred years old.
      inherited_from_id TEXT,
      origin_holder_id TEXT NOT NULL DEFAULT '',
      generation INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_npc_goals_open
      ON world_npc_goals(world_id, npc_id) WHERE status IN ('active', 'blocked');

    -- Relationships are directed: A's account with B is not B's account with A,
    -- and a betrayal is exactly the case where they stop matching. "since_day"
    -- survives every later change, so a forty-year friendship that turns
    -- hostile is still forty years old.
    CREATE TABLE IF NOT EXISTS world_relationships (
      world_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,                        -- NPC id or actor id
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,                            -- kin|spouse|master|rival|enemy|creditor|...
      standing REAL NOT NULL DEFAULT 0,              -- -1..1
      note TEXT NOT NULL DEFAULT '',
      since_day INTEGER NOT NULL DEFAULT 0,
      last_changed_day INTEGER NOT NULL DEFAULT 0,
      fact_ids TEXT NOT NULL DEFAULT '[]',           -- JSON: the causal chain
      inherited_from_id TEXT,                        -- grudges outlive their owners
      PRIMARY KEY (world_id, owner_id, target_id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_relationships_target
      ON world_relationships(world_id, target_id);

    -- ── ACTORS: WORLD-FACING HARD STATE ──────────────────────────────────
    -- Deliberately separate from "cultivators", which owns the body (hp, qi,
    -- satiety, injuries, progress). This owns where they are and what they are
    -- holding. Joined on actor_id; neither duplicates the other.
    CREATE TABLE IF NOT EXISTS world_actors (
      world_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      location_id TEXT,
      faction_id TEXT,
      faction_rank_index INTEGER NOT NULL DEFAULT -1,
      resources TEXT NOT NULL DEFAULT '{}',          -- JSON {spirit_stones: n, ...}
      key_ids TEXT NOT NULL DEFAULT '[]',            -- JSON; sealed doors and gated links
      updated_on_day INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (world_id, actor_id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_actors_location ON world_actors(world_id, location_id);

    -- Inventory is a table rather than a JSON blob because quantity is mutated
    -- far more often than the whole inventory is read, and "who holds this
    -- item" is a real query once artifacts start changing hands.
    CREATE TABLE IF NOT EXISTS world_actor_inventory (
      world_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'material',         -- pill|manual|artifact|material|token|key
      quantity INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (world_id, actor_id, item_id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_inventory_item
      ON world_actor_inventory(world_id, item_id);

    -- ── DURABLE MEMORY ───────────────────────────────────────────────────
    -- What a person carries, which is not the same as what happened and not
    -- the same as what they believe. A memory can outlive every other trace of
    -- its subject: "source_fact_ids" may point at a fact whose fidelity is now
    -- 'lost', and then the owner is the last witness to something.
    CREATE TABLE IF NOT EXISTS world_memories (
      id TEXT NOT NULL,                              -- sequential: m1, m2, ...
      world_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- betrayal|promise|debt|loss|rumour|routine|...
      summary TEXT NOT NULL,                         -- what this person would say
      detail TEXT NOT NULL DEFAULT '',
      on_day INTEGER NOT NULL,                       -- when the remembered thing happened
      actor_ids TEXT NOT NULL DEFAULT '[]',          -- JSON
      location_id TEXT,
      faction_ids TEXT NOT NULL DEFAULT '[]',        -- JSON
      salience REAL NOT NULL DEFAULT 0.5,
      tags TEXT NOT NULL DEFAULT '[]',               -- JSON
      source_fact_ids TEXT NOT NULL DEFAULT '[]',    -- JSON; may be empty
      -- Kept even though the absorbed rows are gone, so a compression pass can
      -- be inspected afterwards. See header note 5.
      compressed_from TEXT NOT NULL DEFAULT '[]',    -- JSON
      compressed INTEGER NOT NULL DEFAULT 0,
      created_on_day INTEGER NOT NULL DEFAULT 0,
      updated_on_day INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    -- Retrieval is always scoped to an owner and ordered by salience.
    CREATE INDEX IF NOT EXISTS idx_world_memories_owner
      ON world_memories(world_id, owner_id, salience DESC);
    CREATE INDEX IF NOT EXISTS idx_world_memories_day
      ON world_memories(world_id, owner_id, on_day);
    CREATE INDEX IF NOT EXISTS idx_world_memories_kind
      ON world_memories(world_id, owner_id, kind);

    -- Which memories mention whom. Recall-about-a-person is the single most
    -- common query in conversation, and scanning a JSON column for it is how
    -- a prompt build turns into a table scan.
    CREATE TABLE IF NOT EXISTS world_memory_actors (
      world_id TEXT NOT NULL,
      memory_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      PRIMARY KEY (world_id, memory_id, actor_id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_memory_actors_actor
      ON world_memory_actors(world_id, actor_id);

    -- ── SCHEDULE: DATED CONSEQUENCES ─────────────────────────────────────
    -- How the world stays in motion without being simulated. A debt falls due
    -- in eight years; a sealed domain opens in three hundred; a war the player
    -- has nothing to do with resolves next spring. Time advance is
    -- O(rows due in the span), never O(days).
    CREATE TABLE IF NOT EXISTS world_scheduled_effects (
      id TEXT NOT NULL,                              -- sequential: e1, e2, ...
      world_id TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- debt_due|seal_opens|concurrent_event|...
      due_on_day INTEGER NOT NULL,
      summary TEXT NOT NULL,
      actor_ids TEXT NOT NULL DEFAULT '[]',          -- JSON
      location_id TEXT,
      faction_id TEXT,
      repeat_days INTEGER,                           -- NULL for one-shot
      interrupts INTEGER NOT NULL DEFAULT 0,
      -- Resolved by the engine from the world seed. The agent does not get to
      -- decide whether its own scheduled consequence came off.
      chance REAL NOT NULL DEFAULT 1,
      fired INTEGER NOT NULL DEFAULT 0,
      fired_on_day INTEGER,
      data TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    -- The advance query: unfired rows in a date window, in fire order.
    CREATE INDEX IF NOT EXISTS idx_world_effects_due
      ON world_scheduled_effects(world_id, due_on_day) WHERE fired = 0;

    -- ── DURABLE PROCESSES ────────────────────────────────────────────────
    -- Something an actor is doing continuously, stored as a rate. A thirty-year
    -- seclusion is one row and one multiplication, not thirty years of ticks.
    CREATE TABLE IF NOT EXISTS world_processes (
      id TEXT NOT NULL,                              -- sequential: p1, p2, ...
      world_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- cultivating|seclusion|travelling|...
      started_on_day INTEGER NOT NULL,
      ends_on_day INTEGER,                           -- NULL while open-ended
      per_day TEXT NOT NULL DEFAULT '{}',            -- JSON {resourceKey: ratePerDay}
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_processes_actor
      ON world_processes(world_id, actor_id);
    CREATE INDEX IF NOT EXISTS idx_world_processes_open
      ON world_processes(world_id) WHERE ends_on_day IS NULL;

    -- ── LINEAGE ──────────────────────────────────────────────────────────
    -- The minimum viable version: an edge, plus what travels down it. No
    -- genetics model. This is what long time-skips land on: without the edge a
    -- century skip has nothing to attach consequence to.
    CREATE TABLE IF NOT EXISTS world_lineages (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      surname TEXT NOT NULL,
      founder_id TEXT NOT NULL,
      founded_on_day INTEGER NOT NULL,
      member_ids TEXT NOT NULL DEFAULT '[]',         -- JSON
      traits TEXT NOT NULL DEFAULT '[]',             -- JSON bloodline traits + their modifiers
      reputation REAL NOT NULL DEFAULT 0,            -- what the name is worth, -1..1
      holdings TEXT NOT NULL DEFAULT '{}',           -- JSON: family resources
      -- Ids in the social layer's obligation ledger. The records live there;
      -- only the link lives here, so neither layer owns half a grudge.
      obligation_ids TEXT NOT NULL DEFAULT '[]',     -- JSON
      inherited_enemy_ids TEXT NOT NULL DEFAULT '[]',-- JSON: accounts against the line
      extinct_on_day INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    -- ── RUNS: LIVES LIVED INSIDE THIS WORLD ──────────────────────────────
    -- Permadeath is enforced on the cultivator, not on the world. The world
    -- outlives its runs, so this is a join rather than an ownership: the
    -- cultivation schema's own runs table holds the life, and this holds the
    -- fact that the life happened here and what it left behind.
    --
    -- A run seed is DERIVED from the world seed and the index, never stored
    -- independently, so the same world always produces the same third run and
    -- starting a new one cannot perturb anything the world already decided.
    CREATE TABLE IF NOT EXISTS world_runs (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      run_index INTEGER NOT NULL,                    -- run one, run two, run three
      seed TEXT NOT NULL,                            -- derived from worlds.seed + index
      cultivator_id TEXT NOT NULL,
      cultivator_name TEXT NOT NULL DEFAULT '',
      started_on_day INTEGER NOT NULL,
      ended_on_day INTEGER,                          -- NULL while the life is being lived
      outcome TEXT NOT NULL DEFAULT 'active',        -- active|died|ascended|abandoned
      peak_ordinal INTEGER NOT NULL DEFAULT 0,
      -- Their grave, when they left one. It is an ordinary location row: the
      -- ruins a new character digs through are the previous character's.
      grave_location_id TEXT,
      -- How the NEXT run stands to this one. Most often 'stranger', because
      -- most people who dig up a grave are not related to whoever is in it.
      successor_relation TEXT,                       -- descendant|disciple|stranger
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_runs_order
      ON world_runs(world_id, run_index);
    CREATE INDEX IF NOT EXISTS idx_world_runs_cultivator
      ON world_runs(world_id, cultivator_id);
    -- The query the next run opens with: what did the last life leave.
    CREATE INDEX IF NOT EXISTS idx_world_runs_finished
      ON world_runs(world_id, ended_on_day) WHERE outcome != 'active';

    -- The edge itself. Its own table because it is walked from both ends:
    -- "who are this person's descendants" and "whose descendant is this".
    CREATE TABLE IF NOT EXISTS world_lineage_edges (
      world_id TEXT NOT NULL,
      lineage_id TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      -- Values match the social layer's InheritanceRelation exactly, so heirs
      -- pass to inheritLedgerOnDeath with no mapping step.
      relation TEXT NOT NULL,                        -- descendant|disciple|successor|clan|sworn_sibling
      on_day INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (world_id, parent_id, child_id, relation),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_lineage_edges_child
      ON world_lineage_edges(world_id, child_id);
    CREATE INDEX IF NOT EXISTS idx_world_lineage_edges_lineage
      ON world_lineage_edges(world_id, lineage_id);

    -- ── OPPORTUNITY WINDOWS ──────────────────────────────────────────────
    -- Every opportunity carries a window and the world does not hold it open.
    -- Stored as (opens, duration, recurrence) so "is the eighty-year realm open
    -- in year 9,000" is arithmetic rather than three centuries of ticking, and
    -- so a window can open and shut while the player is in a cave.
    CREATE TABLE IF NOT EXISTS world_opportunities (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- resource|realm_opening|awakening|recruitment|...
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      location_id TEXT,
      faction_ids TEXT NOT NULL DEFAULT '[]',        -- JSON
      opens_on_day INTEGER NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 1,
      recurrence_days INTEGER,                       -- NULL for a one-shot
      remaining_occurrences INTEGER,                 -- NULL for unbounded
      ends_after_day INTEGER,
      requirements TEXT NOT NULL DEFAULT '{}',       -- JSON: the five capability predicates
      claimed INTEGER NOT NULL DEFAULT 0,
      claimed_by_id TEXT,                            -- somebody else taking it is a real outcome
      claimed_on_day INTEGER,
      missed_windows INTEGER NOT NULL DEFAULT 0,
      -- Empty means nobody knows it exists, which is the normal case and is why
      -- a player can miss something they never heard about.
      known_to_ids TEXT NOT NULL DEFAULT '[]',       -- JSON
      tags TEXT NOT NULL DEFAULT '[]',
      data TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_opportunities_opens
      ON world_opportunities(world_id, opens_on_day);
    CREATE INDEX IF NOT EXISTS idx_world_opportunities_location
      ON world_opportunities(world_id, location_id);
    CREATE INDEX IF NOT EXISTS idx_world_opportunities_live
      ON world_opportunities(world_id) WHERE claimed = 0;

    -- ── OBJECTS: POSSESSION IS NOT OWNERSHIP ─────────────────────────────
    -- Four separable things: who holds it, whose it is, who claims it, and who
    -- knows any of that. A player possessing an ancient artifact and an extinct
    -- clan's descendant holding a legitimate ancestral claim, neither aware of
    -- the other, is a situation - and situations are what this engine is for.
    CREATE TABLE IF NOT EXISTS world_objects (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,                            -- artifact|manual|currency|token|key|...
      -- 'mundane' objects get no provenance. The world does not track where
      -- every spirit stone came from, and pretending otherwise makes the table
      -- useless and the queries slow.
      significance TEXT NOT NULL DEFAULT 'notable',  -- mundane|notable|significant|legendary
      description TEXT NOT NULL DEFAULT '',
      possessor_id TEXT,                             -- who is physically holding it
      owner_id TEXT,                                 -- whose it actually is; NULL is a real answer
      owner_name TEXT NOT NULL DEFAULT '',
      known_ownership_by TEXT NOT NULL DEFAULT '[]', -- JSON: who can name it on sight
      location_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      data TEXT NOT NULL DEFAULT '{}',
      next_claim_seq INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_objects_possessor
      ON world_objects(world_id, possessor_id);
    CREATE INDEX IF NOT EXISTS idx_world_objects_owner
      ON world_objects(world_id, owner_id);

    -- Claims are rows, not a field, because there are routinely several and
    -- they routinely conflict. Nothing here adjudicates: who wins is a matter
    -- of force, politics and evidence, none of which the storage layer owns.
    CREATE TABLE IF NOT EXISTS world_object_claims (
      id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      claimant_id TEXT NOT NULL,
      claimant_name TEXT NOT NULL DEFAULT '',
      basis TEXT NOT NULL,                           -- ancestral|purchase|conquest|finder|debt|...
      asserted_on_day INTEGER NOT NULL,
      strength REAL NOT NULL DEFAULT 0.5,
      acknowledged_by_ids TEXT NOT NULL DEFAULT '[]',-- JSON
      evidence_fact_ids TEXT NOT NULL DEFAULT '[]',  -- JSON: what an investigation turned up
      note TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,             -- withdrawn claims are kept; old ones resurface
      PRIMARY KEY (world_id, id),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_object_claims_object
      ON world_object_claims(world_id, object_id) WHERE active = 1;
    CREATE INDEX IF NOT EXISTS idx_world_object_claims_claimant
      ON world_object_claims(world_id, claimant_id);

    -- Where a thing came from. Append-only, one chain per object. This is what
    -- makes stolen goods, disputed inheritances, faction claims, investigations
    -- and century-old consequences possible without a separate system for each.
    CREATE TABLE IF NOT EXISTS world_object_provenance (
      world_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      on_day INTEGER NOT NULL,
      holder_id TEXT,                                -- NULL when it went into the ground
      holder_name TEXT NOT NULL DEFAULT '',
      how TEXT NOT NULL,                             -- found|inherited|bought|stolen|looted|...
      source TEXT NOT NULL DEFAULT '',
      previous_holder_id TEXT,
      previous_holder_name TEXT,
      fact_id TEXT,
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (world_id, object_id, seq),
      FOREIGN KEY (world_id) REFERENCES world_runtime(id) ON DELETE CASCADE
    );

    -- "Has this ever been stolen" is the query an investigation opens with.
    CREATE INDEX IF NOT EXISTS idx_world_provenance_how
      ON world_object_provenance(world_id, how);
    CREATE INDEX IF NOT EXISTS idx_world_provenance_holder
      ON world_object_provenance(world_id, holder_id);
  `);

    addWorldColumns(db);
}

/**
 * Columns added to world tables after their first release.
 *
 * CREATE TABLE IF NOT EXISTS is a no-op on a database that already has the
 * table, so a column added to the DDL above reaches new databases only. Every
 * post-release column therefore needs an explicit, guarded ALTER here - the
 * same shape runMigrations() in migrations.ts uses for the `characters` table.
 * Checking PRAGMA table_info rather than catching the duplicate-column error
 * keeps startup quiet on the overwhelmingly common already-migrated path.
 */
function addWorldColumns(db: Database.Database): void {
    const columnsOf = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);

    // Found by auditing WorldState against these tables rather than trusting
    // that the migration matched. All three are fields the engine already
    // writes and reads that had no column behind them, so every load would
    // have quietly rebuilt them empty and the loss would have surfaced as a
    // gameplay bug - an NPC with no history, a world whose population target
    // resets to zero - a long way from here.

    // How many living NPCs the world drifts back toward. Without it a reloaded
    // world stops replacing its dead, the roster empties over a few centuries,
    // and the simulation reports a collapse that is an artefact of the save.
    const runtimeColumns = columnsOf('world_runtime');
    if (!runtimeColumns.includes('population_target')) {
        console.error('[Migration] Adding population_target column to world_runtime table');
        db.exec('ALTER TABLE world_runtime ADD COLUMN population_target INTEGER NOT NULL DEFAULT 0;');
    }

    // The trajectory and what the person carries. Both are id lists into
    // world_chronicle and world_memories, and both are on NpcRecord and on
    // ActorWorldState. JSON arrays rather than join tables: they are read
    // whole, with the record, and never queried from the far end - the far-end
    // queries already have world_chronicle_actors and world_memory_actors.
    for (const table of ['world_npcs', 'world_actors']) {
        const columns = columnsOf(table);
        if (!columns.includes('history_fact_ids')) {
            console.error(`[Migration] Adding history_fact_ids column to ${table} table`);
            db.exec(`ALTER TABLE ${table} ADD COLUMN history_fact_ids TEXT NOT NULL DEFAULT '[]';`);
        }
        if (!columns.includes('memory_ids')) {
            console.error(`[Migration] Adding memory_ids column to ${table} table`);
            db.exec(`ALTER TABLE ${table} ADD COLUMN memory_ids TEXT NOT NULL DEFAULT '[]';`);
        }
    }
}
