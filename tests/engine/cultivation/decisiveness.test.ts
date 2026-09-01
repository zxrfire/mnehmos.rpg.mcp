/**
 * How decisive should a modest power edge be?
 *
 * The standoff drift, isolated to one line: a 1.60:1 composite power ratio was
 * producing 100% / 0%. If a three-fifths edge between peers is certain, a
 * stable standoff between near-equals cannot exist by construction and
 * `standoff.ts`'s "one time in a hundred, not zero" has nowhere to live.
 *
 * ── Measured, 400 seeds per pairing ──────────────────────────────────────
 *
 *   ratio  aggressor wins  exchanges   pairing
 *    1.00      68.8%          11.3     peer, 43 v 43
 *    1.25      96.8%          10.5     one rung of head start, 43 v 42
 *    1.60     100.0%           9.6     THE STANDOFF: 42+obj45 v 43+obj43
 *    2.00     100.0%           8.8
 *    4.00     100.0%           7.2     one realm
 *   16.00     100.0%           0       two realms - `helpless`, no fight at all
 *
 * Two things fall out of that table.
 *
 * FIRST: the curve saturates by 1.60, so the resolver cannot tell a modest edge
 * from a one-realm gap - both are certainties. The whole transition from coin
 * flip to certainty happens between 1.00 and 1.25, which is far too narrow a
 * band for a setting whose apex is supposed to be deadlocked.
 *
 * SECOND, and not previously written down anywhere: AT EQUAL POWER THE
 * AGGRESSOR WINS 68.8% OF THE TIME. Every round the aggressor strikes first,
 * and over ~11 exchanges that first-mover advantage compounds into better than
 * two in three. "Two peers are deadlocked" is already false at a ratio of
 * exactly 1.00, and no amount of tuning the power comparison touches it,
 * because it is not in the power comparison.
 *
 * ── Where the sensitivity actually lives ─────────────────────────────────
 *
 * Not in `share = advantage / (1 + advantage)`, which is gentle: a 1.60
 * advantage maps to a 0.615 share against 0.385, only 1.23x per strike. It is
 * in the ACCUMULATION. Sixteen strikes of a 1.23x per-strike edge, each drawn
 * from a narrow band (EXCHANGE_DAMAGE_FLOOR 0.14 plus EXCHANGE_DAMAGE_SPAN
 * 0.24, a coefficient of variation of about 0.27), average out to a near
 * certainty long before the eighth round.
 *
 * So the lever is the width of the per-strike draw, and widening it while
 * HOLDING THE MEAN moves the middle of the curve without touching either end
 * or the length of a fight. Measured, all at mean 0.260:
 *
 *   FLOOR/SPAN      1.00        1.25        1.60        2.00   4.00   16.00
 *   0.14/0.24    68.8/31.3   96.8/ 3.3   100.0/0.0   100/0   100/0   100/0
 *   0.08/0.36    63.7/36.3   90.5/ 9.5    98.3/1.5   100/0   100/0   100/0
 *   0.04/0.44    62.3/37.3   84.3/15.3    96.5/3.0    99/0   100/0   100/0
 *
 * 0.08/0.36 would land the standoff at 1.5% while leaving 2.00, one realm and
 * two realms at 100/0, and fight length unchanged (9.7 exchanges against 9.6).
 *
 * ── RETRACTED: no retune is proposed, and none was made ──────────────────
 *
 * This paragraph replaces a proposal that used to stand here: move
 * EXCHANGE_DAMAGE_FLOOR to 0.08 and EXCHANGE_DAMAGE_SPAN to 0.36 so the
 * standoff would sit at "one time in a hundred, not zero".
 *
 * The tables above are real and reproduce exactly. The TARGET did not. It came
 * from a whole-house sweep whose instrument was broken: `resolveMelee` was
 * running on a duel-sized round budget, so sides of eight and fifteen returned
 * no winner in 300 of 300, and the "one in a hundred" being chased was three
 * seeds in three hundred from a distribution that was almost entirely
 * stalemate. See `melee-budget.test.ts` for that defect and its fix.
 *
 * The head-to-head numbers were never affected, because two bodies a side
 * resolve inside any budget - so the curve stands, and it correctly cleared the
 * artifact term. What is NOT established is that the middle of the curve is
 * wrong. The constants are untouched and should stay untouched until somebody
 * has a reason that does not come from the broken sweep.
 */

