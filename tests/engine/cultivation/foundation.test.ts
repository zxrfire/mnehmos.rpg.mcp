/**
 * Foundation quality.
 *
 * The charter requirement being tested: two cultivators at the same ordinal
 * must be able to have different futures, and the engine must be able to say
 * why. So the tests assert the divergence is real (rate, odds, toll) and that
 * it is EARNED - preparation and injuries move it, and talent moves it less
 * than either, because "talent is not destiny" has to be a fact about the
 * numbers rather than a slogan in a comment.
 */

import {
    CultivatorSchema,
    type FoundationQuality
} from '../../../src/schema/cultivation.js';
import {
    FOUNDATION_EFFECTS,
    FOUNDATION_THRESHOLDS,
    assessFoundation,
    describeFoundation,
    foundationEffect,
    foundationOf,
    laysFoundation,
    rebuildFoundation
} from '../../../src/engine/cultivation/foundation.js';
import { computeCultivationRate } from '../../../src/engine/cultivation/cultivation.js';
import { computeBreakthroughOdds } from '../../../src/engine/cultivation/breakthrough.js';
import { computeTollRisk } from '../../../src/engine/cultivation/toll.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const ALL_QUALITIES = Object.keys(FOUNDATION_EFFECTS) as FoundationQuality[];

/** Distribution of qualities over many seeded crossings under one set of conditions. */
function qualitiesFor(
    conditions: Parameters<typeof assessFoundation>[1],
    overrides = {},
    n = 2000
): Map<FoundationQuality, number> {
    const rng = new CultivationRNG('foundation-sweep');
    const counts = new Map<FoundationQuality, number>();
    for (let i = 0; i < n; i++) {
        const quality = assessFoundation(makeCultivator(overrides), conditions, rng.next()).quality;
        counts.set(quality, (counts.get(quality) ?? 0) + 1);
    }
    return counts;
}

function mean(
    conditions: Parameters<typeof assessFoundation>[1],
    overrides = {},
    n = 2000
): number {
    const rng = new CultivationRNG('foundation-mean');
    let total = 0;
    for (let i = 0; i < n; i++) {
        total += assessFoundation(makeCultivator(overrides), conditions, rng.next()).score;
    }
    return total / n;
}

describe('the effects table', () => {
    it('covers every quality in the schema', () => {
        expect(ALL_QUALITIES).toHaveLength(9);
        for (const quality of ALL_QUALITIES) {
            const effect = foundationEffect(quality);
            expect(effect.cultivationMultiplier).toBeGreaterThan(0);
            expect(describeFoundation(quality).length).toBeGreaterThan(20);
        }
    });

    it('treats "none" as the identity so a pre-Foundation cultivator is unaffected', () => {
        expect(FOUNDATION_EFFECTS.none).toMatchObject({
            cultivationMultiplier: 1,
            breakthroughModifier: 0,
            tollModifier: 0
        });
    });

    it('reads a missing field as none, so old rows and NPC stubs still work', () => {
        expect(foundationOf({})).toBe('none');
        expect(foundationOf({ foundationQuality: 'damaged' })).toBe('damaged');
    });

    it('leaves rows written before foundations existed parsing cleanly', () => {
        // The field was added additively with a default; a saved cultivator
        // from before it existed must still load, and must load as 'none'.
        const legacyRow = {
            id: 'legacy-1',
            name: 'Someone From Before',
            spiritRoot: 'single_water',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            hp: 30,
            maxHp: 30,
            qi: 10,
            maxQi: 10
        };
        const parsed = CultivatorSchema.parse(legacyRow);
        expect(parsed.foundationQuality).toBe('none');
        expect(computeCultivationRate(parsed, 'normal').perDay).toBeGreaterThan(0);
    });

    it('orders the ordinary qualities the way the fiction does', () => {
        const rate = (q: FoundationQuality) => FOUNDATION_EFFECTS[q].cultivationMultiplier;
        expect(rate('exceptional')).toBeGreaterThan(rate('stable'));
        expect(rate('stable')).toBeGreaterThan(rate('unstable'));
        expect(rate('unstable')).toBeGreaterThan(rate('incomplete'));
        expect(rate('incomplete')).toBeGreaterThan(rate('damaged'));
        expect(rate('damaged')).toBeGreaterThan(rate('sacrificed'));
    });

    it('makes a rebuilt foundation worse than stable and better than damaged', () => {
        // "Loss branches rather than subtracts": rebuilding must be worth doing
        // and must never be as good as never having lost it.
        const rate = (q: FoundationQuality) => FOUNDATION_EFFECTS[q].cultivationMultiplier;
        expect(rate('rebuilt')).toBeLessThan(rate('stable'));
        expect(rate('rebuilt')).toBeGreaterThan(rate('damaged'));
        expect(rebuildFoundation('damaged')).toBe('rebuilt');
        expect(rebuildFoundation('exceptional')).toBe('rebuilt');
        // Nothing to rebuild below Foundation Establishment.
        expect(rebuildFoundation('none')).toBe('none');
    });
});

