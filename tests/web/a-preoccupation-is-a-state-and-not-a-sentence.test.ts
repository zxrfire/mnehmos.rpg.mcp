/**
 * What somebody is preoccupied with reaches the narrator as a state, and the
 * player without one as a sentence.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Four consecutive people, asked in turn, all came back on the identical
 * clause: *"have spent most of the years this rung allows"*. The engine had six
 * canned sentences for this column and picked between them, so the best the
 * distribution could ever buy a player was six repetitions instead of one.
 *
 * The genre says this state in an unbounded number of ways - a lamp guttering,
 * the flames of a life burning out, an old cultivator who will die at the rung
 * he is standing on - and writing it is the narrator's job. A finished sentence
 * is not a fact, and handing one over is the engine writing prose.
 *
 * ── AND THE INSTRUCTION TO REWRITE IS NOT ENOUGH ─────────────────────────
 *
 * `prompt.ts` already carries it, in as many words: *the facts above are data,
 * and their wording is not a draft*. Measured repeatedly in play, the local
 * model reproduces engine wording close to verbatim anyway, which is how one
 * canned clause becomes the player's whole experience of this channel. So the
 * fix is not another instruction. It is having nothing to lift: the narrator is
 * handed a NOTE with no subject and no finished verb, and pasting one into
 * prose is visibly broken.
 *
 * The other half is a constraint and not a defect. A run with no narrator
 * configured is a shipping mode, and there the engine's own plain sentence is
 * the whole of what the player reads - so both renderings exist and the two
 * channels carry different ones.
 *
 * ── WHY THIS IS PLAYED ───────────────────────────────────────────────────
 *
 * `what-somebody-here-is-chewing-on.test.ts` pins the two forms at the source.
 * What it cannot say is which one reaches which channel, and that is the whole
 * of the defect: the split is worth nothing if both ends print the same half.
 * The world is pinned because the square decides who is standing in it, and the
 * test fails loudly rather than vacuously when nobody in it is preoccupied.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';

/** A pinned world whose opening square has somebody with something on their mind. */
const WORLD = 'chew-a';
const RUN = 'a-state-not-a-sentence';

/** Every phase-3 user message the provider was sent. */
function narrationPrompts(provider: ScriptedProvider): string[] {
    return provider.calls
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

describe('what somebody in the square is preoccupied with', () => {
    it('reaches the narrator as a state and the engine-only player as a sentence', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['(scripted)']
        });
        const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD, provider });
        const { cultivator } = await harness.game.newRun('Probe');

        const preoccupied = harness.game.company(cultivator).named
            .filter(person => person.chewing != null);
        // Not a skip. A world where nobody is preoccupied cannot measure this,
        // and a test that quietly passes on one is measuring nothing.
        expect(preoccupied.length, 'this world was pinned because somebody here has something on their mind')
            .toBeGreaterThan(0);
        const mind = preoccupied[0].chewing!;

        await harness.game.act('I look around');
        const shown = narrationPrompts(provider).join('\n');

        expect(shown, shown).toContain(mind.state);
        expect(shown, shown).not.toContain(mind.plainly);
    });

    it('is the plain sentence when no narrator is configured', async () => {
        const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Probe');

        const preoccupied = harness.game.company(cultivator).named
            .filter(person => person.chewing != null);
        expect(preoccupied.length).toBeGreaterThan(0);
        const mind = preoccupied[0].chewing!;

        const turn = await harness.game.act('I look around');

        expect(turn.narration, turn.narration).toContain(mind.plainly);
        expect(turn.narration, turn.narration).not.toContain(mind.state);
    });
});
