/**
 * The read that says where a player stands existed and almost nothing reached
 * it.
 *
 * `sect` with `intent: standing` answers the whole of it in one turn - the
 * house, the rank, the stipend, who stands highest in it, and what the next rung
 * costs in rungs and in contribution. Measured on the path toward becoming an
 * elder, three sentences a player types to ask exactly that:
 *
 *   what is my standing in the sect   -> sect/standing   correct
 *   what sect am I in                 -> sect, NO intent
 *   what house am I in                -> sect, NO intent
 *   am I in a sect                    -> unclear
 *
 * With no intent `sect` falls through to the catalogue of houses that would take
 * you, so a question about the player's own state was answered with an
 * advertisement, and the third got a blank look.
 *
 * The rule these pin: a sentence asking about the asker's CURRENT membership is
 * the standing read, and a sentence asking which houses are open is still the
 * catalogue. The two are told apart by that and by nothing else.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/verb-pattern-table';

const routeOf = (line: string) => {
    const plan = parseIntent(line);
    return `${plan.action}${plan.intent ? `/${plan.intent}` : ''}`;
};

describe('asking which house you are in reaches the read that says', () => {
    it('answers a question about your own membership with your own standing', () => {
        for (const line of [
            'what sect am I in',
            'what house am I in',
            'which clan am I in',
            'am I in a sect',
            'am I still in the sect',
            'do I belong to a sect',
            'who am I with'
        ]) {
            expect(routeOf(line), line).toBe('sect/standing');
        }
    });

    it('leaves the sentence that was already right where it was', () => {
        expect(routeOf('what is my standing in the sect')).toBe('sect/standing');
    });

    it('does not swallow the question about which houses would have you', () => {
        // A shopping question is a different question and still reaches the
        // catalogue. Collapsing the two would trade one wrong answer for
        // another.
        for (const line of [
            'which sects would take me',
            'what sects are near here',
            'which houses take people like me'
        ]) {
            expect(routeOf(line), line).not.toBe('sect/standing');
        }
    });
});
