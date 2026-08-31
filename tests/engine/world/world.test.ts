import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { migrate } from '../../../src/storage/migrations.js';
import { migrateWorld } from '../../../src/storage/migrations.world.js';
import {
    addItem,
    adjustResource,
    createWorld,
    currentYear,
    dateOf,
    getActor,
    getNpc,
    lineageOf,
    makeActor,
    makeFaction,
    moveActor,
    npcsAt,
    pendingEffects,
    recordEvent,
    removeItem,
    schedule,
    setActorFaction,
    startProcess,
    upsertActor,
    upsertFaction,
    upsertLineage,
    upsertNpc,
    worldSnapshot
} from '../../../src/engine/world/world-state.js';
import { advanceTime, advanceYears, scheduleConcurrentEvent } from '../../../src/engine/world/time.js';
import {
    createNpc,
    addGoal,
    activeGoals,
    ageInYears,
    inheritGoals,
    isUnadjudicated,
    legacyGoals,
    markMissing,
    npcBrief,
    setExistence,
    setRealm,
    updateGoal,
    upsertRelationship
} from '../../../src/engine/world/npc-state.js';
import {
    addLineageEdge,
    createLineageRecord,
    descendantsOf,
    generationOf,
    heirsOf,
    settleInheritance,
    traitsFor
} from '../../../src/engine/world/lineage.js';
import {
    claimOpportunity,
    daysUntilNextWindow,
    isOpportunityOpen,
    makeOpportunity,
    missedWindowsFor,
    nextWindow,
    queryOpportunities,
    revealTo,
    upcoming,
    windowsBetween,
    years
} from '../../../src/engine/world/opportunities.js';
import {
    applyCompression,
    createMemoryStore,
    memoryCount,
    ownersNeedingCompression,
    planCompression,
    recallAbout,
    rememberFact,
    searchMemories,
    storeMemory,
    unsupportedMemories
} from '../../../src/engine/world/memory.js';
import {
    assertClaim,
    describeObject,
    isDisputed,
    isStolen,
    knowsOwnership,
    lastTheft,
    makeObject,
    makeResourceLot,
    queryObjects,
    revealOwnership,
    setOwnership,
    transferPossession
} from '../../../src/engine/world/possessions.js';
import {
    cultivationContext,
    makeLocation,
    makeThresholds
} from '../../../src/engine/world/locations.js';
import { makeFact, queryFacts, degradeFidelity } from '../../../src/engine/world/history.js';

const YEAR = 365;

// ─────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────

/**
 * These run the FULL `migrate(db)`, not `migrateWorld(db)` alone.
 *
 * That distinction is the entire reason this block exists. Every statement in
 * every migration is `CREATE TABLE IF NOT EXISTS`, so a table name that
 * collides with one an earlier migration already created does not error - the
 * second definition silently no-ops, the loser's columns never exist, and the
 * failure surfaces hundreds of lines later as `no such column` on a table that
 * looks perfectly fine.
 *
 * Testing `migrateWorld` standalone against a fresh database is exactly the
 * arrangement in which that bug is invisible, and it shipped one: this module's
 * `worlds` collided with the base schema's, and its `world_facts` collided with
 * the social layer's. Both are renamed (`world_runtime`, `world_chronicle`) and
 * the guard below is what keeps the next one from getting out.
 */
