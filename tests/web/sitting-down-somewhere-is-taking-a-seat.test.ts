/**
 * Sitting down in an inn is taking a seat, and it cost thirty days.
 *
 * FOUND BY PLAYING, three times in one run and reproduced:
 *
 *     "I sit down across from He Xuxue and order a bowl of noodles"
 *     "I sit down in the corner of the inn, gather the qi in my dantian and
 *      try to break through to the next layer"
 *
 * Both spent a month. The second is the first turn of a life; the first is
 * somebody sitting down to eat with the man who raised them.
 *
 * ── WHY THE WHOLE SENTENCE READING WOULD NOT HAVE SHOWN IT ───────────────
 *
 * Both sentences parse CORRECTLY end to end - `buy` for the first and
 * `breakthrough` for the second - and that is exactly what hid this. A plan of
 * several steps is checked CLAUSE BY CLAUSE, so the reader is asked about "I
 * sit down across from He Xuxue" on its own, and on its own it was a sitting.
 *
 * And that is why the model's `cultivate` passed the guard in `narrator.ts`.
 * The guard was applied to the step, correctly, and it asks whether the model
 * is why the turn became dangerous - the table said `cultivate` for that clause
 * too, so the model was not. Two readers agreeing is what the guard is looking
 * for. The reading they agreed on was the wrong one.
 *
 * ── AND `down` IS THE WHOLE OF THE DISTINCTION ───────────────────────────
 *
 * It is the genre's own: a cultivator SITS, and somebody taking a chair sits
 * DOWN. `sit` is one of the two weak members of the cultivation list precisely
 * because it carries idioms - its guard's own header says so, and already held
 * `sits tight` and `settled with his hands`.
 *
 * THE POSITIVE HALF IS THE POINT OF THE TEST. A guard against an idiom is one
 * regex away from eating the verb it guards, so a sentence that says which it
 * is takes the guard back: "I sit down to cultivate" and "I sit down
 * cross-legged" are sittings and stay ones.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

describe('sitting down somewhere', () => {
    /**
     * THE CLAUSES THAT SPENT A MONTH. These are what the planner reads on its
     * own, which is where the price was paid.
     */
    it.each([
        'I sit down',
        'I sit down across from He Xuxue',
        'I sit down in the corner of the inn',
        'I sit down at the table',
        'I sat down beside him'
    ])('%j does not sit the player down for a month', said => {
        expect(parseIntent(said)?.action).not.toBe('cultivate');
    });

    /**
     * AND THE WHOLE SENTENCES STILL REACH WHAT THEY ALWAYS DID. Both were
     * already right end to end; a guard that fixed the clause and broke the
     * sentence would have traded one defect for a worse one.
     */
    it('still orders the noodles', () => {
        expect(parseIntent('I sit down across from He Xuxue and order a bowl of noodles').action)
            .toBe('buy');
    });

    it('still breaks through', () => {
        expect(parseIntent(
            'I sit down in the corner of the inn, gather the qi in my dantian and try to break '
            + 'through to the next layer'
        ).action).toBe('breakthrough');
    });

    /**
     * AND A SITTING THAT SAYS IT IS ONE IS STILL A SITTING. The exception is
     * about the whole sentence rather than about what follows the verb, so a
     * cultivation word anywhere in it takes the guard back.
     */
    it.each([
        'I sit down to cultivate',
        'I sit down and meditate',
        'I sit down cross-legged',
        'I sit down and gather qi',
        'I sit in meditation',
        'I sit and cultivate'
    ])('%j is still a sitting', said => {
        expect(parseIntent(said)?.action).toBe('cultivate');
    });

    /**
     * AND THE IDIOMS THE GUARD ALREADY HELD ARE UNTOUCHED, because a new
     * alternative in a joined pattern is the commonest way to lose an old one.
     */
    it('leaves the idioms that were already there where they were', () => {
        expect(parseIntent('I sit tight').action).toBe('wait');
        expect(parseIntent('I settle my debt').action).not.toBe('cultivate');
        expect(parseIntent('I settle this with my fists').action).toBe('attack');
    });
});
