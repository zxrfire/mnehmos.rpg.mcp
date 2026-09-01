/**
 * The top of the ladder, recalibrated - and the arithmetic that says the world
 * should contain what it contains.
 *
 * `ceiling.test.ts` next door answers "is the top reachable, and by whom". This
 * file answers the question that came after it: reachable HOW OFTEN, and does
 * that rate produce the one False Immortal and the handful of Tribulation
 * Transcendence cultivators the setting actually has standing in it.
 *
 * The four things pinned here are the four that moved:
 *
 *   1. A realm boundary has its own ceiling and the last crossing does not.
 *   2. Of crossings that survive the lightning, three in four do not go
 *      through, so False Immortals outnumber True ones three to one.
 *   3. A failed last crossing costs the whole price, which makes it one shot.
 *   4. False Immortals are a RESIDENCE count, not a production count, and the
 *      thing that keeps it at one to three is that they leave.
 */

import { CultivationRNG, forStream } from '../../../src/engine/cultivation/rng.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    LAST_CROSSING_TAX,
    CROSSING_TAX,
    TRUE_IMMORTAL_ORDINAL,
    isRealmBoundary,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName
} from '../../../src/engine/cultivation/realms.js';
import {
    FAILURE_TABLE,
    LAST_CROSSING_PROGRESS_LOSS,
    LIFESPAN_PRESSURE_ONSET,
    MAX_BOUNDARY_CHANCE,
    MAX_BREAKTHROUGH_CHANCE,
    MAX_COMPLETION_CHANCE,
    MAX_LIFESPAN_PRESSURE,
    assessLastCrossing,
    attemptBreakthrough,
    canAttemptBreakthrough,
    completionChance,
    computeBreakthroughOdds,
    lifespanPressure,
    maxChanceFor
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    MAX_SCAR_RATE_ATTRITION,
    SCAR_PLATEAU,
    scarRateMultiplier,
    scarTempering,
    treatWorstInjuries
} from '../../../src/engine/cultivation/injuries.js';
import { computeCultivationRate } from '../../../src/engine/cultivation/cultivation.js';
import { formInsight, recordAchievement } from '../../../src/engine/cultivation/understanding.js';
import { SPIRIT_ROOTS, WEIGHT_TOTAL } from '../../../src/engine/cultivation/spirit-roots.js';
import {
    CULTIVATOR_POPULATION,
    BELIEVED_REACH,
    FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS,
    immortalStock,
    measureLadderReach
} from '../../../src/engine/world/ladder-odds.js';
import { stagnationYearsForOrdinal, type Injury, type Insight } from '../../../src/schema/cultivation.js';
import { makeCultivator } from './fixtures.js';

// ─────────────────────────────────────────────────────────────────────────
// A PERFECT LIFE, RUN MANY TIMES
// The same conditions the playtest's reachability sweep uses: the best root,
// the best draw the schema allows, a sealed vein, an exceptional foundation,
// deep comprehension, a pill on every attempt and every wound treated.
// ─────────────────────────────────────────────────────────────────────────

