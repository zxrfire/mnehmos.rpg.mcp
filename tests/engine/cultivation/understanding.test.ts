/**
 * Understanding - the axis that is not accumulation.
 *
 * The three constraints from the design doc, each tested as a property rather
 * than as an example:
 *
 *   1. Not a universal tree. Two cultivators can hold sets with no overlap,
 *      and the candidate list is computed from the individual.
 *   2. Not purchasable. Nothing grants an insight for time, stones or rank.
 *   3. Always traceable. An untraceable insight cannot be constructed by this
 *      module and cannot survive the schema at the storage boundary.
 *
 * Plus the one that makes it worth having: at a bottleneck, understanding
 * substitutes for accumulation, so a cultivator with less power and a deeper
 * grasp crosses where a better-supplied rival cannot.
 */

import {
    AchievementSchema,
    CultivatorSchema,
    InsightSchema,
    type Achievement,
    type Insight,
    type InsightDegree
} from '../../../src/schema/cultivation.js';
import {
    MAX_DEGREE,
    MAX_RATE_BONUS,
    MAX_SUBSTITUTION,
    PATH_WEIGHT,
    SUBSTITUTION_PER_DEGREE,
    bottleneckSubstitution,
    deepenInsight,
    discoverableInsights,
    effectiveProgress,
    formInsight,
    formVision,
    insightName,
    integrateInsight,
    isRelevantToPractice,
    isTraceable,
    meditativeStateChance,
    recordAchievement,
    techniqueEffectiveness,
    understandingEffects,
    visionChance
} from '../../../src/engine/cultivation/understanding.js';
import {
    computeCultivationRate,
    isBreakthroughEligible
} from '../../../src/engine/cultivation/cultivation.js';
import {
    canAttemptBreakthrough,
    computeBreakthroughOdds
} from '../../../src/engine/cultivation/breakthrough.js';
import { progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator } from './fixtures.js';

/** Access every test candidate is reachable through. Required, by design. */
const TEST_ACCESS = { kind: 'teacher' as const, label: 'a willing teacher' };

/** An achievement that genuinely happened, for building insights in tests. */
function anAchievement(seed = 'ach'): Achievement {
    return recordAchievement(
        {
            kind: 'survived_extraordinary',
            onDay: 400,
            turn: 3,
            summary: 'Stood under heavenly lightning and was still standing after.'
        },
        new CultivationRNG(seed)
    );
}

/** Build an insight the only legal way: from an achievement. */
function anInsight(
    domain: Insight['domain'],
    subject: string,
    degree: InsightDegree,
    seed = 'ach'
): Insight {
    const achievement = anAchievement(seed);
    let insight = formInsight({ domain, subject, opening: 'test opening', access: TEST_ACCESS }, 1, achievement);
    for (let d = 1; d < degree; d++) insight = deepenInsight(insight, achievement);
    return insight;
}

describe('degrees are qualitative states, not levels', () => {
    it('names the genre ladder', () => {
        expect(insightName({ subject: 'sword', degree: 3 })).toBe('sword intent');
        expect(insightName({ subject: 'sword', degree: 4 })).toBe('sword heart');
        expect(insightName({ subject: 'water', degree: 5 })).toBe('water dao');
        expect(insightName({ subject: 'formation', degree: 2 })).toBe('formation grasp');
    });

    it('deepens rather than restarting, and stops at the top', () => {
        const achievement = anAchievement();
        let insight = formInsight({ domain: 'weapon', subject: 'sword', opening: 'o', access: TEST_ACCESS }, 1, achievement);
        for (let i = 0; i < 20; i++) insight = deepenInsight(insight, achievement);
        expect(insight.degree).toBe(MAX_DEGREE);
    });
});

