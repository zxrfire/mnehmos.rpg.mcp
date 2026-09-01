/**
 * The cheap invariants that catch a world which cannot be asked questions about
 * itself.
 *
 * Each of these was a real defect in a seeded, advanced world, and each was
 * found by reading a roster rather than by any test - which is the point of
 * writing them down here. They are all of the same shape: a value that has to
 * agree with another value, written by a path that only knew about one of them.
 *
 *   SOUL AND SELF     a fading soul at 100% continuity. Every corpse in a
 *                     four-hundred-year run - 2,054 of them.
 *   BORN INTO HISTORY an ordinal 44 born in year -24,008, in a world whose
 *                     earliest era opens in -1,700.
 *   TIES RESOLVE      a relationship whose target is nobody the world holds.
 *
 * Run against a seeded world and against one that has been advanced, because
 * seeding and advancement write these fields through completely different code
 * and only one of them was ever wrong at a time.
 */

import { describe, it, expect } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { markDead, setExistence } from '../../../src/engine/world/npc-state.js';
import { expelsOrdinal } from '../../../src/engine/world/layers.js';
import {
    continuityCeilingFor,
    reconcileSoulAndSelf,
    ruinSoul,
    soulAndSelfDisagree
} from '../../../src/engine/cultivation/how-much-of-a-person-is-left.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

function seeded(seed = 'invariant-a', population = 250): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population }).state;
}

function advanced(seed = 'invariant-a', years = 80): WorldState {
    return advanceWorldYears(seeded(seed), years, { pressure: { eventsPerYear: 2 } }).state;
}

describe('how much of a person is left', () => {
    it('caps continuity at what the soul it belongs to can hold', () => {
        expect(continuityCeilingFor('intact')).toBe(1);
        expect(continuityCeilingFor('damaged')).toBeLessThan(1);
        expect(continuityCeilingFor('fragmented')).toBeLessThan(continuityCeilingFor('damaged'));
        expect(continuityCeilingFor('fading')).toBeLessThan(continuityCeilingFor('fragmented'));
    });

    it('never restores a soul or a self', () => {
        const wrecked = ruinSoul({ soulState: 'fragmented' as const, identityContinuity: 0.4 }, 'damaged');
        // 'damaged' is BETTER than 'fragmented'. Asking for it must change nothing.
        expect(wrecked.soulState).toBe('fragmented');
        expect(wrecked.identityContinuity).toBeCloseTo(0.4, 6);
    });

    it('brings continuity down with the soul rather than leaving it', () => {
        const before = { soulState: 'intact' as const, identityContinuity: 1 };
        const after = ruinSoul(before, 'fading');
        expect(after.soulState).toBe('fading');
        expect(after.identityContinuity).toBeLessThanOrEqual(continuityCeilingFor('fading'));
        expect(soulAndSelfDisagree(after)).toBe(false);
    });

    it('leaves the crossing table\'s own calibrated figures alone', () => {
        // `mad` sets fragmented at 0.35 and `heart_demon_rooted` sets damaged at
        // 0.75. Both are under their ceilings, and a ceiling that moved either
        // would be describing a different world from the failure table.
        expect(reconcileSoulAndSelf({ soulState: 'fragmented', identityContinuity: 0.35 })
            .identityContinuity).toBeCloseTo(0.35, 6);
        expect(reconcileSoulAndSelf({ soulState: 'damaged', identityContinuity: 0.75 })
            .identityContinuity).toBeCloseTo(0.75, 6);
    });
});

describe('a world must never contain', () => {
    it('a dead person who is still entirely themselves', () => {
        const state = seeded();
        const alive = state.npcs.find(n => n.status === 'alive')!;
        const dead = markDead(alive, 400000, 'Killed by somebody.');
        expect(dead.soulState).not.toBe('intact');
        expect(soulAndSelfDisagree(dead)).toBe(false);
    });

    it('an existence transition that fragments a soul and keeps the whole person', () => {
        const state = seeded();
        const alive = state.npcs.find(n => n.status === 'alive')!;
        // The caller names the soul and forgets the other half, which is exactly
        // how the world filled up with intact selves in ruined souls.
        const after = setExistence(alive, { to: 'soul_only', onDay: 400000, soulState: 'fragmented' });
        expect(soulAndSelfDisagree(after)).toBe(false);
    });

    it('a soul and a self that disagree, anywhere in an advanced world', () => {
        const state = advanced();
        const disagreeing = state.npcs.filter(soulAndSelfDisagree);
        expect(
            disagreeing.map(n => `${n.name} ${n.soulState}/${n.identityContinuity}`)
        ).toEqual([]);
    });

    it('anybody born before the world had a history to be born into', () => {
        for (const seed of ['invariant-a', 'invariant-b', 'invariant-c']) {
            const state = seeded(seed);
            const firstEra = state.history.eras.reduce(
                (earliest, era) => Math.min(earliest, era.startDay), Infinity);
            const early = state.npcs.filter(n => n.identity.bornOnDay < firstEra);
            expect(
                early.map(n => `${n.name} born day ${n.identity.bornOnDay}, ordinal ${n.cultivation.realmOrdinal}`)
            ).toEqual([]);
        }
    });

    it('anybody standing on a layer that expels their ordinal', () => {
        // Not the same claim as "layer agrees with ordinal". A layer is a PLACE:
        // Tribulation Transcendence is below the Lid and belongs there, so
        // `layer: mortal` on an ordinal 44 is correct and is not what this
        // checks. What is incoherent is standing somewhere that cannot hold you.
        const state = advanced();
        const wrong = state.npcs.filter(n => expelsOrdinal(n.layer, n.cultivation.realmOrdinal));
        expect(wrong.map(n => `${n.name} ${n.layer} ${n.cultivation.realmOrdinal}`)).toEqual([]);
    });

    it('a tie pointing at somebody the world does not hold', () => {
        const state = advanced();
        const ids = new Set(state.npcs.map(n => n.id));
        const dangling: string[] = [];
        for (const npc of state.npcs) {
            for (const tie of npc.relationships) {
                if (!ids.has(tie.targetId)) dangling.push(`${npc.name} -> ${tie.targetName}`);
            }
        }
        expect(dangling).toEqual([]);
    });
});
