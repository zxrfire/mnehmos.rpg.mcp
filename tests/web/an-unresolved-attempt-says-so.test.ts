/**
 * An intent nothing acted on must not reach the player as an outcome.
 *
 * Played, as a member of the Azure Cloud Pavilion standing on its ground:
 *
 *   > I take a manual from the sect library without asking
 *   "You move through the library, your hand closing around a manual. You take
 *    it without asking."
 *
 * Nothing was stolen. No object moved, nobody noticed, no ledger row.
 *
 * ── WHERE IT CAME FROM, AND THE OBVIOUS ANSWER IS WRONG ──────────────────
 *
 * The suspicion was that `intent` leaks into phase 3, because the inspector
 * line for this turn reads "Stated intent: steal. Carried for the narrator;
 * read by no conditional." It does not leak. `factsForInteraction` puts the
 * label on `structure`, and `composeNarrationUser` sends `lines` alone -
 * captured off a recording provider, the word "steal" appears NOWHERE in the
 * phase-3 message. The theft reached the narrator through `THE PLAYER SAID,
 * WORD FOR WORD`, which is the player's own sentence and has to be there,
 * because asking in this game turns on what was said.
 *
 * So the model was not leaking a field. It was filling a silence. The turn's
 * own line - *"Nothing is settled by it"* - is a sentence about SETTLEMENT, and
 * a model reads that as "the social outcome is open" rather than as "the taking
 * did not occur".
 *
 * ── AND IT IS NOT ONE VERB'S BUG ─────────────────────────────────────────
 *
 * Measured across every member of `INTERACT_INTENTS` against a faction target:
 * all eleven reach the unresolved branch, and eight of them are
 * `PRESSING_SOMEBODY` acts that a narrator will render as done, because the
 * player's own sentence says they did it.
 *
 * The act itself getting a real resolver is somebody else's work. This file
 * holds the floor until it does: while nothing acts on the intent, the prose
 * may not claim it happened.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { INTERACT_INTENTS } from '../../src/web/actions';
import { whatDidNotHappen } from '../../src/web/unresolved-attempt-denials';
import type { LLMProvider } from '../../src/agent/provider/types';

/** A provider that records the phase-3 message and writes nothing useful. */
function recording(seen: string[], plan: Record<string, unknown>): LLMProvider {
    return {
        name: 'recording',
        async call(req: { messages: Array<{ role: string; content: string }> }) {
            const user = req.messages.find(m => m.role === 'user')?.content ?? '';
            const isIntent = user.includes('Respond with the JSON object only');
            if (!isIntent) seen.push(user);
            // Deliberately says nothing about the turn: the point is what the
            // engine guarantees when the narrator contributes nothing.
            return { text: isIntent ? JSON.stringify(plan) : 'The air is still.' };
        }
    } as unknown as LLMProvider;
}

const THEFT = { action: 'interact', intent: 'steal', target: 'Azure Dew Sect' };
const SAID = 'I take a manual from the sect library without asking';

describe('an attempt nothing resolved says so', () => {
    it('tells phase 3 the act did not happen, in terms of the act', async () => {
        const seen: string[] = [];
        const { game } = await makeGameInWorld({
            worldSeed: 'nothing-was-taken',
            provider: recording(seen, THEFT)
        });
        await game.newRun('Mo Qianshu');

        await game.act(SAID);
        const facts = seen[seen.length - 1] ?? '';

        // The negation is about the ACT, not about settlement. "Nothing is
        // settled" was already there and was read as an open question.
        // The denial is of the ACT, and it names the physical thing that did
        // not move. "Nothing is settled" was already there and a model can
        // narrate the hand closing against it without contradicting itself.
        expect(facts).toMatch(/[Nn]othing was taken/);
        expect(facts).toMatch(/still exactly where it was/i);
        expect(facts).toMatch(/[Nn]othing left a shelf, a purse or a hand/i);

        // And the intent label still does not reach phase 3. `structure` is
        // withheld by construction, and this asserts the construction holds:
        // if it ever stops, the narrator gains a verb nothing ran.
        const ruled = facts.slice(facts.indexOf('WHAT THE ENGINE RULED'));
        expect(ruled).not.toMatch(/\bsteal\b/i);
    }, 120_000);

    it('says it even when the narrator writes nothing about it', async () => {
        const seen: string[] = [];
        const { game } = await makeGameInWorld({
            worldSeed: 'nothing-was-taken',
            provider: recording(seen, THEFT)
        });
        await game.newRun('Mo Qianshu');

        const result = await game.act(SAID);

        // `required`, not `lines`: the model's prose said nothing at all about
        // the attempt, and `withRequiredLines` appended the sentence verbatim.
        // Without it the player reads a paragraph about still air and is left
        // believing the manual is in their hands.
        expect(result.narration).toMatch(/[Nn]othing was taken/);
        expect(result.narration).toMatch(/still exactly where it was/i);
    }, 120_000);

    it('takes nothing, whatever the sentence said', async () => {
        const { game } = await makeGameInWorld({
            worldSeed: 'nothing-was-taken',
            provider: recording([], THEFT)
        });
        await game.newRun('Mo Qianshu');

        const before = await game.state();
        await game.act(SAID);
        const after = await game.state();

        expect(after.cultivator!.spiritStones).toBe(before.cultivator!.spiritStones);
        expect(after.cultivator!.knownTechniques).toEqual(before.cultivator!.knownTechniques);
        expect(after.run!.elapsedDays).toBe(before.run!.elapsedDays);
    }, 120_000);

    /**
     * The whole family, because this was never one verb.
     *
     * Every intent that reaches the unresolved branch has to carry the same
     * guarantee, so an intent added to `INTERACT_INTENTS` that resolves nowhere
     * fails here rather than in a playtest six weeks later.
     */
    it('holds for every interact intent that resolves nowhere', async () => {
        for (const intent of INTERACT_INTENTS) {
            const { game } = await makeGameInWorld({
                worldSeed: 'nothing-was-taken-sweep',
                provider: recording([], { action: 'interact', intent, target: 'Azure Dew Sect' })
            });
            await game.newRun('Mo Qianshu');
            const result = await game.act(`I ${intent} the Azure Dew Sect`);

            // Either something actually resolved it, or the player is told
            // plainly that it did not happen. What must never happen is
            // silence, because silence is what a model fills.
            const fellThrough = result.toolCalls.some(
                c => (c.summary ?? '').includes('read by no cond')
            );
            if (fellThrough) {
                // Each intent's OWN denial, not a shared one: the collision only
                // works when the fact names what that act would have moved.
                expect(result.narration, `"${intent}" fell through and said nothing`)
                    .toContain(whatDidNotHappen(intent, 'Mo Qianshu'));
            }
        }
    }, 600_000);
});
