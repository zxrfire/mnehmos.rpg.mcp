/**
 * Haggling, and the half of it that matters: a refusal is information.
 *
 * `haggle` routed to the market read, every price in the world was fixed, and
 * an offer refused ended the exchange. The ruling has three parts, and the third
 * is the one the mechanic hangs on: mortal prices do not move; item for item is
 * the real trade at high tiers; and what happens depends on what the person will
 * accept, so the player can CHANGE WHAT THEY OFFER. That last one only works if
 * the refusal says which medium this person is on.
 *
 * THE LADDER HAS A DIRECTION, and it is the direction the genre gives it: being
 * asked for spirit stones is a RELIEF, because the alternative is a favour owed,
 * a service somebody has to go and perform, or a hold over you. So
 *
 *     stones  <  goods  <  a favour  <  a service  <  a hold
 *
 * and somebody who will not take money and names something else has turned a
 * screw. These pin that the engine says so, that the rung is read off the
 * numbers that already decide it rather than off a table written beside them,
 * and that nobody's disposition can turn a betrayal into a purchase.
 */

import { describe, it, expect } from 'vitest';

import {
    WHAT_THEY_WILL_TAKE_IN_ORDER,
    howFarUpTheLadder,
    whatTheyWillTakeFor,
    whereTheOfferLanded,
    whyAQuotedPriceDoesNotMove,
    type WhatTheyWillTake
} from '../../../src/engine/social-leverage/what-they-will-take-instead-of-money';
import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import { DISPOSITION_BANDS } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';

/** Somebody whose disposition sits in the band the caller wants. */
function somebodyWho(test: (openHanded: number) => boolean): string {
    for (let i = 0; i < 4000; i += 1) {
        const id = `npc-ladder-${i}`;
        if (test(openHandednessOf(id))) return id;
    }
    throw new Error('the world rolls nobody in that band');
}

const MIDDLING = somebodyWho(n => Math.abs(n) < DISPOSITION_BANDS.WORTH_SAYING);
const OPEN_HANDED = somebodyWho(n => n >= DISPOSITION_BANDS.MARKED);
const GRASPING = somebodyWho(n => n <= -DISPOSITION_BANDS.MARKED);

describe('what somebody will take, and what a refusal tells you', () => {
    it('asks for money where money reaches, which is the mildest thing on the ladder', () => {
        const wants = whatTheyWillTakeFor(MIDDLING, {
            ask: 'a_courtesy', hasACashPrice: true, theyNeedSomethingDone: false
        });
        expect(wants).toBe('stones');
        expect(howFarUpTheLadder(wants)).toBe(0);
    });

    it('will not take money for what money does not reach, and says what it wants instead', () => {
        const wants = whatTheyWillTakeFor(MIDDLING, {
            ask: 'against_their_interest', hasACashPrice: false, theyNeedSomethingDone: false
        });
        expect(howFarUpTheLadder(wants)).toBeGreaterThan(howFarUpTheLadder('goods'));

        const landed = whereTheOfferLanded(wants, 'stones');
        expect(landed.theRightKindOfThing).toBe(false);
        expect(landed.theyHaveTurnedTheScrew).toBe(true);
        // The point of the whole mechanic: the sentence names the medium that
        // would have worked, so the player can change what they offer.
        expect(landed.line).toContain('What they want is');
    });

    it('turns a price into a service where they want something done', () => {
        const priced = whatTheyWillTakeFor(MIDDLING, {
            ask: 'against_their_interest', hasACashPrice: false, theyNeedSomethingDone: false
        });
        const served = whatTheyWillTakeFor(MIDDLING, {
            ask: 'against_their_interest', hasACashPrice: false, theyNeedSomethingDone: true
        });
        expect(howFarUpTheLadder(served)).toBeGreaterThan(howFarUpTheLadder(priced));
    });

    it('lets who somebody is move the rung, and never past what the ask is worth', () => {
        const asked = {
            ask: 'against_their_interest', hasACashPrice: false, theyNeedSomethingDone: false
        } as const;
        const generous = whatTheyWillTakeFor(OPEN_HANDED, asked);
        const grasping = whatTheyWillTakeFor(GRASPING, asked);
        expect(howFarUpTheLadder(generous)).toBeLessThan(howFarUpTheLadder(grasping));
        // Nobody generous enough to take coin for a thing coin does not reach.
        expect(howFarUpTheLadder(generous))
            .toBeGreaterThanOrEqual(howFarUpTheLadder('a favour'));
    });

    it('asks for a hold when what is being asked for would end them', () => {
        for (const who of [MIDDLING, OPEN_HANDED, GRASPING]) {
            expect(whatTheyWillTakeFor(who, {
                ask: 'a_betrayal', hasACashPrice: false, theyNeedSomethingDone: false
            })).toBe('a hold');
        }
    });

    it('reads an offer of the right kind as the right kind, enough or not', () => {
        const landed = whereTheOfferLanded('a favour', 'a service');
        expect(landed.theRightKindOfThing).toBe(true);
        expect(landed.line).toContain('not yet the same as enough');
    });

    it('says being asked for money is the cheap outcome, not a brush-off', () => {
        const landed = whereTheOfferLanded('stones', 'goods');
        expect(landed.line.toLowerCase()).toContain('cheapest thing');
    });

    it('refuses a quoted price in the world rather than with a blank look', () => {
        const said = whyAQuotedPriceDoesNotMove('A bowl of millet', 'at every counter in the town');
        expect(said).toContain('the same rate for the next person');
        // And it points somewhere. A refusal that closes the subject is the
        // defect; this one says where haggling does work.
        expect(said).toContain('a thing only one person has');
    });

    it('keeps the ladder in one place and in one order', () => {
        expect(WHAT_THEY_WILL_TAKE_IN_ORDER).toEqual(
            ['stones', 'goods', 'a favour', 'a service', 'a hold'] as WhatTheyWillTake[]
        );
        for (let i = 1; i < WHAT_THEY_WILL_TAKE_IN_ORDER.length; i += 1) {
            expect(howFarUpTheLadder(WHAT_THEY_WILL_TAKE_IN_ORDER[i]))
                .toBeGreaterThan(howFarUpTheLadder(WHAT_THEY_WILL_TAKE_IN_ORDER[i - 1]));
        }
    });
});
