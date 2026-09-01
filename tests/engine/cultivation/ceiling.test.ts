/**
 * The top of the ladder, and what it takes to get there.
 *
 * Above ordinal 32 is reachable in the present day, and only as a CONJUNCTION:
 * extraordinary luck AND extraordinary talent. Neither half is sufficient, and
 * that is what makes the rare runs rare for a legible reason rather than
 * because one dial was set low.
 *
 *   luck    a sealed vein - a pocket nothing has drawn on, unreachable by
 *           travel, which has to be found and held
 *   talent  a clean single or mutated root, which is dealt once and cannot be
 *           improved
 *
 * A muddled five-element root does not reach the top however lucky it gets.
 * Its 0.55 cultivation speed is the whole point of it, and luck must never be
 * able to launder that.
 *
 * This file asks WHETHER, and every assertion in it is a reachability bound
 * over a best-of-N search. `crossing.test.ts` next door asks HOW OFTEN, over a
 * distribution of whole lives, and pins the recalibrated shares. The two are
 * deliberately separate: the ceilings here are population structure and must
 * not move, while the shares there are balance and are expected to.
 */

import { forStream } from '../../../src/engine/cultivation/rng.js';
import { DAYS_PER_YEAR, computeCultivationRate } from '../../../src/engine/cultivation/cultivation.js';
import { MAX_ORDINAL, lifespanForOrdinal, progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { attemptBreakthrough, canAttemptBreakthrough } from '../../../src/engine/cultivation/breakthrough.js';
import { formInsight, recordAchievement } from '../../../src/engine/cultivation/understanding.js';
import { treatWorstInjuries } from '../../../src/engine/cultivation/injuries.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    AMBIENT_QI_RATE_MULTIPLIER, stagnationYearsForOrdinal,
    type AmbientQi, type Injury, type Insight, type SpiritRootKey
} from '../../../src/schema/cultivation.js';

