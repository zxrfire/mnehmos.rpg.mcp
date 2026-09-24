/**
 * "No road goes there", about a man standing an arm's length away.
 *
 * FOUND BY PLAYING, on the parting - the beat an opening is built around:
 *
 *     "I go back to He Xuxue and kneel before him. Grandfather, I leave with
 *      the caravan tomorrow."
 *
 * The kneel resolved and landed on him. The first clause went to the travel
 * verb, because "go back to <name>" is what the table reads and the table
 * cannot see who is in the room, and the turn was spent on *"No road goes
 * there. Unresolved destination 'He Xuxue'"*.
 *
 * Going back to somebody you are already standing with is crossing a room. It
 * is not a road and it costs no day. It is also the sentence people open a
 * parting or an apology with, which is why it is worth a beat rather than a
 * refusal.
 *
 * ── AND IT HAS TO BE THE ENGINE, NOT THE TABLE ───────────────────────────
 *
 * `I go back to He Xuxue` and `I go back to the market` are the same sentence
 * to the reader - both `move/travel` - and nothing in the words separates
 * them. Who is standing here is the world's to know, so the answer is where
 * the world is.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

describe('going back to somebody standing here', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('crosses to them instead of looking for a road', async () => {
        const { game } = await makeGameInWorld({
            seed: 'crossing', worldSeed: 'parting', adminMode: true
        });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');
        await game.act('ADMIN spawn_encounter ordinal=8 name=He Xuxue');

        const before = game.state().run.elapsedDays;
        const done = await game.act('I go back to He Xuxue');

        expect(said(done), said(done)).not.toMatch(/No road goes there/i);
        expect(said(done)).not.toMatch(/Unresolved destination/i);
        expect(said(done)).toMatch(/He Xuxue/);
        // Crossing a room is not a journey.
        expect(game.state().run.elapsedDays).toBe(before);
    }, 120_000);

    /**
     * AND A NAME NOBODY HERE ANSWERS TO IS STILL A NAME WITH NO ROAD. The
     * refusal above it is doing its job - "I follow the cultivator" once moved
     * a player to a location called `cultivator` and spent the days - and a
     * fix that reached past it would be worse than the defect.
     */
    it('still refuses a name that is nobody standing here', async () => {
        const { game } = await makeGameInWorld({
            seed: 'crossing-miss', worldSeed: 'parting', adminMode: true
        });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');

        const done = await game.act('I go back to Ruan Qifeng of the Ninth Abyss');
        // The refusal has several wordings depending on whether the square is
        // empty and whether the name is one this cultivator has heard of, so
        // what is asserted is that nobody was crossed to and no day was spent.
        expect(said(done)).not.toMatch(/cross to/i);
        expect(game.state().run.elapsedDays).toBe(0);
    }, 120_000);
});
