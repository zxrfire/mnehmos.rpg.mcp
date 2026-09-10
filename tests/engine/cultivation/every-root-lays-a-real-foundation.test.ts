/**
 * Two spirit roots in six always laid a damaged foundation, and printed NaN.
 *
 * FOUND BY AUDIT. `ROOT_FOUNDATION_SCORE` was typed `Record<string, number>`
 * and held FOUR of the catalog's SIX grades:
 *
 *     single, mutated, dual, muddled        - and not triple, and not quad
 *
 * So for a triple or quad root the lookup returned `undefined`, the factor sum
 * went to `NaN`, and `FOUNDATION_THRESHOLDS.find(t => NaN >= t.min)` matched
 * nothing at all - every comparison against NaN is false - which fell through
 * the `?? 'damaged'` at the end.
 *
 * The consequence is as bad as this engine gets. Foundation Establishment is
 * the one crossing in a run that can never be retaken, and its quality is read
 * for the rest of that cultivator's life. Anybody born with a triple or quad
 * root laid a damaged foundation no matter what they prepared, what pill they
 * burned, what ground they sat on or how clear their meridians were - and the
 * reading printed `score NaN` at them while it happened.
 *
 * Nothing threw. The arithmetic quietly stopped being arithmetic.
 *
 * ── THE FIX IS THE TYPE, NOT THE TWO NUMBERS ─────────────────────────────
 *
 * `Record<string, number>` is what let a grade go missing without a word.
 * `Record<SpiritRootGrade, number>` makes a seventh grade a compile error at
 * that table instead of a NaN in somebody's run, and that is the half that
 * stops this returning.
 *
 * The two values are not invented either. The catalog already orders itself by
 * `cultivationSpeed` - mutated 1.80, single 1.50, dual 1.00, triple 0.85, quad
 * 0.70, muddled 0.55 - and the new scores sit where that ordering puts them,
 * interpolated between the dual and muddled scores that were already there.
 */

import { describe, it, expect } from 'vitest';

import { assessFoundation } from '../../../src/engine/cultivation/foundation';
import { SPIRIT_ROOTS } from '../../../src/engine/cultivation/spirit-roots';

/** One of each grade the catalog actually ships. */
const ONE_OF_EACH_GRADE = (() => {
    const seen = new Map<string, typeof SPIRIT_ROOTS[number]>();
    for (const root of SPIRIT_ROOTS) if (!seen.has(root.grade)) seen.set(root.grade, root);
    return [...seen.values()];
})();

const wellPrepared = (rootKey: string) => assessFoundation(
    {
        spiritRoot: rootKey,
        attributes: { might: 2, insight: 2, fortune: 2, charm: 2 },
        injuries: []
    } as never,
    { preparation: 1, hurried: false, ambient: 'normal', pillPotency: 0 } as never,
    0.5
);

describe('every spirit root lays a real foundation', () => {
    /**
     * THE ASSERTION THAT WOULD HAVE CAUGHT IT. Six grades ship; six grades have
     * to produce a number.
     */
    it.each(ONE_OF_EACH_GRADE.map(r => [r.grade, r.key] as const))(
        'scores a %s root as a number rather than NaN', (_grade, key) => {
            const got = wellPrepared(key);
            expect(Number.isFinite(got.score)).toBe(true);
            expect(got.narrationHint).not.toMatch(/NaN/);
        });

    /**
     * AND A WELL-PREPARED CROSSING IS NOT AUTOMATICALLY RUINED.
     *
     * The sharp end of the defect: preparation, a clear set of meridians and
     * ordinary ground bought a triple root exactly nothing, because the sum was
     * NaN before any of it was added.
     */
    it.each(ONE_OF_EACH_GRADE.map(r => [r.grade, r.key] as const))(
        'lets a %s root who prepared lay something better than damaged', (_grade, key) => {
            expect(wellPrepared(key).quality).not.toBe('damaged');
        });

    /**
     * AND THE ROOT STILL MATTERS, in the order the catalog itself uses.
     *
     * `cultivationSpeed` is the catalog's own ranking and these scores follow
     * it. What is asserted is the ORDER, not the numbers: a better root lays a
     * better foundation from identical preparation, which is the whole reason
     * the factor exists.
     */
    it('orders the grades the way the catalog orders them', () => {
        const scoreOf = (grade: string) => {
            const root = ONE_OF_EACH_GRADE.find(r => r.grade === grade);
            return root ? wellPrepared(root.key).score : Number.NaN;
        };
        expect(scoreOf('single')).toBeGreaterThan(scoreOf('dual'));
        expect(scoreOf('dual')).toBeGreaterThan(scoreOf('triple'));
        expect(scoreOf('triple')).toBeGreaterThan(scoreOf('quad'));
        expect(scoreOf('quad')).toBeGreaterThan(scoreOf('muddled'));
    });

    /**
     * AND NO GRADE IS MISSING FROM THE TABLE.
     *
     * The ratchet. It is the same question the type now asks at compile time,
     * asked again here against the catalog as SHIPPED - because a grade could
     * be added to the catalog and the table without anybody checking that the
     * two lists are the same list.
     */
    it('has a score for every grade the catalog ships', () => {
        const scored = ONE_OF_EACH_GRADE.filter(r => Number.isFinite(wellPrepared(r.key).score));
        expect(scored.length).toBe(ONE_OF_EACH_GRADE.length);
        // And the catalog really does ship six. If this ever drops, somebody
        // deleted a root rather than fixed a table.
        expect(ONE_OF_EACH_GRADE.length).toBeGreaterThanOrEqual(6);
    });
});
