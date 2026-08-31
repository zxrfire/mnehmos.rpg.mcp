/**
 * Origin - the third thing a cultivator is dealt.
 *
 * These tests are about the HARD RULE more than about the numbers: an origin
 * buys inputs and never rank. The one that matters most is
 * "placement does not waive an institution's own floor", because that is the
 * rule the Hollow Court states in prose and is the one an implementation would
 * quietly break first.
 */

import { describe, it, expect } from 'vitest';
import {
    DEFAULT_ORIGIN,
    MAX_EXPEDITION_MARGIN,
    MAX_ORIGIN_AMBIENT,
    ORIGIN_TIERS,
    ORIGIN_WEIGHT_TOTAL,
    affordablePillPotency,
    breakthroughPillPrice,
    expeditionSurvival,
    getOrigin,
    injuryTreatmentPrice,
    isOriginTierKey,
    openingPosition,
    originDiscoveryContext,
    originProbability,
    placementsWithinReach,
    provisionedYears,
    rollOrigin,
    withOriginAccess,
    type OriginTierKey
} from '../../../src/engine/cultivation/origin.js';
import { discoverableInsights } from '../../../src/engine/cultivation/understanding.js';
import { MAX_SECT_PROTECTION } from '../../../src/engine/cultivation/toll.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    AMBIENT_QI_RATE_MULTIPLIER,
    OriginTierKeySchema
} from '../../../src/schema/cultivation.js';

const TIER_KEYS = ORIGIN_TIERS.map(t => t.key);

