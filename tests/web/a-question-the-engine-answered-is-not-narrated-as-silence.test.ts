/**
 * Two defects found by playing the game blind, as somebody who knows nothing.
 *
 * A sixteen-year-old on turn one typed `where am I?`. The engine answered it in
 * five ruling blocks. The prose came back:
 *
 *     You ask where you are, but the question hangs in the humid air. There is
 *     no one immediately close enough to answer.
 *
 * Two people were standing in that square - the opening scene had named one of
 * them counting stones - and the answer was already in hand.
 *
 * ── THE RULE, AND WHAT DECIDES IT ────────────────────────────────────────
 *
 * The design owner: *if Mo Anzhi is nearby, then he can answer. If nobody is
 * nearby, I ought to answer.* So the square never decides WHETHER a question is
 * answered; it decides only who gives the answer.
 *
 * And: *there can be a non-answer if the question is incoherent, but this
 * question is coherent. I know where I am.* Which is the condition. A sentence
 * the engine could not read is `unclear`, and prose about a question going
 * nowhere is honest there and only there.
 *
 * And on who is asking: *my character does. I the player don't* - immediately
 * followed by *I mean it CAN BE the player asking aloud*. Both, and the engine
 * does not choose. A narrator may stage the question as spoken or simply
 * answer it; what it may not do is end it in nothing. So the guard is on the
 * ENDING and never on the staging.
 *
 * ── AND THE SECOND ONE, WHICH THE FIRST FIX UNCOVERED ────────────────────
 *
 * With that caught, the next blind turn was `what is my rank`. The engine
 * answered with the rank. The narration was discarded as an INVENTED
 * BREAKTHROUGH.
 *
 * Any faithful sentence about the rung somebody stands on names that rung, and
 * `you have reached Qi Condensation Layer 1` is how that sentence goes. A
 * `status` turn grants no rank and attempts nothing, so the guard's other two
 * conditions were always true - which means every well-written rank read in the
 * game was thrown away and the player got the raw sheet instead. The most basic
 * read there is could not be narrated.
 *
 * The test is which rung is NAMED. A sentence naming the rung the engine just
 * reported is repeating the engine; one naming a different rung has moved the
 * player. Same shape as the fix for a house's intake bar: the words are
 * ambiguous and the subject of them is not.
 */

import { describe, it, expect } from 'vitest';

import { auditNarration } from '../../src/web/narrator';

const AT_LAYER_ONE = {
    ranksGained: 0,
    breakthroughAttempted: false,
    died: false,
    who: 'Shen Wuyou',
    standsAt: 'Qi Condensation Layer 1'
};

const kinds = (text: string, filed: Record<string, unknown>) =>
    auditNarration(text, filed as never).map(v => v.kind);

describe('a question the engine answered is not narrated as silence', () => {
    /**
     * THE PROSE THAT WAS PLAYED, verbatim.
     */
    it('catches the turn that started this', () => {
        expect(kinds(
            'You ask where you are, but the question hangs in the humid air. There is no one '
            + 'immediately close enough to answer.',
            { ...AT_LAYER_ONE, answered: true }
        )).toContain('invented_absence');
    });

    it.each([
        'The question goes unanswered.',
        'Nobody answers.',
        'No answer comes.',
        'The question remains unanswered, and you are left standing there.'
    ])('catches %j', text => {
        expect(kinds(text, { ...AT_LAYER_ONE, answered: true })).toContain('invented_absence');
    });

    /**
     * AND THE CASE THAT LEGITIMATELY ENDS IN NOTHING. A sentence the engine
     * could not read files `answered: false`, and prose about it going nowhere
     * is the honest account of that turn.
     */
    it('allows it where the engine answered nothing', () => {
        expect(kinds(
            'You ask, and the question hangs in the air.',
            { ...AT_LAYER_ONE, answered: false }
        )).not.toContain('invented_absence');
    });

    it('checks nothing where the caller has not said', () => {
        expect(kinds(
            'You ask, and the question hangs in the air.',
            AT_LAYER_ONE
        )).not.toContain('invented_absence');
    });

    /**
     * AN EMPTY SQUARE IS A TRUE SENTENCE AND MUST STAY SAYABLE. What makes a
     * violation is ANSWERING being reported absent, not company being reported
     * absent - the narration answering in an empty square is exactly what the
     * ruling asks for.
     */
    it.each([
        'There is nobody here to ask, so you take stock of the place yourself. You stand in '
            + 'Autumn Gate, and the qi here is ordinary.',
        'The square is empty. You are in Autumn Gate, on thin ground, with thirty stones.'
    ])('leaves an empty square answering for itself: %j', text => {
        expect(kinds(text, { ...AT_LAYER_ONE, answered: true }))
            .not.toContain('invented_absence');
    });

    /**
     * AND THE STAGING IS FREE. Spoken to somebody, or simply answered - the
     * guard must not read as a vote on which.
     */
    it.each([
        'You ask the man counting stones, and he tells you: Autumn Gate, and it has been '
            + 'called that longer than anybody remembers.',
        'You stand in Autumn Gate. The air is still and the qi here is ordinary.'
    ])('says nothing about how it was staged: %j', text => {
        expect(kinds(text, { ...AT_LAYER_ONE, answered: true }))
            .not.toContain('invented_absence');
    });
});

describe('saying where somebody stands is not claiming they moved', () => {
    /**
     * THE RANK READ, which could not be narrated at all.
     */
    it.each([
        'You have only just reached Qi Condensation Layer 1.',
        'Shen Wuyou has reached Qi Condensation Layer 1 and no further.',
        'You attained Qi Condensation Layer 1 at sixteen and have not moved since.'
    ])('allows %j', text => {
        expect(kinds(text, { ...AT_LAYER_ONE, answered: true }))
            .not.toContain('invented_breakthrough');
    });

    /**
     * AND STILL CATCHES A RUNG THEY ARE NOT ON. The whole distinction is which
     * rung is named, so a guard that excused the read by excusing the words
     * would be no guard.
     */
    it.each([
        'You have reached Qi Condensation Layer 2.',
        'You have reached Foundation Establishment.',
        'Shen Wuyou attained the Core Formation realm before the hour was out.'
    ])('still catches %j', text => {
        expect(kinds(text, { ...AT_LAYER_ONE, answered: true }))
            .toContain('invented_breakthrough');
    });

    /**
     * AND THE UNAMBIGUOUS VERBS ARE UNTOUCHED BY ANY OF THIS. No house states
     * its intake bar as `broke through`, and neither does a rank read.
     */
    it('still catches a breakthrough announced outright', () => {
        expect(kinds(
            'Your breakthrough succeeded and the realm opened.',
            { ...AT_LAYER_ONE, answered: true }
        )).toContain('invented_breakthrough');
    });

    /**
     * WITHOUT THE RANK, NOTHING IS EXCUSED. A caller that files no `standsAt`
     * gets the check exactly as it behaved before, which is the safe direction.
     */
    it('excuses nothing when the caller files no rank', () => {
        expect(kinds(
            'You have only just reached Qi Condensation Layer 1.',
            { ranksGained: 0, breakthroughAttempted: false, died: false, who: 'Shen Wuyou' }
        )).toContain('invented_breakthrough');
    });
});
