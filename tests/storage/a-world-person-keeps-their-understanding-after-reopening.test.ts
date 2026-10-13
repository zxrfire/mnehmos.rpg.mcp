/**
 * The 500-year storage controls found learned NPC insights absent after reload.
 * Understanding affects both crossing a wall and combat, so reopening must keep
 * the learned degree and every event in its provenance. These controlled rows
 * distinguish never-recorded understanding from an explicitly emptied list.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo';
import { createWorld } from '../../src/engine/world/world-state';
import { createNpc } from '../../src/engine/world/npc-state';
import { AchievementSchema, InsightSchema } from '../../src/schema/cultivation';

describe('a world person keeps their understanding on reopening', () => {
    it('retains learned and deepened provenance on both snapshot and ordinary writes', () => {
        const db = new Database(':memory:');
        try {
            migrate(db);
            migrate(db);
            const repo = new WorldStateRepository(db);
            const world = createWorld({ seed: 'npc-understanding-reopening', skipPriorAges: true, regionCount: 0 });
            const person = createNpc(world.seed, { id: 'learner', onDay: 0, bornOnDay: -7300 });
            world.npcs.push(person);
            repo.saveWorld(world);
            expect(repo.loadWorld(world.id)!.npcs[0]!.cultivation.insights).toBeUndefined();
            expect(repo.loadWorld(world.id)!.npcs[0]!.cultivation.achievements).toBeUndefined();
            const taught = AchievementSchema.parse({ id: 'instruction', kind: 'extraordinary_instruction',
                onDay: 0, turn: 0, summary: 'The teacher demonstrated the water form.' });
            const insight = InsightSchema.parse({ id: 'water-insight', domain: 'element', subject: 'water',
                degree: 1, provenance: { achievementId: taught.id, achievementKind: taught.kind,
                    onDay: 0, deepenedBy: [], account: taught.summary } });
            person.cultivation.insights = [insight];
            person.cultivation.achievements = [taught];
            repo.saveWorld(world);
            expect(repo.loadWorld(world.id)!.npcs[0]!.cultivation).toEqual(person.cultivation);
            const deepening = AchievementSchema.parse({ ...taught, id: 'later-instruction', onDay: 1 });
            person.cultivation.insights = [{ ...insight, degree: 2,
                provenance: { ...insight.provenance, deepenedBy: [deepening.id] } }];
            person.cultivation.achievements.push(deepening);
            repo.appendWorld(world);
            expect(repo.loadWorld(world.id)!.npcs[0]!.cultivation).toEqual(person.cultivation);
            person.cultivation.insights = [];
            person.cultivation.achievements = [];
            repo.appendWorld(world);
            expect(repo.loadWorld(world.id)!.npcs[0]!.cultivation.insights).toEqual([]);
            expect(repo.loadWorld(world.id)!.npcs[0]!.cultivation.achievements).toEqual([]);
        } finally { db.close(); }
    });
});
