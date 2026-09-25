/**
 * Delivery missions: a house sends goods to a house under the same apex, any rung of its own may
 * carry them, and a late handover costs the pay, merit and face. The owner: "you can imagine sects
 * sending out delivery missions too, especially amongst sects under the same apex", "you can take
 * any job, you figure out how to do it ... DEFINITELY lose face", "the larger the fumble the
 * greater the loss of face". And never a stranger: "a sect doesn't give delivery missions to
 * outsiders", "cuz that requires risking the sects own property".
 */
import { describe, expect, it } from 'vitest';

import {
    HOW_LONG_A_HOUSE_WAITS_ON_A_LATE_DELIVERY,
    THE_FACE_A_FUMBLE_TAKES,
    whatAHouseSendsItsSisters,
    whatALateDeliveryCosts,
    whatAWrittenOffDeliveryCosts
} from '../../src/engine/world/what-a-house-sends-its-sisters';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { faceOf } from '../../src/engine/world/what-a-face-is-worth';
import { makeGameInWorld } from './harness';
import { sectBoardFor } from '../../src/web/encounters';

async function standingAtAHouseThatSends(seed: string, onTheRoll = true) {
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
    if (onTheRoll) {
        repos.sects.addMember(sending.house.id, cultivator.id, 0);
        repos.cultivators.update(cultivator.id, { sectId: sending.house.id });
    }
    return { game, repos, db, cultivator, consignment: sending.goods!, seat };
}

describe('a house sends goods to its sisters', () => {
    it('is on the board, signed for onto a back, and paid for on time at the house it was for', async () => {
        const { game, repos, cultivator, consignment } = await standingAtAHouseThatSends('a-delivery');
        // Read off the board itself: how many lines a read prints is the board's, not the job's.
        const board = sectBoardFor({ repos, knowledge: game.knowledge, world: game.atHand },
            repos.cultivators.getById(cultivator.id)!);
        const offered = board.offers.find(offer => offer.entry.id === consignment.id);
        expect(offered?.entry.name).toMatch(new RegExp(`^Deliver ${consignment.goods} to the .* by day \\d+$`));
        expect(offered?.entry.tags).toContain('wants:a back');

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

    it('is never handed to a stranger, who reads why and what would change it', async () => {
        const { game, repos, cultivator, consignment } = await standingAtAHouseThatSends('a-delivery-for-its-own', false);
        const board = sectBoardFor({ repos, knowledge: game.knowledge, world: game.atHand },
            repos.cultivators.getById(cultivator.id)!);
        expect(board.offers.some(offer => offer.entry.id === consignment.id)).toBe(false);
        const refused = board.refusals.find(row => row.entryId === consignment.id);
        expect(refused?.name).toMatch(new RegExp(`^Deliver ${consignment.goods} to .* by day \\d+$`));
        expect(refused?.reason).toMatch(/sends its goods with its own.*a place on its roll/);
    }, 240_000);

    it('writes off a delivery never brought, once, and breaks the word given for it', async () => {
        const { game, repos, db, cultivator, consignment } = await standingAtAHouseThatSends('a-delivery-never-brought');
        await game.act(`I take the ${consignment.goods.replace(/^(?:an?|the) /, '')} delivery`);
        const goods = () => game.atHand!.objects.find(row => row.name === consignment.goods && row.data.carrierId === cultivator.id);
        expect(goods()?.tags).toContain('consignment');

        const face = () => faceOf(game.atHand!.npcs.find(row => row.id === cultivator.id)!);
        const before = face();
        repos.runs.advanceDays(game.currentRun().run.id,
            consignment.days + HOW_LONG_A_HOUSE_WAITS_ON_A_LATE_DELIVERY[consignment.wants] + 1);
        const turn = await game.act('I look around');
        expect(turn.narration).toMatch(/has written off .* never brought/);
        expect(goods()?.tags).toContain('written-off');
        expect(face()).toBeCloseTo(before - THE_FACE_A_FUMBLE_TAKES.slight);
        const rows = ledgerAbout(db as never, cultivator.id);
        expect(rows.some(row => row.kind === 'oath' && row.tags.includes(consignment.id) && row.status === 'settled')).toBe(true);
        expect(rows.some(row => row.tags.includes(consignment.id) && row.tags.includes('lapsed'))).toBe(true);

        // Once: the word is broken and settled, and the next turn says nothing more of it.
        const again = await game.act('I look around');
        expect(again.narration).not.toMatch(/has written off/);
    }, 240_000);

    /** The owner: "if you return the written off goods, you save face". */
    it('saves the face a write-off cost when the goods go back to the house that sent them', async () => {
        const { game, repos, db, cultivator, consignment, seat } = await standingAtAHouseThatSends('a-delivery-brought-back');
        await game.act(`I take the ${consignment.goods.replace(/^(?:an?|the) /, '')} delivery`);
        const goods = () => game.atHand!.objects.find(row => row.name === consignment.goods && row.data.carrierId === cultivator.id);
        const face = () => faceOf(game.atHand!.npcs.find(row => row.id === cultivator.id)!);
        const before = face();
        repos.cultivators.update(cultivator.id, { location: consignment.toPlace });
        repos.runs.advanceDays(game.currentRun().run.id,
            consignment.days + HOW_LONG_A_HOUSE_WAITS_ON_A_LATE_DELIVERY[consignment.wants] + 1);
        await game.act('I look around');
        expect(face()).toBeLessThan(before);

        // Not at the house that sent them, they are not taken.
        const elsewhere = await game.act('i return the goods');
        expect(elsewhere.narration).toMatch(/written off/);
        expect(goods()?.tags).toContain('written-off');

        repos.cultivators.update(cultivator.id, { location: seat.name });
        const back = await game.act('i return the goods');
        expect(back.narration).toMatch(/saves the face/);
        expect(goods()?.tags).toContain('returned');
        expect(face()).toBeCloseTo(before);
        const grudge = ledgerAbout(db as never, cultivator.id).find(row => row.tags.includes(consignment.id) && row.tags.includes('lapsed'));
        expect(grudge?.status).toBe('settled');
    }, 240_000);

    it('waits longer the bigger the load, then takes the pay back, and loses more face for goods lost', () => {
        const back = { wants: 'a back' as const, contribution: 100 };
        const wait = HOW_LONG_A_HOUSE_WAITS_ON_A_LATE_DELIVERY;
        expect(wait['a back']).toBeLessThan(wait['a carriage']);
        expect(wait['a carriage']).toBeLessThan(wait['a spirit boat']);
        expect(whatAWrittenOffDeliveryCosts(back, wait['a back'], true)).toBeNull();
        expect(whatAWrittenOffDeliveryCosts({ wants: 'a spirit boat', contribution: 100 }, wait['a back'] + 1, true)).toBeNull();
        expect(whatAWrittenOffDeliveryCosts(back, wait['a back'] + 1, true))
            .toEqual({ face: 'slight', contribution: 100, lost: false });
        expect(whatAWrittenOffDeliveryCosts(back, wait['a back'] + 1, false))
            .toEqual({ face: 'serious', contribution: 100, lost: true });
    });

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
