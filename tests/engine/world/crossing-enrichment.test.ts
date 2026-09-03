/**
 * What a crossing leaves in the ground, and how much of it is left now.
 *
 * TWO TIERS, and the second is the one that matters.
 *
 *   the unit tests    say what the loan does: 999 years, linear, reaching
 *                     nothing at the end, never taking ground away.
 *   the rate test     says it happens at all, in a world nobody arranged, at
 *                     the point somebody would notice - a location on the map
 *                     whose vein is better than its own geology because
 *                     somebody finished on it.
 *
 * THE NUMBER IS A DECISION AND THAT IS WHY IT IS PINNED HERE.
 * `CROSSING_ENRICHMENT_YEARS` is 999 because failure takes ground forever and
 * success only lends it back. Permanent would make a new vein, which the
 * setting's own economics forbid - `past-the-ceiling.md`, "you can build
 * another room and you cannot make another vein" - and it would also remove the
 * world's ability to thin at all. If somebody makes this permanent, this file
 * is where they find out why it was not.
 *
 * AND THE GRADIENT IS THE FEATURE. Most crossings must be spent. A world where
 * every one of them still counts is a rich world, which is the opposite of this
 * setting; a world where none of them does makes the whole mechanism invisible.
 * The distribution test below is the guard on both ends at once, and it is
 * pooled across seeds because a per-world count is small enough to swing.
 */

import { describe, expect, it } from 'vitest';
import {
    CROSSING_ENRICHMENT_PEAK,
    CROSSING_ENRICHMENT_YEARS,
    crossingEnrichmentRemaining,
    crossingStillGiving,
    enrichedDensity
} from '../../../src/engine/world/crossing-enrichment.js';
import { seedPriorAges } from '../../../src/engine/world/history.js';
import { locationsFromPriorAges } from '../../../src/engine/world/locations.js';
import {
    QI_DENSITY_MAX,
    clampQiDensity,
    ordinaryBandFor
} from '../../../src/engine/world/qi-scale.js';
import { INSIGHT_AMBIENT_CHANCE } from '../../../src/engine/cultivation/understanding.js';

const PRESENT_YEAR = 1_000;
const SEEDS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'];

function priorAgesFor(seed: string) {
    return seedPriorAges(seed, { presentYear: PRESENT_YEAR });
}

describe('the loan a crossing leaves', () => {
    it('is whole on the day and nothing at 999 years', () => {
        expect(crossingEnrichmentRemaining(0)).toBe(1);
        expect(crossingEnrichmentRemaining(CROSSING_ENRICHMENT_YEARS)).toBe(0);
        expect(crossingEnrichmentRemaining(CROSSING_ENRICHMENT_YEARS + 500)).toBe(0);
    });

    it('runs down in a straight line, so half is gone at half the term', () => {
        const half = crossingEnrichmentRemaining(CROSSING_ENRICHMENT_YEARS / 2);
        expect(half).toBeCloseTo(0.5, 6);
        // Monotone the whole way. A decay that ever goes back up is a bug that
        // reads as a mechanic.
        let previous = 1.1;
        for (let year = 0; year <= CROSSING_ENRICHMENT_YEARS; year += 37) {
            const now = crossingEnrichmentRemaining(year);
            expect(now).toBeLessThan(previous);
            previous = now;
        }
    });

    it('lends and never takes', () => {
        for (const own of [1, 20, 40, 60, 89, 100]) {
            for (const years of [0, 100, 400, 998, 999, 5_000]) {
                const lifted = enrichedDensity(own, years);
                expect(lifted).toBeGreaterThanOrEqual(clampQiDensity(own));
                expect(lifted).toBeLessThanOrEqual(QI_DENSITY_MAX);
            }
        }
    });

    it('cannot push any ground past the ceiling below the Lid', () => {
        // The Hollow Court's own mountain is the top and a crossing does not
        // beat it. Ground already there gains nothing at all.
        expect(enrichedDensity(QI_DENSITY_MAX, 0)).toBe(QI_DENSITY_MAX);
        expect(CROSSING_ENRICHMENT_PEAK).toBe(QI_DENSITY_MAX);
    });

    it('is spent exactly when the years say and not before', () => {
        expect(crossingStillGiving(CROSSING_ENRICHMENT_YEARS - 1)).toBe(true);
        expect(crossingStillGiving(CROSSING_ENRICHMENT_YEARS)).toBe(false);
    });
});

