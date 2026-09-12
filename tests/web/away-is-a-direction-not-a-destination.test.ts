/**
 * "I run away" was answered as though `away` were a town nobody had heard of.
 *
 * FOUND BY MEASURING REFUSALS. `scripts/probe-what-a-refusal-is-still-for.ts`
 * put `move` at 28 chosen and 22 refused, 79%, and four sentences account for
 * all of it: *I leave*, *I wander off*, *I run away*, *I get out of here*. The
 * router reads the first, second and fourth as `move()` with no target, which
 * lands on the honest refusal - you have not said where, and here are the roads
 * that go somewhere. The third arrives as
 *
 *     move(target="away")
 *
 * and `resolvePlace` accepts any string at all, because *places in this engine
 * are free text*. So the sentence fell past the no-destination branch into the
 * one that checks a NAME against the world, and the player was told:
 *
 *     You ask after away and get the look people give a name that is not a
 *     place.
 *
 * Which is the engine asserting it went looking for somewhere called "away" and
 * could not find it. Nobody said a place. The word is a direction, and the
 * same sweep of words - `off`, `out`, `elsewhere`, `somewhere` - all arrive the
 * same way from the same kind of sentence.
 *
 * ── THIS IS NOT A GATE BEING WIDENED ─────────────────────────────────────
 *
 * "I run away" still refuses, and it must: the engine does not get to pick a
 * destination for somebody who did not name one, and a human asked the same
 * question asks it back. What changes is WHICH refusal. A sentence that named
 * no place is answered as a sentence that named no place, which is the branch
 * that already names the roads. Nothing that was reachable becomes unreachable
 * and nothing unreachable becomes reachable.
 *
 * WHAT THIS TEST PINS: a direction word is not taken for a place name, and the
 * refusal it gets names somewhere the player could say instead. It does not pin
 * which places, or the wording of either refusal.
 *
 * Confirmed red before the fix: the third assertion caught
 * "You ask after away" for every seed.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'away-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Call { name: string; action: string; ok: boolean; summary: string }
interface Said { narration?: string; toolCalls: Call[] }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number } };
}

async function standingSomewhere(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({
        seed, worldSeed: WORLD, adminMode: true
    }) as unknown as { game: Playing };
    await made.game.newRun('Lin Yue');
    // Names to point at, so the refusal has roads to offer and the test is
    // about the word rather than about an empty knowledge table.
    await made.game.act('ADMIN grant_knowledge kind=place');
    return made.game;
}

/** Every way somebody says they are leaving without saying where to. */
const NO_DESTINATION_SAID = [
    'I leave',
    'I run away',
    'I wander off',
    'I get out of here'
];

describe('leaving without naming anywhere', () => {
    it.each(NO_DESTINATION_SAID)(
        '"%s" is not answered as a failed search for a town',
        async said => {
            const game = await standingSomewhere(`away-${said.length}`);
            const narration = (await game.act(said)).narration ?? '';

            // THE ASSERTION THE OLD CODE FAILED, on "I run away". The engine
            // must not report having looked for a place the player never named.
            expect(narration, narration).not.toMatch(
                /ask(?:s|ed)? after (?:away|off|out|elsewhere|somewhere)\b/i
            );
            expect(narration, narration).not.toMatch(
                /\bNo road goes there\b/i
            );
        },
        300_000
    );

    it.each(NO_DESTINATION_SAID)(
        '"%s" is told where the roads do go',
        async said => {
            const game = await standingSomewhere(`roads-${said.length}`);
            const narration = (await game.act(said)).narration ?? '';

            // A refusal that survives names a route. Either there are roads to
            // name, or there are none and it says what closes that.
            expect(narration, narration).toMatch(
                /Somewhere you could say instead|Nowhere has been named to you yet/i
            );
        },
        300_000
    );

    it('costs no time, because nothing was walked', async () => {
        const game = await standingSomewhere('away-free');
        const before = game.state().run.elapsedDays;
        await game.act('I run away');
        expect(game.state().run.elapsedDays).toBe(before);
    }, 300_000);

    /**
     * AND THE VERB STILL WALKS A REAL ROAD. The cheapest way to make the
     * assertions above pass is to stop `move` resolving anything, so this is
     * the arm that says the fix took nothing away.
     */
    it('still travels somewhere that was actually named', async () => {
        const game = await standingSomewhere('away-control');
        const map = (await game.act('where can I go')).narration ?? '';
        const somewhere = /\n([A-Z][^:\n]{3,40}): (?:a |an |site|the )/.exec(map)?.[1];
        expect(somewhere, map).toBeTruthy();

        const said = await game.act(`I travel to ${somewhere}`);
        expect(
            said.toolCalls.some(call => call.action === 'move' && call.ok),
            said.narration
        ).toBe(true);
    }, 300_000);
});
