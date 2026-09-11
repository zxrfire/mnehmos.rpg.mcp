/**
 * "The engine put the odds at 30.9%. The roll came up 0.2603."
 *
 * FOUND BY PLAYING BLIND, at the most dramatic moment this game has:
 *
 *     > i attempt the breakthrough
 *     Lin Yue gathered what had been accumulated and struck at Qi Condensation
 *     Layer 13. The engine put the odds at 30.9%, across a realm boundary. The
 *     roll came up 0.2603.
 *
 *     Breakthrough succeeded: Qi Condensation Layer 13 to Foundation
 *     Establishment Early, crossing into a new realm. Odds were 30.9%.
 *     Foundation Establishment crossed. The foundation laid is unstable
 *     (score 1.65). It holds, and it complains... Risk was 13.2%.
 *
 * ── THREE THINGS, ONE SENTENCE ───────────────────────────────────────────
 *
 * It named THE ENGINE, in prose written to be read as a scene. It printed a
 * bare percentage, which this repo bans in a player's face while allowing
 * in-world estimation - *a cultivator may still judge a wall as roughly one in
 * three*. And it read out the raw roll, which is a fact about the random stream
 * and about nothing in the world.
 *
 * Nothing was lost by taking the roll out: `structure` already carries it, and
 * that channel's own note says why - *"the ROLL is the thing only this line
 * carries: it is what makes the odds checkable rather than merely stated"*. An
 * operator keeps it. A player was never its reader.
 *
 * ── AND THE PARAGRAPH UNDER IT WAS A LOG LINE ────────────────────────────
 *
 * `narrationHint` is the engine's own account of a crossing, written for
 * `lines` and `structure`, and `breakthroughProse` printed it verbatim as a
 * paragraph - so `prose`, which is what a player reads with no model
 * configured, carried the odds a second time, the toll's risk figure, and a
 * foundation SCORE beside the word the score produced.
 *
 * `the-engine-states-findings-not-its-rubric.test.ts` settles that: *the engine
 * may say what it found; it may not read out how it marked.* **Unstable** is
 * the finding and a player can act on it. **1.65** is the column it was marked
 * in.
 *
 * Scrubbed in one reader rather than split into a second field on each of the
 * eight places that compose a hint, because eight prose-safe twins are eight
 * chances for the two to drift.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'break-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; toolCalls?: { name: string; summary: string }[] }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
}

/** A cultivator standing at a wall with a full accumulator. */
async function atTheWall(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    const { game } = made;
    await game.newRun('Lin Yue');
    await game.act('ADMIN set_realm ordinal=12');
    await game.act('ADMIN grant_progress fill=true');
    return game;
}

describe('the account of a crossing', () => {
    it('does not name the engine, quote a percentage, or show the die', async () => {
        const game = await atTheWall('mark-a');
        const said = (await game.act('i attempt the breakthrough')).narration ?? '';
        expect(said, said).toMatch(/struck at/i);

        // The three off the played screen, word for word.
        expect(said, said).not.toMatch(/the engine/i);
        expect(said, said).not.toMatch(/the roll came up/i);
        expect(said, said).not.toMatch(/\d+(?:\.\d+)?%/);
        // And a raw roll is a four-place decimal between 0 and 1.
        expect(said, said).not.toMatch(/\b0\.\d{4}\b/);
    }, 300_000);

    it('still says what the odds were, in the idiom this engine speaks them in', async () => {
        const game = await atTheWall('mark-b');
        const said = (await game.act('i attempt the breakthrough')).narration ?? '';
        // The same idiom the combat footer has used under every round since it
        // was written: "gets you clear 56 times in a hundred".
        expect(said, said).toMatch(/\d+ in a hundred/);
    }, 300_000);

    it('says the finding and not the column it was marked in', async () => {
        const game = await atTheWall('mark-c');
        const said = (await game.act('i attempt the breakthrough')).narration ?? '';
        expect(said, said).not.toMatch(/\(score [\d.]+\)/i);
        expect(said, said).not.toMatch(/\b(?:Odds were|Risk was)\b/i);
    }, 300_000);

    /**
     * AND THE OPERATOR KEEPS EVERY FIGURE. This is what makes the change a
     * move between channels rather than a deletion: the roll is what makes the
     * odds checkable, and a test that only asserted the absence above would
     * pass just as well if somebody had thrown it away.
     */
    it('leaves the roll and the chance in the mechanical channel', async () => {
        const game = await atTheWall('mark-d');
        const done = await game.act('i attempt the breakthrough');
        const mechanical = (done.toolCalls ?? []).map(call => call.summary).join('\n');
        expect(mechanical, mechanical).toMatch(/roll/i);
        expect(mechanical, mechanical).toMatch(/\d\.\d{4}|\d+(?:\.\d+)?%/);
    }, 300_000);
});
