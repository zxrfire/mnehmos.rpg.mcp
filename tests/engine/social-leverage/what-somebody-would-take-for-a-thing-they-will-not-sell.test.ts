import { describe, expect, it } from 'vitest';

import {
    howHeavyThisAskIs,
    howTheyAreHoldingIt,
    whatItWouldTake,
    type HowTheyAreHoldingIt,
    type OnTheTable
} from '../../../src/engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.js';
import type {
    WhatANeedDoesToAPrice
} from '../../../src/engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import {
    resolveAttempt,
    type AttemptInput
} from '../../../src/engine/social-leverage/an-attempt-to-move-somebody.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

/** A house sitting on something pitched above its own head. The ordinary case. */
function holdingSomethingAboveThem(
    over: Partial<HowTheyAreHoldingIt> = {}
): HowTheyAreHoldingIt {
    return {
        theirClaimCanWait: true,
        theirsToGive: true,
        itCarriesTo: 24,
        theyReachTo: 18,
        ...over
    };
}

function thing(what: string, carriesThemTo: number, singular = true): OnTheTable {
    return { what, carriesThemTo, singular };
}

describe('what somebody would take for a thing they will not sell', () => {
    it('names a price when nothing has been put down, rather than saying no', () => {
        const answer = whatItWouldTake(holdingSomethingAboveThem(), []);

        expect(answer.itIsATrade).toBe(false);
        expect(answer.why).toBe('nothing_was_put_down');
        // The whole point of the verb: the refusal carries the figure.
        expect(answer.theHeightToReach).toBe(24);
        expect(answer.line).toContain('rung 24');
        expect(answer.line).toContain('Name what you have, not what you can pay.');
    });

    it('moves when what is put down reaches as high as the thing does', () => {
        const answer = whatItWouldTake(holdingSomethingAboveThem(), [
            thing('a debt from somebody at Nascent Soul', 24)
        ]);

        expect(answer.itIsATrade).toBe(true);
        expect(answer.why).toBeNull();
        expect(answer.theBestPutDown).toBe('a debt from somebody at Nascent Soul');
    });

    it('does not move when it falls short, and says by how much', () => {
        const answer = whatItWouldTake(holdingSomethingAboveThem(), [
            thing('a Foundation-Guiding Pill', 4)
        ]);

        expect(answer.itIsATrade).toBe(false);
        expect(answer.why).toBe('what_was_put_down_does_not_reach');
        expect(answer.theBestOnTheTable).toBe(4);
        expect(answer.theHeightToReach).toBe(24);
    });

    // ── THE MEDIUM IS NOT A FIELD, WHICH IS THE WHOLE DESIGN ─────────────
    //
    // `AGENTS.md`: if a tenth case needs a branch, the shape is wrong. The
    // guard is that ten media the module has never heard of all resolve
    // identically, because the only thing it reads about any of them is one
    // number.
    it('prices ten media it has never heard of by one number and nothing else', () => {
        const media = [
            'a favour owed', 'the Iron Bell Manual', 'an oath sworn on your own road',
            'a place for their daughter in my house', 'a name nobody else could give them',
            'where the vein under the eastern scar actually runs', 'a season of my labour',
            'the blade out of the sealed hall', 'a life I will not take',
            'the thing I have not told anybody'
        ];

        const answers = media.map(what =>
            whatItWouldTake(holdingSomethingAboveThem(), [thing(what, 24)]));

        // Ten different sentences, one verdict. Nothing branched on what it was.
        expect(answers.every(a => a.itIsATrade)).toBe(true);
        expect(new Set(answers.map(a => a.why)).size).toBe(1);

        const short = media.map(what =>
            whatItWouldTake(holdingSomethingAboveThem(), [thing(what, 3)]));
        expect(short.every(a => a.why === 'what_was_put_down_does_not_reach')).toBe(true);
    });

    it('takes the best thing on the table and not the last one named', () => {
        const answer = whatItWouldTake(holdingSomethingAboveThem(), [
            thing('a road nobody else teaches', 26),
            thing('a handful of talismans', 2)
        ]);

        expect(answer.itIsATrade).toBe(true);
        expect(answer.theBestOnTheTable).toBe(26);
        expect(answer.theBestPutDown).toBe('a road nobody else teaches');
    });

    // ── MONEY IS NOT THE MEDIUM UP HERE ──────────────────────────────────
    //
    // `items.md`: above the line cash "is simply not the medium. Not
    // 'expensive' - not for sale." A fungible offer is priced at nothing here
    // however large, which is `PURSE_REACH` in the resolver saying the same
    // thing about the same line. The two must not disagree.
    it('prices a fungible offer at nothing however high it is', () => {
        const answer = whatItWouldTake(holdingSomethingAboveThem(), [
            { what: 'four hundred thousand spirit stones', carriesThemTo: 99, singular: false }
        ]);

        expect(answer.itIsATrade).toBe(false);
        expect(answer.why).toBe('nothing_was_put_down');
        expect(answer.theBestOnTheTable).toBe(0);
    });

    // ── A PRESENT NEED IS A REFUSAL ──────────────────────────────────────
    it('is not a seller at any figure while their own claim cannot wait', () => {
        const answer = whatItWouldTake(
            holdingSomethingAboveThem({ theirClaimCanWait: false }),
            [thing('the deepest road in the province', 40)]
        );

        expect(answer.itIsATrade).toBe(false);
        expect(answer.why).toBe('they_need_it_themselves');
        // And the price is still stated, because it stays true when the timing
        // does not.
        expect(answer.theHeightToReach).toBe(24);
    });

    it('tells arithmetic apart from a price nobody has met', () => {
        const quorum = whatItWouldTake(
            holdingSomethingAboveThem({ theirsToGive: false }),
            [thing('the deepest road in the province', 40)]
        );

        expect(quorum.why).toBe('the_answer_is_not_theirs_to_give');
        // The distinction the player has to be able to draw: one of these is
        // worth going and finding a lever for and one is not.
        expect(quorum.line).not.toContain('Name what you have');
        expect(quorum.line).toContain('somebody who can simply say yes');
    });

    it('says the arithmetic before it says the need, hardest answer first', () => {
        const both = whatItWouldTake(
            holdingSomethingAboveThem({ theirsToGive: false, theirClaimCanWait: false }),
            []
        );
        expect(both.why).toBe('the_answer_is_not_theirs_to_give');
    });

    it('hands the resolver a met price as a want it can price', () => {
        const met = howHeavyThisAskIs(
            whatItWouldTake(holdingSomethingAboveThem(), [thing('an art they lack', 30)])
        );
        expect(met).toEqual({ thePriceWasMet: true, theyWantWhatIsInFrontOfThem: true });

        const unmet = howHeavyThisAskIs(whatItWouldTake(holdingSomethingAboveThem(), []));
        expect(unmet).toEqual({ thePriceWasMet: false, theyWantWhatIsInFrontOfThem: false });
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE FIFTH OUTCOME
// ═════════════════════════════════════════════════════════════════════════

function attempt(over: Partial<AttemptInput> = {}): AttemptInput {
    return {
        actor: {
            id: 'you', name: 'Wen Shu', ordinal: 4, charm: 2,
            factionId: null, alignment: null
        },
        subject: {
            id: 'them', name: 'Duan Zhenfeng', ordinal: 24,
            factionId: 'house-a', alignment: null, ranked: true,
            // Pinned so the disposition term cannot move the arithmetic under
            // a guard that is about something else.
            openHandedness: 0
        },
        onDay: 1000,
        ask: 'a_real_favour',
        rng: forStream('seed-for-the-fifth-outcome', 'trade', 1),
        ...over
    };
}

describe('the fifth outcome', () => {
    /**
     * The odds are deliberately awful on both arms, so what is being measured
     * is which KIND of failure comes back rather than whether it failed.
     */
    it('answers a failed ask with terms when there is something they want', () => {
        const countered = resolveAttempt(attempt({
            ask: 'a_betrayal',
            theyWantSomethingFromYou: true,
            rng: forStream('pinned', 'trade', 7)
        }));

        expect(countered.outcome).toBe('countered');
        expect(countered.marks.obligation).toBeNull();
        expect(countered.marks.tie).toBeNull();
        expect(countered.marks.reachedTheHouse).toBe(false);
        // The days are real. The conversation happened.
        expect(countered.days).toBeGreaterThan(1);
    });

    /**
     * The control arm. Same input, same seed, same stream - the ONLY thing
     * varied is whether they have an open want in front of them, so what is
     * being measured is the fifth outcome and not the roll.
     *
     * Deliberately does NOT assert that a refusal writes a grudge.
     * `an-attempt-to-move-somebody.ts` was ruled the other way -
     * *"a refusal is not automatically an offence"* - and an assertion about
     * that here would be this test quietly pinning somebody else's subject.
     */
    it('is the same input refused when there is nothing they want', () => {
        const refused = resolveAttempt(attempt({
            ask: 'a_betrayal',
            rng: forStream('pinned', 'trade', 7)
        }));

        expect(['refused', 'reported']).toContain(refused.outcome);
        expect(refused.outcome).not.toBe('countered');
    });

    /**
     * A counter-offer is an opening and not a rebuff, so it must not sour
     * anything. `AGENTS.md`: being told no once made the cheapest lever in the
     * game three times harder, and being told a price must never do that.
     */
    it('leaves nothing behind that would make asking again worse', () => {
        for (let day = 0; day < 40; day++) {
            const result = resolveAttempt(attempt({
                ask: 'against_their_interest',
                theyWantSomethingFromYou: true,
                rng: forStream('sweep', 'trade', day)
            }));
            if (result.outcome !== 'countered') continue;
            expect(result.marks.obligation).toBeNull();
            expect(result.marks.counterObligation).toBeNull();
            expect(result.marks.unspoken).toBeNull();
            expect(result.stonesSpent).toBe(0);
        }
    });

    it('still lets a wanted ask land, so terms are not a ceiling', () => {
        const outcomes = new Set<string>();
        for (let day = 0; day < 200; day++) {
            outcomes.add(resolveAttempt(attempt({
                ask: 'a_courtesy',
                theyWantSomethingFromYou: true,
                rng: forStream('sweep-landing', 'trade', day)
            })).outcome);
        }
        expect(outcomes.has('taken') || outcomes.has('turned')).toBe(true);
        expect(outcomes.has('countered')).toBe(true);
        // And a person who wants something from you never reports you for
        // asking, which is what the outcome means.
        expect(outcomes.has('reported')).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// ONE MODEL OF WHAT SOMEBODY NEEDS, NOT TWO
//
// The guard against the failure the two authors of these modules flagged to
// each other: two models of the same fact that both look right in isolation.
// Every arm of the OTHER module's answer is walked through the adapter here,
// so a new arm added there fails to compile rather than silently mapping to
// "they would sell".
// ═════════════════════════════════════════════════════════════════════════

describe('the holder\'s side comes from one model and only one', () => {
    it('maps every arm of the need model onto a price or the absence of one', () => {
        const arms: readonly [WhatANeedDoesToAPrice | null, boolean, boolean][] = [
            // effect, theirClaimCanWait, theirsToGive
            ['will_not_part_with_it_at_any_price', false, true],
            ['held_against_a_need_not_yet_come', true, true],
            ['the_answer_is_not_theirs_to_give', true, false],
            ['pays_above_the_going_rate', true, true],
            [null, true, true]
        ];

        for (const [effect, canWait, theirs] of arms) {
            const built = howTheyAreHoldingIt(
                effect === null ? null : { effect }, 24, 18
            );
            expect(built.theirClaimCanWait, String(effect)).toBe(canWait);
            expect(built.theirsToGive, String(effect)).toBe(theirs);
        }
    });

    it('turns a present need into a refusal and a reserved one into a price', () => {
        const pressing = whatItWouldTake(
            howTheyAreHoldingIt({ effect: 'will_not_part_with_it_at_any_price' }, 24, 18),
            [thing('a road nobody else teaches', 30)]
        );
        expect(pressing.why).toBe('they_need_it_themselves');

        const reserved = whatItWouldTake(
            howTheyAreHoldingIt({ effect: 'held_against_a_need_not_yet_come' }, 24, 18),
            [thing('a road nobody else teaches', 30)]
        );
        expect(reserved.itIsATrade).toBe(true);
    });
});
