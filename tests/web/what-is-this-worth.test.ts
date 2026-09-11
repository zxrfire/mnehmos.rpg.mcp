/**
 * A question about the mushroom in your pouch, answered with forty-three lines
 * of ferry fares.
 *
 * FOUND BY PLAYING BLIND, on three consecutive screens:
 *
 *     > i gather herbs
 *     Found and pouched: one Cloudcap Mushroom, mortal grade, worth about 8
 *     spirit stones.
 *
 *     > what is my Cloudcap Mushroom worth
 *     What is nearest to hand, of 43 things on offer:
 *       Bowl of millet, 1 cash each.
 *       Ferry crossing, 2 cash the crossing. ...
 *
 *     > i sell what i gathered
 *     Cloudcap Mushroom: 1 sold at 60 of what it is worth: 4 spirit stones
 *     against a list of 7.2. Ordinary terms.
 *
 * Three defects, and the middle one is the largest.
 *
 * ── THE NAME WAS DROPPED, NOT THE ROUTING ────────────────────────────────
 *
 * `verb-pattern-table.ts` reads every one of those phrasings and sends them to
 * `sell`, whose free read is the market - that part worked. `extractSubject`
 * looked for the object AFTER the marker word, and English puts it before in
 * the commonest shape there is: *what is my sword worth*. The table's own
 * comment names that exact sentence as one it handles, and the noun was going
 * on the floor one function later. It now looks in front of the marker when
 * nothing follows it, using the reader already written for a stand-in object.
 *
 * A bare demonstrative still resolves to nothing - `what is this worth` carries
 * no name, and a back-reference belongs to phase one rather than to this tier.
 *
 * ── AND THE VERB HAD NO ANSWER FOR A THING YOU OWN ───────────────────────
 *
 * `market` already prices a named thing, through `resolvePrice`, which reads the
 * mortal goods catalog. A herb is not in that catalog. So a player could be
 * quoted for a thing they might buy and not for a thing they are holding, and
 * the second is the question people actually ask. Quoted through
 * `quotePouchSale` at the province's own multiplier, which is the same call
 * `sell` pays out of: the figure quoted is the figure handed over.
 *
 * ── AND THE SALE LINE HAD A PERCENTAGE WITH NO SIGN, AND A LIST THAT WAS NOT ─
 *
 * `Math.round(fraction * 100)` reached the player as a bare `60`, so the line
 * read "sold at 60 of what it is worth". And `grossStones` is list x quantity x
 * the PROVINCE'S multiplier - the field beside it says `listStones` is the list
 * - so calling it a list is how one mushroom came to be worth 8 on one screen
 * and 7.2 on the next. Neither figure was wrong and nothing said whose it was.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'money-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number }; cultivator: { spiritStones: number } };
}

async function standingInAMarket(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    await made.game.newRun('Lin Yue');
    return made.game;
}

async function withAFullPouch(seed: string) {
    const game = await standingInAMarket(seed);
    const gathered = await game.act('i gather herbs');
    const found = /Found and pouched: one ([^,]+),/.exec(gathered.narration ?? '')?.[1];
    return { game, found };
}

describe('asking what a thing is worth', () => {
    it('carries the name when it comes before the word "worth"', () => {
        // The played sentence, and the shape the table's own comment names.
        expect(parseIntent('what is my Cloudcap Mushroom worth').target).toBe('Cloudcap Mushroom');
        expect(parseIntent('what is my sword worth').target).toBe('sword');
        expect(parseIntent('what would the manual fetch').target).toBe('manual');
    });

    /**
     * AND A BARE DEMONSTRATIVE STILL NAMES NOTHING. Resolving `this` against the
     * previous turn is phase one's, and a table that guessed here would guess
     * standing in front of a stall, a corpse, or a man holding a sword.
     */
    it('does not decide what a bare "this" was', () => {
        expect(parseIntent('what is this worth').target).toBeUndefined();
    });

    /** And the sentence that measures a PERSON is still not about money. */
    it('leaves "what is he worth against me" with the measuring verb', () => {
        expect(parseIntent('what is he worth against me').action).toBe('assess');
    });
});

describe('the answer', () => {
    it('prices what is in the pouch instead of reading out the stalls', async () => {
        const { game, found } = await withAFullPouch('worth-a');
        expect(found, 'the seed gathered something').toBeTruthy();

        const said = (await game.act(`what is my ${found} worth`)).narration ?? '';
        expect(said, said).toContain(found!);
        expect(said, said).toMatch(/would fetch/i);
        // The forty-three-line board, which was the whole finding.
        expect(said, said).not.toMatch(/Bowl of millet/);
    }, 300_000);

    it('costs nothing and sells nothing', async () => {
        const { game, found } = await withAFullPouch('worth-b');
        if (!found) return;
        const before = game.state();
        const said = (await game.act(`what is my ${found} worth`)).narration ?? '';
        const after = game.state();

        expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(said, said).toMatch(/nothing has changed hands/i);
    }, 300_000);

    /**
     * AND IT IS THE SAME NUMBER THE COUNTER THEN PAYS. A quote a player cannot
     * act on is worse than no quote: it is the engine disagreeing with itself
     * one turn later, which is what the mislabelled list already did once on
     * this same screen.
     */
    it('quotes the figure the sale then pays', async () => {
        const { game, found } = await withAFullPouch('worth-c');
        if (!found) return;

        const quoted = (await game.act(`what is my ${found} worth`)).narration ?? '';
        const wanted = /would fetch (\d+) spirit stone/.exec(quoted)?.[1];
        expect(wanted, quoted).toBeTruthy();

        const before = game.state().cultivator.spiritStones;
        await game.act(`i sell the ${found}`);
        const paid = game.state().cultivator.spiritStones - before;
        expect(paid).toBe(Number(wanted));
    }, 300_000);
});

describe('the sale line', () => {
    it('says neither a bare percentage nor a list it is not', async () => {
        const { game, found } = await withAFullPouch('worth-d');
        if (!found) return;
        const said = (await game.act('i sell what i gathered')).narration ?? '';

        // The played sentence: "1 sold at 60 of what it is worth".
        expect(said, said).not.toMatch(/sold at \d+ of what/i);
        // `grossStones` carries the province's multiplier and is not the list.
        expect(said, said).not.toMatch(/against a list of/i);
        // And it still says both figures, which is what makes the margin legible.
        expect(said, said).toMatch(/reckons the lot at/i);
    }, 300_000);
});

describe('a name nothing here answers to', () => {
    it('says so before it reads out the counter', async () => {
        const game = await standingInAMarket('worth-e');
        const said = (await game.act('what are my herbs worth')).narration ?? '';
        expect(said, said).toMatch(/Nothing here prices/i);
        // The listing stays: what is on the counter is still worth seeing, and
        // a refusal that showed nothing would be the worse answer.
        expect(said, said).toMatch(/Bowl of millet/);
    }, 300_000);

    /** And a question with no name in it is still just the counter. */
    it('leaves the plain reading of the counter alone', async () => {
        const game = await standingInAMarket('worth-f');
        const said = (await game.act('what is for sale')).narration ?? '';
        expect(said, said).not.toMatch(/Nothing here prices/i);
        expect(said, said).toMatch(/Bowl of millet/);
    }, 300_000);
});