function deepInsights(): Insight[] {
    const a = recordAchievement(
        { kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' },
        new CultivationRNG('insight')
    );
    const access = { kind: 'teacher' as const, label: 'a teacher' };
    return [
        formInsight({ domain: 'life_death', subject: 'mortality', opening: 'o', access }, 5, a),
        formInsight({ domain: 'karma', subject: 'debt', opening: 'o', access }, 5, a),
        formInsight({ domain: 'void', subject: 'the seam', opening: 'o', access }, 4, a)
    ];
}

type Landing = 'true_immortal' | 'false_immortal' | 'dead' | 'stranded' | 'never_attempted' | 'stopped_below';

interface PerfectLife {
    peak: number;
    landing: Landing;
    attemptedCrossing: boolean;
}

const PERFECT = {
    attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
    root: 'single_fire' as const,
    ambient: 'sealed_vein' as const
};

function perfectLife(seed: string): PerfectLife {
    let ordinal = 0;
    let progress = 0;
    let age = 16;
    let yearsAtRank = 0;
    let peak = 0;
    let attempt = 0;
    let attemptedCrossing = false;
    const injuries: Injury[] = [];
    const insights = deepInsights();

    for (let guard = 0; guard < 4000; guard++) {
        const required = progressRequiredForOrdinal(ordinal);
        if (required === null) break;

        const rate = computeCultivationRate(
            { spiritRoot: PERFECT.root, injuries, insights, foundationQuality: 'exceptional' },
            PERFECT.ambient,
            { focusMultiplier: 1, techniqueBonus: 1.3, sectBonus: 1.2 }
        ).perDay;
        if (rate <= 0) return { peak, landing: landingAt(ordinal, attemptedCrossing), attemptedCrossing };

        const subject = makeCultivator({
            realmOrdinal: ordinal,
            cultivationProgress: progress,
            spiritRoot: PERFECT.root,
            attributes: PERFECT.attributes,
            injuries,
            insights,
            foundationQuality: 'exceptional',
            age
        });
        // Understanding stands in for part of the price, exactly as it does for
        // every real caller. Costing the rung at its full sticker price instead
        // makes the settling clock bind about half a realm early.
        const substituted = canAttemptBreakthrough(subject).progressSubstituted;
        const need = Math.max(0, required - substituted - progress);
        const years = Math.max(1 / 365, need / (rate * 365));
        if (yearsAtRank + years >= stagnationYearsForOrdinal(ordinal)) {
            return { peak, landing: landingAt(ordinal, attemptedCrossing), attemptedCrossing };
        }
        if (age + years >= lifespanForOrdinal(ordinal)) return { peak, landing: 'dead', attemptedCrossing };
        age += years;
        yearsAtRank += years;
        progress += need;

        if (ordinal === LAST_CROSSING_ORDINAL) attemptedCrossing = true;

        const r = attemptBreakthrough(
            { ...subject, cultivationProgress: progress, age },
            {
                rng: forStream(seed, 'crossing', attempt++),
                ambient: PERFECT.ambient,
                turn: Math.floor(age),
                pill: { name: 'p', potency: 0.35 },
                toll: { candidates: [] }
            }
        );
        progress = Math.max(0, progress - r.progressConsumed);
        for (const j of r.injuriesSustained) injuries.push(j);
        const healed = treatWorstInjuries(injuries, injuries.length);
        injuries.length = 0;
        injuries.push(...healed.injuries);

        if (r.outcome === 'death') return { peak, landing: 'dead', attemptedCrossing };
        if (r.outcome === 'false_immortal') {
            return { peak: r.toOrdinal, landing: 'false_immortal', attemptedCrossing };
        }
        if (r.outcome === 'success') {
            ordinal = r.toOrdinal;
            peak = Math.max(peak, ordinal);
            yearsAtRank = 0;
            if (ordinal >= TRUE_IMMORTAL_ORDINAL) {
                return { peak, landing: 'true_immortal', attemptedCrossing };
            }
        }
    }
    return { peak, landing: landingAt(ordinal, attemptedCrossing), attemptedCrossing };
}

/** Alive, stopped. Which kind of stopped depends on where and whether they tried. */
function landingAt(ordinal: number, attempted: boolean): Landing {
    if (ordinal < LAST_CROSSING_ORDINAL) return 'stopped_below';
    return attempted ? 'stranded' : 'never_attempted';
}

/** One sweep, shared by every test that reads the distribution. */
const LIVES = 900;
const sweep = (() => {
    const lives = Array.from({ length: LIVES }, (_, i) => perfectLife(`perfect-${i}`));
    const count = (l: Landing) => lives.filter(x => x.landing === l).length;
    return {
        lives,
        trueImmortal: count('true_immortal'),
        falseImmortal: count('false_immortal'),
        dead: count('dead'),
        stranded: count('stranded'),
        neverAttempted: count('never_attempted'),
        stoppedBelow: count('stopped_below'),
        reachedLastRung: lives.filter(x => x.peak >= LAST_CROSSING_ORDINAL).length,
        attempted: lives.filter(x => x.attemptedCrossing).length
    };
})();

// ─────────────────────────────────────────────────────────────────────────

describe('a realm boundary has its own ceiling', () => {
    it('caps a boundary strictly below an ordinary rung, for anybody', () => {
        expect(MAX_BOUNDARY_CHANCE).toBeLessThan(MAX_BREAKTHROUGH_CHANCE);
        for (let ordinal = 0; ordinal < LAST_CROSSING_ORDINAL; ordinal++) {
            expect(maxChanceFor(ordinal)).toBe(
                isRealmBoundary(ordinal) ? MAX_BOUNDARY_CHANCE : MAX_BREAKTHROUGH_CHANCE
            );
        }
    });

    it('binds on the best-prepared cultivator the schema can express', () => {
        // Everything stacked: the raw sum clears 1.0 before the base is counted,
        // which is exactly the situation the cap exists for.
        for (const ordinal of [12, 16, 20, 24, 28, 32, 36, 40]) {
            const odds = computeBreakthroughOdds(
                makeCultivator({
                    realmOrdinal: ordinal,
                    spiritRoot: PERFECT.root,
                    attributes: PERFECT.attributes,
                    foundationQuality: 'exceptional',
                    insights: deepInsights()
                }),
                { ambient: 'sealed_vein', pill: { name: 'p', potency: 0.35 } }
            );
            expect(odds.finalChance, `${rankName(ordinal)} exceeded the boundary ceiling`)
                .toBeLessThanOrEqual(MAX_BOUNDARY_CHANCE);
            expect(odds.modifiers.some(m => m.source === 'clamp:ceiling')).toBe(true);
        }
    });

    it('exempts the last crossing, where the wall is the price and not the roll', () => {
        expect(isRealmBoundary(LAST_CROSSING_ORDINAL)).toBe(true);
        expect(maxChanceFor(LAST_CROSSING_ORDINAL)).toBe(MAX_BREAKTHROUGH_CHANCE);
        // And nothing clamps it: the fully prepared summon lands on its own
        // arithmetic rather than on a ceiling, which is what "the danger here
        // is the lightning and the seam" has to mean mechanically.
        const odds = computeBreakthroughOdds(
            makeCultivator({
                realmOrdinal: LAST_CROSSING_ORDINAL,
                spiritRoot: PERFECT.root,
                attributes: PERFECT.attributes,
                foundationQuality: 'exceptional',
                insights: deepInsights()
            }),
            { ambient: 'sealed_vein', pill: { name: 'p', potency: 0.35 } }
        );
        expect(odds.modifiers.some(m => m.source.startsWith('clamp'))).toBe(false);
        expect(odds.modifiers.some(m => m.source === 'last_crossing_strain')).toBe(true);
    });

    it('leaves perfect conditions favourable, which is the point of not going lower', () => {
        // The rarity of an immortal is supposed to live in how few people ever
        // get these conditions, not in the roll. A best-case life still ends
        // above the Lid a large fraction of the time.
        const aboveTheLid = sweep.trueImmortal + sweep.falseImmortal;
        expect(aboveTheLid / LIVES).toBeGreaterThan(0.3);
        // And it is no longer the corridor it was: at the old single ceiling
        // this figure was 0.73.
        expect(aboveTheLid / LIVES).toBeLessThan(0.65);
    });
});

describe('the crossing punishes more than it rewards', () => {
    it('caps completion at a quarter, so the seam is the hard part', () => {
        expect(MAX_COMPLETION_CHANCE).toBeLessThanOrEqual(0.25);
        const best = completionChance(
            { injuries: [], foundationQuality: 'exceptional' },
            'sealed_vein',
            0
        );
        expect(best.chance).toBe(MAX_COMPLETION_CHANCE);
    });

    it('lands three False Immortals for every True one', () => {
        const landings = sweep.trueImmortal + sweep.falseImmortal;
        expect(landings, 'no crossing landed at all - the sweep is not testing anything')
            .toBeGreaterThan(30);
        const trueShare = sweep.trueImmortal / landings;
        // 1 in 4 by construction; the band is sampling noise at this size.
        expect(trueShare).toBeGreaterThan(0.16);
        expect(trueShare).toBeLessThan(0.34);
    });

    it('kills more of the people who lose their grip on it than any other rung', () => {
        const deathShare = (t: { deviation: number }) => 1 - t.deviation;
        expect(deathShare(FAILURE_TABLE.lastCrossing))
            .toBeGreaterThan(deathShare(FAILURE_TABLE.boundary));
        expect(deathShare(FAILURE_TABLE.boundary))
            .toBeGreaterThan(deathShare(FAILURE_TABLE.subRank));
    });

    it('burns the whole price on a failure, which makes it one shot', () => {
        expect(LAST_CROSSING_PROGRESS_LOSS).toBe(1);
        const required = progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)!;
        // Walk seeds until one fails the summon rather than reaching the sky.
        let sawFailure = false;
        for (let i = 0; i < 200 && !sawFailure; i++) {
            const r = attemptBreakthrough(
                makeCultivator({
                    realmOrdinal: LAST_CROSSING_ORDINAL,
                    cultivationProgress: required,
                    spiritRoot: PERFECT.root,
                    attributes: PERFECT.attributes,
                    foundationQuality: 'exceptional'
                }),
                { rng: forStream('one-shot', i), ambient: 'thin', turn: 1, toll: { candidates: [] } }
            );
            if (r.outcome === 'success' || r.outcome === 'false_immortal') continue;
            sawFailure = true;
            expect(r.progressConsumed).toBe(required);
        }
        expect(sawFailure, 'never sampled a failed summon').toBe(true);
    });

    it('prices the last rung above every wall below it', () => {
        expect(LAST_CROSSING_TAX).toBeGreaterThan(CROSSING_TAX);
        const price = progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)!;
        const below = progressRequiredForOrdinal(LAST_CROSSING_ORDINAL - 1)!;
        // Not "the next rung up" - a different order of expense.
        expect(price / below).toBeGreaterThan(3);
    });
});