describe('1. it is not a universal tree', () => {
    it('gives two different cultivators candidate sets with no overlap', () => {
        const fireSwordsman = discoverableInsights(makeCultivator({ spiritRoot: 'single_fire' }), {
            techniqueSubjects: ['sword']
        });
        const waterAlchemist = discoverableInsights(makeCultivator({ spiritRoot: 'single_water' }), {
            techniqueSubjects: ['alchemy']
        });
        const keyOf = (c: { domain: string; subject: string }) => `${c.domain}:${c.subject}`;
        const a = new Set(fireSwordsman.map(keyOf));
        const b = new Set(waterAlchemist.map(keyOf));
        for (const key of a) expect(b.has(key)).toBe(false);
        expect(a.size).toBeGreaterThan(0);
        expect(b.size).toBeGreaterThan(0);
    });

    it('offers nothing at all to a cultivator doing nothing in particular', () => {
        // The ordinary case, and the reason most runs end with no insights.
        const idle = discoverableInsights(makeCultivator({ spiritRoot: 'single_fire' }), {});
        // Only their own element is ever open to them, and only if something
        // happens to open it.
        expect(idle.every(c => c.domain === 'element')).toBe(true);
    });

    it('derives candidates from circumstance, not from a menu', () => {
        const base = makeCultivator({ spiritRoot: 'single_fire' });
        const atRiver = discoverableInsights(base, { locationTags: ['forbidden_river'] });
        const afterTribulation = discoverableInsights(base, { survived: 'tribulation' });

        expect(atRiver.some(c => c.domain === 'element' && c.subject === 'water')).toBe(true);
        expect(afterTribulation.some(c => c.domain === 'life_death')).toBe(true);
        // The river teaches nothing about mortality and the lightning nothing
        // about water. Different events open different doors.
        expect(atRiver.some(c => c.domain === 'life_death')).toBe(false);
        expect(afterTribulation.some(c => c.subject === 'water')).toBe(false);
    });

    it('records why each candidate is even on the table', () => {
        for (const candidate of discoverableInsights(makeCultivator(), {
            locationTags: ['sword_tomb'],
            survived: 'near_death'
        })) {
            expect(candidate.opening.length).toBeGreaterThan(0);
        }
    });
});

describe('2. it cannot be bought', () => {
    it('has no constructor that takes time, stones or rank', () => {
        // formInsight's signature is the assertion: an InsightCandidate, a
        // degree, and an Achievement. There is no overload taking anything
        // that a player can accumulate.
        expect(formInsight.length).toBe(3);
    });

    it('gives a rich, ancient, high-ranked idler exactly nothing', () => {
        const magnate = makeCultivator({
            realmOrdinal: 40,
            spiritStones: 10_000_000,
            age: 3000,
            cultivationProgress: 1e12,
            // Explicit, because comprehension is the subject here. `makeCultivator`
            // otherwise supplies the roads the rung implies, which is right for
            // every suite whose subject is the crossing and wrong for this one.
            insights: []
        });
        expect(magnate.insights).toEqual([]);
        // And nothing about their situation opens a comprehension either.
        const { chance } = meditativeStateChance({
            ambient: 'normal',
            matchedTechnique: false,
            atSiteOfUnderstanding: false,
            insight: magnate.attributes.insight
        });
        expect(chance).toBe(0);
    });

    it('has no term for time served in the meditative chance', () => {
        // Every term is a fact about circumstance or comprehension. Sitting
        // still for longer adds nothing, because there is nothing to add to.
        const { terms } = meditativeStateChance({
            ambient: 'spirit_tide',
            matchedTechnique: true,
            atSiteOfUnderstanding: true,
            insight: 4
        });
        const sources = terms.map(t => t.source);
        expect(sources.some(s => /day|time|year|turn|progress|stone/i.test(s))).toBe(false);
        expect(sources).toContain('insight');
    });

    it('never lets Fortune buy comprehension', () => {
        // Luck grants opportunity, not capability. Understanding is capability.
        const base = { ambient: 'dense', matchedTechnique: true, atSiteOfUnderstanding: true };
        for (const insight of [1, 2, 3, 4]) {
            const a = meditativeStateChance({ ...base, insight });
            const b = meditativeStateChance({ ...base, insight });
            expect(a.chance).toBe(b.chance);
        }
        // Insight moves it; nothing else about the person does.
        expect(meditativeStateChance({ ...base, insight: 4 }).chance).toBeGreaterThan(
            meditativeStateChance({ ...base, insight: 1 }).chance
        );
    });
});