function deepInsights(): Insight[] {
    const a = recordAchievement({ kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' }, new CultivationRNG('a'));
    const c = { kind: 'teacher' as const, label: 'a teacher' };
    return [
        formInsight({ domain: 'life_death', subject: 'mortality', opening: 'o', access: c }, 5, a),
        formInsight({ domain: 'karma', subject: 'debt', opening: 'o', access: c }, 5, a),
        formInsight({ domain: 'void', subject: 'the seam', opening: 'o', access: c }, 4, a)
    ];
}

/** Peak ordinal reached, walking the real engine. */
function peakOrdinal(
    root: SpiritRootKey, ambient: AmbientQi, withInsights: boolean, seed: string
): number {
    const insights = withInsights ? deepInsights() : [];
    const attributes = { might: 2, insight: 4, fortune: 1, charm: 2 };
    const foundation = withInsights ? ('exceptional' as const) : undefined;
    let ordinal = 0, best = 0, progress = 0, age = 16, yearsAtRank = 0, attempt = 0;
    const injuries: Injury[] = [];
    for (;;) {
        const rate = computeCultivationRate(
            { spiritRoot: root, injuries, insights, foundationQuality: foundation },
            ambient, { focusMultiplier: 1, techniqueBonus: 1.3, sectBonus: 1.2 }
        ).perDay;
        if (rate <= 0) return best;
        const subj = { realmOrdinal: ordinal, cultivationProgress: progress, spiritRoot: root, insights, alive: true as const };
        const need = Math.max(0, progressRequiredForOrdinal(ordinal) - canAttemptBreakthrough(subj).progressSubstituted - progress);
        const years = Math.max(1 / DAYS_PER_YEAR, need / (rate * DAYS_PER_YEAR));
        if (yearsAtRank + years >= stagnationYearsForOrdinal(ordinal)) return best;
        if (age + years >= lifespanForOrdinal(ordinal)) return best;
        age += years; yearsAtRank += years; progress += need;
        // Re-checked with the wounds, against the same subject the attempt is
        // made with. A cracked structure refuses the next realm crossing - the
        // core will not form on a broken foundation - so a loop that attempts
        // anyway gets a throw instead of an outcome.
        if (!canAttemptBreakthrough({ ...subj, cultivationProgress: progress, injuries }).eligible) {
            return best;
        }
        const r = attemptBreakthrough(
            { ...subj, cultivationProgress: progress, attributes, injuries, foundationQuality: foundation },
            { rng: forStream(seed, 'bt', root, attempt++), ambient, turn: Math.floor(age),
              pill: withInsights ? { name: 'p', potency: 0.35 } : null, toll: { candidates: [] } }
        );
        progress = Math.max(0, progress - r.progressConsumed);
        for (const j of r.injuriesSustained) injuries.push(j);
        // An exceptional run treats its wounds. Untreated meridian damage caps
        // out the breakthrough penalty long before the clocks bind, so a
        // cultivator who never spends a pill stalls in the low thirties
        // regardless of where they are standing - which is correct, and is a
        // separate axis of "everything went right" rather than a clock.
        //
        // Treating is no longer free of consequence, though: closed wounds past
        // SCAR_PLATEAU cost cultivation rate, so a run that healed its way
        // through thirty failures arrives at the top slower than one that did
        // not need to. That is the intended shape - healing is still much
        // better than not healing - and it is what the "reachable" bounds below
        // are now measured against.
        if (withInsights) {
            const healed = treatWorstInjuries(injuries, injuries.length);
            injuries.length = 0;
            injuries.push(...healed.injuries);
        }
        if (r.outcome === 'death') return best;
        if (r.outcome === 'success') {
            ordinal = r.toOrdinal; best = Math.max(best, ordinal);
            // The settling clock is per RANK and resets on advancing. Forgetting
            // this makes a harness stall around ordinal 36 for reasons the
            // engine does not actually have.
            yearsAtRank = 0;
            if (ordinal >= MAX_ORDINAL) return best;
        }
    }
}

/** Best of N seeded lives - what this configuration can do at its luckiest. */
function bestOf(root: SpiritRootKey, ambient: AmbientQi, insights: boolean, n = 400): number {
    let best = 0;
    for (let i = 0; i < n; i++) best = Math.max(best, peakOrdinal(root, ambient, insights, `seed-${i}`));
    return best;
}

describe('the exceptional site is what opens the top', () => {
    it('exists above dense and cannot be rolled by anybody wandering', () => {
        expect(AMBIENT_QI_RATE_MULTIPLIER.sealed_vein)
            .toBeGreaterThan(AMBIENT_QI_RATE_MULTIPLIER.dense);
        expect(AMBIENT_QI_RATE_MULTIPLIER.sealed_vein)
            .toBeGreaterThan(AMBIENT_QI_RATE_MULTIPLIER.spirit_tide);
    });

    it('carries a clean root past ordinal 32, which nothing else does', () => {
        expect(bestOf('single_fire', 'sealed_vein', true)).toBeGreaterThan(32);
    });

    it('leaves the last realm reachable rather than merely the first few above 32', () => {
        // Wider sweep. Every realm boundary is now capped at
        // MAX_BOUNDARY_CHANCE however well prepared the cultivator is, so even
        // the best build loses lives at each of the eight walls below the last
        // rung. Reaching Tribulation Transcendence is supposed to be the
        // outlier among outliers, and it wants a real sample to show up in.
        expect(bestOf('single_fire', 'sealed_vein', true, 2500)).toBeGreaterThanOrEqual(41);
    });
});

describe('neither half is sufficient alone', () => {
    it('luck alone is not enough - a vein with no comprehension stalls', () => {
        // The site without the understanding, the pill or the foundation.
        expect(bestOf('single_fire', 'sealed_vein', false)).toBeLessThanOrEqual(32);
    });

    it('talent and preparation alone are not enough without the site', () => {
        expect(bestOf('single_fire', 'dense', true)).toBeLessThanOrEqual(36);
    });
});

describe('talent is dealt once and luck cannot launder it', () => {
    it('never carries a muddled root above ordinal 32, however lucky', () => {
        // Everything going right, in the best place in the world. Still no.
        expect(bestOf('muddled_five_element', 'sealed_vein', true)).toBeLessThanOrEqual(32);
    });

    it('keeps a conflicted dual root out of the last realm', () => {
        expect(bestOf('dual_water_fire', 'sealed_vein', true)).toBeLessThan(41);
    });

    it('lets clean and mutated roots through, which is the point of drawing one', () => {
        for (const root of ['single_fire', 'single_metal', 'mutated_lightning'] as SpiritRootKey[]) {
            expect(bestOf(root, 'sealed_vein', true)).toBeGreaterThan(32);
        }
    });
});

describe('the ordinary paths did not move', () => {
    it('still tops out around Core Formation on ordinary qi', () => {
        expect(bestOf('single_fire', 'normal', false)).toBeLessThanOrEqual(20);
    });

    it('still needs what a player brings for Nascent Soul and above', () => {
        const bare = bestOf('single_fire', 'dense', false);
        const brought = bestOf('single_fire', 'dense', true);
        expect(brought).toBeGreaterThan(bare);
    });
});