describe('reaching the last rung is not the same as attempting the crossing', () => {
    it('leaves a real share of arrivals unable to pay the price at all', () => {
        expect(sweep.reachedLastRung).toBeGreaterThan(0);
        expect(sweep.neverAttempted).toBeGreaterThan(0);
        // The commonest reason is arithmetic and it is legible: the price is
        // most of what the rung's settling clock allows, so a cultivator who
        // arrived worn never gathers it.
        const priced = progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)!;
        const cleanRate = computeCultivationRate(
            { spiritRoot: PERFECT.root, injuries: [], insights: deepInsights(), foundationQuality: 'exceptional' },
            PERFECT.ambient,
            { focusMultiplier: 1, techniqueBonus: 1.3, sectBonus: 1.2 }
        ).perDay;
        const substituted = canAttemptBreakthrough({
            realmOrdinal: LAST_CROSSING_ORDINAL,
            cultivationProgress: 0,
            spiritRoot: PERFECT.root,
            insights: deepInsights(),
            alive: true
        }).progressSubstituted;
        const yearsAtBest = (priced - substituted) / (cleanRate * 365);
        const clock = stagnationYearsForOrdinal(LAST_CROSSING_ORDINAL);
        expect(yearsAtBest).toBeLessThan(clock);
        expect(yearsAtBest / clock).toBeGreaterThan(0.75);
    });

    it('offers the decision as an assessment rather than deciding it', () => {
        const ready = makeCultivator({
            realmOrdinal: LAST_CROSSING_ORDINAL,
            cultivationProgress: progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)!,
            spiritRoot: PERFECT.root,
            attributes: PERFECT.attributes,
            foundationQuality: 'exceptional',
            insights: deepInsights(),
            age: 40_000
        });
        const a = assessLastCrossing(ready, 'sealed_vein', { pill: { name: 'p', potency: 0.35 } });
        expect(a.attemptable).toBe(true);
        expect(a.strikes).toBeGreaterThan(0);
        // Four endings, and nothing else can happen.
        const total =
            a.trueImmortalChance + a.falseImmortalChance + a.deathChance + a.strandedChance;
        expect(total).toBeCloseTo(1, 6);
        expect(a.falseImmortalChance).toBeGreaterThan(a.trueImmortalChance);
        expect(a.yearsRemaining).toBe(lifespanForOrdinal(LAST_CROSSING_ORDINAL) - 40_000);
        expect(a.verdict).toBe('as_ready_as_anyone_gets');
    });

    it('reports "not yet priced" rather than pretending the attempt is legal', () => {
        const broke = makeCultivator({
            realmOrdinal: LAST_CROSSING_ORDINAL,
            cultivationProgress: 0,
            spiritRoot: PERFECT.root,
            attributes: PERFECT.attributes
        });
        const a = assessLastCrossing(broke, 'thin');
        expect(a.attemptable).toBe(false);
        expect(a.verdict).toBe('not_yet_priced');
    });

    it('tells a worn, late cultivator that striking is a way of choosing how to die', () => {
        const wornInjuries = treatWorstInjuries(makeScars(30), 30).injuries;
        const worn = makeCultivator({
            realmOrdinal: LAST_CROSSING_ORDINAL,
            cultivationProgress: progressRequiredForOrdinal(LAST_CROSSING_ORDINAL)!,
            spiritRoot: 'muddled_five_element',
            attributes: { might: 1, insight: 1, fortune: 0, charm: 1 },
            injuries: wornInjuries,
            age: 96_000
        });
        const a = assessLastCrossing(worn, 'thin');
        expect(a.verdict).toBe('hopeless');
        expect(a.deathChance).toBeGreaterThan(a.trueImmortalChance);
    });

    it('says nothing to somebody who is not standing there', () => {
        expect(assessLastCrossing(makeCultivator({ realmOrdinal: 20 }), 'thin').verdict)
            .toBe('not_at_the_rung');
        expect(
            assessLastCrossing(
                makeCultivator({
                    realmOrdinal: FALSE_IMMORTAL_ORDINAL,
                    immortalStatus: 'false_immortal'
                }),
                'thin'
            ).verdict
        ).toBe('not_at_the_rung');
    });
});

