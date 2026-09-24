/**
 * The blank look is not the verb. It is what the narrator was told.
 *
 * `unclear` is the right reading for a sentence the table cannot place, and it
 * is the cheapest thing in the closed set - no day, no food, no roll, no death
 * - which is the whole reason it is in there. `misparse.test.ts` exists to keep
 * it that way. Reaching it is not a defect.
 *
 * What the player actually met was this, dressed up by a model:
 *
 *     You turn the thought over and it does not resolve into anything you
 *     could actually do standing here.
 *
 * The design owner: *"unclear is not kind of bad. what's bad is the blank look.
 * the LLM narrator can make unclear not be bad."*
 *
 * ── AND THE CAUSE WAS ONE BUILDER PUTTING ONE STRING IN TWO CHANNELS ─────
 *
 * `factsForRefusal` writes its scene into `lines` as well as `prose`, and
 * `lines` is *the complete factual content of the outcome ... what a narrator
 * is allowed to know*. So the model was handed, as a fact about the world, a
 * sentence about the player's thought failing to resolve - and the phase-3
 * prompt orders it to write every fact again in its own words. The engine
 * describing its own reader, and a narrator doing its job with it.
 *
 * The two channels part company now:
 *
 *   `lines`  - what is true. Nothing was decided, no day passed, and somebody
 *              standing there asked what was meant. A narrator can write that
 *              moment, and nothing in it is about sentences or parsing.
 *   `prose`  - unchanged, word for word. It is the shipping mode for a player
 *              with no model, the affordance list is the useful half of it,
 *              and twenty test files watch that exact string to prove a blank
 *              look did NOT happen elsewhere.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';

/** Every phase-3 user message the provider was sent since a mark. */
function narrationsSince(provider: ScriptedProvider, from: number): string[] {
    return provider.calls.slice(from)
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

/**
 * A sentence with no verb in it anywhere, so what is measured is the unread
 * path rather than a reading anybody could argue with.
 */
const READS_AS_NOTHING = 'the quality of the light on the far wall';

describe('a sentence the table could not place', () => {
    it('does not tell the narrator that the thought failed to resolve', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"unclear"}'],
            narrations: ['(scripted)']
        });
        const { game } = await makeGameInWorld({
            seed: 'unread', worldSeed: 'unread-world', provider
        });
        await game.newRun('Probe');

        const mark = provider.calls.length;
        await game.act(READS_AS_NOTHING);
        const prompts = narrationsSince(provider, mark).join('\n');

        // THE LINE THAT WAS REACHING THE PLAYER THROUGH THE NARRATOR.
        expect(prompts).not.toMatch(/does not resolve into anything/i);
        expect(prompts).not.toMatch(/turn the thought over/i);
        // AND NOT THE AFFORDANCE LIST EITHER, which is the interface talking:
        // it belongs in the prose a player with no model reads, and a narrator
        // handed it writes a menu.
        expect(prompts).not.toMatch(/Those are not the only words that work/i);
        // What it IS told: that the turn cost nothing and settled nothing.
        expect(prompts).toMatch(/Nothing was decided/i);
    }, 120_000);

    /**
     * AND THE PLAYER WITH NO MODEL READS EXACTLY WHAT THEY READ BEFORE. The
     * affordance list is the useful half of this path and the deterministic
     * narrator is a shipping mode, not a fallback - so the rewrite above must
     * not have quietly emptied it.
     */
    it('still says what would work, for a player with no narrator', async () => {
        const { game } = await makeGameInWorld({ seed: 'unread-plain', worldSeed: 'unread-world' });
        await game.newRun('Probe');

        const said = String((await game.act(READS_AS_NOTHING) as { narration?: string }).narration);
        expect(said).toMatch(/does not resolve into anything you could actually do/i);
        expect(said).toMatch(/Things that would, at this moment/i);
        expect(said).toMatch(/Those are not the only words that work/i);
    }, 120_000);
});
