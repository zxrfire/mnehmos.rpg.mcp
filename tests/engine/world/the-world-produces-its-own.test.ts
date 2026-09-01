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
 *    core, ruined dantian - was unreachable from the world.
 *
 * These are cheap unit assertions on the pieces plus one soak, deliberately in
 * that order: the soak is the thing that would tell you the world is wrong and
 * the units are the things that tell you which piece.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import {
    guideOrdinalFor,
    readyToStrike,
    strikeAtTheWall
} from '../../../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { applyManualCopying, manualIdOf, copyCount } from '../../../src/engine/world/manuals.js';
import { createNpc, carryingWounds, woundsCarriedBy } from '../../../src/engine/world/npc-state.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { LAST_CROSSING_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { BROKEN_STATUSES } from '../../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
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
// AND THE WORLD, RUN
// ─────────────────────────────────────────────────────────────────────────

describe('the upper ladder is arrived at rather than inherited', () => {
    const HORIZON_YEARS = 3_000;

    // One soak, shared by the two assertions below. Three thousand simulated
    // years is the expensive thing in this file and running it twice measures
    // the same world twice.
    let run: Promise<{ state: WorldState; seeded: Set<string> }> | null = null;
    function soaked() {
        run ??= (async () => {
            const catalog = await loadCultivationCatalog();
            const { state } = seedWorld({ seed: 'produces-its-own', catalog });
            const seeded = new Set(state.npcs.map(n => n.id));
            advanceWorldYears(state, HORIZON_YEARS, { stopOnInterrupt: false });
            return { state, seeded };
        })();
        return run;
    }

    it('fills the bands above Deity Transformation with people who climbed', async () => {
        const { state, seeded } = await soaked();
        const alive = state.npcs.filter(n => n.status === 'alive');
        const high = alive.filter(n => n.cultivation.realmOrdinal >= 29);
        const arrived = high.filter(n => !seeded.has(n.id));

        // Before this, five thousand years produced 7 people above Void
        // Refinement of whom 4 had arrived, and the band was routinely empty.
        expect(high.length, 'nobody is standing above Deity Transformation')
            .toBeGreaterThan(0);
        expect(
            arrived.length / Math.max(1, high.length),
            `${arrived.length} of ${high.length} people above Deity Transformation `
            + 'arrived rather than being seeded there'
        ).toBeGreaterThan(0.5);
    }, 600_000);

    it('leaves people standing at a rung they cracked at', async () => {
        // The population the setting most wanted and could not produce. A real
        // wall produces real failures, and the wounds layer is what a failure
        // leaves - so the world getting MORE broken is the feature, not a
        // regression.
        const { state } = await soaked();
        const alive = state.npcs.filter(n => n.status === 'alive');
        const wounded = alive.filter(n => n.cultivation.injuries.length > 0);
        expect(wounded.length, 'nobody in the world is carrying a wound')
            .toBeGreaterThan(0);

        // Every wound is a row with a real shape, and the count agrees with it.
        for (const npc of alive) {
            const untreated = npc.cultivation.injuries.filter(i => !i.treated).length;
            expect(
                npc.cultivation.untreatedInjuries,
                `${npc.name} has ${npc.cultivation.untreatedInjuries} untreated against `
                + `${npc.cultivation.injuries.length} rows`
            ).toBe(untreated);
        }

        // And at least some of them came from a wall rather than from a bout,
        // which is what says the tribulation layer is reachable at all.
        const fromAWall = alive.some(n =>
            n.cultivation.injuries.some(i =>
                i.source === 'failed_breakthrough' || i.source === 'tribulation'
                || (i.woundType !== null && BROKEN_STATUSES.includes(i.woundType))));
        expect(fromAWall, 'no wound in the world came from a realm boundary').toBe(true);
    }, 600_000);

    it('is still deterministic and still decomposable', async () => {
        const catalog = await loadCultivationCatalog();
        const fingerprint = (chunks: number) => {
            const { state } = seedWorld({ seed: 'strike-determinism', catalog });
            for (let i = 0; i < chunks; i++) {
                advanceWorldYears(state, 300 / chunks, { stopOnInterrupt: false });
            }
            return summary(state);
        };
        expect(fingerprint(1)).toBe(fingerprint(1));
        expect(fingerprint(3)).toBe(fingerprint(1));
    }, 600_000);

    function summary(state: WorldState): string {
        const alive = state.npcs.filter(n => n.status === 'alive');
        return [
            alive.length,
            alive.reduce((s, n) => s + n.cultivation.realmOrdinal, 0),
            alive.reduce((s, n) => s + n.cultivation.injuries.length, 0),
            state.objects.length
        ].join('/');
    }
});

// ─────────────────────────────────────────────────────────────────────────
// TRANSMISSION
// ─────────────────────────────────────────────────────────────────────────

describe('who is teaching you is read off the world, not invented', () => {
    it('takes the guide from the master tie the world already wrote', () => {
        const student = createNpc('guide', { id: 's', bornOnDay: 0, onDay: 0 });
        const master = createNpc('guide', {
            id: 'm', bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: 25 }
        });
        const byId = new Map([[master.id, master]]);

        expect(guideOrdinalFor(student, byId), 'a student with no tie has no guide')
            .toBeNull();

        const taught = {
            ...student,
            relationships: [{
                targetId: 'm', targetName: master.name, kind: 'master' as const,
                standing: 0.6, note: '', sinceDay: 0, lastChangedDay: 0,
                factIds: [], inheritedFromId: null
            }]
        };
        expect(guideOrdinalFor(taught, byId)).toBe(25);

        // A master who has died stops teaching. Being abandoned by the person
        // who was carrying you is an outcome, not an oversight.
        const dead = new Map([[master.id, { ...master, status: 'physically_dead' as const }]]);
        expect(guideOrdinalFor(taught, dead)).toBeNull();
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
