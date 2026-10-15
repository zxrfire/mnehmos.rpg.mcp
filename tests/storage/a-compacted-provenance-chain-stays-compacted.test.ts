/**
 * Run3 physical-door controls reloaded duplicate loan links on unrelated
 * counted stock. The yearly sweep shortened two links to the last one, but
 * appendWorld replaced position0 and retained old position1. A reload grew
 * the chain again. Test the storage seam without a yearly walk or a door.
 */
import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { createWorld } from '../../src/engine/world/world-state';
import { makeObject, transferPossession } from '../../src/engine/world/possessions';

it('persists shortened and empty chains without changing another object or world', () => {
    const db = new Database(':memory:');
    try {
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);
        const world = createWorld({ seed: 'compacted-provenance', skipPriorAges: true });
        const other = createWorld({ seed: 'other-provenance', skipPriorAges: true });
        const initial = makeObject({ id: 'stock', name: 'A counted lot', kind: 'material' });
        const found = transferPossession(initial, { toHolderId: 'house', toHolderName: 'The house',
            onDay: 0, how: 'found' });
        const lent = transferPossession(found, { toHolderId: 'borrower', toHolderName: 'The borrower',
            onDay: 1, how: 'lent' });
        world.objects.push(structuredClone(lent), { ...structuredClone(lent), id: 'untouched' });
        other.objects.push(structuredClone(lent));
        repo.saveWorld(world);
        repo.saveWorld(other);
        world.objects[0] = { ...lent, provenance: lent.provenance.slice(-1) };
        for (let pass = 0; pass < 2; pass++) {
            repo.appendWorld(world);
            expect(repo.loadWorld(world.id)!.objects).toEqual(world.objects);
            expect(repo.loadWorld(other.id)!.objects).toEqual(other.objects);
        }
        world.objects[0] = { ...world.objects[0]!, provenance: [] };
        repo.appendWorld(world);
        expect(repo.loadWorld(world.id)!.objects).toEqual(world.objects);
        const later = transferPossession(world.objects[0]!, { toHolderId: 'next', toHolderName: 'Next',
            onDay: 2, how: 'gifted' });
        world.objects[0] = later;
        repo.appendWorld(world);
        expect(repo.loadWorld(world.id)!.objects).toEqual(world.objects);
        expect(repo.loadWorld(other.id)!.objects).toEqual(other.objects);
    } finally { db.close(); }
});
