/**
 * A storage ring in play: worn to be reached into, and what is in it is the ring's. The owner:
 * "wear, but you can also unequip it and put it in your pouch (then you can't retrieve stuff)".
 */
import { describe, expect, it } from 'vitest';

import { aStorageRing } from '../../src/engine/world/a-storage-ring.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { makeGameInWorld } from './harness.js';

const ok = (turn: { toolCalls: { action: string; ok: boolean }[] }) => turn.toolCalls.some(c => c.action === 'carry' && c.ok);
const refusedIt = (turn: { toolCalls: { action: string; ok: boolean }[] }) => turn.toolCalls.some(c => c.action === 'carry' && !c.ok);

describe('a storage ring in play', () => {
    it('opens only on the hand, holds what is put in it, and keeps it when it comes off', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-ring', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const objects = game.atHand!.objects;
        objects.push(aStorageRing({ id: 'ring', grade: 'mortal', ownerId: cultivator.id, ownerName: 'Ke Yan', ownerOrdinal: 1 }));
        objects.push(makeObject({ id: 'sword', name: 'an iron sword', kind: 'artifact', power: 2,
            possessorId: cultivator.id, ownerId: cultivator.id, volume: 3 }));
        const sword = () => game.atHand!.objects.find(o => o.id === 'sword')!;

        expect(refusedIt(await game.act('I put the sword in my ring')), 'into a ring that is not on').toBe(true);
        expect(ok(await game.act('I put on the ring'))).toBe(true);
        expect(ok(await game.act('I put the sword in my ring'))).toBe(true);
        expect(sword().possessorId).toBe('ring');

        const carrying = await game.act('what am I carrying');
        const said = [carrying.narration ?? '', ...game.state().log.slice(-6).map(e => e.text)].join(' ');
        expect(said).toMatch(/In a mortal-grade storage ring: an iron sword/);

        expect(ok(await game.act('I take off the ring'))).toBe(true);
        expect(refusedIt(await game.act('I take the sword out of my ring')), 'out of a ring that is off').toBe(true);
        expect(sword().possessorId).toBe('ring');

        expect(ok(await game.act('I put on the ring'))).toBe(true);
        expect(ok(await game.act('I take the sword out of my ring'))).toBe(true);
        expect(sword().possessorId).toBe(cultivator.id);
    }, 180_000);
});
