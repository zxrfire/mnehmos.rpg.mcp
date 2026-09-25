/**
 * A vehicle in play: with you until you leave it, holding what you load into it, and out of reach
 * from anywhere else. The owner: "when you buy it, you take it with you", and a vehicle is kept
 * like an abode: reachable only while you are with it.
 */
import { describe, expect, it } from 'vitest';

import { aStorageRing } from '../../src/engine/world/a-storage-ring.js';
import { aVehicleOf } from '../../src/engine/world/a-vehicle.js';
import { hadAs, makeObject } from '../../src/engine/world/possessions.js';
import { makeGameInWorld } from './harness.js';

type Turn = { narration?: string; toolCalls: { action: string; ok: boolean }[] };
const ok = (turn: Turn) => turn.toolCalls.some(c => c.action === 'carry' && c.ok);
const refusedIt = (turn: Turn) => turn.toolCalls.some(c => c.action === 'carry' && !c.ok);

describe('a vehicle in play', () => {
    it('holds what is loaded into it, stays where it is left, and is out of reach from elsewhere', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'a-cart', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        objects.push(aVehicleOf({ id: 'cart', conveyanceId: 'conv-carriage-mortal', ownerId: cultivator.id,
            ownerName: 'Ke Yan', at: game.worldPlaceOf(cultivator) }));
        objects.push(makeObject({ id: 'chest', name: 'a lacquered chest', kind: 'other', volume: 40,
            possessorId: cultivator.id, ownerId: cultivator.id }));
        const chest = () => game.atHand!.objects.find(o => o.id === 'chest')!;
        const log = () => game.state().log.slice(-8).map(e => e.text).join(' ');

        expect(ok(await game.act('I put the chest in my cart'))).toBe(true);
        expect(chest().possessorId).toBe('cart');
        await game.act('what am I carrying');
        expect(log()).toMatch(/With you: a drawn carriage[^.]*holding a lacquered chest/i);

        expect(ok(await game.act('I leave my cart here'))).toBe(true);
        // Somewhere else: another settlement than the one it was left in.
        const leftAt = game.worldPlaceOf(repos.cultivators.getById(cultivator.id)!);
        const elsewhere = game.atHand!.locations.find(l => l.kind === 'settlement' && l.id !== leftAt)!;
        repos.cultivators.update(cultivator.id, { location: elsewhere.name });
        expect(game.worldPlaceOf(repos.cultivators.getById(cultivator.id)!)).not.toBe(leftAt);
        await game.act('what am I carrying');
        expect(log()).toMatch(/Left at [^:]+: a drawn carriage[^.]*\. Not reachable from where you are standing/i);
        expect(refusedIt(await game.act('I take the chest out of my cart'))).toBe(true);
        expect(chest().possessorId).toBe('cart');
    }, 240_000);

    it('goes into a ring big enough for it, and comes out beside you', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-boat-in-a-ring', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        objects.push(hadAs(aStorageRing({ id: 'ring', grade: 'heaven', ownerId: cultivator.id, ownerName: 'Ke Yan', ownerOrdinal: 40 }), 'worn'));
        objects.push(aVehicleOf({ id: 'boat', conveyanceId: 'conv-spirit-boat', ownerId: cultivator.id,
            ownerName: 'Ke Yan', at: game.worldPlaceOf(cultivator) }));
        const boat = () => game.atHand!.objects.find(o => o.id === 'boat')!;

        expect(ok(await game.act('I put my boat in my ring'))).toBe(true);
        expect(boat().possessorId).toBe('ring');
        expect(ok(await game.act('I take my boat out of my ring'))).toBe(true);
        expect(boat().possessorId).toBeNull();
        expect(boat().data.withId).toBe(cultivator.id);
    }, 180_000);
});
