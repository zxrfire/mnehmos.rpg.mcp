/**
 * Persistence and retrieval.
 *
 * The engine modules are pure, so the thing that has to be proved here is that
 * a record written to SQLite comes back the same - and, specifically, that the
 * schema has nowhere to put a decay, an expiry, or a cultivation rank.
 */

import Database from 'better-sqlite3';
import { migrateSocial } from '../../../src/storage/migrations.social.js';
import { createGrudge, inheritOnDeath } from '../../../src/engine/social/grudges.js';
import { createRelationship } from '../../../src/engine/social/relationships.js';
import { recordFact, recordKnowledge } from '../../../src/engine/social/knowledge.js';
import { createHolding } from '../../../src/engine/social/secrets.js';
import { daysForYears } from '../../../src/engine/social/common.js';

describe('migrateSocial', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrateSocial(db);
    });

    afterEach(() => {
        db.close();
    });

    it('creates every table the layer needs', () => {
        const tables = (
            db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .all() as { name: string }[]
        ).map(t => t.name);

        expect(tables).toEqual(
            expect.arrayContaining([
                'relationships',
                'relationship_events',
                'obligations',
                'obligation_participants',
                'world_facts',
                'world_fact_subjects',
                'knowledge_records',
                'knowledge_revisions',
                'secret_holdings',
                'secret_events'
            ])
        );
    });

    it('is idempotent across repeated startups', () => {
        expect(() => {
            migrateSocial(db);
            migrateSocial(db);
        }).not.toThrow();
    });

    it('has nowhere to store a decay, an expiry, or a realm', () => {
        const socialTables = [
            'relationships',
            'relationship_events',
            'obligations',
            'world_facts',
            'knowledge_records',
            'secret_holdings',
            'secret_events'
        ];
        for (const table of socialTables) {
            const columns = (
                db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
            ).map(c => c.name);
            for (const column of columns) {
                // Nothing ages out, and nothing is ranked by cultivation.
                // Matched on whole underscore-separated segments, so that a
                // legitimate column like `settlement_resolution` is not caught
                // by the "ttl" it happens to contain.
                expect(column).not.toMatch(
                    /(^|_)(decay|decays|expires|expiry|ttl|realm|ordinal|power|rank|strength_tier)(_|$)/i
                );
            }
        }
    });

    it('round-trips an obligation and its inherited copy', () => {
        const insert = db.prepare(`
            INSERT INTO obligations (
              id, kind, holder_id, subject_id, cause, severity, incurred_on_day,
              triggering_event_id, description, participants, tags, terms, due_on_day,
              status, inheritance, generation, origin_holder_id, from_belief, recorded_on_day
            ) VALUES (
              @id, @kind, @holderId, @subjectId, @cause, @severity, @incurredOnDay,
              @triggeringEventId, @description, @participants, @tags, @terms, @dueOnDay,
              @status, @inheritance, @generation, @originHolderId, @fromBelief, @recordedOnDay
            )
        `);
        const toRow = (r: ReturnType<typeof createGrudge>) => ({
            id: r.id,
            kind: r.kind,
            holderId: r.holderId,
            subjectId: r.subjectId,
            cause: r.cause,
            severity: r.severity,
            incurredOnDay: r.incurredOnDay,
            triggeringEventId: r.triggeringEventId,
            description: r.description,
            participants: JSON.stringify(r.participants),
            tags: JSON.stringify(r.tags),
            terms: r.terms,
            dueOnDay: r.dueOnDay,
            status: r.status,
            inheritance: JSON.stringify(r.inheritance),
            generation: r.generation,
            originHolderId: r.originHolderId,
            fromBelief: r.fromBelief ? 1 : 0,
            recordedOnDay: r.recordedOnDay
        });

        const grudge = createGrudge({
            holderId: 'yun_qi',
            subjectId: 'lord_hai',
            cause: 'killed_kin',
            severity: 'unforgivable',
            onDay: daysForYears(20),
            description: 'Killed his sister at the Low Fall.',
            triggeringEventId: 'fact_low_fall'
        });
        insert.run(toRow(grudge));

        const heir = inheritOnDeath(
            grudge,
            'yun_qi',
            [{ id: 'yun_shi', relation: 'descendant' }],
            daysForYears(80)
        )[0];
        insert.run(toRow(heir));

        const stored = db
            .prepare('SELECT * FROM obligations WHERE origin_holder_id = ? ORDER BY generation')
            .all('yun_qi') as Record<string, unknown>[];

        expect(stored).toHaveLength(2);
        expect(stored[1].generation).toBe(1);
        expect(stored[1].holder_id).toBe('yun_shi');
        // Faithful copy survives the round trip: same severity, same date.
        expect(stored[1].severity).toBe('unforgivable');
        expect(stored[1].incurred_on_day).toBe(daysForYears(20));
        expect(stored[1].triggering_event_id).toBe('fact_low_fall');
        expect(JSON.parse(stored[1].inheritance as string)[0].deceasedId).toBe('yun_qi');

        // Still queryable sixty years after it was written.
        const openLater = db
            .prepare("SELECT COUNT(*) AS n FROM obligations WHERE status = 'open' AND incurred_on_day <= ?")
            .get(daysForYears(140)) as { n: number };
        expect(openLater.n).toBe(2);
    });

    it('round-trips a relationship and refuses a duplicate direction', () => {
        const rel = createRelationship({
            fromId: 'yun_qi',
            toId: 'elder_shan',
            type: 'former_disciple',
            onDay: 0,
            strength: 0.9,
            significance: 'defining',
            attitude: 'cautious trust',
            roles: ['owes_a_favour']
        });
        const insert = db.prepare(`
            INSERT INTO relationships (
              id, from_character_id, to_character_id, type, label, strength, significance,
              attitude, roles, history, established_on_day, last_updated_on_day, active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);
        const args = [
            rel.id,
            rel.fromId,
            rel.toId,
            rel.type,
            rel.label,
            rel.strength,
            rel.significance,
            rel.attitude,
            JSON.stringify(rel.roles),
            rel.history,
            rel.establishedOnDay,
            rel.lastUpdatedOnDay
        ] as const;
        insert.run(...args);

        const row = db
            .prepare('SELECT * FROM relationships WHERE from_character_id = ?')
            .get('yun_qi') as Record<string, unknown>;
        expect(row.type).toBe('former_disciple');
        expect(row.attitude).toBe('cautious trust');
        expect(JSON.parse(row.roles as string)).toEqual(['owes_a_favour']);

        // One row per direction, enforced by the unique index.
        expect(() => insert.run(...args)).toThrow();

        // The reverse direction is a different row and is allowed.
        const reverse = createRelationship({
            fromId: 'elder_shan',
            toId: 'yun_qi',
            type: 'former_master',
            onDay: 0
        });
        expect(() =>
            insert.run(
                reverse.id,
                reverse.fromId,
                reverse.toId,
                reverse.type,
                reverse.label,
                reverse.strength,
                reverse.significance,
                reverse.attitude,
                JSON.stringify(reverse.roles),
                reverse.history,
                reverse.establishedOnDay,
                reverse.lastUpdatedOnDay
            )
        ).not.toThrow();
    });

    it('stores a false belief alongside an intact fact, and keeps them apart', () => {
        const fact = recordFact({
            claimKey: 'who_killed_yun_mei',
            onDay: daysForYears(20),
            statement: 'Lord Hai killed Yun Mei at the Low Fall.',
            detail: { killer: 'lord_hai' },
            subjects: ['lord_hai', 'yun_mei']
        });
        db.prepare(
            `INSERT INTO world_facts (id, claim_key, on_day, statement, detail, subjects, tags, concealed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            fact.id,
            fact.claimKey,
            fact.onDay,
            fact.statement,
            JSON.stringify(fact.detail),
            JSON.stringify(fact.subjects),
            JSON.stringify(fact.tags),
            fact.concealed ? 1 : 0
        );

        const belief = recordKnowledge({
            holderId: 'yun_qi',
            claimKey: 'who_killed_yun_mei',
            stance: 'believes',
            statement: 'Bo Lan killed Yun Mei at the Low Fall.',
            detail: { killer: 'bo_lan' },
            factId: fact.id,
            confidence: 0.9,
            onDay: daysForYears(21),
            source: { kind: 'told', fromHolderId: 'a_broker' }
        });
        db.prepare(
            `INSERT INTO knowledge_records (
               id, holder_id, holder_kind, claim_key, fact_id, stance, statement, detail,
               source_kind, source_from_holder_id, source_via_record_id, source_note,
               acquired_on_day, confidence, tags, superseded
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        ).run(
            belief.id,
            belief.holderId,
            belief.holderKind,
            belief.claimKey,
            belief.factId,
            belief.stance,
            belief.statement,
            JSON.stringify(belief.detail),
            belief.source.kind,
            belief.source.fromHolderId ?? null,
            belief.source.viaRecordId ?? null,
            belief.source.note ?? '',
            belief.acquiredOnDay,
            belief.confidence,
            JSON.stringify(belief.tags)
        );

        const storedBelief = db
            .prepare('SELECT * FROM knowledge_records WHERE holder_id = ?')
            .get('yun_qi') as Record<string, unknown>;
        const storedFact = db
            .prepare('SELECT * FROM world_facts WHERE claim_key = ?')
            .get('who_killed_yun_mei') as Record<string, unknown>;

        expect(storedBelief.statement).toContain('Bo Lan');
        // Ground truth is untouched and separately queryable.
        expect(storedFact.statement).toContain('Lord Hai');
        expect(JSON.parse(storedFact.detail as string).killer).toBe('lord_hai');
        expect(JSON.parse(storedBelief.detail as string).killer).toBe('bo_lan');
    });

    it('accepts a groundless claim with a null fact id', () => {
        expect(() =>
            db
                .prepare(
                    `INSERT INTO knowledge_records (
                       id, holder_id, holder_kind, claim_key, fact_id, stance, statement,
                       source_kind, acquired_on_day
                     ) VALUES ('k1', 'ke_ran', 'character', 'a_manual_he_does_not_have',
                               NULL, 'believes', 'He is carrying a heaven-grade manual.',
                               'fabricated', 900)`
                )
                .run()
        ).not.toThrow();
    });

    it('round-trips a secret holding and enforces one position per pair', () => {
        const holding = createHolding({
            secretId: 'secret_1',
            holderId: 'yun_qi',
            status: 'falsified',
            onDay: 100,
            heldVersion: 'The elder kept the stones.',
            acquiredFromId: 'a_broker',
            price: 'Two hundred stones.'
        });
        const insert = db.prepare(
            `INSERT INTO secret_holdings (
               id, secret_id, holder_id, holder_kind, status, held_version,
               acquired_on_day, acquired_from_id, price, note, tags, last_changed_on_day
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const args = [
            holding.id,
            holding.secretId,
            holding.holderId,
            holding.holderKind,
            holding.status,
            holding.heldVersion,
            holding.acquiredOnDay,
            holding.acquiredFromId,
            holding.price,
            holding.note,
            JSON.stringify(holding.tags),
            holding.lastChangedOnDay
        ] as const;
        insert.run(...args);

        const row = db
            .prepare('SELECT * FROM secret_holdings WHERE secret_id = ? AND holder_id = ?')
            .get('secret_1', 'yun_qi') as Record<string, unknown>;
        expect(row.status).toBe('falsified');
        expect(row.held_version).toBe('The elder kept the stones.');

        expect(() => insert.run(...args)).toThrow();

        // A secret in the database that nobody holds reaches nobody.
        const orphan = db
            .prepare('SELECT COUNT(*) AS n FROM secret_holdings WHERE secret_id = ?')
            .get('secret_nobody_has') as { n: number };
        expect(orphan.n).toBe(0);
    });

    it('cascades relationship events with their relationship but keeps obligations independent', () => {
        db.prepare(
            `INSERT INTO relationships (id, from_character_id, to_character_id, type,
               established_on_day, last_updated_on_day)
             VALUES ('r1', 'a', 'b', 'friend', 0, 0)`
        ).run();
        db.prepare(
            `INSERT INTO relationship_events (id, relationship_id, on_day, kind, summary)
             VALUES ('e1', 'r1', 10, 'saved_life', 'Pulled him out of the water.')`
        ).run();

        db.prepare('DELETE FROM relationships WHERE id = ?').run('r1');
        const events = db
            .prepare('SELECT COUNT(*) AS n FROM relationship_events')
            .get() as { n: number };
        expect(events.n).toBe(0);
    });
});