describe('the table', () => {
    it('agrees with the wire schema, in both directions', () => {
        // The enum is restated in schema/cultivation.ts so the contract does
        // not depend on engine values at module-evaluation time. That is only
        // safe while the two lists cannot drift.
        expect([...OriginTierKeySchema.options].sort()).toEqual([...TIER_KEYS].sort());
    });

    it('is overwhelmingly a farm in a thin county', () => {
        expect(originProbability('thin_county')).toBeGreaterThan(0.85);
        expect(DEFAULT_ORIGIN).toBe('thin_county');
    });

    it('makes a great house vanishingly rare', () => {
        const p = originProbability('great_house');
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(0.0001);
    });

    it('is ordered from nothing upward, and strictly', () => {
        for (let i = 1; i < ORIGIN_TIERS.length; i++) {
            expect(ORIGIN_TIERS[i].weight).toBeLessThan(ORIGIN_TIERS[i - 1].weight);
            expect(ORIGIN_TIERS[i].spiritStones).toBeGreaterThan(ORIGIN_TIERS[i - 1].spiritStones);
        }
    });

    it('rolls reproducibly from a sample, with the weights it claims', () => {
        const counts = new Map<OriginTierKey, number>();
        const rng = forStream('origin-distribution', 'roll');
        const n = 200_000;
        for (let i = 0; i < n; i++) {
            const key = rollOrigin(rng.next()).key;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const thin = (counts.get('thin_county') ?? 0) / n;
        expect(thin).toBeCloseTo(originProbability('thin_county'), 2);
        // The same sample always produces the same birth.
        expect(rollOrigin(0.5).key).toBe(rollOrigin(0.5).key);
        expect(rollOrigin(0).key).toBe('thin_county');
        expect(rollOrigin(0.999999999).key).toBe('great_house');
    });

    it('has weights that sum to the declared total', () => {
        expect(ORIGIN_TIERS.reduce((s, t) => s + t.weight, 0)).toBe(ORIGIN_WEIGHT_TOTAL);
    });

    it('recognises its own keys and nothing else', () => {
        for (const key of TIER_KEYS) expect(isOriginTierKey(key)).toBe(true);
        expect(isOriginTierKey('patriarch')).toBe(false);
        expect(isOriginTierKey(null)).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE HARD RULE
// ─────────────────────────────────────────────────────────────────────────

describe('an origin buys inputs and never rank', () => {
    it('has no field anywhere that could confer a position on the ladder', () => {
        const forbidden = [
            'realmOrdinal', 'ordinal', 'realm', 'rank', 'progress',
            'cultivationProgress', 'foundation', 'foundationQuality',
            'insights', 'admission', 'admissionOrdinal', 'sectRank'
        ];
        for (const tier of ORIGIN_TIERS) {
            const serialised = JSON.stringify(tier);
            for (const field of forbidden) {
                expect(serialised.includes(`"${field}"`), `${tier.key} carries ${field}`).toBe(false);
            }
        }
    });

    it('places every child in the outer court, whoever they are', () => {
        for (const tier of ORIGIN_TIERS) {
            expect(tier.placement.entryRankIndex).toBe(0);
        }
    });

    it('does not waive an institution\'s own floor, including for a great house', () => {
        // The Hollow Court: Void Refinement at the floor, and nothing else
        // counts, which includes being somebody's child.
        const hollowCourt = { id: 'sect-hollow-court', powerOrdinal: 44, admissionOrdinal: 29 };
        const localSect = { id: 'sect-local', powerOrdinal: 11, admissionOrdinal: 0 };
        const houses = [hollowCourt, localSect];

        // A great house child at the age placement happens is at ordinal zero
        // like everybody else, and the Court's floor is the whole of the answer.
        const atBirth = placementsWithinReach('great_house', 0, houses);
        expect(atBirth.map(h => h.id)).toEqual(['sect-local']);

        // And the Court is beyond every family's reach in any case.
        for (const key of TIER_KEYS) {
            expect(placementsWithinReach(key, 44, houses).map(h => h.id))
                .not.toContain('sect-hollow-court');
        }
    });

    it('reaches nobody at all from the two tiers that are the bulk of births', () => {
        expect(placementsWithinReach('thin_county', 30, [
            { id: 'sect-local', powerOrdinal: 11, admissionOrdinal: 0 }
        ])).toEqual([]);
        expect(placementsWithinReach('market_town', 30, [
            { id: 'sect-local', powerOrdinal: 11, admissionOrdinal: 0 }
        ])).toEqual([]);
    });

    it('never protects a crossing beyond what a sect is permitted to', () => {
        for (const tier of ORIGIN_TIERS) {
            expect(tier.placement.tollProtection).toBeLessThanOrEqual(MAX_SECT_PROTECTION);
            expect(tier.placement.tollProtection).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('a vein is found, never given', () => {
    it('caps what any family can put underfoot at ordinary ground', () => {
        for (const tier of ORIGIN_TIERS) {
            expect(AMBIENT_QI_RATE_MULTIPLIER[tier.ground])
                .toBeLessThanOrEqual(AMBIENT_QI_RATE_MULTIPLIER[MAX_ORIGIN_AMBIENT]);
            expect(tier.ground).not.toBe('sealed_vein');
        }
    });

    it('keeps the ground term below the talent term', () => {
        // Thin to the origin ceiling must stay smaller than the gap between
        // the fastest and slowest spirit root. If it does not, where you were
        // born outweighs what you were dealt, and the setting says it must not.
        const groundSpread =
            AMBIENT_QI_RATE_MULTIPLIER[MAX_ORIGIN_AMBIENT] / AMBIENT_QI_RATE_MULTIPLIER.thin;
        const talentSpread = 1.8 / 0.55; // mutated over muddled
        expect(groundSpread).toBeLessThan(talentSpread);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ACCESS
// ─────────────────────────────────────────────────────────────────────────

describe('access goes through the mechanism that already exists', () => {
    it('leaves a thin-county birth reaching its own root and nothing else', () => {
        const ctx = withOriginAccess('thin_county');
        const candidates = discoverableInsights({ spiritRoot: 'single_fire' }, ctx);
        expect(candidates).toHaveLength(1);
        expect(candidates[0].access.kind).toBe('own_root');
    });

    it('names a real source for everything a house puts within reach', () => {
        const ctx = withOriginAccess('great_house');
        const candidates = discoverableInsights({ spiritRoot: 'single_fire' }, ctx);
        expect(candidates.length).toBeGreaterThan(4);
        for (const candidate of candidates) {
            expect(candidate.access.label.length).toBeGreaterThan(0);
            expect(['own_root', 'teacher', 'manual', 'tradition']).toContain(candidate.access.kind);
        }
        // A house's principle is reachable only from inside the house.
        expect(candidates.some(c => c.access.kind === 'tradition')).toBe(true);
    });

    it('adds to a context without displacing what is already in it', () => {
        const merged = withOriginAccess('great_house', {
            teachers: [{ subject: 'sword', label: 'somebody met on the road' }],
            tradition: { subject: 'debt', label: 'a house they actually joined' }
        });
        expect(merged.teachers?.[0].label).toBe('somebody met on the road');
        // You can only stand inside one house, and it is the one you are in.
        expect(merged.tradition?.label).toBe('a house they actually joined');
    });

    it('widens strictly with the tier, and is empty for the common case', () => {
        const counts = TIER_KEYS.map(
            key => discoverableInsights({ spiritRoot: 'single_fire' }, withOriginAccess(key)).length
        );
        expect(counts[0]).toBe(1);
        expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
        const raw = originDiscoveryContext('thin_county');
        expect(raw.teachers).toEqual([]);
        expect(raw.readableManuals).toEqual([]);
        expect(raw.tradition).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// RESOURCES
// ─────────────────────────────────────────────────────────────────────────

describe('resources are finite and they are spent', () => {
    it('prices a pill against the rank it is for, at the ladder\'s own growth', () => {
        expect(breakthroughPillPrice(0)).toBeLessThan(breakthroughPillPrice(1));
        // Thirty times the money must not buy thirty times the road.
        const rungs = (fortune: number): number => {
            let o = 0;
            while (affordablePillPotency(fortune, breakthroughPillPrice(o)) >= 1) o++;
            return o;
        };
        const modest = rungs(getOrigin('established_clan').spiritStones);
        const enormous = rungs(getOrigin('great_house').spiritStones);
        expect(enormous).toBeGreaterThan(modest);
        expect(enormous - modest).toBeLessThan(10);
        // And it runs out well short of the top.
        expect(enormous).toBeLessThan(25);
    });

    it('prices a healer the same way', () => {
        expect(injuryTreatmentPrice(20)).toBeGreaterThan(injuryTreatmentPrice(0));
    });

    it('buys a fraction of a pill for a fraction of the price', () => {
        expect(affordablePillPotency(0, 500)).toBe(0);
        expect(affordablePillPotency(250, 500)).toBeCloseTo(0.5);
        expect(affordablePillPotency(5_000, 500)).toBe(1);
    });

    it('makes a long seclusion a plan only for the tiers that funded it', () => {
        expect(provisionedYears(getOrigin('thin_county').spiritStones)).toBeLessThan(1);
        expect(provisionedYears(getOrigin('great_house').spiritStones)).toBeGreaterThan(40);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// SURVIVABLE RISK
// ─────────────────────────────────────────────────────────────────────────

describe('supplied risk moves survival and nothing else', () => {
    it('leaves an unsupplied attempt at the base number for everybody', () => {
        for (const key of TIER_KEYS) {
            expect(expeditionSurvival(key, 0.45, false)).toBe(0.45);
        }
    });

    it('is bounded, so the worst places stay lethal to everyone', () => {
        for (const key of TIER_KEYS) {
            const supplied = expeditionSurvival(key, 0.45, true);
            expect(supplied - 0.45).toBeLessThanOrEqual(MAX_EXPEDITION_MARGIN + 1e-9);
            expect(supplied).toBeLessThanOrEqual(1);
        }
        expect(expeditionSurvival('great_house', 0.95, true)).toBeLessThanOrEqual(1);
    });

    it('runs out - it is a count over a life, not a standing condition', () => {
        for (const tier of ORIGIN_TIERS) {
            expect(Number.isFinite(tier.expeditions.supplied)).toBe(true);
        }
        expect(getOrigin('thin_county').expeditions.supplied).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// NO ADVISORY, ANYWHERE
// ─────────────────────────────────────────────────────────────────────────

describe('nothing tells anybody what their birth is worth', () => {
    it('reports an opening position with no score, rating or recommendation in it', () => {
        const position = openingPosition('great_house');
        expect(Object.keys(position).sort()).toEqual([
            'accessCount', 'description', 'ground', 'name', 'origin',
            'placementAge', 'placementReach', 'probability', 'provisionedYears',
            'spiritStones', 'suppliedExpeditions', 'vouchers'
        ]);
    });

    it('never states an outcome, a prospect or a suggestion in the prose', () => {
        const advisory =
            /\b(should|recommend|best|worst|advantage|disadvantage|优|likely to reach|your best)\b/i;
        for (const tier of ORIGIN_TIERS) {
            expect(advisory.test(tier.description), `${tier.key}: ${tier.description}`).toBe(false);
            expect(advisory.test(tier.name)).toBe(false);
        }
    });
});
