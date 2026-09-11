/**
 * "You did not say for how long" - to a player who had said for how long.
 *
 * FOUND BY PLAYING BLIND:
 *
 *     > i practise Cross-Meridian Strike for 60 days
 *     Mastery 0% to 3%.
 *     Qi deviation: a minor meridian injury...
 *     You did not say for how long, so it came to 7 days - which is what a
 *     stretch runs when nobody names one, and is not long enough to be the
 *     answer to anything. Say the span and it runs that: "I practise it for
 *     ten years".
 *
 * The remedy the refusal offers is the sentence the player just typed.
 *
 * ── ONE VERB, ONE FIELD ──────────────────────────────────────────────────
 *
 * `cultivate` has carried `days` off the sentence since it was written -
 * `i cultivate for 60 days` parses to `{action: 'cultivate', days: 60}` - and
 * the training branch returned `{action, target}` and nothing else. So every
 * practice in the game ran seven days whatever was asked for, the mastery gain
 * was a seventh of what the player paid for, and the note under it told them
 * they had not asked.
 *
 * `durationAskedFor` is the engine's own reader of a span and this file already
 * imports its neighbours. Measured after: 60 days is 60 days, ten years is
 * 3650, and a sentence with no span in it still gets the default and the note
 * that explains it.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'art-world';
const ART = 'Cross-Meridian Strike';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number } };
}

async function holdingAnArt(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    const { game } = made;
    await game.newRun('Lin Yue');
    const held = await game.act(`i learn ${ART}`);
    expect(held.narration ?? '', 'the art was taken up').toMatch(/held now/i);
    return game;
}

describe('the span on a practice', () => {
    it('is carried off the sentence', () => {
        expect(parseIntent(`i practise ${ART} for 60 days`).days).toBe(60);
        expect(parseIntent(`i practise ${ART} for ten years`).days).toBe(3650);
        expect(parseIntent(`i drill ${ART} for a month`).days).toBe(30);
    });

    /** And a sentence with no span in it still has none, which is the default. */
    it('is absent when none was said', () => {
        expect(parseIntent(`i practise ${ART}`).days).toBeUndefined();
    });

    it('runs for the days that were named', async () => {
        const game = await holdingAnArt('span-a');
        const before = game.state().run.elapsedDays;
        await game.act(`i practise ${ART} for 60 days`);
        const spent = game.state().run.elapsedDays - before;
        expect(spent).toBeGreaterThan(30);
    }, 300_000);

    it('does not tell a player they failed to say what they said', async () => {
        const game = await holdingAnArt('span-b');
        const said = (await game.act(`i practise ${ART} for 60 days`)).narration ?? '';
        expect(said, said).not.toMatch(/did not say for how long/i);
    }, 300_000);

    /**
     * AND THE NOTE IS STILL THERE FOR THE SENTENCE IT WAS WRITTEN FOR. It is a
     * good note - it says what the default is and what to type instead - and
     * the defect was only that it fired on a sentence that had done what it
     * asks.
     */
    it('still says so when nothing was named', async () => {
        const game = await holdingAnArt('span-c');
        const said = (await game.act(`i practise ${ART}`)).narration ?? '';
        expect(said, said).toMatch(/did not say for how long/i);
    }, 300_000);
});
