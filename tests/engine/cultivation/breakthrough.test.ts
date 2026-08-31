/**
 * Breakthrough - the centrepiece.
 *
 * Three invariants are load-bearing and are tested exhaustively rather than by
 * sampling: the modifier list sums to the final chance, the chance is always
 * strictly inside (0, 1), and a realm boundary is meaningfully worse than the
 * sub-rank below it in both odds and failure severity.
 */

import {
    MAX_ORDINAL,
    TOTAL_RANKS,
    isRealmBoundary,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import {
    MAX_BREAKTHROUGH_CHANCE,
    MAX_PILL_BONUS,
    MIN_BREAKTHROUGH_CHANCE,
    attemptBreakthrough,
    canAttemptBreakthrough,
    computeBreakthroughOdds,
    tribulationStrikeCount,
    tribulationStrikeSurvival
} from '../../../src/engine/cultivation/breakthrough.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { MAX_TEMPERING } from '../../../src/engine/cultivation/injuries.js';
import {
    MAX_RANKS_PER_TURN,
    type AmbientQi,
    type BreakthroughOutcome,
    type SpiritRootKey
} from '../../../src/schema/cultivation.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

/** Local alias so the foundation helper below reads cleanly. */
type AmbientBand = AmbientQi;

const ALL_ORDINALS = Array.from({ length: TOTAL_RANKS }, (_, i) => i);
const AMBIENT_BANDS: AmbientQi[] = ['thin', 'normal', 'dense', 'spirit_tide'];
const ROOTS: SpiritRootKey[] = [
    'single_fire', 'dual_water_fire', 'muddled_five_element', 'mutated_lightning'
];

/** A cultivator standing at `ordinal` with exactly enough progress to attempt. */
function ready(ordinal: number, overrides = {}) {
    return makeCultivator({
        realmOrdinal: ordinal,
        cultivationProgress: progressRequiredForOrdinal(ordinal),
        ...overrides
    });
}

describe('eligibility', () => {
    it('requires the full progress cost of the current ordinal', () => {
        const required = progressRequiredForOrdinal(0);
        expect(
            canAttemptBreakthrough(makeCultivator({ cultivationProgress: required - 0.0001 }))
                .eligible
        ).toBe(false);
        expect(
            canAttemptBreakthrough(makeCultivator({ cultivationProgress: required })).eligible
        ).toBe(true);
    });

    it('refuses at the summit of the ladder', () => {
        const summit = makeCultivator({
            realmOrdinal: MAX_ORDINAL,
            cultivationProgress: 1e12
        });
        expect(canAttemptBreakthrough(summit)).toMatchObject({
            eligible: false,
            reason: 'at_ladder_summit'
        });
    });

    it('refuses a dead cultivator', () => {
        expect(canAttemptBreakthrough(ready(0, { alive: false })).reason).toBe('dead');
    });

    it('enforces MAX_RANKS_PER_TURN even with progress banked for several ranks', () => {
        const banked = ready(0, { cultivationProgress: 1e9 });
        expect(canAttemptBreakthrough(banked, { ranksGainedThisTurn: 0 }).eligible).toBe(true);
        expect(
            canAttemptBreakthrough(banked, { ranksGainedThisTurn: MAX_RANKS_PER_TURN })
        ).toMatchObject({ eligible: false, reason: 'rank_cap_reached_this_turn' });
    });

    it('throws rather than inventing an outcome when a caller skips its gate', () => {
        expect(() =>
            attemptBreakthrough(makeCultivator({ cultivationProgress: 0 }), {
                rng: forStream('s', 'breakthrough', 0),
                ambient: 'normal',
                turn: 0
            })
        ).toThrow(/insufficient_progress/);
    });
});

describe('odds', () => {
    it('sums its itemised modifiers to the final chance, everywhere on the ladder', () => {
        for (const ordinal of ALL_ORDINALS.slice(0, MAX_ORDINAL)) {
            for (const ambient of AMBIENT_BANDS) {
                for (const root of ROOTS) {
                    const odds = computeBreakthroughOdds(
                        ready(ordinal, { spiritRoot: root, injuries: makeInjuries(2, 'serious') }),
                        { ambient }
                    );
                    const sum = odds.modifiers.reduce((n, m) => n + m.delta, 0);
                    expect(sum).toBeCloseTo(odds.finalChance, 10);
                }
            }
        }
    });

    it('keeps the probability strictly inside (0, 1) for every build and rank', () => {
        for (const ordinal of ALL_ORDINALS.slice(0, MAX_ORDINAL)) {
            for (const ambient of AMBIENT_BANDS) {
                const best = computeBreakthroughOdds(
                    ready(ordinal, {
                        spiritRoot: 'single_fire',
                        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 }
                    }),
                    { ambient, pill: { name: 'Nine-Revolution Golden Pill', potency: 5 } }
                );
                const worst = computeBreakthroughOdds(
                    ready(ordinal, {
                        spiritRoot: 'muddled_five_element',
                        attributes: { might: 1, insight: 1, fortune: 0, charm: 1 },
                        injuries: makeInjuries(12, 'crippling')
                    }),
                    { ambient }
                );
                for (const odds of [best, worst]) {
                    expect(odds.finalChance).toBeGreaterThan(0);
                    expect(odds.finalChance).toBeLessThan(1);
                    expect(odds.finalChance).toBeGreaterThanOrEqual(MIN_BREAKTHROUGH_CHANCE);
                    expect(odds.finalChance).toBeLessThanOrEqual(MAX_BREAKTHROUGH_CHANCE);
                }
            }
        }
    });

    it('books the clamp as its own line item so the arithmetic stays auditable', () => {
        const odds = computeBreakthroughOdds(
            ready(0, { attributes: { might: 3, insight: 4, fortune: 3, charm: 3 } }),
            { ambient: 'spirit_tide', pill: { name: 'Golden Pill', potency: 1 } }
        );
        expect(odds.finalChance).toBe(MAX_BREAKTHROUGH_CHANCE);
        expect(odds.modifiers.some(m => m.source === 'clamp:ceiling')).toBe(true);
    });

    it('caps how much a single pill can contribute', () => {
        const modest = computeBreakthroughOdds(ready(20), {
            ambient: 'thin',
            pill: { name: 'A', potency: 0.1 }
        });
        const absurd = computeBreakthroughOdds(ready(20), {
            ambient: 'thin',
            pill: { name: 'B', potency: 99 }
        });
        const pillDelta = (odds: typeof absurd) =>
            odds.modifiers.find(m => m.source.startsWith('pill:'))!.delta;
        expect(pillDelta(modest)).toBeCloseTo(0.1, 10);
        expect(pillDelta(absurd)).toBe(MAX_PILL_BONUS);
    });

    it('itemises each source exactly once', () => {
        const odds = computeBreakthroughOdds(
            ready(12, { injuries: makeInjuries(1, 'minor') }),
            { ambient: 'dense', pill: { name: 'Foundation Pill', potency: 0.2 } }
        );
        const sources = odds.modifiers.map(m => m.source);
        expect(new Set(sources).size).toBe(sources.length);
        expect(sources.some(s => s.startsWith('base:'))).toBe(true);
        expect(sources).toContain('realm_boundary_strain');
        expect(sources).toContain('insight');
        // No Fortune line, deliberately: luck generates opportunity, not
        // success, and a breakthrough is a causal outcome.
        expect(sources).not.toContain('fortune');
        expect(sources.some(s => s.startsWith('spirit_root:'))).toBe(true);
        expect(sources.some(s => s.startsWith('ambient_qi:'))).toBe(true);
        expect(sources.some(s => s.startsWith('untreated_injuries:'))).toBe(true);
    });

    it('omits injury and pill lines when there are none', () => {
        const odds = computeBreakthroughOdds(ready(3), { ambient: 'normal' });
        expect(odds.modifiers.some(m => m.source.startsWith('untreated_injuries'))).toBe(false);
        expect(odds.modifiers.some(m => m.source.startsWith('pill:'))).toBe(false);
    });

    it('makes every realm boundary strictly worse than the sub-rank below it', () => {
        for (const ordinal of ALL_ORDINALS.filter(isRealmBoundary)) {
            const here = computeBreakthroughOdds(ready(ordinal), { ambient: 'normal' });
            const below = computeBreakthroughOdds(ready(ordinal - 1), { ambient: 'normal' });
            expect(here.isBoundary).toBe(true);
            expect(below.isBoundary).toBe(false);
            expect(here.finalChance).toBeLessThan(below.finalChance * 0.6);
        }
    });
});

