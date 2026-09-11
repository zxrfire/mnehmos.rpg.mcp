/**
 * "What is my reputation" was answered with "you are not in a sect".
 *
 * FOUND BY PLAYING BLIND, unaffiliated, three phrasings and one answer:
 *
 *     > what is my reputation
 *     Unaffiliated. No stipend, no array, no elder, and nobody to notice if
 *     this run ends badly. Houses short of people advertise rather than wait...
 *
 *     > what do people think of me
 *     (the same answer)
 *
 *     > how am i regarded
 *     (the same answer again)
 *
 * True, and about a HOUSE.
 *
 * ── THE ROUTING IS NOT THE DEFECT ────────────────────────────────────────
 *
 * All three reach `sect/standing` on purpose - a house's opinion is the
 * standing read, and `the-singular-of-a-question-that-worked.test.ts` pins that
 * against the warmth read next door. Nothing about where the sentence goes
 * moves here. What was wrong is that the answer stopped at membership, so for
 * anybody in no house the question had no answer at all.
 *
 * ── AND THE READER WAS NAMED IN THE REPOSITORY ALREADY ───────────────────
 *
 * `verb-pattern-table.ts` states the gap outright, where it explains why
 * `about me` is left with the news read:
 *
 *     "nothing in this game answers 'what does the world hold about me'.
 *     `whatTheWorldHoldsAbout` is the reader for it and is wired for everybody
 *     except the player, whose own record it reads only to answer who is
 *     hunting them."
 *
 * So it is that reader, asked the whole question instead of one field of it.
 * Ledger-derived: what stands open against them, what stands in their favour,
 * who is in a position to act on it, and who holds something and cannot reach
 * them. Nothing in it is speech - what is SAID about somebody is a different
 * read with a different answer per listener, and this does not pretend to be
 * it.
 *
 * The holder lookup came out of `whoIsHuntingThisCultivator` on the way, since
 * two readers of one ledger that disagree about whose a row is would report two
 * different worlds off the same rows.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'social-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number } };
}

async function nobody(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    await made.game.newRun('Lin Yue');
    return made.game;
}

describe('asking how you stand', () => {
    /** Unmoved, and asserted so a later change here has to decide to move it. */
    it('still reaches the standing read', () => {
        expect(parseIntent('what is my reputation').intent).toBe('standing');
        expect(parseIntent('what do people think of me').intent).toBe('standing');
        expect(parseIntent('how am i regarded').intent).toBe('standing');
    });

    it.each([
        'what is my reputation',
        'what do people think of me',
        'how am i regarded'
    ])('%s says what the record holds and not only what house you are in', async said => {
        const game = await nobody(`held-${said.length}`);
        const narration = (await game.act(said)).narration ?? '';

        // The membership half is still there - it is true and it was never the
        // defect.
        expect(narration, narration).toMatch(/Unaffiliated|contribution|rank/i);
        // And the half that answers the question.
        expect(narration, narration).toMatch(/ledger|stands open|in your favour/i);
    }, 300_000);

    it('costs nothing', async () => {
        const game = await nobody('held-free');
        const before = game.state().run.elapsedDays;
        await game.act('what is my reputation');
        expect(game.state().run.elapsedDays).toBe(before);
    }, 300_000);
});

describe('and it moves when the ledger does', () => {
    /**
     * A read that says the same thing whatever the player has done is not a
     * read of anything. Played: open a fight, which writes a row, and the
     * answer changes and names who holds it.
     */
    it('names who is holding something, once somebody is', async () => {
        const game = await nobody('held-fight');
        await game.act('ADMIN set_realm ordinal=14');
        await game.act('ADMIN spawn_encounter ordinal=8 name=Yun Shizhen');

        const before = (await game.act('what is my reputation')).narration ?? '';
        expect(before, before).toMatch(/Nothing stands on the ledger either way/i);

        await game.act('i attack Yun Shizhen');
        for (let round = 0; round < 3; round++) await game.act('i keep fighting');

        const after = (await game.act('what is my reputation')).narration ?? '';
        expect(after, after).not.toBe(before);
        expect(after, after).toMatch(/stands? open against you/i);
        expect(after, after).toContain('Yun Shizhen');
    }, 300_000);
});
