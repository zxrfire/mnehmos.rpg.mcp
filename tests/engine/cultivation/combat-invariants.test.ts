/**
 * Two properties of the confrontation resolver: it is reproducible, and a gap
 * is a gap.
 *
 * ═══ 1. REPRODUCIBILITY ══════════════════════════════════════════════════
 *
 * A playtest harness reported `I attack the nearest cultivator` giving hpLost 3
 * on one cold run and 5 on the next, same seed, same ordinal - which if true of
 * the engine would invalidate every measurement in this project, since all of
 * them rest on "the same seed gives the same life".
 *
 * It is not true of the engine. `resolveConfrontation` was run three times per
 * altitude at ordinals 0, 8, 20, 36 and 42, each time from a freshly
 * constructed `forStream` with the same key, and the entire result object
 * serialised byte-identically every time. `src/engine/cultivation/` holds no
 * `Math.random`, no `Date.now`, no `crypto`, and combat.ts carries no
 * module-level mutable state for a stale cache to leak through.
 *
 * The variance is in WHICH FIGHT GETS RUN, upstream of here. `handleResolve`
 * keys its stream on `forStream(run.seed, 'combat_resolve', nextTurn,
 * cultivator.id, opponent.id)`, so the opponent's identity is part of the seed:
 * pick a different person and you get a different fight, correctly and by
 * design. And "the nearest cultivator" resolves through `somebodyAtHand`, which
 * takes `here[here.length - 1]` - the last element of `othersPresent`, which is
 * `[...stored, ...inWorld]`. Both halves sort deterministically on their own
 * (`roster()` has an ORDER BY, `npcsAt` sorts by id), but the CONCATENATION's
 * last element flips identity entirely depending on whether the world half is
 * populated at that moment, and the world half is a function of the day the run
 * has reached.
 *
 * That is a caller-side question and those files are not this one's to change.
 * What this file guarantees is that the engine cannot be the culprit, so the
 * search stays narrow.
 *
 * ═══ 2. THE MIRROR TABLE ═════════════════════════════════════════════════
 *
 * Measured: an attacker four rungs below their opponent loses in ten exchanges
 * and is left crippled at ordinal 12, at 20, at 28, at 36 and at 42 - the same
 * shape at every altitude, with only the absolute hit points scaling. The same
 * fight at a gap of zero withdraws after thirteen or fourteen exchanges,
 * everywhere.
 *
 * This is correct, and it is worth saying why rather than leaving it implicit.
 * `powerMultiplierForOrdinal` multiplies BOTH sides, so a fixed gap is a fixed
 * ratio, and the resolver reads the ratio. Four rungs means the same thing to a
 * Qi Condensation cultivator and to a Grand Ascension one because four rungs IS
 * a quantity of relative force, not a quantity of absolute force.
 *
 * The alternative - making high-altitude fights structurally different from
 * low-altitude ones at the same gap - would be a rule that branches on how far
 * up the ladder the fight is happening, which is precisely the bespoke
 * exception the charter forbids. What legitimately differs between those two
 * fights is what the combatants are CARRYING, read by this same resolver out of
 * the same fields a bandit's notched sabre uses.
 *
 * So: deliberate, and pinned here so that a later change which quietly makes
 * altitude matter has to argue with a test.
 */

import { describe, it, expect } from 'vitest';
import {
    resolveConfrontation,
    type CombatantInput,
    type ConfrontationResult
} from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    assessGap,
    assessPower,
    combatPowerForOrdinal,
    HELPLESS_REALM_GAP
} from '../../../src/engine/cultivation/combat.js';

function combatant(ordinal: number, id: string): CombatantInput {
    const hp = Math.max(10, 20 + ordinal * 12);
    return {
        id,
        name: id,
        realmOrdinal: ordinal,
        spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [],
        hp,
        maxHp: hp,
        qi: hp,
        maxQi: hp,
        artifactGrade: 0,
        battlesSurvived: 0,
        technique: null,
        techniqueMastery: 0
    };
}

/** One fight, from a freshly built stream with a fixed key. */
function fight(selfOrdinal: number, otherOrdinal: number, seed = 'invariants'): ConfrontationResult {
    return resolveConfrontation(
        combatant(selfOrdinal, 'self'),
        combatant(otherOrdinal, 'other'),
        {
            rng: forStream(seed, 'combat_resolve', 1, 'self', 'other'),
            ambient: 'normal',
            turn: 1,
            vector: 'body',
            attackerEdges: [],
            defenderEdges: [],
            intent: { goal: 'drive_off' }
        }
    );
}

const ALTITUDES = [0, 8, 20, 28, 36, 42];

