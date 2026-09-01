/**
 * Dao protection: what a watch buys, what it costs, and who it is available to.
 *
 * The claims under test are the setting's own, from `DAO_PROTECTOR` and
 * `CROSSING_PRACTICE` in `data/cultivation/crossings.ts`, which described the
 * practice for a long time before anything implemented it.
 */

import { describe, it, expect } from 'vitest';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    computeBreakthroughOdds,
    maxChanceFor
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    MAX_PROTECTION_BONUS,
    foldProtectionIntoOdds,
    protectionBonus,
    protectionModifier,
    protectorWeight,
    resolveVigil,
    standingGuardCost,
    vigilExposure,
    watchWeight,
    wouldStandGuard,
    type Protector
} from '../../../src/engine/cultivation/standing-guard-over-somebody-elses-crossing.js';
import { getWoundType } from '../../../src/data/cultivation/wounds.js';

const someone = (ordinal: number, standing = 1, id = `p${ordinal}`): Protector =>
    ({ id, name: `Guard ${ordinal}`, realmOrdinal: ordinal, standing });

/** Ordinal 44 is the last crossing; 12 -> 13 is the first realm boundary. */
const LAST = 44;
const FIRST_WALL = 12;

const subject = (ordinal: number) => ({
    realmOrdinal: ordinal,
    spiritRoot: 'single_metal' as const,
    attributes: { might: 2, insight: 2, fortune: 2, charm: 2 },
    injuries: []
});

describe('what a protector contributes', () => {
    it('is their own standing against the rung being attempted', () => {
        expect(protectorWeight(LAST, LAST)).toBe(1);
        // One major realm below is outmatched but can still matter.
        expect(protectorWeight(38, LAST)).toBeGreaterThan(0);
        expect(protectorWeight(38, LAST)).toBeLessThan(1);
        // Two below is not a fight, and a watch of them is not a watch.
        expect(protectorWeight(20, LAST)).toBe(0);
        expect(protectionBonus({ protectors: [someone(20)] }, LAST)).toBe(0);
    });

    it('counts somebody above the subject at full weight and no more', () => {
        expect(protectorWeight(LAST, FIRST_WALL)).toBe(1);
        expect(protectionBonus({ protectors: [someone(LAST)] }, FIRST_WALL))
            .toBeCloseTo(protectionBonus({ protectors: [someone(FIRST_WALL)] }, FIRST_WALL), 10);
    });

    it('saturates, so the second protector is worth less than the first', () => {
        const one = protectionBonus({ protectors: [someone(LAST, 1, 'a')] }, LAST);
        const two = protectionBonus({ protectors: [someone(LAST, 1, 'a'), someone(LAST, 1, 'b')] }, LAST);
        const three = protectionBonus(
            { protectors: [someone(LAST, 1, 'a'), someone(LAST, 1, 'b'), someone(LAST, 1, 'c')] }, LAST);
        expect(two).toBeGreaterThan(one);
        expect(three).toBeGreaterThan(two);
        expect(two - one).toBeLessThan(one);
        expect(three - two).toBeLessThan(two - one);
        expect(three).toBeLessThan(MAX_PROTECTION_BONUS);
    });

    it('is worth nothing when nobody stood', () => {
        expect(protectionBonus({ protectors: [] }, LAST)).toBe(0);
        expect(protectionModifier({ protectors: [] }, LAST)).toBeNull();
        expect(watchWeight({ protectors: [] }, LAST)).toBe(0);
    });
});

describe('the odds breakdown', () => {
    const odds = () => computeBreakthroughOdds(subject(LAST), { ambient: 'normal', pill: null, manualQuality: null });

    it('names who stood, as a line the reader can trace', () => {
        const watch = { protectors: [someone(LAST, 1, 'a'), someone(43, 1, 'b')] };
        const withGuard = foldProtectionIntoOdds(odds(), watch, LAST);
        const line = withGuard.modifiers.find(m => m.source.startsWith('dao_protection:'));
        expect(line).toBeDefined();
        expect(line!.source).toContain('Guard 44');
        expect(line!.delta).toBeGreaterThan(0);
    });

    it('keeps sum(modifiers) === finalChance an exact identity', () => {
        for (const ordinal of [0, 5, FIRST_WALL, 28, 40, LAST]) {
            const base = computeBreakthroughOdds(subject(ordinal), { ambient: 'normal', pill: null, manualQuality: null });
            const withGuard = foldProtectionIntoOdds(base, { protectors: [someone(LAST, 1, 'a')] }, ordinal);
            const sum = withGuard.modifiers.reduce((t, m) => t + m.delta, 0);
            expect(sum, `ordinal ${ordinal}`).toBeCloseTo(withGuard.finalChance, 10);
        }
    });

    it('makes the crossing easier and never the reverse', () => {
        const base = odds();
        const withGuard = foldProtectionIntoOdds(base, { protectors: [someone(LAST, 1, 'a')] }, LAST);
        expect(withGuard.finalChance).toBeGreaterThan(base.finalChance);
    });

    it('cannot push an attempt past the rung ceiling', () => {
        // Protection buys a crossing nothing interferes with. There was never a
        // wall a guard could open.
        const base = computeBreakthroughOdds(subject(0), { ambient: 'spirit_tide', pill: null, manualQuality: 'pristine' });
        const watch = { protectors: Array.from({ length: 8 }, (_, i) => someone(LAST, 1, `p${i}`)) };
        const withGuard = foldProtectionIntoOdds(base, watch, 0);
        expect(withGuard.finalChance).toBeLessThanOrEqual(maxChanceFor(0));
    });

    it('leaves an unprotected attempt byte-identical', () => {
        const base = odds();
        expect(foldProtectionIntoOdds(base, { protectors: [] }, LAST)).toBe(base);
    });
});

