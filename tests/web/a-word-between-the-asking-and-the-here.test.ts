/**
 * "Who is standing here" reached nothing, and "who else is here" reached the roster.
 *
 * The design owner named this sentence as the DELIBERATE ASK a player makes for
 * the roster: *"if there's more people, you have to specifically ask: who else
 * is here?"* - and the pattern that answers it wants the asking and the here
 * next to each other. `who(?:'s| is| are)? (?:here|around|about|nearby)` has a
 * single space in it, and the commonest way of saying the sentence puts a
 * participle in that space.
 *
 * Measured against the parser:
 *
 *     who else is here        ->  look/company
 *     who is nearby           ->  look/company
 *     who is standing here    ->  UNCLEAR
 *     who is standing around  ->  UNCLEAR
 *     who is in this square   ->  UNCLEAR
 *     who is sitting here     ->  investigate, target "sitting here"
 *     who is stood here       ->  investigate, target "stood here"
 *     who is loitering here   ->  investigate, target "loitering here"
 *     who is hanging around   ->  investigate, target "hanging around"
 *
 * It is the same defect as `would (?:take|have) me` on the joining branch, one
 * verb over: the gap between two words was the gate.
 *
 * The last four are the worse half. A blank look says nothing; a search of the
 * terrain for a thing called "sitting here" says the game understood, and the
 * player has no way to tell it did not. That is why the branch sits ABOVE
 * `whatIsBeingAskedAbout` rather than beside the roster read at the bottom of
 * the table - every sentence it takes is a question about the people in the
 * square, and none of them could be a thing found by name.
 *
 * ── AND THE QUESTION ONE WORD AWAY IS A DIFFERENT READ ───────────────────
 *
 * "Who is in charge here" is the HOLDER read - whose patch this is and what
 * there is to complain to - and it has owned that sentence since it was
 * written. It runs above both, and the widening must not reach past it, which
 * is why the nouns admitted here are the square somebody is standing in and
 * nothing wider.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/actions';

const routed = (line: string) => {
    const plan = parseIntent(line) as { action: string; intent?: string };
    return `${plan.action}${plan.intent ? `/${plan.intent}` : ''}`;
};

describe('asking who is standing here', () => {
    it.each([
        'who is standing here',
        'who is standing around',
        'who is stood here',
        'who is sitting here',
        'who is waiting here',
        'who is loitering here',
        'who is hanging around',
        'who is in this square',
        'who is in the square'
    ])('reaches the roster: "%s"', sentence => {
        expect(routed(sentence)).toBe('look/company');
    });

    /**
     * AND THE READ IT NOW SITS ABOVE KEEPS EVERYTHING ELSE.
     *
     * `whatIsBeingAskedAbout` answers "who is <a name>" and "who is <the
     * stallholder>", which are questions about a thing or a person the world
     * can be searched for. Those are the sentences the new branch is one word
     * away from taking, so they are checked rather than assumed.
     */
    it('leaves the named-thing questions to the search that answers them', () => {
        expect(routed('who is the herbalist')).toBe('investigate');
        expect(routed('who is Wen Shu')).toBe('investigate');
        expect(routed('who is the patriarch')).toBe('investigate');
    });

    /** The phrasings that already worked, which a widening breaks first. */
    it.each([
        'who else is here',
        'who is nearby',
        'who is here',
        'is anybody around'
    ])('leaves "%s" where it was', sentence => {
        expect(routed(sentence)).toBe('look/company');
    });

    /**
     * THE HOLDER READ, WHICH SHARES FOUR WORDS WITH THIS ONE.
     *
     * Whose ground this is, and who answers for it if somebody is wronged on
     * it. A player who asks that and is handed a list of faces has been told
     * something true about a question they did not put.
     */
    it('does not take the question about who holds the ground', () => {
        expect(routed('who is in charge here')).toBe('look/holder');
        expect(routed('who is in charge')).toBe('look/holder');
        expect(routed('who holds this ground')).toBe('look/holder');
    });

    /** And the other reads that begin with the same word. */
    it('leaves the other who-questions alone', () => {
        expect(routed('who likes me')).toBe('look/warmth');
        expect(routed('who hates me')).toBe('look/warmth');
        expect(routed('who stands behind the Azure Dew Sect')).toBe('look/who_is_above_them');
        expect(routed('who leads the Azure Dew Sect')).toBe('sect/standing');
        expect(routed('who can teach me')).toBe('teacher');
    });
});