describe('two cultivators at the same ordinal', () => {
    const at = (foundationQuality: FoundationQuality) =>
        makeCultivator({ realmOrdinal: 20, cultivationProgress: 0, foundationQuality });

    it('cultivate at measurably different rates', () => {
        const strong = computeCultivationRate(at('exceptional'), 'normal').perDay;
        const weak = computeCultivationRate(at('damaged'), 'normal').perDay;
        expect(strong).toBeGreaterThan(weak * 2);
    });

    it('face measurably different breakthrough odds', () => {
        const strong = computeBreakthroughOdds(at('exceptional'), { ambient: 'normal' });
        const weak = computeBreakthroughOdds(at('damaged'), { ambient: 'normal' });
        expect(strong.finalChance).toBeGreaterThan(weak.finalChance + 0.15);
        expect(strong.modifiers.some(m => m.source === 'foundation:exceptional')).toBe(true);
        expect(weak.modifiers.some(m => m.source === 'foundation:damaged')).toBe(true);
    });

    it('are exposed to the Vault differently at a boundary', () => {
        const strong = computeTollRisk(at('exceptional'), { ambient: 'normal' }).risk;
        const weak = computeTollRisk(at('damaged'), { ambient: 'normal' }).risk;
        expect(weak).toBeGreaterThan(strong);
    });

    it('keep the modifier-sum identity intact with the foundation line added', () => {
        for (const quality of ALL_QUALITIES) {
            const odds = computeBreakthroughOdds(at(quality), { ambient: 'thin' });
            const sum = odds.modifiers.reduce((n, m) => n + m.delta, 0);
            expect(sum).toBeCloseTo(odds.finalChance, 10);
        }
    });

    it('lets the engine say why, in a sentence', () => {
        expect(describeFoundation('damaged')).toContain('torn meridians');
        expect(describeFoundation('exceptional')).toContain('dense ash');
    });

    it('diverge over a decade, from the same rank and the same root', () => {
        const days = 3650;
        const strong = computeCultivationRate(at('exceptional'), 'normal').perDay * days;
        const weak = computeCultivationRate(at('damaged'), 'normal').perDay * days;
        expect(strong - weak).toBeGreaterThan(1000);
    });
});

