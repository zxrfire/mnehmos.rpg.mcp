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

/**
 * A DISCARDED NARRATION WAS UNFALSIFIABLE FROM THE LOG.
 *
 * The boundary already shouts when it throws prose away, and its own comment
 * says why: *the verdict has already been wrong once in a playtest, and a check
 * that throws away good writing without saying so is unfalsifiable.* What it
 * shouted was the KIND, and the kind is the guard's opinion rather than the
 * evidence for it.
 *
 * Twice in one blind session a turn came back as the raw engine sheet, and the
 * only way to learn which sentence had done it was to guess at prose nothing had
 * kept. So a violation now carries the clause it tripped on - the clause and not
 * the paragraph, because an operator log should not become a transcript of every
 * narration the game ever wrote.
 */
describe('a discarded narration says which words did it', () => {
    it('quotes the clause rather than the paragraph', () => {
        const found = auditNarration(
            'The wind moves over the terraces. You broke through to Qi Condensation Layer 2. '
            + 'Somebody is watching from the wall.',
            AT_LAYER_ONE
        );
        expect(found).toHaveLength(1);
        expect(found[0]!.quote).toBe('You broke through to Qi Condensation Layer 2.');
    });

    it('quotes the absence it found, not the answer around it', () => {
        const found = auditNarration(
            'You take stock. The question goes unanswered. Your meridians are whole.',
            AT_LAYER_ONE
        );
        expect(found.map(v => v.kind)).toEqual(['invented_absence']);
        expect(found[0]!.quote).toBe('The question goes unanswered.');
    });
});

/**
 * A RANK SAID BACKWARDS IS THE SAME RANK.
 *
 * FOUND BY PLAYING BLIND, on TURN ONE of two separate runs - the first thing a
 * new player ever reads, thrown away both times:
 *
 *     You are sixteen years old and have just reached the first layer of Qi
 *     Condensation, though you possess no cultivation method...
 *
 * Exactly true, and discarded as an invented breakthrough. The engine files
 * `Qi Condensation Layer 1`; the prose says *the first layer of Qi
 * Condensation*, which is the same rung with its halves the other way round and
 * the number written out. The check was a substring test for the engine's own
 * spelling, so it could never match - and the most ordinary sentence in the game
 * was a violation.
 *
 * The two are compared on what a rank IS now: the realm it is in, and which
 * layer of it. Word order and spelling are not the question.
 */
describe('a rank read in the player\'s own English', () => {
    it.each([
        'You have just reached the first layer of Qi Condensation.',
        'You have reached Qi Condensation Layer 1 and no further.',
        'You have attained the first rank of Qi Condensation, and no more than that.',
        'You reached Qi Condensation and stopped there.'
    ])('keeps %s', prose => {
        expect(thrownAway(prose)).toBe(false);
    });

    /**
     * AND A DIFFERENT RUNG IS STILL A DIFFERENT RUNG. This is what stops the
     * comparison being a way to say anything at all as long as the realm name
     * appears in it.
     */
    it.each([
        'You have reached the ninth layer of Qi Condensation.',
        'You have reached Qi Condensation Layer 4.',
        'You have reached Foundation Establishment.',
        'You have attained the third layer of Core Formation.'
    ])('throws away %s', prose => {
        expect(thrownAway(prose)).toBe(true);
    });
});
