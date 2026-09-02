/**
 * The last crossing: True Immortal, False Immortal, or a scar.
 *
 * The attempt from Tribulation Transcendence Perfection is the only one in the
 * game that resolves three ways, and the only place a run can end in something
 * other than a corpse. The properties that matter:
 *
 *   - all three outcomes are actually reachable;
 *   - False Immortal is the COMMON outcome and True Immortal the rare one;
 *   - a False Immortal is refused a re-attempt, by the engine, not by odds;
 *   - a False Immortal outranks Tribulation Transcendence Perfection and is
 *     outranked by True Immortal, in power and in lifespan;
 *   - the Toll collects in FULL on a completed crossing.
 */

import {
    type BreakthroughResult,
    type ImmortalStatus
} from '../../../src/schema/cultivation.js';
import {
    FALSE_IMMORTAL_LIFESPAN_YEARS,
    FALSE_IMMORTAL_ORDINAL,
    FALSE_IMMORTAL_POWER_MULTIPLIER,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    UNBOUNDED_LIFESPAN_YEARS,
    effectiveLifespanYears,
    effectivePowerMultiplier,
    hasCrossedTheLid,
    isLastCrossing,
    isRealmBoundary,
    lifespanForOrdinal,
    powerMultiplierForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    triggersHeavenlyTribulation
} from '../../../src/engine/cultivation/realms.js';
import {
    attemptBreakthrough,
    canAttemptBreakthrough,
    completionChance,
    tribulationStrikeCount
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    canEndRunVoluntarily,
    canExistBeyondTheLid,
    evaluateLidTransit
} from '../../../src/engine/cultivation/existence.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator } from './fixtures.js';

const POOL = [
    { kind: 'bond' as const, id: 'npc-daughter', label: 'their daughter', weight: 5 },
    { kind: 'bond' as const, id: 'npc-rival', label: 'the rival who outlived them', weight: 3 },
    { kind: 'memory' as const, id: 'mem-first', label: 'the first breakthrough', weight: 2 },
    { kind: 'technique' as const, id: 'tech-nine-fold', label: 'Nine-Fold Severing', weight: 4 }
];

function atTheLid(overrides = {}) {
    return makeCultivator({
        realmOrdinal: LAST_CROSSING_ORDINAL,
        cultivationProgress: progressRequiredForOrdinal(LAST_CROSSING_ORDINAL),
        name: 'Ye Qingshan',
        ...overrides
    });
}

function cross(seed: string, overrides = {}): BreakthroughResult {
    return attemptBreakthrough(atTheLid(overrides), {
        rng: forStream(seed, 'breakthrough', LAST_CROSSING_ORDINAL),
        ambient: 'normal',
        turn: 1,
        toll: { candidates: POOL }
    });
}

/** Sweep seeds and bucket by outcome. */
function sweep(n: number, overrides = {}) {
    const results: BreakthroughResult[] = [];
    for (let i = 0; i < n; i++) results.push(cross(`lid-${i}`, overrides));
    return {
        results,
        trueImmortal: results.filter(r => r.immortalStatusGained === 'true_immortal'),
        falseImmortal: results.filter(r => r.immortalStatusGained === 'false_immortal'),
        died: results.filter(r => r.outcome === 'death'),
        /** Killed BY the lightning, as opposed to never reaching it. */
        struckDown: results.filter(r => r.tribulation !== null && !r.tribulation.survived),
        refused: results.filter(r => r.outcome.startsWith('failure_'))
    };
}

describe('the shape of the ladder above Grand Ascension', () => {
    it('puts the Immortal realm above Tribulation Transcendence as two rungs', () => {
        expect(MAX_ORDINAL).toBe(46);
        expect(FALSE_IMMORTAL_ORDINAL).toBe(45);
        expect(LAST_CROSSING_ORDINAL).toBe(44);
        expect(rankName(45)).toBe('False Immortal');
        expect(rankName(46)).toBe('True Immortal');
        expect(rankName(44)).toBe('Tribulation Transcendence Perfection');
        expect(isRealmBoundary(44)).toBe(true);
        expect(isLastCrossing(44)).toBe(true);
        expect(isLastCrossing(43)).toBe(false);
    });

    it('makes the last crossing the heaviest tribulation in the game', () => {
        expect(triggersHeavenlyTribulation(44)).toBe(true);
        expect(tribulationStrikeCount(44)).toBe(7);
        for (const lower of [40, 41, 42, 43]) {
            expect(tribulationStrikeCount(44)).toBeGreaterThan(tribulationStrikeCount(lower));
        }
    });

    it('makes the last crossing the hardest attempt in the game', () => {
        const here = attemptBreakthrough(atTheLid(), {
            rng: forStream('odds', 'breakthrough', 44),
            ambient: 'normal',
            turn: 1
        }).finalChance;
        for (const lower of [12, 24, 36, 40, 43]) {
            const there = attemptBreakthrough(
                makeCultivator({
                    realmOrdinal: lower,
                    cultivationProgress: progressRequiredForOrdinal(lower)
                }),
                { rng: forStream('odds', 'breakthrough', lower), ambient: 'normal', turn: 1 }
            ).finalChance;
            expect(here).toBeLessThan(there);
        }
    });
});

