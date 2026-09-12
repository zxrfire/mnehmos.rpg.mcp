/**
 * "where can I go" answered in full and reported itself refused.
 *
 * FOUND BY MEASURING REFUSALS. `scripts/probe-what-a-refusal-is-still-for.ts`
 * put `destinations` at 6 chosen, 6 refused, 100% - the worst rate of any verb
 * in the corpus, and the striking one, because the sentence demonstrably
 * answers in play. It answers here too:
 *
 *     > where can I go
 *     You are in Cold Peak, The White Stair, standing at Qi Condensation
 *     Layer 13. The White Stair carries nobody past Body Integration Marrow.
 *     ...
 *
 * The read was never refused. The turn files TWO calls - `whereCouldTheyGo`,
 * which is the answer, and `whatCanBeSeenFromUpThere`, which is the separate
 * perception channel for ground too far off to have a name. The second was
 * recorded as
 *
 *     ok: overlook.seen > 0
 *
 * and `whatCanBeSeenFromUpThere` returns nothing at all below ordinal 15, the
 * rung a cultivator first leaves the ground. So every cultivator under that
 * rung - which is every cultivator the corpus plays, and most cultivators in
 * any run - filed a refusal for having correctly seen nothing from a height
 * they cannot reach.
 *
 * ── A COUNT IS NOT A SUCCESS FLAG ────────────────────────────────────────
 *
 * `ok` means the engine declined to act. An empty list is an answer: nothing
 * is visible from here, which is a fact about the world and about the rung,
 * and the module says so in its own structure line. Scoring the answer by how
 * many rows it contains makes every honest "none" indistinguishable from a
 * failure to understand, and that distinction is the whole of what the refusal
 * metric is measuring.
 *
 * The same shape sits on five more calls in `turn-engine.ts` (`ok:
 * heard.length > 0` and its siblings). They are not fixed here, and they are
 * written down in the probe's header so the next person does not have to find
 * them again.
 *
 * WHAT THIS TEST PINS: a turn whose read answered does not report itself as a
 * refusal. It does not pin the rung, the place, or how many rows came back -
 * all three move with the catalog.
 *
 * Confirmed red before the fix: `ok: overlook.seen > 0` fails the second
 * assertion for every seed, because the probe's cultivator never reaches
 * ordinal 15.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'empty-read-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Call { name: string; action: string; ok: boolean; summary: string }
interface Said { narration?: string; toolCalls: Call[] }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
}

async function standingSomewhere(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({
        seed, worldSeed: WORLD, adminMode: true
    }) as unknown as { game: Playing };
    await made.game.newRun('Lin Yue');
    return made.game;
}

/** Every call the turn filed that was not the narrator's own. */
function engineCalls(said: Said): Call[] {
    return said.toolCalls.filter(call => !call.name.startsWith('narrator.'));
}

describe('a map read from under the flying rung', () => {
    it('answers with somewhere to go', async () => {
        const game = await standingSomewhere('empty-read-a');
        const said = await game.act('where can I go');

        // The read answered: it named where they are standing and listed
        // ground. Not WHICH ground - that is the catalog's business.
        expect(said.narration ?? '', said.narration).toMatch(/\bYou are in\b/i);
        expect(
            engineCalls(said).some(call => call.action === 'destinations' && call.ok),
            'the destinations read came back ok'
        ).toBe(true);
    }, 300_000);

    /**
     * THE ASSERTION THE OLD CODE FAILED. Seeing nothing from a height you
     * cannot reach is the correct answer, not a declined action.
     */
    it('does not file a refusal for having seen nothing from up there', async () => {
        const game = await standingSomewhere('empty-read-b');
        const said = await game.act('where can I go');

        const declined = engineCalls(said).filter(call => !call.ok);
        expect(
            declined.map(call => `${call.name}/${call.action}: ${call.summary}`),
            'a read that answered files no refusal'
        ).toEqual([]);
    }, 300_000);

    /**
     * And the channel still REPORTS the floor, because a player who cannot see
     * over the horizon should be able to find out that is why. What moved is
     * whether that counts as the engine declining to act, not whether it is
     * said.
     */
    it('still says why nothing was visible', async () => {
        const game = await standingSomewhere('empty-read-c');
        const said = await game.act('where can I go');

        const overlook = engineCalls(said).find(call => /UpThere/.test(call.name));
        expect(overlook, 'the perception channel still files its account').toBeTruthy();
        expect(overlook!.summary, overlook!.summary).toMatch(/horizon|returns nothing/i);
    }, 300_000);
});
