import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { migrateCultivation } from '../../src/storage/migrations.cultivation';
import { CultivatorRepository, CreateCultivatorInput } from '../../src/storage/repos/cultivator.repo';
import { RunRepository } from '../../src/storage/repos/run.repo';
import { TechniqueRepository } from '../../src/storage/repos/technique.repo';
import { SectRepository } from '../../src/storage/repos/sect.repo';
import {
    Cultivator,
    Sect,
    SectSchema,
    Technique,
    TechniqueSchema,
    SATIETY_MAX,
    INJURY_WEIGHTS
} from '../../src/schema/cultivation';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';

/**
 * In-memory database with foreign keys ON. The pragma is not on by default for
 * a raw better-sqlite3 handle (initDB sets it in production), and half these
 * tests are about cascade behaviour, so it must be set explicitly here.
 */
function makeDb(): Database.Database {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    return db;
}

function cultivatorColumns(db: Database.Database): string[] {
    return (db.prepare('PRAGMA table_info(cultivators)').all() as { name: string }[])
        .map(col => col.name);
}

const NOW = '2025-01-01T00:00:00.000Z';

function sampleCultivator(overrides: Partial<CreateCultivatorInput> = {}): CreateCultivatorInput {
    return {
        id: 'cult-1',
        name: 'Li Wei',
        kind: 'pc',
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 3, fortune: 1, charm: 2 },
        realmOrdinal: 4,
        cultivationProgress: 120.5,
        hp: 34,
        maxHp: 40,
        qi: 12,
        maxQi: 20,
        satiety: 88,
        starvationTurns: 0,
        age: 19.5,
        yearsAtCurrentRealm: 2.25,
        spiritStones: 145,
        location: 'Azure Cloud Sect outer courtyard',
        feuds: ['Blackwater Pavilion', 'cult-9'],
        knownTechniques: [],
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides
    };
}

function sampleTechnique(overrides: Partial<Technique> = {}): Technique {
    return TechniqueSchema.parse({
        id: 'tech-flame-palm',
        name: 'Scarlet Flame Palm',
        category: 'attack',
        grade: 'earth',
        element: 'fire',
        requiredOrdinal: 3,
        qiCost: 5,
        damage: '2d6+4',
        mastery: 0,
        description: 'A palm strike that leaves the air smelling of scorched stone.',
        cooldown: 3,
        ...overrides
    });
}

function sampleSect(overrides: Partial<Sect> = {}): Sect {
    return SectSchema.parse({
        id: 'sect-azure',
        name: 'Azure Cloud Sect',
        alignment: 'righteous',
        powerOrdinal: 26,
        ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder'],
        admissionOrdinal: 3,
        stipend: [5, 15, 40, 120],
        description: 'Old, proud, and quietly running out of talent.',
        ...overrides
    });
}

