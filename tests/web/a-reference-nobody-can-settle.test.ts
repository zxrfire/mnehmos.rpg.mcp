/**
 * The stall had just listed two manuals by name and price. "I study it" went
 * looking for a place called *it* and reported that it did not exist.
 *
 * FOUND BY PLAYING BLIND, two turns running:
 *
 *     > i buy a manual
 *     One is a Lesser Qi-Gathering Manual, priced at eleven spirit stones...
 *     The second is the Five-Breath Circulation Scripture, which asks for
 *     nineteen... Name one of the books, and it is yours.
 *
 *     > i study it
 *     You search the streets and alleys of Six Li, looking for a trace of it.
 *     You turn over every detail and question every lead, but the town offers
 *     nothing. Nothing here answers to the thing you seek. It is either in
 *     another place entirely, or it does not exist.
 *
 * The engine had printed both books one screen earlier, told the player to name
 * one, and then told them the thing did not exist.
 *
 * ── THE RESOLVER WAS RIGHT AND SAID NOTHING ──────────────────────────────
 *
 * `whichOfTheNamedThings` declines on purpose, and its comment is the ruling:
 * *a demonstrative with one thing to point at points at it. With two it points
 * at nothing, and saying so is better than choosing.*
 *
 * Declining is correct. What was missing is the saying so. The resolver knew
 * `standsForSomethingNamedLastTurn` was true, knew it could not settle which,
 * and dropped both facts - so the phrase reached the verb as the literal word
 * `it` and the verb answered confidently about a thing nobody had named.
 *
 * That is the worst shape a reference can fail in: not a refusal, and not a
 * guess, but a correct-sounding answer about something else. The remedy is one
 * sentence, and it is said whatever the narrator does, because it is the only
 * thing that lets the player fix it - and it names the candidates the engine
 * itself printed rather than asking anybody to remember them.
 */

import { describe, it, expect } from 'vitest';

import {
    resolvingAgainstTheLastTurn,
    sayingItCouldHaveMeantAnyOfThese,
    type WhatTheLastTurnDid
} from '../../src/web/last-turn-memory';

const TWO_BOOKS: WhatTheLastTurnDid = {
    runId: 'run', cultivatorId: 'cult', onTurn: 4, outcome: 'executed', acts: [],
    named: [
        { name: 'Lesser Qi-Gathering Manual', stones: 11 },
        { name: 'Five-Breath Circulation Scripture', stones: 19 }
    ]
};

const ONE_BOOK: WhatTheLastTurnDid = {
    ...TWO_BOOKS,
    named: [{ name: 'Lesser Qi-Gathering Manual', stones: 11 }]
};

describe('a demonstrative that could be either says so', () => {
    it('records the phrase it could not settle', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: { action: 'learn_technique', target: 'it' }, source: 'model' } as never,
            TWO_BOOKS,
            'i study it'
        );
        expect(out.resolutions).toEqual([]);
        expect(out.unsettled).toEqual(['it']);
        // And the plan is untouched, because declining is not choosing.
        expect(out.plan.action.target).toBe('it');
    });

    /**
     * AND WITH ONE THING TO POINT AT IT STILL POINTS. This is the behaviour the
     * resolver already had, and it is asserted here so that recording the
     * failure cannot quietly become a refusal to resolve anything.
     */
    it('still settles a demonstrative with one candidate', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: { action: 'learn_technique', target: 'it' }, source: 'model' } as never,
            ONE_BOOK,
            'i study it'
        );
        expect(out.unsettled).toEqual([]);
        expect(out.plan.action.target).toBe('Lesser Qi-Gathering Manual');
    });

    /**
     * AND A PHRASE THAT IS NOT A REFERENCE IS NOT ONE. A target the player
     * named outright must never be reported as ambiguous - that would put a
     * hesitation on every ordinary turn.
     */
    it('says nothing about a name', () => {
        const out = resolvingAgainstTheLastTurn(
            {
                action: { action: 'learn_technique', target: 'Five-Breath Circulation Scripture' },
                source: 'model'
            } as never,
            TWO_BOOKS,
            'i study the five-breath circulation scripture'
        );
        expect(out.unsettled).toEqual([]);
        expect(out.resolutions).toEqual([]);
    });

    /**
     * AND AN ORDINAL IS NOT AMBIGUOUS. "The second one" against two things
     * settles, so it must not appear here: the recording is for phrases that
     * genuinely point at more than one, not for every phrase that is a
     * reference.
     */
    it('says nothing about an ordinal that settles', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: { action: 'buy', target: 'the second one' }, source: 'model' } as never,
            TWO_BOOKS,
            'i buy the second one'
        );
        expect(out.unsettled).toEqual([]);
        expect(out.resolutions.map(r => r.to)).toEqual(['Five-Breath Circulation Scripture']);
    });
});

describe('what the player is told', () => {
    it('names both and asks for one', () => {
        const said = sayingItCouldHaveMeantAnyOfThese('it', TWO_BOOKS.named);
        expect(said).toContain('Lesser Qi-Gathering Manual');
        expect(said).toContain('Five-Breath Circulation Scripture');
        expect(said).toContain('"it"');
        expect(said.toLowerCase()).toContain('name it');
    });

    /**
     * AND IT DOES NOT PICK. The whole ruling is that choosing for the player is
     * worse than asking, so the sentence must not read as a recommendation.
     */
    it('does not recommend one of them', () => {
        const said = sayingItCouldHaveMeantAnyOfThese('it', TWO_BOOKS.named).toLowerCase();
        for (const nudge of ['cheaper', 'better', 'probably', 'presumably', 'taken to mean']) {
            expect(said, nudge).not.toContain(nudge);
        }
    });
});
