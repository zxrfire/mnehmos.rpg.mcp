/**
 * "I cultivate for eighty years" spent one year, and said nothing about it.
 *
 * FOUND BY PLAYING, and it is the most consequential defect measured in this
 * sweep. Measured through the real parser, in matched pairs:
 *
 *     "I cultivate for fifty years"   -> 18250 days     (fifty was in the table)
 *     "I cultivate for sixty years"   ->   365 days     (one year)
 *     "I cultivate for eighty years"  ->   365 days     (one year)
 *
 *     "I wait fifteen days"           ->    15 days
 *     "I wait fourteen days"          ->     1 day
 *     "I wait seventy days"           ->     1 day
 *
 *     "I wait twenty five days"       ->     5 days
 *     "a thousand stones"             ->     1 stone
 *
 * ── ONE TABLE, NINETEEN ENTRIES, AND NO WAY TO FAIL ──────────────────────
 *
 * `WORD_NUMBERS` stopped at fifty and skipped eleven, thirteen, fourteen,
 * sixteen through nineteen, and sixty through ninety. An unrecognised word does
 * not fail: `howManyWereNamed` starts its count at 1 and returns it. So a span
 * written in a word the table happened to lack was silently the SMALLEST
 * POSSIBLE SPAN.
 *
 * In a game whose core loop is deciding how long to sit down, and where time
 * does not come back, that is the worst shape a defect can have - no error, a
 * wrong answer, and nothing to undo it with. A player who typed the span they
 * meant got a year; a player who typed `fifty` instead of `sixty` got what they
 * asked for; and nothing on the screen distinguished the two.
 *
 * ── AND THREE MORE READS OF THE SAME WORDS, EACH DIGITS-ONLY ─────────────
 *
 * The same root cause - a number said in words is not the same read as a number
 * said in digits - had three more instances, all in
 * `what-a-request-asks-and-of-whom.ts`:
 *
 *     "I offer him 20 stones for the manual"
 *         -> request, target `him`, a_trade
 *     "I offer him twenty stones for the manual"
 *         -> request, target `him twenty stones`, a_thing
 *
 *     "I ask him for the manual with 60 spirit stones"    -> topic `manual`
 *     "I ask him for the manual with sixty spirit stones"
 *         -> topic `manual with sixty spirit stones`
 *
 * The first is the commonest haggle sentence in the game, and a WRONG person is
 * worse than no person: an absent target means whoever is at hand, and `him
 * twenty stones` means a refusal about somebody who is not standing there. The
 * second is that module's OWN documented case - its note `THE PURSE IS NOT THE
 * ASK` says leaving the money clause in would classify a teaching request as a
 * request for sixty spirit stones, and then spells the example in words.
 *
 * `THE_MONEY`'s comment already said *in either of the two ways somebody writes
 * one*. The pattern only ever handled one of them.
 *
 * ── THE SWEEP IS THE POINT OF THIS TEST ──────────────────────────────────
 *
 * Every entry in the table is driven through a played sentence, so the table
 * cannot grow an entry the parser does not honour, and a future reader adding
 * `sixteen` cannot leave it out of the alternation. A spot-check would have
 * passed on `fifty` for as long as this defect existed.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import { parseCount, WORD_NUMBER_ALTERNATION } from '../../src/web/sentence-parts';
import { stonesNamedIn } from '../../src/web/tool-result-prose';
import { whatTheOfferNames } from '../../src/web/what-a-holder-would-take-for-it';

/** Every number word, and what it means. Kept here as the reader's own list. */
const IN_WORDS: ReadonlyArray<readonly [string, number]> = [
    ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
    ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
    ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
    ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
    ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40],
    ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90]
];

