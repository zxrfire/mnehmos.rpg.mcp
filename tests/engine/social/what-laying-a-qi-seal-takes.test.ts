/**
 * PUTTING A SEAL ON SOMEBODY, AND TAKING ONE OFF.
 *
 * The design owner: *"honestly a seal should be an ability like a soul search,
 * and an effect on the person that had been sealed"*, *"a seal gives them 10%
 * of their qi"*, *"like to a cultivator a realm below they're still harmless"*,
 * *"they can cast some shitty spell but they better make it worth it"*, and
 * *"seals can be removed - 1. by the one who casted it, 2. broken through force
 * of arms by someone significantly stronger than the castor, with odds."*
 */

import { describe, expect, it } from 'vitest';

import {
    canLayAQiSeal,
    oddsOfBreakingASeal,
    qiSealOpensAt,
    whatBreakingASealTakes,
    whatLayingASealTakes,
    type ASealAttempt
} from '../../../src/engine/social/what-laying-a-qi-seal-takes.js';
import { EXHAUSTED_QI_FRACTION } from '../../../src/engine/cultivation/combat.js';
import { OPENS_WITHOUT_FORCING_AT } from '../../../src/engine/social/what-a-soul-search-takes.js';
import {
    WHAT_A_SEAL_LEAVES_IN_THE_POOL,
    whatASealLeavesInThePool
} from '../../../src/engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { maxQiForOrdinal, REALM_TIERS } from '../../../src/engine/cultivation/realms.js';

const attempt = (over: Partial<ASealAttempt> = {}): ASealAttempt => ({
    sealerOrdinal: 21, sealerId: 'elder', subjectOrdinal: 13,
    subjectIsThere: true, subjectAlreadySealed: false,
    onDay: 0, subjectMaxQi: 40, forDays: null, note: 'held', ...over
});

describe('laying one', () => {
    it('opens at a realm read off the ladder, not a number', () => {
        expect(canLayAQiSeal(qiSealOpensAt())).toBe(true);
        expect(canLayAQiSeal(qiSealOpensAt() - 1)).toBe(false);
    });

    it('refuses below the line as a non-attempt, not a failure', () => {
        const laid = whatLayingASealTakes(attempt({ sealerOrdinal: 5 }));
        expect(laid.went).toBe(false);
        expect(laid.why).toBe('below_the_line');
        expect(laid.line).toMatch(/not an attempt/);
    });

    it('cannot be laid on an equal, which is why an elder does it', () => {
        const laid = whatLayingASealTakes(attempt({ sealerOrdinal: 21, subjectOrdinal: 21 }));
        expect(laid.went).toBe(false);
        expect(laid.why).toBe('they_held');
    });

    it('holds longer the wider the gap, off one table', () => {
        const near = whatLayingASealTakes(attempt({ sealerOrdinal: 17, subjectOrdinal: 13 }));
        const wide = whatLayingASealTakes(attempt({ sealerOrdinal: 41, subjectOrdinal: 13 }));
        expect(near.went).toBe(true);
        expect(near.seal!.liftsOnDay).toBeGreaterThan(0);
        // A gap wide enough that the subject has no say in it at all.
        expect(wide.seal!.liftsOnDay).toBeNull();
    });

    it('gives back less than was asked when the gap will not carry it', () => {
        const laid = whatLayingASealTakes(attempt({
            sealerOrdinal: 17, subjectOrdinal: 13, forDays: 100_000
        }));
        expect(laid.went).toBe(true);
        expect(laid.seal!.liftsOnDay).toBeLessThan(100_000);
        expect(laid.line).toMatch(/short of the 100000 asked for/);
    });

    it('cuts the pool to a tenth as it closes', () => {
        const laid = whatLayingASealTakes(attempt({ subjectMaxQi: 160 }));
        expect(laid.poolCutTo).toBe(16);
    });
});

describe('a tenth is harmless to a realm below', () => {
    it('leaves a fifth of what the realm below carries, at every rung', () => {
        for (let i = 1; i < REALM_TIERS.length; i++) {
            const here = maxQiForOrdinal(2, REALM_TIERS[i]!.ordinalStart);
            const below = maxQiForOrdinal(2, REALM_TIERS[i - 1]!.ordinalStart);
            expect(whatASealLeavesInThePool(here), REALM_TIERS[i]!.name).toBeLessThan(below);
        }
    });

    /**
     * ONE CAST, AND THEN NOTHING - and it falls out rather than being tuned.
     *
     * `EXHAUSTED_QI_FRACTION` is a tenth and the seal leaves a tenth, so a
     * sealed cultivator stands EXACTLY on the exhaustion line: they may spend,
     * once, and the moment anything leaves the pool they are under it and
     * locked out until the ground gives it back - which, on the ground a house
     * holds people on, is not a thing that happens.
     */
    it('stands exactly on the exhaustion line', () => {
        expect(WHAT_A_SEAL_LEAVES_IN_THE_POOL).toBe(EXHAUSTED_QI_FRACTION);
    });
});

