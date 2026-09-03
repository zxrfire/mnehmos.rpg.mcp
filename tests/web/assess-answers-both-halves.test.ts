/**
 * "is it safe to sit and cultivate here, or will someone bother me?"
 *
 * Played against ollama, and the survivability half came back well:
 *
 *   "Coming out of Dragonvein Rock alive: certain. Grand Ascension Rising Dao can
 *    survive Dragonvein Rock."
 *
 * Nothing answered the second half. Not badly - at all, and it could not have:
 * arrivals into an idle span were built on the ruling that sitting still keeps
 * you from giving anybody a reason and does not keep anybody from having one,
 * and every input to that machinery - `arrivalExposure`, `concealmentScale`,
 * `socialReach`, `locatabilityFor` - is consulted at execution and nowhere
 * else. So the player could be interrupted and could not ask about being
 * interrupted. `AGENTS.md`'s own signature for a half-built system: the world
 * does a thing to somebody and no verb lets them ask about it.
 *
 * It is in `assess` rather than behind a new verb because the player asked ONE
 * question with two halves and should not have to know it was two.
 *
 * The constraint these tests exist to hold is the one on the ANSWER: the inputs,
 * never the roll. `encountersFor` would answer this precisely and must not be
 * called, because it takes the span length as a parameter and reporting what it
 * drew for a span nobody committed to is handing the player an outcome the
 * engine has not filed.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';

describe('assess answers being reached as well as surviving', () => {
    /**
     * `assess here` rather than the played sentence itself, and the reason is a
     * separate defect worth naming.
     *
     * With ollama in the room the played sentence routes to
     * `assess(target="Dragonvein Rock")` and reaches the place read, which is where
     * this feature lands. On the DETERMINISTIC tier the same sentence reaches
     * `assess(target="sit")` - the target extractor takes a verb out of the
     * infinitive - and `findKnownLocation` correctly refuses a place called
     * "sit". So the sentence gets `place_not_known` with no model, and no
     * assessment of anything happens at all.
     *
     * That is a target defect in the pattern table rather than anything here,
     * it is held by another agent, and it is reported rather than worked around.
     * This test asserts the feature through the phrasing that reaches the place
     * read on every tier, so it cannot go green on a fix to that and stay green
     * on a regression in this.
     */
    it('answers both halves when the read reaches the ground', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'both-halves-of-one-question' });
        await game.newRun('Shen Wuyou');

        const before = await game.state();
        const result = await game.act('assess here');

        // It is still a question, and questions are still free. This is the
        // guard from the other direction: a read that started spending would be
        // the defect this whole area exists to fix, wearing a new feature.
        expect(result.state.run.elapsedDays).toBe(before.run!.elapsedDays);
        expect(result.state.cultivator.spiritStones).toBe(before.cultivator!.spiritStones);

        // HALF ONE, which already worked and must keep working.
        expect(result.narration).toMatch(/alive|survive/i);

        // HALF TWO, which is the whole point. Asserted on the substance rather
        // than on one sentence: the ground as somebody looking would find it,
        // and what a shut door is actually worth.
        expect(result.narration).toMatch(/look for you|know to look|think to look/i);
        expect(result.narration).toMatch(/quietest/i);
    }, 120_000);

    /**
     * Nothing in the answer may be a prediction.
     *
     * The read is of standing facts. A sentence saying somebody WILL come is a
     * claim only a resolved span can make, and it is exactly what calling
     * `encountersFor` forward would have produced.
     */
    it('says who could reach them and never that anybody will', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'the-inputs-never-the-roll' });
        await game.newRun('Shen Wuyou');

        const result = await game.act('assess here');

        expect(result.narration).toMatch(/says who could/i);
        expect(result.narration).not.toMatch(
            /\b(?:will (?:arrive|come for|find you|interrupt)|is going to (?:come|arrive))\b/i
        );
    }, 120_000);

    /**
     * And a place read still reads as prose rather than as a dump.
     *
     * `AGENTS.md` names a paragraph of repeated clauses as the engine talking to
     * itself in front of the player, and this read adds four sentences to one
     * that already had three. The first draft added five: the door's worth and
     * the open-against-sealed ordering were separate lines saying the same thing
     * twice, and they are one sentence now.
     *
     * Bounded so somebody extending the read has to think about the length here
     * rather than discover it in a playtest.
     */
    it('does not turn the reckoning into a wall of text', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'not-a-dump' });
        await game.newRun('Shen Wuyou');

        const result = await game.act('assess here');
        const sentences = result.narration.split('\n').filter(l => l.trim().length > 0);

        expect(sentences.length).toBeLessThanOrEqual(9);
    }, 120_000);
});