describe('the clock is a modifier, not a decision', () => {
    it('is nothing at all until half a span is gone', () => {
        const ordinal = LAST_CROSSING_ORDINAL;
        const span = lifespanForOrdinal(ordinal);
        expect(lifespanPressure(ordinal, 0)).toBe(0);
        expect(lifespanPressure(ordinal, span * LIFESPAN_PRESSURE_ONSET)).toBe(0);
        expect(lifespanPressure(ordinal, span * 0.75)).toBeLessThan(0);
        expect(lifespanPressure(ordinal, span)).toBeCloseTo(MAX_LIFESPAN_PRESSURE, 6);
    });

    it('reads an unknown age as no pressure rather than the worst case', () => {
        // Half the callers in this engine legitimately do not carry an age.
        expect(lifespanPressure(20, undefined)).toBe(0);
        expect(lifespanPressure(20, Number.NaN)).toBe(0);
    });

    it('shows itself in the modifier list when it bites', () => {
        const late = makeCultivator({ realmOrdinal: 20, age: 480 });
        const odds = computeBreakthroughOdds(late, { ambient: 'normal', pill: null });
        expect(odds.modifiers.some(m => m.source === 'lifespan_pressure')).toBe(true);
        const sum = odds.modifiers.reduce((n, m) => n + m.delta, 0);
        expect(sum).toBeCloseTo(odds.finalChance, 9);
    });
});