describe('cultivation migration', () => {
    it('is idempotent', () => {
        const db = makeDb();
        expect(() => migrate(db)).not.toThrow();

        const tables = (db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as { name: string }[]).map(t => t.name);

        for (const expected of [
            'cultivators', 'cultivator_injuries', 'runs',
            'techniques', 'cultivator_techniques',
            'pills', 'recipes', 'sects', 'sect_members'
        ]) {
            expect(tables).toContain(expected);
        }

        // The guarded ALTER must not double-add on a second pass.
        expect(cultivatorColumns(db).filter(c => c === 'location')).toHaveLength(1);

        db.close();
    });

    it('adds the location column to a database created before it existed', () => {
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');

        // A pre-change database: the original cultivators DDL, verbatim minus
        // `location`. CREATE TABLE IF NOT EXISTS will skip this table, so only
        // the guarded ALTER can rescue it.
        db.exec(`
            CREATE TABLE cultivators (
              id TEXT PRIMARY KEY,
              run_id TEXT,
              name TEXT NOT NULL,
              kind TEXT NOT NULL DEFAULT 'pc',
              spirit_root TEXT NOT NULL,
              attributes TEXT NOT NULL DEFAULT '{}',
              realm_ordinal INTEGER NOT NULL DEFAULT 0,
              cultivation_progress REAL NOT NULL DEFAULT 0,
              hp INTEGER NOT NULL,
              max_hp INTEGER NOT NULL,
              qi INTEGER NOT NULL DEFAULT 0,
              max_qi INTEGER NOT NULL DEFAULT 0,
              satiety INTEGER NOT NULL DEFAULT 100,
              starvation_turns INTEGER NOT NULL DEFAULT 0,
              age REAL NOT NULL DEFAULT 16,
              years_at_current_realm REAL NOT NULL DEFAULT 0,
              spirit_stones INTEGER NOT NULL DEFAULT 30,
              sect_id TEXT,
              sect_rank TEXT,
              feuds TEXT NOT NULL DEFAULT '[]',
              known_techniques TEXT NOT NULL DEFAULT '[]',
              alive INTEGER NOT NULL DEFAULT 1,
              death_cause TEXT,
              died_on_turn INTEGER,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO cultivators (id, name, spirit_root, attributes, hp, max_hp, qi, max_qi)
            VALUES ('legacy-1', 'Old Ancestor', 'single_earth',
                    '{"might":2,"insight":2,"fortune":1,"charm":1}', 10, 10, 0, 0);
        `);

        expect(cultivatorColumns(db)).not.toContain('location');

        migrate(db);

        expect(cultivatorColumns(db)).toContain('location');

        // The legacy row survives the upgrade and reads back with a null
        // location rather than an invented one.
        const repo = new CultivatorRepository(db);
        const legacy = repo.getById('legacy-1');
        expect(legacy).not.toBeNull();
        expect(legacy!.name).toBe('Old Ancestor');
        expect(legacy!.location).toBeNull();

        // And the upgraded database accepts writes to the new column.
        expect(repo.update('legacy-1', { location: 'the Scorched Wastes' })!.location)
            .toBe('the Scorched Wastes');

        // Re-running the migration on the upgraded database is a no-op.
        expect(() => migrateCultivation(db)).not.toThrow();
        expect(cultivatorColumns(db).filter(c => c === 'location')).toHaveLength(1);
        expect(repo.getById('legacy-1')!.location).toBe('the Scorched Wastes');

        db.close();
    });
});

