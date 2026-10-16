import { createNpc } from '../../src/engine/world/npc-state.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
/**
 * Words put to a whole room are answered by three at most.
 *
 * The set loop ran the act once per person standing there, so a question
 * put to a square of twenty-eight came back as twenty-eight answers. The
 * owner caps a room at three.
 * The owner later exempted actual party members from the three other people.
 * This lone-player guard arranges three real people in the same actual area;
 * a conversation reference does not move someone into the player?s area.
 * Arrange extra people at the same place and verify the greeting still reaches
 * only the three presented, rather than requiring an overfull scene.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';

async function putToTheRoom(intent: string) {
    const provider = new ScriptedProvider({
        plans: [JSON.stringify({ action: 'interact', target: 'everyone here', intent })],
        narrations: ['(scripted)']
    });
    const { game, repos } = await makeGameInWorld({ seed: 'intro-1', worldSeed: 'road-world', provider });
    const { cultivator } = await game.newRun('Probe');
    await game.act('I wait');
    // Put extra people with the player without relying on catalog population.
    const world = game.atHand ?? (await game.loadWorld())!;
    const town = world.locations.find(row => row.name === cultivator.location)!;
    const area = theAreasOf(world, town).areas.find(row => row.for === 'market')
        ?? theAreasOf(world, town).areas[0]!;
    repos.cultivators.standIn(cultivator.id, area.id);
    const day = Math.floor(world.currentDay);
    for (let n = 0; n < 3; n++) {
        const npc = createNpc(world.seed, { id: `room-visitor-${n}`, locationId: town.id,
            onDay: day, bornOnDay: day - 20 * 365 });
        npc.activity = { kind: 'talking', note: 'talking with a newcomer', withIds: [cultivator.id],
            sinceDay: day, untilDay: world.currentDay + 1, standingIn: area.id };
        world.npcs.push(npc);
    }
    game.theWorldMoved();
    const standing = game.present(game.currentRun().cultivator).length;
    const atPlace = world.npcs.filter(n => n.status === 'alive' && n.locationId === town.id).length;
    const done = await game.act('I greet everyone here');
    return { standing, done, atPlace };
}

describe('a room answers three at most', () => {
    it('presents three and lets those three answer a greeting', async () => {
        const { standing, done, atPlace } = await putToTheRoom('talk');
        expect(atPlace).toBeGreaterThan(3);
        expect(standing).toBe(3);
        const answered = done.toolCalls.filter(call => call.name === 'engine.resolveParty');
        expect(answered).toHaveLength(3);
    }, 300_000);
});
