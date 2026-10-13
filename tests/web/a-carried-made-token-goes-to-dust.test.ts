/**
 * On 2026-10-10 the owner ruled that a disciple's identity token and life lamp
 * physically crumble at death. A living player carrying another person's token,
 * or standing in the hall, gets one plain line on their next turn. These controls
 * arrange the physical possession or presence, settle an ordinary death, then play
 * the observation twice. The physical item is gone; its witnessed event remains.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { markDead } from '../../src/engine/world/npc-state';
import { settleNpcDeath } from '../../src/engine/world/time';
import { lampIdFor, tokenIdFor } from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token';
import { resolveWithPlayerPresent } from '../../src/engine/world/background-incident-draw';

async function prepared(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'made-tokens-physical-world' });
    const { cultivator } = await h.game.newRun('Observer');
    const world = h.game.atHand!;
    const token = world.objects.find(object => object.tags.includes('identity')
        && typeof object.data.memberId === 'string'
        && world.npcs.some(person => person.id === object.data.memberId && person.status === 'alive'))!;
    expect(token, 'the world must have an actually issued token').toBeDefined();
    const at = world.npcs.findIndex(person => person.id === token.data.memberId);
    const lamp = world.objects.find(object => object.id === lampIdFor(world.npcs[at]!.id))!;
    return { ...h, cultivator, world, token, at, lamp };
}

describe('a carried made token goes to dust', () => {
    it('reports another person\'s carried identity token once and removes it from the pack', async () => {
        const h = await prepared('carried-identity-dust');
        h.token.possessorId = h.cultivator.id;
        const dead = markDead(h.world.npcs[h.at]!, h.world.currentDay, 'Died away from the observer.');
        h.world.npcs[h.at] = dead;
        settleNpcDeath(h.world, dead, h.world.currentDay);
        h.game.theWorldMoved();
        const first = await h.game.act('I check my inventory');
        expect(first.narration).toContain(`${h.token.name} went to dust.`);
        expect(h.game.atHand!.objects.some(object => object.id === tokenIdFor(dead.id))).toBe(false);
        const next = await h.game.act('I check my inventory');
        expect(next.narration).not.toContain(`${h.token.name} went to dust.`);
    });

    it('shows a lamp crumbling in front of the player in the hall, once', async () => {
        const h = await prepared('hall-identity-dust');
        const hall = h.world.locations.find(place => place.id === h.lamp.locationId)!;
        h.repos.cultivators.update(h.cultivator.id, { location: hall.name });
        const dead = markDead(h.world.npcs[h.at]!, h.world.currentDay, 'Died outside the house.');
        h.world.npcs[h.at] = dead;
        resolveWithPlayerPresent(h.world, { placeId: hall.id, areaId: `${hall.id}#here` },
            () => settleNpcDeath(h.world, dead, h.world.currentDay));
        h.game.theWorldMoved();
        const first = await h.game.act('I look around');
        expect(first.narration).toContain(`${h.lamp.name} went to dust.`);
        expect(h.game.atHand!.objects.some(object => object.id === h.lamp.id)).toBe(false);
        const next = await h.game.act('I look around');
        expect(next.narration).not.toContain(`${h.lamp.name} went to dust.`);
        const fact = h.game.atHand!.history.facts.find(row => row.data.lifeLamp === true && row.data.memberId === dead.id)!;
        expect(fact.witnessIds).toContain(h.cultivator.id);
    });
});
