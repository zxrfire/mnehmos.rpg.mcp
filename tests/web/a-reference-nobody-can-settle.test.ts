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
 * guess, but a correct-sounding answer about something else.
 *
 * ── AND THE REMEDY IS A DROP, NOT A QUESTION ─────────────────────────────
 *
 * The first cut printed the candidates at the player - *"it" could be the Lesser
 * Qi-Gathering Manual or the Five-Breath Circulation Scripture. Name it and it
 * is settled.* That shipped, and was wrong twice over. The owner's ruling,
 * watching it print the wrong pair at somebody browsing a stall:
 *
 *   *the point of the game is that the AI parses what you mean* - *rely on the
 *   AI more* - *the AI can help you avoid the unsure responses*
 *
 * So the field comes off and nothing is said. Phase 1 has the previous turn and
 * every name it printed, and binding `it` is its job; where it did not, the verb
 * answers the general question, which is a better turn than a hesitation. What
 * the resolver could not bind goes to the operator row, where somebody tuning
 * phase 1 can read it.
 *
 * `context.md`, under *Who parses what the player meant*, carries the ruling.
 */

import { describe, it, expect } from 'vitest';

import {
    resolvingAgainstTheLastTurn,
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
        // AND THE FIELD COMES OFF. This used to assert that the plan was
        // untouched, on the reasoning that declining to choose is not choosing
        // - which is right about the CHOICE and was wrong about the field.
        // Leaving the literal word on it is what sent `investigate` looking for
        // a place called `it`; the verb is better served by a sentence that
        // named nothing, which it already answers well.
        expect(out.plan.action.target).toBeUndefined();
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

/**
 * "The cheaper one" of two things that cost the same bought the wrong book.
 *
 * FOUND BY PLAYING BLIND, on the turn after a stall read:
 *
 *     A copy of the Lesser Qi-Gathering Manual is listed at 8 spirit stones; it
 *     opens at Qi Condensation Layer 1... the Five-Breath Circulation Scripture
 *     is priced at 13, though it requires Qi Condensation Layer 6 to begin.
 *     Bai Fukuan himself holds a copy of the Five-Breath Circulation Scripture,
 *     and he is willing to let it go for 8 spirit stones.
 *
 *     > i buy the cheaper one
 *     Bai Fukuan takes the eight spirit stones... It is a work that remains
 *     silent to anyone below Qi Condensation Layer 6.
 *
 * Two things at eight stones, and `reduce` keeps whichever of two equal prices
 * it met first - so the phrase settled on an ordering nobody had said anything
 * about, and a cultivator at Layer 1 walked away with a book that opens five
 * rungs above them instead of the one they could have opened that afternoon.
 *
 * It is the same ruling the demonstrative already keeps, applied to a
 * comparative: "the cheaper one" of two things that cost the same is not a
 * phrase with an answer, and picking one is worse than asking.
 */
describe('a comparative that ties settles nothing', () => {
    const TWO_AT_EIGHT: WhatTheLastTurnDid = {
        ...TWO_BOOKS,
        named: [
            { name: 'Lesser Qi-Gathering Manual', stones: 8 },
            { name: 'Five-Breath Circulation Scripture', stones: 13 },
            { name: "Bai Fukuan's Five-Breath Circulation Scripture", stones: 8 }
        ]
    };

    it('does not pick one of two equal prices', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: { action: 'buy', target: 'the cheaper one' }, source: 'model' } as never,
            TWO_AT_EIGHT,
            'i buy the cheaper one'
        );
        expect(out.resolutions).toEqual([]);
        expect(out.unsettled).toEqual(['the cheaper one']);
    });

    /**
     * AND A CLEAR WINNER IS STILL PICKED. Without this the fix would read as
     * "comparatives no longer work", which is not the ruling.
     */
    it('still picks the only one at the price', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: { action: 'buy', target: 'the cheaper one' }, source: 'model' } as never,
            TWO_BOOKS,
            'i buy the cheaper one'
        );
        expect(out.resolutions.map(r => r.to)).toEqual(['Lesser Qi-Gathering Manual']);
    });

});
