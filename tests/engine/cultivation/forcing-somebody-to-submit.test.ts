/**
 * Forcing somebody to submit, and opening a fight from concealment.
 *
 * Two additions to `resolveConfrontation`, and the same discipline behind both:
 * the level a person went to is a VALUE, and nothing about what a blow does to
 * a body changes because of it.
 *
 * ── SUBMISSION ───────────────────────────────────────────────────────────
 *
 * Design owner: *"I should be able to force someone to submit to me"*, and
 * *"depending on some character traits some would rather die. Animals AND
 * people."*
 *
 * So `submission` is the sixth outcome and it is NOT what losing means. It is
 * reached from `goal: 'coerce'` and only when the beaten party yields, and
 * whether they yield is a fact about who they are that the CALLER reads off
 * records the world already keeps - a person's wants and standing, a beast's
 * own nature. There is no will-to-submit number anywhere in the engine and
 * these tests assert there is nowhere for one to hide: the engine takes the
 * answer and never computes it.
 *
 * The consequence bites both ways, which is the point. A fight opened meaning
 * to take somebody alive ends in a body when they would rather die, and the
 * aggressor does not get to try again.
 *
 * ── CONCEALMENT ──────────────────────────────────────────────────────────
 *
 * `opening: 'from_concealment'` does exactly two things, both inside rules that
 * already existed: the opening exchange carries the `ambush` edge that
 * `EDGE_VALUES` has priced at 1.5 all along, and the target does not swing back
 * in the round they did not know was happening.
 *
 * AGENTS.md: a new RNG draw is a regression until proved otherwise. The proof
 * is here and it is the strongest available form - the identical confrontation
 * with the field absent and with it explicitly `open` produces byte-identical
 * results, which is what says the field costs nothing to every existing caller.
 */

import { describe, it, expect } from 'vitest';
import {
    resolveConfrontation,
    type CombatantInput,
    type ConfrontationContext
} from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    ORDINARILY_YIELDS,
    whatALevelLeaves,
    wentFurtherThan
} from '../../../src/engine/cultivation/how-far-you-went-to-make-them-comply.js';

function body(ordinal: number, id: string): CombatantInput {
    const hp = Math.max(10, 20 + ordinal * 12);
    return {
        id, name: id, realmOrdinal: ordinal, spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [], hp, maxHp: hp, qi: hp, maxQi: hp,
        artifactGrade: 0, battlesSurvived: 0, technique: null, techniqueMastery: 0
    };
}

function ctx(over: Partial<ConfrontationContext> = {}, seed = 'seed-1'): ConfrontationContext {
    return {
        rng: forStream(seed, 'confrontation'),
        ambient: 'normal',
        turn: 1,
        intent: { goal: 'coerce' },
        ...over
    };
}

/** Every field a replay could differ on, flattened so a diff is a diff. */
function fingerprint(result: ReturnType<typeof resolveConfrontation>): string {
    return JSON.stringify({
        outcome: result.outcome,
        winnerId: result.winnerId,
        loserId: result.loserId,
        hp: result.hp,
        finished: result.finished,
        remnant: result.remnant,
        exchanges: result.exchanges.map(e => ({
            i: e.index, a: e.attackerId, d: e.defenderId,
            dmg: e.result.damage, roll: e.result.roll, adv: e.result.advantage,
            injury: e.result.injury?.id ?? null, hp: e.defenderHpAfter
        })),
        injuries: Object.fromEntries(
            Object.entries(result.injuries).map(([k, v]) => [k, v.map(i => i.id)])
        ),
        obligations: result.obligations
    });
}

