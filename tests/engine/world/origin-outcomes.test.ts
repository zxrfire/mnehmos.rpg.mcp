/**
 * The honesty constraint, measured.
 *
 * `docs/world/origin.md` stakes the whole axis on one claim:
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
        const positions = ORIGIN_TIERS.map(t => openingPosition(t.key));
        for (let i = 1; i < positions.length; i++) {
            expect(positions[i].spiritStones).toBeGreaterThan(positions[i - 1].spiritStones);
            expect(positions[i].provisionedYears).toBeGreaterThan(positions[i - 1].provisionedYears);
            expect(positions[i].placementReach).toBeGreaterThanOrEqual(positions[i - 1].placementReach);
            expect(positions[i].vouchers).toBeGreaterThanOrEqual(positions[i - 1].vouchers);
        }
        // And the two ends of it are not close.
        expect(positions[positions.length - 1].spiritStones)
            .toBeGreaterThan(positions[0].spiritStones * 100);
    });
});

describe('and most people born to enormous advantage still fail', () => {
    it('leaves the overwhelming majority of great-house children short of Core Formation', () => {
        expect(row('great_house').reachedAtLeast[21]).toBeLessThan(0.05);
    });

    it('ends the great majority of privileged lives on a clock, not at the top', () => {
        const ends = row('great_house').ends;
        const n = row('great_house').sampleSize;
        expect((ends.settling + ends.lifespan) / n).toBeGreaterThan(0.5);
        expect(ends.summit / n).toBeLessThan(0.01);
    });

    it('does not stop a great-house child dying in a ruin like anybody else', () => {
        expect(row('great_house').ends.died_in_a_ruin).toBeGreaterThan(0);
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
        for (const r of report.rows) {
            expect(r.reachedAtLeast[29], `${r.origin} reaches Void Refinement too often`)
                .toBeLessThan(0.02);
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

    it('is reached when the whole conjunction lands, and not otherwise', () => {
        // A targeted search rather than a sweep: walk lives until one arrives.
        // Every summit found must carry every term - a sealed vein it walked
        // into, comprehension deep enough to substitute at a bottleneck, and a
        // ruin entered more than once.
        let found = 0;
        for (let i = 0; i < 30_000 && found < 1; i++) {
            const life = simulateLife('conjunction', i, 'great_house');
            if (life.peakOrdinal < 45) continue;
            found++;
            expect(life.foundVein, 'reached the last realm without a vein').toBe(true);
            expect(life.ruinsEntered).toBeGreaterThan(0);
            expect(life.degreeTotal).toBeGreaterThan(20);
            expect(life.end).toBe('summit');
        }
        expect(found, 'the last realm was not reachable at all').toBe(1);
    });

    it('is not closed to a farmer, only far narrower', () => {
        // The setting's own argument: the well-born climb by being supplied and
        // the poor climb by being reckless. A thin-county life that finds a
        // vein is on the same road.
        let best = 0;
        // Stops as soon as the point is made. A poor life that got past Void
        // Refinement is the existence proof; grinding the rest of the sample
        // would only cost CI time to raise a number nobody reads.
        for (let i = 0; i < 30_000 && best <= 29; i++) {
            best = Math.max(best, simulateLife('poor-road', i, 'thin_county').peakOrdinal);
        }
        expect(best).toBeGreaterThan(29);
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
        const rich = simulateLife('independence', 7, 'great_house');
        expect(poor).not.toEqual(rich);
    });
});
