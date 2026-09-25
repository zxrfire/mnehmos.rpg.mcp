/**
 * A name of several words is its typo when ONE of them is misspelt.
 *
 * Played: "what is your name?" was respelt "what is Four Names?", two edits
 * away, one in each word, and asking somebody their name became a question
 * about a place. The place is Fourfold Stele now, because no word of a name may
 * be a word the player types or a typo of one; this file holds the matcher to
 * the other half, that a sentence misspelling every word of a name is not it.
 */

import { describe, expect, it } from 'vitest';
import { inTheSpellingOfTheNamesTheyKnow } from '../../src/web/names-as-they-are-spelled.js';

const KNOWN = ['Fourfold Stele', 'Cao Nanshan', 'Emerald Water City', 'Iron Crest', 'Yellow Plain'];

describe('a name nearly said', () => {
    it.each([
        ['i ask cao nansan', 'i ask Cao Nanshan'],
        ['im heading to emerald water citty', 'im heading to Emerald Water City'],
        ['now im going to iron crst', 'now im going to Iron Crest'],
        ['i wanna see the yelow plain', 'i wanna see the Yellow Plain']
    ])('is that name: %s', (said, meant) => {
        expect(inTheSpellingOfTheNamesTheyKnow(said, KNOWN)).toBe(meant);
    });

    it.each([
        'im heading to emerold watter citty',
        'now im going to irun crast',
        'what is your name?'
    ])('is not a name when every word of it is misspelt: %s', said => {
        expect(inTheSpellingOfTheNamesTheyKnow(said, KNOWN)).toBe(said);
    });
});
