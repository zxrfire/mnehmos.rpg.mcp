/**
 * The order of consent, the power to make a refusal stick, and whether the
 * person goes along with it.
 *
 * Three decisions that would otherwise live only as a shape, and all three are
 * the kind the next reader would quietly change:
 *
 *   - the gate on a grudge is CATEGORICAL. Not a threshold on what was staked,
 *     not a weight difference between two paths - a house declining a proposal
 *     opens nothing whatever was on the table, and a house refusing something
 *     the two of them already made opens one whatever was.
 *   - the four positions come out of ONE existing call and one caller-supplied
 *     fact, so a fifth is a fifth value rather than a fifth branch.
 *   - whether somebody accepts an arrangement is read off what they WANT and
 *     who they already have a tie to. There is no compliance field and this
 *     asserts there is not one.
 */

import { describe, expect, it } from 'vitest';

import {
    aRefusalOpensAnAccount,
    theSuitorIsPastWhatTheyCouldReach,
    whatRefusingAMatchTheyAlreadyMadeLeaves,
    whatTheHousesNoIsWorth,
    whetherTheyGoAlongWithIt,
    type TheRoute
} from '../../../src/engine/household/which-route-a-match-took-and-what-a-house-can-make-stick.js';
import { bandForGap } from '../../../src/engine/cultivation/regard.js';
import { DEFINING_STANDING } from '../../../src/engine/world/when-somebody-does-not-come-back.js';
import type { Party } from '../../../src/engine/social-leverage/what-a-deed-leaves.js';

const party = (id: string, houseId: string | null): Party => ({
    id,
    name: id,
    houseId,
    houseName: houseId,
    alignment: houseId === null ? null : 'neutral',
    ranked: houseId !== null
});

const ROUTES: readonly TheRoute[] = ['family first', 'person first'];

describe('the order of consent is the whole difference', () => {
    it('has exactly two routes and only one of them opens anything', () => {
        expect(ROUTES.filter(aRefusalOpensAnAccount)).toEqual(['person first']);
    });

    it('writes nothing when the family answered before there was anything', () => {
        const left = whatRefusingAMatchTheyAlreadyMadeLeaves({
            route: 'family first',
            theHouse: party('the-house', 'sect-house'),
            theSuitor: party('the-suitor', null),
            // Everything they had. It still writes nothing, because the gate is
            // not a threshold.
            ofWhatTheyHad: 1,
            onDay: 200
        });
        expect(left).toBeNull();
    });

    it('writes a grudge against the house when the two of them had already agreed', () => {
        const left = whatRefusingAMatchTheyAlreadyMadeLeaves({
            route: 'person first',
            theHouse: party('the-house', 'sect-house'),
            theSuitor: party('the-suitor', null),
            ofWhatTheyHad: 0.3,
            onDay: 200
        });

        expect(left).not.toBeNull();
        // Held by the suitor, against the house that said no. It is a durable
        // record the existing machinery carries, inherits and settles - nothing
        // about it is a mood and nothing about it is marriage-specific.
        expect(left?.opens[0].holderId).toBe('the-suitor');
        expect(left?.opens[0].subjectId).toBe('the-house');
    });

    it('is heavier than a middling deed, because a word was given and it is not reversible', () => {
        const left = whatRefusingAMatchTheyAlreadyMadeLeaves({
            route: 'person first',
            theHouse: party('the-house', 'sect-house'),
            theSuitor: party('the-suitor', null),
            // Almost nothing staked, and it is still not slight: the person's
            // yes is what is being overridden and what is taken does not come
            // back. Both of those are existing steps in `whatItWasWorth`.
            ofWhatTheyHad: 0,
            onDay: 200
        });
        expect(['serious', 'grave', 'unforgivable']).toContain(left?.weight);
    });
});