describe('CultivatorRepository', () => {
    let db: Database.Database;
    let repo: CultivatorRepository;

    beforeEach(() => {
        db = makeDb();
        repo = new CultivatorRepository(db);
    });

    afterEach(() => db.close());

    it('round-trips a full cultivator without losing fields', () => {
        const input = sampleCultivator();
        const created = repo.create(input);

        const loaded = repo.getById('cult-1');
        expect(loaded).not.toBeNull();
        expect(loaded).toEqual(created);

        // Spot-check the fields most likely to be lost in JSON/int coercion.
        expect(loaded!.attributes).toEqual({ might: 2, insight: 3, fortune: 1, charm: 2 });
        expect(loaded!.feuds).toEqual(['Blackwater Pavilion', 'cult-9']);
        expect(loaded!.cultivationProgress).toBeCloseTo(120.5);
        expect(loaded!.age).toBeCloseTo(19.5);
        expect(loaded!.yearsAtCurrentRealm).toBeCloseTo(2.25);
        expect(loaded!.alive).toBe(true);
        expect(loaded!.sectId).toBeNull();
        expect(loaded!.deathCause).toBeNull();
        expect(loaded!.location).toBe('Azure Cloud Sect outer courtyard');
    });

    it('returns null for a missing id instead of throwing', () => {
        expect(repo.getById('nobody')).toBeNull();
        expect(repo.update('nobody', { hp: 1 })).toBeNull();
        expect(repo.applyDeltas('nobody', { hp: -1 })).toBeNull();
        expect(repo.advanceRealm('nobody')).toBeNull();
        expect(repo.markDead('nobody', 'starvation', 3)).toBeNull();
        expect(repo.listInjuries('nobody')).toEqual([]);
        expect(repo.countUntreatedInjuries('nobody')).toBe(0);
        expect(repo.treatInjury('no-such-injury')).toBeNull();
    });

    it('round-trips a null location', () => {
        repo.create(sampleCultivator({ location: null }));
        expect(repo.getById('cult-1')!.location).toBeNull();

        // And defaults to null when the caller never mentions a location.
        const { location: _omitted, ...withoutLocation } = sampleCultivator({ id: 'cult-2' });
        repo.create(withoutLocation as CreateCultivatorInput);
        expect(repo.getById('cult-2')!.location).toBeNull();

        expect(repo.update('cult-1', { location: 'a nameless valley' })!.location)
            .toBe('a nameless valley');
        expect(repo.update('cult-1', { location: null })!.location).toBeNull();
    });

    it('lists with filters', () => {
        repo.create(sampleCultivator());
        repo.create(sampleCultivator({ id: 'cult-2', name: 'Elder Mo', kind: 'npc' }));

        expect(repo.list()).toHaveLength(2);
        expect(repo.list({ kind: 'npc' }).map(c => c.id)).toEqual(['cult-2']);
        expect(repo.list({ alive: true })).toHaveLength(2);
        expect(repo.list({ alive: false })).toHaveLength(0);
    });

    it('applies deltas and clamps to schema bounds', () => {
        repo.create(sampleCultivator());

        const hurt = repo.applyDeltas('cult-1', { hp: -100, qi: -5, satiety: -200, spiritStones: -1000 });
        expect(hurt!.hp).toBe(0);
        expect(hurt!.qi).toBe(7);
        expect(hurt!.satiety).toBe(0);
        expect(hurt!.spiritStones).toBe(0);

        const fed = repo.applyDeltas('cult-1', { hp: 999, satiety: 999, cultivationProgress: 10 });
        expect(fed!.hp).toBe(fed!.maxHp);
        expect(fed!.satiety).toBe(SATIETY_MAX);
        expect(fed!.cultivationProgress).toBeCloseTo(130.5);
    });

    it('advances realms, resetting progress and the stagnation clock', () => {
        repo.create(sampleCultivator({ yearsAtCurrentRealm: 40 }));

        const advanced = repo.advanceRealm('cult-1');
        expect(advanced!.realmOrdinal).toBe(5);
        expect(advanced!.cultivationProgress).toBe(0);
        expect(advanced!.yearsAtCurrentRealm).toBe(0);

        // Never past the top of the ladder.
        const capped = repo.advanceRealm('cult-1', 999);
        expect(capped!.realmOrdinal).toBe(MAX_ORDINAL);
    });

    describe('injuries', () => {
        beforeEach(() => {
            repo.create(sampleCultivator());
        });

        it('adds, counts, and treats individually', () => {
            const minor = repo.addInjury('cult-1', {
                severity: 'minor',
                source: 'combat',
                description: 'Bruised meridian in the left arm.',
                sustainedOnTurn: 4
            });
            const serious = repo.addInjury('cult-1', {
                severity: 'serious',
                source: 'failed_breakthrough',
                description: 'Torn dantian lining.',
                sustainedOnTurn: 9
            });

            expect(repo.countUntreatedInjuries('cult-1')).toBe(2);
            expect(repo.listInjuries('cult-1')).toHaveLength(2);
            // Ordered chronologically by the turn sustained.
            expect(repo.listInjuries('cult-1').map(i => i.id)).toEqual([minor.id, serious.id]);

            // Penalties come from the balance table, not the caller.
            expect(serious.cultivationPenalty).toBe(INJURY_WEIGHTS.serious.cultivationPenalty);
            expect(serious.breakthroughPenalty).toBe(INJURY_WEIGHTS.serious.breakthroughPenalty);

            const treated = repo.treatInjury(minor.id, 11);
            expect(treated!.treated).toBe(true);
            expect(repo.countUntreatedInjuries('cult-1')).toBe(1);
            expect(repo.listInjuries('cult-1', { untreatedOnly: true }).map(i => i.id)).toEqual([serious.id]);

            // Treating an already-treated injury reports the wasted pill.
            expect(repo.treatInjury(minor.id)).toBeNull();
        });

        it('surfaces injuries on the loaded cultivator', () => {
            repo.addInjury('cult-1', {
                severity: 'crippling',
                source: 'qi_deviation',
                description: 'Shattered heart meridian.',
                sustainedOnTurn: 2
            });

            const loaded = repo.getById('cult-1');
            expect(loaded!.injuries).toHaveLength(1);
            expect(loaded!.injuries[0].severity).toBe('crippling');
            expect(loaded!.injuries[0].cultivationPenalty)
                .toBe(INJURY_WEIGHTS.crippling.cultivationPenalty);
        });

        it('cascades injuries when the cultivator is deleted', () => {
            repo.addInjury('cult-1', {
                severity: 'minor',
                source: 'combat',
                description: 'Cracked rib.',
                sustainedOnTurn: 1
            });

            expect(repo.delete('cult-1')).toBe(true);
            const remaining = db
                .prepare('SELECT COUNT(*) AS n FROM cultivator_injuries')
                .get() as { n: number };
            expect(remaining.n).toBe(0);
        });
    });

    it('makes a dead cultivator terminal and immutable', () => {
        repo.create(sampleCultivator());

        const dead = repo.markDead('cult-1', 'untreated_injuries', 17);
        expect(dead!.alive).toBe(false);
        expect(dead!.deathCause).toBe('untreated_injuries');
        expect(dead!.diedOnTurn).toBe(17);

        // Death is one-way; the corpse rejects every further mutation.
        expect(() => repo.applyDeltas('cult-1', { hp: 5 })).toThrow(/dead/i);
        expect(() => repo.advanceRealm('cult-1')).toThrow(/dead/i);
        expect(() => repo.addInjury('cult-1', {
            severity: 'minor', source: 'combat', description: 'posthumous', sustainedOnTurn: 18
        })).toThrow(/dead/i);

        // markDead is idempotent rather than double-killing.
        const again = repo.markDead('cult-1', 'starvation', 99);
        expect(again!.deathCause).toBe('untreated_injuries');
        expect(again!.diedOnTurn).toBe(17);
    });
});

