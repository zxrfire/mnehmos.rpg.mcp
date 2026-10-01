/**
 * Words put to a whole room are answered by three at most.
 *
 * The set loop ran the act once per person standing there, so a question
 * put to a square of twenty-eight came back as twenty-eight answers. The
 * owner caps a room at three.
 * The live roster now caps the scene itself at three, including companions.
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
    const { game } = await makeGameInWorld({ seed: 'intro-1', worldSeed: 'road-world', provider });
    const { cultivator } = await game.newRun('Probe');
    await game.act('I wait');
    // Put extra people with the player without relying on catalog population.
    const world = game.atHand ?? (await game.loadWorld())!;
    const here = new Set(game.present(cultivator).map(row => row.id));
    const town = world.locations.find(row => row.name === cultivator.location)!;
    const day = Math.floor(world.currentDay);
    for (const npc of world.npcs.filter(n => n.status === 'alive' && !here.has(n.id)).slice(0, 3)) {
        npc.locationId = town.id;
        npc.activity = { kind: 'talking', note: 'talking with a newcomer', withIds: [cultivator.id], sinceDay: day, untilDay: null };
    }
    game.theWorldMoved();
    const standing = game.present(cultivator).length;
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
