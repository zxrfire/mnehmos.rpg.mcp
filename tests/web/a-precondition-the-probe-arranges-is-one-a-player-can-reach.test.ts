/**
 * Every GIVEN the refusal probe measures against, reached by typing sentences.
 *
 * `scripts/probe-what-a-refusal-is-still-for.ts` arranges its scenarios with
 * ADMIN, because arranging has to be fast and an arrangement that takes forty
 * played turns is one that times out and goes flaky. That leaves a hole this
 * file closes: an arranged state nobody can REACH measures a state no player
 * occupies, and it hides the worse defect behind a tidy number - if a player
 * cannot get there by playing, that part of the game does not exist however
 * well the engine models it.
 *
 * This repo has found that exact shape repeatedly; AGENTS.md keeps the roll of
 * them under *a module nothing calls is not a feature*.
 *
 * So: no ADMIN verb anywhere in this file. Fresh run, sentences a player would
 * type, and the assertion is on what the ENGINE REPORTS rather than on rows.
 * Slower than the rest of the suite on purpose.
 *
 * ── EVERY WORLD IS PINNED ────────────────────────────────────────────────
 *
 * An unpinned `worldEnabled` game mints a world from `randomUUID()`, so who is
 * standing here and what a stall carries differ every run. A reachability test
 * that does not pin is pinning a coincidence, and reads exactly like flake.
 *
 * ── WHAT WAS FOUND WRITING IT ────────────────────────────────────────────
 *
 * `I join the nearest sect` DOES NOT JOIN. It routes to `sect`, comes back with
 * the listing, and leaves the cultivator on nobody's roll. The refusal probe
 * had used that exact sentence to arrange a situation it called *"on a roll"*
 * since the situation was written, so every figure ever reported from it was
 * measured on a cultivator who had joined nothing. `I ask to join <house>` is
 * the phrasing that works. Both are pinned below: the working one because the
 * whole house lane hangs off it, the broken one because a near-synonym that
 * fails is this repo's most repeated reading defect and it should go red when
 * somebody fixes it.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'reachable-world';

beforeAll(() => {
    // Explicitly OFF. The point of this file is that none of it needs admin.
    delete process.env.ADMIN_MODE;
});

interface Call { name: string; action: string; ok: boolean; summary: string }
interface Said { narration?: string; toolCalls: Call[] }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): {
        run: { elapsedDays: number };
        cultivator: { spiritStones: number; sectId: string | null; location: string | null };
    };
}

/** A fresh cultivator in a pinned world, with nothing arranged. */
async function aBeginner(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    await made.game.newRun('Reacher');
    return made.game;
}

const said = async (game: Playing, line: string): Promise<string> =>
    (await game.act(line)).narration ?? '';

describe('given a beginner, when they buy a book and begin it', () => {
    /**
     * The `cultivate` gate is the largest single block of refusals in the
     * corpus - 24 of 24 - and it is correct: no method, nothing accumulates.
     * What makes it a gate rather than a wall is that a player can close it,
     * and admin deliberately CANNOT: forcing a method is forcing a
     * precondition, which `ADMIN force` refuses by design. So this is the one
     * arrangement the probe plays rather than arranges, and it has to work.
     */
    it('then they are practising a method, and sitting down accumulates', async () => {
        const game = await aBeginner('reach-method');

        // The name comes off the stall rather than out of this file: any name
        // the game prints is a name the game must accept.
        const stall = await said(game, 'I buy a manual');
        const book = /^\s*([A-Z][^,\n]{4,48}(?:Manual|Scripture))\b/m.exec(stall)?.[1]?.trim();
        expect(book, stall).toBeTruthy();

        const bought = await said(game, `I buy the ${book}`);
        expect(bought, bought).toMatch(/spirit stones|the copy is yours/i);

        const begun = await said(game, `I learn the ${book}`);
        expect(begun, begun).toContain(book!);

        // AND THE GATE IS SHUT BEHIND THEM. This is the observable claim: the
        // no-method refusal no longer fires.
        const sat = await game.act('I sit down');
        expect(sat.narration ?? '', sat.narration).not.toMatch(/No cultivation method/i);
        expect(
            sat.toolCalls.filter(c => !c.ok && !c.name.startsWith('narrator.')).map(c => c.name),
            sat.narration
        ).toEqual([]);
    }, 300_000);
});