describe('CultivatorRepository.roster', () => {
    let db: Database.Database;
    let repo: CultivatorRepository;
    let sects: SectRepository;

    beforeEach(() => {
        db = makeDb();
        repo = new CultivatorRepository(db);
        sects = new SectRepository(db);
    });

    afterEach(() => db.close());

    it('is empty on an empty world', () => {
        expect(repo.roster()).toEqual([]);
    });

    it('returns the admin shape, joined to the sect', () => {
        const sect = sects.upsert(sampleSect());
        repo.create(sampleCultivator());
        sects.addMember(sect.id, 'cult-1', 2);
        repo.addInjury('cult-1', {
            severity: 'serious', source: 'combat',
            description: 'Cracked meridian.', sustainedOnTurn: 3
        });
        const treatable = repo.addInjury('cult-1', {
            severity: 'minor', source: 'poison',
            description: 'Lingering venom.', sustainedOnTurn: 4
        });
        repo.treatInjury(treatable.id, 5);

        const [entry] = repo.roster();
        expect(entry).toEqual({
            id: 'cult-1',
            name: 'Li Wei',
            kind: 'pc',
            spiritRoot: 'single_fire',
            realmOrdinal: 4,
            location: 'Azure Cloud Sect outer courtyard',
            sectId: sect.id,
            sectName: 'Azure Cloud Sect',
            sectRank: 'Core Disciple',
            age: 19.5,
            alive: true,
            deathCause: null,
            spiritStones: 145,
            untreatedInjuries: 1,
            feuds: ['Blackwater Pavilion', 'cult-9']
        });
    });

    it('includes unaffiliated cultivators with a null sect', () => {
        repo.create(sampleCultivator({ location: null }));

        const [entry] = repo.roster();
        expect(entry.sectId).toBeNull();
        expect(entry.sectName).toBeNull();
        expect(entry.sectRank).toBeNull();
        expect(entry.location).toBeNull();
        expect(entry.untreatedInjuries).toBe(0);
    });

    it('orders alive before dead, then realm descending, then name', () => {
        repo.create(sampleCultivator({ id: 'a', name: 'Zhao Min', realmOrdinal: 20 }));
        repo.create(sampleCultivator({ id: 'b', name: 'An Ling', realmOrdinal: 20 }));
        repo.create(sampleCultivator({ id: 'c', name: 'Peak Sovereign', realmOrdinal: 33 }));
        repo.create(sampleCultivator({ id: 'd', name: 'Weakling', realmOrdinal: 1 }));
        repo.create(sampleCultivator({ id: 'e', name: 'Fallen Elder', realmOrdinal: 41 }));

        repo.markDead('e', 'qi_deviation', 8);

        const roster = repo.roster();
        // Highest living rank first; the ordinal-41 corpse sinks to the bottom
        // despite outranking everyone.
        expect(roster.map(r => r.id)).toEqual(['c', 'b', 'a', 'd', 'e']);
        expect(roster.map(r => r.alive)).toEqual([true, true, true, true, false]);
        expect(roster[4].deathCause).toBe('qi_deviation');
    });

    it('counts untreated injuries per cultivator without cross-contamination', () => {
        repo.create(sampleCultivator({ id: 'hurt', name: 'Hurt', realmOrdinal: 9 }));
        repo.create(sampleCultivator({ id: 'whole', name: 'Whole', realmOrdinal: 8 }));

        for (const turn of [1, 2, 3]) {
            repo.addInjury('hurt', {
                severity: 'minor', source: 'combat',
                description: `Wound ${turn}.`, sustainedOnTurn: turn
            });
        }
        const treated = repo.addInjury('hurt', {
            severity: 'crippling', source: 'backlash',
            description: 'Shattered dantian.', sustainedOnTurn: 4
        });
        repo.treatInjury(treated.id, 5);

        const byId = Object.fromEntries(repo.roster().map(r => [r.id, r.untreatedInjuries]));
        expect(byId).toEqual({ hurt: 3, whole: 0 });
    });

    it('lists NPCs alongside the player', () => {
        repo.create(sampleCultivator({ id: 'pc', name: 'Player', kind: 'pc', realmOrdinal: 5 }));
        repo.create(sampleCultivator({ id: 'npc', name: 'Wandering Sword', kind: 'npc', realmOrdinal: 30 }));
        repo.create(sampleCultivator({ id: 'foe', name: 'Blood Demon', kind: 'enemy', realmOrdinal: 12 }));

        expect(repo.roster().map(r => r.kind)).toEqual(['npc', 'enemy', 'pc']);
    });
});

