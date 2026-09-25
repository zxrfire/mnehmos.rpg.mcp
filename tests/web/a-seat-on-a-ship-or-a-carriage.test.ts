/**
 * Ships from a landing and carriages from a station: read the board, buy a seat or
 * hire the whole carriage, and ride under a roof with meals on board.
 *
 * The owner: "you are able to get on boats (you buy a ticket)", "have ticket booth
 * npc's for boats and carriages", and "they deal with bandits, bandits see and they
 * scurry off", against "you go alone, you risk it". Then: water is a ship ("spirit
 * skiff = genre flying boat"), a seat carries only what a passenger carries on their
 * person and a hired carriage carries the rest, and a band big enough to take the
 * escort on attacks, and is fought as a group with at most three in the foreground.
 *
 * Played on `road-world`. A new run opens at The Furnace Flank, three days on foot
 * down the arms road from Emerald Water City, whose river mouth is a lane to Sweet
 * Spring Island. The seeds for a band are pinned: `booth-0` meets one that
 * withdraws from a ship, and `hire-37` one of five that attacks a hired carriage on
 * the first day to Moraine Gate (found by sweeping sixty seeds, of which four attacked).
 */

import { describe, expect, it } from 'vitest';

import { makeObject } from '../../src/engine/world/possessions';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

const WORLD = 'road-world';

describe('a seat on a ship or a carriage', () => {
    it('reads the carriage station at the town, with who keeps it', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Rider');

        const done = await game.act('what carriages are there');

        expect(done.narration).toMatch(/keeps the carriage station/);
        expect(done.narration).toMatch(/Emerald Water City by carriage: 2 days \(3 on foot\), \d+ cash a seat/);
        expect(game.state().run.elapsedDays).toBe(0);
    }, 120_000);

    it.each(['I book a carriage to Emerald Water City', 'I take a carriage to Emerald Water City'])(
        'rides a paid seat under a roof, fed on board: "%s"', async said => {
            const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
            await game.newRun('Rider');
            const before = game.state().cultivator;

            const done = await game.act(said);
            const after = game.state().cultivator;

            expect(after.location).toBe('Emerald Water City');
            expect(game.state().run.elapsedDays).toBe(2);
            expect(after.spiritStones).toBeLessThan(before.spiritStones);
            expect(after.hp).toBe(before.hp);
            expect(after.satiety).toBe(100);
            expect(done.narration).toMatch(/Meals were taken on board/);
            expect(done.narration).not.toMatch(/in the open (?:has|have) worn the body/);
        }, 120_000);

    it('sails the lane from the river mouth, and a band that sees the ship withdraws', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'booth-0', worldSeed: WORLD });
        await game.newRun('Rider');
        db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 500 WHERE id = ?")
            .run(game.state().cultivator.id);

        const board = await game.act('what ships are there');
        expect(board.narration).toMatch(/Sweet Spring Island by ship: 9 days/);

        const done = await game.act('I take the ship to Sweet Spring Island');

        expect(game.state().cultivator.location).toBe('Sweet Spring Island');
        expect(done.narration).toMatch(/watched the ship and its guards go by on day \d+, and withdrew/);
        expect(done.narration).not.toMatch(/attacks you/);
    }, 120_000);

    it('fights a band big enough to take on a hired carriage, three in the foreground and the rest said', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'hire-37', worldSeed: WORLD });
        await game.newRun('Rider');
        db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 5000, realm_ordinal = 1 WHERE id = ?")
            .run(game.state().cultivator.id);

        const done = await game.act('I hire a carriage to Moraine Gate');

        expect(done.narration).toMatch(/A band of \d+ attacked the carriage on day \d+\. Its leader came at you\./);
        expect(done.narration).toMatch(/A guard fights beside you against a second of the band/);
        expect(done.narration).toMatch(/Around the carriage, \d+ guards? and \d+ of the band fight it out/);
        expect(done.narration).toMatch(/attacks you\. The fight is open/);
        expect(game.state().cultivator.location).toBe('Emerald Water City');
    }, 120_000);

    it('refuses a seat to more than a passenger carries, and a hired carriage takes it', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Rider');
        for (let n = 0; n < 20; n++) {
            game.atHand!.objects.push(makeObject({ id: `sword-${n}`, name: 'an iron sword', kind: 'artifact',
                power: 1, volume: 3, weight: 1.5, possessorId: cultivator.id, ownerId: cultivator.id }));
        }

        const seat = await game.act('I book a carriage to Emerald Water City');
        expect(seat.narration).toMatch(/A seat carries you and what you can carry on your own person/);
        expect(seat.narration).toMatch(/Hired whole, a drawn carriage carries the rest: \d+ stones/);
        expect(game.state().cultivator.location).toBe('The Furnace Flank');

        await game.act('I hire a carriage to Emerald Water City');
        expect(game.state().cultivator.location).toBe('Emerald Water City');
    }, 120_000);

    it('says when a lane is not worked, and on what day it is', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Rider');
        db.prepare("UPDATE cultivators SET location = 'Salt Fields', spirit_stones = 500 WHERE id = ?")
            .run(game.state().cultivator.id);

        const done = await game.act('I take the ship to Moraine Gate');

        expect(done.narration).toMatch(/The first ship sails on day \d+; today is day 0/);
        expect(game.state().cultivator.location).toBe('Salt Fields');
    }, 120_000);

    it('reads the ways a player asks for a ship or a carriage', () => {
        expect(parseIntent('what ships are there')).toMatchObject({ action: 'passage', intent: 'board' });
        expect(parseIntent('where do the boats go')).toMatchObject({ action: 'passage', intent: 'board' });
        expect(parseIntent('I take the ship to Sweet Spring Island'))
            .toMatchObject({ action: 'passage', intent: 'buy', target: 'Sweet Spring Island' });
        expect(parseIntent('I buy a ticket to Sweet Spring Island'))
            .toMatchObject({ action: 'passage', intent: 'buy', target: 'Sweet Spring Island' });
        expect(parseIntent('I book a carriage to Emerald Water City'))
            .toMatchObject({ action: 'passage', intent: 'buy', target: 'Emerald Water City' });
        expect(parseIntent('I hire an iron-rimmed carriage to Emerald Water City'))
            .toMatchObject({ action: 'passage', intent: 'hire', topic: 'iron-rimmed carriage' });
        expect(parseIntent('what boats could I build here').action).not.toBe('passage');
    });
});