describe('taking one off', () => {
    it('lifts for the hand that laid it, with no roll', () => {
        const off = whatBreakingASealTakes({
            how: 'the_hand_that_laid_it', breakerOrdinal: 21, casterOrdinal: 21, isTheCaster: true
        });
        expect(off.lifted).toBe(true);
        expect(off.odds).toBe(1);
    });

    it('does nothing for somebody claiming to be the hand and not being it', () => {
        const off = whatBreakingASealTakes({
            how: 'the_hand_that_laid_it', breakerOrdinal: 41, casterOrdinal: 21, isTheCaster: false
        });
        expect(off.lifted).toBe(false);
        expect(off.odds).toBe(0);
    });

    it('is measured against the caster and never against the prisoner', () => {
        // A sealed ascendant and a sealed disciple are behind the same door,
        // and the door is as strong as whoever hung it.
        const off = whatBreakingASealTakes({
            how: 'force_of_arms', breakerOrdinal: 29, casterOrdinal: 21, isTheCaster: false
        });
        expect(off.realmGapOverTheCaster).toBe(2);
        expect(off.line).toMatch(/over the caster/);
    });

    it('gives an equal nothing to break it with, and a wall comes down at three', () => {
        expect(oddsOfBreakingASeal(0)).toBe(0);
        expect(oddsOfBreakingASeal(-1)).toBe(0);
        expect(oddsOfBreakingASeal(1)).toBeGreaterThan(0);
        expect(oddsOfBreakingASeal(1)).toBeLessThan(0.5);
        expect(oddsOfBreakingASeal(2)).toBeGreaterThan(0.5);
        expect(oddsOfBreakingASeal(3)).toBe(1);
    });

    it('is certain at the same gap a soul search stops being a forcing', () => {
        // The owner: "a false immortal would never fail to break a void
        // tribulation seal". Read off the search's own constant, not a copy.
        expect(oddsOfBreakingASeal(OPENS_WITHOUT_FORCING_AT)).toBe(1);
        expect(oddsOfBreakingASeal(OPENS_WITHOUT_FORCING_AT + 4)).toBe(1);
        expect(oddsOfBreakingASeal(OPENS_WITHOUT_FORCING_AT - 1)).toBeLessThan(1);
    });

    it('tells the hand that laid it, whenever it can break at all', () => {
        // The jade plate cracking on a mountain a province away, seen from the
        // other end: a seal is the caster's work, so it going is something that
        // happens to them wherever they are.
        const broke = whatBreakingASealTakes({
            how: 'force_of_arms', breakerOrdinal: 41, casterOrdinal: 21, isTheCaster: false
        });
        expect(broke.lifted).toBe(true);
        expect(broke.theCasterKnows).toBe(true);

        // A try that could never work tells nobody, which is why trying
        // quietly is a thing somebody would do.
        const hopeless = whatBreakingASealTakes({
            how: 'force_of_arms', breakerOrdinal: 13, casterOrdinal: 21, isTheCaster: false
        });
        expect(hopeless.odds).toBe(0);
        expect(hopeless.theCasterKnows).toBe(false);

        // And lifting your own is not news to you.
        const own = whatBreakingASealTakes({
            how: 'the_hand_that_laid_it', breakerOrdinal: 21, casterOrdinal: 21, isTheCaster: true
        });
        expect(own.lifted).toBe(true);
        expect(own.theCasterKnows).toBe(false);
    });

    it('returns odds and never rolls them, like the search it is built on', () => {
        const a = whatBreakingASealTakes({
            how: 'force_of_arms', breakerOrdinal: 25, casterOrdinal: 21, isTheCaster: false
        });
        const b = whatBreakingASealTakes({
            how: 'force_of_arms', breakerOrdinal: 25, casterOrdinal: 21, isTheCaster: false
        });
        expect(a.odds).toBe(b.odds);
    });
});
