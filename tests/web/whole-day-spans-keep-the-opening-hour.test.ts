/**
 * The run3 admission trace advanced a whole-day mortal wait from the stored
 * midnight instead of its displayed08:00. The second portion then used an
 * unobserved catch-up to cross the actual calendar date, losing local news.
 * A whole-day action must prepare the actual native opening clock before its
 * body portions, just as a fractional action does. Local and remote NPC-only
 * meetings fire through that real clock; only the local report reaches the PC.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { makeScheduledEffect } from '../../src/engine/world/world-state.js';
import { worldLocationFor } from '../../src/web/entities.js';

it('a whole-day wait retains its actual starting hour and witnessed local news', async () => {
    const h = await makeGameInWorld({ seed: 'whole-day-news-observer', worldSeed: 'whole-day-news-ground' });
    try {
        await h.game.newRun('Observer');
        const current = h.game.currentRun();
        const world = h.game.atHand!;
        h.game.atHand = world;
        const ground = worldLocationFor(world, current.cultivator.location);
        if (!ground) throw new Error('The observer must stand on actual world ground.');
        const remote = world.locations.find(place => place.id !== ground.id && place.kind === 'settlement');
        if (!remote) throw new Error('The remote control needs another actual settlement.');
        const participant = createNpc(world.seed, {
            id: 'local-news-participant', name: 'Lan Sheng', locationId: ground.id,
            bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay
        });
        const distantParticipant = createNpc(world.seed, {
            id: 'remote-news-participant', name: 'Wen Shu', locationId: remote.id,
            bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay
        });
        world.npcs.push(participant, distantParticipant);
        const due = Math.floor(world.currentDay) + 1;
        const meetings = [
            ['observer-local-meeting', ground, participant, 'A gathering is announced in this square.'],
            ['observer-remote-meeting', remote, distantParticipant, 'A gathering is announced in the distant square.']
        ] as const;
        for (const [id, place, actor, sentence] of meetings) {
            world.schedule.push(makeScheduledEffect({
                id, kind: 'meeting', dueOnDay: due, locationId: place.id,
                actorIds: [actor.id], summary: sentence,
                data: { scale: 'local', unattributed: sentence }
            }));
        }
        h.game.theWorldMoved();
        const turn = await h.game.act('I wait one day');
        const actual = (await h.game.loadWorld())!;
        for (const [id, place, actor] of meetings) {
            const fact = actual.history.facts.find(one => one.data.scheduledEffectId === id);
            expect(fact, 'the actual clock must fire both controls').toBeDefined();
            expect(fact!.day).toBe(due);
            expect(fact!.locationId).toBe(place.id);
            expect(fact!.actors.map(one => one.id)).toEqual([actor.id]);
            expect(fact!.witnessIds).not.toContain(current.cultivator.id);
        }
        expect(worldLocationFor(actual, h.game.currentRun().cultivator.location)?.id).toBe(ground.id);
        const receipts = turn.toolCalls.filter(call => call.name === 'world.advanceWorldForPlay');
        expect(receipts.some(call => call.summary.includes('via visible'))).toBe(true);
        expect(turn.narration).toContain('A gathering is announced in this square.');
        expect(turn.narration).not.toContain('A gathering is announced in the distant square.');
    } finally {
        h.db.close();
    }
});