describe('world persistence: the full migration chain', () => {
    function migrated() {
        const db = new Database(':memory:');
        migrate(db);
        return db;
    }

    function tablesOf(db: Database.Database): Set<string> {
        return new Set(
            (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
                .map(r => r.name)
        );
    }

    function columnsOf(db: Database.Database, table: string): Set<string> {
        return new Set(
            (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
        );
    }

    const WORLD_TABLES = [
        'world_runtime', 'world_eras', 'world_chronicle', 'world_chronicle_actors',
        'world_locations', 'world_location_changes', 'world_factions',
        'world_npcs', 'world_npc_goals', 'world_relationships',
        'world_actors', 'world_actor_inventory', 'world_memories',
        'world_memory_actors', 'world_scheduled_effects', 'world_processes',
        'world_lineages', 'world_lineage_edges', 'world_opportunities',
        'world_objects', 'world_object_claims', 'world_object_provenance'
    ];

    it('creates every world table when run after the whole chain', () => {
        const db = migrated();
        const tables = tablesOf(db);
        for (const t of WORLD_TABLES) {
            expect(tables.has(t), `missing table ${t}`).toBe(true);
        }
        db.close();
    });

    it('collides with nothing the other migrations create', () => {
        // Everything this module owns must survive a full migrate with its own
        // columns intact. A collision shows up here as a missing column rather
        // than as a missing table, which is precisely how it hid last time.
        const full = migrated();
        const standalone = new Database(':memory:');
        migrateWorld(standalone);

        for (const table of WORLD_TABLES) {
            const inChain = columnsOf(full, table);
            const alone = columnsOf(standalone, table);
            expect(
                [...alone].filter(c => !inChain.has(c)),
                `${table} lost columns when run after the other migrations`
            ).toEqual([]);
        }

        // And the tables this module deliberately does NOT own are still the
        // other owners' shape.
        expect(columnsOf(full, 'worlds').has('width')).toBe(true);        // base schema
        expect(columnsOf(full, 'worlds').has('current_day')).toBe(false);
        expect(columnsOf(full, 'world_facts').has('claim_key')).toBe(true); // social layer
        expect(columnsOf(full, 'world_facts').has('near_miss')).toBe(false);

        full.close();
        standalone.close();
    });

    it('is idempotent across repeated startups', () => {
        const db = migrated();
        migrate(db);
        migrate(db);
        const tables = tablesOf(db);
        for (const t of WORLD_TABLES) expect(tables.has(t), `missing table ${t}`).toBe(true);
        db.close();
    });

    it('holds the columns the engine actually writes', () => {
        const db = migrated();

        const chronicle = columnsOf(db, 'world_chronicle');
        for (const c of ['truth', 'claimed_outcomes', 'near_miss', 'near_miss_note', 'fidelity', 'cause_known']) {
            expect(chronicle.has(c), `world_chronicle.${c}`).toBe(true);
        }
        const eras = columnsOf(db, 'world_eras');
        expect(eras.has('qi_density')).toBe(true);
        expect(eras.has('ash_density')).toBe(false);

        const locations = columnsOf(db, 'world_locations');
        for (const c of [
            'threshold_entry', 'threshold_survival', 'threshold_operational', 'threshold_mastery',
            'qi_density', 'origin_qi_density',
            'env_spiritual_density', 'env_danger', 'env_special_rules', 'origin_environment'
        ]) {
            expect(locations.has(c), `world_locations.${c}`).toBe(true);
        }
        const npcs = columnsOf(db, 'world_npcs');
        for (const c of ['status', 'body_id', 'soul_state', 'identity_continuity', 'lifespan_ends_on_day']) {
            expect(npcs.has(c), `world_npcs.${c}`).toBe(true);
        }
        const goals = columnsOf(db, 'world_npc_goals');
        for (const c of ['progress', 'obstacles', 'deadline_on_day', 'inherited_from_id', 'origin_holder_id', 'generation']) {
            expect(goals.has(c), `world_npc_goals.${c}`).toBe(true);
        }
        db.close();
    });

    /**
     * The read/write exercise the coordinator asked for. There is no repository
     * layer for these tables yet, so this drives the statements a repository
     * would issue: the writes each table exists to take, and the indexed reads
     * each index exists to serve.
     */
    it('takes the writes and serves the reads the engine will make', () => {
        const db = migrated();
        db.pragma('foreign_keys = ON');

        db.prepare('INSERT INTO world_runtime (id, seed, current_day) VALUES (?, ?, ?)')
            .run('w1', 'seed', 1000 * YEAR);
        db.prepare('INSERT INTO world_eras (id, world_id, name, start_day, qi_density) VALUES (?,?,?,?,?)')
            .run('era-0', 'w1', 'the present age', 1000 * YEAR, 0.34);

        // A chronicle row the engine itself cannot answer.
        db.prepare(
            `INSERT INTO world_chronicle (id, world_id, day, kind, summary, truth, claimed_outcomes, cause_known)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        ).run('f1', 'w1', 430 * YEAR, 'faction_fallen', 'They stopped being there.', 'unresolved',
            JSON.stringify(['destroyed', 'ascended']));
        db.prepare(
            `INSERT INTO world_chronicle (id, world_id, day, kind, summary, near_miss, near_miss_note)
             VALUES (?, ?, ?, ?, ?, 1, ?)`
        ).run('f2', 'w1', 900 * YEAR, 'war', 'Nearly held the continent.', 'Their patriarch died.');
        db.prepare('INSERT INTO world_chronicle_actors (world_id, fact_id, actor_id, role) VALUES (?,?,?,?)')
            .run('w1', 'f1', 'npc-1', 'founder');

        const unresolved = db
            .prepare("SELECT id FROM world_chronicle WHERE world_id = ? AND truth = 'unresolved'")
            .all('w1') as { id: string }[];
        expect(unresolved.map(r => r.id)).toEqual(['f1']);
        const nearMiss = db
            .prepare('SELECT id FROM world_chronicle WHERE world_id = ? AND near_miss = 1')
            .all('w1') as { id: string }[];
        expect(nearMiss.map(r => r.id)).toEqual(['f2']);
        const byActor = db
            .prepare('SELECT fact_id FROM world_chronicle_actors WHERE world_id = ? AND actor_id = ?')
            .all('w1', 'npc-1') as { fact_id: string }[];
        expect(byActor.map(r => r.fact_id)).toEqual(['f1']);

        // A place, its layered history, and the environment that decides what
        // ten years here is worth.
        db.prepare(
            `INSERT INTO world_locations
             (id, world_id, name, kind, qi_density, env_spiritual_density, threshold_survival, origin_qi_density)
             VALUES (?,?,?,?,?,?,?,?)`
        ).run('loc-1', 'w1', 'the sealed compound at Coldfall', 'ruin', 0.95, 0.05, 21, 0.4);
        db.prepare(
            `INSERT INTO world_location_changes
             (id, world_id, location_id, on_day, kind, summary, cause_known)
             VALUES (?,?,?,?,?,?,0)`
        ).run('loc-1-c1', 'w1', 'loc-1', 800 * YEAR, 'sealed', 'Sealed from the inside.');
        const unexplained = db
            .prepare('SELECT id FROM world_location_changes WHERE world_id = ? AND location_id = ? AND cause_known = 0')
            .all('w1', 'loc-1') as { id: string }[];
        expect(unexplained.map(r => r.id)).toEqual(['loc-1-c1']);

        // An NPC whose lifespan is a stored date, and a goal that outlives them.
        db.prepare(
            `INSERT INTO world_npcs
             (id, world_id, name, born_on_day, spirit_root, lifespan_ends_on_day, status, soul_state)
             VALUES (?,?,?,?,?,?,?,?)`
        ).run('npc-1', 'w1', 'Yun Cishan', 940 * YEAR, 'single_fire', 1040 * YEAR, 'alive', 'intact');
        db.prepare(
            `INSERT INTO world_npc_goals
             (id, world_id, npc_id, kind, text, priority, progress, obstacles, opened_on_day, origin_holder_id, generation)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).run('npc-1-g1', 'w1', 'npc-1', 'revenge', 'Avenge a father.', 0.9,
            "Has identified the killer's faction.", JSON.stringify(['Insufficient strength.']),
            970 * YEAR, 'npc-1', 0);

        // The indexed "who is due to die" scan the time advance runs.
        const due = db
            .prepare("SELECT id FROM world_npcs WHERE world_id = ? AND status = 'alive' AND lifespan_ends_on_day <= ?")
            .all('w1', 1100 * YEAR) as { id: string }[];
        expect(due.map(r => r.id)).toEqual(['npc-1']);

        // Lineage, so the estate has somewhere to go.
        db.prepare('INSERT INTO world_lineages (id, world_id, surname, founder_id, founded_on_day) VALUES (?,?,?,?,?)')
            .run('lin-1', 'w1', 'Yun', 'npc-1', 940 * YEAR);
        db.prepare(
            `INSERT INTO world_lineage_edges (world_id, lineage_id, parent_id, child_id, relation, on_day)
             VALUES (?,?,?,?,?,?)`
        ).run('w1', 'lin-1', 'npc-1', 'npc-2', 'descendant', 990 * YEAR);
        const heirs = db
            .prepare('SELECT child_id FROM world_lineage_edges WHERE world_id = ? AND parent_id = ?')
            .all('w1', 'npc-1') as { child_id: string }[];
        expect(heirs.map(r => r.child_id)).toEqual(['npc-2']);

        // The schedule, and the window query the advance actually issues.
        db.prepare(
            `INSERT INTO world_scheduled_effects (id, world_id, kind, due_on_day, summary, chance)
             VALUES (?,?,?,?,?,?)`
        ).run('e1', 'w1', 'debt_due', 1005 * YEAR, 'The debt fell due.', 1);
        const pending = db
            .prepare('SELECT id FROM world_scheduled_effects WHERE world_id = ? AND fired = 0 AND due_on_day > ? AND due_on_day <= ? ORDER BY due_on_day, id')
            .all('w1', 1000 * YEAR, 1010 * YEAR) as { id: string }[];
        expect(pending.map(r => r.id)).toEqual(['e1']);

        // Memory, and the by-owner-by-salience read a prompt build issues.
        db.prepare(
            `INSERT INTO world_memories (id, world_id, owner_id, kind, summary, on_day, salience)
             VALUES (?,?,?,?,?,?,?)`
        ).run('m1', 'w1', 'npc-1', 'betrayal', 'Bai Shuqing opened the gate.', 980 * YEAR, 0.9);
        db.prepare('INSERT INTO world_memory_actors (world_id, memory_id, actor_id) VALUES (?,?,?)')
            .run('w1', 'm1', 'npc-2');
        const recalled = db
            .prepare('SELECT m.id FROM world_memories m JOIN world_memory_actors a ON a.memory_id = m.id WHERE m.world_id = ? AND m.owner_id = ? AND a.actor_id = ? ORDER BY m.salience DESC')
            .all('w1', 'npc-1', 'npc-2') as { id: string }[];
        expect(recalled.map(r => r.id)).toEqual(['m1']);

        // An object whose possession, ownership, claim and provenance disagree.
        db.prepare(
            `INSERT INTO world_objects (id, world_id, name, kind, possessor_id, owner_id)
             VALUES (?,?,?,?,?,?)`
        ).run('obj-1', 'w1', 'the Ninefold sword', 'artifact', 'npc-2', 'npc-1');
        db.prepare(
            `INSERT INTO world_object_claims (id, world_id, object_id, claimant_id, basis, asserted_on_day)
             VALUES (?,?,?,?,?,?)`
        ).run('obj-1-cl1', 'w1', 'obj-1', 'npc-9', 'ancestral', 1000 * YEAR);
        db.prepare(
            `INSERT INTO world_object_provenance (world_id, object_id, seq, on_day, holder_id, how, source)
             VALUES (?,?,?,?,?,?,?)`
        ).run('w1', 'obj-1', 1, 995 * YEAR, 'npc-2', 'stolen', 'taken on the Coldfall road');
        const stolen = db
            .prepare("SELECT object_id FROM world_object_provenance WHERE world_id = ? AND how = 'stolen'")
            .all('w1') as { object_id: string }[];
        expect(stolen.map(r => r.object_id)).toEqual(['obj-1']);

        // An opportunity nobody knows about, on an eighty-year cycle.
        db.prepare(
            `INSERT INTO world_opportunities (id, world_id, kind, name, opens_on_day, duration_days, recurrence_days)
             VALUES (?,?,?,?,?,?,?)`
        ).run('opp-1', 'w1', 'realm_opening', 'the seam under Stillshelf', 1010 * YEAR, 30, 80 * YEAR);
        const live = db
            .prepare('SELECT id FROM world_opportunities WHERE world_id = ? AND claimed = 0 ORDER BY opens_on_day')
            .all('w1') as { id: string }[];
        expect(live.map(r => r.id)).toEqual(['opp-1']);

        db.close();
    });

    it('cascades a world delete through every child table', () => {
        const db = migrated();
        db.pragma('foreign_keys = ON');
        db.prepare('INSERT INTO world_runtime (id, seed) VALUES (?, ?)').run('w1', 'seed');
        db.prepare('INSERT INTO world_chronicle (id, world_id, day, kind, summary) VALUES (?,?,?,?,?)')
            .run('f1', 'w1', 1, 'death', 'x');
        db.prepare('INSERT INTO world_memories (id, world_id, owner_id, kind, summary, on_day) VALUES (?,?,?,?,?,?)')
            .run('m1', 'w1', 'npc-1', 'debt', 'x', 1);
        db.prepare('INSERT INTO world_lineages (id, world_id, surname, founder_id, founded_on_day) VALUES (?,?,?,?,?)')
            .run('lin-1', 'w1', 'Yun', 'npc-1', 0);

        db.prepare('DELETE FROM world_runtime WHERE id = ?').run('w1');
        expect(db.prepare('SELECT COUNT(*) AS n FROM world_chronicle').get()).toEqual({ n: 0 });
        expect(db.prepare('SELECT COUNT(*) AS n FROM world_memories').get()).toEqual({ n: 0 });
        expect(db.prepare('SELECT COUNT(*) AS n FROM world_lineages').get()).toEqual({ n: 0 });
        db.close();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WORLD STATE
// ─────────────────────────────────────────────────────────────────────────

describe('world state: the authoritative store', () => {
    it('creates a world with a past and is deterministic for a seed', () => {
        const a = createWorld({ seed: 'w-alpha', presentYear: 1000 });
        const b = createWorld({ seed: 'w-alpha', presentYear: 1000 });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(JSON.stringify(createWorld({ seed: 'w-beta', presentYear: 1000 }))).not.toBe(JSON.stringify(a));

        expect(currentYear(a)).toBe(1000);
        expect(a.history.facts.length).toBeGreaterThan(0);
        expect(a.locations.some(l => l.kind === 'ruin')).toBe(true);
        expect(a.locations.some(l => l.kind === 'region')).toBe(true);
    });

    it('tracks location, faction, inventory and resources as hard state', () => {
        let world = createWorld({ seed: 'w-1', skipPriorAges: true, regionCount: 2 });
        world = upsertActor(world, makeActor({ actorId: 'pc', locationId: 'loc-region-0' }));
        world = upsertFaction(world, makeFaction({ id: 'fac-1', name: 'Cold Kiln Hall' }));

        world = moveActor(world, 'pc', 'loc-region-1').state;
        expect(getActor(world, 'pc')!.locationId).toBe('loc-region-1');

        world = setActorFaction(world, 'pc', 'fac-1', 2).state;
        expect(getActor(world, 'pc')!.factionRankIndex).toBe(2);

        world = adjustResource(world, 'pc', 'spirit_stones', 500).state;
        world = adjustResource(world, 'pc', 'spirit_stones', -120).state;
        expect(getActor(world, 'pc')!.resources.spirit_stones).toBe(380);
        // Resources clamp at zero. A debt is a scheduled effect, not a negative.
        world = adjustResource(world, 'pc', 'spirit_stones', -9999).state;
        expect(getActor(world, 'pc')!.resources.spirit_stones).toBe(0);

        world = addItem(world, 'pc', { itemId: 'pill-1', name: 'Meridian Knitting Pill', kind: 'pill', quantity: 3, note: '' }).state;
        world = removeItem(world, 'pc', 'pill-1', 2).state;
        expect(getActor(world, 'pc')!.inventory[0].quantity).toBe(1);
        world = removeItem(world, 'pc', 'pill-1', 5).state;
        expect(getActor(world, 'pc')!.inventory).toHaveLength(0);
    });

    it('records an event and links it to everyone it happened to', () => {
        let world = createWorld({ seed: 'w-2', skipPriorAges: true });
        world = upsertNpc(world, createNpc('w-2', { id: 'npc-1', bornOnDay: 0, onDay: 0 }));
        world = upsertActor(world, makeActor({ actorId: 'pc' }));

        const out = recordEvent(world, makeFact({
            day: 100,
            kind: 'betrayal',
            summary: 'The gate was opened from inside.',
            actors: [{ id: 'npc-1', name: 'Yun Cishan', role: 'betrayer' }],
            witnessIds: ['pc']
        }));
        world = out.state;

        expect(getNpc(world, 'npc-1')!.historyFactIds).toContain(out.fact.id);
        expect(getActor(world, 'pc')!.historyFactIds).toContain(out.fact.id);
        expect(out.warnings).toHaveLength(0);   // no consequences claimed, none demanded
    });

    it('builds a snapshot scoped to one actor', () => {
        let world = createWorld({ seed: 'w-3', skipPriorAges: true, regionCount: 1 });
        world = upsertFaction(world, makeFaction({ id: 'fac-1', name: 'Salt Bell Court' }));
        world = upsertActor(world, makeActor({
            actorId: 'pc', locationId: 'loc-region-0', factionId: 'fac-1', factionRankIndex: 3,
            resources: { spirit_stones: 40 }
        }));
        world = upsertNpc(world, {
            ...createNpc('w-3', { id: 'npc-1', bornOnDay: 0, onDay: 0 }),
            locationId: 'loc-region-0'
        });

        const snap = worldSnapshot(world, 'pc');
        expect(snap.location!.id).toBe('loc-region-0');
        expect(snap.actor!.factionRank).toBe('Elder');
        expect(snap.presentNpcs.map(n => n.id)).toEqual(['npc-1']);
        expect(npcsAt(world, 'loc-region-0')).toHaveLength(1);
    });

    it('derives the date from one clock', () => {
        const world = createWorld({ seed: 'w-4', skipPriorAges: true, presentYear: 500 });
        expect(dateOf(world).year).toBe(500);
        expect(dateOf(world).dayOfYear).toBe(0);
        expect(dateOf(world, 500 * YEAR + 40).dayOfYear).toBe(40);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// TIME
// ─────────────────────────────────────────────────────────────────────────

describe('time: advancing the clock', () => {
    function seclusionWorld() {
        let world = createWorld({ seed: 'time-1', skipPriorAges: true, regionCount: 2, presentYear: 0 });
        world = upsertActor(world, makeActor({ actorId: 'pc', locationId: 'loc-region-0' }));
        return world;
    }

    it('moves the date and reports the span', () => {
        const out = advanceYears(seclusionWorld(), 30);
        expect(out.daysAdvanced).toBe(30 * YEAR);
        expect(out.state.currentDay).toBe(30 * YEAR);
        expect(out.digest.yearsAdvanced).toBeCloseTo(30, 4);
        expect(out.digest.headline).toContain('30');
    });

    it('applies a durable process as a rate times a span, not a per-day loop', () => {
        let world = seclusionWorld();
        world = startProcess(world, {
            actorId: 'pc',
            kind: 'seclusion',
            perDay: { cultivation_progress: 1.4, spirit_stones: -0.2 }
        }).state;
        world = adjustResource(world, 'pc', 'spirit_stones', 5000).state;

        const out = advanceYears(world, 10);
        const actor = getActor(out.state, 'pc')!;
        expect(actor.resources.cultivation_progress).toBeCloseTo(1.4 * 10 * YEAR, 6);
        expect(actor.resources.spirit_stones).toBeCloseTo(5000 - 0.2 * 10 * YEAR, 6);
        expect(out.processOutcomes).toHaveLength(1);
        expect(out.processOutcomes[0].days).toBe(10 * YEAR);
    });

    it('is decomposable: ten years then twenty equals thirty', () => {
        let world = seclusionWorld();
        world = startProcess(world, { actorId: 'pc', kind: 'cultivating', perDay: { progress: 1 } }).state;
        world = scheduleConcurrentEvent(world, {
            onDay: 12 * YEAR, summary: 'A war two provinces over resolved.', chance: 0.5
        }).state;

        const single = advanceYears(world, 30).state;
        const split = advanceYears(advanceYears(world, 10).state, 20).state;

        expect(split.currentDay).toBe(single.currentDay);
        expect(JSON.stringify(split.actors)).toBe(JSON.stringify(single.actors));
        expect(split.history.facts.map(f => f.summary)).toEqual(single.history.facts.map(f => f.summary));
    });

    it('costs the same for a century as for a decade when the books are empty', () => {
        const world = seclusionWorld();
        const short = advanceYears(world, 10);
        const long = advanceYears(world, 500);
        expect(long.fired).toHaveLength(short.fired.length);
        expect(long.state.currentDay).toBe(500 * YEAR);
    });

    it('fires scheduled consequences in date order and resolves chance with the seed', () => {
        let world = seclusionWorld();
        world = schedule(world, { kind: 'debt_due', dueOnDay: 5 * YEAR, summary: 'The debt fell due.' }).state;
        world = schedule(world, { kind: 'war_resolves', dueOnDay: 2 * YEAR, summary: 'The war ended.' }).state;
        world = schedule(world, { kind: 'custom', dueOnDay: 3 * YEAR, summary: 'A coin flip.', chance: 0.5 }).state;

        expect(pendingEffects(world, 0, 10 * YEAR)).toHaveLength(3);
        const a = advanceYears(world, 10);
        const b = advanceYears(world, 10);
        expect(a.fired.map(f => f.effect.summary)).toEqual([
            'The war ended.', 'A coin flip.', 'The debt fell due.'
        ]);
        expect(a.fired.map(f => f.landed)).toEqual(b.fired.map(f => f.landed));
    });

    it('repeats a recurring effect rather than retiring it', () => {
        let world = seclusionWorld();
        world = schedule(world, {
            kind: 'assessment', dueOnDay: YEAR, summary: 'Sect recruitment opened.', repeatDays: YEAR
        }).state;
        const out = advanceYears(world, 5);
        expect(out.fired).toHaveLength(5);
        expect(out.state.schedule[0].fired).toBe(false);
    });

    it('kills NPCs whose stored lifespan date arrives, in one pass over the roster', () => {
        let world = seclusionWorld();
        const npc = createNpc('time-1', { id: 'npc-old', bornOnDay: -90 * YEAR, onDay: 0 });
        world = upsertNpc(world, npc);
        expect(ageInYears(npc, 0)).toBe(90);

        const out = advanceYears(world, 20);
        expect(out.deaths.map(d => d.npcId)).toContain('npc-old');
        expect(getNpc(out.state, 'npc-old')!.status).toBe('physically_dead');
        expect(queryFacts(out.state.history, { kinds: ['death'] })).toHaveLength(1);
    });

    it('does not adjudicate a missing cultivator', () => {
        let world = seclusionWorld();
        const npc = markMissing(createNpc('time-1', { id: 'npc-gone', bornOnDay: -90 * YEAR, onDay: 0 }), 0);
        world = upsertNpc(world, npc);
        const out = advanceYears(world, 400);
        expect(getNpc(out.state, 'npc-gone')!.status).toBe('missing');
        expect(out.deaths).toHaveLength(0);
    });

    it('reports what an observer missed while they were elsewhere', () => {
        let world = seclusionWorld();
        world = scheduleConcurrentEvent(world, {
            onDay: 8 * YEAR, summary: 'The Cold Kiln Hall took the Saltbell vein.',
            scale: 'regional', magnitude: 0.8
        }).state;

        const out = advanceYears(world, 30, {
            observer: { id: 'pc', bornOnDay: -20 * YEAR, diedOnDay: null }
        });
        expect(out.concurrentEvents.map(f => f.summary)).toContain('The Cold Kiln Hall took the Saltbell vein.');
        expect(out.digest.missed.length).toBeGreaterThan(0);
    });
});

describe('time: long actions are interrupted, not fast-forwarded', () => {
    function world() {
        let w = createWorld({ seed: 'int-1', skipPriorAges: true, regionCount: 2 });
        w = upsertActor(w, makeActor({ actorId: 'pc', locationId: 'loc-region-0' }));
        return w;
    }

    it('stops at a world event in the region the actor is sitting in', () => {
        let w = world();
        w = schedule(w, {
            kind: 'war_resolves', dueOnDay: 622, summary: 'A sect war reached the valley.',
            locationId: 'loc-region-0'
        }).state;

        const out = advanceTime(w, 10 * YEAR, {
            interruptPolicy: { actorId: 'pc', locationIds: ['loc-region-0'], actionKind: 'seclusion' }
        });
        expect(out.interrupted).toBe(true);
        expect(out.toDay).toBe(622);
        expect(out.daysAdvanced).toBeLessThan(10 * YEAR);
        expect(out.interrupts[0].cause).toBe('local_event');
        expect(out.digest.interrupts).toHaveLength(1);
    });

    it('ignores an event two provinces away', () => {
        let w = world();
        w = schedule(w, {
            kind: 'war_resolves', dueOnDay: 622, summary: 'A sect war reached somewhere else.',
            locationId: 'loc-region-1'
        }).state;
        const out = advanceTime(w, 10 * YEAR, {
            interruptPolicy: { actorId: 'pc', locationIds: ['loc-region-0'] }
        });
        expect(out.interrupted).toBe(false);
        expect(out.daysAdvanced).toBe(10 * YEAR);
    });

    it('stops when an opportunity window opens nearby', () => {
        let w = world();
        w.opportunities.push(makeOpportunity({
            id: 'opp-seam', kind: 'realm_opening', name: 'the seam under Stillshelf',
            summary: 'A sealed pocket opens.', locationId: 'loc-region-0',
            opensOnDay: 4 * YEAR, durationDays: 30, recurrenceDays: years(80)
        }));
        const out = advanceTime(w, 30 * YEAR, {
            interruptPolicy: {
                actorId: 'pc', locationIds: ['loc-region-0'], onOpportunityOpens: true
            }
        });
        expect(out.interrupted).toBe(true);
        expect(out.toDay).toBe(4 * YEAR);
        expect(out.interrupts[0].cause).toBe('opportunity_opens');
    });

    it('lets a sealed cultivator miss everything when they asked to', () => {
        let w = world();
        w = schedule(w, {
            kind: 'war_resolves', dueOnDay: 622, summary: 'Somebody knocked.',
            locationId: 'loc-region-0', interrupts: true
        }).state;
        const out = advanceTime(w, 30 * YEAR, { stopOnInterrupt: false });
        expect(out.interrupted).toBe(false);
        expect(out.daysAdvanced).toBe(30 * YEAR);
        expect(out.fired[0].landed).toBe(true);   // it still happened
    });
});

describe('time: a five-hundred-year run stays affordable', () => {
    /**
     * Not the soak test itself - that belongs to the next milestone. This is the
     * affordability claim the soak depends on: cost is a function of what is on
     * the books, not of how many days passed.
     */
    it('advances five centuries over a populated world in one pass', () => {
        let world = createWorld({ seed: 'soak-1', presentYear: 1000, regionCount: 8 });
        world = upsertActor(world, makeActor({ actorId: 'pc', locationId: 'loc-region-0' }));

        for (let i = 0; i < 400; i++) {
            world = upsertNpc(world, createNpc('soak-1', {
                id: `npc-${i}`,
                bornOnDay: (1000 - (i % 90)) * YEAR,
                onDay: 1000 * YEAR,
                locationId: `loc-region-${i % 8}`
            }));
        }
        for (let i = 0; i < 200; i++) {
            world = schedule(world, {
                kind: 'concurrent_event',
                dueOnDay: (1000 + i * 2) * YEAR,
                summary: `Something happened in year ${1000 + i * 2}.`,
                chance: 0.6
            }).state;
        }
        world.opportunities.push(makeOpportunity({
            id: 'opp-cycle', kind: 'realm_opening', name: 'the seam under Stillshelf',
            summary: 'Opens once in eighty years.',
            opensOnDay: 1010 * YEAR, durationDays: 30, recurrenceDays: years(80)
        }));

        const started = Date.now();
        const out = advanceYears(world, 500, {
            observer: { id: 'pc', bornOnDay: 980 * YEAR, diedOnDay: null }
        });
        const elapsedMs = Date.now() - started;

        // Generous: the point is that it is not a function of 182,500 days.
        expect(elapsedMs).toBeLessThan(2000);
        expect(out.state.currentDay).toBe(1500 * YEAR);
        // The world is recognisably descended from the one it started as.
        expect(out.deaths.length).toBeGreaterThan(300);
        // 199, not 200: the effect due on the day the advance starts is behind
        // it. The window is (fromDay, toDay], so no effect can fire twice
        // across two consecutive advances.
        expect(out.fired.length).toBe(199);
        expect(out.concurrentEvents.length).toBeGreaterThan(50);
        // Capped per opportunity by design: a five-century advance over an
        // eighty-year cycle wants the last few windows, not a list of them all.
        expect(out.missedOpportunities.length).toBeGreaterThanOrEqual(4);
        expect(out.state.history.facts.length).toBeGreaterThan(world.history.facts.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// OPPORTUNITIES
// ─────────────────────────────────────────────────────────────────────────

describe('opportunities: windows that close', () => {
    const fruit = makeOpportunity({
        id: 'opp-fruit', kind: 'resource', name: 'the Greyfurrow spirit fruit',
        summary: 'Ripe for twelve days.', opensOnDay: 100, durationDays: 12
    });
    const realm = makeOpportunity({
        id: 'opp-realm', kind: 'realm_opening', name: 'the seam under Stillshelf',
        summary: 'Opens once in eighty years.',
        opensOnDay: 1000, durationDays: 30, recurrenceDays: years(80)
    });

    it('answers open and closed in closed form, centuries out', () => {
        expect(isOpportunityOpen(fruit, 99)).toBe(false);
        expect(isOpportunityOpen(fruit, 105)).toBe(true);
        expect(isOpportunityOpen(fruit, 112)).toBe(false);

        expect(isOpportunityOpen(realm, 1000)).toBe(true);
        expect(isOpportunityOpen(realm, 1000 + years(80))).toBe(true);
        expect(isOpportunityOpen(realm, 1000 + years(80) * 12)).toBe(true);
        expect(isOpportunityOpen(realm, 1000 + years(40))).toBe(false);
    });

    it('says how long until the next one, and never in fewer steps than reality', () => {
        expect(daysUntilNextWindow(realm, 0)).toBe(1000);
        expect(daysUntilNextWindow(realm, 1040)).toBe(years(80) - 40);
        // Missing it by four months means waiting eighty years.
        expect(daysUntilNextWindow(realm, 1030 + 120)!).toBeGreaterThan(years(79));
    });

    it('caps enumeration over a long span', () => {
        expect(windowsBetween(realm, 0, 1000 + years(80) * 500, 6)).toHaveLength(6);
        expect(nextWindow(fruit, 200)).toBeNull();
    });

    it('refuses a claim outside the window and accepts one inside it', () => {
        expect(claimOpportunity(fruit, 'pc', 90).ok).toBe(false);
        expect(claimOpportunity(fruit, 'pc', 200).reason).toContain('will not open again');
        const taken = claimOpportunity(fruit, 'pc', 104);
        expect(taken.ok).toBe(true);
        expect(taken.opportunity.claimedById).toBe('pc');
        expect(claimOpportunity(taken.opportunity, 'rival', 105).ok).toBe(false);
    });

    it('distinguishes arriving late from never having heard of it', () => {
        const known = revealTo(fruit, 'pc');
        const lateMisses = missedWindowsFor(known, 0, 500, 'pc');
        expect(lateMisses).toHaveLength(1);
        expect(lateMisses[0].unknown).toBe(false);

        const unknownMisses = missedWindowsFor(fruit, 0, 500, 'pc');
        expect(unknownMisses[0].unknown).toBe(true);
    });

    it('represents somebody else having taken it', () => {
        const taken = claimOpportunity(revealTo(fruit, 'pc'), 'rival-sect', 103).opportunity;
        const misses = missedWindowsFor(taken, 0, 500, 'pc');
        expect(misses[0].takenById).toBe('rival-sect');
    });

    it('queries and orders by what comes next', () => {
        const list = [realm, fruit];
        expect(queryOpportunities(list, { openOnDay: 105 }).map(o => o.id)).toEqual(['opp-fruit']);
        expect(upcoming(list, 0).map(u => u.opportunity.id)).toEqual(['opp-fruit', 'opp-realm']);
    });

    it('counts misses through a time advance without anyone watching', () => {
        let w = createWorld({ seed: 'opp-1', skipPriorAges: true, regionCount: 1 });
        w.opportunities.push(fruit);
        const out = advanceYears(w, 5);
        expect(out.missedOpportunities).toHaveLength(1);
        expect(out.missedOpportunities[0].unknown).toBe(true);
        expect(out.state.opportunities[0].missedWindows).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// MEMORY
// ─────────────────────────────────────────────────────────────────────────

describe('memory: storage, retrieval and compression', () => {
    function store() {
        const s = createMemoryStore();
        storeMemory(s, { ownerId: 'npc-1', kind: 'betrayal', summary: 'Bai Shuqing opened the gate.', onDay: 100, actorIds: ['npc-2'], tags: ['sect'] });
        storeMemory(s, { ownerId: 'npc-1', kind: 'debt', summary: 'Owes the Salt Bell Court 4,000 stones.', onDay: 200, actorIds: ['fac-1'] });
        for (let i = 0; i < 50; i++) {
            storeMemory(s, {
                ownerId: 'npc-1', kind: i % 2 === 0 ? 'routine' : 'observation',
                summary: `Ordinary day ${i}.`, onDay: 300 + i, tags: ['daily']
            });
        }
        return s;
    }

    it('assigns sequential ids and searches by owner, kind, actor, tag and text', () => {
        const s = store();
        expect(s.records[0].id).toBe('m1');
        expect(memoryCount(s, 'npc-1')).toBe(52);
        expect(searchMemories(s, { ownerId: 'npc-1', kinds: ['betrayal'] })).toHaveLength(1);
        expect(searchMemories(s, { actorIds: ['npc-2'] })).toHaveLength(1);
        expect(searchMemories(s, { tags: ['daily'] })).toHaveLength(50);
        expect(searchMemories(s, { text: 'salt bell' })).toHaveLength(1);
        expect(recallAbout(s, 'npc-1', 'npc-2')[0].kind).toBe('betrayal');
    });

    it('orders deterministically', () => {
        const s = store();
        const a = searchMemories(s, { ownerId: 'npc-1', limit: 10 }).map(m => m.id);
        const b = searchMemories(s, { ownerId: 'npc-1', limit: 10 }).map(m => m.id);
        expect(a).toEqual(b);
        // Betrayals and debts default to the top, ahead of fifty ordinary days.
        expect(searchMemories(s, { ownerId: 'npc-1' }).slice(0, 2).map(m => m.kind).sort())
            .toEqual(['betrayal', 'debt']);
    });

    it('never offers a protected memory as a compression candidate', () => {
        const s = store();
        const plan = planCompression(s, 'npc-1', { onDay: 2000 });
        expect(plan.needed).toBe(true);
        expect(plan.candidates.every(c => c.kind === 'routine' || c.kind === 'observation')).toBe(true);
        expect(plan.retained.some(r => r.kind === 'betrayal')).toBe(true);
        expect(plan.retained.some(r => r.kind === 'debt')).toBe(true);
        expect(plan.targetCount).toBeLessThanOrEqual(10);
    });

    it('collapses many records into a few and keeps the earliest date', () => {
        const s = store();
        const plan = planCompression(s, 'npc-1', { onDay: 2000 });
        const half = plan.candidates.slice(0, 25).map(c => c.id);
        const rest = plan.candidates.slice(25).map(c => c.id);

        const result = applyCompression(s, plan, [
            { kind: 'observation', summary: 'Twenty-five unremarkable years at the outer courtyard.', compressedFromIds: half },
            { kind: 'observation', summary: 'The rest of it, equally unremarkable.', compressedFromIds: rest }
        ], 2000);

        expect(result.addedIds).toHaveLength(2);
        expect(result.removedIds).toHaveLength(50);
        expect(result.keptUnabsorbedIds).toHaveLength(0);
        expect(memoryCount(s, 'npc-1')).toBe(4);
        const compressed = searchMemories(s, { ownerId: 'npc-1', kinds: ['observation'] });
        expect(compressed[0].compressed).toBe(true);
        expect(compressed.every(c => c.onDay >= 300 && c.onDay < 400)).toBe(true);
        // The load-bearing memories are still there.
        expect(searchMemories(s, { ownerId: 'npc-1', kinds: ['betrayal', 'debt'] })).toHaveLength(2);
    });

    it('rejects a compressed record citing anything outside the plan', () => {
        const s = store();
        const plan = planCompression(s, 'npc-1', { onDay: 2000 });
        const before = memoryCount(s, 'npc-1');
        const result = applyCompression(s, plan, [
            { kind: 'observation', summary: 'Includes the betrayal, quietly.', compressedFromIds: ['m1', plan.candidates[0].id] },
            { kind: 'observation', summary: 'Cites nothing.', compressedFromIds: [] }
        ], 2000);
        expect(result.addedIds).toHaveLength(0);
        expect(result.rejected).toHaveLength(2);
        expect(memoryCount(s, 'npc-1')).toBe(before);
    });

    it('keeps a candidate the summariser left out rather than deleting by omission', () => {
        const s = store();
        const plan = planCompression(s, 'npc-1', { onDay: 2000 });
        const some = plan.candidates.slice(0, 5).map(c => c.id);
        const result = applyCompression(s, plan, [
            { kind: 'observation', summary: 'Five dull seasons.', compressedFromIds: some }
        ], 2000);
        expect(result.keptUnabsorbedIds).toHaveLength(plan.candidates.length - 5);
        for (const id of result.keptUnabsorbedIds) {
            expect(s.records.some(r => r.id === id)).toBe(true);
        }
    });

    it('finds memories the world record no longer supports', () => {
        let world = createWorld({ seed: 'mem-1', skipPriorAges: true });
        const out = recordEvent(world, makeFact({
            day: 100, kind: 'catastrophe', summary: 'The mountain at Stillshelf came down.'
        }));
        world = out.state;
        const s = createMemoryStore();
        rememberFact(s, 'pc', out.fact, { summary: 'There used to be a mountain here.' });
        expect(unsupportedMemories(s, world.history, 'pc')).toHaveLength(0);

        // Centuries pass and the record is gone. The memory is not.
        degradeFidelity(world.history.facts[0], 'lost');
        const orphaned = unsupportedMemories(s, world.history, 'pc');
        expect(orphaned).toHaveLength(1);
        expect(orphaned[0].summary).toContain('used to be a mountain');
    });

    it('lists owners over the threshold', () => {
        const s = store();
        expect(ownersNeedingCompression(s).map(o => o.ownerId)).toEqual(['npc-1']);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// NPC RECORDS, GOALS, LINEAGE
// ─────────────────────────────────────────────────────────────────────────

describe('npc records: durable, not simulated', () => {
    it('rolls talent from the seed, never from a caller', () => {
        const a = createNpc('npc-seed', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        const b = createNpc('npc-seed', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        const c = createNpc('npc-seed', { id: 'npc-2', bornOnDay: 0, onDay: 0 });
        expect(a.cultivation.spiritRoot).toBe(b.cultivation.spiritRoot);
        expect(JSON.stringify(a.cultivation.attributes)).toBe(JSON.stringify(b.cultivation.attributes));
        expect(a.name).toBe(b.name);
        expect([a.cultivation.spiritRoot, a.name]).not.toEqual([c.cultivation.spiritRoot, c.name]);
    });

    it('derives lifespan from the realm and moves it when the realm moves', () => {
        const npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        expect(npc.cultivation.lifespanEndsOnDay).toBe(100 * YEAR);   // Qi Condensation
        const advanced = setRealm(npc, 13, 40 * YEAR);                // Foundation Establishment
        expect(advanced.cultivation.lifespanEndsOnDay).toBe(200 * YEAR);
        expect(advanced.cultivation.lastAdvancedOnDay).toBe(40 * YEAR);
    });

    it('stores a goal as five fields and keeps its age', () => {
        let npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = addGoal(npc, {
            kind: 'revenge',
            text: 'Avenge a father.',
            priority: 0.9,
            progress: 'Has identified the killer\'s faction.',
            obstacles: ['Insufficient strength.'],
            deadlineOnDay: null,
            targetId: 'fac-1'
        }, 10 * YEAR);

        const brief = npcBrief(npc, 310 * YEAR);
        expect(brief.goals[0].progress).toContain('identified');
        expect(brief.goals[0].obstacles).toEqual(['Insufficient strength.']);
        expect(brief.goals[0].deadlineInDays).toBeNull();
        expect(brief.goals[0].yearsOpen).toBe(300);   // three hundred years, still live
    });

    it('updates progress and obstacles without losing the opening date', () => {
        let npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = addGoal(npc, { kind: 'revenge', text: 'Avenge a father.', priority: 0.9 }, 10 * YEAR);
        const id = npc.goals[0].id;
        npc = updateGoal(npc, id, { progress: 'Found the man.', obstacles: [] }, 200 * YEAR);
        expect(npc.goals[0].openedOnDay).toBe(10 * YEAR);
        expect(npc.goals[0].progress).toBe('Found the man.');
        expect(activeGoals(npc)).toHaveLength(1);
    });

    it('keeps a relationship as old as it actually is when it turns', () => {
        let npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = upsertRelationship(npc, {
            targetId: 'npc-2', targetName: 'Bai Shuqing', kind: 'ally', standing: 0.8
        }, 10 * YEAR);
        npc = upsertRelationship(npc, {
            targetId: 'npc-2', targetName: 'Bai Shuqing', kind: 'enemy', standing: -0.9,
            note: 'Opened the gate.'
        }, 50 * YEAR);
        expect(npc.relationships[0].sinceDay).toBe(10 * YEAR);
        expect(npc.relationships[0].lastChangedDay).toBe(50 * YEAR);
        expect(npc.relationships[0].standing).toBe(-0.9);
    });

    it('treats missing and unknown as answers, not placeholders', () => {
        let npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = addGoal(npc, { kind: 'discovery', text: 'Find the sealed hall.', priority: 0.8 }, 0);
        npc = markMissing(npc, 50 * YEAR, 'Went into a ruin at Coldfall and did not come out.');

        expect(isUnadjudicated(npc.status)).toBe(true);
        // A missing person's goals are not known to have stopped.
        expect(activeGoals(npc)).toHaveLength(1);

        // Four thousand years later a sealed body is found, and then wakes.
        npc = setExistence(npc, { to: 'sealed', onDay: 4000 * YEAR, soulState: 'intact' });
        expect(npc.status).toBe('sealed');
        npc = setExistence(npc, { to: 'alive', onDay: 4020 * YEAR, identityContinuity: 1 });
        expect(npc.status).toBe('alive');
        expect(activeGoals(npc)).toHaveLength(1);   // grudges and goals intact
    });

    it('records a remnant as not being the person', () => {
        let npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = setExistence(npc, {
            to: 'remnant', onDay: 100 * YEAR, identityContinuity: 0.2, soulState: 'fragmented',
            note: 'A recorded will in the inheritance hall. It says it is the founder.'
        });
        expect(npc.identityContinuity).toBeLessThan(0.5);
        expect(npc.diedOnDay).toBe(100 * YEAR);
    });
});

describe('lineage: the edge, and what travels down it', () => {
    function line() {
        let l = createLineageRecord({
            id: 'lin-yun', surname: 'Yun', founderId: 'npc-1', foundedOnDay: 0
        });
        l = addLineageEdge(l, { parentId: 'npc-1', childId: 'npc-2', relation: 'descendant', onDay: 30 * YEAR });
        l = addLineageEdge(l, { parentId: 'npc-1', childId: 'npc-d', relation: 'disciple', onDay: 40 * YEAR });
        l = addLineageEdge(l, { parentId: 'npc-2', childId: 'npc-3', relation: 'descendant', onDay: 90 * YEAR });
        l.traits.push({
            id: 'trait-cold', name: 'Cold Kiln physique', note: 'Runs in the blood.',
            modifiers: [], fadesAfterGenerations: 1
        });
        l.holdings = { spirit_stones: 4000 };
        l.inheritedEnemyIds = ['fac-2'];
        l.obligationIds = ['ob-1'];
        return l;
    }

    it('walks descendants and generations', () => {
        const l = line();
        expect(descendantsOf(l, 'npc-1').map(d => d.id).sort()).toEqual(['npc-2', 'npc-3', 'npc-d']);
        expect(generationOf(l, 'npc-1')).toBe(0);
        expect(generationOf(l, 'npc-2')).toBe(1);
        expect(generationOf(l, 'npc-3')).toBe(2);
    });

    it('fades a bloodline trait on read rather than sweeping', () => {
        const l = line();
        expect(traitsFor(l, 'npc-2').map(t => t.id)).toEqual(['trait-cold']);
        expect(traitsFor(l, 'npc-3')).toHaveLength(0);
    });

    it('orders heirs and produces the social layer shape', () => {
        const l = line();
        const heirs = heirsOf(l, 'npc-1');
        expect(heirs).toEqual([
            { id: 'npc-2', relation: 'descendant' },
            { id: 'npc-d', relation: 'disciple' }
        ]);
        // Dead heirs are filtered by the caller's own liveness test.
        expect(heirsOf(l, 'npc-1', id => id !== 'npc-2')).toEqual([{ id: 'npc-d', relation: 'disciple' }]);
    });

    it('moves property, enemies and obligations together', () => {
        const out = settleInheritance(line(), 'npc-1', 100 * YEAR);
        expect(out.heirId).toBe('npc-2');
        expect(out.holdingsTransferred.spirit_stones).toBe(3000);
        expect(out.lineage.holdings.spirit_stones).toBe(1000);
        expect(out.enemiesInherited).toEqual(['fac-2']);
        expect(out.obligationIds).toEqual(['ob-1']);
    });

    it('lets an estate go nowhere and marks the line extinct', () => {
        const l = createLineageRecord({ id: 'lin-x', surname: 'Mo', founderId: 'npc-9', foundedOnDay: 0 });
        const out = settleInheritance(l, 'npc-9', 100 * YEAR);
        expect(out.heirId).toBeNull();
        expect(out.lineage.extinctOnDay).toBe(100 * YEAR);
    });
});

describe('death handoff: goals and heirs outlive their holder', () => {
    it('passes a live goal to the primary heir with its original date', () => {
        let world = createWorld({ seed: 'death-1', skipPriorAges: true });
        let father = createNpc('death-1', { id: 'npc-1', bornOnDay: -95 * YEAR, onDay: 0 });
        father = addGoal(father, {
            kind: 'revenge', text: 'Avenge a father.', priority: 0.9,
            progress: 'Has identified the killer\'s faction.',
            obstacles: ['Insufficient strength.']
        }, -60 * YEAR);
        const son = createNpc('death-1', { id: 'npc-2', bornOnDay: -30 * YEAR, onDay: 0 });

        world = upsertNpc(world, father);
        world = upsertNpc(world, son);
        let lineage = createLineageRecord({ id: 'lin-1', surname: 'Yun', founderId: 'npc-1', foundedOnDay: -95 * YEAR });
        lineage = addLineageEdge(lineage, { parentId: 'npc-1', childId: 'npc-2', relation: 'descendant', onDay: -30 * YEAR });
        world = upsertLineage(world, lineage);

        const handoffs: { deceasedId: string; heirIds: string[] }[] = [];
        const out = advanceYears(world, 10, {
            onDeath: h => handoffs.push({ deceasedId: h.deceasedId, heirIds: h.heirs.map(x => x.id) })
        });

        expect(out.deaths.map(d => d.npcId)).toEqual(['npc-1']);
        // The array handed to the social layer's inheritLedgerOnDeath.
        expect(handoffs).toEqual([{ deceasedId: 'npc-1', heirIds: ['npc-2'] }]);
        expect(out.deathHandoffs[0].primaryHeirId).toBe('npc-2');

        const heir = getNpc(out.state, 'npc-2')!;
        const inherited = heir.goals.find(g => g.kind === 'revenge')!;
        expect(inherited.status).toBe('active');
        expect(inherited.openedOnDay).toBe(-60 * YEAR);   // the goal is as old as it was
        expect(inherited.generation).toBe(1);
        expect(inherited.originHolderId).toBe('npc-1');
        expect(inherited.progress).toContain('identified');
        expect(lineageOf(out.state, 'npc-2')!.id).toBe('lin-1');
    });

    it('drops trivia rather than handing it on', () => {
        let npc = createNpc('s', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = addGoal(npc, { kind: 'revenge', text: 'Avenge a father.', priority: 0.9 }, 0);
        npc = addGoal(npc, { kind: 'wealth', text: 'Buy a better cauldron.', priority: 0.2 }, 0);
        expect(legacyGoals(npc).map(g => g.kind)).toEqual(['revenge']);

        const heir = inheritGoals(createNpc('s', { id: 'npc-2', bornOnDay: 0, onDay: 0 }), legacyGoals(npc), 'npc-1', 100);
        expect(heir.goals).toHaveLength(1);
        expect(heir.goals[0].inheritedFromId).toBe('npc-1');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// POSSESSIONS
// ─────────────────────────────────────────────────────────────────────────

describe('possession is not ownership', () => {
    function sword() {
        let obj = makeObject({
            id: 'obj-sword', name: 'the Ninefold sword', kind: 'artifact', significance: 'legendary'
        });
        obj = transferPossession(obj, {
            onDay: 100, toHolderId: 'npc-1', toHolderName: 'Yun Cishan',
            how: 'found', source: 'a sealed compound at Coldfall'
        });
        return obj;
    }

    it('keeps holder, owner, claim and knowledge apart', () => {
        let obj = sword();
        expect(obj.possessorId).toBe('npc-1');
        expect(obj.ownerId).toBeNull();          // finding it does not make it yours

        obj = assertClaim(obj, {
            claimantId: 'npc-9', claimantName: 'Mo Yaolin', basis: 'ancestral',
            assertedOnDay: 200, strength: 0.8, note: 'Last of the clan that made it.'
        });
        expect(isDisputed(obj)).toBe(false);     // one claim, and nobody owns it yet
        expect(knowsOwnership(obj, 'npc-1')).toBe(false);

        obj = setOwnership(obj, 'npc-9', 'Mo Yaolin');
        expect(isDisputed(obj)).toBe(true);      // holder is not the owner
        obj = revealOwnership(obj, 'npc-1');
        expect(knowsOwnership(obj, 'npc-1')).toBe(true);
    });

    it('records a taking without moving ownership', () => {
        let obj = sword();
        obj = setOwnership(obj, 'npc-1', 'Yun Cishan');
        obj = transferPossession(obj, {
            onDay: 500, toHolderId: 'npc-7', toHolderName: 'a thief', how: 'stolen'
        });
        expect(obj.possessorId).toBe('npc-7');
        expect(obj.ownerId).toBe('npc-1');
        expect(isStolen(obj)).toBe(true);
        expect(lastTheft(obj)!.previousHolderName).toBe('Yun Cishan');
        expect(isDisputed(obj)).toBe(true);
    });

    it('carries provenance on a resource lot worth remembering', () => {
        const lot = makeResourceLot({
            id: 'lot-1', resource: 'spirit stones', quantity: 108,
            source: 'an abandoned mine', acquiredOnDay: 180,
            holderId: 'pc', holderName: 'the player'
        });
        expect(lot.name).toBe('108 spirit stones');
        expect(lot.provenance[0].source).toBe('an abandoned mine');
        expect(lot.provenance[0].previousHolderName).toBeNull();
    });

    it('queries by the situation rather than by the object', () => {
        let stolenSword = sword();
        stolenSword = setOwnership(stolenSword, 'npc-1', 'Yun Cishan');
        stolenSword = transferPossession(stolenSword, {
            onDay: 500, toHolderId: 'npc-7', toHolderName: 'a thief', how: 'stolen'
        });
        const clean = makeObject({ id: 'obj-bell', name: 'a bell', kind: 'artifact' });
        const list = [stolenSword, clean];

        expect(queryObjects(list, { stolenOnly: true }).map(o => o.id)).toEqual(['obj-sword']);
        expect(queryObjects(list, { disputedOnly: true }).map(o => o.id)).toEqual(['obj-sword']);
        expect(describeObject(stolenSword, 900)).toContain('taken from Yun Cishan');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────

describe('locations carry environment, not just a name', () => {
    it('makes ten years resolve differently in different places', () => {
        const city = makeLocation({
            id: 'loc-city', name: 'Blackwater', kind: 'settlement',
            ambient: 'thin',
            environment: {
                spiritualDensity: 0.1, danger: 0.1, resources: ['trade'], climate: 'temperate',
                politicalControl: 'a merchant council', specialRules: [],
                knownSecrets: [], historicalScars: []
            }
        });
        const mountain = makeLocation({
            id: 'loc-mountain', name: 'the Cold Kiln peak', kind: 'vein',
            ambient: 'dense',
            environment: {
                spiritualDensity: 0.9, danger: 0.2, resources: ['qi', 'herbs'], climate: 'frozen',
                politicalControl: 'the Cold Kiln Hall', specialRules: ['no flight above the third terrace'],
                knownSecrets: [], historicalScars: []
            }
        });
        const battlefield = makeLocation({
            id: 'loc-field', name: 'the poisoned furrow', kind: 'forbidden_zone',
            ambient: 'thin',
            hazards: ['corrosive'],
            environment: {
                spiritualDensity: 0.2, danger: 0.9, resources: [], climate: 'sour',
                politicalControl: 'nobody', specialRules: ['the dead do not stay down'],
                knownSecrets: [], historicalScars: ['a war that nobody won']
            }
        });

        const c = cultivationContext(city).rateMultiplier;
        const m = cultivationContext(mountain).rateMultiplier;
        const b = cultivationContext(battlefield).rateMultiplier;

        expect(m).toBeGreaterThan(c);
        expect(b).toBeLessThan(c);
        expect(cultivationContext(battlefield).specialRules).toContain('the dead do not stay down');
    });

    it('reports a sealed ruin as holding qi nobody can reach', () => {
        const ruin = makeLocation({
            id: 'loc-ruin', name: 'a sealed compound', kind: 'ruin',
            ambient: 'dense', qiDensity: 0.95, sealed: true,
            thresholds: makeThresholds(13, 21, 25, 30),
            environment: {
                spiritualDensity: 0.05, danger: 0.8, resources: ['qi'], climate: 'sunless',
                politicalControl: 'whoever gets in', specialRules: [], knownSecrets: [],
                historicalScars: []
            }
        });
        const ctx = cultivationContext(ruin);
        expect(ruin.qiDensity).toBeGreaterThan(0.9);
        expect(ctx.rateMultiplier).toBeLessThan(1);
        expect(ctx.factors.some(f => f.source === 'sealed')).toBe(true);
    });

    it('favours a specialist over a generalist in the same ground', () => {
        const marsh = makeLocation({
            id: 'loc-marsh', name: 'the Sourbank marsh', kind: 'forbidden_zone',
            affinities: [{ tag: 'poison', multiplier: 1.6, thresholdOffset: 8, note: '' }]
        });
        const specialist = cultivationContext(marsh, { specialties: ['poison'] }).rateMultiplier;
        const outsider = cultivationContext(marsh, { specialties: ['metal'] }).rateMultiplier;
        expect(specialist).toBeGreaterThan(outsider);
    });
});