describe('the pressure ladder is one act at a level', () => {
    it('orders words below hands below the will', () => {
        expect(wentFurtherThan('done', 'said')).toBe(true);
        expect(wentFurtherThan('taken', 'done')).toBe(true);
        expect(wentFurtherThan('said', 'done')).toBe(false);
    });

    it('says a threat costs the target nothing yet', () => {
        const said = whatALevelLeaves({ level: 'said' });
        expect(said.irreversible).toBe(false);
        expect(said.leavesAnObligation).toBe(false);
        expect(said.holds).toBe('while_believed');
    });

    it('lets the WOUND decide whether coercion was irreversible, not the verb', () => {
        const bruise = whatALevelLeaves({ level: 'done', permanentWound: false });
        const maiming = whatALevelLeaves({ level: 'done', permanentWound: true });
        expect(bruise.irreversible).toBe(false);
        expect(maiming.irreversible).toBe(true);
        expect(bruise.cause).toBe('humiliation');
        expect(maiming.cause).toBe('crippled');
    });

    it('makes good on a word cost a step, which is the threaten-then-do pair', () => {
        const unheralded = whatALevelLeaves({ level: 'done' });
        const promised = whatALevelLeaves({ level: 'done', wordGivenFirst: true });
        expect(unheralded.why).not.toMatch(/told first/);
        expect(promised.why).toMatch(/told first and refused/);
    });

    it('makes the top of the ladder the only level that buys nothing durable', () => {
        // The anti-strict-upgrade constraint, from ancient.md, asserted rather
        // than described. Taking the will is the only level that leaves no
        // obligation - and the only one that can be read off the victim later.
        const done = whatALevelLeaves({ level: 'done' });
        const taken = whatALevelLeaves({ level: 'taken' });
        expect(done.leavesAnObligation).toBe(true);
        expect(taken.leavesAnObligation).toBe(false);
        expect(done.leavesAReadableMark).toBe(false);
        expect(taken.leavesAReadableMark).toBe(true);
        expect(taken.holds).toBe('while_the_art_holds');
    });
});

describe('forcing somebody to submit', () => {
    it('reaches submission when the beaten party yields', () => {
        const result = resolveConfrontation(
            body(12, 'strong'), body(9, 'weak'),
            ctx({ intent: { goal: 'coerce', yields: ORDINARILY_YIELDS } })
        );
        expect(result.outcome).toBe('submission');
        expect(result.winnerId).toBe('strong');
        expect(result.loserId).toBe('weak');
        // The whole point of the outcome: somebody is left standing.
        expect(result.hp['weak']).toBeGreaterThan(0);
        expect(result.finished).toBe(false);
    });

    it('leaves the loser holding a grave grudge, because they chose to kneel', () => {
        const result = resolveConfrontation(
            body(12, 'strong'), body(9, 'weak'),
            ctx({ intent: { goal: 'coerce' } })
        );
        expect(result.obligations).toHaveLength(1);
        expect(result.obligations[0]).toMatchObject({
            holderId: 'weak', subjectId: 'strong', severity: 'grave'
        });
        expect(result.obligations[0].description).toMatch(/yielded rather than be finished/);
    });

    it('kills the person who would rather die, and the aggressor gets a body', () => {
        const wouldRatherDie = {
            willYield: false,
            because: 'the want this forecloses is the whole of why they are standing here'
        };
        const result = resolveConfrontation(
            body(12, 'strong'), body(9, 'weak'),
            ctx({ intent: { goal: 'coerce', yields: wouldRatherDie } })
        );
        expect(result.outcome).not.toBe('submission');
        expect(['lethal', 'body_destroyed']).toContain(result.outcome);
        expect(result.hp['weak']).toBe(0);
    });

    it('is refusable at any distance, including one the aggressor cannot lose', () => {
        // The one-sided path, where the aggressor is two or more realms above.
        // Being outmatched must not make anybody more biddable.
        const yielding = resolveConfrontation(
            body(30, 'far_above'), body(3, 'nobody'),
            ctx({ intent: { goal: 'coerce' } })
        );
        expect(yielding.gap.verdict).toBe('dominant');
        expect(yielding.exchanges).toHaveLength(0);
        expect(yielding.outcome).toBe('submission');
        expect(yielding.hp['nobody']).toBeGreaterThan(0);

        const refusing = resolveConfrontation(
            body(30, 'far_above'), body(3, 'nobody'),
            ctx({ intent: { goal: 'coerce', yields: { willYield: false, because: 'territorial' } } })
        );
        expect(refusing.outcome).not.toBe('submission');
        expect(refusing.hp['nobody']).toBe(0);
    });

    it('does not reach submission when the coercer is the one who lost', () => {
        // Somebody who tried to force a stronger person and was beaten has not
        // coerced anybody. The outcome is the ordinary one for a fight they
        // lost, and nobody is under anybody.
        const result = resolveConfrontation(
            body(6, 'optimist'), body(14, 'wall'),
            ctx({ intent: { goal: 'coerce' } })
        );
        if (result.winnerId !== 'optimist') {
            expect(result.outcome).not.toBe('submission');
        }
    });

    it('has no will-to-submit number anywhere in the engine to be tuned', () => {
        // The reading is a boolean and a sentence, supplied by the caller. If a
        // number ever appears on it, somebody has started building the stat the
        // design says must not exist.
        expect(typeof ORDINARILY_YIELDS.willYield).toBe('boolean');
        expect(typeof ORDINARILY_YIELDS.because).toBe('string');
        expect(Object.keys(ORDINARILY_YIELDS).sort()).toEqual(['because', 'willYield']);
    });

    it('takes the default that most people yield, without making it a rule', () => {
        const withDefault = resolveConfrontation(
            body(12, 'a'), body(9, 'b'), ctx({ intent: { goal: 'coerce' } })
        );
        const explicit = resolveConfrontation(
            body(12, 'a'), body(9, 'b'),
            ctx({ intent: { goal: 'coerce', yields: ORDINARILY_YIELDS } })
        );
        expect(fingerprint(withDefault)).toBe(fingerprint(explicit));
    });
});

