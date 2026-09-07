/**
 * A house's protection is a SHARE, and it used to be a risk reduction too.
 *
 * `computePriceOdds` documents `sectProtection` as `0..1` and spends it as
 * `-sectProtection * MAX_SECT_PROTECTION`, so the scaling to the 0.3 ceiling
 * belongs to the odds and not to the caller. Every other producer speaks that
 * scale: `protectionOffered` returns `min(1, margin / 12)` and says so in its
 * doc, and `price-of-advancement.test.ts` passes 1 and 0.5 as ordinary inputs.
 *
 * `tollConditionsFor` was the one caller that did not. It returned
 * `min(0.3, 0.06 * (rankIndex + 1))`, already scaled to the ceiling, and the
 * odds then scaled it again. A top-rank disciple's whole house came to
 * 0.3 * 0.3 = 0.09 of toll risk where the contract intends 0.30.
 *
 * Measured on an ordinary cultivator at the ordinal-24 boundary in normal qi,
 * whose toll risk with no house at all is 0.450:
 *
 *     rank 0    0.432 -> 0.390
 *     rank 2    0.396 -> 0.270
 *     rank 4    0.360 -> 0.150
 *
 * It had six production callers and no test, which is how a factor of three
 * sat in the one number that says what belonging to a house is worth.
 *
 * These assert the CONTRACT rather than the curve: any rank produces a legal
 * input, more rank is never worth less, and a house that spends everything
 * gets the whole of what the odds reserve for a house. Re-tuning the curve
 * must not have to edit this file.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from '../../web/harness';
import { tollConditionsFor } from '../../../src/server/consolidated/cultivation-support';
import {
    computeTollRisk,
    MAX_SECT_PROTECTION
} from '../../../src/engine/cultivation/price-of-advancement';
import { SECTS } from '../../../src/data/cultivation/index';

/** The house with the longest ladder, so the top rung is actually reachable. */
const DEEPEST = SECTS.reduce((best, sect) =>
    sect.ranks.length > best.ranks.length ? sect : best);

/** An ordinary body at a real boundary, so nothing clamps and the term shows. */
const ORDINARY = {
    realmOrdinal: 24,
    attributes: { might: 0, insight: 0, fortune: 0, charm: 0 }
} as never;

const riskWith = (sectProtection: number) =>
    computeTollRisk(ORDINARY, { ambient: 'normal', sectProtection } as never).risk;

describe('what a house is worth at a wall', () => {
    it('gives nobody on a roll nothing', async () => {
        const { game, repos } = makeGame({ seed: 'house-worth-none' });
        const { cultivator } = await game.newRun('Wen Shu');
        expect(tollConditionsFor(repos, cultivator).sectProtection).toBe(0);
    });

    it('produces a legal share at every rung of a real house', async () => {
        const { game, repos } = makeGame({ seed: 'house-worth-legal' });
        const { cultivator } = await game.newRun('Wen Shu');

        const shares: number[] = [];
        for (let rank = 0; rank < DEEPEST.ranks.length; rank++) {
            repos.sects.addMember(DEEPEST.id, cultivator.id, rank);
            const share = tollConditionsFor(repos, cultivator).sectProtection;
            expect(share, `rank ${rank}`).toBeGreaterThan(0);
            expect(share, `rank ${rank}`).toBeLessThanOrEqual(1);
            shares.push(share);
        }

        // Standing never costs you. The curve may change; the direction may not.
        for (let i = 1; i < shares.length; i++) {
            expect(shares[i], `rank ${i} against ${i - 1}`).toBeGreaterThanOrEqual(shares[i - 1]!);
        }
    });

    /**
     * The regression itself. A house that has spent everything on somebody is
     * worth the whole of what the odds set aside for a house, and not a third
     * of it.
     */
    it('reaches the whole of what the odds reserve for a house', async () => {
        const { game, repos } = makeGame({ seed: 'house-worth-top' });
        const { cultivator } = await game.newRun('Wen Shu');
        repos.sects.addMember(DEEPEST.id, cultivator.id, DEEPEST.ranks.length - 1);

        const share = tollConditionsFor(repos, cultivator).sectProtection;
        expect(share).toBe(1);

        // Spent through the odds, that share is the full reserved relief.
        const unhoused = riskWith(0);
        expect(unhoused - riskWith(share)).toBeCloseTo(MAX_SECT_PROTECTION, 10);
    });
});