describe('scars pay, and then they cost', () => {
    it('leaves the first few closed wounds a pure return on having healed', () => {
        const injuries = treatWorstInjuries(makeScars(SCAR_PLATEAU), SCAR_PLATEAU).injuries;
        const t = scarTempering(injuries);
        expect(t.scars).toBe(SCAR_PLATEAU);
        expect(t.wornScars).toBe(0);
        expect(t.rateAttrition).toBe(0);
        expect(t.netBreakthroughModifier).toBeGreaterThan(0);
    });

    it('turns negative for a cultivator who bought their rank with their meridians', () => {
        const many = treatWorstInjuries(makeScars(SCAR_PLATEAU + 20), SCAR_PLATEAU + 20).injuries;
        const t = scarTempering(many);
        expect(t.wornScars).toBe(20);
        expect(t.rateAttrition).toBe(MAX_SCAR_RATE_ATTRITION);
        expect(t.netBreakthroughModifier).toBeLessThan(0);
        expect(scarRateMultiplier(many)).toBeCloseTo(1 - MAX_SCAR_RATE_ATTRITION, 9);
    });

    it('never inverts a rate, however long the life was', () => {
        expect(MAX_SCAR_RATE_ATTRITION).toBeLessThan(1);
        const ruined = treatWorstInjuries(makeScars(400), 400).injuries;
        expect(scarRateMultiplier(ruined)).toBeGreaterThan(0);
    });

    it('leaves open wounds priced exactly where they were', () => {
        // The ratchet is untouched: attrition counts CLOSED wounds only.
        const open = makeScars(30);
        expect(scarTempering(open).wornScars).toBe(0);
        expect(scarRateMultiplier(open)).toBe(1);
    });
});