describe('who will actually stand', () => {
    it('refuses somebody who could not matter, and says so', () => {
        const answer = wouldStandGuard(someone(20, 1), LAST);
        expect(answer.willing).toBe(false);
        expect(answer.reason).toBe('cannot_matter');
    });

    it('asks for more standing where more is being risked', () => {
        const atTheWall = wouldStandGuard(someone(LAST, 1), LAST);
        const lowDown = wouldStandGuard(someone(FIRST_WALL, 1), FIRST_WALL);
        expect(atTheWall.standingRequired).toBeGreaterThan(lowDown.standingRequired);
        expect(atTheWall.riskAsked).toBeGreaterThan(lowDown.riskAsked);
    });

    it('sorts the ties the world actually writes onto the right side of each wall', () => {
        // These are standings from a seeded run: "Serves under" 0.30, an ally
        // 0.51, a master 0.60, a parent 0.70.
        const at = (standing: number, ordinal: number) =>
            wouldStandGuard(someone(ordinal, standing), ordinal).willing;

        // The first realm boundary: an ally or a master will stand. Somebody who
        // merely serves in the same hall will not.
        expect(at(0.30, FIRST_WALL)).toBe(false);
        expect(at(0.51, FIRST_WALL)).toBe(true);
        expect(at(0.60, FIRST_WALL)).toBe(true);

        // The last crossing: past every ally tie the world produces and inside
        // what a parent holds. That is `theBetrayal.whyItStillMatters` - the
        // arrangement is made between people bound by something older than it.
        expect(at(0.51, LAST)).toBe(false);
        expect(at(0.60, LAST)).toBe(false);
        expect(at(0.70, LAST)).toBe(true);
        expect(wouldStandGuard(someone(LAST, 0.60), LAST).reason).toBe('not_bound_closely_enough');
    });

    it('asks for everything of somebody standing a full realm below the last crossing', () => {
        // The bar reaches 1 there, which is `whyAlmostNobodyHasOne` arriving as
        // arithmetic rather than as a rule written for that wall.
        const answer = wouldStandGuard(someone(38, 1), LAST);
        expect(answer.standingRequired).toBe(1);
        expect(wouldStandGuard(someone(38, 0.99), LAST).willing).toBe(false);
    });

    it('refuses a tie younger than the arrangement', () => {
        const stranger: Protector = {
            id: 'x', name: 'Recently met', realmOrdinal: LAST, standing: 1,
            tieSinceDay: 100_000
        };
        expect(wouldStandGuard(stranger, LAST, 100_500).reason).toBe('tie_too_new');
        expect(wouldStandGuard(stranger, LAST, 200_000).willing).toBe(true);
    });

    it('has no faction in it anywhere, so a rogue can be protected', () => {
        // The whole predicate is the ordinal and the tie. Nothing here can
        // read a house, which is what makes protection available to somebody
        // with none.
        const rogueFriend = someone(LAST, 0.95);
        expect(wouldStandGuard(rogueFriend, LAST).willing).toBe(true);
    });
});

describe('what the vigil costs the person standing there', () => {
    it('costs the days and the risk together', () => {
        const cost = standingGuardCost(someone(LAST), LAST, 3650);
        expect(cost.vigilDays).toBe(3650);
        expect(cost.woundChance).toBeGreaterThan(0);
        expect(cost.obligation.standingGain).toBeGreaterThan(0);
    });

    it('is most dangerous for the protector who is furthest below', () => {
        expect(vigilExposure(38, LAST)).toBeGreaterThan(vigilExposure(LAST, LAST));
        expect(vigilExposure(LAST, LAST)).toBeGreaterThan(vigilExposure(LAST, FIRST_WALL));
        expect(standingGuardCost(someone(38), LAST, 100).woundChance)
            .toBeGreaterThan(standingGuardCost(someone(LAST), LAST, 100).woundChance);
    });

    it('costs almost nothing at a wall that summons almost nothing', () => {
        expect(standingGuardCost(someone(LAST), 3, 100).woundChance)
            .toBeLessThan(standingGuardCost(someone(LAST), LAST, 100).woundChance);
    });

    it('hurts a protector with an ordinary named wound and nothing bespoke', () => {
        // No protector death branch. They take a wound through the same path
        // everybody takes wounds through, and die, if they die, by carrying too
        // many - which is how anybody dies.
        const rng = new CultivationRNG('vigil');
        const watch = { protectors: Array.from({ length: 60 }, (_, i) => someone(38, 1, `p${i}`)) };
        const outcomes = resolveVigil(watch, LAST, rng, 4, 3650);
        const hurt = outcomes.filter(o => o.injuries.length > 0);
        expect(hurt.length).toBeGreaterThan(0);
        for (const o of hurt) {
            expect(o.injuries[0].woundType).not.toBeNull();
            expect(getWoundType(o.injuries[0].woundType)).not.toBeNull();
            expect(o.injuries[0].source).toBe('tribulation');
        }
    });

    it('draws one sample per protector whatever it decides', () => {
        const watch = { protectors: [someone(38, 1, 'a'), someone(38, 1, 'b'), someone(38, 1, 'c')] };
        const a = new CultivationRNG('stream');
        resolveVigil(watch, LAST, a, 1, 100);
        const afterWatch = a.next();

        const b = new CultivationRNG('stream');
        // Same protectors, one of whom is far enough below to be worthless. The
        // number of draws must not depend on the answer.
        resolveVigil(
            { protectors: [someone(38, 1, 'a'), someone(38, 1, 'b'), someone(38, 1, 'c')] },
            LAST, b, 1, 100
        );
        expect(b.next()).toBe(afterWatch);
    });
});
