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
import { parseIntent } from '../../src/web/actions';
import {
    HOUSE_TYPE_NOUNS,
    HOUSE_TYPE_NOUNS_THAT_STAND_ALONE
} from '../../src/web/what-a-house-is-called';

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

    /**
     * The half a player can say bare has to be words houses are actually
     * called.
     *
     * "I resign from the hall" must reach the house; "I leave the valley" must
     * not, because the map has an Orchid Valley on it. A noun that is not on
     * the standing-alone half needs its house's name in front of it, which is
     * the safe default and the one a new type noun gets by saying nothing - so
     * what wants checking is the other direction: a word on the bare list that
     * no house ends in would put a category on the sect verb that names
     * nothing.
     */
    it('lets nothing onto the bare half that is not a type noun at all', () => {
        const invented = HOUSE_TYPE_NOUNS_THAT_STAND_ALONE
            .filter(word => !HOUSE_TYPE_NOUNS.includes(word));
        expect(invented, 'A word here that no house ends in is a word from nowhere.').toEqual([]);
    });

    /** Longest-first, so an alternation never matches the short word inside a long one. */
    it('is ordered so no entry is shadowed by a shorter one before it', () => {
        const shadowed = HOUSE_TYPE_NOUNS.filter((word, at) =>
            HOUSE_TYPE_NOUNS.slice(0, at).some(earlier => word.includes(earlier)));
        expect(shadowed).toEqual([]);
    });
});

/**
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE ONLY THING THAT PROVES THE LIST IS USED: A SWEEP.
 *
 * The three assertions above check the LIST against the catalog, and the list
 * was correct the whole time the parser was wrong. A gate can carry its own
 * hand-written house words, and the ratchet above never sees it - which is
 * exactly what happened, one catalog growth later.
 *
 * Measured, `parseIntent('what does the <name> have')` over every row of
 * `SECTS`: 16 of 38 houses did not reach the holdings read.
 *
 *   TEN reached no intent at all, because `WHAT_A_HOUSE_HAS` carried fifteen
 *   house words of its own and the catalog has twenty-seven - Clearwater Ward,
 *   Six Li Patrol, Bountiful Sheaf Sect, Tranquil Oasis Sect, Hollow Bell
 *   Wanderers, Still Blade Peak, Flowing Light Tower, Earth Vein Tower, Bone
 *   Lantern Cult - and The Severed, whose whole name is one word, went to the
 *   market board on `what does the \w+ have`.
 *
 *   SIX went to the deposit counter, because `legacyStep` read a custody
 *   house's NAME plus any interrogative as a question about its counter -
 *   Lantern Hall, Thousand Treasure Pavilion, Jade Register Hall, Vermilion
 *   Seal Terrace, Shrinking Earth Pavilion, Ninefold Karma Palace. The same
 *   six answered "who leads the X" and "where is the X" with the counter too.
 *
 * It was found by playing: a birth opened knowing exactly two houses and both
 * were on the list, so the player could not ask about either of the only two
 * houses their life had given them.
 *
 * A SWEEP AND NOT EXAMPLES. Every one of these questions had a passing example
 * test over a house whose type noun happened to be on the hand list. The only
 * thing that catches the thirty-ninth house is asking all of them.
 * ═════════════════════════════════════════════════════════════════════════
 */
describe('every house in the catalog can be asked about by name', () => {
    /** How a player addresses a house, which is the name without its article. */
    const asked = (house: { name: string }) => house.name.replace(/^The\s+/, '');

    const sweep = (
        phrase: (name: string) => string
    ): ReadonlyArray<[string, { action?: string; intent?: string; target?: string }]> =>
        SECTS.map(house => [
            house.name,
            parseIntent(phrase(asked(house))) as { action?: string; intent?: string; target?: string }
        ]);

    it('what does the X have reaches the holdings read, and carries which X', () => {
        const wrong = sweep(name => `what does the ${name} have`)
            .filter(([name, plan]) =>
                plan.intent !== 'what_they_hold' || plan.target !== name.replace(/^The\s+/, ''));

        expect(
            wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`),
            'A house that cannot be asked what it has. The fix is a rule, never a '
            + 'list: WHAT_A_HOUSE_HAS reads A_HOUSE_BEING_ASKED_ABOUT, which is built '
            + 'from the catalog.'
        ).toEqual([]);
    });

    /**
     * AND WHAT IT TEACHES, WHICH IS THE OTHER HALF OF THE SAME QUESTION.
     *
     * The holdings sweep above has been green for a while and its twin could
     * not be asked at all: `what does the X have` reached a read and `what
     * does the X teach` reached nothing, for all 38. That is the wrong half to
     * have built - a purse is what you ask about a house you mean to rob, and
     * a shelf is what you ask about one you mean to spend a century in.
     *
     * Same rule and the same reason it is a rule: `WHAT_A_HOUSE_TEACHES` reads
     * `A_HOUSE_BEING_ASKED_ABOUT`, so a house added tomorrow is askable the
     * day it is added.
     */
    it('what does the X teach reaches the shelf read, and carries which X', () => {
        const wrong = sweep(name => `what does the ${name} teach`)
            .filter(([name, plan]) =>
                plan.intent !== 'what_they_teach' || plan.target !== name.replace(/^The\s+/, ''));

        expect(
            wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`),
            'A house that cannot be asked what it teaches.'
        ).toEqual([]);
    });

    /**
     * The possessive stays with the seat, which may REWRITE the shelf rather
     * than merely read it. `leadershipIntent` claims it far above this table
     * and the new pattern must not reach past it.
     */
    it('leaves what does my sect teach to the seat that can change it', () => {
        const plan = parseIntent('what does my sect teach') as
            { action?: string; intent?: string };
        expect(plan.action, 'the decree read lost its own sentence').toBe('sect');
    });

    it('who leads the X reaches the standing read, and carries which X', () => {
        const wrong = sweep(name => `who leads the ${name}`)
            .filter(([name, plan]) =>
                plan.action !== 'sect'
                || plan.intent !== 'standing'
                || plan.target !== name.replace(/^The\s+/, '').toLowerCase());

        expect(
            wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`),
            'A question about who leads a house answered about a different house, or '
            + 'about the asker\'s own.'
        ).toEqual([]);
    });

    it('where is the X is a place to travel to, for every house', () => {
        const wrong = sweep(name => `where is the ${name}`)
            .filter(([, plan]) => plan.action !== 'destinations');

        expect(
            wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`),
            'A house whose own name took the question about where it is. Two did: '
            + 'the Clear River Alliance on the word `alliance` and the Silver Island '
            + 'Market on `market`, both out of INTERACT_INTENT_PATTERNS.'
        ).toEqual([]);
    });
});
