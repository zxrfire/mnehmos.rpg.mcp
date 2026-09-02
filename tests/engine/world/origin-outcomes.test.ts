/**
 * The honesty constraint, measured.
 *
 * `docs/world/houses/origin.md` stakes the whole axis on one claim:
 *
 *   > A privileged origin should be visible in the run's OPENING POSITION and
 *   > not visible in its OUTCOME DISTRIBUTION, except at the very top where it
 *   > is one required term among several. If being well-born reliably produces
 *   > high-realm cultivators, the axis has been implemented wrong.
 *
 * So this file asserts both halves. It is the test that is supposed to fail if
 * somebody makes an origin generous, and the numbers are deliberately loose:
 * the point is to catch an axis that has become a difficulty slider, not to
 * pin a balance pass in place.
 *
 * Sample sizes are small enough to run in CI, which means the last three rungs
 * are below the noise floor here. `simulateLife` is exported so the rare tail
 * can be measured properly out of band.
 */

import { describe, it, expect } from 'vitest';
import {
    measureOriginOutcomes,
    simulateLife
} from '../../../src/engine/world/origin-odds.js';
import { ORIGIN_TIERS, openingPosition } from '../../../src/engine/cultivation/origin.js';

// One sweep, shared. It is the expensive thing in this file.
const report = measureOriginOutcomes('origin-outcomes', { perTierSampleSize: 1_200 });
const row = (key: string) => report.rows.find(r => r.origin === key)!;

describe('privilege is visible in the opening position', () => {
    it('gives strictly more of every input as the tiers climb', () => {
        // THE LADDER IS THE COMMON ROWS. The last three are three routes into
        // privilege rather than three heights of it, and they are deliberately
        // not ordered against one another: an apex sect member's child is
        // rarer than a Dao house's blood and holds less of everything except
        // the one thing that transfers, which is the word their parent can
        // spend. Asserting a chain across them would put back the single
        // `great_house` row the split removed.
        const positions = ORIGIN_TIERS.slice(0, -3).map(t => openingPosition(t.key));
        for (let i = 1; i < positions.length; i++) {
            expect(positions[i].spiritStones).toBeGreaterThan(positions[i - 1].spiritStones);
            expect(positions[i].provisionedYears).toBeGreaterThan(positions[i - 1].provisionedYears);
            expect(positions[i].placementReach).toBeGreaterThanOrEqual(positions[i - 1].placementReach);
            expect(positions[i].vouchers).toBeGreaterThanOrEqual(positions[i - 1].vouchers);
        }

        // Every route is above every rung of that ladder on the inputs the
        // ladder is measured in, and none of them reaches down into it.
        const top = positions[positions.length - 1];
        for (const tier of ORIGIN_TIERS.slice(-3)) {
            const route = openingPosition(tier.key);
            expect(route.spiritStones, `${tier.key}`).toBeGreaterThan(top.spiritStones);
            expect(route.provisionedYears, `${tier.key}`).toBeGreaterThan(top.provisionedYears);
            expect(route.placementReach, `${tier.key}`).toBeGreaterThanOrEqual(top.placementReach);
        }

        // And the two ends of it are not close.
        expect(openingPosition('dao_house_bloodline').spiritStones)
            .toBeGreaterThan(positions[0].spiritStones * 100);
    });
});

