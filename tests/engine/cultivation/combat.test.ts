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
    MAX_NUMBERS_MULTIPLIER,
    OVERWHELMING_ADVANTAGE,
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
    numbersMultiplier,
    reachOf,
    resolveConfrontation,
    resolveExchange,
    resolveMelee,
    rollInitiative,
    sideStrength,
    strikesThisRound,
    type Aegis,
    type CombatantInput,
    type MeleeResult,
    type SideInput
} from '../../../src/engine/cultivation/combat.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    MAX_ORDINAL,
    REALM_TIERS,
    powerMultiplierForOrdinal,
    realmForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import type { Technique, TechniqueReach } from '../../../src/schema/cultivation.js';
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

// ═════════════════════════════════════════════════════════════════════════
// SIDES
// The five rules again, now with more than two people in the room. The new
// question, and the only one, is what a second body is worth.
// ═════════════════════════════════════════════════════════════════════════

describe('sideStrength', () => {
    const priced = (ordinal: number) => assessPower(combatant({ realmOrdinal: ordinal }), NEUTRAL);

    it('prices a side of one at exactly its own power, so a duel is unchanged', () => {
        const one = priced(18);
        const side = sideStrength([one]);
        expect(side.multiplier).toBe(1);
        expect(side.weight).toBe(one.total);
        expect(side.effectiveBodies).toBe(1);
    });

    it('prices a second equal body at exactly what the edge table already said bodies are worth', () => {
        const side = sideStrength([priced(18), priced(18)]);
        expect(side.effectiveBodies).toBeCloseTo(2, 10);
        expect(side.multiplier).toBeCloseTo(EDGE_VALUES.numbers, 10);
    });

    it('weighs bodies against the best one rather than counting them', () => {
        // Five Foundation disciples standing behind a Nascent Soul elder are not
        // six people. They are an elder and a rounding error, and the number has
        // to say so.
        const elder = priced(realmStart('nascent_soul'));
        const disciples = Array.from({ length: 5 }, () => priced(realmStart('foundation_establishment')));
        const side = sideStrength([elder, ...disciples]);

        expect(side.effectiveBodies).toBeLessThan(1.5);
        expect(side.multiplier).toBeLessThan(1.2);
        expect(side.strongest).toBe(elder.total);
    });

    it('never lets numbers reach what a realm is worth', () => {
        const crowd = Array.from({ length: 500 }, () => priced(18));
        expect(sideStrength(crowd).multiplier).toBe(MAX_NUMBERS_MULTIPLIER);
        expect(sideStrength(crowd).capped).toBe(true);
        // The load-bearing comparison. A realm is four; a crowd is never a realm.
        expect(MAX_NUMBERS_MULTIPLIER).toBeLessThan(
            combatPowerForOrdinal(realmStart('core_formation')) /
            combatPowerForOrdinal(realmStart('foundation_establishment'))
        );
        // And it is exactly what climbing a whole realm's sub-ranks is worth.
        expect(MAX_NUMBERS_MULTIPLIER).toBe(WITHIN_REALM_PEAK);
    });

    it('never weakens a side by adding somebody to it', () => {
        let previous = 0;
        const members = [];
        for (const ordinal of [20, 14, 18, 3, 19, 8]) {
            members.push(priced(ordinal));
            const weight = sideStrength(members).weight;
            expect(weight).toBeGreaterThanOrEqual(previous);
            previous = weight;
        }
    });

    it('is a compression, not an addition - a side is never its members summed', () => {
        const many = Array.from({ length: 4 }, () => priced(18));
        const side = sideStrength(many);
        expect(side.weight).toBeLessThan(side.summed);
        expect(side.weight).toBeGreaterThan(side.strongest);
    });

    it('reports 1 for a side with nobody left in it', () => {
        expect(sideStrength([]).multiplier).toBe(1);
        expect(sideStrength([]).weight).toBe(0);
    });
});

describe('numbersMultiplier', () => {
    it('grows, and grows slower than the bodies do', () => {
        expect(numbersMultiplier(1)).toBe(1);
        expect(numbersMultiplier(2)).toBeCloseTo(EDGE_VALUES.numbers, 10);
        for (const n of [2, 3, 4, 5, 8, 40]) {
            expect(numbersMultiplier(n), `${n}`).toBeLessThan(n);
            expect(numbersMultiplier(n + 1)).toBeGreaterThanOrEqual(numbersMultiplier(n));
        }
    });

    it('saturates, so the sixth body and the six-hundredth are both witnesses', () => {
        expect(numbersMultiplier(6)).toBe(MAX_NUMBERS_MULTIPLIER);
        expect(numbersMultiplier(600)).toBe(MAX_NUMBERS_MULTIPLIER);
    });
});