describe('RunRepository', () => {
    let db: Database.Database;
    let cultivators: CultivatorRepository;
    let runs: RunRepository;

    beforeEach(() => {
        db = makeDb();
        cultivators = new CultivatorRepository(db);
        runs = new RunRepository(db);
        cultivators.create(sampleCultivator());
    });

    afterEach(() => db.close());

    it('round-trips a run and binds it to the cultivator', () => {
        const run = runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 'seed-abc', startedAt: NOW });

        expect(runs.getById('run-1')).toEqual(run);
        expect(cultivators.getById('cult-1')!.runId).toBe('run-1');
        expect(runs.getActiveRun('cult-1')!.id).toBe('run-1');
        expect(runs.getActiveRun()!.id).toBe('run-1');
    });

    it('returns null for missing ids rather than throwing', () => {
        expect(runs.getById('nope')).toBeNull();
        expect(runs.getActiveRun('nobody')).toBeNull();
        expect(runs.incrementTurn('nope')).toBeNull();
        expect(runs.advanceDays('nope', 5)).toBeNull();
        expect(runs.endRun('nope', 'starvation', 'x')).toBeNull();
        expect(runs.deathLedger()).toEqual([]);
    });

    it('advances turns and fractional days', () => {
        runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 's' });

        expect(runs.incrementTurn('run-1')!.turn).toBe(1);
        expect(runs.incrementTurn('run-1', 4)!.turn).toBe(5);
        expect(runs.advanceDays('run-1', 3650.5)!.elapsedDays).toBeCloseTo(3650.5);
    });

    it('tracks the peak ordinal and never lowers it', () => {
        runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 's' });

        // advanceRealm stamps the peak through the run the cultivator is bound to.
        cultivators.advanceRealm('cult-1', 3);
        expect(runs.getById('run-1')!.peakOrdinal).toBe(7);

        expect(runs.updatePeakOrdinal('run-1', 2)!.peakOrdinal).toBe(7);
        expect(runs.updatePeakOrdinal('run-1', 12)!.peakOrdinal).toBe(12);
    });

    it('records the death in the ledger when the cultivator dies', () => {
        runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 's' });
        runs.incrementTurn('run-1', 40);

        cultivators.markDead('cult-1', 'heavenly_tribulation', 41, 'The ninth bolt found him.');

        const run = runs.getById('run-1')!;
        expect(run.status).toBe('dead');
        expect(run.deathCause).toBe('heavenly_tribulation');
        expect(run.deathDescription).toBe('The ninth bolt found him.');
        expect(run.endedAt).not.toBeNull();
        expect(run.turn).toBe(41);

        // A closed run is closed for good.
        expect(runs.endRun('run-1', 'starvation', 'later')).toBeNull();
        expect(runs.getActiveRun('cult-1')).toBeNull();
    });

    it('returns finished runs newest-first in the death ledger', () => {
        cultivators.create(sampleCultivator({ id: 'cult-2', name: 'Sister Yan' }));

        runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 's1', startedAt: NOW });
        runs.endRun('run-1', 'starvation', 'Ate the last of the grain in year three.');

        runs.startRun({ id: 'run-2', cultivatorId: 'cult-2', seed: 's2', startedAt: NOW });
        runs.endRun('run-2', 'qi_deviation', 'Pushed the circulation one cycle too far.');

        // An active run is not yet part of the ledger.
        cultivators.create(sampleCultivator({ id: 'cult-3', name: 'Junior Brother Tan' }));
        runs.startRun({ id: 'run-3', cultivatorId: 'cult-3', seed: 's3' });

        const ledger = runs.deathLedger(10);
        expect(ledger.map(r => r.id)).toEqual(['run-2', 'run-1']);
        expect(ledger.map(r => r.deathCause)).toEqual(['qi_deviation', 'starvation']);
        expect(runs.deathLedger(1)).toHaveLength(1);
    });

    it('cascades runs when the cultivator is deleted', () => {
        runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 's' });
        cultivators.delete('cult-1');
        expect(runs.getById('run-1')).toBeNull();
    });
});

