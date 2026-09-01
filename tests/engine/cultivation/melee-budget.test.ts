/**
 * The round budget, and the stalemate rate that was invisible.
 *
 * ── The defect ───────────────────────────────────────────────────────────
 *
 * `resolveMelee` ran on `MAX_EXCHANGES`, a constant calibrated in its own
 * comment for a DUEL. Two quantities in the melee scale differently:
 *
 *   work to do    LINEAR in bodies. Each one needs roughly four landed strikes
 *                 to fall or break off.
 *   rate of work  CAPPED. `strikesThisRound` spends `sideStrength`'s
 *                 multiplier, `min(MAX_NUMBERS_MULTIPLIER = 2, ...)`. A side of
 *                 fifteen lands two strikes a round, exactly as a side of two
 *                 does. That cap is correct and load-bearing - numbers must not
 *                 buy force - but it means rounds-to-resolve grows linearly
 *                 while the budget did not.
 *
 * A mobilised apex of fifteen therefore needed about thirty rounds and was
 * given eight. The conspiracy harness measured `winningSideId: null` in 300 of
 * 300 at sides of 8, 15 and 5; the identical construction at two or three a
 * side stalemated 0 times in 3,000. Side SIZE decided whether the resolver
 * resolved anything.
 *
 * Downstream, `worthIt` gates on `winningSideId === 'a'`, so every stalemate
 * scored as "did not take the target" and every whole-house metric was
 * structurally zero. It printed as "nothing is worth doing", and it was read as
 * a balance problem in the power curve. It was a clock.
 *
 * This is the failure AGENTS.md names by title - a stalemate scored as a
 * defeat - and the reason it survived so long is that nobody was measuring the
 * STALEMATE RATE. These tests measure it, and only it, because the win rate is
 * exactly the number that hid this.
 *
 * ── After the fix, 200 seeds a cell ──────────────────────────────────────
 *
 *   bodies  budget   even sides            one side +4 ordinals
 *        1       8   0% stale, 49% / 51%   0% stale, 100%
 *        2      16   0% stale, 55% / 45%   0% stale, 100%
 *        3      24   0% stale, 50% / 50%   0% stale, 100%
 *        5      40   0% stale, 52% / 48%   0% stale, 100%
 *        8      64   0% stale, 50% / 50%   0% stale, 100%
 *       15     120   0% stale, 53% / 47%   0% stale, 100%
 *
 * Even sides come out level at every size and lopsided ones come out decisive
 * at every size, which is what "side size must not decide whether the resolver
 * resolves" looks like when it holds.
 */

import { describe, it, expect } from 'vitest';
import {
    MAX_EXCHANGES,
    meleeRoundBudget,
    resolveMelee,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

function body(ordinal: number, id: string): CombatantInput {
    const hp = Math.max(10, 20 + ordinal * 12);
    return {
        id, name: id, realmOrdinal: ordinal, spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [], hp, maxHp: hp, qi: hp, maxQi: hp,
        artifactGrade: 0, battlesSurvived: 0, technique: null, techniqueMastery: 0
    };
}

function side(id: string, n: number, ordinal: number) {
    return { id, name: id, members: Array.from({ length: n }, (_, i) => body(ordinal, `${id}-${i}`)) };
}

/** Share of seeded engagements that ended with nobody winning. */
function stalemateRate(n: number, ordinalA: number, ordinalB: number, seeds = 200): number {
    let stale = 0;
    for (let s = 0; s < seeds; s++) {
        const result = resolveMelee([side('a', n, ordinalA), side('b', n, ordinalB)], {
            rng: forStream(`melee-${s}`, 'melee', 1),
            ambient: 'normal', turn: 1, intent: { goal: 'kill' }
        });
        if (result.winningSideId === null) stale++;
    }
    return stale / seeds;
}

function aggressorWinRate(n: number, ordinalA: number, ordinalB: number, seeds = 200): number {
    let wins = 0;
    for (let s = 0; s < seeds; s++) {
        const result = resolveMelee([side('a', n, ordinalA), side('b', n, ordinalB)], {
            rng: forStream(`melee-${s}`, 'melee', 1),
            ambient: 'normal', turn: 1, intent: { goal: 'kill' }
        });
        if (result.winningSideId === 'a') wins++;
    }
    return wins / seeds;
}

const SIDE_SIZES = [1, 2, 3, 5, 8, 15];

describe('the budget scales with the thing that scales', () => {
    it('leaves a duel on exactly the constant it was calibrated for', () => {
        expect(meleeRoundBudget([{ members: [1] }, { members: [1] }])).toBe(MAX_EXCHANGES);
    });

    it('gives a mobilised apex headroom per body of the side that falls first', () => {
        expect(meleeRoundBudget([{ members: new Array(15) }, { members: new Array(5) }]))
            .toBe(MAX_EXCHANGES * 5);
    });

    it('reads the SMALLEST side, so numbers buy time and never a longer clock', () => {
        // Largest would let sixty bodies grind down somebody they cannot hurt.
        expect(meleeRoundBudget([{ members: new Array(2) }, { members: new Array(9) }]))
            .toBe(MAX_EXCHANGES * 2);
        expect(meleeRoundBudget([{ members: new Array(60) }, { members: new Array(1) }]))
            .toBe(MAX_EXCHANGES);
    });

    it('never returns nothing, however empty the sides', () => {
        expect(meleeRoundBudget([])).toBe(MAX_EXCHANGES);
        expect(meleeRoundBudget([{ members: [] }])).toBe(MAX_EXCHANGES);
    });
});

describe('side size does not decide whether the resolver resolves', () => {
    it('resolves an even engagement at every size', () => {
        // The regression, stated as the number that was never looked at. At
        // eight and fifteen a side this was 100%.
        for (const n of SIDE_SIZES) {
            expect(stalemateRate(n, 20, 20), `${n} a side, even`).toBe(0);
        }
    });

    it('resolves a lopsided engagement at every size', () => {
        for (const n of SIDE_SIZES) {
            expect(stalemateRate(n, 24, 20), `${n} a side, lopsided`).toBe(0);
        }
    });
});

describe('and the outcomes are size-independent, which is the point', () => {
    it('keeps an even engagement even, from a duel to a war', () => {
        for (const n of SIDE_SIZES) {
            const rate = aggressorWinRate(n, 20, 20);
            expect(rate, `${n} a side`).toBeGreaterThan(0.35);
            expect(rate, `${n} a side`).toBeLessThan(0.65);
        }
    });

    it('keeps a four-rung advantage decisive, from a duel to a war', () => {
        for (const n of SIDE_SIZES) {
            expect(aggressorWinRate(n, 24, 20), `${n} a side`).toBe(1);
        }
    });
});