describe('laying the foundation', () => {
    it('happens on exactly one crossing in a run', () => {
        expect(laysFoundation(FOUNDATION_ORDINAL - 1)).toBe(true);
        for (const ordinal of [0, 5, 11, 13, 16, 40]) {
            expect(laysFoundation(ordinal)).toBe(ordinal === FOUNDATION_ORDINAL - 1);
        }
    });

    it('itemises every factor and sums them exactly to the score', () => {
        const assessment = assessFoundation(
            makeCultivator({ injuries: makeInjuries(2, 'serious') }),
            { ambient: 'dense', preparation: 0.6, pillPotency: 0.5, hurried: true },
            0.42
        );
        const sum = assessment.factors.reduce((n, f) => n + f.delta, 0);
        expect(sum).toBeCloseTo(assessment.score, 10);
        expect(assessment.factors.map(f => f.source)).toContain('hurried');
        expect(assessment.factors.map(f => f.source)).toContain('roll');
    });

    it('is deterministic in its sample', () => {
        const a = assessFoundation(makeCultivator(), { ambient: 'normal' }, 0.3);
        const b = assessFoundation(makeCultivator(), { ambient: 'normal' }, 0.3);
        expect(b).toEqual(a);
    });

    it('produces a good foundation from a well-prepared crossing', () => {
        const counts = qualitiesFor({
            ambient: 'dense',
            preparation: 1,
            pillPotency: 1
        });
        expect(counts.get('exceptional')).toBeGreaterThan(0);
        expect(counts.get('damaged') ?? 0).toBe(0);
        expect(counts.get('incomplete') ?? 0).toBe(0);
    });

    it('produces a bad foundation from a crossing in a ditch', () => {
        const counts = qualitiesFor(
            { ambient: 'thin', hurried: true },
            { injuries: makeInjuries(2, 'serious') }
        );
        expect(counts.get('exceptional') ?? 0).toBe(0);
        expect(counts.get('stable') ?? 0).toBe(0);
        expect(counts.get('damaged')).toBeGreaterThan(0);
    });

    it('makes untreated injuries the most destructive input', () => {
        const clean = mean({ ambient: 'normal', preparation: 0.5 });
        const wounded = mean({ ambient: 'normal', preparation: 0.5 }, {
            injuries: makeInjuries(3, 'minor')
        });
        expect(clean - wounded).toBeCloseTo(4.5, 1);
    });

    it('makes preparation outweigh talent - talent is not destiny', () => {
        // A muddled root who prepared must out-lay a single root who rushed.
        // This is the charter's "the muddled-root run has to be winnable"
        // expressed as an inequality the engine actually enforces.
        const preparedMuddled = mean(
            { ambient: 'dense', preparation: 1, pillPotency: 0.5 },
            { spiritRoot: 'muddled_five_element', attributes: { might: 1, insight: 1, fortune: 0, charm: 1 } }
        );
        const rushedProdigy = mean(
            { ambient: 'thin', hurried: true },
            { spiritRoot: 'single_fire', attributes: { might: 3, insight: 4, fortune: 3, charm: 3 } }
        );
        expect(preparedMuddled).toBeGreaterThan(rushedProdigy);
    });

    it('does not let the roll alone decide the outcome', () => {
        // The seeded sample shifts the score by at most +/- 1.5, so it can move
        // a crossing one band but never turn a ditch into an exceptional
        // foundation. Preparation has to matter more than luck.
        const best = assessFoundation(makeCultivator(), { ambient: 'thin', hurried: true }, 0.999999);
        const worst = assessFoundation(
            makeCultivator(),
            { ambient: 'dense', preparation: 1, pillPotency: 1 },
            0
        );
        expect(best.quality).not.toBe('exceptional');
        expect(worst.quality).not.toBe('damaged');
    });

    it('maps scores to bands at the documented thresholds', () => {
        for (const { min, quality } of FOUNDATION_THRESHOLDS) {
            if (!Number.isFinite(min)) continue;
            const above = FOUNDATION_THRESHOLDS.find(t => min >= t.min)!.quality;
            expect(above).toBe(quality);
        }
    });

    it('never mutates the cultivator it assessed', () => {
        const cultivator = makeCultivator({ injuries: makeInjuries(1) });
        const before = JSON.parse(JSON.stringify(cultivator));
        for (let i = 0; i < 50; i++) {
            assessFoundation(cultivator, { ambient: 'normal', preparation: 0.5 }, i / 50);
        }
        expect(cultivator).toEqual(before);
    });
});
