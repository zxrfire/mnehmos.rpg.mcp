/**
 * Turn one of a fresh run, and the first thing the player read was the raw
 * engine sheet with an apology under it.
 *
 * FOUND BY PLAYING BLIND. A sixteen-year-old at Qi Condensation Layer 1 typed
 * `where am i`. The engine answered with the place, the rung, the root, the
 * purse, and:
 *
 *     0 of 100 qi-units toward the next rank. Not yet eligible.
 *
 * The narration came back and was thrown away:
 *
 *     [narrator] narration discarded (invented_breakthrough): prose announces
 *     an advancement; the engine granted no rank and resolved no attempt
 *
 *     The account written for this turn described something that did not
 *     happen, so what is above is the engine's own record of it instead.
 *
 * ── THE CAUSE IS POLARITY, NOT SUBJECT ───────────────────────────────────
 *
 * `ADVANCED_UNAMBIGUOUSLY` matches on the verb alone, and that is deliberate
 * and correct: no house states its intake bar as *broke through*, so the phrase
 * needs no subject to be safe. What it also needs no trace of is whether the
 * clause ASSERTS the crossing or DENIES it - and the engine's own fact for that
 * turn was a negative one. Every faithful way of writing *not yet eligible* in
 * prose says "you have not broken through to <rung>", which is the pattern
 * exactly, wearing a `not`.
 *
 * This is the same distinction the `standsAt` parameter already draws, one axis
 * over. There the words were ambiguous and the SUBJECT settled them; here the
 * words are ambiguous and the POLARITY does.
 *
 * ── AND THE GUARD STILL HAS TO BITE ──────────────────────────────────────
 *
 * The risk of a negation escape is that it becomes a way to smuggle a claim
 * past: one `not` anywhere in a paragraph and the whole of it is excused. So it
 * is scoped to the clause the match sits in, and every assertion below that
 * matters is the positive one - a paragraph that denies a crossing in one
 * sentence and asserts one in the next is still thrown away.
 *
 * `no` is deliberately not a negator here. *No rung above this one that qi
 * buys* is a true sentence that can sit beside a real claim, and treating it as
 * a denial would open the guard to any prose that mentions a lack.
 */

import { describe, it, expect } from 'vitest';

import { auditNarration } from '../../src/web/narrator';

const AT_LAYER_ONE = {
    ranksGained: 0,
    breakthroughAttempted: false,
    who: 'Jiang Wu',
    standsAt: 'Qi Condensation Layer 1',
    died: false,
    answered: true
};

/** Whether the audit would throw this prose away for inventing a crossing. */
function thrownAway(prose: string): boolean {
    return auditNarration(prose, AT_LAYER_ONE)
        .some(violation => violation.kind === 'invented_breakthrough');
}

describe('a crossing that is denied is not a crossing that happened', () => {
    it.each([
        'You have not broken through to Qi Condensation Layer 2.',
        'You have not yet reached Foundation Establishment.',
        'You cannot break through to Qi Condensation Layer 2 on an empty gate.',
        'You are far from having advanced to Foundation Establishment.',
        'Nothing here has ever broken through to the Core Formation realm.',
        'Before you rise to Foundation Establishment there is a hundred qi to find.',
        'You are shy of what it takes to climb to Qi Condensation Layer 2.'
    ])('keeps prose that says it did not happen: %s', prose => {
        expect(thrownAway(prose)).toBe(false);
    });

    /**
     * AND THE CLAIM ITSELF IS STILL THROWN AWAY. This is the assertion that
     * makes the escape narrow rather than a hole; without it every test above
     * would pass against a guard that had simply been deleted.
     */
    it.each([
        'You broke through to Qi Condensation Layer 2.',
        'You have advanced to Foundation Establishment.',
        'The breakthrough succeeded and you stand at Core Formation.',
        'You rose to Qi Condensation Layer 4 in the silence of the cave.'
    ])('still throws away the claim: %s', prose => {
        expect(thrownAway(prose)).toBe(true);
    });

    /**
     * AND A DENIAL DOES NOT LAUNDER THE SENTENCE AFTER IT. The whole risk of
     * this escape is a paragraph that opens on a `not` and then says whatever
     * it likes, so the match is scoped to its own clause and every place the
     * prose says it is checked rather than only the first.
     */
    it('catches a claim standing beside a denial', () => {
        expect(thrownAway(
            'You have not broken through to Qi Condensation Layer 2. '
            + 'You advanced to Foundation Establishment instead.'
        )).toBe(true);
        expect(thrownAway(
            'You have not reached Foundation Establishment, but you broke through '
            + 'to Qi Condensation Layer 3 this morning.'
        )).toBe(true);
    });

    /**
     * AND SAYING WHERE THEY STAND IS STILL SAFE, which is what `standsAt` was
     * added for. Kept here because the two escapes now sit next to each other
     * and a change to one is a change to the other's neighbourhood.
     */
    it('keeps a faithful rank read', () => {
        expect(thrownAway('You have reached Qi Condensation Layer 1 and no further.')).toBe(false);
    });

    /**
     * AND `no` IS NOT A DENIAL. Stated as its own case because it is the
     * obvious next word to add to the list and it would quietly widen the
     * escape to most of the prose this game writes about ceilings.
     */
    it('does not let a mention of a lack excuse a claim', () => {
        expect(thrownAway(
            'There is no rung above this one that qi buys, and you broke through '
            + 'to Core Formation anyway.'
        )).toBe(true);
    });
});
