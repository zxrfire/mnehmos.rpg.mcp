/**
 * The prose a confrontation returns must describe the confrontation it had.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * Found by playing, at ordinal 45 attacking ordinal 29:
 *
 *   "There was no exchange to resolve. Broken off. Both parties are worse
 *    than they were, the wounds are real, and nothing is settled."
 *
 * Two statements that cannot both be true, in consecutive sentences, over a
 * result where the aggressor was untouched at full HP and the defender was at
 * a fifth of theirs with a wound that does not close. The cause was a
 * `narrationHint` ASSEMBLED from two fragments that did not know about each
 * other: the one-sided path's own opening line, and `describeOutcome`, which
 * is written for a contested fight and assumes throughout that two people
 * traded blows.
 *
 * ── WHAT IS ASSERTED HERE ────────────────────────────────────────────────
 *
 * Not the wording. The wording will move. What is asserted is that the
 * SENTENCE AGREES WITH THE ROW: if a side took nothing, the prose does not say
 * both sides are worse off; if the matter was settled in one action, the prose
 * does not say nothing is settled; and if a consequence was applied, the prose
 * names it. Those are properties of the resolution, so they are checked
 * against `hp`, `injuries` and `exchanges` rather than against a string.
 *
 * The asymmetry that pointed at the bug is kept as a control: attacking
 * somebody far ABOVE was always gated correctly, and must stay that way.
 */

import { describe, expect, it } from 'vitest';
import {
    HELPLESS_REALM_GAP,
    resolveConfrontation,
    type CombatantInput,
    type ConfrontationIntent,
    type ConfrontationResult
} from '../../../src/engine/cultivation/combat.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { maxHpForOrdinal } from '../../../src/engine/cultivation/realms.js';

const GOALS: Array<ConfrontationIntent['goal']> = ['kill', 'subdue', 'humiliate', 'drive_off'];

/** Sentences that are only ever true of a fight both parties took part in. */
const MUTUAL_CLAIMS = [
    'Both parties are worse than they were',
    'Both are hurt, both are still standing',
    'Neither could finish it'
];

/** Sentences that are only ever true when the matter was left open. */
const UNSETTLED_CLAIMS = ['nothing is settled'];

function fighter(id: string, ordinal: number, overrides: Partial<CombatantInput> = {}): CombatantInput {
    const maxHp = maxHpForOrdinal(3, ordinal);
    return {
        id,
        name: id,
        realmOrdinal: ordinal,
        spiritRoot: 'single_fire',
        attributes: { might: 3, insight: 3, fortune: 3, charm: 3 },
        hp: maxHp,
        maxHp,
        qi: maxHp,
        maxQi: maxHp,
        injuries: [],
        technique: null,
        weapon: null,
        ...overrides
    } as CombatantInput;
}

function fight(
    aggressorOrdinal: number,
    defenderOrdinal: number,
    goal: ConfrontationIntent['goal'],
    seed: string,
    /** What the defender is like, where the test is about their decision. */
    over: { bearing?: CombatantInput['bearing'] } = {}
): { result: ConfrontationResult; a: CombatantInput; d: CombatantInput } {
    const a = fighter('aggressor', aggressorOrdinal);
    const d = { ...fighter('defender', defenderOrdinal), ...over };
    return {
        a, d,
        result: resolveConfrontation(a, d, {
            rng: new CultivationRNG(seed),
            ambient: 'normal',
            turn: 1,
            intent: { goal, willWithdraw: true }
        })
    };
}

describe('a side that took nothing is not described as worse off', () => {
    it('holds across every goal and every gap, in both directions', () => {
        // The whole matrix rather than the one case that was played, because
        // the fragment-assembly this replaces was reachable from four goals
        // and the report only ever saw one of them.
        const offences: string[] = [];
        for (const goal of GOALS) {
            for (const [ao, dof] of [[45, 29], [29, 45], [29, 29], [20, 17], [17, 20], [45, 45], [0, 0]]) {
                for (let seed = 0; seed < 12; seed++) {
                    const { result, a, d } = fight(ao, dof, goal, `matrix-${goal}-${ao}-${dof}-${seed}`);
                    const aggressorHurt = result.hp[a.id] < a.hp;
                    const defenderHurt = result.hp[d.id] < d.hp;
                    const bothHurt = aggressorHurt && defenderHurt;
                    for (const claim of MUTUAL_CLAIMS) {
                        if (result.narrationHint.includes(claim) && !bothHurt) {
                            offences.push(
                                `[${goal} ${ao}v${dof} seed ${seed}] "${claim}" but hp went ` +
                                `${a.hp}->${result.hp[a.id]} and ${d.hp}->${result.hp[d.id]}`
                            );
                        }
                    }
                }
            }
        }
        expect(offences.slice(0, 5)).toEqual([]);
    });
});

describe('a resolution that settled something does not say nothing was settled', () => {
    it('a one-sided resolution names a winner, so it is settled', () => {
        for (const goal of GOALS) {
            const { result } = fight(45, 29, goal, `settled-${goal}`);
            expect(result.exchanges).toHaveLength(0);
            expect(result.winnerId).toBe('aggressor');
            for (const claim of UNSETTLED_CLAIMS) {
                expect(result.narrationHint, `goal ${goal}`).not.toContain(claim);
            }
        }
    });

    it('and it does not claim the encounter was nothing while applying consequences', () => {
        // The second half of the report: under a narrator the opponent gained
        // an injury while the text said nothing had happened. Whatever the
        // resolution applied, the sentence has to carry it.
        for (const goal of GOALS) {
            const { result, d } = fight(45, 29, goal, `consequence-${goal}`);
            const wounds = result.injuries[d.id];
            const hpLeft = result.hp[d.id];
            expect(hpLeft).toBeLessThan(d.hp);
            expect(result.narrationHint).toContain(`${hpLeft}`);
            if (wounds.length > 0) {
                expect(result.narrationHint, `goal ${goal} applied a wound and did not say so`)
                    .toContain(wounds[0].severity);
            }
        }
    });
});

