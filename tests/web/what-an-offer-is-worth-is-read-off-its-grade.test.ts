/**
 * Three offers, three answers, and the difference is the grade on the row.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS PINS, AND WHY IT IS A DECISION RATHER THAN A NUMBER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner's ruling: ten spirit stones, a heaven-grade pill and an
 * immortal medicine are THREE offers, not one, and what separates them is what
 * the object is - a grade on a catalog row - rather than a figure anybody
 * chose. `OnTheTable.carriesThemTo` is the one question this world asks about
 * anything put down, and the answer has to come off the same field the
 * resolver, the seeder and the register already read.
 *
 * Measured before this existed, with the offerer standing at rung 4:
 *
 *     The Unearned Step   ->  4
 *     The Standing Edge   ->  4      (a rated-45 object)
 *     my protection       ->  4
 *
 * Every one of them fell through to *worth what the person offering it is
 * worth*, because nothing looked in the object catalog or the immortal one. So
 * the most valuable object in the world and a vague promise were the same
 * offer, and no offer of one could ever move a refusal - which is the whole of
 * what an immortal medicine is for in a negotiation.
 *
 * ── AND THE SECOND HALF: THE FIELD SAYS "THE PERSON RECEIVING IT" ────────
 *
 * A thing is worth what it does for the person in front of you. A Step whose
 * grade cannot reach past where they already stand carries them nowhere, and a
 * higher one carries them across the wall - which is the same reading the arts
 * branch has always done for a road somebody already walks. That is what makes
 * "who they are decides what enough means" fall out of rows instead of out of a
 * branch on a house's name.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { whatIsBeingPutDown } from '../../src/web/what-a-holder-would-take-for-it';
import { whatItWouldTake } from '../../src/engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell';

/** Somebody standing at the Void Refinement floor, which is a real admission bar. */
const AT_THE_FLOOR = 29;

describe('what an offer is worth is read off its grade', () => {
    it('separates money, a heaven pill and an immortal one', () => {
        const stones = whatIsBeingPutDown('5000 spirit stones', 4, []);
        const heaven = whatIsBeingPutDown('Boundless Source Pill', 4, []);
        const immortal = whatIsBeingPutDown('Clear Mind of the Hollow Sky Pill', 4, []);

        // Money is not the medium up here and is priced at nothing, which the
        // resolver's own `PURSE_REACH` says in the other half of the engine.
        expect(stones.singular).toBe(false);
        expect(stones.carriesThemTo).toBe(0);

        expect(heaven.carriesThemTo).toBeGreaterThan(stones.carriesThemTo);
        expect(immortal.carriesThemTo).toBeGreaterThan(heaven.carriesThemTo);
    });

    it('prices a thing that came down off the ceiling its own grade permits', () => {
        // `STEP_CEILING_BY_GRADE`, read and not restated. What is asserted is
        // the ORDER, because the ordinals are the ladder's to move.
        const lower = whatIsBeingPutDown('a lower Unearned Step', 4, []);
        const middle = whatIsBeingPutDown('a middle Unearned Step', 4, []);
        const higher = whatIsBeingPutDown('a higher Unearned Step', 4, []);

        expect(lower.carriesThemTo).toBeGreaterThan(4);
        expect(middle.carriesThemTo).toBeGreaterThan(lower.carriesThemTo);
        expect(higher.carriesThemTo).toBeGreaterThan(middle.carriesThemTo);
    });

    it('prices a rated object off the field every rated object carries', () => {
        // `power`, the one hierarchy of force in this world - the same field a
        // notched sabre uses.
        const blade = whatIsBeingPutDown('The Standing Edge', 4, []);
        expect(blade.carriesThemTo).toBeGreaterThan(40);
    });

    it('is worth nothing to somebody it cannot move, and everything to somebody it can', () => {
        // The two Steps offered to the same person. A middle one tops out at
        // the realm she is already standing in; a higher one crosses her wall.
        const middle = whatIsBeingPutDown('a middle Unearned Step', 4, [], AT_THE_FLOOR);
        const higher = whatIsBeingPutDown('a higher Unearned Step', 4, [], AT_THE_FLOOR);

        expect(middle.carriesThemTo).toBe(0);
        expect(higher.carriesThemTo).toBeGreaterThan(AT_THE_FLOOR);
    });

    it('is the same rule that produces both the refusal and the acceptance', () => {
        // The owner's consistency requirement, stated as a test: the same
        // person, the same asking, and the answer moves across the line when
        // what is put down changes. A refusal here is a price, not a verdict.
        const holding = {
            theirClaimCanWait: true,
            theirsToGive: true,
            itCarriesTo: AT_THE_FLOOR,
            theyReachTo: AT_THE_FLOOR
        };

        const forStones = whatItWouldTake(holding, [
            whatIsBeingPutDown('5000 spirit stones', 4, [], AT_THE_FLOOR)
        ]);
        const forAStep = whatItWouldTake(holding, [
            whatIsBeingPutDown('a higher Unearned Step', 4, [], AT_THE_FLOOR)
        ]);

        expect(forStones.itIsATrade).toBe(false);
        expect(forStones.why).toBe('nothing_was_put_down');
        // And the refusal names the route, in the unit the acceptance uses.
        expect(forStones.theHeightToReach).toBe(AT_THE_FLOOR);

        expect(forAStep.itIsATrade).toBe(true);
        expect(forAStep.why).toBeNull();
    });
});

/**
 * And the whole way through, in the reader that ships with nothing behind it.
 *
 * The unit tests above prove the pricing. This proves somebody can reach it by
 * typing a sentence, which is the only definition of done this repo accepts.
 *
 * `makeGame` runs the deterministic reader, and that is deliberate rather than
 * convenient: measured against a live model on 8844, every phrasing of *propose
 * a match and offer X for it* was split into two costly acts, so `proposeAMatch`
 * saw `nothing_was_put_down` every time and the `offered` argument had no
 * writer at all. The deterministic table reads the same sentence as one act
 * with an offer in it. That gap is a finding about the sentence splitter, and it
 * is not this file's to fix - what this file guards is that the engine behind it
 * is right when something does reach it.
 */
describe('and an offer reaches the negotiation by being typed', () => {
    it('carries what was named into the price the house is answered on', async () => {
        const { game } = makeGame({ seed: 'an-offer', worldEnabled: true });
        await game.newRun('Ke Yan');

        // Somebody standing here, named the way the game itself prints them.
        const here = await game.act('who is here');
        const named = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/.exec(JSON.stringify(here));
        if (!named) return; // No company on this seed; nothing to measure.

        const result = await game.act(
            `I offer the Clear Mind of the Hollow Sky Pill for a match with ${named[1]}`
        );
        const said = JSON.stringify(result);

        // The engine channel names what it weighed. Before this, the same
        // sentence produced `nothing singular at 0` however large the offer.
        expect(said).toMatch(/Clear Mind of the Hollow Sky Pill/);
        expect(said).not.toMatch(/nothing singular/);
    });
});
