/**
 * The 45-rank ladder and the fixed talent draw.
 *
 * These files are the contract the rest of the engine is written against, so
 * the assertions here are about the SHAPE of the curves - where boundaries
 * fall, that they are expensive, that they are dangerous - rather than about
 * any particular tuned number.
 */

import {
    MAX_ORDINAL,
    TOTAL_RANKS,
    FOUNDATION_ORDINAL,
    REALM_TIERS,
    baseBreakthroughChance,
    fullLadder,
    isRealmBoundary,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal,
    triggersHeavenlyTribulation
} from '../../../src/engine/cultivation/realms.js';
import {
    SPIRIT_ROOTS,
    WEIGHT_TOTAL,
    conflictsWithRoot,
    getSpiritRoot,
    rollAttributes,
    rollSpiritRoot,
    rootProbability
} from '../../../src/engine/cultivation/spirit-roots.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';

const ALL_ORDINALS = Array.from({ length: TOTAL_RANKS }, (_, i) => i);

describe('realm ladder', () => {
    it('covers 0..45 with no holes and no overlaps', () => {
        for (const ordinal of ALL_ORDINALS) {
            expect(() => realmForOrdinal(ordinal)).not.toThrow();
        }
        const covered = REALM_TIERS.reduce(
            (sum, t) => sum + (t.ordinalEnd - t.ordinalStart + 1),
            0
        );
        expect(covered).toBe(TOTAL_RANKS);
        // 45, not 44: Tribulation Transcendence is the approach to the Lid and
        // True Immortal sits above it as a single rank.
        expect(MAX_ORDINAL).toBe(45);
        expect(TOTAL_RANKS).toBe(46);
        expect(rankName(MAX_ORDINAL)).toBe('True Immortal');
    });

    it('places a boundary exactly at the last ordinal of each realm but the top one', () => {
        const boundaries = ALL_ORDINALS.filter(isRealmBoundary);
        const expected = REALM_TIERS.slice(0, -1).map(t => t.ordinalEnd);
        expect(boundaries).toEqual(expected);
        expect(boundaries).toContain(FOUNDATION_ORDINAL - 1);
        // The summit is not a boundary - there is nothing above it.
        expect(isRealmBoundary(MAX_ORDINAL)).toBe(false);
    });

    it('taxes realm boundaries heavily in progress cost', () => {
        for (const ordinal of ALL_ORDINALS.filter(isRealmBoundary)) {
            const here = progressRequiredForOrdinal(ordinal);
            const below = progressRequiredForOrdinal(ordinal - 1);
            expect(here).toBeGreaterThan(below * 2);
        }
    });

    it('grows progress cost super-linearly within a realm', () => {
        // Inside a realm, each step costs strictly more than the last.
        for (const tier of REALM_TIERS) {
            for (let o = tier.ordinalStart + 1; o <= tier.ordinalEnd; o++) {
                if (isRealmBoundary(o) || isRealmBoundary(o - 1)) continue;
                expect(progressRequiredForOrdinal(o)).toBeGreaterThan(
                    progressRequiredForOrdinal(o - 1)
                );
            }
        }
    });

    it('makes a realm boundary far less survivable than the sub-rank below it', () => {
        for (const ordinal of ALL_ORDINALS.filter(isRealmBoundary)) {
            const here = baseBreakthroughChance(ordinal);
            const below = baseBreakthroughChance(ordinal - 1);
            expect(here).toBeLessThan(below * 0.6);
        }
    });

    it('keeps every base chance strictly inside (0, 1)', () => {
        for (const ordinal of ALL_ORDINALS) {
            const chance = baseBreakthroughChance(ordinal);
            expect(chance).toBeGreaterThan(0);
            expect(chance).toBeLessThan(1);
        }
    });

    it('raises lifespan monotonically and only at realm changes', () => {
        for (let o = 1; o <= MAX_ORDINAL; o++) {
            const here = lifespanForOrdinal(o);
            const below = lifespanForOrdinal(o - 1);
            if (isRealmBoundary(o - 1)) expect(here).toBeGreaterThan(below);
            else expect(here).toBe(below);
        }
    });

    it('summons heavenly lightning on every crossing INTO Tribulation Transcendence', () => {
        // The test is on the destination, not the origin. Attempting from 40
        // lands at 41 and therefore summons lightning - that crossing is the
        // whole point of the realm's name. 44 is the summit and never attempts.
        for (const ordinal of ALL_ORDINALS) {
            const expected = ordinal >= 40 && ordinal < MAX_ORDINAL;
            expect(triggersHeavenlyTribulation(ordinal)).toBe(expected);
        }
        expect(triggersHeavenlyTribulation(39)).toBe(false);
        expect(triggersHeavenlyTribulation(40)).toBe(true);
        expect(triggersHeavenlyTribulation(MAX_ORDINAL)).toBe(false);
    });

    it('makes the 40 to 41 crossing a realm boundary AND a tribulation', () => {
        // The single worst moment in a run: boundary odds, boundary failure
        // table, heavenly lightning, and the price of advancement, all at once.
        expect(isRealmBoundary(40)).toBe(true);
        expect(triggersHeavenlyTribulation(40)).toBe(true);
    });

    it('names every rank uniquely', () => {
        const names = ALL_ORDINALS.map(rankName);
        expect(new Set(names).size).toBe(TOTAL_RANKS);
    });

    it('reports a flat table matching the individual accessors', () => {
        const ladder = fullLadder();
        expect(ladder).toHaveLength(TOTAL_RANKS);
        for (const entry of ladder) {
            expect(entry.name).toBe(rankName(entry.ordinal));
            expect(entry.progressRequired).toBe(progressRequiredForOrdinal(entry.ordinal));
            expect(entry.isBoundary).toBe(isRealmBoundary(entry.ordinal));
        }
    });
});

