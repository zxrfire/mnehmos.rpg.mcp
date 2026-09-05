/**
 * The two progression gates, and the asymmetry between them.
 *
 *   no proper cultivation technique  ->  progress is IMPOSSIBLE
 *   no suitable master               ->  progress SLOWS
 *
 * One axis can be ground through at a cost in years; the other cannot be
 * ground through at all. Collapsing them into two penalties of different sizes
 * would lose the only thing that makes them worth having, so both shapes are
 * asserted here rather than only their sizes.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * 38 factions carry a `production: { reliableOrdinal, peakOrdinal, ... }` and
 * it is READ, not decorative: `members.ts` generates a faction's own roster
 * against `reliableOrdinal`, and the world catalog and seeding read it too. So
 * every NPC in the world obeys their house's ceiling.
 *
 * Only the player was exempt. The Azure Dew Sect reads reliable 14 / peak 24 -
 * one cultivator past 24 in its whole history, seventy years ago - and a player
 * on its roll climbed to ordinal 44. Twenty rungs past the best it has ever
 * produced, with nothing in the game remarking on it.
 *
 * The fix is supply, never a check on faction id: a low house has no higher
 * manual to give you, and the manual carries the ceiling. `reliableOrdinal` is
 * the right number to key it off - what a house can RELIABLY turn out is what
 * its ordinary manual teaches. `peakOrdinal` is the other question entirely:
 * somebody who found something else. Burnt Earth Temple at reliable 13 and
 * peak 46 - a local temple that once produced a True Immortal - is the setting
 * telling that story already, and the gap between those two numbers is the
 * whole game.
 */

import { describe, it, expect } from 'vitest';
import {
    GUIDANCE_FULL_GAP,
    GUIDANCE_MAX_BONUS,
    computeCultivationRate,
    guidanceMultiplier,
    techniqueExhausted
} from '../../../src/engine/cultivation/cultivation.js';
import { makeCultivator } from './fixtures.js';

const AZURE_DEW_RELIABLE = 14;

describe('the technique ceiling is hard', () => {
    it('stops progress dead at the cap rather than tapering toward it', () => {
        // A ceiling that gets gradually stickier reads as bad luck. One that
        // stops dead reads as a fact about the book in your hands - which is
        // what it is, and it is the one that sends a player looking.
        const below = computeCultivationRate(
            makeCultivator({ realmOrdinal: AZURE_DEW_RELIABLE - 1 }), 'normal',
            { techniqueCap: AZURE_DEW_RELIABLE }
        );
        const at = computeCultivationRate(
            makeCultivator({ realmOrdinal: AZURE_DEW_RELIABLE }), 'normal',
            { techniqueCap: AZURE_DEW_RELIABLE }
        );
        expect(below.perDay).toBeGreaterThan(0);
        expect(at.perDay).toBe(0);
    });

    it('says which line stopped them, in the breakdown', () => {
        const capped = computeCultivationRate(
            makeCultivator({ realmOrdinal: 20 }), 'normal', { techniqueCap: 14 }
        );
        const ceiling = capped.factors.find(f => f.source === 'technique_ceiling');
        expect(ceiling).toBeDefined();
        expect(ceiling!.multiplier).toBe(0);
        expect(ceiling!.label).toMatch(/manual ends/i);
    });

    it('imposes nothing when no manual is declared', () => {
        // Every existing caller, unchanged. The data layer must supply a `cap`
        // per cultivation manual before this gate can bite anywhere.
        expect(techniqueExhausted(44, undefined)).toBe(false);
        expect(techniqueExhausted(44, null)).toBe(false);
        expect(
            computeCultivationRate(makeCultivator({ realmOrdinal: 44 }), 'normal').perDay
        ).toBeGreaterThan(0);
    });

    it('makes a low house structurally unable to produce a high cultivator', () => {
        // The Azure Dew case, as arithmetic. On its ordinary manual, no amount
        // of time carries anybody past its reliable figure - which is what its
        // own roster has always obeyed.
        for (const ordinal of [14, 20, 30, 44]) {
            expect(
                computeCultivationRate(
                    makeCultivator({ realmOrdinal: ordinal }), 'spirit_tide',
                    { techniqueCap: AZURE_DEW_RELIABLE, sectBonus: 3, locationBonus: 3 }
                ).perDay,
                `ordinal ${ordinal} on a reliable-14 manual`
            ).toBe(0);
        }
    });
});

describe('the master is soft', () => {
    it('slows nobody down by being absent', () => {
        // Absence is the baseline, not a penalty: "progress slows without a
        // suitable master" is true comparatively, and making it a straight nerf
        // would quietly slow every caller that does not yet supply a guide.
        expect(guidanceMultiplier(10, null)).toBe(1);
        expect(guidanceMultiplier(10, undefined)).toBe(1);
    });

    it('gives nothing for a master at or below the cultivator', () => {
        // "You can't hit 44 guided by a 10 the entire game."
        expect(guidanceMultiplier(20, 10)).toBe(1);
        expect(guidanceMultiplier(20, 20)).toBe(1);
        expect(guidanceMultiplier(44, 10)).toBe(1);
    });

    it('is worth more the further above you the master stands, and saturates', () => {
        const near = guidanceMultiplier(10, 12);
        const far = guidanceMultiplier(10, 10 + GUIDANCE_FULL_GAP);
        const absurd = guidanceMultiplier(10, 44);
        expect(near).toBeGreaterThan(1);
        expect(far).toBeGreaterThan(near);
        expect(far).toBeCloseTo(1 + GUIDANCE_MAX_BONUS, 10);
        // The limit is what the student can receive, not what the master holds.
        expect(absurd).toBe(far);
    });

    it('decays as the student climbs toward their master, which is the send-off', () => {
        // A master who was a great help early is worth nothing once you stand
        // beside them - and they can perceive it, which is why they send you
        // away rather than keeping you.
        const master = 18;
        const early = guidanceMultiplier(6, master);
        const later = guidanceMultiplier(15, master);
        const beside = guidanceMultiplier(18, master);
        expect(early).toBeGreaterThan(later);
        expect(later).toBeGreaterThan(1);
        expect(beside).toBe(1);
    });

    it('can be ground through: slow is not stopped', () => {
        // The asymmetry, stated directly. An unguided cultivator still moves.
        const guided = computeCultivationRate(
            makeCultivator({ realmOrdinal: 10 }), 'normal', { guideOrdinal: 30 }
        ).perDay;
        const alone = computeCultivationRate(
            makeCultivator({ realmOrdinal: 10 }), 'normal'
        ).perDay;
        expect(alone).toBeGreaterThan(0);
        expect(guided).toBeGreaterThan(alone);
    });
});

describe('the two gates do not collapse into each other', () => {
    it('keeps a capped cultivator at zero however good their master is', () => {
        expect(
            computeCultivationRate(
                makeCultivator({ realmOrdinal: 14 }), 'spirit_tide',
                { techniqueCap: 14, guideOrdinal: 44 }
            ).perDay
        ).toBe(0);
    });
});