describe('the crossings a seeded world already remembers', () => {
    it('records one per ascension the prior ages wrote, on the seat it happened at', () => {
        const prior = priorAgesFor('w1');
        const ascensions = prior.ledger.facts.filter(f => f.kind === 'ascension');
        expect(prior.crossings.length).toBe(ascensions.length);
        for (const crossing of prior.crossings) {
            const fact = prior.ledger.facts.find(f => f.id === crossing.originFactId);
            expect(fact?.kind).toBe('ascension');
            expect(fact?.place).toBe(crossing.location);
            // It makes no new place. The house fell later and its compound is
            // already on the map at the same seat.
            const ruin = prior.ruins.find(r => r.id === crossing.groundRuinId);
            expect(ruin?.location).toBe(crossing.location);
        }
    });

    it('leaves the tide on the record and the cause off it', () => {
        const prior = priorAgesFor('w2');
        const tides = prior.ledger.facts.filter(f => f.kind === 'spirit_tide');
        expect(tides.length).toBeGreaterThan(0);
        for (const tide of tides) {
            // Nobody below the Lid knows a tide is somebody finishing. The
            // summary carries the world's two wrong guesses and the field the
            // knowledge layer reads agrees with it.
            expect(tide.causeKnown).toBe(false);
            expect(tide.summary).toContain('nobody agreed which');
            // And it is on the record as following from the crossing, so the
            // engine can walk from one to the other even though nobody in the
            // world can.
            const cause = prior.ledger.facts.find(f => f.id === tide.causes[0]);
            expect(cause?.kind).toBe('ascension');
        }
    });
});

describe('the ground, at the point somebody would notice', () => {
    it('lifts the vein of a place somebody finished on recently enough', () => {
        // Pooled: how many live crossings a single world gets is small.
        let lifted = 0;
        for (const seed of SEEDS) {
            const prior = priorAgesFor(seed);
            const locations = locationsFromPriorAges(prior);
            for (const crossing of prior.crossings) {
                if (!crossingStillGiving(PRESENT_YEAR - crossing.year)) continue;
                const ground = locations.find(l => l.id === `loc-${crossing.groundRuinId}`);
                expect(ground).toBeDefined();
                const ruin = prior.ruins.find(r => r.id === crossing.groundRuinId)!;
                // Better than the geology it would have had on its own.
                expect(ground!.qiDensity).toBeGreaterThan(ruin.qiDensity);
                expect(ground!.tags).toContain('crossing_ground');
                lifted++;
            }
        }
        expect(lifted).toBeGreaterThan(0);
    });

    it('says on the record that it happened, and does not say why', () => {
        for (const seed of SEEDS) {
            const prior = priorAgesFor(seed);
            const locations = locationsFromPriorAges(prior);
            for (const location of locations) {
                const change = location.changes.find(c => c.kind === 'enriched');
                if (!change) continue;
                // Concrete evidence: a dated change on the ground, pointing at
                // the fact that caused it, which nobody in the world has read.
                expect(change.causeFactId).toBeTruthy();
                expect(change.causeKnown).toBe(false);
                expect(change.onDay).toBeLessThan(PRESENT_YEAR * 365);
                return;
            }
        }
        throw new Error('no world in the sample had a live crossing to record');
    });

    it('leaves a spent crossing alone entirely', () => {
        for (const seed of SEEDS) {
            const prior = priorAgesFor(seed);
            const locations = locationsFromPriorAges(prior);
            for (const crossing of prior.crossings) {
                if (crossingStillGiving(PRESENT_YEAR - crossing.year)) continue;
                const ground = locations.find(l => l.id === `loc-${crossing.groundRuinId}`)!;
                const ruin = prior.ruins.find(r => r.id === crossing.groundRuinId)!;
                // The loan was repaid. The ground is what it always was, and
                // there is no row claiming otherwise.
                expect(ground.qiDensity).toBe(ruin.qiDensity);
                expect(ground.tags).not.toContain('crossing_ground');
            }
        }
    });

    it('makes comprehension likelier there, through the rule that already prices it', () => {
        // Somebody crossing left marks, and reading marks is what comprehension
        // is. No branch anywhere knows about crossings: the loan lifts the
        // vein, the band follows the vein, and `INSIGHT_AMBIENT_CHANCE` already
        // pays more on a better band. This asserts the join, not a new path.
        let checked = 0;
        for (const seed of SEEDS) {
            const prior = priorAgesFor(seed);
            const locations = locationsFromPriorAges(prior);
            for (const crossing of prior.crossings) {
                if (!crossingStillGiving(PRESENT_YEAR - crossing.year)) continue;
                const ground = locations.find(l => l.id === `loc-${crossing.groundRuinId}`)!;
                const ruin = prior.ruins.find(r => r.id === crossing.groundRuinId)!;
                const before = INSIGHT_AMBIENT_CHANCE[ordinaryBandFor(ruin.qiDensity)] ?? 0;
                const after = INSIGHT_AMBIENT_CHANCE[ground.ambient] ?? 0;
                expect(after).toBeGreaterThanOrEqual(before);
                // The record agrees with its own vein rather than answering two
                // ways about one place.
                expect(ground.ambient).toBe(ordinaryBandFor(ground.qiDensity));
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('does not make the world rich: most crossings are spent', () => {
        let total = 0;
        let live = 0;
        for (const seed of SEEDS) {
            const prior = priorAgesFor(seed);
            for (const crossing of prior.crossings) {
                total++;
                if (crossingStillGiving(PRESENT_YEAR - crossing.year)) live++;
            }
        }
        expect(total).toBeGreaterThan(0);
        // The gradient is the feature. A handful of places where somebody
        // finished recently enough to still matter, against a world that has
        // mostly run down. Pooled over eight worlds, not asserted per world.
        expect(live).toBeGreaterThan(0);
        expect(live / total).toBeLessThan(0.5);
    });
});
