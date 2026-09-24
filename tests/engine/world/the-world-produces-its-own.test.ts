/**
 * The world produces its apex rather than inheriting it.
 *
 * THE THREE DEFECTS THIS PINS
 * ---------------------------
 * 1. THE WORLD NEVER ROLLED A BREAKTHROUGH. `applyAdvancement` advanced NPCs
 *    with `deriveOrdinal`, a closed-form derivation seeding uses, and
 *    `attemptBreakthrough` was called only by measurement code. So nobody in
 *    the world had ever failed at a wall, been hurt by one, or died at one.
 *
 * 2. SO THE APEX WAS INHERITED. Measured across three seeds at 500, 1500 and
 *    5000 years before the change: every person standing at ordinal 41 or above
 *    was a survivor of the seeding, at every horizon, on every seed. Above Void
 *    Refinement the world held 7 people at 5,000 years, 4 of whom had arrived.
 *
 * 3. AND NO NPC COULD CARRY A WOUND. `untreatedInjuries` was an integer, so the
 *    whole authored tribulation-and-wounds layer - broken foundation, cracked
 *    core, a base left unfinished - was unreachable from the world.
 *
 * These are cheap unit assertions on the pieces plus one soak, deliberately in
 * that order: the soak is the thing that would tell you the world is wrong and
 * the units are the things that tell you which piece.
 *
 * THE SOAK NOW LIVES IN `scripts/the-upper-ladder-is-arrived-at.probe.ts`, and
 * the pairing above still holds across the two files. It was moved because it
 * was the last file still running in a 53-minute run of this directory - alone
 * for the final fifteen minutes, at 1.9 GB and climbing, holding three
 * 3,000-year worlds at once - while the other 206 files had finished. Defect 2
 * is the one it pins; defects 1 and 3 are pinned here.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import {
    guidanceFor,
    guideOrdinalFor,
    readyToStrike,
    strikeAtTheWall,
    TEACHING_TAKES_THIS_MUCH_OF_A_TEACHERS_YEAR,
    whatTeachingLeavesOfAMastersRate
} from '../../../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { applyManualCopying, manualIdOf, copyCount } from '../../../src/engine/world/manuals.js';
import { createNpc, carryingWounds, woundsCarriedBy } from '../../../src/engine/world/npc-state.js';
import { repairRetiredWoundKeys } from '../../../src/engine/world/recording-the-day-a-wound-was-taken.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { LAST_CROSSING_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

// ─────────────────────────────────────────────────────────────────────────
// WOUNDS AS ROWS
// ─────────────────────────────────────────────────────────────────────────

describe('an NPC can carry a wound that has a name', () => {
    const wound = {
        id: '00000000-0000-4000-8000-000000000001',
        severity: 'crippling' as const,
        source: 'failed_breakthrough' as const,
        description: 'The core cracked and did not reseat.',
        sustainedOnTurn: 12,
        treated: false,
        cultivationPenalty: 0.5,
        breakthroughPenalty: 0.25,
        woundType: 'cracked-core'
    };

    it('keeps the count as a count of the list, not beside it', () => {
        const npc = createNpc('wounds', { id: 'n1', bornOnDay: 0, onDay: 0 });
        expect(npc.cultivation.injuries).toEqual([]);
        expect(npc.cultivation.untreatedInjuries).toBe(0);

        const hurt = carryingWounds(npc, [wound], 400);
        expect(hurt.cultivation.injuries).toHaveLength(1);
        expect(hurt.cultivation.injuries[0].woundType).toBe('cracked-core');
        expect(hurt.cultivation.untreatedInjuries).toBe(1);
    });

    it('reconstructs generic rows only for a save that predates the list', () => {
        // The one remaining home of the fabrication that used to live in two
        // callers. A resolver that ignored a legacy count would silently heal
        // every NPC in an old world on load.
        const npc = createNpc('wounds', { id: 'n2', bornOnDay: 0, onDay: 0 });
        const legacy = {
            ...npc,
            cultivation: { ...npc.cultivation, untreatedInjuries: 3 }
        };
        const carried = woundsCarriedBy(legacy);
        expect(carried).toHaveLength(3);
        for (const row of carried) expect(row.woundType).toBeNull();

        // And a record that HAS rows is priced off the rows.
        const real = carryingWounds(npc, [wound], 400);
        expect(woundsCarriedBy(real)).toHaveLength(1);
        expect(woundsCarriedBy(real)[0].woundType).toBe('cracked-core');
    });

    it('heals a world still carrying a retired wound key', () => {
        // 'ruined-dantian' shipped in b3498c3 and worlds were written with it,
        // so retiring the key in the catalog does not retire the rows. The key
        // is copied out of the row into `HistoricalFact.data` and into
        // narration, so translating it only at the point of reading would leave
        // those copies carrying the old word forever. Idempotent, and it runs at
        // the top of the yearly pass so a world in flight heals on its own.
        const npc = createNpc('wounds', { id: 'n3', bornOnDay: 0, onDay: 0 });
        const old = { ...wound, woundType: 'ruined-dantian' };
        const state = {
            npcs: [carryingWounds(npc, [old], 400)]
        } as unknown as WorldState;

        expect(repairRetiredWoundKeys(state)).toBe(1);
        expect(state.npcs[0].cultivation.injuries[0].woundType).toBe('incomplete-cultivation');
        // Nothing else about the row moved - a rename, never a downgrade.
        expect(state.npcs[0].cultivation.injuries[0].severity).toBe('crippling');
        expect(state.npcs[0].cultivation.untreatedInjuries).toBe(1);
        // And a second pass has nothing left to do.
        expect(repairRetiredWoundKeys(state)).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TWO CLOCKS
// ─────────────────────────────────────────────────────────────────────────

describe('a rung has two clocks and a failure only moves one', () => {
    const conditions = {
        ambient: 'dense' as const,
        rateMultiplier: 1,
        guideOrdinal: null,
        manualCeiling: 44
    };

    function standing(ordinal: number, yearsHere: number) {
        const npc = createNpc('clocks', {
            id: 'c1',
            bornOnDay: -400 * YEAR,
            onDay: 0,
            cultivation: { realmOrdinal: ordinal }
        });
        return {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                realmOrdinal: ordinal,
                lastAdvancedOnDay: -yearsHere * YEAR,
                accumulatingSinceDay: -yearsHere * YEAR
            }
        };
    }

    it('will not strike before the requirement has been accumulated', () => {
        const fresh = readyToStrike(standing(16, 0), 0, conditions);
        expect(fresh.ready).toBe(false);
        expect(fresh.yearsNeeded).toBeGreaterThan(0);
        expect(Number.isFinite(fresh.yearsNeeded)).toBe(true);
    });

    it('settles somebody who has stood past the realm allowance', () => {
        // `stagnationYearsForOrdinal(16)` is 50. Two centuries at that rung is
        // a plateau the realm does not permit, and settling is permanent.
        const stuck = readyToStrike(standing(16, 200), 0, conditions);
        expect(stuck.settled).toBe(true);
        expect(stuck.ready).toBe(false);
    });

    it('leaves the last crossing to the pass that owns it', () => {
        // `applyLastCrossing` runs it on the clock the crossing actually takes -
        // twenty to fifty thousand years for one attempt. Unguarded, this pass
        // struck at it every eight hundred years and emptied the apex: measured
        // over 5,000 years without the guard, both seeded Tribulation
        // Transcendence figures were gone and the world's ceiling stood at 38.
        const atTheLid = standing(LAST_CROSSING_ORDINAL, 40_000);
        expect(readyToStrike(atTheLid, 0, conditions).ready).toBe(false);
        expect(
            strikeAtTheWall(
                atTheLid, 0,
                { yearsNeeded: 1, yearsAccumulated: 1, yearsStood: 1, ready: true, settled: false },
                forStream('clocks', 'strike'),
                'dense'
            )
        ).toBeNull();
    });

    it('costs a failure real time and leaves the settling clock alone', () => {
        const before = standing(16, 40);
        const readiness = readyToStrike(before, 0, conditions);
        // Walk streams until one lands a failure, so this measures the failure
        // path rather than whichever way the first roll happened to go.
        let failed = null;
        for (let i = 0; i < 200 && failed === null; i++) {
            const out = strikeAtTheWall(
                before, 0,
                { ...readiness, ready: true, settled: false },
                forStream('clocks', 'attempt', i),
                'dense'
            );
            if (out && !out.died && out.result.outcome !== 'success') failed = out;
        }
        expect(failed, 'no failure in two hundred attempts at ordinal 16').not.toBeNull();
        expect(failed!.npc.cultivation.lastAdvancedOnDay)
            .toBe(before.cultivation.lastAdvancedOnDay);
        expect(failed!.npc.cultivation.accumulatingSinceDay)
            .toBeGreaterThan(before.cultivation.accumulatingSinceDay);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A MASTER WRITES IT OUT
// ─────────────────────────────────────────────────────────────────────────

describe('a master writes their road out for the people behind them', () => {
    it('puts an art the house did not hold onto the house shelf', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'copying', catalog });

        const before = new Set(
            state.objects.map(manualIdOf).filter((id): id is string => id !== null)
        );
        let written = 0;
        for (let year = 1; year <= 400; year++) {
            written += applyManualCopying(state, year, year * YEAR).length;
        }
        expect(written, 'nobody wrote out a single copy in four centuries')
            .toBeGreaterThan(0);

        const after = state.objects.filter(o => o.tags.includes('written-out'));
        expect(after.length).toBeGreaterThan(0);
        // Every one of them is a possession of a house, sitting at its seat, in
        // the ordinary object table - not a second catalog.
        for (const row of after) {
            expect(row.kind).toBe('manual');
            expect(row.possessorId).not.toBeNull();
            expect(copyCount(row)).toBeGreaterThan(0);
        }
        // And at least one road entered circulation that nothing held before.
        const now = new Set(
            state.objects.map(manualIdOf).filter((id): id is string => id !== null)
        );
        expect([...now].some(id => !before.has(id))).toBe(true);
    }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE WORLD, RUN - MOVED
// ─────────────────────────────────────────────────────────────────────────
//
// `the upper ladder is arrived at rather than inherited` now lives in
// `scripts/the-upper-ladder-is-arrived-at.probe.ts`. It soaks THREE worlds for
// 3,000 years each and holds them all at once, and measured on the night it
// moved it was the last file still running in a 53-minute run of this
// directory - alone for the final fifteen minutes, at 1.9 GB and climbing,
// while the other 206 files had finished. An instrument somebody runs
// deliberately does not belong in a suite somebody runs to check a change.
//
// The assertions above are the other half of the pair the header describes:
// the soak is what tells you the world is wrong, and these are what tell you
// which piece. They stay here because they cost milliseconds.

// ─────────────────────────────────────────────────────────────────────────
// TRANSMISSION
// ─────────────────────────────────────────────────────────────────────────

describe('who is teaching you is read off the world, not invented', () => {
    // Guidance is attention, not presence and not a tie. This read was "the
    // highest living master tie, wherever they are": a master posted three
    // provinces away still paid the whole guidance term, and it cost the
    // master nothing. It now reads somebody at the student's own location whose
    // activity is `teaching` with the student in the set.
    const master = createNpc('guide', {
        id: 'm', bornOnDay: 0, onDay: 0, locationId: 'hall', cultivation: { realmOrdinal: 25 }
    });
    const student = {
        ...createNpc('guide', { id: 's', bornOnDay: 0, onDay: 0, locationId: 'hall' }),
        relationships: [{
            targetId: 'm', targetName: master.name, kind: 'master' as const,
            standing: 0.6, note: '', sinceDay: 0, lastChangedDay: 0,
            factIds: [], inheritedFromId: null
        }]
    };
    const teaching = (withIds: string[], untilDay: number | null = null) => ({
        ...master,
        activity: { kind: 'teaching' as const, note: '', withIds, sinceDay: 0, untilDay }
    });

    it('pays nothing for a tie whose master is not giving the attention', () => {
        expect(guideOrdinalFor(student, new Map([[master.id, master]]))).toBeNull();
    });

    it('pays the teacher who is teaching them, where they stand', () => {
        const byId = new Map([[master.id, teaching(['s'])]]);
        expect(guideOrdinalFor(student, byId)).toBe(25);

        const elsewhere = new Map([[master.id, { ...teaching(['s']), locationId: 'a-town' }]]);
        expect(guideOrdinalFor(student, elsewhere), 'a master in another place').toBeNull();

        const dead = new Map([[master.id, { ...teaching(['s']), status: 'physically_dead' as const }]]);
        expect(guideOrdinalFor(student, dead), 'a master who has died').toBeNull();

        const over = new Map([[master.id, teaching(['s'], 100)]]);
        expect(guideOrdinalFor(student, over, 200), 'attention whose term has run').toBeNull();
    });

    it('thins with the set, and costs the teacher the same whatever its size', () => {
        const one = new Map([[master.id, teaching(['s'])]]);
        const hall = new Map([[master.id, teaching(['s', 'a', 'b', 'c'])]]);
        expect(guidanceFor(student, one)?.listeners).toBe(1);
        expect(guidanceFor(student, hall)?.listeners).toBe(4);

        const listeners = new Map([[student.id, student]]);
        const cost = 1 - TEACHING_TAKES_THIS_MUCH_OF_A_TEACHERS_YEAR;
        expect(whatTeachingLeavesOfAMastersRate(teaching(['s']), listeners)).toBe(cost);
        expect(whatTeachingLeavesOfAMastersRate(teaching(['s', 'a', 'b', 'c']), listeners)).toBe(cost);
        expect(whatTeachingLeavesOfAMastersRate(master, listeners), 'not teaching').toBe(1);
    });

    it('makes the rung reachable that was not reachable alone', () => {
        // `guidanceMultiplier` is worth up to half again on the rate, and the
        // rate is what decides whether a rung fits inside the realm's settling
        // allowance. That is why a master decides outcomes here rather than
        // merely speeding things up.
        const npc = createNpc('carried', {
            id: 'x', bornOnDay: -3000 * YEAR, onDay: 0,
            cultivation: { realmOrdinal: 32 }
        });
        const at = {
            ...npc,
            cultivation: {
                ...npc.cultivation, realmOrdinal: 32,
                lastAdvancedOnDay: 0, accumulatingSinceDay: 0
            }
        };
        const alone = readyToStrike(at, 0, {
            ambient: 'normal', rateMultiplier: 1, guideOrdinal: null, manualCeiling: 44
        });
        const carried = readyToStrike(at, 0, {
            ambient: 'normal', rateMultiplier: 1, guideOrdinal: 40, manualCeiling: 44
        });
        expect(carried.yearsNeeded).toBeLessThan(alone.yearsNeeded);
    });
});
