/**
 * Fortune: luck generates opportunity, not success.
 *
 * This file exists to pin down a rule that is easy to state and very easy to
 * quietly violate:
 *
 *   Fortune may influence WHICH of the branches the world already permits
 *   occurs, and WHEN. It must never manufacture a branch, never soften a
 *   resolution, and never reach into a probability that represents a real
 *   capability gap.
 *
 * So the assertions come in two halves. The positive half: a fortunate
 * cultivator finds measurably more, and misses measurably less. The negative
 * half, which matters more: two cultivators identical except for Fortune,
 * facing an identically-specified lethal situation, die identically.
 */

import { type Cultivator } from '../../../src/schema/cultivation.js';
import {
    attemptBreakthrough,
    computeBreakthroughOdds,
    tribulationStrikeSurvival
} from '../../../src/engine/cultivation/breakthrough.js';
import { computeTollRisk } from '../../../src/engine/cultivation/toll.js';
import { computeCultivationRate } from '../../../src/engine/cultivation/cultivation.js';
import { deviationRisk } from '../../../src/engine/cultivation/deviation.js';
import { evaluateDeathConditions } from '../../../src/engine/cultivation/survival.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import {
    MAX_ORDINAL,
    TOTAL_RANKS,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const AMBIENTS = ['thin', 'normal', 'dense', 'spirit_tide'] as const;
const TEN_YEARS = 10 * DAYS_PER_YEAR;

/** Identical cultivators but for Fortune. Everything else is pinned. */
function withFortune(fortune: number, overrides: Partial<Cultivator> = {}) {
    return makeCultivator({
        name: 'Control Subject',
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune, charm: 2 },
        ...overrides
    });
}

// ─────────────────────────────────────────────────────────────────────────
// THE NEGATIVE HALF: luck does not buy causal outcomes
// ─────────────────────────────────────────────────────────────────────────