describe('attempting', () => {
    function runMany(ordinal: number, count: number, ambient: AmbientQi = 'normal') {
        const outcomes: Record<BreakthroughOutcome, number> = {
            success: 0, failure_stable: 0, failure_injured: 0, failure_deviation: 0, death: 0
        };
        const results = [];
        for (let i = 0; i < count; i++) {
            const result = attemptBreakthrough(ready(ordinal), {
                rng: forStream(`trial-${i}`, 'breakthrough', i, ordinal),
                ambient,
                turn: 1
            });
            outcomes[result.outcome]++;
            results.push(result);
        }
        return { outcomes, results };
    }

    it('produces an outcome consistent with the roll and the final chance', () => {
        const { results } = runMany(5, 500);
        for (const result of results) {
            expect(result.roll).toBeGreaterThanOrEqual(0);
            expect(result.roll).toBeLessThan(1);
            const succeeded = result.outcome === 'success';
            expect(result.roll < result.finalChance).toBe(succeeded);
        }
    });

    it('advances exactly one rank on success and none otherwise', () => {
        const { results } = runMany(5, 500);
        for (const result of results) {
            expect(result.fromOrdinal).toBe(5);
            expect(result.toOrdinal).toBe(result.outcome === 'success' ? 6 : 5);
        }
    });

    it('succeeds at roughly the stated probability', () => {
        const { outcomes } = runMany(5, 4000);
        const expected = computeBreakthroughOdds(ready(5), { ambient: 'normal' }).finalChance;
        expect(outcomes.success / 4000).toBeCloseTo(expected, 1);
    });

    it('consumes progress in proportion to how badly the attempt went', () => {
        const required = progressRequiredForOrdinal(5);
        const { results } = runMany(5, 800);
        const byOutcome = new Map<BreakthroughOutcome, number>();
        for (const r of results) byOutcome.set(r.outcome, r.progressConsumed);
        expect(byOutcome.get('success')).toBe(required);
        expect(byOutcome.get('failure_stable')).toBeLessThan(required);
        if (byOutcome.has('failure_injured')) {
            expect(byOutcome.get('failure_injured')!).toBeGreaterThan(
                byOutcome.get('failure_stable')!
            );
        }
    });

    it('only wounds on the outcomes that say they wound', () => {
        const { results } = runMany(12, 1500);
        for (const result of results) {
            const shouldWound =
                result.outcome === 'failure_injured' ||
                result.outcome === 'failure_deviation' ||
                result.outcome === 'death';
            expect(result.injuriesSustained.length > 0).toBe(shouldWound);
            for (const injury of result.injuriesSustained) {
                expect(injury.treated).toBe(false);
                expect(injury.sustainedOnTurn).toBe(1);
            }
        }
    });

    it('makes failing a realm boundary far more expensive than failing a sub-rank', () => {
        const boundary = runMany(12, 3000);
        const subRank = runMany(11, 3000);

        const failureRate = (o: typeof boundary.outcomes) =>
            (o.failure_stable + o.failure_injured + o.failure_deviation + o.death);
        const woundedRate = (o: typeof boundary.outcomes) =>
            (o.failure_injured + o.failure_deviation + o.death) / failureRate(o);

        // Less likely to succeed...
        expect(boundary.outcomes.success / 3000).toBeLessThan(subRank.outcomes.success / 3000);
        // ...and much worse when it goes wrong.
        expect(woundedRate(boundary.outcomes)).toBeGreaterThan(woundedRate(subRank.outcomes) * 1.3);
        expect(boundary.outcomes.death).toBeGreaterThan(subRank.outcomes.death);
    });

    it('is reproducible: the same stream yields the same result object', () => {
        const first = attemptBreakthrough(ready(12), {
            rng: forStream('run', 'breakthrough', 900, 12),
            ambient: 'dense',
            turn: 7
        });
        const second = attemptBreakthrough(ready(12), {
            rng: forStream('run', 'breakthrough', 900, 12),
            ambient: 'dense',
            turn: 7
        });
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('never mutates the cultivator it was handed', () => {
        const cultivator = ready(12, { injuries: makeInjuries(1) });
        const before = JSON.parse(JSON.stringify(cultivator));
        for (let i = 0; i < 50; i++) {
            attemptBreakthrough(cultivator, {
                rng: forStream('run', 'breakthrough', i),
                ambient: 'normal',
                turn: 1
            });
        }
        expect(cultivator).toEqual(before);
    });

    it('writes a factual narration hint for every outcome', () => {
        const { results } = runMany(12, 400);
        for (const result of results) {
            expect(result.narrationHint.length).toBeGreaterThan(0);
        }
    });
});

describe('heavenly tribulation', () => {
    // Every crossing INTO or WITHIN Tribulation Transcendence: 40 -> 41 is the
    // lightest and 43 -> 44 the heaviest.
    const TRIB_ORDINALS = [40, 41, 42, 43];

    it('counts strikes from the destination, lightest at the boundary crossing', () => {
        expect(tribulationStrikeCount(40)).toBe(3);
        expect(tribulationStrikeCount(41)).toBe(4);
        expect(tribulationStrikeCount(42)).toBe(5);
        expect(tribulationStrikeCount(43)).toBe(6);
        // Strictly increasing, and zero wherever no lightning is summoned.
        for (let i = 1; i < TRIB_ORDINALS.length; i++) {
            expect(tribulationStrikeCount(TRIB_ORDINALS[i])).toBeGreaterThan(
                tribulationStrikeCount(TRIB_ORDINALS[i - 1])
            );
        }
        for (const ordinal of [0, 12, 24, 36, 39, MAX_ORDINAL]) {
            expect(tribulationStrikeCount(ordinal)).toBe(0);
        }
    });

    it('keeps per-strike survival inside a sane band', () => {
        const lucky = makeCultivator({ attributes: { might: 3, insight: 4, fortune: 3, charm: 3 } });
        const doomed = makeCultivator({
            attributes: { might: 1, insight: 1, fortune: 0, charm: 1 },
            injuries: makeInjuries(10, 'crippling')
        });
        expect(tribulationStrikeSurvival(lucky, 'spirit_tide')).toBeGreaterThan(
            tribulationStrikeSurvival(doomed, 'thin')
        );
        for (const band of AMBIENT_BANDS) {
            for (const c of [lucky, doomed]) {
                const p = tribulationStrikeSurvival(c, band);
                expect(p).toBeGreaterThan(0);
                expect(p).toBeLessThan(1);
            }
        }
    });

    it('populates result.tribulation whenever the sky is involved', () => {
        for (const ordinal of TRIB_ORDINALS) {
            const cultivator = makeCultivator({
                realmOrdinal: ordinal,
                cultivationProgress: 1e12
            });
            let withTribulation = 0;
            let deaths = 0;
            for (let i = 0; i < 1000; i++) {
                const result = attemptBreakthrough(cultivator, {
                    rng: forStream(`trib-${i}`, 'breakthrough', i, ordinal),
                    ambient: 'normal',
                    turn: 1
                });
                if (result.tribulation !== null) {
                    withTribulation++;
                    expect(result.tribulation.strikes).toBe(tribulationStrikeCount(ordinal));
                    expect(result.tribulation.survived).toBe(result.outcome === 'success');
                    if (result.outcome === 'death') deaths++;
                } else {
                    // No tribulation means the primary roll never got there.
                    expect(result.outcome).not.toBe('success');
                }
            }
            expect(withTribulation).toBeGreaterThan(0);
            expect(deaths).toBeGreaterThan(0);
        }
    });

    it('does not summon lightning below the Tribulation Transcendence crossing', () => {
        for (const ordinal of [0, 12, 24, 36, 39]) {
            for (let i = 0; i < 40; i++) {
                const result = attemptBreakthrough(ready(ordinal), {
                    rng: forStream(`no-trib-${i}`, 'breakthrough', i, ordinal),
                    ambient: 'normal',
                    turn: 1
                });
                expect(result.tribulation).toBeNull();
            }
        }
    });

    it('summons the lightest tribulation on the 40 to 41 crossing itself', () => {
        let sawTribulation = 0;
        let sawDeath = 0;
        for (let i = 0; i < 1500; i++) {
            const result = attemptBreakthrough(ready(40), {
                rng: forStream(`crossing-${i}`, 'breakthrough', i, 40),
                ambient: 'normal',
                turn: 1
            });
            if (result.tribulation === null) {
                expect(result.outcome).not.toBe('success');
                continue;
            }
            sawTribulation++;
            expect(result.tribulation.strikes).toBe(3);
            if (result.outcome === 'death') sawDeath++;
        }
        expect(sawTribulation).toBeGreaterThan(0);
        expect(sawDeath).toBeGreaterThan(0);
    });

    it('charges the toll on the tribulation crossing too - boundary AND lightning', () => {
        let arrived = null;
        for (let i = 0; i < 600 && arrived === null; i++) {
            const result = attemptBreakthrough(ready(40), {
                rng: forStream(`trib-toll-${i}`, 'breakthrough', i, 40),
                ambient: 'normal',
                turn: 1,
                toll: {
                    candidates: [
                        { kind: 'bond', id: 'npc-1', label: 'their last student', weight: 2 }
                    ]
                }
            });
            if (result.outcome === 'success') arrived = result;
        }
        expect(arrived).not.toBeNull();
        expect(arrived!.tribulation?.survived).toBe(true);
        expect(arrived!.toll).not.toBeNull();
        expect(arrived!.toll!.boundaryIndex).toBe(7);
    });

    it('charges nobody who did not arrive', () => {
        for (let i = 0; i < 200; i++) {
            const result = attemptBreakthrough(ready(40), {
                rng: forStream(`no-arrival-${i}`, 'breakthrough', i, 40),
                ambient: 'normal',
                turn: 1,
                toll: { candidates: [{ kind: 'bond', id: 'n', label: 'someone', weight: 1 }] }
            });
            if (result.outcome !== 'success') expect(result.toll).toBeNull();
        }
    });
});

describe('the toll, charged through a breakthrough', () => {
    const POOL = [
        { kind: 'bond' as const, id: 'npc-a', label: 'their brother', weight: 4 },
        { kind: 'technique' as const, id: 'tech-a', label: 'Borrowed Breath', weight: 2 }
    ];

    function crossings(ordinal: number, n: number, toll = { candidates: POOL }) {
        const results = [];
        for (let i = 0; i < n; i++) {
            results.push(
                attemptBreakthrough(ready(ordinal), {
                    rng: forStream(`cross-${i}`, 'breakthrough', i, ordinal),
                    ambient: 'normal',
                    turn: 1,
                    toll
                })
            );
        }
        return results;
    }

    it('charges every successful realm-boundary crossing', () => {
        for (const result of crossings(16, 300)) {
            expect(result.toll !== null).toBe(result.outcome === 'success');
        }
    });

    it('never charges a sub-rank step', () => {
        for (const result of crossings(5, 300)) {
            expect(result.toll).toBeNull();
        }
    });

    it('can come up clean on a boundary the player actually crossed', () => {
        const successes = crossings(16, 400).filter(r => r.outcome === 'success');
        expect(successes.length).toBeGreaterThan(0);
        const outcomes = new Set(successes.map(r => r.toll!.outcome));
        expect(outcomes).toContain('clean');
        expect(outcomes).toContain('taken');
    });

    it('reports the toll in the narration hint so it cannot be narrated away', () => {
        const taken = crossings(16, 400).find(r => r.toll?.outcome === 'taken');
        expect(taken).toBeDefined();
        expect(taken!.narrationHint).toContain(taken!.toll!.taken!.label);
    });

    it('finds nothing to take when the caller supplies no candidates', () => {
        // Deliberately visible rather than silent: the crossing does not wait for
        // a caller to be ready, so a forgotten candidate list surfaces here.
        const outcomes = new Set(
            crossings(16, 300, { candidates: [] })
                .filter(r => r.toll !== null)
                .map(r => r.toll!.outcome)
        );
        expect(outcomes).toContain('nothing_left');
        expect(outcomes).not.toContain('taken');
    });
});

describe('foundation establishment', () => {
    it('lays a foundation on the 12 to 13 crossing and nowhere else', () => {
        const crossing = [];
        for (let i = 0; i < 300; i++) {
            crossing.push(
                attemptBreakthrough(ready(12), {
                    rng: forStream(`found-${i}`, 'breakthrough', i, 12),
                    ambient: 'dense',
                    turn: 1,
                    foundation: { preparation: 0.8 }
                })
            );
        }
        const successes = crossing.filter(r => r.outcome === 'success');
        expect(successes.length).toBeGreaterThan(0);
        for (const result of crossing) {
            expect(result.foundationEstablished !== null).toBe(result.outcome === 'success');
        }

        for (let i = 0; i < 50; i++) {
            const elsewhere = attemptBreakthrough(ready(16), {
                rng: forStream(`nofound-${i}`, 'breakthrough', i, 16),
                ambient: 'normal',
                turn: 1
            });
            expect(elsewhere.foundationEstablished).toBeNull();
        }
    });

    it('lays better foundations for better-prepared crossings', () => {
        const qualityOf = (conditions: { preparation?: number; hurried?: boolean }, ambient: AmbientBand) => {
            const seen = new Set<string>();
            for (let i = 0; i < 300; i++) {
                const result = attemptBreakthrough(ready(12), {
                    rng: forStream(`prep-${i}`, 'breakthrough', i, 12),
                    ambient,
                    turn: 1,
                    foundation: conditions
                });
                if (result.foundationEstablished) seen.add(result.foundationEstablished);
            }
            return seen;
        };
        const prepared = qualityOf({ preparation: 1 }, 'dense');
        const ditch = qualityOf({ hurried: true }, 'thin');
        expect(prepared).toContain('exceptional');
        expect(ditch).not.toContain('exceptional');
        expect(ditch).toContain('damaged');
    });

    it('exposes the fresh foundation to the same crossing that laid it', () => {
        // The foundation laid at 12 -> 13 is what the severance reaches into on the
        // way past, so it must be the new one and not the pre-crossing 'none'.
        let seen = null;
        for (let i = 0; i < 300 && seen === null; i++) {
            const result = attemptBreakthrough(ready(12), {
                rng: forStream(`fresh-${i}`, 'breakthrough', i, 12),
                ambient: 'thin',
                turn: 1,
                foundation: { hurried: true },
                toll: { candidates: [{ kind: 'bond', id: 'n', label: 'someone', weight: 1 }] }
            });
            if (result.outcome === 'success' && result.foundationEstablished === 'damaged') {
                seen = result;
            }
        }
        expect(seen).not.toBeNull();
        expect(seen!.toll!.modifiers.some(m => m.source === 'foundation:damaged')).toBe(true);
    });
});

describe('scar tempering', () => {
    it('pays a capped bonus for wounds that were closed', () => {
        const scarred = makeCultivator({
            realmOrdinal: 5,
            cultivationProgress: progressRequiredForOrdinal(5),
            injuries: makeInjuries(3, 'serious').map(i => ({ ...i, treated: true }))
        });
        const untouched = ready(5);
        const scarredOdds = computeBreakthroughOdds(scarred, { ambient: 'normal' });
        const baseOdds = computeBreakthroughOdds(untouched, { ambient: 'normal' });

        expect(scarredOdds.finalChance).toBeGreaterThan(baseOdds.finalChance);
        expect(scarredOdds.modifiers.some(m => m.source.startsWith('tempering:'))).toBe(true);
    });

    it('never lets an OPEN wound pay anything - the ratchet is untouched', () => {
        const open = makeCultivator({
            realmOrdinal: 5,
            cultivationProgress: progressRequiredForOrdinal(5),
            injuries: makeInjuries(3, 'serious')
        });
        const odds = computeBreakthroughOdds(open, { ambient: 'normal' });
        const baseOdds = computeBreakthroughOdds(ready(5), { ambient: 'normal' });
        expect(odds.finalChance).toBeLessThan(baseOdds.finalChance);
        expect(odds.modifiers.some(m => m.source.startsWith('tempering:'))).toBe(false);
    });

    it('can never out-earn the spirit root a cultivator was dealt', () => {
        const veteran = makeCultivator({
            realmOrdinal: 5,
            spiritRoot: 'muddled_five_element',
            cultivationProgress: progressRequiredForOrdinal(5),
            injuries: makeInjuries(40, 'crippling').map(i => ({ ...i, treated: true }))
        });
        const prodigy = makeCultivator({
            realmOrdinal: 5,
            spiritRoot: 'single_fire',
            cultivationProgress: progressRequiredForOrdinal(5)
        });
        const temperingDelta = computeBreakthroughOdds(veteran, { ambient: 'normal' })
            .modifiers.find(m => m.source.startsWith('tempering:'))!.delta;
        expect(temperingDelta).toBeLessThanOrEqual(MAX_TEMPERING);
        expect(computeBreakthroughOdds(veteran, { ambient: 'normal' }).finalChance)
            .toBeLessThan(computeBreakthroughOdds(prodigy, { ambient: 'normal' }).finalChance);
    });
});
