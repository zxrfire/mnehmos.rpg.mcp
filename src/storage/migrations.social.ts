import type Database from 'better-sqlite3';

import { foldPersonKnowledgeKeys } from './folding-a-persons-two-knowledge-keys-into-one.js';
import { makeTheObligationSubjectOptional } from './optional-obligation-subject.js';

/**
 * Social memory persistence: relationships, obligations, knowledge, secrets.
 *
 * SQLite is the source of truth for everything the world remembers about
 * everybody. The runtime agent reasons FROM these rows - whether a grudge is
 * worth acting on, whether an NPC is trustworthy, how a faction responds - and
 * the engine's contribution is that the rows are exact, dated, attributed, and
 * still here in forty years of world time.
 *
 * In this subsystem that has unusually sharp teeth, because these tables
 * deliberately store things that are FALSE. A `knowledge_records` row is not a
 * fact. A `secret_holdings` row with status `falsified` is not the secret.
 * `world_facts` is the only table here that says what is true, and no
 * character-facing query is allowed to read it.
 *
 * Idempotent; safe on every startup. Wired into migrate() in migrations.ts by
 * its owner:
 *   import { migrateSocial } from './migrations.social.js';
 *   // ...at the end of migrate():
 *   migrateSocial(db);
 *
 * Five shape decisions worth stating, because each one is load-bearing:
 *
 * 1. **Nothing in this schema expires.** No TTL column, no decay coefficient,
 *    no "stale" flag, no sweep. An obligation leaves the open ledger exactly
 *    one way: a settlement row is written saying what discharged it. A grudge
 *    that quietly stopped mattering because forty years passed is the precise
 *    failure this subsystem exists to prevent, so the schema offers no column
 *    that could express it.
 *
 * 2. **Nothing in this schema ranks people by cultivation.** There is no realm
 *    ordinal, no power column and no reference to the ladder anywhere below.
 *    A character's importance is stored - a relationship type, a role, a
 *    significance - never derived from where they stand. That is what lets a
 *    master who has been surpassed by their own disciple remain the most
 *    important person in that disciple's life.
 *
 * 3. **Relationships are directed, and stored as two rows.** The primary key
 *    is (from_character_id, to_character_id). A master's view of a disciple
 *    and that disciple's view of the master are separate records that are
 *    allowed to contradict each other completely, because the asymmetric cases
 *    are the interesting ones.
 *
 * 4. **`knowledge_records.fact_id` is NULLABLE and unconstrained.** A belief
 *    about something that never happened has no fact to point at, and that is
 *    the most consequential row in the table rather than an edge case.
 *    `claim_key` carries the topic instead, and is what the belief indexes are
 *    built on.
 *
 * 5. **Secrets extend, they do not duplicate.** The existing `secrets` table
 *    in migrations.ts owns a secret's content. `secret_holdings` adds the two
 *    things it lacks: a per-holder lifecycle richer than one `revealed`
 *    boolean, and the knowledge that a secret is held by four people, suspected
 *    by a fifth, and held in a doctored version by a sixth who paid for it.
 */