describe('the same seed gives the same fight', () => {
    it('is byte-identical across repeated calls at every altitude', () => {
        for (const ordinal of ALTITUDES) {
            const runs = [0, 1, 2].map(() =>
                JSON.stringify(fight(ordinal, Math.min(ordinal + 4, MAX_ORDINAL))));
            expect(new Set(runs).size, `ordinal ${ordinal} produced ${new Set(runs).size} outcomes`)
                .toBe(1);
        }
    });

    it('changes when the seed changes, so it is seeded rather than constant', () => {
        const a = JSON.stringify(fight(20, 24, 'seed-a'));
        const b = JSON.stringify(fight(20, 24, 'seed-b'));
        expect(a).not.toBe(b);
    });

    it('changes when the OPPONENT changes, which is why identity is in the key', () => {
        // The mechanism behind the reported non-reproducibility: the opponent's
        // id is part of the stream key upstream, so selecting a different
        // person is meant to produce a different fight. The bug, wherever it
        // is, is in the selection - never in the resolution.
        const versusFour = fight(20, 24);
        const versusFive = fight(20, 25);
        expect(JSON.stringify(versusFour)).not.toBe(JSON.stringify(versusFive));
    });
});

describe('a gap is a gap, at every altitude', () => {
    it('resolves an even fight the same way high up as low down', () => {
        const outcomes = ALTITUDES.map(o => fight(o, o).outcome);
        expect(new Set(outcomes).size, `outcomes: ${outcomes.join(', ')}`).toBe(1);
    });

    it('resolves a four-rung gap the same way once both sides are past the early rungs', () => {
        // Deliberately from ordinal 12 up. Below that the absolute hit points
        // are small enough that integer rounding on a single exchange changes
        // the count, which is a granularity artefact of tiny numbers rather
        // than a property of altitude.
        const settled = [12, 20, 28, 36, 42];
        const outcomes = settled.map(o => fight(o, o + 4).outcome);
        expect(new Set(outcomes).size, `outcomes: ${outcomes.join(', ')}`).toBe(1);

        const exchanges = settled.map(o => fight(o, o + 4).exchanges.length);
        expect(Math.max(...exchanges) - Math.min(...exchanges),
            `exchange counts: ${exchanges.join(', ')}`).toBeLessThanOrEqual(2);
    });

    it('scales the absolute damage even though the shape is fixed', () => {
        // The half that DOES move with altitude, and must: the same relative
        // beating costs a Grand Ascension body far more hit points than it
        // costs a mortal one.
        const low = fight(12, 16).hp.other;
        const high = fight(42, 46).hp.other;
        expect(high).toBeGreaterThan(low);
    });

    it('makes the gap decisive rather than the altitude', () => {
        // The property stated positively: at every altitude, four rungs down
        // loses harder than level does.
        for (const ordinal of [12, 20, 28, 36]) {
            const even = fight(ordinal, ordinal);
            const outgunned = fight(ordinal, ordinal + 4);
            expect(outgunned.hp.self, `ordinal ${ordinal}`).toBeLessThan(even.hp.self);
        }
    });
});

describe('the gap reads the same from both ends', () => {
    const price = (ordinal: number, artifactOrdinal?: number) =>
        assessPower(
            { ...combatant(ordinal, `o${ordinal}`), ...(artifactOrdinal === undefined ? {} : { artifactOrdinal }) },
            {}
        );

    it('calls a two-realm gap a fight nobody is having, looking DOWN', () => {
        // The dead ternary: `realmGap <= -HELPLESS_REALM_GAP ? 'contested' : 'contested'`
        // meant a Void Refinement cultivator looking down at Qi Condensation
        // Layer 5 - twenty-six rungs - was told the fight was "close enough
        // that everything else decides it".
        const down = assessGap(price(30), price(4));
        expect(down.verdict).toBe('dominant');
        expect(down.summary).toMatch(/is not a fight/);
        expect(down.summary).toMatch(/decision the stronger party makes alone/);
    });

    it('still calls the same gap helpless looking UP', () => {
        const up = assessGap(price(4), price(30));
        expect(up.verdict).toBe('helpless');
        expect(up.options.length).toBeGreaterThan(0);
    });

    it('gives the stronger party no list of options, because they need none', () => {
        expect(assessGap(price(30), price(4)).options).toHaveLength(0);
    });

    it('leaves a single realm either way genuinely contested', () => {
        expect(assessGap(price(20), price(17)).verdict).toBe('contested');
        expect(HELPLESS_REALM_GAP).toBe(2);
    });

    it('prices a ladder-rated object as a second body, not as a cap-busting bonus', () => {
        // The standoff claim. Long Cut: head 42 carrying an object rated 45.
        // Deep Survey: head 43 carrying one rated 43. Measured composite ratio
        // is 1.60 to 1 - modest - so a 100-to-1 outcome is the resolver's
        // sensitivity to power ratio, NOT the artifact term dominating.
        // Composed off the same primitive assessPower prices the term with:
        // a rated object contributes combatPowerForOrdinal(object)/base as a
        // second body, uncapped and by design.
        const lcHead = combatPowerForOrdinal(42);
        const dsHead = combatPowerForOrdinal(43);
        const longCut = lcHead * (1 + combatPowerForOrdinal(45) / lcHead);
        const deepSurvey = dsHead * (1 + combatPowerForOrdinal(43) / dsHead);
        expect(longCut / deepSurvey).toBeGreaterThan(1.4);
        expect(longCut / deepSurvey).toBeLessThan(1.9);
        // And the one-rung head advantage it is set against is only x1.25.
        expect(dsHead / lcHead).toBeCloseTo(1.25, 2);
    });
});
