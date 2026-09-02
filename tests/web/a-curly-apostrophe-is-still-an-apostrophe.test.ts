import { describe, expect, it } from 'vitest';
import { parseIntent, inTheCharactersThePatternsUse } from '../../src/web/actions';

/**
 * What a phone types must reach the same verb as what a keyboard types.
 *
 * Found by playing: "is this the Azure Cloud Pavilion's art" reached the
 * recognition verb, and the same sentence with the apostrophe a phone actually
 * produces reached nothing at all. Entity resolution already tolerated both,
 * so a NAME with a curly apostrophe resolved while the verb around it did not
 * - which is the worst version of this bug, because the half that works hides
 * the half that does not.
 *
 * It matters here more than in most games: the houses are called things like
 * The Gleaners' Company, and a possessive is the natural way to ask about
 * nearly anything one of them owns.
 */
describe('a curly apostrophe', () => {
    const CURLY = '\u2019';

    it('reaches the same verb as a straight one', () => {
        const straight = "is this the Azure Cloud Pavilion's art";
        const curly = straight.replace("'", CURLY);
        expect(curly).not.toBe(straight);
        expect(parseIntent(curly).action).toBe(parseIntent(straight).action);
        expect(parseIntent(curly).intent).toBe(parseIntent(straight).intent);
    });

    it('does the same for a house whose own name carries one', () => {
        const straight = "what do I know about The Gleaners' Company";
        const curly = straight.replace("'", CURLY);
        expect(parseIntent(curly).action).toBe(parseIntent(straight).action);
    });

    it('leaves a sentence with no typography in it exactly alone', () => {
        for (const said of ['I cultivate for a year', 'where can I go', 'who is here']) {
            expect(inTheCharactersThePatternsUse(said)).toBe(said);
        }
    });

    it('puts back the other characters a word processor substitutes', () => {
        expect(inTheCharactersThePatternsUse('\u201Cquoted\u201D')).toBe('"quoted"');
        expect(inTheCharactersThePatternsUse('a \u2014 b')).toBe('a - b');
        expect(inTheCharactersThePatternsUse('wait\u2026')).toBe('wait...');
    });
});