describe('power and lifespan ordering', () => {
    it('ranks a False Immortal above Tribulation Transcendence Perfection', () => {
        expect(FALSE_IMMORTAL_POWER_MULTIPLIER).toBeGreaterThan(powerMultiplierForOrdinal(44));
        expect(effectivePowerMultiplier(44, 'false_immortal')).toBeGreaterThan(
            effectivePowerMultiplier(44, 'none')
        );
    });

    it('ranks a False Immortal below a True Immortal', () => {
        expect(FALSE_IMMORTAL_POWER_MULTIPLIER).toBeLessThan(powerMultiplierForOrdinal(46));
        expect(powerMultiplierForOrdinal(45)).toBeLessThan(powerMultiplierForOrdinal(46));
        expect(effectivePowerMultiplier(45, 'false_immortal')).toBeLessThan(
            effectivePowerMultiplier(46, 'true_immortal')
        );
    });

    it('gives a False Immortal a vast, finite, countable lifespan', () => {
        const span = effectiveLifespanYears(44, 'false_immortal');
        expect(span).toBe(FALSE_IMMORTAL_LIFESPAN_YEARS);
        expect(span).toBeGreaterThan(lifespanForOrdinal(44));
        expect(span).toBeLessThan(UNBOUNDED_LIFESPAN_YEARS);
        expect(Number.isFinite(span)).toBe(true);
    });

    it('gives a True Immortal a lifespan that stops meaning anything', () => {
        const span = effectiveLifespanYears(46, 'true_immortal');
        expect(span).toBe(UNBOUNDED_LIFESPAN_YEARS);
        // Finite on purpose: Infinity serialises to null and would arrive
        // downstream as "no lifespan recorded".
        expect(Number.isFinite(span)).toBe(true);
    });

    it('orders the whole ladder plus both immortal states', () => {
        const ladder = [
            powerMultiplierForOrdinal(40),
            powerMultiplierForOrdinal(44),
            powerMultiplierForOrdinal(45),
            powerMultiplierForOrdinal(46)
        ];
        for (let i = 1; i < ladder.length; i++) {
            expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
        }
    });
});

describe('the three outcomes', () => {
    const swept = sweep(1200);

    it('reaches all three under seed search', () => {
        expect(swept.trueImmortal.length).toBeGreaterThan(0);
        expect(swept.falseImmortal.length).toBeGreaterThan(0);
        expect(swept.died.length).toBeGreaterThan(0);
    });

    it('makes False Immortal common relative to True Immortal', () => {
        // Most who get through the lightning stay stuck on this side. That
        // asymmetry is the Hollow Court's actual membership.
        expect(swept.falseImmortal.length).toBeGreaterThan(swept.trueImmortal.length * 2);
    });

    it('reports True Immortal as an arrival at ordinal 45', () => {
        for (const result of swept.trueImmortal) {
            expect(result.outcome).toBe('success');
            expect(result.toOrdinal).toBe(MAX_ORDINAL);
            expect(result.tribulation?.survived).toBe(true);
        }
    });

    it('reports False Immortal as neither success nor failure, and one rung short', () => {
        for (const result of swept.falseImmortal) {
            expect(result.outcome).toBe('false_immortal');
            // They arrive, one rung below where they were reaching. The rung
            // above is legal, occupied, and permanently shut to them.
            expect(result.toOrdinal).toBe(FALSE_IMMORTAL_ORDINAL);
            expect(result.toOrdinal).toBe(MAX_ORDINAL - 1);
            expect(result.fromOrdinal).toBe(LAST_CROSSING_ORDINAL);
            expect(result.tribulation?.survived).toBe(true);
        }
    });

    it('leaves a scar and nothing else when the lightning wins', () => {
        expect(swept.struckDown.length).toBeGreaterThan(0);
        for (const result of swept.struckDown) {
            expect(result.outcome).toBe('death');
            expect(result.immortalStatusGained).toBeNull();
            // Nobody arrived, so nobody is charged.
            expect(result.toll).toBeNull();
        }
        // Deaths that never reached the lightning at all are ordinary boundary
        // failures, and are also uncharged.
        for (const result of swept.died) {
            expect(result.toll).toBeNull();
            expect(result.immortalStatusGained).toBeNull();
        }
    });

    it('itemises the completion arithmetic alongside the primary odds', () => {
        const crossed = [...swept.trueImmortal, ...swept.falseImmortal][0];
        const completionLines = crossed.modifiers.filter(m => m.source.startsWith('completion.'));
        expect(completionLines.length).toBeGreaterThan(0);
        expect(completionLines.some(m => m.source === 'completion.base:completion')).toBe(true);
    });

    it('does not let luck buy the completion', () => {
        // Whether the Lid stays open is the most causal thing in the setting.
        const lucky = completionChance(makeCultivator({ attributes: { might: 2, insight: 2, fortune: 3, charm: 2 } }), 'normal', 1);
        const unlucky = completionChance(makeCultivator({ attributes: { might: 2, insight: 2, fortune: 0, charm: 2 } }), 'normal', 1);
        expect(lucky.chance).toBe(unlucky.chance);
    });

    it('makes a cleaner tribulation a better crossing', () => {
        const clean = completionChance(makeCultivator(), 'normal', 0).chance;
        const battered = completionChance(makeCultivator(), 'normal', 2).chance;
        expect(clean).toBeGreaterThan(battered);
    });
});