describe('strikesThisRound', () => {
    const priced = (ordinal: number) => assessPower(combatant({ realmOrdinal: ordinal }), NEUTRAL);

    it('gives a side of one exactly one strike, every seed', () => {
        const side = sideStrength([priced(18)]);
        for (let i = 0; i < 30; i++) {
            expect(strikesThisRound(side, 1, rng(`solo-${i}`))).toBe(1);
        }
    });

    it('lands a pair its second strike sometimes and not always', () => {
        const side = sideStrength([priced(18), priced(18)]);
        const seen = new Set<number>();
        for (let i = 0; i < 60; i++) seen.add(strikesThisRound(side, 2, rng(`pair-${i}`)));
        expect(seen).toEqual(new Set([1, 2]));
    });

    it('never spends more strikes than there are people to make them', () => {
        const crowd = Array.from({ length: 40 }, () => priced(18));
        const side = sideStrength(crowd);
        for (let i = 0; i < 20; i++) {
            const strikes = strikesThisRound(side, 1, rng(`short-${i}`));
            expect(strikes).toBe(1);
        }
    });
});

describe('resolveMelee', () => {
    const meleeCtx = (overrides: Record<string, unknown> = {}) => ({
        rng: rng('melee'),
        ambient: 'normal' as const,
        turn: 1,
        intent: { goal: 'kill' as const },
        ...overrides
    });

    /** A side of N cultivators at one ordinal, named side0..sideN. */
    function band(id: string, ordinal: number, count: number, extra: Partial<SideInput> = {}): SideInput {
        return {
            id,
            name: id,
            members: Array.from({ length: count }, (_, i) =>
                combatant({ id: `${id}-${i}`, name: `${id}-${i}`, realmOrdinal: ordinal })
            ),
            ...extra
        };
    }

    /** How often the first side puts the second side down, across seeds. */
    function downRate(
        attackers: () => SideInput,
        defenders: () => SideInput,
        label: string,
        samples = 80
    ): number {
        let down = 0;
        for (let i = 0; i < samples; i++) {
            const result = resolveMelee([attackers(), defenders()], meleeCtx({ rng: rng(`${label}-${i}`) }));
            if (result.winningSideId === attackers().id) down++;
        }
        return down / samples;
    }

    it('refuses fewer than two sides rather than resolving something meaningless', () => {
        expect(() => resolveMelee([band('a', 10, 2)], meleeCtx())).toThrow(/two sides/);
    });

    it('is deterministic for a given seed', () => {
        const run = () => resolveMelee(
            [band('a', 14, 2), band('b', 14, 2)],
            meleeCtx({ rng: rng('replay') })
        );
        expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    });

    it('accounts for every participant and names only real people in the trail', () => {
        const result = resolveMelee([band('a', 14, 3), band('b', 14, 2)], meleeCtx());
        expect(result.combatants).toHaveLength(5);
        const ids = new Set(result.combatants.map(c => c.id));
        for (const exchange of result.exchanges) {
            expect(ids.has(exchange.attackerId)).toBe(true);
            expect(ids.has(exchange.defenderId)).toBe(true);
        }
        expect(Object.keys(result.hp).sort()).toEqual([...ids].sort());
    });

    it('never declares anyone dead - that is still the survival layer, and only it', () => {
        const result = resolveMelee([band('a', 17, 2), band('b', 2, 1)], meleeCtx());
        expect(Object.keys(result)).not.toContain('alive');
        for (const c of result.combatants) expect(Object.keys(c)).not.toContain('deathCause');
    });

    // ── RULE 1 ────────────────────────────────────────────────────────────

    it('does not hold a fight across two major realms, however many turned up', () => {
        const result = resolveMelee(
            [band('mob', 3, 12), band('elder', realmStart('nascent_soul'), 1)],
            meleeCtx()
        );
        expect(result.exchanges).toEqual([]);
        expect(result.winningSideId).toBe('elder');
    });

    it('lets somebody categorically outclassed stand there without ever landing anything', () => {
        const result = resolveMelee(
            [
                {
                    id: 'a', name: 'a', members: [
                        combatant({ id: 'elder', realmOrdinal: realmStart('nascent_soul') }),
                        combatant({ id: 'mook', realmOrdinal: 2 })
                    ]
                },
                band('b', realmStart('nascent_soul'), 1)
            ],
            meleeCtx()
        );
        expect(result.exchanges.some(e => e.attackerId === 'mook')).toBe(false);
    });

    // ── NUMBERS ───────────────────────────────────────────────────────────

    it('lets two peers put down one peer, which is how anybody on this ladder dies', () => {
        for (const ordinal of [14, 18, realmStart('nascent_soul'), 43]) {
            const rate = downRate(
                () => band('two', ordinal, 2),
                () => band('one', ordinal, 1),
                `peers-${ordinal}`
            );
            expect(rate, `${ordinal}`).toBeGreaterThan(0.9);
        }
    });

    it('does not let one peer beat two, which is the same statement from the other end', () => {
        const rate = downRate(
            () => band('one', 18, 1),
            () => band('two', 18, 2),
            'reverse'
        );
        expect(rate).toBeLessThan(0.1);
    });

    it('never lets bodies a full realm below win, at any headcount at all', () => {
        // The load-bearing test in this file. Six Core Formation cultivators do
        // not mob a Nascent Soul one, and neither do sixty.
        for (const count of [2, 6, 20, 60]) {
            const rate = downRate(
                () => band('mob', realmForOrdinal(17).ordinalEnd, count),
                () => band('elder', realmStart('nascent_soul'), 1),
                `mob-${count}`,
                40
            );
            expect(rate, `${count} bodies`).toBeLessThan(0.05);
        }
    });

    it('overturns a realm on what was brought instead, which is rule 2 intact', () => {
        const rate = downRate(
            () => band('raiders', realmForOrdinal(17).ordinalEnd, 4, {
                edges: ['formation', 'ambush', 'terrain']
            }),
            () => band('elder', realmStart('nascent_soul'), 1),
            'prepared'
        );
        expect(rate).toBeGreaterThan(0.8);
    });

    // ── FOCUS FIRE AND ATTRITION ──────────────────────────────────────────

    it('concentrates rather than spreading damage evenly and finishing nobody', () => {
        const result = resolveMelee([band('a', 18, 4), band('b', 18, 3)], meleeCtx({ rng: rng('focus') }));
        const targets = result.exchanges
            .filter(e => e.attackerId.startsWith('a-'))
            .map(e => e.defenderId);
        // Once a side opens somebody up it stays on them, so the sequence of
        // targets is a run of blocks and never returns to an abandoned one.
        const blocks = targets.filter((id, i) => i === 0 || targets[i - 1] !== id);
        expect(new Set(blocks).size).toBe(blocks.length);
    });

    it('refuses to let irrelevant bodies work as a shield wall', () => {
        // Found by fuzzing mixed sides. A side put one real threat behind a wall
        // of people categorically beneath the defender, and weakest-first
        // targeting had the defender spend every exchange deleting the wall - at
        // an advantage of 2867 - while the one person who could reach her did so
        // unopposed each round and drove her off the field about a fifth of the
        // time. Bodies rule 1 calls irrelevant must not decide a fight by being
        // present, so a striker takes the people who count first.
        const wall = (mooks: number): SideInput => ({
            id: 'mob', name: 'mob',
            members: [
                combatant({ id: 'threat', realmOrdinal: realmForOrdinal(37).ordinalEnd }),
                ...Array.from({ length: mooks }, (_, i) =>
                    combatant({ id: `mook-${i}`, realmOrdinal: realmStart('core_formation') }))
            ]
        });
        const lone = (): SideInput => ({
            id: 'defender', name: 'defender',
            members: [combatant({ id: 'defender-0', realmOrdinal: realmStart('tribulation_transcendence') })]
        });

        for (const mooks of [7, 13, 19]) {
            let taken = 0;
            for (let i = 0; i < 60; i++) {
                const result = resolveMelee([wall(mooks), lone()], meleeCtx({ rng: rng(`wall-${mooks}-${i}`) }));
                if (result.winningSideId === 'mob') taken++;
            }
            expect(taken, `${mooks} mooks`).toBe(0);
        }

        // And her attention went where it belonged: everything she spent on the
        // wall came after the threat was already down, never before it.
        const result = resolveMelee([wall(13), lone()], meleeCtx({ rng: rng('wall-trail') }));
        const hers = result.exchanges.filter(e => e.attackerId === 'defender-0');
        expect(hers.length).toBeGreaterThan(0);
        expect(hers[0].defenderId).toBe('threat');

        const lastOnThreat = hers.map(e => e.defenderId).lastIndexOf('threat');
        const firstOnWall = hers.findIndex(e => e.defenderId.startsWith('mook-'));
        if (firstOnWall !== -1) expect(firstOnWall).toBeGreaterThan(lastOnThreat);
    });

    it('removes attackers outright at a gap nothing brought would have closed', () => {
        const result = resolveMelee(
            [
                band('mob', realmStart('core_formation'), 4),
                band('elder', realmForOrdinal(21).ordinalEnd, 1)
            ],
            meleeCtx({ rng: rng('sweep') })
        );
        const removals = result.exchanges.filter(e =>
            e.attackerId.startsWith('elder') &&
            e.result.advantage >= OVERWHELMING_ADVANTAGE &&
            e.defenderHpAfter === 0
        );
        expect(removals.length).toBeGreaterThan(0);
        // Removed, not ground down: the reported damage never had to reach them.
        expect(removals[0].result.damage).toBeLessThan(100);
    });

    // ── REACH ─────────────────────────────────────────────────────────────

    /** A side of N at one ordinal, every one of them carrying `reach`. */
    function armed(id: string, ordinal: number, count: number, reach?: TechniqueReach): SideInput {
        return {
            id, name: id,
            members: Array.from({ length: count }, (_, i) => combatant({
                id: `${id}-${i}`, name: `${id}-${i}`, realmOrdinal: ordinal,
                technique: art({ reach }), techniqueMastery: 1
            }))
        };
    }

    it('treats an art with nothing recorded as reaching one person, as it always did', () => {
        expect(reachOf(null)).toBe('single');
        expect(reachOf(undefined)).toBe('single');
        expect(reachOf(art())).toBe('single');
        expect(reachOf(art({ reach: 'field' }))).toBe('field');

        // And an unmarked art resolves byte-identically to an explicitly single one.
        const run = (reach?: TechniqueReach) => JSON.stringify(resolveMelee(
            [armed('a', 18, 2, reach), armed('b', 18, 2, 'single')],
            meleeCtx({ rng: rng('reach-default') })
        ));
        expect(run(undefined)).toBe(run('single'));
    });

    it('lands one action on everybody the art reaches, in one round', () => {
        // One realm apart, so this is a real melee rather than rule 1 settling
        // it without a die - the sweep has to be doing the work.
        const result = resolveMelee(
            [armed('sweeper', realmStart('nascent_soul'), 1, 'field'),
             armed('crowd', realmForOrdinal(17).ordinalEnd, 6)],
            meleeCtx({ rng: rng('sweep') })
        );
        const hers = result.exchanges.filter(e => e.attackerId === 'sweeper-0');
        // Six people answered by one person, so every one of them was struck.
        expect(new Set(hers.slice(0, 6).map(e => e.defenderId)).size).toBe(6);
        expect(result.winningSideId).toBe('sweeper');
    });

    it('reaches three with a wide swing and one without, at the same rank', () => {
        const reached = (reach: TechniqueReach, width: number) => {
            const result = resolveMelee(
                [armed('a', realmStart('nascent_soul'), 1, reach),
                 armed('b', realmForOrdinal(17).ordinalEnd, 6)],
                meleeCtx({ rng: rng('width') })
            );
            // The opening action is the first `width` exchanges they make.
            const opening = result.exchanges.filter(e => e.attackerId === 'a-0').slice(0, width);
            return new Set(opening.map(e => e.defenderId)).size;
        };
        expect(reached('single', 1)).toBe(1);
        expect(reached('several', 3)).toBe(3);
        expect(reached('field', 6)).toBe(6);
    });

    it('never lets reach buy a side out of a realm gap, at any width or headcount', () => {
        // The load-bearing direction. Reach scales with how many ENEMIES are
        // present, so a numerous but outclassed side gains nothing from it -
        // there is only ever one person in front of them.
        for (const reach of ['single', 'several', 'field'] as const) {
            for (const count of [2, 6, 20]) {
                let taken = 0;
                for (let i = 0; i < 40; i++) {
                    const result = resolveMelee(
                        [armed('mob', realmForOrdinal(17).ordinalEnd, count, reach),
                         armed('elder', realmStart('nascent_soul'), 1, 'single')],
                        meleeCtx({ rng: rng(`gap-${reach}-${count}-${i}`) })
                    );
                    if (result.winningSideId === 'mob') taken++;
                }
                expect(taken / 40, `${count} bodies with ${reach}`).toBeLessThan(0.1);
            }
        }
    });

    it('does let one person answer a crowd that is beneath them, which is the point', () => {
        for (const count of [6, 20, 60]) {
            let held = 0;
            for (let i = 0; i < 30; i++) {
                const result = resolveMelee(
                    [armed('one', realmStart('nascent_soul'), 1, 'field'),
                     armed('mob', realmForOrdinal(17).ordinalEnd, count, 'single')],
                    meleeCtx({ rng: rng(`sweep-${count}-${i}`) })
                );
                if (result.winningSideId === 'one') held++;
            }
            expect(held / 30, `${count} bodies`).toBeGreaterThan(0.9);
        }
    });

    it('widens a strike without granting more of them', () => {
        // Reach must not touch the numbers budget, or it becomes a second way to
        // buy strikes and rule 1 goes with it.
        const measure = (reach: TechniqueReach) => {
            const result = resolveMelee(
                [armed('a', 18, 6, reach), armed('b', 18, 6, 'single')],
                meleeCtx({ rng: rng('budget') })
            );
            const mine = result.exchanges.filter(e => e.attackerId.startsWith('a-'));
            return { strikers: new Set(mine.map(e => e.attackerId)).size, landed: mine.length };
        };

        const single = measure('single');
        const wide = measure('field');

        // A wider art lands on more people...
        expect(wide.landed).toBeGreaterThan(single.landed);
        // ...without ever putting more of the side's people into the swing. That
        // is the line that keeps reach from becoming a second way to buy strikes.
        expect(wide.strikers).toBeLessThanOrEqual(single.strikers);
    });

    // ── WHAT SOMEBODY IS CARRYING ─────────────────────────────────────────

    it('prices a ladder-rated object as a second body of its rank, with no new line', () => {
        const bare = assessPower(combatant({ realmOrdinal: 43 }), NEUTRAL);
        const held = assessPower(combatant({ realmOrdinal: 43, artifactOrdinal: 43 }), NEUTRAL);

        // The factor list keeps its shape; the object is priced on the line that
        // already exists for what somebody is carrying.
        expect(held.factors.map(f => f.source)).toEqual(bare.factors.map(f => f.source));
        expect(held.total / bare.total).toBeCloseTo(2, 6);

        // And it is not capped the way graded work is, because the whole claim
        // about such an object is that it is worth what a body is worth.
        const above = assessPower(combatant({ realmOrdinal: 43, artifactOrdinal: 45 }), NEUTRAL);
        expect(above.total / bare.total).toBeGreaterThan(3);

        // The identity the whole shape rests on still holds.
        let product = held.realmBase;
        for (const f of held.factors) product *= f.factor;
        expect(product).toBeCloseTo(held.total, 6);
    });

    it('leaves an ordinary cultivator behind when the object is taken away', () => {
        const withIt = combatant({ id: 'head', realmOrdinal: 43, artifactOrdinal: 44 });
        const { artifactOrdinal: _removed, ...withoutIt } = withIt;
        expect(assessPower(withoutIt as CombatantInput, NEUTRAL).total)
            .toBe(assessPower(combatant({ id: 'head', realmOrdinal: 43 }), NEUTRAL).total);
    });

    it('makes two peers stop being sufficient against somebody holding one', () => {
        // Not a rule about who the defender is. The object is worth a body, and
        // bodies are the unit numbers are counted in, so the plan that answers
        // one person no longer answers one person and an object.
        const bare = downRate(() => band('two', 43, 2), () => band('head', 43, 1), 'bare-two');
        const held = downRate(
            () => band('two', 43, 2),
            () => ({
                id: 'head', name: 'head',
                members: [combatant({ id: 'head-0', realmOrdinal: 43, artifactOrdinal: 44 })]
            }),
            'held-two'
        );
        expect(bare).toBeGreaterThan(0.9);
        expect(held).toBeLessThan(bare - 0.3);
    });

    // ── AEGIS ─────────────────────────────────────────────────────────────

    const lamp: Aegis = {
        id: 'lamp',
        name: 'a thing that cannot be lied to about position',
        denies: ['ambush', 'terrain', 'formation'],
        note: 'An ambush has to be somewhere, and somewhere is not a thing that can be hidden from this.'
    };

    it('disqualifies what an attacker brought rather than reducing it', () => {
        const bearer = (aegis: Aegis[]): SideInput => ({
            id: 'held', name: 'held',
            members: [{ combatant: combatant({ id: 'held-0', realmOrdinal: 21 }), aegis }]
        });
        const attack = () => band('raiders', realmForOrdinal(17).ordinalEnd, 4, {
            edges: ['formation', 'ambush', 'terrain']
        });

        const open = downRate(attack, () => bearer([]), 'aegis-open');
        const denied = downRate(attack, () => bearer([lamp]), 'aegis-denied');
        expect(open).toBeGreaterThan(0.8);
        expect(denied).toBeLessThan(0.1);
    });

    it('can put a vector out of reach entirely, and says so in the trail', () => {
        const soulArt = art({ element: null, requiredOrdinal: SOUL_ART_MIN_ORDINAL });
        const result = resolveMelee([
            {
                id: 'a', name: 'a', vector: 'soul',
                members: [combatant({ id: 'a-0', realmOrdinal: 22, technique: soulArt })]
            },
            {
                id: 'b', name: 'b',
                members: [{
                    combatant: combatant({ id: 'b-0', realmOrdinal: 22 }),
                    aegis: [{ id: 'nail', name: 'nail', forbids: ['body', 'soul'], note: 'Nothing reaches.' }]
                }]
            }
        ], meleeCtx({ rng: rng('forbid') }));

        const blocked = result.exchanges.filter(e => e.result.nullifiedReason === 'aegis_forbids_vector');
        expect(blocked.length).toBeGreaterThan(0);
        expect(blocked[0].result.damage).toBe(0);
    });

    // ── THE STALL ─────────────────────────────────────────────────────────

    it('lets a side that only has to last, last - and the attackers leave', () => {
        const result: MeleeResult = resolveMelee([
            band('assault', 43, 3),
            band('house', 43, 1, {
                reinforcement: { holdsFor: 1, note: 'Seals are already coming open behind you.' }
            })
        ], meleeCtx({ rng: rng('stall') }));

        expect(result.heldUntilReinforced).toBe('house');
        expect(result.winningSideId).toBe('house');
        expect(result.narrationHint).toContain('only last');
        // Not beaten. Out of clock, which is a different thing to narrate.
        for (const c of result.combatants.filter(c => c.sideId === 'assault')) {
            expect(['withdrew', 'crippled', 'finished', 'body_destroyed']).toContain(c.fate);
        }
    });

    it('does not save a side that was already finished inside the window', () => {
        const result = resolveMelee([
            band('assault', 43, 4),
            band('house', 43, 1, {
                reinforcement: { holdsFor: MAX_EXCHANGES, note: 'Too late.' }
            })
        ], meleeCtx({ rng: rng('too-late') }));
        expect(result.winningSideId).toBe('assault');
        expect(result.heldUntilReinforced).toBeNull();
    });

    // ── WHAT COMES OUT THE OTHER SIDE ─────────────────────────────────────

    it('reports the losing side by its worst fate and seeds the grudges', () => {
        const result = resolveMelee(
            [band('a', realmStart('core_formation'), 2), band('b', 2, 2)],
            meleeCtx({ intent: { goal: 'humiliate' } })
        );
        expect(result.outcome).toBe('humiliation');
        expect(result.obligations.length).toBeGreaterThan(0);
        for (const seed of result.obligations) {
            expect(result.combatants.some(c => c.id === seed.holderId)).toBe(true);
            expect(result.combatants.some(c => c.id === seed.subjectId)).toBe(true);
        }
    });

    it('resolves three sides at once, because a fight is not always two-cornered', () => {
        const result = resolveMelee(
            [band('a', 18, 2), band('b', 18, 2), band('c', 18, 2)],
            meleeCtx({ rng: rng('threeway') })
        );
        expect(result.sides).toHaveLength(3);
        expect(result.combatants).toHaveLength(6);
        expect(result.sides.filter(s => s.defeated).length).toBeLessThanOrEqual(2);
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
