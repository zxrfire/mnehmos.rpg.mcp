/**
 * Sentences where a verb's own word belongs to somebody else's idiom.
 *
 * The dangerous output is never the refusal - it is the confident opposite.
 * `I strike up a conversation with X` reaching `attack` is the worst shape a
 * misroute has: the sentence routes, the target becomes the literal string
 * "up a conversation with X", the turn reports success, and a player who
 * meant to be friendly has swung at somebody. Nothing tells them.
 *
 * Both cases here were found by running the parser over
 * `scripts/a-corpus-of-things-players-actually-type.ts` - sentences written
 * from the player's side for a different purpose, so they are not this file's
 * own paraphrases of itself.
 *
 * The rule these pin: an exemption that stops the wrong act is only half a
 * fix. A sentence that no longer attacks and now resolves to nothing has
 * traded a wrong act for a refusal, which is better and is not the answer.
 * Each case asserts BOTH that the wrong verb is gone and that the right one
 * arrived, and that the object survived the idiom.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table.js';

describe('an attack word inside an idiom', () => {
    it.each([
        'I strike up a conversation with the steward',
        'I strike up a conversation with Bai Minping',
        'strike up a conversation with the innkeeper'
    ])('%s opens a conversation rather than a fight', said => {
        const got = parseIntent(said);
        expect(got.action, said).toBe('interact');
        expect(got.intent, said).toBe('talk');
        // The object has to survive the particle. Before the exemption the
        // target was the whole tail - "up a conversation with Bai Minping" -
        // which is a person who does not exist, aimed at by a verb that does.
        expect(got.target, said).not.toMatch(/^up a conversation/);
    });

    it('still swings when the sentence is a swing', () => {
        // The exemption is on the phrase `strike up`, never on `strike`.
        for (const said of ['I strike Bai Minping', 'I strike at him', 'I attack the bandit']) {
            expect(parseIntent(said).action, said).toBe('attack');
        }
    });

    it('leaves the ladder exemption alone', () => {
        // `AIMED_AT_THE_LADDER`'s own case, asserted here because both guards
        // sit on the same branch and a change to one can shadow the other.
        expect(parseIntent('have I hit a wall').action).toBe('ceiling');
    });
});

describe('asking what a stall sells is not selling to it', () => {
    it.each([
        'what do they sell here',
        'what does the merchant sell',
        'what do they stock'
    ])('%s reads the board', said => {
        expect(parseIntent(said).action, said).toBe('market');
    });

    it('still empties the pouch when the sentence is a sale', () => {
        for (const said of ['I sell the Qi Grass', 'I sell my herbs at the market']) {
            expect(parseIntent(said).action, said).toBe('sell');
        }
    });

    it('leaves the board questions that already worked', () => {
        expect(parseIntent('what is for sale here').action).toBe('market');
    });
});