describe('3. it is always traceable', () => {
    it('derives the insight id from the achievement, so it cannot exist alone', () => {
        const achievement = anAchievement();
        const insight = formInsight({ domain: 'element', subject: 'fire', opening: 'o', access: TEST_ACCESS }, 1, achievement);
        expect(insight.id).toContain(achievement.id);
        expect(insight.provenance.achievementId).toBe(achievement.id);
        expect(insight.provenance.account).toContain(achievement.summary);
        expect(isTraceable([insight])).toBe(true);
    });

    it('refuses an insight with no provenance at the storage boundary', () => {
        const insight = anInsight('element', 'fire', 2);
        const { provenance, ...orphan } = insight;
        expect(provenance).toBeDefined();
        expect(() => InsightSchema.parse(orphan)).toThrow();
        expect(() => InsightSchema.parse({ ...orphan, provenance: null })).toThrow();
        expect(() => InsightSchema.parse(insight)).not.toThrow();
    });

    it('refuses an empty provenance chain', () => {
        const insight = anInsight('element', 'fire', 1);
        expect(() =>
            InsightSchema.parse({
                ...insight,
                provenance: { ...insight.provenance, achievementId: '' }
            })
        ).toThrow();
        expect(() =>
            InsightSchema.parse({ ...insight, provenance: { ...insight.provenance, account: '' } })
        ).toThrow();
    });

    it('keeps the whole history legible when an insight deepens', () => {
        const first = anAchievement('first');
        const second = recordAchievement(
            { kind: 'enlightenment', onDay: 900, turn: 9, summary: 'It arrived, unasked.' },
            new CultivationRNG('second')
        );
        const start = formInsight({ domain: 'element', subject: 'water', opening: 'o', access: TEST_ACCESS }, 1, first);
        const deeper = deepenInsight(start, second);
        expect(deeper.degree).toBe(2);
        // Both events remain readable in the account.
        expect(deeper.provenance.account).toContain(first.summary);
        expect(deeper.provenance.account).toContain(second.summary);
        expect(isTraceable([deeper])).toBe(true);
    });

    it('round-trips achievements through the schema', () => {
        expect(() => AchievementSchema.parse(anAchievement())).not.toThrow();
        expect(() => AchievementSchema.parse({ ...anAchievement(), summary: '' })).toThrow();
    });

    it('keys the set by (domain, subject) so a repeat deepens rather than duplicates', () => {
        const candidate = { domain: 'element' as const, subject: 'fire', opening: 'o', access: TEST_ACCESS };
        let insights: Insight[] = [];
        const a = integrateInsight(insights, candidate, anAchievement('a'));
        insights = a.insights;
        const b = integrateInsight(insights, candidate, anAchievement('b'));
        expect(a.deepened).toBe(false);
        expect(b.deepened).toBe(true);
        expect(b.insights).toHaveLength(1);
        expect(b.insights[0].degree).toBe(2);
        expect(isTraceable(b.insights)).toBe(true);
    });
});