describe('a family approval is worth what the family can make stick', () => {
    /**
     * The four positions, and every one of them comes out of the reprisal
     * layer's own question with the parties in the seats a match puts them in.
     */
    it('is a real negotiation when both sides have something to lose', () => {
        const worth = whatTheHousesNoIsWorth({
            theFamily: { houseId: 'sect-family' },
            theSuitorsBacking: 'backed',
            theSuitorIsOutOfTheirReach: false
        });
        expect(worth.is).toBe('a negotiation');
        expect(worth.theirReach).toBe('answerable');
    });

    it('changes nothing when the suitor is out of reach and the family cannot act', () => {
        const worth = whatTheHousesNoIsWorth({
            theFamily: { houseId: 'sect-family' },
            theSuitorsBacking: 'backed',
            theSuitorIsOutOfTheirReach: true
        });
        expect(worth.is).toBe('the refusal changes nothing');
        expect(worth.line).toMatch(/follows from nothing/i);
    });

    it('leaves them open to being pressed when they can act and cannot finish it', () => {
        const worth = whatTheHousesNoIsWorth({
            // A family with nothing left to lose can start something.
            theFamily: { houseId: 'sect-family', hasStoppedCaring: true },
            theSuitorsBacking: 'backed',
            theSuitorIsOutOfTheirReach: true
        });
        expect(worth.is).toBe('they can be pressed');
        // And what that is, is coercion. There is no marriage-specific
        // pressure mechanic and the line says what the price of it is.
        expect(worth.line).toMatch(/wrong/i);
    });

    it('leaves eloping or giving up when the family can act and nobody backs the suitor', () => {
        const worth = whatTheHousesNoIsWorth({
            theFamily: { houseId: 'sect-family' },
            theSuitorsBacking: 'none',
            theSuitorIsOutOfTheirReach: false
        });
        expect(worth.is).toBe('elope, or give up');
        expect(worth.theirReach).toBe('unbacked');
        // Giving up is an outcome and not a failure state, and the sentence
        // has to say so rather than reading as a dead end.
        expect(worth.line).toMatch(/outmatched/i);
    });

    it('reads no rung anywhere: an unbacked family is answerable to nobody', () => {
        // The reprisal layer's own sentence, arriving here unchanged: backing
        // protects you from exactly the people who have something to lose.
        const worth = whatTheHousesNoIsWorth({
            theFamily: { houseId: null },
            theSuitorsBacking: 'backed',
            theSuitorIsOutOfTheirReach: false
        });
        expect(worth.theirReach).toBe('unbacked');
    });
});

describe('whether the person goes along with it', () => {
    /**
     * Derived, and the test is that a reader of the person's own entry could
     * have guessed. Every input here is a row the world keeps for other
     * reasons.
     */
    it('refuses hardest where they already stand at the world own defining bar', () => {
        const answer = whetherTheyGoAlongWithIt({
            wantsItServes: 3,
            wantsItForecloses: 0,
            standingTowardSomebodyElse: DEFINING_STANDING
        });
        // Even with three wants served. A tie the world already calls defining
        // is not outweighed by an arrangement.
        expect(answer.answer).toBe('will not have it');
        expect(answer.because).toMatch(/defining/i);
    });

    it('refuses where the match closes something they are after', () => {
        const answer = whetherTheyGoAlongWithIt({
            wantsItServes: 0,
            wantsItForecloses: 1,
            standingTowardSomebodyElse: 0
        });
        expect(answer.answer).toBe('will not have it');
    });

    it('goes along where it gets them something they were already trying to get', () => {
        const answer = whetherTheyGoAlongWithIt({
            wantsItServes: 1,
            wantsItForecloses: 0,
            standingTowardSomebodyElse: 0.4
        });
        expect(answer.answer).toBe('goes along with it');
        expect(answer.because).toMatch(/already trying to get/i);
    });

    it('goes along with nothing in the way, and says that is not obedience', () => {
        const answer = whetherTheyGoAlongWithIt({
            wantsItServes: 0,
            wantsItForecloses: 0,
            standingTowardSomebodyElse: 0
        });
        expect(answer.answer).toBe('goes along with it');
        expect(answer.because).toMatch(/not obedience/i);
    });

    it('gives two people the same arrangement and two different answers', () => {
        // The whole point. Nothing about the match changed; who they are did.
        const one = whetherTheyGoAlongWithIt({
            wantsItServes: 1, wantsItForecloses: 0, standingTowardSomebodyElse: 0
        });
        const other = whetherTheyGoAlongWithIt({
            wantsItServes: 1, wantsItForecloses: 1, standingTowardSomebodyElse: 0
        });
        expect(one.answer).not.toBe(other.answer);
    });

    it('takes no compliance field, and there is nowhere for one to hide', () => {
        // The bespoke-instead-of-derived failure this directory is organised
        // against. If somebody adds an obedience axis it has to go here, and
        // this goes red.
        const keys = Object.keys({
            wantsItServes: 0, wantsItForecloses: 0, standingTowardSomebodyElse: 0
        });
        expect(keys).toEqual(['wantsItServes', 'wantsItForecloses', 'standingTowardSomebodyElse']);
    });
});

