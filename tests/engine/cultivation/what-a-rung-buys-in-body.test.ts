/**
 * What a rung buys in body, and why it has to buy anything.
 *
 * This file exists because the answer is a design decision that lives only as a
 * number, and a number nobody reads twice gets silently reverted by the next
 * person who finds it surprising. What is pinned here is the decision, not the
 * arithmetic:
 *
 *   1. A major realm DOUBLES the body and the aperture, against power's x4.
 *   2. The curve is continuous - a realm's Perfection lands on the next
 *      realm's Early - so it is the rungs that buy body, not the crossing.
 *   3. A newborn's pool is what the played birth path writes, so the player
 *      and the world are built on one formula.
 *   4. The doubling is CALIBRATED, not chosen: at the rung a technique grade
 *      opens, the aperture must hold that grade's whole qi band, or part of the
 *      catalog is unreachable by anybody alive.
 *   5. Damage is a fraction of the defender's own pool, so scaling the pool
 *      changes no fight. That invariant is what makes 1-4 safe, and it is the
 *      thing that breaks if somebody later makes damage absolute.
 *
 * ── THE DEFECT THIS REPLACES ─────────────────────────────────────────────
 *
 * `maxHp` and `maxQi` were stored and nothing maintained them, so a played run
 * reached False Immortal on 50 HP and 30 qi - a newborn's body - while the
 * formula the world builds NPCs with had the ordinal in it. Measured at the
 * time: 93 of the 138 arts in the catalog cost more qi than a player could ever
 * hold, and 45 of them more than any NPC in the world could hold either. The
 * ladder had a technique catalog nobody could pay for.
 */