describe('a span written in words is the span that was asked for', () => {
    it.each(IN_WORDS)('"I wait %s days" waits %i', (word, many) => {
        expect(parseIntent(`I wait ${word} days`).days).toBe(many);
    });

    /**
     * THE PAIRS THAT DISAGREED. Digits and words are two spellings of one
     * number and must reach the same span.
     */
    it.each(IN_WORDS)('"%s days" is the same span as "%i days"', (word, many) => {
        expect(parseIntent(`I wait ${word} days`).days)
            .toBe(parseIntent(`I wait ${many} days`).days);
    });

    /**
     * AND THE ONE THAT COSTS A LIFETIME. A year is 365 days, so eighty years is
     * a number a player can lose a run to.
     */
    it.each([
        ['fifty', 50], ['sixty', 60], ['eighty', 80], ['ninety', 90]
    ] as ReadonlyArray<readonly [string, number]>)(
        '"I cultivate for %s years" spends %i of them', (word, many) => {
            expect(parseIntent(`I cultivate for ${word} years`).days).toBe(many * 365);
        }
    );

    /**
     * A COMPOUND IS TWO WORDS AND THE READ STOPPED AT THE FIRST, so "twenty
     * five days" broke on `five` and came back as five.
     */
    it.each([
        ['twenty five', 25], ['thirty two', 32], ['forty one', 41], ['ninety nine', 99]
    ] as ReadonlyArray<readonly [string, number]>)('"%s days" is %i days', (said, many) => {
        expect(parseIntent(`I wait ${said} days`).days).toBe(many);
    });

    /**
     * AND THE ARTICLE, which is one and must stay one - the compound reading
     * must not turn "a day" into anything else.
     */
    it.each(['I wait a day', 'I wait half a day', 'I wait one day'])('%j is one day', said => {
        expect(parseIntent(said).days).toBe(1);
    });

    it('a year is a year', () => {
        expect(parseIntent('I cultivate for a year').days).toBe(365);
    });
});

describe('a count written in words is the count that was named', () => {
    it.each(IN_WORDS)('"%s stones" counts %i', (word, many) => {
        expect(parseCount(`${word} stones`)).toBe(many);
    });

    /**
     * AN ARTICLE IS THE LAST RESORT AND WAS THE FIRST. `a` and `an` are in the
     * table because "a stone" is one stone, and read in sentence order they
     * also won every race they were in: "a thousand stones" was ONE.
     */
    it.each([
        ['a thousand stones', 1000],
        ['three hundred stones', 300],
        ['a hundred stones', 100],
        ['a stone', 1]
    ] as ReadonlyArray<readonly [string, number]>)('%j counts %i', (said, many) => {
        expect(parseCount(said)).toBe(many);
    });

    /**
     * AND THE TABLE CANNOT GROW AN ENTRY THE ALTERNATION DOES NOT CARRY. The
     * alternation is what three separate regexes splice in to see a number said
     * in words; a word in one and not the other is how this defect was shaped.
     */
    it.each(IN_WORDS)('%s is in the alternation the regexes splice in', word => {
        expect(WORD_NUMBER_ALTERNATION.split('|')).toContain(`${word} `);
    });

    /**
     * LONGEST FIRST, so `seventeen` is not eaten by `seven` and `sixteen` not
     * by `six`. The comment on the alternation says so; nothing checked it, and
     * it now matters far more than it did with nineteen entries.
     */
    it('is ordered longest first', () => {
        const lengths = WORD_NUMBER_ALTERNATION.split('|').map(word => word.length);
        expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
    });
});