describe('the far-above direction', () => {
    /**
     * THIS USED TO ASSERT THAT IT COST THE SWINGER NOTHING, and that was the
     * defect written down as a contract.
     *
     * A player at Qi Condensation swung at a cultivator five realms up, at a
     * power ratio of 2414 to 1, and the engine refused the swing and printed a
     * menu of four things that would work instead. The design owner: *"it can't
     * be refused. You swing at a cultivator way above you... you break your arm,
     * maybe you just die, or they laugh at your bravery and give you something.
     * This should fall out."*
     *
     * Refusing was the engine protecting a player from their own decision. The
     * world does not stop a mortal who swings at an immortal; it consumes them,
     * or is amused by them, and either way something happens.
     *
     * What is UNCHANGED, and is what this file's control was really for: it is
     * still not a fight. The aggressor still cannot reach them, still gets no
     * exchange of their own, and still cannot win. What changed is that the
     * stronger party now does something, and the default is to answer once.
     */
    it('lets the swing land on the swinger, and still is not a fight', () => {
        const { result, a, d } = fight(29, 45, 'drive_off', 'control');
        expect(result.narrationHint).toContain('cannot reach');
        // Not a contest, and not a win for anybody who was contesting.
        expect(['no_contest', 'lethal']).toContain(result.outcome);
        // THE SWING COST SOMETHING. That is the whole of the change.
        expect(result.hp[a.id]).toBeLessThan(a.hp);
        // And nothing touched the person far above.
        expect(result.hp[d.id]).toBe(d.hp);
        // The decision is recorded, because the world layer has to act on it.
        expect(result.theirDecision).toBeTruthy();
    });

    /**
     * AND SOMEBODY OPEN-HANDED IS AMUSED INSTEAD, which is the third of the
     * owner's three outcomes and the one that turns a hopeless swing into the
     * genre's oldest turning point.
     */
    it('leaves them standing when the person above them is amused', () => {
        const { result, a } = fight(29, 45, 'drive_off', 'amused', {
            bearing: { push: 0, room: 0, openHanded: 1 }
        });
        expect(result.theirDecision).toBe('indulges');
        expect(result.hp[a.id]).toBe(a.hp);
        expect(result.injuries[a.id]).toHaveLength(0);
    });

    it('finishes it when the person above them is the sort who does', () => {
        const { result, a } = fight(29, 45, 'drive_off', 'finisher', {
            bearing: { push: 1, room: 0, openHanded: 0 }
        });
        expect(result.theirDecision).toBe('kills');
        expect(result.hp[a.id]).toBeLessThan(a.hp);
    });

    it('the gap that gates it is the same constant in both directions', () => {
        // Two realms is four rungs of Foundation and above, so the two arms are
        // built off `HELPLESS_REALM_GAP` rather than off a written-in number
        // that would drift from it.
        expect(HELPLESS_REALM_GAP).toBe(2);
        const up = fight(21, 21 + HELPLESS_REALM_GAP * 4, 'drive_off', 'gap-up');
        const down = fight(21 + HELPLESS_REALM_GAP * 4, 21, 'drive_off', 'gap-down');
        expect(up.result.outcome).toBe('no_contest');
        expect(down.result.exchanges).toHaveLength(0);
        expect(down.result.winnerId).toBe('aggressor');
    });
});

describe('a one-blow withdrawal is not a mutual one', () => {
    it('when the first strike ends it, the winner is not described as hurt', () => {
        // Reachable in ordinary play by swinging at somebody who is already
        // hurt: the aggressor strikes first, and a blow that puts an
        // already-low defender under the withdrawal threshold breaks the loop
        // before the defender ever answers. The winner is then untouched and
        // the withdrawal line used to say both parties were worse off.
        //
        // A fresh defender cannot produce this - one exchange tops out at
        // `EXCHANGE_DAMAGE_FLOOR + EXCHANGE_DAMAGE_SPAN` of a pool and the
        // threshold is three quarters of it - which is exactly why it went
        // unnoticed.
        const maxHp = maxHpForOrdinal(3, 20);
        const a = fighter('aggressor', 24);
        const d = fighter('defender', 20, { hp: Math.round(maxHp * 0.3) });

        let found = 0;
        for (let seed = 0; seed < 60 && found < 3; seed++) {
            const result = resolveConfrontation(a, d, {
                rng: new CultivationRNG(`oneblow-${seed}`),
                ambient: 'normal',
                turn: 1,
                intent: { goal: 'drive_off', willWithdraw: true }
            });
            if (result.outcome !== 'withdrawal') continue;
            if (result.hp[a.id] !== a.hp) continue;
            found++;
            expect(result.exchanges).toHaveLength(1);
            expect(result.narrationHint).not.toContain('Both parties are worse than they were');
        }
        expect(found, 'no one-blow withdrawal occurred in 60 seeds; the search is stale')
            .toBeGreaterThan(0);
    });
});
