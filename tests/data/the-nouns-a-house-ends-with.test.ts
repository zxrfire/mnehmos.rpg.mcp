/**
 * The parser's idea of what a house is called, against the catalog's.
 *
 * There were ten hand-written alternations of house words in `src/web/` and no
 * two agreed. Not one of them had ever heard of a guild, and four houses in the
 * catalog end in one - so "I take the Cinnabar Crucible Sect intake" was read
 * as somebody lifting an object called "Cinnabar Crucible Sect intake" out of
 * a pouch, and had been since the guild was written.
 *
 * A list of words that is supposed to describe a catalog only stays true if
 * something checks. This is the something.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/sects';
import { HOUSE_TYPE_NOUNS } from '../../src/web/what-a-house-is-called';

/**
 * Houses whose name ends in something that is not a type noun, each reviewed.
 *
 * A clan called by its surname alone is the ordinary case - `Cao`, `Lin`, `Xu`
 * - and a handful of houses are named for what they are rather than what kind
 * of body they are. Those do not want a word adding to the list: the list is
 * for the nouns a NAME ends with, and adding `severed` to it would make every
 * sentence containing that word look institutional.
 */
const NAMED_WITHOUT_A_TYPE_NOUN: ReadonlySet<string> = new Set([
    'cao', 'chu', 'fu', 'gu', 'lin', 'xu', 'yan',
    'severed', 'wanderers', 'source', 'severance', 'ground', 'register'
]);

describe('what a house is called', () => {
    it('knows every noun the catalog ends a house name with', () => {
        const missing = SECTS
            .map(house => house.name.trim().split(/\s+/).pop()!.toLowerCase())
            .filter(word => !HOUSE_TYPE_NOUNS.includes(word))
            .filter(word => !NAMED_WITHOUT_A_TYPE_NOUN.has(word));

        expect(
            [...new Set(missing)].sort(),
            'A house was added whose type noun the parser does not know. Add it to '
            + 'HOUSE_TYPE_NOUNS, or - if the name does not end in a type noun at all - '
            + 'to NAMED_WITHOUT_A_TYPE_NOUN with the reason.'
        ).toEqual([]);
    });

    /** Longest-first, so an alternation never matches the short word inside a long one. */
    it('is ordered so no entry is shadowed by a shorter one before it', () => {
        const shadowed = HOUSE_TYPE_NOUNS.filter((word, at) =>
            HOUSE_TYPE_NOUNS.slice(0, at).some(earlier => word.includes(earlier)));
        expect(shadowed).toEqual([]);
    });
});
