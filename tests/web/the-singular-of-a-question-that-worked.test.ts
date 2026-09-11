/**
 * "Who likes me" read the square. "Does he like me" reached nothing.
 *
 * FOUND BY PROBING THE SOCIAL FAMILY, which a blind session had already flagged
 * as the deepest engine with the thinnest surface. Two clusters, and in both of
 * them one phrasing worked and the ones a person actually types did not.
 *
 * ── HOW SOMEBODY CARRIES YOU ─────────────────────────────────────────────
 *
 *     who likes me               ->  look/warmth
 *     does he like me            ->  UNCLEAR
 *     does she like me           ->  UNCLEAR
 *     does he trust me           ->  UNCLEAR
 *     does he hate me            ->  UNCLEAR
 *     how does he feel about me  ->  UNCLEAR
 *     what does he think of me   ->  sect/standing
 *
 * The last one is the worst: it asks about a PERSON and was answered with what
 * a HOUSE makes of the player - a confident answer to a question nobody asked,
 * which this repo rates as worse than a refusal. And the design owner asked for
 * this question by name: *does he like you?*
 *
 * Answered by the square read rather than by a narrowed one, on purpose. That
 * read already says how each person present carries this cultivator, so
 * somebody standing here is in it. Somebody who is NOT standing here is not,
 * and the read says who is - which is the honest answer to a question about
 * somebody who has walked off.
 *
 * ── WHAT YOU ARE UNDER ───────────────────────────────────────────────────
 *
 *     what oaths do i have    ->  oath/read
 *     what have i sworn       ->  UNCLEAR
 *     what am i bound to      ->  UNCLEAR
 *     what did i promise      ->  UNCLEAR
 *     what am i committed to  ->  UNCLEAR
 *
 * `AN_OATH` wants the NOUN, and none of those sentences has one in it. The
 * commonest way to ask what you are under names the ACT or the STATE rather
 * than the thing, which is the near-synonym trap AGENTS.md names: the phrasing
 * a player reaches for first is the one that fails, and they cannot find the
 * working half except by guessing.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

function routes(said: string): string {
    const plan = parseIntent(said);
    return plan.intent ? `${plan.action}/${plan.intent}` : plan.action;
}

describe('asking how one person carries you', () => {
    it.each([
        'does he like me',
        'does she like me',
        'does they trust me',
        'does he trust me',
        'does he hate me',
        'does she respect me',
        'how does he feel about me',
        'how do they think about me',
        'what does he think of me',
        'what does she make of me'
    ])('%s reads how the square carries you', said => {
        expect(routes(said)).toBe('look/warmth');
    });

    /** And the phrasing that always worked still does. */
    it('still reads the square for the plural', () => {
        expect(routes('who likes me')).toBe('look/warmth');
        expect(routes('who hates me')).toBe('look/warmth');
    });

    /**
     * AND THE NEIGHBOURS KEEP THEIR SENTENCES. Three of them, each one word
     * away from the cluster above:
     *
     *   a HOUSE's opinion is the standing read and not a person's warmth;
     *   a question PUT TO somebody is a conversation and not a read;
     *   a question about two OTHER people is about neither of the above.
     */
    it('leaves what a house makes of you with the standing read', () => {
        expect(routes('what do people think of me')).toBe('sect/standing');
        expect(routes('how am i regarded')).toBe('sect/standing');
    });

    it('leaves a question put to somebody as a question put to somebody', () => {
        expect(parseIntent('i ask him if he likes me').action).toBe('interact');
    });

    it('says nothing about two other people', () => {
        expect(routes('does he like her')).toBe('unclear');
    });
});

describe('asking what you are under', () => {
    it.each([
        'what have i sworn',
        'what did i promise',
        'what am i bound to',
        'what am i committed to',
        'what am i obliged to',
        'what have i pledged'
    ])('%s reads the ledger', said => {
        expect(routes(said)).toBe('oath/read');
    });

    /** And the phrasings that always worked still do. */
    it.each(['what oaths do i have', 'who holds my word', 'what do i owe'])(
        '%s still reads the ledger', said => {
            expect(routes(said)).toBe('oath/read');
        }
    );

    /**
     * AND SWEARING AND BREAKING ARE STILL ACTS. The read is a question shape
     * and these are not; widening the question must not reach them.
     */
    it('leaves the two acts alone', () => {
        expect(routes('i swear an oath to him')).toBe('oath/swear');
        expect(routes('i break my oath')).toBe('oath/break');
    });
});
