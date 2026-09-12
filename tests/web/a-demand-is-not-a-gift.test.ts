/**
 * A demand said to somebody's face is coercion, not a gift.
 *
 * FOUND BY MEASURING. "hand over your money" reached `give` - the verb for the
 * player handing over their OWN - and "empty your pockets" reached nothing at
 * all. The coercion rule that covers both wanted a "force him to ..." frame,
 * and a player speaking in character does not use one; they say the line.
 *
 * The rule underneath, which generalises: A PLAYER DESCRIBING THEIR OWN ACT SAYS
 * `I` AND `MY`, AND NEVER SAYS `YOUR` ABOUT THEMSELVES. So a second-person
 * possessive on a purse means somebody else's purse, being demanded. One word
 * settles a gift from a robbery.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';

/** Demands. Every one is made OF somebody. */
const DEMANDS = [
    'empty your pockets',
    'hand over your money',
    'give me everything you have',
    'turn out your purse'
];

/** Gifts. The player parting with their own, which must not move. */
const GIFTS = [
    'I hand over the stones',
    'I give him my sword'
];

describe('a demand is not a gift', () => {
    it('reads a demand made to somebody as coercion', () => {
        for (const said of DEMANDS) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('coerce');
            expect(plan.intent, said).toBe('hand_over');
        }
    });

    it('leaves the player handing over their own alone', () => {
        for (const said of GIFTS) {
            expect(parseIntent(said).action, said).toBe('give');
        }
    });

    /**
     * The same question about a place rather than about a moment. "is it safe"
     * answered and "is this place safe" did not.
     */
    it('answers the safety question however the place is named', () => {
        for (const said of ['is it safe here', 'is this place safe', 'is this town safe']) {
            expect(parseIntent(said).action, said).toBe('assess');
        }
    });
});
