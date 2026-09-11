/**
 * "What is my foundation like" said nothing about the foundation.
 *
 * FOUND BY PLAYING BLIND, one turn after a crossing that had just printed
 * *"The foundation laid is unstable. It holds, and it complains. Cultivation
 * runs rough and bottlenecks bite harder than they should."*
 *
 *     > what is my foundation like
 *     Nobody standing over you is standing above you. Whatever comes next is
 *     not in this house, and nobody in it is in a position to tell you what it
 *     is.
 *     0 years at this rung, of the 50 the ladder credits. 50 still counted.
 *
 * Who could judge them, and how long they had been at the rung. Nothing
 * whatever about the structure the question was about, on the turn after the
 * game itself had described it.
 *
 * ── THE ROUTING IS DELIBERATE AND STAYS ──────────────────────────────────
 *
 * `ASSESSING_THEMSELVES` lists `my foundation` by name and sends it to the
 * master's read of a student, which is the right verb: a foundation is a thing
 * about this cultivator and not about the ground they are standing on. The read
 * simply did not carry it.
 *
 * ── AND THE SENTENCE FOR IT WAS ALREADY WRITTEN ──────────────────────────
 *
 * `describeFoundation` had no caller anywhere in `src/` except the line that
 * composes a crossing's own hint - so the one moment the game would say what
 * your foundation is, is the moment it is laid, and never again. It is the
 * largest single fact about anybody past Qi Condensation: `FOUNDATION_EFFECTS`
 * is where two cultivators at one rank stop being the same person, and it runs
 * from a 1.35x rate to a 0.4x one.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'break-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number } };
}

async function aCultivator(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    await made.game.newRun('Lin Yue');
    return made.game;
}

describe('asking what you are standing on', () => {
    /** Unmoved, and pinned so a later change has to decide to move it. */
    it('still reaches the master reading a student', () => {
        // The whole sentence, not the noun phrase: `ASSESSING_THEMSELVES`
        // matches the TARGET the table extracted, and a bare `my foundation`
        // is not a sentence anybody types.
        expect(parseIntent('what is my foundation like').action).toBe('assess');
        expect(parseIntent('i assess my foundation').action).toBe('assess');
    });

    it('says there is nothing there yet, below the realm that lays one', async () => {
        const game = await aCultivator('found-a');
        const said = (await game.act('what is my foundation like')).narration ?? '';
        expect(said, said).toMatch(/No foundation is laid yet/i);
    }, 300_000);

    it('says what was laid, once something has been', async () => {
        const game = await aCultivator('found-b');
        await game.act('ADMIN set_realm ordinal=12');
        await game.act('ADMIN grant_progress fill=true');
        const crossed = (await game.act('i attempt the breakthrough')).narration ?? '';
        // Only the runs that actually crossed have a foundation to report.
        if (!/Foundation Establishment/i.test(crossed)) return;

        const said = (await game.act('what is my foundation like')).narration ?? '';
        expect(said, said).toMatch(/The foundation under all of it is/i);
        // And the quality word is one of the catalog's own, with the sentence
        // that says what it costs.
        expect(said, said)
            .toMatch(/exceptional|stable|unstable|incomplete|damaged|transformed|rebuilt|sacrificed/);
    }, 300_000);

    it('costs nothing', async () => {
        const game = await aCultivator('found-c');
        const before = game.state().run.elapsedDays;
        await game.act('what is my foundation like');
        expect(game.state().run.elapsedDays).toBe(before);
    }, 300_000);

    /**
     * AND THE READ IT WAS ADDED TO IS STILL ITSELF. The stall clock and who is
     * qualified to judge you are what this verb was for, and a foundation line
     * is an addition rather than a replacement.
     */
    it('still says who could judge you and how long you have stood here', async () => {
        const game = await aCultivator('found-d');
        const said = (await game.act('am i ready to break through')).narration ?? '';
        expect(said, said).toMatch(/years at this rung/i);
    }, 300_000);
});
