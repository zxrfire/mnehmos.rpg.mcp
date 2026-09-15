/**
 * An art that suits your root is never slower to learn than one that does not.
 *
 * THE DEFECT, AS FOUND
 * --------------------
 * Three sites priced a root match against PRACTICE - the cultivation rate and
 * mastery-per-day - and all three wrote it as
 * `(matched ? root.matchedTechniqueBonus / 2 : 1)`. That halves the whole
 * factor rather than the advantage inside it, so a x2.0 root match became x1.0
 * and every root below x2.0 came out UNDER the x1 an unmatched art gets. The
 * term was inverted for most of the world and nobody had written a number down
 * next to it.
 *
 * Measured on mastery-per-day, matched against unmatched:
 *
 *     single  x2.0 -> x1.00   worth nothing       40.5% of cultivators
 *     dual    x1.3 -> x0.65   a 35% penalty       18.0%
 *     triple  x1.2 -> x0.60   a 40% penalty        9.9%
 *     quad    x1.1 -> x0.55   a 45% penalty       11.7%
 *     muddled x1.0 -> x0.50   half speed          14.4%
 *     mutated x2.5 -> x1.25   the only gain        5.4%
 *
 * So 54.1% of cultivators learned an art of their own element MORE SLOWLY than
 * one they could not channel at all - a muddled root mastered a fire art at
 * half the rate of a lightning art - and for another 40.5% the match was worth
 * nothing whatever. Only 5.4% of the world got what the field is for.
 *
 * THE RULE PINNED HERE
 * --------------------
 * A root match is worth half as much to practising an art as to throwing one,
 * which is what `/ 2` was reaching for. Halving the ADVANTAGE says it:
 * `1 + (bonus - 1) / 2`, which is monotone in the root, never below 1, and
 * exactly half the combat bonus by construction rather than by two numbers
 * agreeing.
 *
 *     single 1.50   dual 1.15   triple 1.10   quad 1.05   muddled 1.00   mutated 1.75
 *
 * The muddled root landing on exactly 1.00 is correct and is the shape working:
 * `matchedTechniqueBonus` is 1.0 for that root, so it HAS no match advantage to
 * halve. What it no longer has is a penalty for drawing an art that suits it.
 *
 * It lives in one function because it is one rule. Three copies are how the
 * three sites drifted from the combat line without anybody noticing, and the
 * last assertion here is what stops a fourth copy appearing: the practice bonus
 * is derived from the combat bonus rather than restated beside it.
 *
 * RED-CHECKED: restoring `matched ? root.matchedTechniqueBonus / 2 : 1` inside
 * `practiceMatchBonus` fails 3 of the 4 below.
 */

import { describe, it, expect } from 'vitest';

import { practiceMatchBonus } from '../../../src/engine/cultivation/understanding.js';
import { SPIRIT_ROOTS, WEIGHT_TOTAL } from '../../../src/engine/cultivation/spirit-roots.js';

describe('a root match is worth something to practice, or nothing, never less', () => {
    it('never prices a matched art below an unmatched one', () => {
        // The whole defect, for every root in the game rather than for the one
        // a fixture happened to pick.
        for (const root of SPIRIT_ROOTS) {
            expect(
                practiceMatchBonus(root, true),
                `${root.key} is penalised for practising an art of its own element`
            ).toBeGreaterThanOrEqual(practiceMatchBonus(root, false));
        }
    });

    it('is worth nothing at all to nobody who has a match to be worth something', () => {
        // The other half: a term that is never a penalty is easy to get by
        // flattening it to 1, and that would be the same bug with the sign
        // removed. Every root that HAS an advantage must be paid for it.
        const paid = SPIRIT_ROOTS.filter(r => r.matchedTechniqueBonus > 1);
        expect(paid.length).toBeGreaterThan(0);
        for (const root of paid) {
            expect(practiceMatchBonus(root, true)).toBeGreaterThan(1);
        }
        // And a root with no advantage in a fight has none at a desk either.
        for (const root of SPIRIT_ROOTS.filter(r => r.matchedTechniqueBonus === 1)) {
            expect(practiceMatchBonus(root, true)).toBe(1);
        }
    });

    it('rises with the root, so a better root is never a worse student', () => {
        const ordered = [...SPIRIT_ROOTS].sort(
            (a, b) => a.matchedTechniqueBonus - b.matchedTechniqueBonus
        );
        for (let i = 1; i < ordered.length; i++) {
            expect(practiceMatchBonus(ordered[i], true))
                .toBeGreaterThanOrEqual(practiceMatchBonus(ordered[i - 1], true));
        }
    });

    it('is exactly half the combat advantage, derived rather than restated', () => {
        // What stops the fourth copy. If somebody reprices a root, practice
        // follows without anybody having to remember that it should.
        for (const root of SPIRIT_ROOTS) {
            const inAFight = root.matchedTechniqueBonus - 1;
            const atADesk = practiceMatchBonus(root, true) - 1;
            expect(atADesk).toBeCloseTo(inAFight / 2, 10);
        }
        // And the population this reaches, so the size of the correction is on
        // the record next to the rule.
        const slowedBefore = SPIRIT_ROOTS
            .filter(r => r.matchedTechniqueBonus / 2 < 1)
            .reduce((sum, r) => sum + r.weight, 0);
        expect(slowedBefore / WEIGHT_TOTAL).toBeCloseTo(0.54, 2);
    });
});