describe('TechniqueRepository', () => {
    let db: Database.Database;
    let cultivators: CultivatorRepository;
    let techniques: TechniqueRepository;

    beforeEach(() => {
        db = makeDb();
        cultivators = new CultivatorRepository(db);
        techniques = new TechniqueRepository(db);
        cultivators.create(sampleCultivator());
    });

    afterEach(() => db.close());

    it('round-trips a technique through the catalog', () => {
        const tech = sampleTechnique();
        expect(techniques.upsert(tech)).toEqual(tech);
        expect(techniques.getById(tech.id)).toEqual(tech);

        // Re-seeding is a no-op update, not a duplicate-key crash.
        expect(() => techniques.upsert({ ...tech, qiCost: 9 })).not.toThrow();
        expect(techniques.getById(tech.id)!.qiCost).toBe(9);
    });

    it('round-trips an elementless technique with null damage', () => {
        const tech = sampleTechnique({
            id: 'tech-still-mind',
            name: 'Still Mind Manual',
            category: 'cultivation',
            element: null,
            damage: null,
            cooldown: 0
        });
        techniques.upsert(tech);
        const loaded = techniques.getById(tech.id)!;
        expect(loaded.element).toBeNull();
        expect(loaded.damage).toBeNull();
    });

    it('returns null for unknown ids', () => {
        expect(techniques.getById('nope')).toBeNull();
        expect(techniques.learn('cult-1', 'nope')).toBeNull();
        expect(techniques.getKnown('cult-1', 'nope')).toBeNull();
        expect(techniques.setMastery('cult-1', 'nope', 0.5)).toBeNull();
        expect(techniques.addMastery('cult-1', 'nope', 0.5)).toBeNull();
        expect(techniques.markUsed('cult-1', 'nope', 1)).toBeNull();
        expect(techniques.listKnown('cult-1')).toEqual([]);
    });

    it('filters the catalog by category, grade, and required ordinal', () => {
        techniques.upsert(sampleTechnique());
        techniques.upsert(sampleTechnique({
            id: 'tech-cloud-step', name: 'Cloud Step', category: 'movement',
            grade: 'mortal', element: null, requiredOrdinal: 0, damage: null
        }));

        expect(techniques.list({ category: 'movement' }).map(t => t.id)).toEqual(['tech-cloud-step']);
        expect(techniques.list({ grade: 'earth' }).map(t => t.id)).toEqual(['tech-flame-palm']);
        expect(techniques.list({ maxRequiredOrdinal: 0 }).map(t => t.id)).toEqual(['tech-cloud-step']);
        expect(techniques.list()).toHaveLength(2);
    });

    it('tracks per-cultivator mastery, cooldowns, and the known-id mirror', () => {
        const tech = sampleTechnique();
        techniques.upsert(tech);

        const known = techniques.learn('cult-1', tech.id, 0.2)!;
        expect(known.mastery).toBeCloseTo(0.2);
        expect(known.cooldownRemaining).toBe(0);
        expect(techniques.knows('cult-1', tech.id)).toBe(true);
        expect(cultivators.getById('cult-1')!.knownTechniques).toEqual([tech.id]);

        // Re-learning never demotes what was already understood.
        expect(techniques.learn('cult-1', tech.id, 0.05)!.mastery).toBeCloseTo(0.2);

        expect(techniques.addMastery('cult-1', tech.id, 0.5)!.mastery).toBeCloseTo(0.7);
        expect(techniques.addMastery('cult-1', tech.id, 5)!.mastery).toBe(1);
        expect(techniques.setMastery('cult-1', tech.id, -3)!.mastery).toBe(0);

        const used = techniques.markUsed('cult-1', tech.id, 12)!;
        expect(used.cooldownRemaining).toBe(tech.cooldown);
        expect(used.lastUsedTurn).toBe(12);

        techniques.tickCooldowns('cult-1', 2);
        expect(techniques.getKnown('cult-1', tech.id)!.cooldownRemaining).toBe(1);
        techniques.tickCooldowns('cult-1', 99);
        expect(techniques.getKnown('cult-1', tech.id)!.cooldownRemaining).toBe(0);

        expect(techniques.forget('cult-1', tech.id)).toBe(true);
        expect(techniques.knows('cult-1', tech.id)).toBe(false);
        expect(cultivators.getById('cult-1')!.knownTechniques).toEqual([]);
    });

    it('cascades known techniques from both sides', () => {
        const tech = sampleTechnique();
        techniques.upsert(tech);
        techniques.learn('cult-1', tech.id);

        techniques.delete(tech.id);
        expect(techniques.listKnown('cult-1')).toEqual([]);

        techniques.upsert(tech);
        techniques.learn('cult-1', tech.id);
        cultivators.delete('cult-1');
        const rows = db
            .prepare('SELECT COUNT(*) AS n FROM cultivator_techniques')
            .get() as { n: number };
        expect(rows.n).toBe(0);
    });
});