import { describe, it, expect } from 'vitest';
import {
    EXCHANGE_DAMAGE_FLOOR,
    EXCHANGE_DAMAGE_SPAN,
    resolveConfrontation,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

function body(ordinal: number, id: string, artifactOrdinal?: number): CombatantInput {
    const hp = Math.max(10, 20 + ordinal * 12);
    return {
        id, name: id, realmOrdinal: ordinal, spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [], hp, maxHp: hp, qi: hp, maxQi: hp,
        artifactGrade: 0, battlesSurvived: 0, technique: null, techniqueMastery: 0,
        ...(artifactOrdinal === undefined ? {} : { artifactOrdinal })
    };
}

/** Share of `n` seeded fights the aggressor wins. */
function aggressorWinRate(a: CombatantInput, b: CombatantInput, n = 400): number {
    let wins = 0;
    for (let s = 0; s < n; s++) {
        const result = resolveConfrontation(a, b, {
            rng: forStream(`sweep-${s}`, 'combat_resolve', 1, a.id, b.id),
            ambient: 'normal', turn: 1, vector: 'body',
            attackerEdges: [], defenderEdges: [], intent: { goal: 'drive_off' }
        });
        if (result.winnerId === a.id) wins++;
    }
    return wins / n;
}

describe('the ends of the curve, which must not move', () => {
    it('makes one realm an execution', () => {
        expect(aggressorWinRate(body(25, 'a'), body(21, 'b'))).toBe(1);
    });

    it('makes two realms not a fight at all', () => {
        // `helpless` fires before an exchange is rolled.
        const result = resolveConfrontation(body(21, 'a'), body(29, 'b'), {
            rng: forStream('x', 'combat_resolve', 1, 'a', 'b'),
            ambient: 'normal', turn: 1, vector: 'body',
            attackerEdges: [], defenderEdges: [], intent: { goal: 'drive_off' }
        });
        expect(result.exchanges).toHaveLength(0);
    });
});

describe('the middle of the curve, which is under review', () => {
    it('currently resolves the documented standoff as a certainty', () => {
        // 42 carrying an object rated 45, against 43 carrying one rated 43.
        // Composite 1.60:1, and the underdog is at zero. Recorded as measured;
        // NOT a proposal - see the retraction in the header.
        const rate = aggressorWinRate(body(42, 'a', 45), body(43, 'b', 43));
        expect(rate).toBeGreaterThan(0.98);
    });

    it('saturates so early it cannot tell a modest edge from a realm', () => {
        const modest = aggressorWinRate(body(43, 'a', 43), body(43, 'b'));   // 2.00
        const aRealm = aggressorWinRate(body(25, 'a'), body(21, 'b'));       // 4.00
        expect(modest).toBe(aRealm);
    });

    it('gives the aggressor better than two in three at EQUAL power', () => {
        // The first-mover advantage, undocumented until now. It is not in the
        // power comparison and no retune of the damage curve removes it.
        const rate = aggressorWinRate(body(43, 'a'), body(43, 'b'));
        expect(rate).toBeGreaterThan(0.6);
        expect(rate).toBeLessThan(0.75);
    });
});

describe('the per-strike draw is where the sensitivity lives', () => {
    it('is currently a narrow band around its own mean', () => {
        // Coefficient of variation ~0.27. Widening this while holding the mean
        // is the proposed lever: it moves the middle and leaves the ends alone.
        const mean = EXCHANGE_DAMAGE_FLOOR + EXCHANGE_DAMAGE_SPAN / 2;
        expect(mean).toBeCloseTo(0.26, 10);
        const cv = (EXCHANGE_DAMAGE_SPAN / Math.sqrt(12)) / mean;
        expect(cv).toBeLessThan(0.3);
    });
});