export function migrateSocial(db: Database.Database): void {
    db.exec(`
    -- ── RELATIONSHIPS ────────────────────────────────────────────────────
    -- Directed, one row per direction. See header note 3.
    --
    -- The columns are deliberately plural: type, strength, attitude, roles,
    -- history and events are SEPARATE fields because a relationship must not
    -- be reduced to one number. strength and attitude in particular routinely
    -- disagree - a bitter former disciple has a very strong tie and a hostile
    -- attitude, and that combination is a plot a single scalar would erase.
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      from_character_id TEXT NOT NULL,               -- whose view this is
      to_character_id TEXT NOT NULL,                 -- who it is about
      type TEXT NOT NULL,                            -- former_disciple | younger_sibling | creditor | ...
      label TEXT NOT NULL DEFAULT '',                -- free text refinement, or the value when type='custom'

      -- How CONSEQUENTIAL this person is to the holder. Not warmth, not
      -- approval, and explicitly not a function of anyone's cultivation.
      strength REAL NOT NULL DEFAULT 0.3,
      significance TEXT NOT NULL DEFAULT 'notable',  -- incidental | notable | defining

      -- The current attitude in plain words: 'cautious trust', 'resentment',
      -- 'owes them everything'. Prose, because the nuance is the point.
      attitude TEXT NOT NULL DEFAULT '',
      roles TEXT NOT NULL DEFAULT '[]',              -- JSON array: ['owes_a_favour','shares_a_secret']
      history TEXT NOT NULL DEFAULT '',              -- the running account, written by the narrator

      established_on_day INTEGER NOT NULL,           -- absolute day index, not a timestamp
      last_updated_on_day INTEGER NOT NULL,

      -- Ended ties are kept, never deleted. A dead master is still a master.
      active INTEGER NOT NULL DEFAULT 1,
      ended_reason TEXT,                             -- death | expelled | estranged | severed
      ended_on_day INTEGER,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One row per direction per pair, enforced rather than assumed.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_pair
      ON relationships(from_character_id, to_character_id);
    -- "Who is in this person's life" and "who counts them as part of theirs"
    -- are both asked whenever a character walks on stage.
    CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_character_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_character_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

    -- The important events that made a relationship what it is. A separate
    -- table rather than a JSON blob on the row: events are appended constantly
    -- and read selectively, and a blob would force a read-modify-write of the
    -- whole relationship for every single thing that happens between two
    -- people over a three-hundred-year life.
    CREATE TABLE IF NOT EXISTS relationship_events (
      id TEXT PRIMARY KEY,
      relationship_id TEXT NOT NULL,
      on_day INTEGER NOT NULL,
      kind TEXT NOT NULL,                            -- saved_life | abandoned | taught | humiliated | ...
      summary TEXT NOT NULL,                         -- prose; the engine never parses it
      significance TEXT NOT NULL DEFAULT 'notable',  -- minor | notable | defining
      fact_id TEXT,                                  -- world_facts.id, when the event has one
      tags TEXT NOT NULL DEFAULT '[]',               -- JSON array, for structured queries
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_relationship_events_rel
      ON relationship_events(relationship_id, on_day);
    CREATE INDEX IF NOT EXISTS idx_relationship_events_fact ON relationship_events(fact_id);

    -- ── OBLIGATIONS: GRUDGES, DEBTS, FAVOURS, OATHS, BLOOD FEUDS ─────────
    -- One table, because every consumer reads them together: "what stands
    -- between these two people" is one question, and splitting it across five
    -- tables would make it five joins.
    --
    -- Note the absence of any weight column. severity is a WORD
    -- (slight/serious/grave/unforgivable), written once and never
    -- recalculated: how much a killing is worth relative to a humiliation is a
    -- judgement, and judgements belong to the narrator reading the record.
    CREATE TABLE IF NOT EXISTS obligations (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,                            -- grudge, debt, favor, oath, blood_feud, leverage
      holder_id TEXT NOT NULL,                       -- the aggrieved party / debtor / oath-taker
      -- The offender / creditor / beneficiary, or NULL for an account nobody can
      -- put a name to. See engine/social/accounts-with-no-name.ts: somebody who
      -- knows they were wronged and cannot say by whom holds a real record with
      -- a real weight and no subject, which is what makes a killing with no
      -- witness have a consequence. Existing databases are relaxed to this
      -- shape by makeTheObligationSubjectOptional, below.
      subject_id TEXT,
      cause TEXT NOT NULL,                           -- killed_kin | saved_life | sworn_brotherhood | ...
      severity TEXT NOT NULL,                        -- slight | serious | grave | unforgivable
      incurred_on_day INTEGER NOT NULL,              -- stays comparable across any span of world time
      -- world_chronicle.id: the thing that actually happened.
      --
      -- NOT world_facts.id, which is what this said and is a different
      -- subsystem - see migrations.world.ts's own header on the collision. A
      -- foreign key written to the old comment would have orphaned every row:
      -- measured on a played database, world_facts held 0 rows and the
      -- chronicle held 102, with every obligation resolving against the
      -- chronicle and none against world_facts.
      --
      -- Unconstrained, and it cannot be constrained as it stands: the
      -- chronicle's key is (world_id, id) because fact ids are per-world
      -- sequential text, so a single-column REFERENCES is rejected outright.
      -- makeTheObligationSubjectOptional sweeps rows naming an event nothing
      -- holds on every startup, and says there what the real constraint needs.
      triggering_event_id TEXT,
      description TEXT NOT NULL DEFAULT '',          -- prose; what happened, for the narrator
      participants TEXT NOT NULL DEFAULT '[]',       -- JSON array of everyone else involved
      tags TEXT NOT NULL DEFAULT '[]',               -- JSON array

      -- Oaths and debts have terms. Prose, because oaths are sworn in words.
      terms TEXT,
      due_on_day INTEGER,

      -- Settlement is the ONLY exit. See header note 1.
      status TEXT NOT NULL DEFAULT 'open',           -- open | settled
      settlement_resolution TEXT,                    -- avenged | repaid | forgiven | oath_fulfilled | proven_false | ...
      settled_on_day INTEGER,
      settled_by_id TEXT,
      settlement_note TEXT,

      -- Inheritance provenance. The copy is FAITHFUL: same cause, same
      -- severity, same incurred_on_day. There is no generational discount,
      -- because "how much does the grandson actually care" is exactly what the
      -- narrator should answer from the record rather than from a coefficient.
      inheritance TEXT NOT NULL DEFAULT '[]',        -- JSON array of handovers
      generation INTEGER NOT NULL DEFAULT 0,         -- 0 = the person it happened to
      origin_holder_id TEXT NOT NULL,                -- never changes through any handover

      -- True when written on the strength of a BELIEF rather than a confirmed
      -- fact. Not a discount: a feud founded on a lie kills people exactly as
      -- thoroughly. It is here so the record can be settled as 'proven_false'.
      from_belief INTEGER NOT NULL DEFAULT 0,

      recorded_on_day INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- "What stands between these two" - asked before every meeting.
    CREATE INDEX IF NOT EXISTS idx_obligations_pair ON obligations(holder_id, subject_id);
    -- "Who is carrying something about this person", including people they
    -- never met. Drives what happens when somebody dies.
    CREATE INDEX IF NOT EXISTS idx_obligations_subject ON obligations(subject_id);
    -- The open ledger is the usual read, and a ledger spanning centuries is
    -- mostly settled history. Partial index keeps it O(matches).
    CREATE INDEX IF NOT EXISTS idx_obligations_open
      ON obligations(holder_id) WHERE status = 'open';
    CREATE INDEX IF NOT EXISTS idx_obligations_event ON obligations(triggering_event_id);
    -- Oaths and debts coming due.
    CREATE INDEX IF NOT EXISTS idx_obligations_due
      ON obligations(due_on_day) WHERE due_on_day IS NOT NULL;
    -- Inherited business, found without scanning.
    CREATE INDEX IF NOT EXISTS idx_obligations_origin ON obligations(origin_holder_id);

    -- Bystanders, so a record is findable from anyone it touched and not only
    -- from its two principals. A join table rather than a LIKE over the JSON
    -- array, because "find every open feud this witness is named in" is a real
    -- query and a scan is the wrong answer to it.
    CREATE TABLE IF NOT EXISTS obligation_participants (
      obligation_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'participant',      -- witness | victim | arbiter | ...
      PRIMARY KEY (obligation_id, character_id),
      FOREIGN KEY (obligation_id) REFERENCES obligations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_obligation_participants_character
      ON obligation_participants(character_id);

    -- ── LAYER 1: OBJECTIVE REALITY ───────────────────────────────────────
    -- What is actually true. Written once by the engine, never revised - if
    -- the world changes, that is a NEW fact with a later day, because a record
    -- of what used to be true is how a belief that was reasonable when it was
    -- formed gets explained later.
    --
    -- No character-facing query may read this table. The whole subsystem is
    -- pointless the moment anything in the world can.
    CREATE TABLE IF NOT EXISTS world_facts (
      id TEXT PRIMARY KEY,
      claim_key TEXT NOT NULL,                       -- the topic beliefs are filed against
      on_day INTEGER NOT NULL,
      statement TEXT NOT NULL,                       -- the true statement, in plain words
      detail TEXT NOT NULL DEFAULT '{}',             -- JSON: who, where, how much
      subjects TEXT NOT NULL DEFAULT '[]',           -- JSON array of everyone it concerns
      tags TEXT NOT NULL DEFAULT '[]',               -- JSON array
      concealed INTEGER NOT NULL DEFAULT 0,          -- deliberately hidden at the time
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_world_facts_claim ON world_facts(claim_key, on_day);
    CREATE INDEX IF NOT EXISTS idx_world_facts_day ON world_facts(on_day);

    -- Who each fact concerns, queryable. Same reasoning as
    -- obligation_participants: a JSON array is storage, not an index.
    CREATE TABLE IF NOT EXISTS world_fact_subjects (
      fact_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      PRIMARY KEY (fact_id, character_id),
      FOREIGN KEY (fact_id) REFERENCES world_facts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_world_fact_subjects_character
      ON world_fact_subjects(character_id);

    -- ── LAYERS 2-5: KNOWS / BELIEVES / SUSPECTS / PUBLIC ─────────────────
    -- One row per (holder, claim) position. The four layers the spec requires
    -- are distinguished by two columns rather than four tables:
    --
    --   stance      = knows | believes | suspects | ignorant
    --   holder_kind = character | public
    --
    -- A public holder ('public:sweptground', 'public:azure_cloud') is how
    -- "what the public believes" is stored. A region believing something is
    -- the same kind of object as a person believing it, so every query works
    -- on both with no special case.
    --
    -- 'ignorant' is a real, writable stance: "she has been told repeatedly and
    -- does not accept it" is different from having no row at all, and only one
    -- of the two is worth a scene.
    CREATE TABLE IF NOT EXISTS knowledge_records (
      id TEXT PRIMARY KEY,
      holder_id TEXT NOT NULL,
      holder_kind TEXT NOT NULL DEFAULT 'character', -- character | public
      claim_key TEXT NOT NULL,                       -- groups competing versions of one topic
      -- Nullable and unconstrained. See header note 4.
      fact_id TEXT,
      stance TEXT NOT NULL,                          -- knows | believes | suspects | ignorant
      statement TEXT NOT NULL,                       -- what THIS holder holds to be so
      detail TEXT NOT NULL DEFAULT '{}',             -- JSON; often a subset, sometimes wrong

      -- Provenance. source_via_record_id is the chain link: following it back
      -- to the root answers "did anyone ever actually see this, or has it only
      -- ever been repeated" - which is a question players pay to have answered.
      source_kind TEXT NOT NULL,                     -- witnessed | told | overheard | read | inferred | fabricated | ...
      source_from_holder_id TEXT,
      source_via_record_id TEXT,
      source_note TEXT NOT NULL DEFAULT '',

      acquired_on_day INTEGER NOT NULL,
      -- How sure the holder is. STORED, not computed: it is what they were
      -- told or how convinced they came away, and nothing recalculates it
      -- behind their back.
      confidence REAL NOT NULL DEFAULT 0.5,
      tags TEXT NOT NULL DEFAULT '[]',               -- JSON array
      -- Superseded rows are kept, never deleted: what someone used to believe
      -- is how their past decisions get explained.
      superseded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The core query: what does this holder hold about this topic.
    CREATE INDEX IF NOT EXISTS idx_knowledge_holder_claim
      ON knowledge_records(holder_id, claim_key);
    -- Every incompatible version of a topic currently in circulation.
    CREATE INDEX IF NOT EXISTS idx_knowledge_claim ON knowledge_records(claim_key);
    CREATE INDEX IF NOT EXISTS idx_knowledge_holder_stance
      ON knowledge_records(holder_id, stance) WHERE superseded = 0;
    CREATE INDEX IF NOT EXISTS idx_knowledge_via ON knowledge_records(source_via_record_id);
    -- "Who is spreading things they made up" is worth paying for.
    CREATE INDEX IF NOT EXISTS idx_knowledge_fabricated
      ON knowledge_records(holder_id) WHERE source_kind = 'fabricated';

    -- Append-only record of somebody's position changing, INCLUDING when they
    -- refuse to change it. accepted = 0 is "I told him the truth and he did
    -- not believe me", which is a real scene and is recorded as faithfully as
    -- the other kind. Whether the holder accepts new information is the
    -- narrator's call; the engine only writes down which way it went.
    CREATE TABLE IF NOT EXISTS knowledge_revisions (
      id TEXT PRIMARY KEY,
      holder_id TEXT NOT NULL,
      claim_key TEXT NOT NULL,
      on_day INTEGER NOT NULL,
      previous_record_id TEXT NOT NULL,
      revised_record_id TEXT,                        -- NULL when they rejected it
      cause TEXT NOT NULL DEFAULT '',
      accepted INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_holder
      ON knowledge_revisions(holder_id, claim_key, on_day);

    -- ── SECRETS: PER-HOLDER LIFECYCLE ────────────────────────────────────
    -- Extends the existing "secrets" table rather than duplicating it. See
    -- header note 5. secret_id points at secrets(id); no content is restated.
    --
    -- No foreign key to secrets: that table is owned by migrations.ts and is
    -- world-scoped, and a holding for a secret in a world that was dropped
    -- should not take the holder's history with it.
    CREATE TABLE IF NOT EXISTS secret_holdings (
      id TEXT PRIMARY KEY,
      secret_id TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      holder_kind TEXT NOT NULL DEFAULT 'character', -- character | faction | public
      status TEXT NOT NULL,                          -- unknown | suspected | discovered | stolen | traded | leaked | suppressed | falsified | misunderstood

      -- What this holder actually has, when it is not the secret itself. The
      -- falsified and misunderstood cases act on this string, and keeping it
      -- apart from the real content is what lets a doctored secret be sold
      -- onward, believed, and eventually found out.
      held_version TEXT,

      acquired_on_day INTEGER NOT NULL,
      acquired_from_id TEXT,                         -- who they got it from
      price TEXT,                                    -- what it cost, for a trade; prose
      note TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',               -- JSON array
      last_changed_on_day INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One position per (secret, holder), enforced.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_secret_holdings_pair
      ON secret_holdings(secret_id, holder_id);
    -- "Who could give this away."
    CREATE INDEX IF NOT EXISTS idx_secret_holdings_secret ON secret_holdings(secret_id);
    -- "What does this person have to trade."
    CREATE INDEX IF NOT EXISTS idx_secret_holdings_holder ON secret_holdings(holder_id);
    CREATE INDEX IF NOT EXISTS idx_secret_holdings_status ON secret_holdings(status);

    -- Every transition, append-only. The history is the valuable part: a
    -- secret currently 'suppressed' that was 'leaked' for two years in between
    -- is a very different problem from one that was never out, and only the
    -- log can tell them apart.
    CREATE TABLE IF NOT EXISTS secret_events (
      id TEXT PRIMARY KEY,
      secret_id TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      on_day INTEGER NOT NULL,
      from_status TEXT,                              -- NULL for the first entry
      to_status TEXT NOT NULL,
      actor_id TEXT,                                 -- the thief, the broker, the elder
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_secret_events_secret ON secret_events(secret_id, on_day);
    CREATE INDEX IF NOT EXISTS idx_secret_events_holder ON secret_events(holder_id, on_day);
  `);

  // A data migration rather than a shape one, and the only one in this file.
  // A catalog person has two ids and this table was filed under both; the
  // module says why the rows have to be rewritten rather than left to rot.
  foldPersonKnowledgeKeys(db);

  // A shape one, and it has to be a rebuild: SQLite cannot relax a NOT NULL
  // with an ALTER, so the CREATE TABLE above only reaches fresh databases and
  // every existing one would go on refusing NULL. Also sweeps accounts resting
  // on an event the chronicle does not hold, which is the enforcement available
  // while the reference cannot carry a foreign key.
  makeTheObligationSubjectOptional(db);
}