describe('spirit roots', () => {
    it('matches the declared weight distribution over many seeded samples', () => {
        const rng = new CultivationRNG('spirit-root-distribution');
        const N = 200_000;
        const counts = new Map<string, number>();
        for (let i = 0; i < N; i++) {
            const root = rollSpiritRoot(rng.next());
            counts.set(root.key, (counts.get(root.key) ?? 0) + 1);
        }

        for (const root of SPIRIT_ROOTS) {
            const observed = (counts.get(root.key) ?? 0) / N;
            const expected = root.weight / WEIGHT_TOTAL;
            // 200k samples puts four standard deviations well inside 0.005 for
            // every weight in the table, including the 27/999 mutated roots.
            expect(Math.abs(observed - expected)).toBeLessThan(0.005);
            expect(rootProbability(root.key)).toBeCloseTo(expected, 12);
        }
    });

    it('covers the whole [0,1) sample range without a gap', () => {
        for (let sample = 0; sample < 1; sample += 0.0005) {
            expect(() => rollSpiritRoot(sample)).not.toThrow();
        }
        expect(rollSpiritRoot(0).key).toBe(SPIRIT_ROOTS[0].key);
        expect(rollSpiritRoot(0.9999999999).key).toBe(SPIRIT_ROOTS[SPIRIT_ROOTS.length - 1].key);
    });

    it('treats a dual root as internally conflicted with its own elements', () => {
        const dual = getSpiritRoot('dual_water_fire');
        expect(conflictsWithRoot(dual, 'water')).toBe(true);
        expect(conflictsWithRoot(dual, 'fire')).toBe(true);
        expect(dual.deviationRisk).toBeGreaterThan(0);
    });

    it('treats an overcoming element as conflicting for a clean root', () => {
        const fire = getSpiritRoot('single_fire');
        // Water overcomes fire in the wuxing cycle.
        expect(conflictsWithRoot(fire, 'water')).toBe(true);
        // Fire is its own element and lightning overcomes nothing.
        expect(conflictsWithRoot(fire, 'fire')).toBe(false);
        expect(conflictsWithRoot(fire, 'lightning')).toBe(false);
    });

    it('keeps rolled attributes inside their declared ranges', () => {
        const rng = new CultivationRNG('attributes');
        for (let i = 0; i < 5000; i++) {
            const attrs = rollAttributes([rng.next(), rng.next(), rng.next(), rng.next()]);
            expect(attrs.might).toBeGreaterThanOrEqual(1);
            expect(attrs.might).toBeLessThanOrEqual(3);
            expect(attrs.insight).toBeGreaterThanOrEqual(1);
            expect(attrs.insight).toBeLessThanOrEqual(4);
            expect(attrs.fortune).toBeGreaterThanOrEqual(0);
            expect(attrs.fortune).toBeLessThanOrEqual(3);
            expect(attrs.charm).toBeGreaterThanOrEqual(1);
            expect(attrs.charm).toBeLessThanOrEqual(3);
        }
    });
});
