/**
 * Asking after the PEOPLE selling, rather than after the goods.
 *
 * Found by playing a fresh nobody in a market town. "what is for sale" answered
 * with a forty-three line board and "who is selling anything" reached
 * `unclear`, which is this repo's near-synonym rule: when one phrasing works
 * and the natural one next to it reaches nothing, the failing one is a bug.
 *
 * The second half of this file is the guard the fix needs. Every previous
 * widening in `actions.ts` has been corrected for stealing sentences from the
 * verb next door, and these words - sell, trade, buy - are the verbs of the two
 * rules directly above the market rule. So the phrasings that must keep working
 * are asserted alongside the ones that must start.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';

describe('asking who is selling reaches the board', () => {
    it('routes the person-shaped question to the market', () => {
        for (const text of [
            'who is selling anything',
            'who is selling',
            "who's selling",
            'who is trading',
            'is anybody selling',
            'is anyone selling anything',
            'are there people selling here',
            'who here has anything for sale',
            'what are they selling',
            'what are people selling'
        ]) {
            expect(parseIntent(text).action, text).toBe('market');
        }
    });

    it('still answers the goods-shaped question the way it always did', () => {
        for (const text of [
            'what is for sale',
            'what can I buy',
            'show me the market',
            'what is on the stalls'
        ]) {
            expect(parseIntent(text).action, text).toBe('market');
        }
    });
});

describe('and it does not steal from the verbs either side of it', () => {
    it('leaves a sale of something the player is carrying alone', () => {
        for (const text of [
            'I sell the Qi Grass',
            'I sell my herbs',
            'I sell the Cloudcap Mushroom'
        ]) {
            expect(parseIntent(text).action, text).toBe('sell');
        }
    });

    it('leaves a purchase alone', () => {
        expect(parseIntent('I buy a Lesser Qi-Gathering Manual').action).toBe('buy');
        // Food and provisioning own their own purchases and must keep them.
        expect(parseIntent('I buy food').action).toBe('eat');
        expect(parseIntent('I buy two years of rations').action).toBe('provision');
    });

    it('leaves a person being addressed alone', () => {
        // "who is here" is a look, not a market read, and a sentence naming a
        // person is aimed at that person.
        expect(parseIntent('who is here').action).not.toBe('market');
    });
});
