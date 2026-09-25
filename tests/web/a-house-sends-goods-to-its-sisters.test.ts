/**
 * Delivery missions: a house sends goods to a house under the same apex, anybody may carry them,
 * and a late handover costs the pay, merit and face. The owner: "you can imagine sects sending out
 * delivery missions too, especially amongst sects under the same apex", "you can take any job, you
 * figure out how to do it ... DEFINITELY lose face", "the larger the fumble the greater the loss
 * of face".
 */
import { describe, expect, it } from 'vitest';

import { whatAHouseSendsItsSisters, whatALateDeliveryCosts } from '../../src/engine/world/what-a-house-sends-its-sisters';
import { makeGameInWorld } from './harness';

async function standingAtAHouseThatSends(seed: string) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const world = game.atHand!;
    const day = Math.floor(world.currentDay);
    // A house sending something a back can carry, so the test is about the job and not the load.
    const sending = world.factions
        .map(house => ({ house, goods: whatAHouseSendsItsSisters(world, house.id, day).find(row => row.wants === 'a back') }))
        .find(row => row.goods !== undefined)!;
    expect(sending, 'no house sends anything a back can carry').toBeDefined();
    const seat = world.locations.find(row => row.id === sending.house.seatLocationId)!;
    repos.cultivators.update(cultivator.id, { location: seat.name });
    return { game, repos, db, cultivator, consignment: sending.goods!, seat };
}

describe('a house sends goods to its sisters', () => {
    it('is on the wall, signed for onto a back, and paid for on time at the house it was for', async () => {
        const { game, repos, cultivator, consignment } = await standingAtAHouseThatSends('a-delivery');
        const read = await game.act('what duties are there');
        const board = read.narration ?? '';
        expect(board).toContain(consignment.goods);
        expect(board).toMatch(/wants a back to carry it/);

        const took = await game.act(`I take the ${consignment.goods.replace(/^(?:an?|the) /, '')} delivery`);
        expect(took.narration).toMatch(/You sign for/);
        const goods = () => game.atHand!.objects.find(row => row.name === consignment.goods && row.data.carrierId === cultivator.id);
        expect(goods()?.possessorId).toBe(cultivator.id);

        const stones = repos.cultivators.getById(cultivator.id)!.spiritStones;
        repos.cultivators.update(cultivator.id, { location: consignment.toPlace });
        await game.act('i hand over the goods');
        expect(goods()?.tags).toContain('delivered');
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones).toBe(stones + consignment.stones);
    }, 240_000);

    it('costs more face the bigger the fumble, and pays nothing late', () => {
        const late = (wants: 'a back' | 'a carriage' | 'a spirit boat') => whatALateDeliveryCosts({ wants, contribution: 100 }, 3)!;
        expect(whatALateDeliveryCosts({ wants: 'a back', contribution: 100 }, 0)).toBeNull();
        expect(late('a back').face).toBe('slight');
        expect(late('a carriage').face).toBe('serious');
        expect(late('a spirit boat').face).toBe('grave');
        expect(late('a back').contribution).toBe(30);
        expect(whatALateDeliveryCosts({ wants: 'a back', contribution: 100 }, 40)!.contribution).toBe(100);
    });
});
