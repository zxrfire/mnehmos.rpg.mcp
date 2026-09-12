/**
 * "I wait until the intake" waited one day, with the date three lines above it.
 *
 * FOUND BY PLAYING, engine-only, at Wind Turn on world `a-xianxia-run`. The
 * wall in that square carries two dated bills - Sand Well Caravan in 24 days,
 * Cold Sword Sect in 64 - and both of these spent a single day:
 *
 *     > I wait until the intake     Waiting of 1 day was intended.
 *     > I wait for the intake       Waiting of 1 day was intended.
 *
 * `parseDuration` reads a SPAN, a named event is not one, so the sentence fell
 * through to the handler's one-day default. The same defect class was already
 * fixed one line above for explicit spans - "I wait ten years" used to wait a
 * day - and waiting until a named event was the half left open.
 *
 * One day is worse here than a refusal, because the turn reports success: the
 * player is told the waiting happened and has no way to see that the engine
 * read none of what they said.
 *
 * ── WHAT THE ENGINE ALREADY KNEW ─────────────────────────────────────────
 *
 * Both dates were computed before the sentence was typed. `billsOnTheWall`
 * dates every intake posted in the square, and `openOathsHeldBy` carries
 * `dueOnDay` on every word the cultivator has given. Nothing new is stored:
 * waiting reads the same two rows the wall read and the ledger read read.
 *
 * ── AND WHAT IS DELIBERATELY STILL REFUSED ───────────────────────────────
 *
 * Two intakes are posted at Wind Turn, so `the intake` points at neither -
 * the ruling `whichHouseThePaperMeans` already keeps for the same phrase at
 * the same wall. The answer is the two of them with their days, which the
 * player finishes the sentence from; it is not a day silently spent.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

/** The played world, pinned: unpinned, the wall is a different wall every run. */
const WORLD = 'a-xianxia-run';

/**
 * The run seed, pinned with it: the world decides who is alive and the RUN
 * decides where this cultivator was born, so an unpinned run stands somewhere
 * with a different wall.
 */
const PLAYED = 'xianxia';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number } };
}

async function atWindTurn(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    await made.game.newRun('Shen Wuyou');
    return made.game;
}

/**
 * The bills on this wall, read off the engine's own words for them.
 *
 * Never hard-coded: any date the game prints is a date the game must accept
 * back, and a house name pinned here would pin which house the seed happened
 * to post.
 */
async function whatIsPosted(game: Playing): Promise<{ house: string; inDays: number }[]> {
    const said = (await game.act('what is posted here')).narration ?? '';
    return [...said.matchAll(/^(.+?) is holding an intake at .+? in (\d+) days/gm)]
        .map(row => ({ house: row[1]!, inDays: Number(row[2]) }));
}

describe('the sentence carries what is being waited for', () => {
    it('takes a named event off "until" and off "for"', () => {
        expect(parseIntent('I wait until the intake').target).toBe('the intake');
        expect(parseIntent('I wait for the intake').target).toBe('the intake');
        expect(parseIntent('I wait until the Sand Well Caravan intake').target)
            .toBe('the sand well caravan intake');
    });

    /** And a named event is not a span, so neither is read as one. */
    it('sets no span when the sentence named an event instead', () => {
        expect(parseIntent('I wait until the intake').days).toBeUndefined();
    });

    /** Bare waiting is untouched, and so is a span said outright. */
    it('leaves bare waiting and an explicit span alone', () => {
        expect(parseIntent('I wait').target).toBeUndefined();
        expect(parseIntent('I wait').days).toBeUndefined();
        expect(parseIntent('I wait ten years').days).toBe(3650);
        expect(parseIntent('I wait ten years').target).toBeUndefined();
    });

    /**
     * A stretch of the day is not an event the world has a date for, and these
     * have always cost one day. `I wait for morning` is in the standing refusal
     * corpus; turning it into a refusal would be this fix breaking a sentence
     * that worked.
     */
    it.each([
        'I wait until morning',
        'I wait for morning',
        'I wait until the morning',
        'I wait for a while',
        'I wait until the wound closes',
        'I rest until my wounds heal'
    ])('%j names no dated thing', said => {
        expect(parseIntent(said).target).toBeUndefined();
    });
});

describe('waiting until a date the engine holds', () => {
    it('spends the days the paper says, not one', async () => {
        const game = await atWindTurn(PLAYED);
        const posted = await whatIsPosted(game);
        expect(posted.length, 'this world posts a dated intake at Wind Turn').toBeGreaterThan(0);

        const first = posted[0]!;
        const said = (await game.act(`I wait until the ${first.house} intake`)).narration ?? '';
        expect(said, said).toContain(`Waiting of ${first.inDays} days was intended`);
    }, 300_000);

    it('answers a phrase pointing at two of them with the two of them', async () => {
        const game = await atWindTurn(PLAYED);
        const posted = await whatIsPosted(game);
        expect(posted.length, 'more than one paper up is what makes the phrase ambiguous')
            .toBeGreaterThan(1);

        const before = game.state().run.elapsedDays;
        const said = (await game.act('I wait until the intake')).narration ?? '';

        for (const row of posted) {
            expect(said, said).toContain(row.house);
            expect(said, said).toContain(`${row.inDays} days`);
        }
        expect(said, said).not.toMatch(/Waiting of 1 day was intended/);
        expect(game.state().run.elapsedDays, 'a refusal spends nothing').toBe(before);
    }, 300_000);

    it('refuses a name nothing here answers to, and says what does', async () => {
        const game = await atWindTurn(PLAYED);
        const posted = await whatIsPosted(game);

        const before = game.state().run.elapsedDays;
        const said = (await game.act('I wait until the Jade Lantern Gathering')).narration ?? '';

        expect(said, said).not.toMatch(/Waiting of \d+ days? was intended/);
        expect(game.state().run.elapsedDays).toBe(before);
        for (const row of posted) expect(said, said).toContain(row.house);
    }, 300_000);
});

describe('and bare waiting still costs a day', () => {
    it('spends one day and says so', async () => {
        const game = await atWindTurn(PLAYED);
        const said = (await game.act('I wait')).narration ?? '';
        expect(said, said).toContain('Waiting of 1 day was intended');
    }, 300_000);
});