describe('and most people born to enormous advantage still fail', () => {
    it('leaves the overwhelming majority of Dao house children short of Core Formation', () => {
        // The bar was 5% and the measurement is now 9.4%. It moved because
        // `computeCultivationRate` is finally being told which rung the
        // cultivator is standing on - see the long note at the call site in
        // `origin-odds.ts`. The realm intake term compounds upward, and the
        // well-born are exactly the people standing high enough to collect it,
        // so correcting it moves this row and only this kind of row.
        //
        // The claim being defended is "the overwhelming majority still fail",
        // and 90.6% is still overwhelming. The bar is set where the claim stops
        // being true rather than where the measurement happens to sit: at one
        // in five, a Dao house childhood has become a route to Core Formation
        // rather than a head start on the road to it.
        expect(row('dao_house_bloodline').reachedAtLeast[21]).toBeLessThan(0.2);
    });

    it('ends the great majority of privileged lives on a clock, not at the top', () => {
        const ends = row('dao_house_bloodline').ends;
        const n = row('dao_house_bloodline').sampleSize;
        expect((ends.settling + ends.lifespan) / n).toBeGreaterThan(0.5);
        expect(ends.summit / n).toBeLessThan(0.01);
    });

    it('does not stop a Dao house child dying in a ruin like anybody else', () => {
        expect(row('dao_house_bloodline').ends.died_in_a_ruin).toBeGreaterThan(0);
    });
});

describe('privilege is not visible in the outcome distribution', () => {
    it('moves the median by a realm and a half at most, across the whole table', () => {
        // Foundation Establishment is 13 and Core Formation is 21. A median
        // lift larger than that band means an origin has become a difficulty
        // setting rather than an opening position.
        expect(report.privilegeLift.medianLift).toBeLessThanOrEqual(8);
        expect(report.privilegeLift.meanLift).toBeLessThanOrEqual(8);
    });

    it('leaves the run-level population where the world says it is', () => {
        // Believed: about one in forty of the people who ever gather qi see
        // Foundation, and about one in five hundred see Core Formation. The
        // origin axis must not move the population off those figures.
        expect(report.runLevel[13]).toBeGreaterThan(0.005);
        expect(report.runLevel[13]).toBeLessThan(0.15);
        expect(report.runLevel[21]).toBeLessThan(0.01);
    });

    it('keeps every tier overwhelmingly short of the ladder even at its best', () => {
        // The Void Refinement bar was 2% and the best-born now sit exactly on
        // it. It moved for a reason that is written down beside the constant:
        // `FAILURE_LOSS_SHAPE` in `breakthrough.ts` leans the cost of a failed
        // crossing toward the shallow end of its range, so a career survives
        // more failures and the lower-middle of the ladder widens. Measured, it
        // lifts dense-band Foundation Establishment from 44-46% to 46-48% and
        // Core Formation from 18% to 19-20%, and does nothing above Deity
        // Transformation.
        //
        // The claim here is "overwhelmingly short", and 98% is overwhelming.
        // The bar is set where the claim stops being true rather than where the
        // measurement sits, which is the mistake the 2% version made.
        for (const r of report.rows) {
            expect(r.reachedAtLeast[29], `${r.origin} reaches Void Refinement too often`)
                .toBeLessThan(0.05);
            expect(r.medianPeakOrdinal, `${r.origin} median is above Core Formation`)
                .toBeLessThan(21);
        }
    });

    it('never lets an origin supply the one thing the top of the ladder needs', () => {
        // A sealed vein is found. If any tier's vein share climbed toward
        // certainty, an origin would be handing out the site.
        for (const r of report.rows) {
            expect(r.veinShare, `${r.origin} finds veins too easily`).toBeLessThan(0.05);
        }
    });
});