describe('SectRepository', () => {
    let db: Database.Database;
    let cultivators: CultivatorRepository;
    let sects: SectRepository;

    beforeEach(() => {
        db = makeDb();
        cultivators = new CultivatorRepository(db);
        sects = new SectRepository(db);
        cultivators.create(sampleCultivator());
    });

    afterEach(() => db.close());

    it('round-trips a sect', () => {
        const sect = sampleSect();
        expect(sects.upsert(sect)).toEqual(sect);
        expect(sects.getById(sect.id)).toEqual(sect);
        expect(sects.list().map(s => s.id)).toEqual([sect.id]);
    });

    it('returns null for unknown ids', () => {
        expect(sects.getById('nope')).toBeNull();
        expect(sects.addMember('nope', 'cult-1')).toBeNull();
        expect(sects.setRank('nope', 'cult-1', 1)).toBeNull();
        expect(sects.getMembership('cult-1')).toBeNull();
        expect(sects.listMembers('nope')).toEqual([]);
        expect(sects.stipendForRank('nope', 0)).toBe(0);
        expect(sects.stipendForCultivator('cult-1')).toBe(0);
    });

    it('enrols, promotes, and mirrors rank onto the cultivator', () => {
        const sect = sects.upsert(sampleSect());

        const membership = sects.addMember(sect.id, 'cult-1')!;
        expect(membership.rankIndex).toBe(0);
        expect(membership.rankTitle).toBe('Outer Disciple');

        let cultivator = cultivators.getById('cult-1')!;
        expect(cultivator.sectId).toBe(sect.id);
        expect(cultivator.sectRank).toBe('Outer Disciple');
        expect(sects.stipendForCultivator('cult-1')).toBe(5);

        const promoted = sects.setRank(sect.id, 'cult-1', 2)!;
        expect(promoted.rankTitle).toBe('Core Disciple');
        expect(sects.stipendForCultivator('cult-1')).toBe(40);

        // Ranks beyond the sect's own list clamp to the top rather than crash.
        expect(sects.setRank(sect.id, 'cult-1', 99)!.rankTitle).toBe('Elder');

        expect(sects.addContribution(sect.id, 'cult-1', 250)!.contribution).toBe(250);
        expect(sects.addContribution(sect.id, 'cult-1', -1000)!.contribution).toBe(0);

        expect(sects.removeMember(sect.id, 'cult-1')).toBe(true);
        cultivator = cultivators.getById('cult-1')!;
        expect(cultivator.sectId).toBeNull();
        expect(cultivator.sectRank).toBeNull();
        expect(sects.getMembership('cult-1')).toBeNull();
    });

    it('treats joining a second sect as defection, not dual membership', () => {
        const azure = sects.upsert(sampleSect());
        const black = sects.upsert(sampleSect({
            id: 'sect-black', name: 'Blackwater Pavilion', alignment: 'demonic'
        }));

        sects.addMember(azure.id, 'cult-1', 1);
        const defected = sects.addMember(black.id, 'cult-1', 0)!;

        expect(defected.sectId).toBe(black.id);
        expect(sects.listMembers(azure.id)).toEqual([]);
        expect(sects.listMembers(black.id)).toHaveLength(1);
        expect(cultivators.getById('cult-1')!.sectId).toBe(black.id);
    });

    it('nulls the cultivator sect_id when the sect is disbanded', () => {
        const sect = sects.upsert(sampleSect());
        sects.addMember(sect.id, 'cult-1');

        expect(sects.delete(sect.id)).toBe(true);
        expect(sects.getMembership('cult-1')).toBeNull();
        // ON DELETE SET NULL: the disciple survives their sect.
        expect(cultivators.getById('cult-1')!.sectId).toBeNull();
    });

    it('cascades membership when the cultivator is deleted', () => {
        const sect = sects.upsert(sampleSect());
        sects.addMember(sect.id, 'cult-1');

        cultivators.delete('cult-1');
        expect(sects.listMembers(sect.id)).toEqual([]);
    });
});

