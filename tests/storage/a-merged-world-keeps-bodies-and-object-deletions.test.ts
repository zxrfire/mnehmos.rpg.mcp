/** The merge joins Native insight/body persistence, plague courses and physical
 * object deletion. Check their shared writer together on a small arranged world;
 * no centuries of history are needed to observe a lost column or resurrected item.
 * Optional absence and explicit clearing remain distinct. Claims and provenance
 * must disappear with consumed objects while unrelated inventory survives.
 * Suite integration also found duplicate insight ALTER guards sharing one old
 * column snapshot. An older table must upgrade once and reopen without a second
 * attempt to add the same column.
 */
import { afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { assertClaim, makeObject } from '../../src/engine/world/possessions.js';
import { AchievementSchema, InsightSchema } from '../../src/schema/cultivation.js';

const databases: Database.Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function prepared() {
    const db = new Database(':memory:'); databases.push(db); migrate(db);
    const repo = new WorldStateRepository(db);
    const world = createWorld({ seed: 'merged-body-and-inventory', presentYear: 1, skipPriorAges: true });
    const day = world.currentDay;
    const person = createNpc(world.seed, { id: 'merge-person', name: 'The recorded person',
        onDay: day, bornOnDay: day - 20 * 365 });
    world.npcs.push(person);
    return { db, repo, world, person, day };
}

it('upgrades an older NPC table once and can repeat the migration', () => {
    const { db, repo, world, person } = prepared();
    db.exec('ALTER TABLE world_npcs DROP COLUMN insights; ALTER TABLE world_npcs DROP COLUMN achievements; ALTER TABLE world_npcs DROP COLUMN alchemy_ordinal;');
    migrate(db);
    migrate(db);
    person.cultivation.insights = [];
    person.cultivation.achievements = [];
    repo.saveWorld(world);
    const loaded = repo.loadWorld(world.id)!.npcs[0]!;
    expect(loaded.cultivation.insights).toEqual([]);
    expect(loaded.cultivation.achievements).toEqual([]);
});

it('keeps plague and finite body fields beside Native insights and achievements', () => {
    const { repo, world, person, day } = prepared();
    const achievement = AchievementSchema.parse({ id: 'merge-observation', kind: 'witnessed_phenomenon',
        onDay: day, turn: 0, summary: 'Observed a sword art.', detail: {} });
    const insight = InsightSchema.parse({ id: achievement.id, domain: 'weapon', subject: 'sword',
        degree: 1, provenance: { achievementId: achievement.id, achievementKind: achievement.kind,
            onDay: day, deepenedBy: [], account: achievement.summary } });
    Object.assign(person.cultivation, { hp: 11, qi: 7, bodyOnDay: day, seal: null,
        techniqueCooldowns: { 'recorded-art': day + 1 }, insights: [insight], achievements: [achievement],
        plague: { outbreakId: 'merge-outbreak', contractedOnDay: day, endsOnDay: day + 12,
            fatalOnDay: null, treatedOnDay: null } });
    repo.saveWorld(world);
    const loaded = repo.loadWorld(world.id)!.npcs.find(row => row.id === person.id)!;
    for (const key of ['hp', 'qi', 'bodyOnDay', 'seal', 'techniqueCooldowns', 'insights', 'achievements', 'plague'] as const)
        expect(loaded.cultivation[key], key).toEqual(person.cultivation[key]);
});

it('retains deepening and explicit empty/cleared values on an append', () => {
    const { repo, world, person, day } = prepared();
    person.cultivation.insights = [InsightSchema.parse({ id: 'merge-insight', domain: 'weapon',
        subject: 'sword', degree: 1, provenance: { achievementId: 'merge-observation',
            achievementKind: 'witnessed_phenomenon', onDay: day, deepenedBy: [], account: 'Observed a sword art.' } })];
    person.cultivation.achievements = [];
    person.cultivation.plague = { outbreakId: 'merge-outbreak', contractedOnDay: day,
        endsOnDay: day + 12, fatalOnDay: null, treatedOnDay: null };
    repo.saveWorld(world);
    person.cultivation.insights[0] = { ...person.cultivation.insights[0]!, degree: 2 };
    person.cultivation.plague = null;
    repo.appendWorld(world);
    let loaded = repo.loadWorld(world.id)!;
    expect(loaded.npcs[0]!.cultivation.insights).toEqual(person.cultivation.insights);
    expect(loaded.npcs[0]!.cultivation.achievements).toEqual([]);
    expect(loaded.npcs[0]!.cultivation.plague).toBeNull();
    person.cultivation.insights = [];
    repo.appendWorld(world);
    loaded = repo.loadWorld(world.id)!;
    expect(loaded.npcs[0]!.cultivation.insights).toEqual([]);
});

it('does not invent optional understanding or plague in a sparse row', () => {
    const { repo, world, person } = prepared();
    delete person.cultivation.insights; delete person.cultivation.achievements; delete person.cultivation.plague;
    repo.saveWorld(world);
    const loaded = repo.loadWorld(world.id)!.npcs[0]!;
    expect(loaded.cultivation.insights).toBeUndefined();
    expect(loaded.cultivation.achievements).toBeUndefined();
    expect(loaded.cultivation.plague).toBeUndefined();
});

it('does not restore a removed object or its children on reopening', () => {
    const { db, repo, world, person, day } = prepared();
    const used = assertClaim(makeObject({ id: 'used-token', name: 'The consumed token', kind: 'token',
        ownerId: person.id, possessorId: person.id, provenance: [{ onDay: day, holderId: person.id,
            holderName: person.name, how: 'bought', source: 'The arranged local purchase',
            previousHolderId: null, previousHolderName: null, factId: null, note: '' }] }), { claimantId: person.id,
        claimantName: person.name, basis: 'purchase', assertedOnDay: day });
    const kept = makeObject({ id: 'kept-token', name: 'The retained token', kind: 'token', possessorId: person.id });
    world.objects.push(used, kept); repo.saveWorld(world);
    world.objects = world.objects.filter(object => object.id !== used.id); repo.appendWorld(world);
    const loaded = repo.loadWorld(world.id)!;
    expect(loaded.objects.map(object => object.id)).toEqual([kept.id]);
    for (const table of ['world_objects', 'world_object_claims', 'world_object_provenance']) {
        const key = table === 'world_objects' ? 'id' : 'object_id';
        expect((db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE world_id = ? AND ${key} = ?`)
            .get(world.id, used.id) as { n: number }).n, table).toBe(0);
    }
    repo.appendWorld(loaded);
    expect(repo.loadWorld(world.id)!.objects.map(object => object.id)).toEqual([kept.id]);
});

/** Recorded training is not a realm. Zero must survive reopening, later study
 * must survive append, and a legacy absence must remain genuinely absent. */
it('keeps learned alchemy separate from the body across snapshot and append saves', () => {
    const { repo, world, person } = prepared();
    const realm = person.cultivation.realmOrdinal;
    person.cultivation.alchemyOrdinal = 0;
    repo.saveWorld(world);
    let resumed = repo.loadWorld(world.id)!;
    expect(resumed.npcs[0]!.cultivation.alchemyOrdinal).toBe(0);
    expect(resumed.npcs[0]!.cultivation.realmOrdinal).toBe(realm);
    resumed.npcs[0]!.cultivation.alchemyOrdinal = 17;
    repo.appendWorld(resumed);
    resumed = repo.loadWorld(world.id)!;
    expect(resumed.npcs[0]!.cultivation.alchemyOrdinal).toBe(17);
    delete resumed.npcs[0]!.cultivation.alchemyOrdinal;
    repo.appendWorld(resumed);
    const legacy = repo.loadWorld(world.id)!.npcs[0]!;
    expect(legacy.cultivation.alchemyOrdinal).toBeUndefined();
    expect(legacy.cultivation.realmOrdinal).toBe(realm);
});
