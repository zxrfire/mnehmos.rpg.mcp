/**
 * The player said two things and the turn did one of them.
 *
 * Filed from a played run. `I buy a month of rations and eat` bought the
 * rations and did not eat, and said nothing about the eating - the hunger
 * banner stayed up until the player typed `I eat` on its own. The purchase was
 * correct; the silence was the defect.
 *
 * And it happens in both directions. The parser takes whichever verb its table
 * reaches first, so `I gather herbs and go to the market` browses a board and
 * the gathering disappears - the same defect from the worse end, because the
 * half that vanishes is the half that would have cost something.
 *
 * These tests hold three things at once, and the last is the one that will
 * break if somebody widens the rule:
 *
 *   - a costly clause standing AFTER the one that ran is named
 *   - a costly clause standing BEFORE it is named, with the right ordinal
 *   - an ordinary one-intent sentence that merely contains the word "and" is
 *     left completely alone, in a corpus big enough to be worth something
 */

import { describe, it, expect } from 'vitest';

import { makeGame } from './harness';
import {
    theClauseThisTurnDidNotRun,
    sayingWhatWasNotDone
} from '../../src/web/the-part-of-the-sentence-that-was-not-run';
import { parseIntent } from '../../src/web/actions';

const dropped = (said: string) => theClauseThisTurnDidNotRun(said, parseIntent(said).action);

describe('a clause standing after the one that ran', () => {
    it('finds the second verb in the sentence that was filed', () => {
        const found = theClauseThisTurnDidNotRun('I buy a month of rations and eat', 'provision');
        expect(found).not.toBeNull();
        expect(found?.clause).toBe('eat');
        expect(found?.action).toBe('eat');
        expect(found?.side).toBe('after');
    });

    it('reads the same sentence written the other ways somebody would write it', () => {
        for (const said of [
            'I buy a month of rations and then eat',
            'I buy a month of rations, and eat',
            'I buy a month of rations; I eat'
        ]) {
            expect(dropped(said)?.action, said).toBe('eat');
        }
    });

    it('catches the other costly seconds', () => {
        for (const [said, action] of [
            ['I eat and then cultivate for a year', 'cultivate'],
            ['I sell the herbs and buy a pill', 'buy'],
            ['I read the manual and practise', 'train_technique'],
            ['I take the pill and rest', 'wait']
        ] as const) {
            const found = dropped(said);
            expect(found?.action, said).toBe(action);
            expect(found?.side, said).toBe('after');
        }
    });
});

describe('a clause standing before the one that ran', () => {
    /**
     * The mirror case, and the worse one. When the SECOND thing is dropped the
     * player watches the first happen and can guess; when the FIRST is dropped,
     * the expensive thing they typed vanishes and a cheap read runs instead.
     */
    it('names the first verb when the parser took the last', () => {
        for (const [said, action] of [
            ['I gather herbs and go to the market', 'gather'],
            ['I eat and then go to the market', 'eat'],
            ['I cultivate for a year and then go to the market', 'cultivate'],
            ['I go to Nine Peaks and look for a teacher', 'move'],
            ['I gather herbs and refine a pill', 'gather'],
            ['I train and then challenge him', 'train_technique'],
            ['I cultivate and eat when I am hungry', 'cultivate']
        ] as const) {
            const found = dropped(said);
            expect(found?.action, said).toBe(action);
            expect(found?.side, said).toBe('before');
        }
    });

    it('gets the ordinal right, because the wrong one sends the player looking for the wrong thing', () => {
        expect(sayingWhatWasNotDone({ clause: 'eat', action: 'eat', side: 'after' }))
            .toContain('only the first of them was done');
        expect(sayingWhatWasNotDone({ clause: 'I gather herbs', action: 'gather', side: 'before' }))
            .toContain('only the second of them was done');
    });

    it('names the clause and the sentence that would work', () => {
        const said = sayingWhatWasNotDone({ clause: 'eat', action: 'eat', side: 'after' });
        expect(said).toContain('"eat"');
        // A refusal names its cause AND the way through. Both halves, or it is
        // a shrug with better grammar.
        expect(said).toMatch(/on its own/);
    });
});

