/**
 * Two questions, and they must not be answered by the same function.
 *
 *   WHO IS BORN?              The weighted birth table. A high birth is roughly
 *                             one in forty-one thousand and this file asserts
 *                             that nothing here moved it by a digit.
 *
 *   WHO IS ALREADY STANDING   The birth table reweighted by which births
 *   IN THAT SEAT?             actually produce somebody who finished a climb.
 *
 * The bug this file guards against is answering the second with the first,
 * which produced a world whose entire aristocracy was born on farms: 89.4% of
 * the seniors of apex bodies `thin_county`, and not one person in a living
 * population of 2,538 born into any high tier.
 *
 * The bug in the OTHER direction is a hard mapping from seat to origin, which
 * would delete the farmer's child who reached an elder's seat. Both are
 * asserted.
 */

import { describe, it, expect } from 'vitest';
import {
    drawOriginForSomebodyAlreadyAtOrdinal,
    originSharesAtOrdinal,
    originWeightsForSomebodyAtOrdinal,
    rungsAFortuneFunds,
    selectionLikelihood
} from '../../../src/engine/world/where-the-seeded-population-was-born.js';
import {
    ORIGIN_TIERS,
    getOrigin,
    rollOrigin,
    originProbability,
    type OriginTierKey
} from '../../../src/engine/cultivation/origin.js';
import { HOUSEHOLD_ORIGINS } from '../../../src/engine/world/how-many-of-the-broken-are-ever-mended.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { MEMBERS } from '../../../src/data/cultivation/members.js';
import { clampOrdinal } from '../../../src/engine/cultivation/realms.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

const highShare = (shares: Map<OriginTierKey, number>) =>
    HOUSEHOLD_ORIGINS.reduce((sum, k) => sum + (shares.get(k) ?? 0), 0);

// ─────────────────────────────────────────────────────────────────────────

describe('the birth table is the prior and is never touched', () => {
    it('returns the birth table exactly at ordinal zero', () => {
        // The property that keeps the world where it is. Almost everybody is at
        // or near the bottom, so if the conditioned draw did not collapse onto
        // the prior here, the marginal distribution would move.
        const shares = originSharesAtOrdinal(0);
        for (const tier of ORIGIN_TIERS) {
            expect(shares.get(tier.key)).toBeCloseTo(originProbability(tier.key), 12);
        }
    });

    it('gives every birth a likelihood of exactly one at ordinal zero', () => {
        for (const tier of ORIGIN_TIERS) {
            expect(selectionLikelihood(tier, 0)).toBe(1);
        }
    });

    it('leaves the two births that fund nothing on their prior at every rung', () => {
        // A farm and a market town cannot afford the crossing at ordinal zero,
        // so they carry no advantage anywhere and their weight is never scaled.
        // What moves their SHARE is other tiers gaining, never a penalty here.
        for (const key of ['thin_county', 'market_town'] as const) {
            expect(rungsAFortuneFunds(getOrigin(key).spiritStones)).toBe(0);
            for (const ordinal of [0, 5, 13, 21, 33, 44]) {
                expect(selectionLikelihood(getOrigin(key), ordinal)).toBe(1);
            }
        }
    });

    it('reads the funded rungs off the existing price curve', () => {
        // `origin.ts` states the answer in prose - "thirty times the money buys
        // about eleven more rungs" - and this is that sentence as arithmetic.
        expect(rungsAFortuneFunds(15_000)).toBeCloseTo(11.33, 1);
        expect(rungsAFortuneFunds(90_000)).toBeCloseTo(17.30, 1);
        // Logarithmic, which is why a fortune is a stretch of road and not a win.
        expect(rungsAFortuneFunds(90_000)).toBeLessThan(4 * rungsAFortuneFunds(15_000));
    });
});

describe('the well-born are common at the top and rare in the world', () => {
    it('is a large minority of a high seat, not a token and not all of it', () => {
        const shares = originSharesAtOrdinal(40);
        const high = highShare(shares);
        // The shape the design owner specified: a large minority. Bounds are
        // deliberately wide - this catches an axis that has become a rule or a
        // rounding error, not a tuning pass.
        expect(high).toBeGreaterThan(0.25);
        expect(high).toBeLessThan(0.6);
    });

    it('leaves a farm birth the single commonest origin even at the top', () => {
        // A rule with no exceptions is an assertion. The farmer's child who
        // reached an elder's seat is uncommon and must never be impossible.
        const shares = originSharesAtOrdinal(44);
        expect(shares.get('thin_county')!).toBeGreaterThan(0.2);
        for (const tier of ORIGIN_TIERS) {
            expect(shares.get(tier.key)!).toBeGreaterThan(0);
        }
    });

    it('climbs with the rung and then stops when the fortune runs out', () => {
        const at = [0, 6, 13, 17, 21, 30, 44].map(o => highShare(originSharesAtOrdinal(o)));
        for (let i = 1; i < at.length; i++) {
            expect(at[i]).toBeGreaterThanOrEqual(at[i - 1] - 1e-12);
        }
        // The deepest fortune funds about seventeen rungs, so nothing above
        // that buys any further advantage. The plateau is the money ending.
        expect(highShare(originSharesAtOrdinal(21)))
            .toBeCloseTo(highShare(originSharesAtOrdinal(44)), 6);
    });

    it('is still vanishingly rare for somebody standing at the bottom', () => {
        expect(highShare(originSharesAtOrdinal(0))).toBeLessThan(0.0001);
        expect(highShare(originSharesAtOrdinal(3))).toBeLessThan(0.001);
    });
});