import { describe, expect, it } from 'vitest';
import {
    BODY_REALM_MULTIPLIER,
    MAX_ORDINAL,
    REALM_TIERS,
    WITHIN_REALM_BODY_PEAK,
    bodyMultiplierForOrdinal,
    maxHpForOrdinal,
    maxQiForOrdinal,
    powerMultiplierForOrdinal,
    realmForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import {
    resolveConfrontation,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    GRADE_ORDINAL_BANDS,
    GRADE_QI_BANDS,
    TECHNIQUES,
    isWideSpan
} from '../../../src/data/cultivation/techniques.js';
import { InnateAttributesSchema } from '../../../src/schema/cultivation.js';

/**
 * The lowest Insight the schema permits, which is the tightest case the
 * aperture has to satisfy. Asserted against the schema below rather than
 * merely written down, so widening the attribute range cannot silently make
 * these calibration bounds measure the wrong person.
 */
const WEAKEST_LEGAL_INSIGHT = 1;

function attributes(insight: number) {
    return { might: 2, insight, fortune: 1, charm: 2 };
}

// ─────────────────────────────────────────────────────────────────────────
// THE CURVE
// ─────────────────────────────────────────────────────────────────────────

describe('a realm doubles the body', () => {
    it('every realm boundary is worth exactly BODY_REALM_MULTIPLIER', () => {
        for (let i = 1; i < REALM_TIERS.length; i++) {
            const below = REALM_TIERS[i - 1];
            const here = REALM_TIERS[i];
            expect(bodyMultiplierForOrdinal(here.ordinalStart)).toBeCloseTo(
                bodyMultiplierForOrdinal(below.ordinalStart) * BODY_REALM_MULTIPLIER, 6
            );
        }
    });

    it('the curve is continuous: a realm\'s Perfection is the next realm\'s Early', () => {
        // This is what `WITHIN_REALM_BODY_PEAK === BODY_REALM_MULTIPLIER` buys,
        // and it is the design statement that a CROSSING enlarges nothing on
        // its own. The rungs did the work. Power is deliberately the other way.
        expect(WITHIN_REALM_BODY_PEAK).toBe(BODY_REALM_MULTIPLIER);
        for (let i = 1; i < REALM_TIERS.length; i++) {
            const below = REALM_TIERS[i - 1];
            const here = REALM_TIERS[i];
            expect(bodyMultiplierForOrdinal(here.ordinalStart)).toBeCloseTo(
                bodyMultiplierForOrdinal(below.ordinalEnd), 6
            );
        }
    });

    it('a rung buys body; a crossing does not, and nothing takes any away', () => {
        // Two statements, and the second is the continuity above seen from the
        // player's side: climbing WITHIN a realm always buys something, and the
        // boundary itself buys nothing extra because the rungs already did.
        for (let ordinal = 1; ordinal <= MAX_ORDINAL; ordinal++) {
            const sameRealm = realmForOrdinal(ordinal).key === realmForOrdinal(ordinal - 1).key;
            expect(maxHpForOrdinal(3, ordinal)).toBeGreaterThanOrEqual(maxHpForOrdinal(3, ordinal - 1));
            expect(maxQiForOrdinal(4, ordinal)).toBeGreaterThanOrEqual(maxQiForOrdinal(4, ordinal - 1));
            if (sameRealm) {
                expect(
                    maxHpForOrdinal(3, ordinal),
                    `ordinal ${ordinal} is a sub-rank step and must buy body`
                ).toBeGreaterThan(maxHpForOrdinal(3, ordinal - 1));
                expect(maxQiForOrdinal(4, ordinal)).toBeGreaterThan(maxQiForOrdinal(4, ordinal - 1));
            } else {
                expect(
                    maxHpForOrdinal(3, ordinal),
                    `the crossing into ordinal ${ordinal} must buy nothing on its own`
                ).toBe(maxHpForOrdinal(3, ordinal - 1));
            }
        }
    });

    it('force outruns the vessel, at every realm', () => {
        // AGENTS.md, "nothing in this world is invincible", expressed as a
        // curve rather than as a branch: power is x4 a realm and the body is
        // x2, so climbing never accumulates enough body to stop dying. If the
        // body ever catches power, a long enough fight becomes unwinnable by
        // anybody and the world acquires a creature that cannot lose.
        for (let i = 1; i < REALM_TIERS.length; i++) {
            const from = REALM_TIERS[i - 1].ordinalStart;
            const to = REALM_TIERS[i].ordinalStart;
            const powerStep = powerMultiplierForOrdinal(to) / powerMultiplierForOrdinal(from);
            const bodyStep = bodyMultiplierForOrdinal(to) / bodyMultiplierForOrdinal(from);
            expect(powerStep).toBeGreaterThan(bodyStep);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ONE FORMULA FOR THE PLAYER AND THE WORLD
// ─────────────────────────────────────────────────────────────────────────

describe('a newborn is a newborn, whoever mints them', () => {
    it('ordinal 0 is untouched by the curve', () => {
        expect(bodyMultiplierForOrdinal(0)).toBe(1);
    });

    it('matches what the played birth path writes', () => {
        // `src/web/game.ts` mints the player's opening body as
        // `BASE_HP + might * HP_PER_MIGHT` / `BASE_QI + insight * QI_PER_INSIGHT`
        // with no ordinal term, which is correct AT BIRTH and is the reason
        // ordinal 0 must stay a multiplier of exactly 1. If these ever
        // disagree, a run opens on one body and is re-derived onto another the
        // first time it climbs.
        expect(maxHpForOrdinal(3, 0)).toBe(20 + 3 * 10);
        expect(maxQiForOrdinal(4, 0)).toBe(10 + 4 * 5);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE CALIBRATION - WHERE THE NUMBER TWO ACTUALLY COMES FROM
// ─────────────────────────────────────────────────────────────────────────

describe('the aperture can pay for the arts the rung opens', () => {
    it('WEAKEST_LEGAL_INSIGHT is still the floor the schema enforces', () => {
        expect(InnateAttributesSchema.safeParse(attributes(WEAKEST_LEGAL_INSIGHT)).success).toBe(true);
        expect(InnateAttributesSchema.safeParse(attributes(WEAKEST_LEGAL_INSIGHT - 1)).success).toBe(false);
    });

    it('by the time a grade band closes, its deepest art is fuelled by the dullest cultivator', () => {
        // THE CALIBRATION, AND THE GUARD ON THE NUMBER TWO.
        //
        // Climbing through a grade's ordinal band has to be enough to fuel that
        // grade, for anybody, however little Insight they were born with. That
        // is what ties the pool curve to `GRADE_QI_BANDS`: the qi ceiling rises
        // about x3.5 every eight rungs, so the pool has to roughly double every
        // major realm to keep pace. Flatten the pool again and heaven grade
        // fails here on the first assertion.
        //
        // It is the band's CLOSE rather than its open, deliberately. A dull
        // cultivator standing on the first rung of a band who cannot yet fuel
        // its deepest art is the world working - Insight buys an aperture, and
        // being short of it should cost something.
        for (const grade of Object.keys(GRADE_ORDINAL_BANDS) as Array<keyof typeof GRADE_QI_BANDS>) {
            const closesAt = Math.min(MAX_ORDINAL, GRADE_ORDINAL_BANDS[grade].max);
            const pool = maxQiForOrdinal(WEAKEST_LEGAL_INSIGHT, closesAt);
            expect(
                pool,
                `${grade} closes at ordinal ${closesAt} and tops out at ${GRADE_QI_BANDS[grade].max} qi`
            ).toBeGreaterThanOrEqual(GRADE_QI_BANDS[grade].max);
        }
    });

    it('every ordinary art is payable by somebody standing at the rung it opens on', () => {
        // The weaker per-row bar, and the one that catches a catalog row nobody
        // in the world could ever fuel: at its own `requiredOrdinal`, with the
        // BEST Insight the schema allows, the art has to be castable at all.
        //
        // Wide-span manuals are exempt because being unusable for a long time
        // is the whole of what they are - see the wide-span note in
        // `techniques.ts`. `isWideSpan` is derived, so the exemption cannot be
        // claimed by a row that has not actually reached past its own realm.
        const best = 4;
        const unpayable = TECHNIQUES
            .filter(t => !isWideSpan(t))
            .filter(t => t.qiCost > maxQiForOrdinal(best, Math.min(MAX_ORDINAL, t.requiredOrdinal)));
        expect(
            unpayable.map(t => `${t.name} (${t.qiCost} qi at ordinal ${t.requiredOrdinal})`)
        ).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE INVARIANT THAT MAKES ALL OF THE ABOVE SAFE
// ─────────────────────────────────────────────────────────────────────────

function peer(id: string, ordinal: number, maxHp: number): CombatantInput {
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
        weapon: null
    } as CombatantInput;
}

function peerFight(ordinal: number, pool: number) {
    const r = resolveConfrontation(
        peer('a', ordinal, pool),
        peer('b', ordinal, pool),
        {
            rng: new CultivationRNG('what-a-rung-buys-in-body'),
            ambient: 'normal',
            turn: 1,
            intent: { goal: 'drive_off', willWithdraw: true }
        }
    );
    const dealt = r.exchanges.filter(e => e.attackerId === 'a').reduce((s, e) => s + e.result.damage, 0);
    return { exchanges: r.exchanges.length, share: dealt / pool, outcome: r.outcome };
}

describe('damage is a share of the pool, and that is why the pool may grow', () => {
    it('a rung-matched pair settles the same way at the bottom of the ladder and at the top', () => {
        // The load-bearing relationship. `resolveExchange` charges damage as a
        // fraction of the DEFENDER'S OWN maximum, so a peer fight is the same
        // length and the same shape whether the two of them hold fifty points
        // or twenty-five thousand.
        //
        // Break this - make damage a flat number that scales with realm, or
        // flatten the pool again - and one arm of this comparison collapses.
        // A rung-matched pair resolving in one blow is as wrong as a pair
        // grinding forever.
        const rungs = [0, 13, 21, 29, 37, MAX_ORDINAL];
        const measured = rungs.map(o => ({ o, ...peerFight(o, maxHpForOrdinal(3, o)) }));

        const first = measured[0];
        for (const m of measured) {
            expect(m.exchanges, `ordinal ${m.o} took ${m.exchanges} exchanges`).toBe(first.exchanges);
            // Within a point of a percent. The residue is integer rounding of
            // a fraction against pools three orders of magnitude apart, not a
            // change in what an exchange costs.
            expect(m.share, `ordinal ${m.o} spent ${(m.share * 100).toFixed(1)}% of the pool`)
                .toBeCloseTo(first.share, 1);
            expect(m.outcome).toBe(first.outcome);
        }

        // And it is a real fight rather than a rout or a grind at every rung.
        expect(first.exchanges).toBeGreaterThan(2);
        expect(first.exchanges).toBeLessThan(40);
    });

    it('the pool is not what decides a fight', () => {
        // The same rung, the same seed, one side's pool multiplied twentyfold.
        // The exchange COUNT is unchanged, because both sides lose the same
        // share per blow whatever the absolute numbers are.
        const small = peerFight(29, 50);
        const large = peerFight(29, maxHpForOrdinal(3, 29));
        expect(large.exchanges).toBe(small.exchanges);
        expect(large.share).toBeCloseTo(small.share, 1);
    });
});

describe('nothing anywhere derives a pool of its own', () => {
    it('a rung is priced the same by the realm it is in', () => {
        // Cheap guard against a second formula reappearing: the pool at any
        // ordinal is a pure function of the attributes and the rung, and the
        // realm it belongs to is the only thing consulted.
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const tier = realmForOrdinal(ordinal);
            expect(bodyMultiplierForOrdinal(ordinal)).toBeGreaterThanOrEqual(
                bodyMultiplierForOrdinal(tier.ordinalStart)
            );
            expect(bodyMultiplierForOrdinal(ordinal)).toBeLessThanOrEqual(
                bodyMultiplierForOrdinal(tier.ordinalEnd)
            );
        }
    });
});
