/**
 * The played passage-tally control removed its item and delivered dust once,
 * but ordinary world writes left the SQLite row behind. A restart could return
 * that consumed item. Objects are current inventory: deleting one also deletes
 * its claim and provenance rows, without deleting the event or another world's
 * object with the same id. Equal inventory sizes do not imply equal objects.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { createWorld } from '../../src/engine/world/world-state';
import { assertClaim, makeResourceLot } from '../../src/engine/world/possessions';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';

describe('ordinary writes persist physical item deletion', () => {
    it('removes its entire physical row without erasing the event or another world', () => {
        const db = new Database(':memory:');
        try {
            db.pragma('foreign_keys = ON');
            migrate(db);
            const repo = new WorldStateRepository(db);
            const world = createWorld({ seed: 'consumed-object-world' });
            const other = createWorld({ seed: 'other-consumed-object-world' });
            const object = assertClaim(makeResourceLot({ id: 'same-object-id', resource: 'jade',
                quantity: 1, source: 'A purchase', acquiredOnDay: world.currentDay,
                holderId: 'holder', holderName: 'Holder', how: 'bought' }),
                { claimantId: 'holder', claimantName: 'Holder', basis: 'purchase',
                    assertedOnDay: world.currentDay });
            world.objects.push(object);
            other.objects.push(structuredClone(object));
            repo.saveWorld(world);
            repo.saveWorld(other);
            const fact = appendWorldFact(world, makeFact({ day: world.currentDay,
                kind: 'object_destroyed', summary: 'The made token went to dust.',
                data: { tokenId: object.id } }), { bystanders: false, recur: false });
            // Replacement deliberately keeps the inventory count unchanged.
            world.objects = world.objects.filter(row => row.id !== object.id);
            world.objects.push({ ...structuredClone(object), id: 'new-object-id',
                claims: [], provenance: [] });
            repo.appendWorld(world);
            repo.appendWorld(world);
            const reopened = repo.loadWorld(world.id)!;
            expect(reopened.objects.map(row => row.id)).not.toContain(object.id);
            expect(reopened.objects.some(row => row.id === 'new-object-id')).toBe(true);
            expect(reopened.history.facts.some(row => row.id === fact.id)).toBe(true);
            for (const table of ['world_objects', 'world_object_claims', 'world_object_provenance']) {
                const column = table === 'world_objects' ? 'id' : 'object_id';
                expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE world_id = ? AND ${column} = ?`)
                    .get(world.id, object.id)).toEqual({ n: 0 });
                expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE world_id = ? AND ${column} = ?`)
                    .get(other.id, object.id)).toEqual({ n: 1 });
            }
        } finally { db.close(); }
    });
});