describe('the draw is a draw', () => {
    it('is deterministic in its sample', () => {
        for (const s of [0, 0.25, 0.5, 0.75, 0.999999999]) {
            expect(drawOriginForSomebodyAlreadyAtOrdinal(s, 40).key)
                .toBe(drawOriginForSomebodyAlreadyAtOrdinal(s, 40).key);
        }
    });

    it('produces spread rather than one answer', () => {
        const rng = forStream('spread', 'draw');
        const seen = new Set<OriginTierKey>();
        for (let i = 0; i < 4_000; i++) {
            seen.add(drawOriginForSomebodyAlreadyAtOrdinal(rng.next(), 40).key);
        }
        // Every tier is reachable at a high seat, including the ones that make
        // it a story rather than a rule.
        expect(seen.size).toBe(ORIGIN_TIERS.length);
    });

    it('lands on a weight that is prior times likelihood', () => {
        const rows = originWeightsForSomebodyAtOrdinal(30);
        for (const row of rows) {
            expect(row.weight).toBeCloseTo(row.tier.weight * selectionLikelihood(row.tier, 30), 6);
        }
    });
});

describe('anybody being BORN still draws from the lottery', () => {
    it('leaves createNpc on rollOrigin when no origin is supplied', () => {
        // The exact draw, not a distribution: this is the path every person
        // born in play and every derived provincial takes, and it must be the
        // same function it always was.
        for (const id of ['npc-1', 'npc-77', 'npc-412']) {
            const npc = createNpc('lottery-seed', { id, bornOnDay: 0, onDay: 0 });
            expect(npc.identity.origin)
                .toBe(rollOrigin(forStream('lottery-seed', 'npc-origin', id).next()).key);
        }
    });

    it('records a supplied origin and changes nothing else about the person', () => {
        // Proof that the new field perturbs no stream. Spirit root, attributes,
        // name and lifespan are identical; one recorded fact differs.
        const opts = { id: 'npc-9', bornOnDay: 0, onDay: 0 };
        const rolled = createNpc('same-seed', opts);
        const given = createNpc('same-seed', { ...opts, origin: 'dao_house_bloodline' as const });
        expect(given.identity.origin).toBe('dao_house_bloodline');
        expect(given.cultivation).toEqual(rolled.cultivation);
        expect(given.name).toBe(rolled.name);
        expect({ ...given, identity: rolled.identity }).toEqual(rolled);
    });
});

const catalog = await loadCultivationCatalog();

describe('the seeded world reads correctly off the register', () => {
    const { state } = seedWorld({ seed: 'register-read', catalog });
    const placed = state.npcs.filter(n => n.tags.some(t => t.startsWith('catalog:')));
    const derived = state.npcs.filter(n => !n.tags.some(t => t.startsWith('catalog:')));

    it('no longer reads thin_county all the way down', () => {
        const high = placed.filter(n => HOUSEHOLD_ORIGINS.includes(n.identity.origin));
        expect(placed.length).toBeGreaterThan(50);
        expect(high.length / placed.length).toBeGreaterThan(0.05);
    });

    it('does not read high-born all the way down either', () => {
        const thin = placed.filter(n => n.identity.origin === 'thin_county');
        expect(thin.length / placed.length).toBeGreaterThan(0.2);
    });

    it('leaves the ordinary provincial population on the lottery', () => {
        // The derived population's origin is an INPUT to `deriveLife`, which
        // then spends it. Conditioning it on the ordinal it produced would
        // invert the causality, and it would show up right here.
        expect(derived.length).toBeGreaterThan(200);
        expect(derived.filter(n => HOUSEHOLD_ORIGINS.includes(n.identity.origin)).length).toBe(0);
        for (const npc of derived.slice(0, 40)) {
            expect(npc.identity.origin)
                .toBe(rollOrigin(forStream(state.seed, 'npc-origin', npc.id).next()).key);
        }
    });

    it('buys no rank with any of it', () => {
        // THE LOAD-BEARING ASSERTION. Every catalog figure stands at exactly the
        // ordinal the catalog gave them, whatever they turned out to have been
        // born as. Origin is recorded here and never spent: nobody is at the
        // top because they were born well.
        const byId = new Map(state.npcs.map(n => [n.id, n]));
        let checked = 0;
        for (const member of MEMBERS) {
            const npc = byId.get(`npc-${member.id}`);
            if (!npc) continue;
            expect(npc.cultivation.realmOrdinal).toBe(clampOrdinal(member.realmOrdinal));
            checked++;
        }
        expect(checked).toBeGreaterThan(50);
    });

    it('gives the same world on the same seed', () => {
        const again = seedWorld({ seed: 'register-read', catalog }).state;
        expect(again.npcs.map(n => `${n.id}:${n.identity.origin}`))
            .toEqual(state.npcs.map(n => `${n.id}:${n.identity.origin}`));
    });
});