describe('Fortune buys nothing causal', () => {
    it('does not move breakthrough odds, anywhere on the ladder', () => {
        for (let ordinal = 0; ordinal < MAX_ORDINAL; ordinal++) {
            for (const ambient of AMBIENTS) {
                const lucky = computeBreakthroughOdds(withFortune(3, { realmOrdinal: ordinal }), { ambient });
                const cursed = computeBreakthroughOdds(withFortune(0, { realmOrdinal: ordinal }), { ambient });
                expect(lucky.finalChance).toBe(cursed.finalChance);
                expect(lucky.modifiers).toEqual(cursed.modifiers);
            }
        }
    });

    it('does not appear as a line item in the breakthrough breakdown', () => {
        const odds = computeBreakthroughOdds(withFortune(3), { ambient: 'normal' });
        expect(odds.modifiers.some(m => m.source.startsWith('fortune'))).toBe(false);
        // The identity still holds with the line gone.
        const sum = odds.modifiers.reduce((n, m) => n + m.delta, 0);
        expect(sum).toBeCloseTo(odds.finalChance, 10);
    });

    it('does not move per-strike tribulation survival', () => {
        for (const ambient of AMBIENTS) {
            expect(tribulationStrikeSurvival(withFortune(3), ambient)).toBe(
                tribulationStrikeSurvival(withFortune(0), ambient)
            );
        }
    });

    it('does not move cultivation rate or deviation risk', () => {
        expect(computeCultivationRate(withFortune(3), 'normal').perDay).toBe(
            computeCultivationRate(withFortune(0), 'normal').perDay
        );
        const dual = { spiritRoot: 'dual_water_fire' as const, injuries: makeInjuries(2) };
        expect(deviationRisk(withFortune(3, dual)).risk).toBe(
            deviationRisk(withFortune(0, dual)).risk
        );
    });

    it('does not save a cultivator from an identically-specified lethal situation', () => {
        // The direct negative case. Ordinal 43 summons a tribulation and is not
        // a realm boundary, so no toll runs and the two results are comparable
        // byte for byte. If Fortune could reach into a lethal resolution, this
        // is where it would show.
        const ordinal = 43;
        let deaths = 0;
        for (let i = 0; i < 400; i++) {
            const ctx = {
                rng: forStream(`lethal-${i}`, 'breakthrough', ordinal),
                ambient: 'normal' as const,
                turn: 1
            };
            const lucky = attemptBreakthrough(
                withFortune(3, { realmOrdinal: ordinal, cultivationProgress: progressRequiredForOrdinal(ordinal) }),
                { ...ctx, rng: forStream(`lethal-${i}`, 'breakthrough', ordinal) }
            );
            const cursed = attemptBreakthrough(
                withFortune(0, { realmOrdinal: ordinal, cultivationProgress: progressRequiredForOrdinal(ordinal) }),
                { ...ctx, rng: forStream(`lethal-${i}`, 'breakthrough', ordinal) }
            );
            expect(JSON.stringify(lucky)).toBe(JSON.stringify(cursed));
            if (lucky.outcome === 'death') deaths++;
        }
        // The situation really was lethal for some of them, both ways.
        expect(deaths).toBeGreaterThan(0);
    });

    it('does not change what the death engine decides', () => {
        const doomed = {
            hp: 0,
            satiety: 0,
            starvationTurns: 9,
            age: 500,
            realmOrdinal: 0,
            yearsAtCurrentRealm: 99,
            injuries: makeInjuries(5)
        };
        expect(evaluateDeathConditions(withFortune(3, doomed), { forcingCombat: true })).toBe(
            evaluateDeathConditions(withFortune(0, doomed), { forcingCombat: true })
        );
    });

    it('never lets a weak cultivator out-roll a capability gap', () => {
        // A maximally fortunate Qi Condensation cultivator still faces exactly
        // the odds the ladder gives them at a realm boundary.
        const lucky = computeBreakthroughOdds(
            withFortune(3, { realmOrdinal: 12 }),
            { ambient: 'spirit_tide' }
        );
        const cursed = computeBreakthroughOdds(
            withFortune(0, { realmOrdinal: 12 }),
            { ambient: 'spirit_tide' }
        );
        expect(lucky.finalChance).toBe(cursed.finalChance);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE POSITIVE HALF: luck buys opportunity, timing and availability
// ─────────────────────────────────────────────────────────────────────────

describe('Fortune buys opportunity', () => {
    /** Count event kinds across a fixed seed sweep, varying only Fortune. */
    function sweep(fortune: number, runs = 60) {
        const counts = { opportunity: 0, opportunity_missed: 0, passedBy: 0, damaging: 0, withdrawals: 0, majors: 0 };
        let stones = 0;
        for (let i = 0; i < runs; i++) {
            const result = simulateTimeSkip(
                withFortune(fortune, { realmOrdinal: 20 }),
                TEN_YEARS,
                {
                    seed: `fortune-${i}`,
                    locationId: 'azure-cloud-peak',
                    grainAbstinence: true,
                    autoBreakthrough: false
                }
            );
            stones += result.deltas.spiritStones;
            for (const event of result.events) {
                if (event.kind === 'opportunity') counts.opportunity++;
                if (event.kind === 'opportunity_missed') counts.opportunity_missed++;
                if (event.kind === 'encounter') {
                    if (event.data.severity === 'major') {
                        counts.majors++;
                        if (event.data.canWithdraw === true) counts.withdrawals++;
                    } else if (event.data.passedBy === true) counts.passedBy++;
                    else counts.damaging++;
                }
            }
        }
        return { ...counts, stones };
    }

    const lucky = sweep(3);
    const cursed = sweep(0);

    it('draws measurably more opportunities for a fortunate cultivator', () => {
        expect(lucky.opportunity).toBeGreaterThan(cursed.opportunity * 1.5);
        expect(cursed.opportunity).toBeGreaterThan(0);
    });

    it('makes a low-Fortune cultivator arrive after the window closed', () => {
        // "The resource already taken. Arriving four days late."
        expect(cursed.opportunity_missed).toBeGreaterThan(0);
        const luckyMissRate = lucky.opportunity_missed / (lucky.opportunity + lucky.opportunity_missed);
        const cursedMissRate = cursed.opportunity_missed / (cursed.opportunity + cursed.opportunity_missed);
        expect(cursedMissRate).toBeGreaterThan(luckyMissRate);
    });

    it('turns opportunity into real spirit stones, not a flavour event', () => {
        expect(lucky.stones).toBeGreaterThan(cursed.stones);
    });

    it('lets more passing dangers pass by without landing', () => {
        // Presence and timing. Not a reduction in what they do on arrival.
        expect(lucky.passedBy).toBeGreaterThan(cursed.passedBy);
        expect(cursed.damaging).toBeGreaterThan(0);
    });

    it('arranges the elder took the other road, without touching who would win', () => {
        expect(lucky.withdrawals).toBeGreaterThan(cursed.withdrawals);
        // The encounter still happens and still interrupts either way: Fortune
        // decided whether there is a way out, not the result of a fight.
        expect(lucky.majors).toBeGreaterThan(0);
        expect(cursed.majors).toBeGreaterThan(0);
    });

    it('does not change how much a disturbance costs once it has landed', () => {
        // The damage is a function of the body, not of luck.
        const damageOf = (fortune: number) => {
            for (let i = 0; i < 200; i++) {
                const result = simulateTimeSkip(
                    withFortune(fortune, { realmOrdinal: 20, maxHp: 200, hp: 200 }),
                    TEN_YEARS,
                    {
                        seed: `damage-${i}`,
                        locationId: 'azure-cloud-peak',
                        grainAbstinence: true,
                        autoBreakthrough: false
                    }
                );
                const hit = result.events.find(
                    e => e.kind === 'encounter' && e.data.passedBy === false
                );
                if (hit) return hit.data.damage;
            }
            return null;
        };
        expect(damageOf(3)).not.toBeNull();
        expect(damageOf(3)).toBe(damageOf(0));
    });

    it('keeps the whole ladder untouched: no Fortune line anywhere in the odds', () => {
        for (let ordinal = 0; ordinal < TOTAL_RANKS - 1; ordinal++) {
            const odds = computeBreakthroughOdds(withFortune(3, { realmOrdinal: ordinal }), {
                ambient: 'normal'
            });
            expect(odds.modifiers.some(m => m.source.startsWith('fortune'))).toBe(false);
        }
    });
});

describe('Fortune at the Toll', () => {
    it('keeps its role, reframed as the crossing passing over lightly', () => {
        const lucky = computeTollRisk(withFortune(3, { realmOrdinal: 20 }), { ambient: 'normal' });
        const cursed = computeTollRisk(withFortune(0, { realmOrdinal: 20 }), { ambient: 'normal' });
        expect(lucky.risk).toBeLessThan(cursed.risk);
        expect(
            lucky.modifiers.some(m => m.source === 'fortune:attention_elsewhere')
        ).toBe(true);
    });

    it('still sums its modifiers exactly to the risk', () => {
        for (const fortune of [0, 1, 2, 3]) {
            const result = computeTollRisk(withFortune(fortune, { realmOrdinal: 24 }), {
                ambient: 'thin'
            });
            const sum = result.modifiers.reduce((n, m) => n + m.delta, 0);
            expect(sum).toBeCloseTo(result.risk, 10);
        }
    });
});
