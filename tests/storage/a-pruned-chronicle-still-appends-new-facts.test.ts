/**
 * Run3 door controls broke a real lock but lost the deed on reopening.
 * Retention had shortened history; appendWorld then used the SQL row COUNT
 * as an array position and skipped the new fact. IDs remain monotonic, but
 * their positions do not. A balanced removal/addition must not hide removal.
 */
import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { createWorld } from '../../src/engine/world/world-state';
import { appendFact, makeFact } from '../../src/engine/world/history';
import { keepTheBusinessStillOnTheBooks } from '../../src/engine/world/the-business-the-world-still-keeps';

it('appends sparse new IDs and preserves actual retention on repeated reopen', () => {
    const db = new Database(':memory:');
    try {
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);
        const world = createWorld({ seed: 'pruned-append', presentYear: 5, skipPriorAges: true });
        const other = createWorld({ seed: 'other-pruned-append', presentYear: 5, skipPriorAges: true });
        const old = appendFact(world.history, makeFact({ day: 0, kind: 'opportunity',
            summary: 'An expired public mission docket.', actors: [{ id: 'clerk', name: 'Clerk', role: 'posted' }],
            data: { publicMission: true } }));
        const held = appendFact(world.history, makeFact({ day: world.currentDay, kind: 'object_destroyed',
            summary: 'An actual physical breach.' }));
        other.history = structuredClone(world.history);
        repo.saveWorld(world); repo.saveWorld(other);
        keepTheBusinessStillOnTheBooks(world);
        expect(world.history.facts.map(fact => fact.id)).not.toContain(old.id);
        const fresh = appendFact(world.history, makeFact({ day: world.currentDay, kind: 'object_destroyed',
            summary: 'A second actual breach after the sweep.' }));
        // Removal and addition balance: the old count alone reveals nothing.
        expect(world.history.facts).toHaveLength(2);
        for (let pass = 0; pass < 2; pass++) {
            repo.appendWorld(world);
            const reopened = repo.loadWorld(world.id)!;
            expect(reopened.history.facts).toEqual([held, fresh]);
            expect(reopened.history.nextFactSeq).toBe(world.history.nextFactSeq);
            expect(db.prepare('SELECT fact_id FROM world_chronicle_actors WHERE world_id = ? AND fact_id = ?')
                .all(world.id, old.id)).toEqual([]);
            expect(repo.loadWorld(other.id)!.history).toEqual(other.history);
        }
    } finally { db.close(); }
});