/**
 * WHICH WAY ROUND THE GAP IS MEASURED, WHICH IS THE ANSWER ITSELF.
 *
 * `theSuitorIsOutOfTheirReach` asks whether the FAMILY can reach the SUITOR,
 * and the two REGARD_BANDS readings of one gap are not mirror images:
 * `dismissed` wants seventeen rungs looking down and `unreachable` wants nine
 * looking up. Measured in play at 8844: a cultivator at rung 44 put a match to
 * somebody on a house that reaches 29, and the caller read the gap looking
 * down - `beneath`, seventeen rungs short of `dismissed` - so the engine
 * answered `elope, or give up` and told an immortal that a mortal-band house
 * could act against them.
 */
describe('whether a family can reach the person they are refusing', () => {
    it('reads the gap from the family side, where the question is asked', () => {
        expect(theSuitorIsPastWhatTheyCouldReach(29, 44)).toBe(true);
        // And the two are not the same reading. A gap this size is `beneath`
        // looking down and `unreachable` looking up; only one of them is this
        // question, and taking the other one hands the family power it has not
        // got.
        expect(bandForGap(44 - 29)).not.toBe('dismissed');
        expect(bandForGap(29 - 44)).toBe('unreachable');
    });

    it('leaves an ordinary gap as an ordinary negotiation', () => {
        // A house that can be dealt with is still a house that can be dealt
        // with. The fix must not make every suitor untouchable.
        expect(theSuitorIsPastWhatTheyCouldReach(29, 31)).toBe(false);
        expect(theSuitorIsPastWhatTheyCouldReach(29, 20)).toBe(false);
    });

    it('turns eloping into pressing, which is what the situation actually is', () => {
        // The played case. A family with a house of its own can still start
        // something, and cannot finish it against somebody this far above -
        // so what is left is leaning on them, and a match agreed that way is a
        // match AND a wrong, both written down. Read the gap the other way and
        // the same call answers `elope, or give up`, which tells a rung-44
        // cultivator to run from a house that could not touch them.
        const standing = {
            theFamily: { houseId: 'house-held-names' },
            theSuitorsBacking: 'none' as const
        };
        expect(whatTheHousesNoIsWorth({
            ...standing,
            theSuitorIsOutOfTheirReach: theSuitorIsPastWhatTheyCouldReach(29, 44)
        }).is).toBe('they can be pressed');
        expect(whatTheHousesNoIsWorth({
            ...standing,
            theSuitorIsOutOfTheirReach: bandForGap(44 - 29) === 'dismissed'
        }).is).toBe('elope, or give up');
    });

    it('still lets a backed suitor walk away from a no that reaches nothing', () => {
        // The other half of the same grid, unchanged: where the family would
        // have to deal with somebody first and cannot reach the suitor either,
        // their answer follows from nothing at all.
        expect(whatTheHousesNoIsWorth({
            theFamily: { houseId: 'house-held-names' },
            theSuitorsBacking: 'backed',
            theSuitorIsOutOfTheirReach: theSuitorIsPastWhatTheyCouldReach(29, 44)
        }).is).toBe('the refusal changes nothing');
    });
});
