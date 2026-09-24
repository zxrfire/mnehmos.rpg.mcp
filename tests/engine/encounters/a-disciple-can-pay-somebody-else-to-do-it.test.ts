/**
 * The duty board belongs to the house, and nothing stops a member hiring out
 * their own errand.
 *
 * `whatTheHouseItselfNeedsDone` hands nothing to anybody off the roll, and that
 * gate is deliberate - a rogue cannot take work from a missions elder and should
 * not be able to. It says nothing at all about what a disciple does with a duty
 * they have already taken, which is the genre's most ordinary arrangement: the
 * errand passed down, the outsider hired quietly.
 *
 * WHAT MAKES IT A TRADE RATHER THAN A FAVOUR is that the two halves of the pay
 * are worth different amounts to the two people. Contribution is standing on a
 * roll and is worth nothing to somebody not on one; stones are worth the same to
 * everybody. So the member keeps what only they can spend and pays out of what
 * they can. Nothing was added to the ledger to make that true - `dutyTermsFor`
 * has paid in both currencies since it was written.
 *
 * AND THE RISK DOES NOT MOVE. The house asked its member. If the work is not
 * done, the member failed, on the member's own terms for walking away. That is
 * what the price is for.
 */

import { describe, it, expect } from 'vitest';

import {
    NOTHING_IN_HAND_UNDER,
    whatTheBoardPays,
    whatTheyWouldDoItFor,
    whoAnswersForItAfterwards,
    type ADutyBeingPassedOn
} from '../../../src/engine/encounters/passing-a-duty-down-to-somebody-else';
import {
    contributionPerStoneOverDays,
    CONTRIBUTION_BASE
} from '../../../src/engine/encounters/duties';
import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import { DISPOSITION_BANDS } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';

const ERRAND: ADutyBeingPassedOn = {
    stones: 120, contribution: 40, days: 30, pitchOrdinal: 10
};

/** Somebody the world rolled into the disposition band the caller wants. */
function somebodyWho(test: (openHanded: number) => boolean): string {
    for (let i = 0; i < 4000; i += 1) {
        const id = `hire-${i}`;
        if (test(openHandednessOf(id))) return id;
    }
    throw new Error('the world rolls nobody in that band');
}

const MIDDLING = somebodyWho(n => Math.abs(n) < DISPOSITION_BANDS.WORTH_SAYING);
const COMFORTABLE = { id: MIDDLING, ordinal: 10, spiritStones: 5_000 };

/**
 * The closed form of the rate, kept here because this is its only consumer.
 *
 * It used to be pinned beside `donate`, which converted spirit stones into
 * contribution at a discount off it. That conversion is struck - cash may not
 * buy a rung - so the rate's whole remaining job is the one below: saying what
 * an errand's pay is worth as money to somebody hired to do it.
 */
describe('the board own exchange rate', () => {
    it('is days over twenty-eight, with everything else cancelled', () => {
        for (const days of [1, 7, 20, 45, 90]) {
            expect(contributionPerStoneOverDays(days)).toBeCloseTo(days / 28, 10);
        }
        // And it genuinely is what the two duty lines produce, for any base.
        const days = 20;
        const yieldScale = 1.7;
        const contribution = CONTRIBUTION_BASE * yieldScale * (days / 20);
        const paid = CONTRIBUTION_BASE * yieldScale * 1.4;
        expect(contribution / paid).toBeCloseTo(contributionPerStoneOverDays(days), 10);
    });

    it('refuses a span of zero rather than dividing by it', () => {
        expect(contributionPerStoneOverDays(0)).toBeGreaterThan(0);
        expect(contributionPerStoneOverDays(Number.NaN)).toBeGreaterThan(0);
    });
});

describe('a disciple can pay somebody else to do it', () => {
    it('prices the duty in one currency using the board own exchange rate', () => {
        const whole = whatTheBoardPays(ERRAND);
        expect(whole).toBeGreaterThan(ERRAND.stones);
        // Read off `contributionPerStoneOverDays` rather than a second rate.
        expect(whole).toBeCloseTo(
            ERRAND.stones + ERRAND.contribution / contributionPerStoneOverDays(ERRAND.days),
            6
        );
    });

    it('leaves the contribution where it is, which is what makes this worth doing', () => {
        const deal = whatTheyWouldDoItFor(ERRAND, COMFORTABLE);
        // The contractor can see and spend the stones alone. Standing on a roll
        // is not something a stranger can be paid in.
        expect(deal.whatTheContractorCanSpend).toBe(ERRAND.stones);
        expect(deal.theBoardPaysTheHolder).toBeGreaterThan(deal.whatTheContractorCanSpend);
        expect(deal.line).toContain('contribution');
    });

    it('charges more for work over the contractor head and less for work under it', () => {
        const under = whatTheyWouldDoItFor(ERRAND, { ...COMFORTABLE, ordinal: 20 });
        const level = whatTheyWouldDoItFor(ERRAND, { ...COMFORTABLE, ordinal: 10 });
        const over = whatTheyWouldDoItFor(ERRAND, { ...COMFORTABLE, ordinal: 2 });
        expect(under.askStones).toBeLessThan(level.askStones);
        expect(over.askStones).toBeGreaterThan(level.askStones);
        expect(over.overTheirHead).toBe(true);
        expect(under.overTheirHead).toBe(false);
        // And it is priced rather than refused: somebody out of their depth can
        // still say yes, expensively, which is how people die in this setting.
        expect(over.askStones).toBeGreaterThan(0);
    });

    it('has somebody with nothing take less, which is why a rogue gets hired', () => {
        const broke = whatTheyWouldDoItFor(ERRAND, {
            ...COMFORTABLE, spiritStones: NOTHING_IN_HAND_UNDER - 1
        });
        const comfortable = whatTheyWouldDoItFor(ERRAND, COMFORTABLE);
        expect(broke.askStones).toBeLessThan(comfortable.askStones);
        expect(broke.line).toContain('carrying almost nothing');
    });

    it('says when the hire costs the member more than the board hands them', () => {
        const dear = whatTheyWouldDoItFor(
            { ...ERRAND, stones: 120, pitchOrdinal: 40 },
            { ...COMFORTABLE, ordinal: 2 }
        );
        expect(dear.outOfTheHoldersOwnPocket).toBe(true);
        // Not a refusal. Paying over the odds for a duty whose contribution you
        // want is a decision, and the engine states the fact rather than taking
        // it away.
        expect(dear.askStones).toBeGreaterThan(dear.whatTheContractorCanSpend);
    });

    it('leaves the failure on the member, whoever actually walks out of the gate', () => {
        const said = whoAnswersForItAfterwards('Nine Boards Qiu', 'The Waterman Caravan');
        expect(said).toContain('Nine Boards Qiu');
        expect(said).toContain('The Waterman Caravan');
        expect(said.toLowerCase()).toContain('a stranger the house never heard of');
    });
});