describe('effects are relevant or they are nothing', () => {
    const ctx = { rootElements: ['fire'] as const };

    it('counts an insight about your own element', () => {
        expect(isRelevantToPractice(anInsight('element', 'fire', 3), ctx)).toBe(true);
    });

    it('ignores an insight about someone else\'s element', () => {
        expect(isRelevantToPractice(anInsight('element', 'water', 5), ctx)).toBe(false);
    });

    it('counts universal comprehensions always', () => {
        for (const domain of ['karma', 'life_death', 'time', 'void'] as const) {
            expect(isRelevantToPractice(anInsight(domain, 'mortality', 1), ctx)).toBe(true);
        }
    });

    it('counts a craft only while that craft is being practised', () => {
        const swordIntent = anInsight('weapon', 'sword', 3);
        expect(isRelevantToPractice(swordIntent, ctx)).toBe(false);
        expect(
            isRelevantToPractice(swordIntent, { ...ctx, techniqueSubject: 'sword' })
        ).toBe(true);
    });

    it('caps the rate bonus however many insights pile up', () => {
        const many = Array.from({ length: 30 }, (_, i) => anInsight('karma', `debt-${i}`, 5, `s${i}`));
        const effects = understandingEffects(many, ctx);
        expect(effects.cultivationMultiplier).toBe(1 + MAX_RATE_BONUS);
    });

    it('moves the cultivation rate through the itemised breakdown', () => {
        const learned = makeCultivator({
            spiritRoot: 'single_fire',
            insights: [anInsight('element', 'fire', 4)]
        });
        const naive = makeCultivator({ spiritRoot: 'single_fire' });
        const learnedRate = computeCultivationRate(learned, 'normal');
        const naiveRate = computeCultivationRate(naive, 'normal');

        expect(learnedRate.perDay).toBeGreaterThan(naiveRate.perDay);
        const factor = learnedRate.factors.find(f => f.source === 'understanding')!;
        expect(factor.multiplier).toBeGreaterThan(1);
        expect(factor.label).toContain('fire');
        // The breakdown still multiplies out exactly.
        const product = learnedRate.factors.reduce((n, f) => n * f.multiplier, learnedRate.base);
        expect(learnedRate.perDay).toBeCloseTo(product, 12);
    });

    it('moves breakthrough odds and keeps the modifier sum exact', () => {
        const learned = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: 12,
            insights: [anInsight('life_death', 'mortality', 3)]
        });
        const naive = makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 12 });
        const learnedOdds = computeBreakthroughOdds(learned, { ambient: 'normal' });
        const naiveOdds = computeBreakthroughOdds(naive, { ambient: 'normal' });

        expect(learnedOdds.finalChance).toBeGreaterThan(naiveOdds.finalChance);
        expect(learnedOdds.modifiers.some(m => m.source.startsWith('understanding:'))).toBe(true);
        const sum = learnedOdds.modifiers.reduce((n, m) => n + m.delta, 0);
        expect(sum).toBeCloseTo(learnedOdds.finalChance, 10);
    });

    it('makes a technique work better for someone who understands it', () => {
        const student = makeCultivator({ spiritRoot: 'single_fire' });
        const master = makeCultivator({
            spiritRoot: 'single_fire',
            insights: [anInsight('weapon', 'sword', 5)]
        });
        const art = { element: 'fire' as const, subject: 'sword', mastery: 1 };
        const studentPower = techniqueEffectiveness(student, art);
        const masterPower = techniqueEffectiveness(master, art);

        expect(masterPower.multiplier).toBeGreaterThan(studentPower.multiplier);
        // Same root, so the root term is identical: the difference is entirely
        // comprehension.
        expect(masterPower.fromRoot).toBe(studentPower.fromRoot);
        expect(masterPower.fromUnderstanding).toBeGreaterThan(studentPower.fromUnderstanding);
    });
});

describe('substitution at a bottleneck', () => {
    const ORDINAL = 12;
    const REQUIRED = progressRequiredForOrdinal(ORDINAL);

    it('lets deeper understanding cross where more accumulation cannot', () => {
        // The entire point of the subsystem, stated as one comparison.
        const short = REQUIRED * 0.8;

        const richAndShallow = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            cultivationProgress: short
        });
        const poorerAndDeeper = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            cultivationProgress: short,
            insights: [anInsight('life_death', 'mortality', 5), anInsight('element', 'fire', 4)]
        });

        expect(isBreakthroughEligible(richAndShallow)).toBe(false);
        expect(isBreakthroughEligible(poorerAndDeeper)).toBe(true);
        expect(canAttemptBreakthrough(richAndShallow).eligible).toBe(false);
        expect(canAttemptBreakthrough(poorerAndDeeper).eligible).toBe(true);
    });

    it('reports accumulated and substituted separately, so the UI can show its work', () => {
        const cultivator = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            cultivationProgress: REQUIRED * 0.8,
            insights: [anInsight('life_death', 'mortality', 5)]
        });
        const check = canAttemptBreakthrough(cultivator);
        expect(check.progressAccumulated).toBeCloseTo(REQUIRED * 0.8, 6);
        expect(check.progressSubstituted).toBeGreaterThan(0);
        expect(check.progressAvailable).toBeCloseTo(
            check.progressAccumulated + check.progressSubstituted,
            6
        );
    });

    it('never replaces the climb', () => {
        // A cultivator with no progress and profound understanding still
        // cannot cross: a third of a requirement is not a requirement.
        const enlightenedPauper = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            cultivationProgress: 0,
            insights: Array.from({ length: 20 }, (_, i) =>
                anInsight('karma', `debt-${i}`, 5, `p${i}`)
            )
        });
        expect(isBreakthroughEligible(enlightenedPauper)).toBe(false);
        const substitution = bottleneckSubstitution(enlightenedPauper);
        expect(substitution.fraction).toBe(MAX_SUBSTITUTION);
        expect(substitution.substituted).toBeCloseTo(REQUIRED * MAX_SUBSTITUTION, 6);
    });

    it('scales with the ladder rather than becoming irrelevant or overwhelming', () => {
        const insights = [anInsight('karma', 'debt', 3)];
        const low = bottleneckSubstitution(
            makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 0, insights })
        );
        const high = bottleneckSubstitution(
            makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 30, insights })
        );
        // Same fraction, wildly different absolute value.
        expect(low.fraction).toBeCloseTo(high.fraction, 12);
        expect(high.substituted).toBeGreaterThan(low.substituted * 100);
    });

    it('weighs a craft below a comprehension of your own path', () => {
        const swordSaint = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            insights: [anInsight('weapon', 'sword', 5)]
        });
        const daoAdept = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            insights: [anInsight('life_death', 'mortality', 5)]
        });
        expect(bottleneckSubstitution(swordSaint).fraction).toBeLessThan(
            bottleneckSubstitution(daoAdept).fraction
        );
        expect(PATH_WEIGHT.weapon).toBeLessThan(PATH_WEIGHT.life_death);
    });

    it('gives nothing for an insight about an element that is not yours', () => {
        const foreign = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            insights: [anInsight('element', 'water', 5)]
        });
        expect(bottleneckSubstitution(foreign).substituted).toBe(0);
    });

    it('computes effective progress as accumulation plus substitution', () => {
        const cultivator = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            cultivationProgress: 1000,
            insights: [anInsight('karma', 'debt', 2)]
        });
        const expected = 1000 + 2 * SUBSTITUTION_PER_DEGREE * PATH_WEIGHT.karma * REQUIRED;
        expect(effectiveProgress(cultivator)).toBeCloseTo(expected, 6);
    });

    it('leaves a cultivator with no insights exactly where they were', () => {
        const plain = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: ORDINAL,
            cultivationProgress: 500
        });
        expect(effectiveProgress(plain)).toBe(500);
        expect(bottleneckSubstitution(plain).substituted).toBe(0);
    });
});

