/**
 * The player said two things and the turn did one of them.
 *
 * Filed from a played run. `I buy a month of rations and eat` bought the
 * rations and did not eat, and said nothing about the eating - the hunger
 * banner stayed up until the player typed `I eat` on its own. The purchase was
 * correct; the silence was the defect.
 *
 * These tests hold two things at once, and the second is the one that will
 * break if somebody widens the rule:
 *
 *   - the clause that did not run is NAMED, in the prose and in the log
 *   - an ordinary one-intent sentence that merely contains the word "and" is
 *     left completely alone
 */

import { describe, it, expect } from 'vitest';

import { makeGame } from './harness';
import {
    theClauseThisTurnDidNotRun,
    sayingWhatWasNotDone
} from '../../src/web/a-second-verb-in-the-sentence-that-was-not-run';
import { parseIntent } from '../../src/web/actions';

describe('the clause the turn did not run', () => {
    it('finds the second verb in the sentence that was filed', () => {
        const dropped = theClauseThisTurnDidNotRun('I buy a month of rations and eat', 'provision');
        expect(dropped).not.toBeNull();
        expect(dropped?.clause).toBe('eat');
        expect(dropped?.action).toBe('eat');
    });

    it('reads the same sentence written the other ways somebody would write it', () => {
        for (const said of [
            'I buy a month of rations and then eat',
            'I buy a month of rations, and eat',
            'I buy a month of rations; I eat'
        ]) {
            const dropped = theClauseThisTurnDidNotRun(said, parseIntent(said).action);
            expect(dropped?.action, said).toBe('eat');
        }
    });

    it('names the clause and the sentence that would work', () => {
        const said = sayingWhatWasNotDone({ clause: 'eat', action: 'eat' });
        expect(said).toContain('"eat"');
        // A refusal names its cause AND the way through. Both halves, or it is
        // a shrug with better grammar.
        expect(said).toMatch(/on its own/);
    });

    /**
     * The guard rail, and the reason the rule is narrow.
     *
     * Every sentence here is ONE intention described in more than one word,
     * and telling the player that half of it was ignored would be a lie.
     * Reporting any clause whose reading differs from the turn's - which is the
     * tempting generalisation - fired on three of these.
     */
    it('says nothing about an ordinary sentence that happens to contain "and"', () => {
        for (const said of [
            'I ask him about the sect and the manual',
            'I buy food and water',
            'I look around and see who is here',
            'what is my rank and my progress',
            'I travel to the Nine Peaks and back',
            'I attack him and his brother',
            'who would teach me and what would it cost',
            'I search the ruin and the valley',
            'I ask about the sect and its elders',
            'I meditate and breathe',
            'tell me about the market and the prices',
            'I sit and cultivate',
            'I bow and greet him',
            'I speak to the elder and ask about a manual',
            'I stand and look around',
            'I rest and recover',
            'I check my status and my injuries',
            'I introduce myself and ask to join the sect',
            'I buy a sword and a shield',
            'I cultivate for ten years'
        ]) {
            expect(theClauseThisTurnDidNotRun(said, parseIntent(said).action), said).toBeNull();
        }
    });
});

describe('played', () => {
    it('buys the rations, does not eat, and says so', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Shen Wuyou');

        const result = await game.act('I buy a month of rations and eat');

        // Half one: the purchase happened, exactly as it did before.
        expect(result.state.cultivator.spiritStones).toBeLessThan(30);

        // Half two, which is the defect: the eating is mentioned rather than
        // dropped, in the player's own word for it.
        expect(result.narration).toContain('"eat"');

        // And in the log, which is the channel the narrator cannot dress.
        const engineSaid = result.state.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');
        expect(engineSaid).toContain('Not run: "eat"');

        // The inspector marks it as something that did not happen.
        const routing = result.toolCalls.filter(c => c.name === 'engine.parseIntent');
        expect(routing).toHaveLength(1);
        expect(routing[0]?.ok).toBe(false);
    });

    it('leaves an ordinary sentence with no second verb untouched', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Shen Wuyou');

        const result = await game.act('I buy a month of rations');
        expect(result.toolCalls.some(c => c.name === 'engine.parseIntent')).toBe(false);
        expect(result.narration).not.toContain('only the first of them was done');
    });
});