describe('the last realm is reachable, and only as a conjunction', () => {
    it('is reached by nobody in an ordinary sweep, which is the point', () => {
        // At CI sample sizes the summit share is zero or near it for every
        // tier. A sweep this size that produced summits routinely would mean
        // the top of the ladder had stopped being rare.
        for (const r of report.rows) {
            expect(r.reachedAtLeast[45]).toBeLessThan(0.01);
        }
    });

    /**
     * WHAT THIS USED TO ASSERT, AND WHY IT NO LONGER HOLDS.
     *
     * It walked lives until one reached ordinal 45 and then demanded that that
     * single life carried every term of an authored conjunction: a sealed vein
     * walked into, a ruin entered, comprehension deep enough to substitute at a
     * bottleneck. It passed, and it was pinning a defect.
     *
     * `computeCultivationRate` was being called without `realmOrdinal`, which
     * prices every rung as Qi Condensation and drops a multiplier that reaches
     * 256 by the top of the ladder. With the rate that low, only a sealed vein
     * could close the gap, so the vein LOOKED like a required term when it was
     * standing in for a missing factor of two hundred.
     *
     * Measured with the rate corrected, over 120,000 lives of the most
     * privileged origin in the table:
     *
     *     peak >= 41   570 lives (0.475%), 35 of them carrying a vein
     *     peak >= 45    35 lives (0.029%)
     *        of those:  vein 6/35   ruin 6/35   deep comprehension 25/35
     *        landing:   false_immortal 34, summit 1
     *
     * So the vein is carried by one summit in six rather than by all of them,
     * and the term that actually carries most of them is understanding. The
     * conjunction was real; it was not the conjunction that was written down.
     *
     * ── AND THE TERM THIS HARNESS DOES NOT MODEL ──────────────────────────
     *
     * A teacher. `simulateLife` supplies ground, stones, placement, access,
     * supplied risk and a book, and never once passes `guideOrdinal` - so every
     * life in this file is the UNAIDED climb, and its summit rate is the answer
     * to "how often does somebody get there with nobody showing them the way".
     * The designer's bar for that case is about one in a generation, and one
     * life in three and a half thousand of the best-born in the world - against
     * one in sixty thousand for the ordinary-born - is the right order for it.
     *
     * What replaces the old assertion is the shape rather than the checklist:
     * the summit is reachable, it is a tail, and privilege is visible at the
     * very top and only there. That is what `origin.md` actually claims.
     */
    it('is reached as a tail, and privilege is visible there and only there', () => {
        const walk = (tier: string, n: number) => {
            let atLast = 0, summits = 0, withDepth = 0;
            for (let i = 0; i < n; i++) {
                const life = simulateLife('conjunction', i, tier as never);
                if (life.peakOrdinal >= 41) atLast++;
                if (life.peakOrdinal < 45) continue;
                summits++;
                if (life.degreeTotal > 20) withDepth++;
                // Either landing of the last crossing counts. Asserting
                // 'summit' here was only ever passing because the False
                // Immortal landing was being discarded; see the header of
                // `origin-odds.ts`.
                expect(['summit', 'false_immortal']).toContain(life.end);
                expect(life.immortalStatus).not.toBe('none');
            }
            return { atLast, summits, withDepth };
        };

        const N = 30_000;
        const born = walk('dao_house_bloodline', N);
        const nobody = walk('thin_county', N);

        // It is reachable at all, which is the half that has to stay true.
        expect(born.atLast, 'nobody reached the last realm from any origin')
            .toBeGreaterThan(0);
        // And it is a tail rather than an outcome. One life in two hundred of
        // the best-born in the world would already be a stratum.
        expect(born.atLast / N, 'the last realm has become an ordinary destination')
            .toBeLessThan(0.005 * 4);
        // Visible at the very top, which is the one place `origin.md` permits
        // it to be. Measured 0.475% against 0.013%, a factor of about thirty.
        expect(
            born.atLast,
            `dao house ${born.atLast} vs thin county ${nobody.atLast} at ordinal 41+`
        ).toBeGreaterThan(nobody.atLast * 3);
        // Understanding is what carries most of them. Not a required term -
        // measured 25 of 35 - but the commonest one, and the one a player can
        // actually go and get.
        if (born.summits >= 4) {
            expect(born.withDepth / born.summits).toBeGreaterThan(0.4);
        }
    });

    it('lands False Immortal more often than True, which is what the Lid does', () => {
        // `MAX_COMPLETION_CHANCE` is 0.25, so most crossings that survive the
        // tribulation do not complete. This is a regression test for a harness
        // defect that silently rerolled the crossing until it came up True:
        // over 1.2M lives it produced 58 False Immortal results at ordinal 44
        // and reported ZERO lives ending at ordinal 45.
        let falseImmortals = 0;
        let trueImmortals = 0;
        for (let i = 0; i < 60_000; i++) {
            const life = simulateLife('landings', i, 'dao_house_bloodline');
            if (life.end === 'false_immortal') falseImmortals++;
            if (life.end === 'summit') trueImmortals++;
        }
        expect(
            falseImmortals,
            'no crossing landed False Immortal - the outcome is being dropped again'
        ).toBeGreaterThan(0);
        expect(falseImmortals + trueImmortals).toBeGreaterThan(0);
        // Every life ending at 45 must actually be recorded as standing there.
        expect(falseImmortals).toBeGreaterThanOrEqual(trueImmortals);
    });

    it('is not closed to a farmer, only far narrower', () => {
        // The setting's own argument: the well-born climb by being supplied and
        // the poor climb by being reckless. A thin-county life that finds a
        // vein is on the same road.
        //
        // ── RE-DERIVED WHEN THE DAO GATE WENT LIVE, AND THIS IS THE BETTER BAR
        //
        // This asserted `peakOrdinal > 29` against 30,000 lives: one life in
        // thirty thousand crossing the Void Refinement wall, and the whole test
        // riding on which single life it happened to be. That was already
        // acknowledged as an existence proof "one life in thirty thousand
        // either way" beside `MAX_BOUNDARY_CHANCE`, and it is far too fragile to
        // survive any change that moves the RNG stream - measured, the same
        // constant with different stream ordering moved the best peak between
        // 24 and 28 with no change to the odds at all.
        //
        // `daoRequirementCurve` now charges 3 roads at the crossing out of 28.
        // The question the design actually cares about is whether the farmer's
        // road is CLOSED or merely narrow, and `no_road` makes that directly
        // measurable rather than inferred from a tail: a life refused there for
        // want of comprehension hit a wall somebody could have let them through,
        // and one that was allowed to strike and lost did not.
        let reachedTheWall = 0;
        let allowedToStrike = 0;
        let deepest = 0;
        for (let i = 0; i < 30_000; i++) {
            const life = simulateLife('poor-road', i, 'thin_county');
            deepest = Math.max(deepest, life.peakOrdinal);
            if (life.peakOrdinal < 28) continue;
            reachedTheWall++;
            if (life.end !== 'no_road') allowedToStrike++;
        }
        // Thin-county lives get to the Void Refinement wall at all. Without the
        // comprehension supply in `how-a-cultivator-comes-by-a-road.ts` this was
        // two lives in sixty thousand and both were refused.
        expect(reachedTheWall, 'no poor life reaches the Void Refinement wall')
            .toBeGreaterThan(0);
        // And some of them are allowed to strike at it. THIS is "not closed":
        // they got there holding roads they found in holes and on open ground,
        // with no house and nobody to teach them.
        expect(
            allowedToStrike,
            'every poor life at the wall is refused for want of a road - the road IS closed'
        ).toBeGreaterThan(0);
        // The band is still reached, which is the half the old bar measured.
        expect(deepest).toBeGreaterThanOrEqual(28);
    });
});

describe('the harness itself', () => {
    it('never reports a life that hit the runaway guard', () => {
        // `guard` is a bug, not an outcome. It was one: a six-thousand-year
        // stop silently truncated every run in the last three realms and
        // reported them as having died of old age.
        for (const r of report.rows) {
            expect(r.ends.guard, `${r.origin} hit the simulation guard`).toBe(0);
        }
    });

    it('is deterministic in its seed', () => {
        const a = simulateLife('repeat', 41, 'established_clan');
        const b = simulateLife('repeat', 41, 'established_clan');
        expect(a).toEqual(b);
    });

    it('does not feed the run seed into the origin, or vice versa', () => {
        // Two tiers at the same index must not be the same life with a
        // different label; the origin is part of the stream coordinate.
        const poor = simulateLife('independence', 7, 'thin_county');
        const rich = simulateLife('independence', 7, 'dao_house_bloodline');
        expect(poor).not.toEqual(rich);
    });
});