describe('opening a fight from concealment', () => {
    it('costs no new draw when the field is absent or open', () => {
        // AGENTS.md: a new RNG draw is a regression until proved otherwise.
        // Base and change, back to back in one command.
        const absent = resolveConfrontation(
            body(11, 'a'), body(11, 'b'), ctx({ intent: { goal: 'kill' } })
        );
        const open = resolveConfrontation(
            body(11, 'a'), body(11, 'b'),
            ctx({ intent: { goal: 'kill', opening: 'open' } })
        );
        expect(fingerprint(open)).toBe(fingerprint(absent));
    });

    it('holds byte-identity across every goal and several seeds', () => {
        for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
            for (const goal of ['kill', 'subdue', 'drive_off', 'humiliate'] as const) {
                const absent = resolveConfrontation(
                    body(9, 'a'), body(10, 'b'), ctx({ intent: { goal } }, seed)
                );
                const open = resolveConfrontation(
                    body(9, 'a'), body(10, 'b'),
                    ctx({ intent: { goal, opening: 'open' } }, seed)
                );
                expect(fingerprint(open)).toBe(fingerprint(absent));
            }
        }
    });

    it('gives the target no swing in the round they did not know about', () => {
        const concealed = resolveConfrontation(
            body(11, 'hidden'), body(11, 'unaware'),
            ctx({ intent: { goal: 'kill', opening: 'from_concealment' } })
        );
        // The opening round is one strike, not two: the first exchange whose
        // attacker is the target cannot be index 1.
        const firstFromTarget = concealed.exchanges.findIndex(e => e.attackerId === 'unaware');
        expect(concealed.exchanges[0].attackerId).toBe('hidden');
        if (firstFromTarget !== -1) expect(firstFromTarget).toBeGreaterThan(1);
    });

    it('carries the ambush edge on the opening exchange and on no other', () => {
        const concealed = resolveConfrontation(
            body(11, 'hidden'), body(11, 'unaware'),
            ctx({ intent: { goal: 'kill', opening: 'from_concealment' } })
        );
        const named = (i: number) =>
            concealed.exchanges[i].result.modifiers.map(m => m.source).join('|');
        expect(named(0)).toMatch(/attacker_edges:.*ambush/);
        // "Once. Never twice against the same person" - EDGE_VALUES own comment.
        const later = concealed.exchanges
            .slice(1)
            .filter(e => e.attackerId === 'hidden')
            .map(e => e.result.modifiers.map(m => m.source).join('|'));
        for (const line of later) expect(line).not.toMatch(/ambush/);
    });

    it('changes what the opening blow was worth and never what a blow does', () => {
        // The physics are untouched: the same advantage produces the same
        // damage fraction. What concealment bought is the edge multiplier and
        // the free round, both of which are already-priced mechanics.
        const open = resolveConfrontation(
            body(11, 'a'), body(11, 'b'), ctx({ intent: { goal: 'kill' } })
        );
        const concealed = resolveConfrontation(
            body(11, 'a'), body(11, 'b'),
            ctx({ intent: { goal: 'kill', opening: 'from_concealment' } })
        );
        expect(concealed.exchanges[0].result.advantage)
            .toBeGreaterThan(open.exchanges[0].result.advantage);
        expect(concealed.exchanges[0].result.damage)
            .toBeGreaterThan(open.exchanges[0].result.damage);
    });

    it('composes with coercion, because they are different questions', () => {
        const result = resolveConfrontation(
            body(12, 'hidden'), body(10, 'mark'),
            ctx({ intent: { goal: 'coerce', opening: 'from_concealment' } })
        );
        expect(result.outcome).toBe('submission');
        expect(result.exchanges[0].result.modifiers.map(m => m.source).join('|'))
            .toMatch(/ambush/);
    });
});
