/**
 * The yearly paperwork sweep retained every object even after all custody and
 * references ended. Only the catalog's cheapest herb-value floor is collected;
 * a larger stack or unknown worth remains for someone to find. Deletion must
 * be silent, wait a year, and preserve all storage, references and player ground.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject, transferPossession } from '../../../src/engine/world/possessions.js';
import { HERBS } from '../../../src/data/cultivation/herbs.js';
import { CHEAP_UNHELD_VALUE, collectUnheldCheapObjects } from '../../../src/engine/world/an-unheld-cheap-object-is-forgotten.js';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps.js';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { createObligation } from '../../../src/engine/social/grudges.js';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';

const herb = HERBS.find(herb => herb.value === CHEAP_UNHELD_VALUE)!;
function arrangement() {
    const world = createWorld({ seed: 'unheld-object-control', presentYear: 0, regionCount: 0, skipPriorAges: true });
    world.currentDay = 366;
    world.locations.push(makeLocation({ id: 'ground', name: 'Open ground', kind: 'wilds' }));
    return world;
}
function lost(id: string, locationId = 'ground', quantity = 1) {
    return transferPossession(makeObject({ id, name: herb.name, kind: 'material', locationId,
        possessorId: 'former-holder', data: { materialId: herb.id, quantity } }),
        { toHolderId: null, toHolderName: 'nobody', onDay: 0, how: 'lost' });
}

it('collects silently after a year even when there are no old business dockets', () => {
    const world = arrangement();
    world.objects.push(lost('cheap'), lost('valuable-stack', 'ground', 2));
    world.objects.push(makeObject({ id: 'unknown-worth', name: 'An unknown object', kind: 'other' }));
    const history = world.history.facts.slice();
    world.currentDay = 364;
    collectUnheldCheapObjects(world);
    expect(world.objects.some(object => object.id === 'cheap')).toBe(true);
    world.currentDay = 365;
    keepTheBusinessStillOnTheBooks(world);
    expect(world.objects.map(object => object.id)).toEqual(['valuable-stack', 'unknown-worth']);
    expect(world.history.facts).toEqual(history);
});

it('protects personal, institutional, vessel and abode custody, and stored ground', () => {
    const world = arrangement();
    for (const id of ['person', 'house', 'ship', 'abode']) world.objects.push({ ...lost(`held-${id}`), possessorId: id });
    for (const kind of ['vault', 'grave', 'hall', 'chamber'] as const) {
        world.locations.push(makeLocation({ id: kind, name: kind, kind, parentId: 'ground' }));
        world.objects.push(lost(`stored-${kind}`, kind));
    }
    world.locations.push(makeLocation({ id: 'residence', name: 'Their residence', kind: 'wilds',
        tags: ['residence'], data: { heldById: 'person' } }));
    world.objects.push(lost('stored-residence', 'residence'));
    expect(collectUnheldCheapObjects(world)).toBe(0);
    expect(world.objects).toHaveLength(9);
});

it('protects facts, structured jobs, obligations, searches, deliveries and other object references', () => {
    const world = arrangement();
    for (const id of ['fact-target', 'job-target', 'word-target', 'search-target', 'delivery-target', 'object-target']) world.objects.push(lost(id));
    appendWorldFact(world, makeFact({ day: 0, kind: 'opportunity', summary: 'An actual referenced item.', data: { objectId: 'fact-target' } }));
    appendWorldFact(world, makeFact({ day: 0, kind: 'opportunity', summary: 'The actual private offer.',
        data: { privateWorkTerms: JSON.stringify({ objective: { objectId: 'job-target' } }) } }));
    world.obligations.push(createObligation({ kind: 'oath', cause: 'service_term', severity: 'serious', holderId: 'worker',
        subjectId: 'word-target', onDay: 0, description: 'An actual accepted account.' }));
    const person = createNpc(world.seed, { id: 'searcher', locationId: 'ground', onDay: 0 });
    person.goals.push({ id: 'search', kind: 'discovery', text: 'Find the object.', priority: 1, progress: '', obstacles: [],
        deadlineOnDay: null, status: 'active', targetId: 'search-target', openedOnDay: 0, closedOnDay: null, note: '',
        inheritedFromId: null, originHolderId: person.id, generation: 0 });
    person.activity = { kind: 'their_own_business', note: 'A delivery.', sinceDay: 0, withIds: [], thingId: 'delivery-target' };
    world.npcs.push(person);
    world.objects.push(makeObject({ id: 'holder-object', name: 'The linked container', kind: 'other', data: { itemId: 'object-target' } }));
    expect(collectUnheldCheapObjects(world)).toBe(0);
    expect(world.objects).toHaveLength(7);
});

it('protects the player owner and actual SQL contact ground even with an unplaced world mirror', () => {
    const world = arrangement(), player = createNpc(world.seed, { id: 'player', locationId: null, onDay: 0, tags: [PLAYER_ROW_TAG] });
    world.npcs.push(player);
    world.locations.push(makeLocation({ id: 'elsewhere', name: 'Elsewhere', kind: 'wilds' }));
    world.objects.push({ ...lost('player-owned', 'elsewhere'), ownerId: player.id }, lost('underfoot'), lost('elsewhere-trash', 'elsewhere'));
    resolveWithPlayerPresent(world, { placeId: 'ground', areaId: 'area', person: player }, () => {
        expect(collectUnheldCheapObjects(world)).toBe(1);
    });
    expect(world.objects.map(object => object.id)).toEqual(['player-owned', 'underfoot']);
});

it('an unknown creation date waits from its actual first observation, and a later loss restarts its age', () => {
    const world = arrangement();
    world.objects.push(makeObject({ id: 'undated', name: herb.name, kind: 'material', locationId: 'ground', data: { materialId: herb.id } }));
    expect(collectUnheldCheapObjects(world)).toBe(0);
    world.currentDay += 364;
    expect(collectUnheldCheapObjects(world)).toBe(0);
    world.objects[0] = transferPossession(world.objects[0], { toHolderId: 'person', toHolderName: 'A person', onDay: world.currentDay, how: 'found' });
    world.objects[0] = transferPossession(world.objects[0], { toHolderId: null, toHolderName: 'nobody', onDay: world.currentDay + 1, how: 'lost' });
    world.currentDay += 1;
    expect(collectUnheldCheapObjects(world)).toBe(0);
    world.currentDay += 365;
    expect(collectUnheldCheapObjects(world)).toBe(1);
});

it('the ordinary append writer keeps collected objects and their provenance gone on reopening', () => {
    const world = arrangement(), db = new Database(':memory:');
    try {
        migrate(db);
        const repo = new WorldStateRepository(db);
        world.objects.push(lost('collected'), lost('retained', 'ground', 2));
        repo.saveWorld(world);
        expect(collectUnheldCheapObjects(world)).toBe(1);
        repo.appendWorld(world);
        const resumed = repo.loadWorld(world.id)!;
        expect(resumed.objects.map(object => object.id)).toEqual(['retained']);
        expect(db.prepare('SELECT object_id FROM world_object_provenance WHERE object_id = ?').all('collected')).toEqual([]);
        expect(db.prepare('SELECT object_id FROM world_object_claims WHERE object_id = ?').all('collected')).toEqual([]);
        repo.appendWorld(world);
        expect(repo.loadWorld(world.id)!.objects.map(object => object.id)).toEqual(['retained']);
    } finally { db.close(); }
});
