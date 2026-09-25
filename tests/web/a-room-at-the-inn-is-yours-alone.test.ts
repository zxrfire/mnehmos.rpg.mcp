/**
 * The room you paid for is yours, and nobody else is in it.
 *
 * The owner: "go to your room, sleep, wake up ... in the room is just yourself
 * (unless ur with a party), but you do rest up". Played: "head up to my room"
 * reached a house's interior room somewhere else and was refused, and the sleep
 * after it was dropped with it.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';

const WORLD = 'road-world';

describe('a room at the inn', () => {
    it('is a walk up, with nobody in it, and the night there is rest', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Sleeper');
        await game.act('I take a room at the inn for two nights');
        const before = game.state().run.elapsedDays;

        const up = await game.act('I go up to my room');
        expect(up.narration).toMatch(/to your room at the inn/);
        expect(game.state().run.elapsedDays, 'a walk up the stairs is not a day').toBe(before);
        expect(game.present(repos.cultivators.getById(cultivator.id)!)).toEqual([]);

        const slept = await game.act('I sleep for 2 nights');
        expect(game.state().run.elapsedDays - before).toBe(2);
        expect(slept.narration).not.toMatch(/seclusion|worn the body/);
    }, 120_000);

    it('is somewhere else where no room was taken here', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        const standing = game.state().cultivator.location;

        // Not lodged, "my room" is the home read's to answer - a house's quarters, or nowhere.
        const up = await game.act('I go up to my room');
        expect(game.state().cultivator.location).toBe(standing);
        expect(up.narration).not.toMatch(/your room at the inn/);
    }, 120_000);

    // Played: "sweet, ill grab a room for tonight then" came from the model as a buy of the inn's
    // own name, and nothing on the board is called that.
    it('is taken when the model buys the inn by its name', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"buy","target":"The Eleven Beds"}'], narrations: ['The opening.', 'A room.']
        });
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD, provider });
        await game.newRun('Sleeper');
        await game.act('sweet, ill grab a room for tonight then');
        expect(game.state().log.some(entry => entry.role === 'engine' && /^A room at /.test(entry.text))).toBe(true);
    }, 120_000);

    it('comes back down to the inn', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        await game.act('I take a room at the inn');
        await game.act('I go up to my room');

        const down = await game.act('I go downstairs');
        expect(down.narration).toMatch(/from your room at the inn to /);
    }, 120_000);
});
