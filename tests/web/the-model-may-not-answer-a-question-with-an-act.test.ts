/**
 * Two more things a model's reading may not do, both found by playing.
 *
 * The standing rule of `narrator.ts` is that a model reading a sentence
 * differently is the entire point of having one, and neither of these touches
 * it. Both are hard boundaries on one axis, checked outside the cost rule for
 * the reason the giving-and-taking rule already gives: cost is not the axis
 * they are about, and the guard's cheap exit waves through anything free.
 *
 * A DELIBERATE `unclear` IS AN ANSWER. `ASKING_WHAT_IS_POSSIBLE` is somebody
 * stepping outside the fiction to ask what there is to do, and the engine
 * answers it at `case 'unclear'` with the live-affordances read. The embedding
 * tier has been forbidden to re-route that family since it landed; the model
 * was held to no such rule, so with a model running the sentence never reached
 * the surface written for it.
 *
 * AND EARNING IS NOT SPENDING. "I need to earn some stones. Is there work going
 * here?" was answered with the price of undyed cloth and a plot of ground for a
 * grave. The player said EARN and the engine answered SPEND - opposite
 * directions across one counter.
 */

import { describe, expect, it } from 'vitest';

import { ProviderNarrator } from '../../src/web/narrator';
import { parseIntent } from '../../src/web/actions';
import { ScriptedProvider, makeGameInWorld } from './harness';

const modelSaying = (json: string) =>
    new ProviderNarrator(new ScriptedProvider({ plans: [json] }), { model: 'test' });

describe('a question about what is possible', () => {
    it('is not answered with a journey', async () => {
        const plan = await modelSaying('{"action":"destinations"}')
            .plan("I've got thirty stones and no idea what I'm doing. Where should I start?", '');
        expect(plan.action.action).toBe('unclear');
        expect(plan.source).toBe('fallback');
    });

    it('is not answered with the market either', async () => {
        const plan = await modelSaying('{"action":"market"}').plan('what can I do here', '');
        expect(plan.action.action).toBe('unclear');
    });

    /**
     * VISIBLE, NOT SILENTLY CORRECTED. Half a day went into diagnosing
     * sentences whose real story could not be seen from the page.
     */
    it('says what the model read and what ran instead', async () => {
        const plan = await modelSaying('{"action":"destinations"}')
            .plan('Where should I start?', '');
        expect(plan.note).toBeTruthy();
        expect(plan.note!).toMatch(/model read this as/i);
        expect(plan.note!).toMatch(/what there is to do/i);
    });

    it('leaves the model alone when it agreed', async () => {
        const plan = await modelSaying('{"action":"unclear"}').plan('what can I do here', '');
        expect(plan.source).toBe('model');
    });

    /** One closed family, identified by the predicate that already exists. */
    it('touches nothing outside that family', async () => {
        const plan = await modelSaying('{"action":"assess","target":"Bai Xuping"}')
            .plan('I look at Bai Xuping', '');
        expect(plan.action.action).toBe('assess');
        expect(plan.source).toBe('model');
    });
});

describe('a question about earning', () => {
    it('is not answered with what things cost', async () => {
        const said = 'I need to earn some stones. Is there work going here?';
        expect(parseIntent(said).action).toBe('work');
        const plan = await modelSaying('{"action":"market"}').plan(said, '');
        expect(plan.action.action).toBe('work');
        expect((plan.action as { intent?: string }).intent).toBe('board');
        expect(plan.source).toBe('fallback');
    });

    it('is not answered with a purchase either', async () => {
        const plan = await modelSaying('{"action":"buy","target":"a manual"}')
            .plan('is there work going here?', '');
        expect(plan.action.action).toBe('work');
    });

    /**
     * AND IT NEVER HANDS BACK THE TAKING.
     *
     * Correcting toward `work` is normally the forbidden direction - `any work
     * going?` once spent NINETY DAYS as a Shipmaster, which is the incident the
     * `board` label exists because of. So the degrade is only ever to the
     * QUESTION form. A table reading of bare `work` is the taking, and it is
     * left where it is rather than risk being the reason a season disappeared.
     */
    it('will not turn a cheap reading into a season of somebody else\'s fields', async () => {
        const said = 'I take whatever labour is going';
        expect(parseIntent(said).action).toBe('work');
        expect((parseIntent(said) as { intent?: string }).intent).toBeUndefined();

        const plan = await modelSaying('{"action":"market"}').plan(said, '');
        expect(plan.action.action).toBe('market');
        expect(plan.source).toBe('model');
    });

    it('leaves a real question about the stalls alone', async () => {
        const plan = await modelSaying('{"action":"market"}').plan('what is for sale here', '');
        expect(plan.action.action).toBe('market');
        expect(plan.source).toBe('model');
    });
});

/**
 * The precondition the earning axis rests on, asserted rather than assumed.
 *
 * That axis corrects TOWARD `work`, which is the one direction this file
 * otherwise refuses, and it is safe only because it corrects to the `board`
 * intent, which reads the wall and spends nothing. That is a fact about another
 * verb in another file.
 *
 * If reading the board ever costs a day, the guard becomes a way to spend one
 * on somebody who asked a question - and every other test here would still
 * pass. This is the one that would not.
 */
describe('what the earning axis is allowed to hand back', () => {
    it('costs the player nothing to read', async () => {
        const h = await makeGameInWorld({ worldSeed: 'guard-board', seed: 'guard-board' });
        await h.game.newRun('Asker');

        const before = h.game.state();
        const asked = await h.game.act('is there work going here?');
        const after = h.game.state();

        // The verb the axis degrades to, and the intent that makes it a read.
        expect(parseIntent('is there work going here?').action).toBe('work');
        expect((parseIntent('is there work going here?') as { intent?: string }).intent)
            .toBe('board');

        expect(after.run.elapsedDays, 'reading what is going spends no days')
            .toBe(before.run.elapsedDays);
        expect(after.cultivator.spiritStones, 'and earns nothing either')
            .toBe(before.cultivator.spiritStones);
        expect(after.cultivator.hp).toBe(before.cultivator.hp);
        // And it is an answer rather than a refusal, or the guard would be
        // handing back a dead end.
        expect(asked.narration.length).toBeGreaterThan(40);
    }, 60_000);
});
