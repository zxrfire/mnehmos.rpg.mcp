/**
 * A duty spent fifty days and never said a word about food.
 *
 * FOUND BY PLAYING BLIND, and it ended the run:
 *
 *     > i take the duty called After materials
 *     ...
 *     Five days pass. The hunger becomes a physical weight... Ru Bing dies at
 *     sixteen years of age, a Qi Condensation Layer 1 cultivator who succumbed
 *     to starvation.
 *
 * The screen that took the posting had named the wage, the term, the tier and
 * the rung it was pitched at. It had not named the one thing that decides
 * whether the player comes back, and the pack was empty.
 *
 * ── WHY IT IS A DEFECT AND NOT A HARD GAME ───────────────────────────────
 *
 * Because the OTHER verb that spends a span of days already quotes it, and has
 * since it was written:
 *
 *     13 rations bought for 26 spirit stones. That is food for about 1.9 years
 *     of the 2 years asked for. After that the belly is empty and five turns
 *     later it is fatal.
 *
 * So the game knows how to say this, says it when you sit in a cave, and did
 * not say it when you walk out for a house. An asymmetry between two verbs that
 * spend the same resource in the same way is a mechanical bug, not difficulty.
 *
 * ── AND IT STATES RATHER THAN REFUSES ────────────────────────────────────
 *
 * Seclusion quotes the shortfall and lets the player sit down anyway. A duty
 * does the same: somebody who means to go hungry for a house may. Pinned below,
 * because the obvious over-correction is a barrier, and a barrier would make
 * this the only place in the game where being poor stops you working.
 *
 * ── AND IT SAYS THE RULE THAT DIFFERS ────────────────────────────────────
 *
 * Seclusion tops the pack up out of the purse at the cave mouth; a duty does
 * not - `shortSkip` rules that outright. A player who has met the seclusion
 * screen carries the wrong expectation onto the road unless the duty screen
 * says the purse stays shut.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'duty-rations';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

async function standingAtTheBoard(seed: string) {
    const { game } = await makeGameInWorld({ seed, worldSeed: WORLD });
    await game.newRun('Runner');
    const say = (s: string) => game.act(s) as Promise<Said>;
    await say('ADMIN set_realm ordinal=14');
    const world = (game as unknown as {
        atHand: { locations: { id: string; name: string; kind: string }[] };
    }).atHand;
    const seat = world.locations.find(l => l.kind === 'sect_seat')!;
    await say(`ADMIN move ${seat.name}`);
    return { game, say };
}

/** Whatever this seed put on the wall, by the name the board printed. */
function aLineOffTheBoard(board: Said): string | null {
    return /\n {2}([^:\n]{5,60}): /.exec(board.narration ?? '')?.[1] ?? null;
}

describe('taking a duty', () => {
    it('says what the pack covers against the days it asks for', async () => {
        const { say } = await standingAtTheBoard('eat-a');
        const board = await say('what duties are there');
        const offered = aLineOffTheBoard(board);
        expect(offered, board.narration ?? '').toBeTruthy();

        const taken = await say(`I put my name down for ${offered}`);
        const said = taken.narration ?? '';

        // The pack is named, whichever way it came out. This is the whole
        // finding: the screen was silent about food.
        expect(said, said).toMatch(/pack/i);
        // And it is priced against the span, not stated as a bare count.
        expect(said, said).toMatch(/\b(days?|months?|years?)\b/);
    }, 300_000);

    it('says the purse is not spent for you, when the pack does not cover it', async () => {
        const { say } = await standingAtTheBoard('eat-b');
        const board = await say('what duties are there');
        const offered = aLineOffTheBoard(board);
        if (!offered) return;

        const taken = await say(`I put my name down for ${offered}`);
        const said = taken.narration ?? '';
        // Only asserted on the branch that has something to warn about. A run
        // that happens to be fed has nothing to say about the purse.
        if (/food for about|nothing to eat on the first day/i.test(said)) {
            expect(said, said).toMatch(/nothing is bought for a duty/i);
        }
    }, 300_000);

    /**
     * AND IT IS NOT A BARRIER. The posting is still taken, the oath is still
     * written, and the days are still spent. See the header.
     */
    it('takes the posting anyway', async () => {
        const { say } = await standingAtTheBoard('eat-c');
        const board = await say('what duties are there');
        const offered = aLineOffTheBoard(board);
        if (!offered) return;

        const taken = await say(`I put my name down for ${offered}`);
        expect(taken.error, taken.error ?? '').toBeFalsy();
        // The span is reported, which is the proof it went through rather than
        // stopping at a warning.
        expect(taken.narration ?? '', taken.narration ?? '')
            .toMatch(/\bday|\bmonth|\byear/i);
    }, 300_000);
});

/**
 * And the same screen could not state the contract either.
 *
 * FOUND IN THE SAME PASS, one line away. The wage, the term, the tier and the
 * rung the posting was pitched at went onto `facts.lines` - and `lines` is what
 * a NARRATOR is allowed to know. The deterministic rendering a player reads
 * when no model is configured is `facts.prose`, which AGENTS.md calls a
 * shipping mode outright: *"it must keep working because that is a shipping
 * mode."*
 *
 * So the board printed the terms, the turn that AGREED to them printed nothing,
 * and the next thing said about money was the payment arriving.
 *
 * The summons path had already found this and fixed it its own way - its note
 * reads *"the first cut of this put four sentences in `lines` alone and printed
 * none of them"* - and the board path was the same slip, unnoticed. There are
 * 34 `facts.lines.push`/`unshift` calls on an already-composed facts object in
 * `src/web`, and each one is this question asked again.
 */
describe('the screen that agreed to it', () => {
    it('states the terms it just agreed to, with no model to phrase them', async () => {
        const { say } = await standingAtTheBoard('terms-a');
        const board = await say('what duties are there');
        const offered = aLineOffTheBoard(board);
        expect(offered, board.narration ?? '').toBeTruthy();

        const said = (await say(`I put my name down for ${offered}`)).narration ?? '';

        // The posting is named on the turn that took it, not only on the board.
        expect(said, said).toContain(offered!);
        // And what it pays, which is the term a contract is read for.
        expect(said, said).toMatch(/on completion/i);
    }, 300_000);
});
