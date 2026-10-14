/**
 * Owner ruling, 2026-10-12: plague scales exactly as hunger, including the
 * failed-transformation wound. No independent resistance table or realm cutoff
 * is allowed. These controls also require a real health ceiling, treatment
 * before the actual danger date, exact fatal span interruption and durable bodies.
 * The draft uses a 30-day course, halfway danger date, 8% fatal draw and 65%
 * available-health ceiling; these are illness timings/outcomes, not resistance.
 */
import { expect, it } from 'vitest';
import { activePlague, plagueSusceptibility, plagueHealthCeiling, plagueHasBecomeFatal,
    contractPlague, treatPlague } from '../../../src/engine/cultivation/plague.js';
import { satietyBurnMultiplier, stillNeedsToEat } from '../../../src/engine/cultivation/survival.js';
import { REALM_TIERS, MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { createInjury } from '../../../src/engine/cultivation/injuries.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import type { PlagueState } from '../../../src/schema/cultivation.js';
import { makeCultivator } from './fixtures.js';
import { createNpc, maxBodyOf, bodyStandingOn } from '../../../src/engine/world/npc-state.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/storage/migrations.js';
import { CultivatorRepository } from '../../../src/storage/repos/cultivator.repo.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';

const course: PlagueState = { outbreakId: 'outbreak', contractedOnDay: 1000,
    endsOnDay: 1030, fatalOnDay: 1015, treatedOnDay: null };
const wound = createInjury({ severity: 'serious', source: 'failed_breakthrough', turn: 0,
    woundType: 'failed-transformation', description: 'The failed transformation still needs food.' }, forStream('plague-tests', 'wound'));

it('every rung and the failed transformation read the actual hunger functions', () => {
    for (let realmOrdinal = 0; realmOrdinal <= MAX_ORDINAL; realmOrdinal++) for (const injuries of [[], [wound], [{ ...wound, treated: true }]]) {
        const body = { realmOrdinal, injuries };
        expect(plagueSusceptibility(body)).toBe(satietyBurnMultiplier(realmOrdinal, injuries));
        expect(plagueSusceptibility(body) > 0).toBe(stillNeedsToEat(realmOrdinal, injuries));
    }
    const deity = REALM_TIERS.find(realm => realm.key === 'deity_transformation')!.ordinalStart;
    expect(plagueSusceptibility({ realmOrdinal: deity, injuries: [] })).toBe(0);
    expect(plagueSusceptibility({ realmOrdinal: deity, injuries: [wound] })).toBeGreaterThan(0);
});

it('exposure can infect mortals and produces neither plague nor a fatal course on bodies that no longer eat', () => {
    let infected = 0;
    const deity = REALM_TIERS.find(realm => realm.key === 'deity_transformation')!.ordinalStart;
    for (let sample = 0; sample < 100; sample++) {
        if (contractPlague({ realmOrdinal: 0, injuries: [] }, 'outbreak', 1000, 1090,
            forStream('plague-exposure', String(sample)))) infected++;
        expect(contractPlague({ realmOrdinal: deity, injuries: [] }, 'outbreak', 1000, 1090,
            forStream('plague-exposure', String(sample)))).toBeNull();
    }
    expect(infected).toBeGreaterThan(0); expect(infected).toBeLessThan(100);
});

it('active plague weakens an actual body, mending cannot erase it, and treatment prevents its scheduled death', () => {
    const body = { realmOrdinal: 0, injuries: [], plague: course };
    expect(plagueHealthCeiling(100, body, 1014)).toBe(65);
    expect(plagueHasBecomeFatal(body, 1014.99)).toBe(false);
    expect(plagueHasBecomeFatal(body, 1015)).toBe(true);
    const pill = PILLS.find(pill => pill.effect === 'treat_injury' && pill.grade === 'mortal')!;
    const treated = treatPlague(body, pill, 1014)!;
    expect(treated).not.toBeNull();
    expect(activePlague({ ...body, plague: treated }, 1014)).toBeNull();
    expect(plagueHasBecomeFatal({ ...body, plague: treated }, 1015)).toBe(false);
    expect(treatPlague(body, pill, 1016)).toBeNull();
    const npc = createNpc('plague-health', { id: 'patient', onDay: 1000, bornOnDay: 1000 - 20 * 365, cultivation: { realmOrdinal: 0 } });
    npc.cultivation.plague = course;
    expect(bodyStandingOn(npc, 1014)).toBe(Math.floor(maxBodyOf(npc) * 0.65));
});

it('the same immune body becomes susceptible and weak again while the hunger-restoring wound remains untreated', () => {
    const deity = REALM_TIERS.find(realm => realm.key === 'deity_transformation')!.ordinalStart;
    const body = { realmOrdinal: deity, injuries: [wound], plague: course };
    expect(activePlague(body, 1014)).not.toBeNull();
    expect(plagueHealthCeiling(100, body, 1014)).toBe(65);
    expect(plagueHasBecomeFatal(body, 1015)).toBe(true);
    const healed = { ...body, injuries: [{ ...wound, treated: true }] };
    expect(activePlague(healed, 1014)).toBeNull();
    expect(plagueHealthCeiling(100, healed, 1014)).toBe(100);
    expect(plagueHasBecomeFatal(healed, 1015)).toBe(false);
});

it('a real body span stops at the plague danger date on the absolute clock', () => {
    const body = makeCultivator({ realmOrdinal: 0, hp: 100, maxHp: 100, plague: course });
    const result = simulateTimeSkip(body, 20, { seed: 'plague-span', locationId: 'ground', startDay: 1000,
        randomEvents: false, autoBreakthrough: false, grainAbstinence: true, options: { focusMultiplier: 0 } });
    expect(result.simulatedDays).toBe(15);
    expect(result.died).toBe(true); expect(result.deathCause).toBe('plague');
});

it('native and SQL bodily courses survive reopening, while older absent courses remain absent', () => {
    const db = new Database(':memory:');
    try {
        migrate(db);
        const people = new CultivatorRepository(db), body = makeCultivator({ plague: course });
        people.create({ ...body, runId: undefined });
        expect(people.getById(body.id)!.plague).toEqual(course);
        people.update(body.id, { plague: null });
        expect(people.getById(body.id)!.plague).toBeNull();
        const world = createWorld({ seed: 'plague-storage', regionCount: 0, skipPriorAges: true });
        world.npcs.push(createNpc(world.seed, { id: 'patient', onDay: 1000, bornOnDay: 1000 - 30 * 365 }));
        world.npcs[0].cultivation.plague = course;
        const repo = new WorldStateRepository(db);
        repo.saveWorld(world);
        expect(repo.loadWorld(world.id)!.npcs[0].cultivation.plague).toEqual(course);
        delete world.npcs[0].cultivation.plague;
        repo.appendWorld(world);
        expect(repo.loadWorld(world.id)!.npcs[0].cultivation.plague).toBeUndefined();
    } finally { db.close(); }
});