describe('cross-repo persistence', () => {
    it('keeps a full cultivator coherent across every repo', () => {
        const db = makeDb();
        const cultivators = new CultivatorRepository(db);
        const runs = new RunRepository(db);
        const techniques = new TechniqueRepository(db);
        const sects = new SectRepository(db);

        cultivators.create(sampleCultivator());
        runs.startRun({ id: 'run-1', cultivatorId: 'cult-1', seed: 'deterministic' });
        const sect = sects.upsert(sampleSect());
        sects.addMember(sect.id, 'cult-1', 1);
        const tech = techniques.upsert(sampleTechnique());
        techniques.learn('cult-1', tech.id, 0.4);
        cultivators.addInjury('cult-1', {
            severity: 'serious', source: 'tribulation',
            description: 'Scorched meridians.', sustainedOnTurn: 6
        });

        const loaded = cultivators.getById('cult-1') as Cultivator;
        expect(loaded.runId).toBe('run-1');
        expect(loaded.sectId).toBe(sect.id);
        expect(loaded.sectRank).toBe('Inner Disciple');
        expect(loaded.knownTechniques).toEqual([tech.id]);
        expect(loaded.injuries).toHaveLength(1);

        cultivators.markDead('cult-1', 'heavenly_tribulation', 6, 'Tribulation lightning, ninth bolt.');

        const ledger = runs.deathLedger();
        expect(ledger).toHaveLength(1);
        expect(ledger[0].deathCause).toBe('heavenly_tribulation');
        expect(ledger[0].peakOrdinal).toBe(0);

        db.close();
    });
});