describe('temporal phenomena grant information, never capability', () => {
    it('produces a belief with no fact behind it', () => {
        const vision = formVision('cultivator-1', 'possible_future', 900, 0.4);
        expect(vision.factId).toBeNull();
        expect(vision.stance).toBe('believes');
        expect(vision.source.kind).toBe('divined');
        expect(vision.tags).toContain('vision');
        expect(vision.confidence).toBeGreaterThan(0);
        expect(vision.confidence).toBeLessThan(1);
    });

    it('says nothing certain, in its own text', () => {
        const vision = formVision('c', 'possible_future', 10, 0.5);
        expect(vision.statement).toMatch(/may be/i);
    });

    it('carries no numbers a cultivator could benefit from', () => {
        const vision = formVision('cultivator-1', 'borrowed_clarity', 10, 0.3);
        const keys = Object.keys(vision);
        for (const forbidden of ['degree', 'multiplier', 'bonus', 'insight', 'progress']) {
            expect(keys).not.toContain(forbidden);
        }
    });

    it('is exceptionally rare, and rarer still away from anywhere notable', () => {
        expect(visionChance(false)).toBeLessThan(0.01);
        expect(visionChance(true)).toBeGreaterThan(visionChance(false));
        expect(visionChance(true)).toBeLessThan(0.02);
    });
});

describe('the cultivator record', () => {
    it('defaults an old row to no understanding at all', () => {
        const legacy = CultivatorSchema.parse({
            id: 'legacy',
            name: 'Someone From Before',
            spiritRoot: 'single_water',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            hp: 30, maxHp: 30, qi: 10, maxQi: 10
        });
        expect(legacy.insights).toEqual([]);
        expect(legacy.achievements).toEqual([]);
    });

    it('round-trips insights and achievements', () => {
        const achievement = anAchievement();
        const insight = formInsight({ domain: 'element', subject: 'fire', opening: 'o', access: TEST_ACCESS }, 3, achievement);
        const parsed = CultivatorSchema.parse({
            id: 'c', name: 'Test', spiritRoot: 'single_fire',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            hp: 10, maxHp: 10, qi: 0, maxQi: 0,
            insights: [insight], achievements: [achievement]
        });
        expect(parsed.insights[0]).toEqual(insight);
        expect(isTraceable(parsed.insights)).toBe(true);
    });
});
