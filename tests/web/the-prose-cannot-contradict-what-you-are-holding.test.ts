/**
 * The narrator is told what this cultivator is and holds, on every turn.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The engine handed over *"You are carrying a copy of Lesser Qi-Gathering
 * Manual and have never opened it; owning it is not reading it"*, and the model
 * wrote *"A Lesser Qi-Gathering Manual is what you lack"* - the opposite,
 * sending the player after a thing in their own hand.
 *
 * THE CAUSE IS A MISSING FACT AND NOT AN UNRELIABLE MODEL. Nothing in the
 * narration prompt said what was in the pouch, so the sentence had nothing to
 * be checked against and no reason to come out one way rather than the other.
 * The fix is upstream: give the model the standing state and the class mostly
 * goes away on its own. No validation pass, no repair pass - the engine's
 * ruling is filed beside the prose and the next turn corrects a garble, which
 * is what the engine is for.
 *
 * ── AND THE HAZARD IT CARRIES ────────────────────────────────────────────
 *
 * A standing condition handed over every turn becomes the opening line every
 * turn. That is measured, on the ambient qi reading: six turns on one island,
 * five of them opening on the qi in near enough the same words. An inventory
 * would go the same way. The design owner's rule: *unless I'm asking about the
 * state don't tell me about the state*, and *the state influences the narration
 * with details*.
 *
 * So the instruction rides on the same lines as the facts - the treatment the
 * ambient block already uses - and what is asserted here is that both halves
 * are present: the facts, and the thing that stops them being recited.
 *
 * Nothing here asserts a book NAME out of the catalog. The title is read out of
 * what the stall printed, because any name the game prints is a name the game
 * must carry.
 */

import { describe, expect, it } from 'vitest';

import { makeGame, ScriptedProvider } from './harness';
import { manualsAStallCarries } from '../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall';

const RUN = 'standing-state';

/** The phase-3 user messages, which is the only channel this is about. */
function narrationPrompts(provider: ScriptedProvider): string[] {
    return provider.calls
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

describe('what the narrator is told about the player', () => {
    it('names the book in their hand, so the prose cannot say they lack it', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"buy"}', '{"action":"look"}'],
            narrations: ['(scripted)']
        });
        const harness = makeGame({ seed: RUN, provider });
        const { cultivator } = await harness.game.newRun('Holder');
        harness.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 500 });

        // Out of the catalog the stall reads from, not written out here: a name
        // this test hard-coded would be measuring somebody else's rename.
        const title = manualsAStallCarries()[0]!.name;
        await harness.game.act(`I buy the ${title}`);

        const mark = narrationPrompts(provider).length;
        await harness.game.act('I look around');
        const prompt = narrationPrompts(provider).slice(mark).join('\n');

        expect(prompt, prompt).toContain(title);
        // And the standing facts beside it, which is what a sentence about the
        // world can contradict.
        expect(prompt).toMatch(/spirit stone/);
        expect(prompt).toMatch(/no cultivation method at all|has sat down with/);
        expect(prompt).toMatch(/meridians whole|open inside/);
    });

    /**
     * The half that keeps it from becoming the next ambient-qi line. Without
     * this the block is an inventory handed over every turn, and an inventory
     * handed over every turn gets read back every turn.
     */
    it('marks the state as standing background it must not report', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['(scripted)']
        });
        const harness = makeGame({ seed: `${RUN}-quiet`, provider });
        await harness.game.newRun('Quiet');

        await harness.game.act('I look around');
        const prompt = narrationPrompts(provider).join('\n');

        expect(prompt).toMatch(/standing background and NOT news/);
        expect(prompt).toMatch(/never becomes a line of its own/);
        // The worked pairs, because a pair is what this model follows and an
        // abstract ban is not.
        expect(prompt).toMatch(/knocks against the hip/);
        expect(prompt).toMatch(/a step is favoured/);
    });
});
