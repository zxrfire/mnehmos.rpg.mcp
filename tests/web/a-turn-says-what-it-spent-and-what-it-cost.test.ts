/**
 * What a turn owes the player about the span it spent and the price it charged.
 *
 * Every block is one thing found by playing with no model in front of the
 * engine, and every one of them reads identically with a model in front of it,
 * because a model narrates the facts the composer built and cannot narrate one
 * the composer dropped. `AGENTS.md`, "It has to play as a game, not as a
 * command line": you are told what happened.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';

const WORLD = 'a-turn-says-what-it-spent';

describe('a span says the span the player asked for', () => {
    /**
     * PLAYED, and it is the reason `shortSkip` now carries `askedForDays`:
     *
     *   > I wait a year
     *   "Hollowmarket. The qi is thin here; it always has been. Shen Wu sat
     *    down anyway. Waiting of 4 months was intended."
     *   ... and fifty days were spent.
     *
     * `parseIntent` returns `days: 365`. The encounter layer cut the span to
     * four months before `simulateTimeSkip` ever saw it, so the skip's own
     * `requestedDays` was the truncated figure and `factsForTimeSkip` fell back
     * to it - reporting the engine's arithmetic as the player's intention.
     *
     * The second half is worse than the misreport. `asked > requestedDays` is
     * the condition on the paragraph that exists to say *something was already
     * coming that would end it early*, and with the two equal that paragraph
     * could never fire on any of the seven verbs this path serves.
     */
    it('says a year when a year was asked for, and says what shortened it', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'asked-for-a-year' });
        await h.game.newRun('Shen Wu');

        const { narration } = await h.game.act('I wait a year');

        expect(narration).toContain('Waiting of 1 year was intended');
        expect(narration).not.toMatch(/Waiting of \d+ months was intended/);
        // And the correction to the player's own sentence, which could not
        // print while `asked` was being read off the truncated span.
        expect(narration).toContain('It was never going to be 1 year');
    }, 60_000);
});