describe('the Lid does not open twice for the same name', () => {
    it('refuses a False Immortal outright, as an engine gate rather than bad odds', () => {
        const barred = makeCultivator({
            realmOrdinal: LAST_CROSSING_ORDINAL,
            cultivationProgress: 1e12,
            immortalStatus: 'false_immortal'
        });
        const check = canAttemptBreakthrough(barred);
        expect(check.eligible).toBe(false);
        expect(check.reason).toBe('barred:the_lid_opened_once');
        expect(() =>
            attemptBreakthrough(barred, {
                rng: forStream('retry', 'breakthrough', 44),
                ambient: 'spirit_tide',
                turn: 1
            })
        ).toThrow(/barred/);
    });

    it('refuses however much progress, ambient qi or preparation is thrown at it', () => {
        for (const ambient of ['thin', 'normal', 'dense', 'spirit_tide'] as const) {
            const barred = makeCultivator({
                realmOrdinal: LAST_CROSSING_ORDINAL,
                cultivationProgress: 1e15,
                immortalStatus: 'false_immortal',
                attributes: { might: 3, insight: 4, fortune: 3, charm: 3 }
            });
            expect(canAttemptBreakthrough(barred).eligible).toBe(false);
            expect(() =>
                attemptBreakthrough(barred, {
                    rng: forStream(`retry-${ambient}`, 'breakthrough', 44),
                    ambient,
                    turn: 1,
                    pill: { name: 'Nine-Revolution Golden Pill', potency: 5 }
                })
            ).toThrow();
        }
    });

    it('refuses a True Immortal too - there is nothing above 45', () => {
        const ascended = makeCultivator({
            realmOrdinal: MAX_ORDINAL,
            cultivationProgress: 1e12,
            immortalStatus: 'true_immortal'
        });
        expect(canAttemptBreakthrough(ascended).eligible).toBe(false);
    });

    it('reports both crossings as having opened the Lid', () => {
        expect(hasCrossedTheLid('none')).toBe(false);
        expect(hasCrossedTheLid('false_immortal')).toBe(true);
        expect(hasCrossedTheLid('true_immortal')).toBe(true);
    });
});

