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
 *   TIES RESOLVE      a relationship whose target is nobody the world holds, and
 *                     a renderer that reads the dead as if they were living.
 *   FACTS FIND PEOPLE a killing recoverable only from a string on the corpse.
 *   TYPED WOUNDS      two thirds of everything anybody carried was a wound with
 *                     no name and a description composed out of two enums.
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
import { readTies } from '../../../src/engine/world/reading-a-tie-against-the-roster.js';
import { ordinaryWoundFor } from '../../../src/engine/cultivation/which-wound-an-ordinary-injury-is.js';
import { getWoundType } from '../../../src/data/cultivation/wounds.js';
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

describe('reading a tie against the roster', () => {
    it('tells the living, the dead and the unaccounted apart', () => {
        const state = advanced();
        const seen = new Set<string>();
        for (const npc of state.npcs) {
            for (const read of readTies(state, npc)) seen.add(read.standing);
        }
        // An advanced world holds all three. If it only held one, the reading
        // would be doing nothing and the test would be measuring itself.
        expect(seen.has('living')).toBe(true);
        expect(seen.has('dead')).toBe(true);
        expect(seen.has('unrecorded')).toBe(false);
    });

    it('dates a death rather than saying the person is gone', () => {
        const state = advanced();
        const toDead = state.npcs
            .flatMap(n => readTies(state, n))
            .find(r => r.standing === 'dead' && r.year !== null);
        expect(toDead).toBeDefined();
        expect(toDead!.description).toMatch(/dead since year -?\d+$/);
    });

    it('does not drop a tie because the other end died', () => {
        // The tie is the world's memory. Resolving it must not prune it.
        const state = advanced();
        const npc = state.npcs.reduce((best, n) =>
            n.relationships.length > best.relationships.length ? n : best);
        expect(readTies(state, npc)).toHaveLength(npc.relationships.length);
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
        const after = setExistence(alive, { to: 'soul_preserved', onDay: 400000, soulState: 'fragmented' });
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

    it('a fact about somebody that cannot be reached from them', () => {
        // ACTORS, not witnesses. `historyFactIds` is the trajectory - what
        // happened to this person - and `witnessIds` is who was standing there.
        // Linking both put every bystander's record on every fact they were
        // near and turned the most-documented life in the world into a police
        // blotter for a postcode. Presence is still stored, in full, on the fact.
        const state = advanced();
        const unreachable: string[] = [];
        for (const fact of state.history.facts) {
            for (const actor of fact.actors) {
                const npc = state.npcs.find(n => n.id === actor.id);
                if (npc && !npc.historyFactIds.includes(fact.id)) {
                    unreachable.push(`${fact.id} names ${npc.name}, who does not carry it`);
                }
            }
        }
        expect(unreachable.slice(0, 5)).toEqual([]);
    });

    it('a killing known only from the victim\'s end note', () => {
        // The defect this was reported as: the killer had no record of having
        // done it, and the only trace was a string on the corpse.
        const state = advanced();
        const orphaned: string[] = [];
        for (const victim of state.npcs.filter(n => /^Killed by /.test(n.endNote))) {
            const fact = state.history.facts.find(f =>
                f.actors.some(a => a.role === 'victim' && a.id === victim.id));
            if (!fact) { orphaned.push(`${victim.name}: no fact at all`); continue; }
            const killerId = fact.actors.find(a => a.role === 'killer')?.id;
            const killer = state.npcs.find(n => n.id === killerId);
            if (!killer) { orphaned.push(`${victim.name}: killer does not resolve`); continue; }
            if (!killer.historyFactIds.includes(fact.id)) {
                orphaned.push(`${victim.name}: ${killer.name} does not carry ${fact.id}`);
            }
        }
        expect(orphaned).toEqual([]);
    });

    it('a wound nobody can name', () => {
        // Two thirds of everything anybody was carrying used to be a row with
        // `woundType: null` and a description composed out of two enums. Every
        // one of those was a real minted injury from a real event - not a
        // fabrication from a count - which the engine knew everything about
        // except what to call it.
        const state = advanced();
        const untyped: string[] = [];
        for (const npc of state.npcs) {
            for (const injury of npc.cultivation.injuries) {
                if (!injury.woundType) untyped.push(`${npc.name}: ${injury.severity} ${injury.source}`);
                else if (!getWoundType(injury.woundType)) {
                    untyped.push(`${npc.name}: unknown key ${injury.woundType}`);
                }
            }
        }
        expect(untyped.slice(0, 5)).toEqual([]);
    });

    it('a bar-room brawl that hands out a permanent maiming', () => {
        // The default must never reach the permanent band or the broken
        // statuses. Those are outcomes something DECIDED, and a default that
        // could produce one would let ordinary combat produce the population
        // the crossing-failure table exists to produce.
        for (const source of ['combat', 'qi_deviation', 'tribulation', 'poison',
            'backlash', 'failed_breakthrough', 'other'] as const) {
            for (const severity of ['minor', 'serious', 'crippling'] as const) {
                const key = ordinaryWoundFor(source, severity);
                const row = getWoundType(key);
                expect(row, `${source}/${severity} names ${key}`).not.toBeNull();
                expect(row!.permanent, `${source}/${severity} -> ${key}`).toBe(false);
                expect(row!.severities, `${source}/${severity} -> ${key}`).toContain(severity);
            }
        }
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