describe('given a beginner, when they take work', () => {
    it('then they end richer than they started', async () => {
        const game = await aBeginner('reach-money');
        const before = game.state().cultivator.spiritStones;

        await said(game, 'what work is there');
        await said(game, 'I take a job');
        await said(game, 'I work');

        expect(game.state().cultivator.spiritStones).toBeGreaterThan(before);
    }, 300_000);
});

describe('given a beginner, when they ask who is here', () => {
    /**
     * The precondition under the `request` and `give` refusals: somebody
     * resolvable standing in the square. If a player cannot reliably get into
     * one, that is a gameplay defect and not a reader defect.
     */
    it('then somebody is named, and that name resolves as a party', async () => {
        const game = await aBeginner('reach-person');
        const here = await said(game, 'who is here');

        const name = /^([A-Z][a-z]+ [A-Z][a-z]+) is here/m.exec(here)?.[1];
        expect(name, here).toBeTruthy();

        // The name the game printed is one it must accept back.
        const asked = await game.act(`I ask ${name} what they want`);
        expect(
            asked.toolCalls.some(c => /resolveParty/.test(c.name) && !c.ok),
            asked.narration
        ).toBe(false);
    }, 300_000);
});

describe('given a beginner, when they ask a house to take them', () => {
    /**
     * THE ONE THAT MATTERS MOST. The house lane, the duty board, promotion, the
     * treasury and everything `petition` and `offer` reach all hang off being
     * on a roll. If this were unreachable by typing, all of it would be
     * unreachable content.
     *
     * It is reachable. The admission is a real decision and can go either way,
     * so this asserts the sentence REACHES the decision rather than that the
     * house says yes - asserting the yes would be pinning a roll.
     */
    it('then the roll is a real decision, and being taken puts them on it', async () => {
        const game = await aBeginner('reach-sect');

        const houses = await said(game, 'what sects are there');
        const willing = /\b([A-Z][A-Za-z' ]{3,40}?) takes people at your standing/.exec(houses)?.[1];
        expect(willing, houses).toBeTruthy();

        const answer = await said(game, `I ask to join the ${willing!.trim()}`);
        // Either they were taken, or the house looked and declined. Both are
        // the engine having decided; neither is it failing to understand.
        expect(answer, answer).toMatch(/Taken on by|did not take them|already serves/i);

        if (/Taken on by/i.test(answer)) {
            expect(game.state().cultivator.sectId).toBeTruthy();
            // And the board is live once they are on a roll.
            const board = await said(game, 'what duties are there');
            expect(board, board).toMatch(/what it pays|on completion/i);
        }
    }, 300_000);

    /**
     * AND THE NEAR-SYNONYM THAT DOES NOT WORK, pinned so it goes red when
     * somebody fixes it. "If a near-synonym works, the phrasing that fails is a
     * bug" - AGENTS.md. This one was arranging a probe situation for as long as
     * the situation had existed.
     */
    it('but "I join the nearest sect" joins nothing, which is the defect', async () => {
        const game = await aBeginner('reach-nearest');
        await said(game, 'what sects are there');
        await said(game, 'I join the nearest sect');

        expect(
            game.state().cultivator.sectId,
            'when this goes red, "the nearest sect" has started resolving - delete this test '
            + 'and drop the caveat on the probe scenario that quotes it'
        ).toBeNull();
    }, 300_000);
});

describe('given a beginner, when they look for somebody to guard', () => {
    /**
     * `guard` refused 18 of 18 in the corpus, every one at `guard.whoIsHere` -
     * the sentence named nobody the square held. Naming somebody the square
     * DOES hold gets past that and reaches the real precondition, which is
     * trust, and which a beginner does not have with a stranger.
     *
     * So the verb is reachable and its deeper refusal is the honest one. What
     * is NOT cheaply reachable is a state where the watch is accepted: that
     * wants a standing relationship, and no sentence arranges one quickly.
     * Written down rather than arranged around.
     */
    it('then naming somebody present gets past "not standing here"', async () => {
        const game = await aBeginner('reach-guard');
        const here = await said(game, 'who is here');
        const name = /^([A-Z][a-z]+ [A-Z][a-z]+) is here/m.exec(here)?.[1];
        expect(name, here).toBeTruthy();

        const watched = await game.act(`I stand guard over ${name}`);
        const declined = watched.toolCalls.filter(c => !c.ok && !c.name.startsWith('narrator.'));

        // Past the square check. Whatever refuses now is about the two of them.
        expect(
            declined.map(c => c.name).join(' '),
            watched.narration
        ).not.toMatch(/whoIsHere/);
    }, 300_000);
});