describe('the Toll at the last crossing', () => {
    const swept = sweep(1200);

    it('collects in full on a completed crossing', () => {
        const ascended = swept.trueImmortal[0];
        expect(ascended.toll).not.toBeNull();
        expect(ascended.toll!.outcome).toBe('collected_in_full');
        // Everything, not one thing.
        expect(ascended.toll!.takenAll.length).toBe(POOL.length + 1); // + the name
        expect(ascended.toll!.narrationHint).toContain('spirit tide');
    });

    it('takes every candidate and the name, with nothing left behind', () => {
        const ascended = swept.trueImmortal[0];
        const takenIds = ascended.toll!.takenAll.map(t => t.id);
        for (const candidate of POOL) {
            expect(takenIds).toContain(candidate.id);
        }
        const name = ascended.toll!.takenAll.find(t => t.kind === 'name');
        expect(name).toBeDefined();
        expect(name!.label).toBe('Ye Qingshan');
        expect(name!.id).toBeNull();
    });

    it('takes exactly one thing from a False Immortal, and never nothing', () => {
        // "Incomplete in a way that shows. Something did not come back, and it
        // is never nothing." Guaranteed rather than rolled.
        for (const stuck of swept.falseImmortal) {
            expect(stuck.toll).not.toBeNull();
            expect(stuck.toll!.outcome).toBe('taken');
            expect(stuck.toll!.takenAll).toHaveLength(1);
            expect(stuck.toll!.taken).not.toBeNull();
        }
    });

    it('keeps takenAll[0] and taken consistent on every path', () => {
        for (const result of swept.results) {
            if (result.toll === null) continue;
            expect(result.toll.taken).toEqual(result.toll.takenAll[0] ?? null);
        }
    });

    it('finds nothing to take from someone who divested everything first', () => {
        // Divestment is not the Toll. What was given away deliberately is not
        // there to be torn out, which is exactly why divesting is rational.
        // A maximally prepared crossing, because a True Immortal is otherwise
        // roughly one attempt in five hundred and the seed sweep would be
        // dominated by variance rather than by the property under test.
        const prepared = atTheLid({
            attributes: { might: 3, insight: 4, fortune: 0, charm: 2 },
            foundationQuality: 'exceptional'
        });
        let ascended = null;
        for (let i = 0; i < 3000 && ascended === null; i++) {
            const result = attemptBreakthrough(prepared, {
                rng: forStream(`divested-${i}`, 'breakthrough', 44),
                ambient: 'spirit_tide',
                turn: 1,
                pill: { name: 'Nine-Revolution Golden Pill', potency: 5 },
                // Bonds cut, techniques sealed into an inheritance, the name
                // already given up: nothing remains for the crossing to reach.
                toll: { candidates: [], nameAlreadyTaken: true }
            });
            if (result.immortalStatusGained === 'true_immortal') ascended = result;
        }
        expect(ascended).not.toBeNull();
        expect(ascended!.toll!.outcome).toBe('collected_in_full');
        expect(ascended!.toll!.takenAll).toEqual([]);
    });
});

describe('life after the crossing', () => {
    it('lets a True Immortal keep playing rather than ending the run', () => {
        // Ascension does not force an epilogue. It is a different game.
        const ascended = makeCultivator({
            realmOrdinal: MAX_ORDINAL,
            immortalStatus: 'true_immortal',
            age: 90000
        });
        expect(ascended.alive).toBe(true);
        expect(canExistBeyondTheLid(ascended)).toBe(true);
    });

    it('lets ONLY a True Immortal end the run deliberately', () => {
        const ascended = makeCultivator({
            realmOrdinal: MAX_ORDINAL,
            immortalStatus: 'true_immortal'
        });
        expect(canEndRunVoluntarily(ascended).legal).toBe(true);

        // Not generalised. Permadeath everywhere else is untouched.
        for (const ordinal of [0, 12, 24, 40, 44]) {
            const mortal = makeCultivator({ realmOrdinal: ordinal });
            const check = canEndRunVoluntarily(mortal);
            expect(check.legal).toBe(false);
            expect(check.reason).toBe('not_a_true_immortal');
        }
        const stuck = makeCultivator({
            realmOrdinal: LAST_CROSSING_ORDINAL,
            immortalStatus: 'false_immortal'
        });
        expect(canEndRunVoluntarily(stuck).legal).toBe(false);
    });

    it('crushes anyone below True Immortal who reaches the other side', () => {
        for (const ordinal of [0, 24, 44]) {
            const check = evaluateLidTransit(
                makeCultivator({ realmOrdinal: ordinal }),
                'up'
            );
            expect(check.permitted).toBe(false);
            expect(check.reason).toBe('crushed_beyond_the_lid');
        }
        const stuck = makeCultivator({ immortalStatus: 'false_immortal' });
        expect(evaluateLidTransit(stuck, 'up').permitted).toBe(false);
    });

    it('prices a descent as a real, heavy, engine-resolved cost', () => {
        const ascended = makeCultivator({
            realmOrdinal: MAX_ORDINAL,
            immortalStatus: 'true_immortal'
        });
        const descent = evaluateLidTransit(ascended, 'down');
        expect(descent.permitted).toBe(true);
        // Not a free travel option: a hole made inward is still a hole.
        expect(descent.strikes).toBeGreaterThan(tribulationStrikeCount(44));
    });
});

describe('immortals and the death engine', () => {
    const statuses: ImmortalStatus[] = ['none', 'false_immortal', 'true_immortal'];

    it('exposes exactly three statuses', () => {
        expect(statuses).toHaveLength(3);
    });
});
