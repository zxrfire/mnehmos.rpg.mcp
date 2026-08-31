/**
 * Cultivation combat.
 *
 * The tests are organised by the five rules at the top of `combat.ts`, in the
 * order they bind, because the rules are the design and everything else in the
 * module is arithmetic in service of them.
 */

import {
    ALL_EDGES,
    EDGE_VALUES,
    HELPLESS_REALM_GAP,
    MAX_EDGE_MULTIPLIER,
    MAX_EXCHANGES,
    REAL_OPTIONS,
    SOUL_ART_MIN_ORDINAL,
    WITHIN_REALM_PEAK,
    assessEdges,
    assessGap,
    assessPower,
    attemptFlight,
    canDirectAtSoul,
    canUseTechnique,
    combatPowerForOrdinal,
    resolveConfrontation,
    resolveExchange,
    rollInitiative,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    MAX_ORDINAL,
    REALM_TIERS,
    powerMultiplierForOrdinal,
    realmForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import type { Technique } from '../../../src/schema/cultivation.js';
import { makeInjuries } from './fixtures.js';

// ─────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────

function combatant(overrides: Partial<CombatantInput> = {}): CombatantInput {
    const maxHp = overrides.maxHp ?? 100;
    return {
        id: 'a',
        name: 'Subject',
        realmOrdinal: 10,
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [],
        hp: maxHp,
        maxHp,
        qi: 50,
        maxQi: 50,
        ...overrides
    };
}

function art(overrides: Partial<Technique> = {}): Technique {
    return {
        id: 'test-art',
        name: 'Test Art',
        category: 'attack',
        grade: 'mortal',
        element: 'fire',
        requiredOrdinal: 0,
        qiCost: 5,
        damage: '2d6',
        mastery: 0.5,
        description: '',
        cooldown: 0,
        ...overrides
    };
}

const NEUTRAL = { ambient: 'normal' as const };
const rng = (seed: string) => new CultivationRNG(seed);

/** Ordinal of the first rank of a named realm, so tests never hardcode one. */
function realmStart(key: string): number {
    return REALM_TIERS.find(t => t.key === key)!.ordinalStart;
}

// ═════════════════════════════════════════════════════════════════════════
// RULE 3 - POWER IS COMPOSITE
// Tested first because everything else reads its output.
// ═════════════════════════════════════════════════════════════════════════

describe('assessPower', () => {
    it('reports factors that multiply, in listed order, to exactly the total', () => {
        const power = assessPower(combatant({ realmOrdinal: 18 }), NEUTRAL);

        let product = power.realmBase;
        for (const factor of power.factors) product *= factor.factor;

        expect(product).toBe(power.total);
    });

    it('itemises every axis the charter says must separate two cultivators', () => {
        const power = assessPower(combatant(), NEUTRAL);
        expect(power.factors.map(f => f.source)).toEqual([
            'body', 'soul', 'comprehension', 'technique',
            'artifacts', 'experience', 'environment', 'condition'
        ]);
        for (const factor of power.factors) {
            expect(factor.note.length, factor.source).toBeGreaterThan(0);
        }
    });

    it('lets two cultivators at one ordinal differ enormously, and says which line did it', () => {
        const ordinary = assessPower(combatant({ realmOrdinal: 18 }), NEUTRAL);
        const formidable = assessPower(
            combatant({
                realmOrdinal: 18,
                attributes: { might: 3, insight: 4, fortune: 1, charm: 2 },
                artifactGrade: 4,
                battlesSurvived: 40,
                technique: art({ mastery: 1 }),
                techniqueMastery: 1
            }),
            NEUTRAL
        );

        expect(formidable.ordinal).toBe(ordinary.ordinal);
        expect(formidable.total).toBeGreaterThan(ordinary.total * 2);

        const line = (p: typeof ordinary, source: string) =>
            p.factors.find(f => f.source === source)!.factor;
        expect(line(formidable, 'artifacts')).toBeGreaterThan(line(ordinary, 'artifacts'));
        expect(line(formidable, 'experience')).toBeGreaterThan(line(ordinary, 'experience'));
        expect(line(formidable, 'technique')).toBeGreaterThan(line(ordinary, 'technique'));
    });

    it('prices untreated wounds down and never up', () => {
        const whole = assessPower(combatant(), NEUTRAL);
        const hurt = assessPower(
            combatant({ injuries: makeInjuries(3, 'serious'), hp: 30 }),
            NEUTRAL
        );
        expect(hurt.total).toBeLessThan(whole.total);
    });

    it('gives a carver nothing from ambient qi, because they do not draw on it', () => {
        const thin = assessPower(
            combatant({ traditionId: 'tradition-cut' }),
            { ambient: 'thin' }
        );
        const dense = assessPower(
            combatant({ traditionId: 'tradition-cut' }),
            { ambient: 'dense' }
        );
        expect(thin.total).toBe(dense.total);

        // The other road very much does care where it is standing.
        const drawnThin = assessPower(combatant(), { ambient: 'thin' });
        const drawnDense = assessPower(combatant(), { ambient: 'dense' });
        expect(drawnDense.total).toBeGreaterThan(drawnThin.total);
    });

    it('carries the kill requirement on the priced combatant', () => {
        const carver = assessPower(
            combatant({ traditionId: 'tradition-cut', realmOrdinal: 30 }),
            NEUTRAL
        );
        expect(carver.kill.soulAttackWorks).toBe(false);
        expect(carver.kill.remnant).toBe('seam');
    });
});

describe('combatPowerForOrdinal', () => {
    it('keeps the categorical step between realms', () => {
        for (let i = 1; i < REALM_TIERS.length; i++) {
            const below = REALM_TIERS[i - 1];
            const here = REALM_TIERS[i];
            expect(combatPowerForOrdinal(here.ordinalStart))
                .toBeGreaterThan(combatPowerForOrdinal(below.ordinalStart));
        }
    });

    it('makes a realm Perfection worth exactly WITHIN_REALM_PEAK of its Early', () => {
        const tier = realmForOrdinal(17); // Core Formation
        expect(combatPowerForOrdinal(tier.ordinalEnd))
            .toBeCloseTo(combatPowerForOrdinal(tier.ordinalStart) * WITHIN_REALM_PEAK, 10);
    });

    it('lets a realm peak threaten the next realm without matching it', () => {
        // "A peak cultivator of one realm can threaten the weakest of the next."
        const foundation = realmForOrdinal(13);
        const core = realmForOrdinal(17);
        const peak = combatPowerForOrdinal(foundation.ordinalEnd);
        const weakestAbove = combatPowerForOrdinal(core.ordinalStart);
        expect(peak).toBeLessThan(weakestAbove);
        expect(peak * 4).toBeGreaterThan(weakestAbove);
    });

    it('agrees with the ladder at the start of every realm', () => {
        for (const tier of REALM_TIERS) {
            expect(combatPowerForOrdinal(tier.ordinalStart))
                .toBe(powerMultiplierForOrdinal(tier.ordinalStart));
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════
// RULE 1 - THE GAP IS CATEGORICAL
// ═════════════════════════════════════════════════════════════════════════

describe('assessGap', () => {
    const at = (ordinal: number, id = 'x') =>
        assessPower(combatant({ id, realmOrdinal: ordinal }), NEUTRAL);

    it('calls two major realms helpless and hands back the options that work', () => {
        const gap = assessGap(at(5), at(realmStart('core_formation')));
        expect(gap.verdict).toBe('helpless');
        expect(gap.realmGap).toBeGreaterThanOrEqual(HELPLESS_REALM_GAP);
        expect(gap.options).toBe(REAL_OPTIONS);
        expect(gap.options.length).toBeGreaterThan(5);
    });

    it('calls one realm outmatched rather than hopeless', () => {
        const gap = assessGap(at(realmStart('foundation_establishment')), at(realmStart('core_formation')));
        expect(gap.verdict).toBe('outmatched');
        expect(gap.realmGap).toBe(1);
        expect(gap.options).toEqual([]);
    });

    it('calls the same realm contested however far apart the sub-ranks are', () => {
        const tier = realmForOrdinal(0);
        expect(assessGap(at(tier.ordinalStart), at(tier.ordinalEnd)).verdict).toBe('contested');
        expect(assessGap(at(tier.ordinalEnd), at(tier.ordinalStart)).verdict).toBe('contested');
    });

    it('reports a power ratio that grows with the gap', () => {
        const near = assessGap(at(13), at(17)).powerRatio;
        const far = assessGap(at(13), at(30)).powerRatio;
        expect(far).toBeGreaterThan(near);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// RULE 2 - UPSETS ARE POSSIBLE AND EXCEPTIONAL
// ═════════════════════════════════════════════════════════════════════════

describe('assessEdges', () => {
    it('prices only edges actually held, and ignores duplicates', () => {
        expect(assessEdges([]).multiplier).toBe(1);
        expect(assessEdges(['ambush']).multiplier).toBe(EDGE_VALUES.ambush);
        expect(assessEdges(['ambush', 'ambush']).edges).toEqual(['ambush']);
        expect(assessEdges(['ambush', 'ambush']).multiplier).toBe(EDGE_VALUES.ambush);
    });

    it('multiplies the itemised list back to the reported multiplier', () => {
        const assessment = assessEdges(['ambush', 'terrain', 'preparation']);
        let product = 1;
        for (const item of assessment.items) product *= item.factor;
        expect(product).toBeCloseTo(assessment.multiplier, 10);
        expect(assessment.capped).toBe(false);
    });

    it('caps everything carried, and says so when the cap bit', () => {
        const everything = assessEdges(ALL_EDGES);
        expect(everything.multiplier).toBe(MAX_EDGE_MULTIPLIER);
        expect(everything.capped).toBe(true);
    });

    it('caps above one realm and far below two, which is what makes upsets exceptional', () => {
        // The ladder steps by 4x per realm. Everything a cultivator can bring
        // must be able to overturn one of those and never two.
        const oneRealm = powerMultiplierForOrdinal(realmStart('core_formation'))
            / powerMultiplierForOrdinal(realmStart('foundation_establishment'));
        const twoRealms = oneRealm * oneRealm;

        expect(MAX_EDGE_MULTIPLIER).toBeGreaterThan(oneRealm);
        expect(MAX_EDGE_MULTIPLIER).toBeLessThan(twoRealms);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// RULE 4 - THE TRADITIONS DIFFER ABOUT DYING
// ═════════════════════════════════════════════════════════════════════════

describe('soul-directed arts', () => {
    it('recognises an art that can reach a soul from its catalog fields alone', () => {
        expect(canDirectAtSoul(art({ element: null, requiredOrdinal: SOUL_ART_MIN_ORDINAL }))).toBe(true);
        // Elemental qi has to travel through flesh to arrive.
        expect(canDirectAtSoul(art({ element: 'fire', requiredOrdinal: SOUL_ART_MIN_ORDINAL }))).toBe(false);
        // Soul arts proper do not exist below Nascent Soul.
        expect(canDirectAtSoul(art({ element: null, requiredOrdinal: SOUL_ART_MIN_ORDINAL - 1 }))).toBe(false);
        expect(canDirectAtSoul(null)).toBe(false);
    });

    it('anchors the threshold to Nascent Soul rather than to a literal', () => {
        expect(SOUL_ART_MIN_ORDINAL).toBe(realmStart('nascent_soul'));
    });

    it('does literally nothing to a carver, whatever the attacker is', () => {
        const attacker = assessPower(combatant({ realmOrdinal: MAX_ORDINAL - 1 }), NEUTRAL);
        const carver = assessPower(
            combatant({ id: 'b', traditionId: 'tradition-cut', realmOrdinal: 0 }),
            NEUTRAL
        );

        const result = resolveExchange(attacker, carver, 100, {
            rng: rng('soul-vs-carver'),
            ambient: 'normal',
            turn: 1,
            vector: 'soul'
        });

        expect(result.nullified).toBe(true);
        expect(result.nullifiedReason).toBe('no_soul_to_reach');
        expect(result.damage).toBe(0);
        expect(result.injury).toBeNull();
    });

    it('reaches a Drawn cultivator perfectly well', () => {
        const attacker = assessPower(combatant({ realmOrdinal: 22 }), NEUTRAL);
        const drawn = assessPower(combatant({ id: 'b', realmOrdinal: 22 }), NEUTRAL);

        const result = resolveExchange(attacker, drawn, 100, {
            rng: rng('soul-vs-drawn'),
            ambient: 'normal',
            turn: 1,
            vector: 'soul'
        });

        expect(result.nullified).toBe(false);
        expect(result.damage).toBeGreaterThan(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// EXCHANGES
// ═════════════════════════════════════════════════════════════════════════

describe('resolveExchange', () => {
    it('is deterministic for a given seed', () => {
        const attacker = assessPower(combatant(), NEUTRAL);
        const defender = assessPower(combatant({ id: 'b' }), NEUTRAL);
        const ctx = () => ({ rng: rng('same'), ambient: 'normal' as const, turn: 3 });

        const first = resolveExchange(attacker, defender, 100, ctx());
        const second = resolveExchange(attacker, defender, 100, ctx());

        expect(second).toEqual(first);
    });

    it('reports modifiers that multiply back to the advantage', () => {
        const attacker = assessPower(combatant({ realmOrdinal: 18 }), NEUTRAL);
        const defender = assessPower(combatant({ id: 'b', realmOrdinal: 14 }), NEUTRAL);

        const result = resolveExchange(attacker, defender, 100, {
            rng: rng('itemised'),
            ambient: 'normal',
            turn: 1,
            attackerEdges: ['ambush'],
            defenderEdges: ['terrain']
        });

        let product = 1;
        for (const m of result.modifiers) product *= m.factor;
        expect(product).toBeCloseTo(result.advantage, 10);
        expect(result.modifiers.map(m => m.source)).toContain('attacker_edges:ambush');
        expect(result.modifiers.map(m => m.source)).toContain('defender_edges:terrain');
    });

    it('hurts more when the attacker is further ahead', () => {
        const defender = assessPower(combatant({ id: 'b', realmOrdinal: 10 }), NEUTRAL);
        const even = resolveExchange(
            assessPower(combatant({ realmOrdinal: 10 }), NEUTRAL), defender, 100,
            { rng: rng('d'), ambient: 'normal', turn: 1 }
        );
        const lopsided = resolveExchange(
            assessPower(combatant({ realmOrdinal: 16 }), NEUTRAL), defender, 100,
            { rng: rng('d'), ambient: 'normal', turn: 1 }
        );
        expect(lopsided.damage).toBeGreaterThan(even.damage);
        expect(lopsided.advantage).toBeGreaterThan(even.advantage);
    });

    it('always does at least one point, so an exchange is never a no-op', () => {
        const weak = assessPower(combatant({ realmOrdinal: 0 }), NEUTRAL);
        const strong = assessPower(combatant({ id: 'b', realmOrdinal: 20 }), NEUTRAL);
        const result = resolveExchange(weak, strong, 5000, {
            rng: rng('minimum'), ambient: 'normal', turn: 1
        });
        expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    it('marks a wound from a poisoned strike as poison, not as an ordinary cut', () => {
        const attacker = assessPower(combatant({ realmOrdinal: 20 }), NEUTRAL);
        const defender = assessPower(combatant({ id: 'b', realmOrdinal: 17 }), NEUTRAL);

        // Search seeds for one that produced an injury; the source mapping is
        // what is under test, not the injury chance.
        let injured = null;
        for (let i = 0; i < 40 && injured === null; i++) {
            const result = resolveExchange(attacker, defender, 100, {
                rng: rng(`poison-${i}`),
                ambient: 'normal',
                turn: 1,
                attackerEdges: ['poison']
            });
            injured = result.injury;
        }
        expect(injured).not.toBeNull();
        expect(injured!.source).toBe('poison');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// RULE 1 AND RULE 5 - CONFRONTATION
// ═════════════════════════════════════════════════════════════════════════

describe('resolveConfrontation', () => {
    const baseCtx = (overrides: Record<string, unknown> = {}) => ({
        rng: rng('confrontation'),
        ambient: 'normal' as const,
        turn: 1,
        intent: { goal: 'kill' as const },
        ...overrides
    });

    it('refuses a direct confrontation across two major realms', () => {
        const result = resolveConfrontation(
            combatant({ id: 'weak', realmOrdinal: 3 }),
            combatant({ id: 'strong', realmOrdinal: realmStart('nascent_soul') }),
            baseCtx()
        );

        expect(result.outcome).toBe('no_contest');
        expect(result.exchanges).toEqual([]);
        expect(result.winnerId).toBeNull();
        expect(result.gap.options).toBe(REAL_OPTIONS);
        expect(result.finished).toBe(false);
        // Nothing happened, so nobody was hurt and nobody owes anybody anything.
        expect(result.hp.weak).toBe(100);
        expect(result.obligations).toEqual([]);
    });

    it('does not hold a fight the other way either - it holds a decision', () => {
        const result = resolveConfrontation(
            combatant({ id: 'strong', realmOrdinal: realmStart('deity_transformation') }),
            combatant({ id: 'weak', realmOrdinal: 2 }),
            baseCtx()
        );

        expect(result.exchanges).toEqual([]);
        expect(result.winnerId).toBe('strong');
        expect(result.outcome).toBe('lethal');
        expect(result.hp.weak).toBe(0);
    });

    it('is deterministic for a given seed', () => {
        const run = () => resolveConfrontation(
            combatant({ id: 'a', realmOrdinal: 14 }),
            combatant({ id: 'b', realmOrdinal: 15 }),
            baseCtx({ rng: rng('replay') })
        );
        expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    });

    it('never runs longer than MAX_EXCHANGES, whatever the seed', () => {
        for (let i = 0; i < 50; i++) {
            const result = resolveConfrontation(
                combatant({ id: 'a', realmOrdinal: 14 }),
                combatant({ id: 'b', realmOrdinal: 14 }),
                baseCtx({ rng: rng(`bounded-${i}`), intent: { goal: 'kill', willWithdraw: false } })
            );
            expect(result.exchanges.length).toBeLessThanOrEqual(MAX_EXCHANGES * 2);
        }
    });

    it('leaves stalemate genuinely reachable rather than decorative', () => {
        // An outcome no seed can produce is not an outcome. An even fight that
        // neither side breaks off from runs out of exchanges some of the time,
        // and that has to stay true when the damage numbers are retuned.
        const outcomes = new Set<string>();
        for (let i = 0; i < 60; i++) {
            outcomes.add(resolveConfrontation(
                combatant({ id: 'a', realmOrdinal: 14 }),
                combatant({ id: 'b', realmOrdinal: 14 }),
                baseCtx({ rng: rng(`stale-${i}`), intent: { goal: 'kill', willWithdraw: false } })
            ).outcome);
        }
        expect(outcomes).toContain('stalemate');
        expect(outcomes).toContain('lethal');
    });

    it('makes breaking off the ordinary end of an even fight, not death', () => {
        const tally: Record<string, number> = {};
        for (let i = 0; i < 60; i++) {
            const outcome = resolveConfrontation(
                combatant({ id: 'a', realmOrdinal: 14 }),
                combatant({ id: 'b', realmOrdinal: 14 }),
                baseCtx({ rng: rng(`ordinary-${i}`), intent: { goal: 'kill', willWithdraw: true } })
            ).outcome;
            tally[outcome] = (tally[outcome] ?? 0) + 1;
        }
        expect((tally.withdrawal ?? 0) + (tally.crippled ?? 0)).toBeGreaterThan(tally.lethal ?? 0);
    });

    it('produces outcomes other than death, and the goal decides which', () => {
        const goals = ['subdue', 'humiliate', 'drive_off'] as const;
        const expected = { subdue: 'capture', humiliate: 'humiliation', drive_off: 'withdrawal' };

        for (const goal of goals) {
            const result = resolveConfrontation(
                combatant({ id: 'a', realmOrdinal: realmStart('core_formation') }),
                combatant({ id: 'b', realmOrdinal: 2 }),
                baseCtx({ intent: { goal } })
            );
            expect(result.outcome, goal).toBe(expected[goal]);
            expect(result.finished, goal).toBe(false);
        }
    });

    it('destroys the body of a high Drawn cultivator without ending them', () => {
        const result = resolveConfrontation(
            combatant({ id: 'a', realmOrdinal: MAX_ORDINAL - 2 }),
            combatant({
                id: 'b',
                realmOrdinal: realmStart('nascent_soul'),
                traditionId: 'tradition-drawn'
            }),
            baseCtx({ intent: { goal: 'kill' } })
        );

        expect(result.outcome).toBe('body_destroyed');
        expect(result.finished).toBe(false);
        expect(result.remnant).toBe('soul');
        expect(result.killRequirement.bodyIsEnough).toBe(false);
        expect(result.narrationHint).toContain('soul left intact');
    });

    it('destroys the body of a carver without ending them either, for a different reason', () => {
        const result = resolveConfrontation(
            combatant({ id: 'a', realmOrdinal: realmStart('deity_transformation') }),
            combatant({ id: 'b', realmOrdinal: 2, traditionId: 'tradition-cut' }),
            baseCtx({ intent: { goal: 'kill' } })
        );

        expect(result.outcome).toBe('body_destroyed');
        expect(result.remnant).toBe('seam');
        expect(result.finished).toBe(false);
    });

    it('does end a Drawn cultivator below Nascent Soul with an ordinary killing', () => {
        const result = resolveConfrontation(
            combatant({ id: 'a', realmOrdinal: realmStart('core_formation') }),
            combatant({ id: 'b', realmOrdinal: 2 }),
            baseCtx({ intent: { goal: 'kill' } })
        );
        expect(result.outcome).toBe('lethal');
        expect(result.finished).toBe(true);
        expect(result.remnant).toBeNull();
    });

    it('never sets anyone dead - that is the survival layer, and only it', () => {
        const result = resolveConfrontation(
            combatant({ id: 'a', realmOrdinal: realmStart('core_formation') }),
            combatant({ id: 'b', realmOrdinal: 2 }),
            baseCtx({ intent: { goal: 'kill' } })
        );
        // The shape carries damage and a requirement, and no aliveness at all.
        expect(Object.keys(result)).not.toContain('alive');
        expect(Object.keys(result)).not.toContain('deathCause');
        expect(result.hp.b).toBe(0);
    });

    it('seeds a grudge held by the loser about the winner', () => {
        const result = resolveConfrontation(
            combatant({ id: 'a', realmOrdinal: realmStart('core_formation') }),
            combatant({ id: 'b', name: 'Wen', realmOrdinal: 2 }),
            baseCtx({ intent: { goal: 'humiliate' } })
        );

        expect(result.obligations).toHaveLength(1);
        const [grudge] = result.obligations;
        expect(grudge.holderId).toBe('b');
        expect(grudge.subjectId).toBe('a');
        expect(grudge.cause).toBe('humiliation');
        expect(grudge.severity).toBe('grave');
        expect(grudge.description).toContain('Wen');
    });

    /** How often the weaker side wins, across seeds, with a given stack of edges. */
    function upsetRate(edges: readonly string[], samples = 120): number {
        const underdog = realmForOrdinal(13).ordinalEnd;   // Foundation Perfection
        const favourite = realmStart('core_formation');    // Core Formation Early
        let wins = 0;
        for (let i = 0; i < samples; i++) {
            const result = resolveConfrontation(
                combatant({ id: 'underdog', realmOrdinal: underdog }),
                combatant({ id: 'favourite', realmOrdinal: favourite }),
                baseCtx({
                    rng: rng(`upset-${edges.join()}-${i}`),
                    attackerEdges: edges as never,
                    intent: { goal: 'kill', willWithdraw: false }
                })
            );
            if (result.winnerId === 'underdog') wins++;
        }
        return wins / samples;
    }

    it('never lets a realm be overturned by nothing at all', () => {
        expect(upsetRate([])).toBe(0);
    });

    it('makes an upset possible, and exceptional, on a single edge', () => {
        const rate = upsetRate(['ambush']);
        expect(rate).toBeGreaterThan(0);
        expect(rate).toBeLessThan(0.2);
    });

    it('makes an upset likely once enough was genuinely brought', () => {
        expect(upsetRate(['ambush', 'terrain', 'preparation'])).toBeGreaterThan(0.8);
    });

    it('refuses to let everything brought overturn two realms', () => {
        const result = resolveConfrontation(
            combatant({ id: 'underdog', realmOrdinal: realmForOrdinal(13).ordinalEnd }),
            combatant({ id: 'favourite', realmOrdinal: realmStart('nascent_soul') }),
            baseCtx({ rng: rng('upset'), attackerEdges: [...ALL_EDGES], intent: { goal: 'kill' } })
        );
        expect(result.outcome).toBe('no_contest');
        expect(result.exchanges).toEqual([]);
    });

    it('records a crippling wound as a crippling rather than a mere withdrawal', () => {
        // Search for a seed that produced a crippling injury on the loser; the
        // reclassification is what is under test.
        let found = null;
        for (let i = 0; i < 60 && found === null; i++) {
            const result = resolveConfrontation(
                combatant({ id: 'a', realmOrdinal: realmForOrdinal(17).ordinalEnd, maxHp: 200, hp: 200 }),
                combatant({ id: 'b', realmOrdinal: realmStart('core_formation'), maxHp: 200, hp: 200 }),
                baseCtx({ rng: rng(`cripple-${i}`), intent: { goal: 'drive_off', willWithdraw: true } })
            );
            if (result.outcome === 'crippled') found = result;
        }
        expect(found).not.toBeNull();
        expect(found!.obligations[0].kind).toBe('blood_feud');
        expect(found!.obligations[0].severity).toBe('unforgivable');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// DISENGAGEMENT
// ═════════════════════════════════════════════════════════════════════════

describe('attemptFlight', () => {
    it('itemises modifiers that sum exactly to the chance, clamp included', () => {
        const result = attemptFlight(
            assessPower(combatant({ realmOrdinal: 3 }), NEUTRAL),
            assessPower(combatant({ id: 'b', realmOrdinal: 30 }), NEUTRAL),
            { rng: rng('flee'), turn: 1, maxHp: 100 }
        );

        const sum = result.modifiers.reduce((total, m) => total + m.delta, 0);
        expect(sum).toBeCloseTo(result.chance, 10);
    });

    it('is never certain and never impossible', () => {
        const hopeless = attemptFlight(
            assessPower(combatant({ realmOrdinal: 0, hp: 1, injuries: makeInjuries(4, 'crippling') }), NEUTRAL),
            assessPower(combatant({ id: 'b', realmOrdinal: MAX_ORDINAL - 1 }), NEUTRAL),
            { rng: rng('hopeless'), turn: 1, maxHp: 100 }
        );
        expect(hopeless.chance).toBeGreaterThan(0);
        expect(hopeless.chance).toBeLessThan(1);
    });

    it('is helped more by a movement art than by anything else carried', () => {
        const base = () => ({ rng: rng('movement'), turn: 1, maxHp: 100 });
        const bare = attemptFlight(
            assessPower(combatant({ realmOrdinal: 10 }), NEUTRAL),
            assessPower(combatant({ id: 'b', realmOrdinal: 14 }), NEUTRAL),
            base()
        );
        const withArt = attemptFlight(
            assessPower(combatant({ realmOrdinal: 10 }), NEUTRAL),
            assessPower(combatant({ id: 'b', realmOrdinal: 14 }), NEUTRAL),
            {
                ...base(),
                movementTechnique: art({ category: 'movement', mastery: 1 }),
                movementMastery: 1
            }
        );
        expect(withArt.chance).toBeGreaterThan(bare.chance);
    });

    it('costs something whether or not it works', () => {
        for (const seed of ['a', 'b', 'c', 'd']) {
            const result = attemptFlight(
                assessPower(combatant({ realmOrdinal: 10 }), NEUTRAL),
                assessPower(combatant({ id: 'b', realmOrdinal: 12 }), NEUTRAL),
                { rng: rng(seed), turn: 1, maxHp: 100 }
            );
            expect(result.damage).toBeGreaterThan(0);
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════
// INITIATIVE AND ARTS
// ═════════════════════════════════════════════════════════════════════════

describe('rollInitiative', () => {
    it('puts rank ahead of the roll, so a mortal never outpaces a Core Formation cultivator', () => {
        for (let i = 0; i < 25; i++) {
            const order = rollInitiative(
                [
                    { id: 'mortal', name: 'Mortal', ordinal: 0, bonus: 3 },
                    { id: 'core', name: 'Core', ordinal: realmStart('core_formation') }
                ],
                rng(`initiative-${i}`)
            );
            expect(order[0].id).toBe('core');
        }
    });

    it('is a total, stable order that replays identically', () => {
        const participants = [
            { id: 'c', name: 'C', ordinal: 5 },
            { id: 'a', name: 'A', ordinal: 5 },
            { id: 'b', name: 'B', ordinal: 5 }
        ];
        const first = rollInitiative(participants, rng('stable')).map(e => e.id);
        const second = rollInitiative(participants, rng('stable')).map(e => e.id);
        expect(second).toEqual(first);
        expect(new Set(first).size).toBe(3);
    });
});

describe('canUseTechnique', () => {
    const who = { qi: 50, maxQi: 100, realmOrdinal: 10 };

    it('permits an art the cultivator can afford and has reached', () => {
        expect(canUseTechnique(who, art({ qiCost: 10 }))).toEqual({ usable: true, reason: null });
    });

    it('refuses on cooldown, rank, cost and exhaustion, and says which', () => {
        expect(canUseTechnique(who, art(), 3).reason).toBe('on_cooldown:3');
        expect(canUseTechnique(who, art({ requiredOrdinal: 30 })).reason).toBe('realm_too_low');
        expect(canUseTechnique(who, art({ qiCost: 500 })).reason).toBe('insufficient_qi');
        expect(canUseTechnique({ ...who, qi: 5 }, art({ qiCost: 1 })).reason).toBe('exhausted');
    });
});
