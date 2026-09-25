/**
 * A name of several words is its typo when ONE of them is misspelt.
 *
 * Played: "what is your name?" was respelt "what is Four Names?", two edits
 * away, one in each word, and asking somebody their name became a question
 * about a place.
 */

import { describe, expect, it } from 'vitest';
import { inTheSpellingOfTheNamesTheyKnow } from '../../src/web/names-as-they-are-spelled.js';

const KNOWN = ['Four Names', 'Cao Nanshan', 'Green Water City', 'Iron Ridge', 'Yellow Plain'];

describe('a name nearly said', () => {
    it.each([
        ['i ask cao nansan', 'i ask Cao Nanshan'],
        ['im heading to green water citty', 'im heading to Green Water City'],
        ['now im going to iron rige', 'now im going to Iron Ridge'],
        ['i wanna see the yelow plain', 'i wanna see the Yellow Plain']
    ])('is that name: %s', (said, meant) => {
        expect(inTheSpellingOfTheNamesTheyKnow(said, KNOWN)).toBe(meant);
    });

    it('is not a name when every word of it is misspelt', () => {
        expect(inTheSpellingOfTheNamesTheyKnow('what is your name?', KNOWN)).toBe('what is your name?');
    });
});
