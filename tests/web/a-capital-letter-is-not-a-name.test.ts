/**
 * A read only players who capitalise could reach.
 *
 * FOUND BY PLAYING BLIND, four turns into a run that had just been offered
 * eight houses by name:
 *
 *     > i ask someone where the azure dew sect is
 *     He names the Azure Dew Sect without any particular inflection... He
 *     mentions the titles used among those who belong there, speaking of Dew
 *     Servants and Outer Disciples. He does not explain the difference.
 *
 * The question was WHERE and the answer was about ranks and an era. Measured
 * against the parser afterwards, the whole cluster was gone:
 *
 *     where is the azure dew sect         ->  UNCLEAR
 *     how far is the azure dew sect       ->  UNCLEAR
 *     how do i get to the azure dew sect  ->  UNCLEAR
 *     which way to the azure dew sect     ->  UNCLEAR
 *
 * ── THE GATE WAS TYPOGRAPHY ──────────────────────────────────────────────
 *
 * The branch that answers these tested `[A-Z]` against the player's own casing,
 * and nobody types into a game in title case. Its own comment says what it was
 * for - *A NAMED PLACE, and that is what separates this from the roads read* -
 * and that distinction is right. The capital was a proxy for it, and a proxy
 * that fails for anybody who types in lower case is a typing-style exam rather
 * than a question about what was asked.
 *
 * Worse, the proxy never worked even in title case for the commonest shape:
 * `How far is The Azure Dew Sect` starts on a determiner.
 *
 * ── WHAT REPLACES IT ─────────────────────────────────────────────────────
 *
 * The same distinction, tested on meaning. A determiner is allowed in front,
 * and what the capital was really excluding - a pronoun standing in for a place
 * already pointed at - is excluded by name. `where is` joins the cluster with
 * its own exclusion, the possessive: "where is my manual" is about a thing in
 * the bag and belongs to another verb entirely.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

function routes(said: string): string {
    const plan = parseIntent(said);
    return plan.intent ? `${plan.action}/${plan.intent}` : plan.action;
}

describe('asking after somewhere by name', () => {
    it.each([
        'where is the azure dew sect',
        'how far is the azure dew sect',
        'how do i get to the azure dew sect',
        'which way to the azure dew sect',
        'how far is iron ridge',
        'which way is iron ridge',
        'how far to clear river ford',
        'how would i get to nine peaks'
    ])('%s reads the destinations', said => {
        expect(routes(said)).toBe('destinations');
    });

    /**
     * AND IT WORKS IN EITHER CASE, which is the whole point: the read must not
     * depend on how somebody types.
     */
    it('answers the same sentence typed either way', () => {
        expect(routes('How far is Iron Ridge')).toBe(routes('how far is iron ridge'));
        expect(routes('Where is the Azure Dew Sect')).toBe(routes('where is the azure dew sect'));
    });

    /**
     * AND A PRONOUN IS STILL NOT A PLACE. This is what the capital letter was
     * standing in for, and it is the assertion that keeps the replacement from
     * being a widening: "how far is it" names nowhere, and answering it with the
     * road list would be the engine guessing what `it` was.
     */
    it.each([
        'how far is it',
        'which way is that',
        'how far is this',
        'which way is there'
    ])('%s names no place', said => {
        expect(routes(said)).not.toBe('destinations');
    });

    /**
     * AND A THING IN THE BAG IS NOT A PLACE EITHER. `where is` is the widest of
     * the four heads and the possessive is its guard.
     */
    it.each(['where is my manual', 'where is my sword', 'where are my rations'])(
        '%s is not a road question', said => {
            expect(routes(said)).not.toBe('destinations');
        }
    );

    /**
     * AND THE NEIGHBOURS KEEP THEIR OWN SENTENCES. `where am i` is the place
     * read, and `how far is it and by which way` is a `roads` exemplar that the
     * branch's own lookahead has always excluded.
     */
    it('leaves where am i with the look', () => {
        expect(routes('where am i')).toBe('look');
    });

    it('leaves the roads exemplar alone', () => {
        expect(routes('how far is it and by which way')).not.toBe('destinations');
    });
});
