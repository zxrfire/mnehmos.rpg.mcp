/**
 * Repeated harness seeds used to rebuild the entire world. Reusing setup must
 * preserve the freshly seeded database and must never share mutable state:
 * another harness with the same world id previously inherited stale handles.
 * Compare both paths in this test, and mutate both SQLite and the held graph.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { makeGame, makeGameInWorld } from './harness.js';
import { activeWorld, createWorld, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import type Database from 'better-sqlite3';

const opened: Database.Database[] = [];
afterEach(() => {
    resetCultivationWorlds();
    for (const db of opened.splice(0)) db.close();
});

describe('a fresh world snapshot', () => {
    it('equals a newly seeded world from the same seed', async () => {
        const seed = 'fresh-snapshot-equivalence';
        const copied = await makeGameInWorld({ worldSeed: seed });
        opened.push(copied.db);
        const copiedWorld = new WorldStateRepository(copied.db).loadWorld(`world-${seed}`);
        expect(copiedWorld).not.toBeNull();

        const fresh = makeGame({ worldEnabled: true });
        opened.push(fresh.db);
        await createWorld({ seed });
        const freshWorld = (await activeWorld()).state;
        expect(copiedWorld).toEqual(freshWorld);
    });

    it('isolates databases, world graphs and ambient handles for the same seed', async () => {
        const options = { worldSeed: 'fresh-snapshot-isolation', seed: 'snapshot-run' };
        const first = await makeGameInWorld(options);
        opened.push(first.db);
        const firstRun = await first.game.newRun('First');
        const firstWorld = (await first.game.loadWorld())!;
        const personId = firstWorld.npcs.find(n => n.id !== firstRun.cultivator.id)!.id;
        const originalName = firstWorld.npcs.find(n => n.id === personId)!.name;

        const second = await makeGameInWorld(options);
        opened.push(second.db);
        const secondRun = await second.game.newRun('Second');
        const secondWorld = (await second.game.loadWorld())!;
        const untouched = JSON.parse(JSON.stringify(secondWorld));
        const untouchedStored = new WorldStateRepository(second.db).loadWorld(secondWorld.id);
        const purse = second.repos.cultivators.getById(secondRun.cultivator.id)!.spiritStones;

        await first.game.act('I look around');
        first.game.atHand!.npcs.find(n => n.id === personId)!.name = 'Changed in one harness';
        first.game.theWorldMoved();
        first.db.prepare('UPDATE cultivators SET spirit_stones = spirit_stones + 123 WHERE id = ?')
            .run(firstRun.cultivator.id);
        expect(new WorldStateRepository(first.db).loadWorld(firstWorld.id)!.npcs
            .find(n => n.id === personId)!.name).toBe('Changed in one harness');

        expect(secondWorld).toEqual(untouched);
        expect(new WorldStateRepository(second.db).loadWorld(secondWorld.id)).toEqual(untouchedStored);
        expect(second.repos.cultivators.getById(secondRun.cultivator.id)!.spiritStones).toBe(purse);
        await second.game.act('I look around');
        expect(second.game.atHand!.npcs.find(n => n.id === personId)!.name).toBe(originalName);

        const third = await makeGameInWorld(options);
        opened.push(third.db);
        expect(new WorldStateRepository(third.db).loadWorld(firstWorld.id)!.npcs
            .find(n => n.id === personId)!.name).toBe(originalName);
    });
});