function makeScars(n: number): Injury[] {
    const rng = new CultivationRNG('scars');
    return Array.from({ length: n }, (_, i) => ({
        id: rng.uuid(),
        severity: 'serious' as const,
        source: 'failed_breakthrough' as const,
        description: 'A serious meridian injury, torn by a failed breakthrough.',
        sustainedOnTurn: i,
        treated: false,
        cultivationPenalty: 0.2,
        breakthroughPenalty: 0.1
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE WORLD SHOULD CONTAIN
// ─────────────────────────────────────────────────────────────────────────

describe('False Immortals are a residence count', () => {
    it('keeps one to three of them standing about, at the measured landing split', () => {
        const stock = immortalStock({
            trueImmortal: sweep.trueImmortal,
            falseImmortal: sweep.falseImmortal,
            dead: sweep.dead,
            stranded: sweep.stranded
        });
        expect(stock.expectedResident).toBeGreaterThan(0.5);
        expect(stock.expectedResident).toBeLessThan(3.5);
    });

    it('only works because they leave, which is the whole mechanism', () => {
        // The same production rate against a residence measured in their actual
        // span rather than in how long they stay gives a crowd, and the setting
        // has one. Departure is not flavour; it is what makes the count work.
        const landings = { trueImmortal: 1, falseImmortal: 3, dead: 1, stranded: 1 };
        const leaving = immortalStock(landings);
        const staying = immortalStock(landings, { meanResidenceYears: 300_000 });
        expect(leaving.expectedResident).toBeLessThan(4);
        expect(staying.expectedResident).toBeGreaterThan(100);
        expect(FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS).toBeLessThan(1000);
    });

    it('produces completions at a rate the dated record can carry', () => {
        const stock = immortalStock({
            trueImmortal: sweep.trueImmortal,
            falseImmortal: sweep.falseImmortal,
            dead: sweep.dead,
            stranded: sweep.stranded
        });
        // Six datable completions in four and a half thousand years, give or
        // take what the courts did not hear about.
        const overTheRecord = stock.trueImmortalsPerMillennium * 4.4;
        expect(overTheRecord).toBeGreaterThan(2);
        expect(overTheRecord).toBeLessThan(20);
    });
});

describe('what the mountains believe', () => {
    it('counts rather than divides once a share stops meaning anything', () => {
        const counted = BELIEVED_REACH.filter(b => b.statedAs === 'headcount');
        expect(counted.length).toBeGreaterThan(4);
        for (const row of counted) {
            expect(row.approximateCount).not.toBeNull();
            expect(row.approximateShare).toBeCloseTo(row.approximateCount! / CULTIVATOR_POPULATION, 12);
        }
    });

    it('no longer quotes a figure that needs a population the world does not have', () => {
        // The old table put Tribulation Transcendence at two per billion, which
        // needs three and a half billion cultivators to describe one person.
        for (const row of BELIEVED_REACH) {
            if (row.approximateShare === 0) continue;
            expect(
                row.approximateShare * CULTIVATOR_POPULATION,
                `${row.name} rounds to nobody against the world's own population`
            ).toBeGreaterThanOrEqual(1);
        }
    });

    it('stays monotone down the ladder, because belief is not that wrong', () => {
        for (let i = 1; i < BELIEVED_REACH.length; i++) {
            expect(BELIEVED_REACH[i].approximateShare)
                .toBeLessThanOrEqual(BELIEVED_REACH[i - 1].approximateShare);
        }
    });
});

describe('the population curve is a different shape from the prodigy curve', () => {
    it('produces nobody at the top of the ladder, at any ordinary density', () => {
        // The sweep above is P(outcome | everything went right). This is the
        // unconditional figure, and it is zero: an ordinarily-rolled cultivator
        // in ordinary qi does not reach Void Refinement, let alone the last
        // realm. That is the Late Age working, and it is why the five to eight
        // people standing at Tribulation Transcendence in the present day are
        // CONTENT - named, placed, mostly sealed or withdrawn - rather than a
        // product of this curve. Reading the prodigy sweep as a population rate
        // is the single easiest way to misread the balance of this engine.
        for (const ambient of ['thin', 'normal', 'dense'] as const) {
            const measured = measureLadderReach(`unconditional-${ambient}`, {
                sampleSize: 600,
                ambient
            });
            const tribulation = measured.tiers.find(t => t.realm === 'tribulation_transcendence')!;
            const voidRefinement = measured.tiers.find(t => t.realm === 'void_refinement')!;
            expect(tribulation.share, `${ambient} put somebody at the last realm`).toBe(0);
            expect(voidRefinement.share).toBe(0);
        }
    });


    it('deals about a third of everybody a root that cannot pass ordinal 32', () => {
        // Not a probability - a table. Triple, quad and muddled roots are hard
        // ceilings, which is why the average cultivator never arrives at the
        // top of the ladder at all and why the prodigy sweep says nothing about
        // the population.
        const capped = SPIRIT_ROOTS
            .filter(r => r.grade === 'triple' || r.grade === 'quad' || r.grade === 'muddled')
            .reduce((n, r) => n + r.weight, 0);
        const share = capped / WEIGHT_TOTAL;
        expect(share).toBeGreaterThan(0.3);
        expect(share).toBeLessThan(0.42);
    });
});