describe('the request parser reads both spellings the same way', () => {
    /**
     * A WRONG PERSON IS WORSE THAN NO PERSON. An absent target means whoever is
     * at hand; `him twenty stones` means a refusal about somebody not standing
     * there.
     */
    it.each([
        'I offer him 20 stones for the manual',
        'I offer him twenty stones for the manual',
        'I offer him sixty stones for the pill',
        'I offer her twenty stones for it'
    ])('%j names a person and not a sum', said => {
        expect(parseIntent(said).target).toMatch(/^(?:him|her|them)$/i);
    });

    it('reads a price in words as the trade it is', () => {
        expect(parseIntent('I offer him twenty stones for the manual').intent)
            .toBe(parseIntent('I offer him 20 stones for the manual').intent);
    });

    /**
     * THE MODULE'S OWN DOCUMENTED CASE, which worked in digits and failed in
     * words. See its note `THE PURSE IS NOT THE ASK`.
     */
    it.each([
        'I ask him for the manual with 60 spirit stones',
        'I ask him for the manual with sixty spirit stones'
    ])('%j asks for the manual and not for the purse', said => {
        expect(parseIntent(said).topic).toBe('manual');
    });
});

/**
 * AND THE TWO READERS THAT TURN A SUM INTO MONEY THAT MOVES.
 *
 * Both were digits-only, and both are read off the PLAYER's own sentence.
 *
 * `stonesNamedIn` is the worse of the two, because of what its caller does with
 * a sum it cannot see: `stonesOffered: stonesNamedIn(rawInput) ?? 0`. A player
 * who wrote their payment in words commissioned the work for NOTHING, and the
 * unpaid path is the one that opens a favour recording that the maker took
 * nothing for it. The payment did not fail - it was never there.
 *
 * `A_SUM_OF_STONES` carried the same false comment `THE_MONEY` did - *in either
 * of the two ways somebody writes one* - and handled one of them. A sum it did
 * not recognise fell past it to the art and pill catalogs, so a player putting
 * money down was read as offering something that is not money.
 */
describe('a sum put down in words is money', () => {
    it.each([
        ['I offer twenty stones', 20],
        ['I offer 20 stones', 20],
        ['I offer sixty spirit stones', 60],
        ['I put down a hundred stones', 100]
    ] as ReadonlyArray<readonly [string, number]>)('%j puts down %i', (said, many) => {
        expect(stonesNamedIn(said)).toBe(many);
    });

    it('is still nothing where no sum is named', () => {
        expect(stonesNamedIn('I offer nothing at all')).toBeNull();
        expect(stonesNamedIn('I offer him my sword')).toBeNull();
    });

    it.each([
        ['twenty stones', 20],
        ['20 stones', 20],
        ['sixty spirit stones', 60],
        ['about thirty stones', 30]
    ] as ReadonlyArray<readonly [string, number]>)('%j is a sum of %i', (said, many) => {
        const named = whatTheOfferNames(said);
        expect(named.medium).toBe('stones');
        expect(named.medium === 'stones' ? named.stones : null).toBe(many);
    });
});

/**
 * AND A SECOND COPY OF THE TABLE, WRITTEN OUT BY HAND.
 *
 * `sect-phrasings.ts` spelled `one|two|three|...|ten` into its own recruiting
 * pattern and stopped there, and spelled it for one of the three verb forms.
 * Measured:
 *
 *     "I take three disciples"   -> recruit
 *     "I take twelve disciples"  -> UNCLEAR
 *     "I take twenty disciples"  -> UNCLEAR
 *
 * A hand-written second copy of a list can only ever drift from the first, and
 * had - by seventeen words. It is the same defect as the four regexes above,
 * with the table transcribed instead of spliced.
 */
describe('the number table has one copy', () => {
    it.each([
        'I take a disciple',
        'I take three disciples',
        'I take twelve disciples',
        'I take twenty disciples',
        'I take ninety disciples'
    ])('%j is a recruitment', said => {
        const parsed = parseIntent(said);
        expect(parsed.action).toBe('sect');
        expect(parsed.intent).toBe('recruit');
    });

    /**
     * AND `take` STILL MEANS THE OTHER THINGS IT MEANS. It is one of the
     * busiest verbs in the table and a widening here must not reach them.
     */
    it.each([
        ['I take the pill', 'consume_pill'],
        ['I take the manual', 'interact']
    ])('%j stays %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });
});
