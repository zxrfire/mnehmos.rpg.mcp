/**
 * Food in the player's own pack takes room and weight. The owner: "you can't possibly carry food
 * for a few months without a carriage", and food is tracked only on the player.
 */
import { describe, expect, it } from 'vitest';

import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { makeGameInWorld } from './harness';

describe('food on your back', () => {
    it('is one sack on foot, and a cart carries the rest', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'food-is-carried', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
        const held = () => game.state().derived.things!.inventory.find(line => line.startsWith('Ration'));

        await game.act('I buy food for a couple of months');
        expect(held()).toBe('Ration');
        expect(game.state().log.slice(-6).map(entry => entry.text).join(' ')).toMatch(/as much food as your back will carry/);

        const again = await game.act('I buy food for a couple of months');
        expect(again.toolCalls.some(call => call.action === 'provision' && !call.ok)).toBe(true);
        expect(held()).toBe('Ration');

        game.atHand!.objects.push(aVehicleOf({ id: 'cart', conveyanceId: 'conv-carriage-mortal',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: game.worldPlaceOf(cultivator) }));
        await game.act('I buy food for a couple of months');
        expect(held()).toBe('Ration x3');
    }, 180_000);
});
