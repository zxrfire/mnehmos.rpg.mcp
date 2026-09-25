/**
 * Eleven days on the road, and nothing on it.
 *
 * FOUND BY PLAYING. A Qi Condensation cultivator travelled eleven days from the
 * grounds to the next province and the engine ruled the days, the arrival, and
 * nothing in between - no traveller, no merchant, no trouble. The design owner:
 * *"you can't just travel ... you meet other travellers, merchants, etc. maybe
 * even a sect party ... bandits, whatever"*, and *"your encounters scale on your
 * realm."*
 *
 * ── TWO THINGS KEPT IT EMPTY, ONE INSIDE THE OTHER ───────────────────────
 *
 * The journey never asked. `'travel'` has always been an encounter activity,
 * with its own profile in the realm-pitched draw; every other span that spends
 * days rolls that window, and the journey alone called the time-skip directly
 * and skipped it.
 *
 * And once it did ask, the window's span check ran on a fifteen-day grid - a
 * cadence for somebody sitting still for a season - so a road shorter than
 * fifteen days that started just after a grid day got one roll at its start and
 * no other. Measured after the first fix: twenty-four journeys, eleven of them
 * eleven days long, and one encounter between all of them. Travel walks on a
 * three-day grid now; nothing else moved.
 *
 * ── AND A ROAD CAN STOP YOU ──────────────────────────────────────────────
 *
 * The owner: *"just treat journey as a multi part action ... if you get
 * interrupted in a multi part action, you stop."* Nothing was built for it. A
 * span that is cut short never moves anybody, which was already true of every
 * broken sitting - so a journey stopped on day nine has spent nine days and
 * arrived nowhere, and the rest of the road is still ahead.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

const WORLD = 'road-world';
const WHERE = 'I travel to the Buddha Precipice';

describe('a road has things on it', () => {
    /**
     * THE OWNER'S OWN EXAMPLE, PLAYED. Bandits on day nine of an eleven-day
     * road. Pinned to one seed and one world, because a road that stops is a
     * draw and a test that swept for one would be pinning a rate.
     */
    it('stops a journey where bandits stop it, and it does not arrive', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-17', worldSeed: WORLD });
        await game.newRun('Traveller');
        const before = game.state();

        const done = await game.act(WHERE);
        const after = game.state();

        // Nine days walked of eleven, and still where they set out from.
        expect(after.run.elapsedDays - before.run.elapsedDays).toBe(9);
        expect(after.cultivator.location).toBe(before.cultivator.location);
        expect(done.narration).toMatch(/stopped short/i);
        // THE REST IS STILL AHEAD, in the words the multi-part machinery
        // already uses for anything it held back.
        expect(done.narration).toMatch(/still ahead of you/i);
    }, 120_000);

    /**
     * SAYING IT AGAIN WALKS WHAT IS LEFT. Stopped on day nine of eleven, the
     * next journey to the same place from the same place is two days, not
     * eleven.
     */
    it('walks only the rest of a stopped road when it is said again', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-17', worldSeed: WORLD });
        await game.newRun('Traveller');
        const before = game.state();

        await game.act(WHERE);
        const stoppedAt = game.state();
        expect(stoppedAt.run.elapsedDays - before.run.elapsedDays).toBe(9);

        await game.act(WHERE);
        const after = game.state();

        expect(after.run.elapsedDays - stoppedAt.run.elapsedDays).toBe(2);
        expect(after.cultivator.location).not.toBe(before.cultivator.location);
    }, 120_000);

    /**
     * CARRYING ON IS THAT ROAD. "keep going" names nowhere; with a road stopped
     * where they stand, it walks the rest of it.
     */
    it.each(['keep going', 'press on', 'continue onwards'])(
        'walks the rest of a stopped road on "%s"', async said => {
            const { game } = await makeGameInWorld({ seed: 'road-17', worldSeed: WORLD });
            await game.newRun('Traveller');
            const before = game.state();

            const stopped = await game.act(WHERE);
            // What stopped it is said as what it was, not as a stranger arriving.
            expect(stopped.narration).not.toMatch(/somebody reached you/i);
            const stoppedAt = game.state();

            await game.act(said);
            const after = game.state();
            expect(after.run.elapsedDays - stoppedAt.run.elapsedDays).toBe(2);
            expect(after.cultivator.location).not.toBe(before.cultivator.location);
        }, 120_000);

    /**
     * AND IT WAITS WHILE THEY STAND THERE. Dealing with whatever stopped the
     * road - here, a look round - does not undo the days already walked.
     */
    it('still has only the rest of the road ahead after something else was done there', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-17', worldSeed: WORLD });
        await game.newRun('Traveller');

        await game.act(WHERE);
        await game.act('I look around');
        const between = game.state();

        await game.act(WHERE);
        const after = game.state();

        expect(after.run.elapsedDays - between.run.elapsedDays).toBe(2);
    }, 120_000);

    /**
     * AND A ROAD WALKED TO ITS END STILL ARRIVES, with what it met on the way.
     * A merchant on the road is not a reason to stop.
     */
    it('arrives at the end of a road that only met a merchant', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Traveller');
        const before = game.state();

        await game.act(WHERE);
        const after = game.state();

        expect(after.run.elapsedDays - before.run.elapsedDays).toBe(11);
        expect(after.cultivator.location).not.toBe(before.cultivator.location);
    }, 120_000);
});