/**
 * The guard rail, and the reason the rule is what it is.
 *
 * Every sentence here is ONE intention described in more than one clause, and
 * telling the player that half of it was ignored would be a lie. Reporting any
 * clause whose reading differs from the turn's - the tempting generalisation -
 * fired on seven of these. Every one of the seven was a clause that costs
 * nothing, which is why the rule is "only what would have cost something"
 * rather than anything positional.
 */
describe('an ordinary sentence that happens to contain "and"', () => {
    const ORDINARY = [
        'I ask him about the sect and the manual',
        'I buy food and water',
        'I look around and see who is here',
        'what is my rank and my progress',
        'I travel to the Nine Peaks and back',
        'I attack him and his brother',
        'who would teach me and what would it cost',
        'I search the ruin and the valley',
        'I ask about the sect and its elders',
        'I cultivate for ten years',
        'I meditate and breathe',
        'tell me about the market and the prices',
        'I sit and cultivate',
        'I bow and greet him',
        // `I bow to him and wait` was here and had to leave. It was ordinary
        // only because `bow` reached nothing: the sentence really is two acts,
        // and the second one spends a day. Now that "I bow to the elder" is a
        // greeting rather than a shrug, saying that the waiting did not happen
        // is the reporter working, not the reporter misfiring.
        'I speak to the elder and ask about a manual',
        'I stand and look around',
        'I rest and recover',
        'I check my status and my injuries',
        'I introduce myself and ask to join the sect',
        'I buy a sword and a shield',
        'I train and spar',
        'I go north and then west',
        'I ask who would teach me and what it costs',
        'I greet him and ask about the sect',
        'I approach the elder and ask to be taken in',
        'I go to the market and ask what pills are for sale',
        'tell me about the sect and its elders',
        'I look around and ask who is here',
        'I speak to him and ask for a manual',
        'I find the elder and ask to be taught',
        'I talk to the physician and ask about my injuries',
        'what sects are there and what would take me',
        // Going into a ruin and looking inside it is ONE act. The after-side
        // version of this rule announced that the looking had not been done.
        'I go to the ruin and look inside',
        'I treat my injuries and then look around',
        'I ask the elder about the sect and the manual',
        'I buy a pill and take it',
        'what can I learn and what would it cost',
        'I sit down and begin to cultivate',
        'I draw my sword and attack him',
        'I kneel and beg',
        'I go inside and search',
        'I wait and watch',
        'I ask about pills and their prices',
        'I check the board and the prices',
        'I look at my injuries and my qi',
        'I ask what duties there are and take one',
        'I visit the physician and pay for treatment',
        'tell me about my spirit root and my talent',
        'I head north and keep going',
        'who is here and what are they doing',
        'I work and save my stones',
        'I search the ruin and then leave'
    ];

    it('says nothing at all', () => {
        for (const said of ORDINARY) {
            expect(dropped(said), said).toBeNull();
        }
    });

    it('is a sample big enough to be worth something', () => {
        // Pooling is what settled this rule. A guard on a judgement call,
        // asserted over five sentences, is decoration.
        expect(ORDINARY.length).toBeGreaterThanOrEqual(50);
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

    it('browses the board, does not gather, and says so', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Shen Wuyou');

        const result = await game.act('I gather herbs and go to the market');

        expect(result.narration).toContain('"I gather herbs"');
        expect(result.narration).toContain('only the second of them was done');
        const engineSaid = result.state.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');
        expect(engineSaid).toContain('Not run: "I gather herbs", standing before it');
    });

    it('leaves an ordinary sentence with no second verb untouched', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Shen Wuyou');

        const result = await game.act('I buy a month of rations');
        expect(result.toolCalls.some(c => c.name === 'engine.parseIntent')).toBe(false);
        expect(result.narration).not.toContain('of them was done');
    });
});
