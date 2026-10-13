/**
 * Plague previously named only an encounter and a population change. These
 * played controls require the actual SQL body, rather than its world mirror,
 * to weaken, use a real dose and stop a held span at its dated death. Immunity
 * and a failed transformation use the existing hunger reader without a second
 * realm boundary. Both run and opening world are pinned.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { beginPlagueOutbreak } from '../../src/engine/world/plague-in-a-place.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { createInjury } from '../../src/engine/cultivation/injuries.js';
import { plagueSusceptibility } from '../../src/engine/cultivation/plague.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { addToPouch, pouchQuantity } from '../../src/storage/cultivator-pouch.js';
import { spendAnOrdinarySpanAtTheActualClock } from '../../src/web/spending-an-ordinary-span-at-the-actual-clock.js';
import { atAWorkingPhysician } from './at-a-working-physician.js';
import { carePricesHere } from '../../src/web/what-care-costs-where-you-are.js';
import { recordEncounters } from '../../src/web/encounters.js';
import { resolveOccurrence } from '../../src/engine/encounters/resolve.js';
import { getEncounter } from '../../src/data/cultivation/encounters.js';
import { handleCultivate } from '../../src/server/consolidated/cultivation-manage.js';
import { describeCultivator } from '../../src/server/consolidated/cultivation-support.js';
import * as encounterWindow from '../../src/engine/encounters/window.js';
import type { EncounterRoll, EncounterRollInput } from '../../src/engine/encounters/types.js';
import type { EncounterCheckPhase } from '../../src/engine/encounters/window.js';

async function scene() {
    const h = await makeGameInWorld({ seed: 'plague-player', worldSeed: 'plague-player-world' });
    await h.game.newRun('The exposed traveller');
    const life = h.game.currentRun();
    h.game.atHand = await prepareWorldClockForPreciseSpan(life.run, life.cultivator);
    const world = h.game.atHand!, now = routineTime(world);
    const place = makeLocation({ id: 'plague-player-ground', name: 'The exposed ground', kind: 'wilds' });
    world.locations.push(place);
    h.repos.cultivators.update(life.cultivator.id, { location: place.name, standingIn: null,
        realmOrdinal: 0, hp: 100, maxHp: 100, spiritStones: 100 });
    const outbreak = beginPlagueOutbreak(world, place.id, now)!;
    // Choose an exposure, not an asserted result; the real writer draws it.
    for (let sample = 0; sample < 200; sample++) {
        world.seed = `actual-plague-exposure-${sample}`;
        if (forStream(world.seed, 'plague-exposure', outbreak.id, life.cultivator.id, 0).chance(0.4)) break;
    }
    return { ...h, world, now, outbreak, bodyId: life.cultivator.id };
}

it('contact weakens the actual body once and never substitutes a world mirror', async () => {
    const h = await scene();
    try {
        const answer = await h.game.act('I look around');
        const body = h.repos.cultivators.getById(h.bodyId)!;
        expect(answer.narration).toContain('Plague');
        expect(body.plague?.outbreakId).toBe(h.outbreak.id);
        expect(body.hp).toBe(65);
        const reported = describeCultivator(h.repos, body, h.game.currentRun().run).plague;
        expect(reported).toEqual({ contractedOnWorldDay: body.plague!.contractedOnDay, treatedOnWorldDay: null });
        expect(reported).not.toHaveProperty('fatalOnDay');
        const course = body.plague;
        h.game.settlePlagueAtTheBodyBoundary();
        expect(h.repos.cultivators.getById(h.bodyId)!.plague).toEqual(course);
        expect(h.world.npcs.find(person => person.id === h.bodyId)?.cultivation.plague).toBeUndefined();
    } finally { h.db.close(); }
});

it('the body that no longer eats is immune until its actual transformation wound restores hunger', async () => {
    const h = await scene();
    try {
        const deity = REALM_TIERS.find(realm => realm.key === 'deity_transformation')!.ordinalStart;
        h.repos.cultivators.update(h.bodyId, { realmOrdinal: deity });
        expect(h.game.settlePlagueAtTheBodyBoundary()).toEqual([]);
        expect(h.repos.cultivators.getById(h.bodyId)!.plague).toBeFalsy();
        const injury = createInjury({ severity: 'serious', source: 'failed_breakthrough', turn: 0,
            woundType: 'failed-transformation', description: 'A transformation wound restores hunger.' }, forStream('plague-player', 'wound'));
        h.repos.cultivators.addInjury(h.bodyId, { ...injury, sustainedOnTurn: 0 });
        const susceptible = h.repos.cultivators.getById(h.bodyId)!;
        for (let sample = 0; sample < 100_000; sample++) {
            h.world.seed = `wounded-plague-exposure-${sample}`;
            if (forStream(h.world.seed, 'plague-exposure', h.outbreak.id, h.bodyId, 0)
                .chance(0.4 * plagueSusceptibility(susceptible))) break;
        }
        expect(h.game.settlePlagueAtTheBodyBoundary().join(' ')).toContain('Plague');
        expect(h.repos.cultivators.getById(h.bodyId)!.plague).toBeTruthy();
    } finally { h.db.close(); }
});

it('swallowing actual wound medicine treats plague before its danger date and spends one real dose', async () => {
    const h = await scene();
    try {
        h.repos.cultivators.update(h.bodyId, { plague: { outbreakId: h.outbreak.id,
            contractedOnDay: h.now, endsOnDay: h.now + 30, fatalOnDay: h.now + 15, treatedOnDay: null } });
        const pill = PILLS.find(pill => pill.effect === 'treat_injury' && pill.grade === 'mortal')!;
        addToPouch(h.db, h.bodyId, pill.id, 'pill', 2);
        const answer = await h.game.act(`I swallow the ${pill.name}`);
        const body = h.repos.cultivators.getById(h.bodyId)!;
        expect(answer.narration).toContain('Plague treated');
        expect(body.plague?.treatedOnDay).not.toBeNull();
        expect(body.plague?.fatalOnDay).toBeNull();
        expect(pouchQuantity(h.db, h.bodyId, pill.id)).toBe(1);
        h.game.settlePlagueAtTheBodyBoundary();
        expect(h.repos.cultivators.getById(h.bodyId)!.plague?.treatedOnDay).not.toBeNull();
    } finally { h.db.close(); }
});

it('an ordinary real-body span stops at the absolute plague death date', async () => {
    const h = await scene();
    try {
        h.repos.cultivators.update(h.bodyId, { plague: { outbreakId: h.outbreak.id,
            contractedOnDay: h.now, endsOnDay: h.now + 30, fatalOnDay: h.now + 15, treatedOnDay: null } });
        const { run, cultivator } = h.game.currentRun();
        const spent = await spendAnOrdinarySpanAtTheActualClock(h.game, run, cultivator, 20,
            { seed: run.seed, locationId: cultivator.location!, startDay: run.elapsedDays,
                randomEvents: false, autoBreakthrough: false, grainAbstinence: true, options: { focusMultiplier: 0 } }, 'pack');
        expect(spent.skip.simulatedDays).toBeCloseTo(15);
        expect(spent.applied.cultivator.alive).toBe(false);
        expect(spent.applied.cultivator.deathCause).toBe('plague');
        expect(spent.applied.run.elapsedDays - run.elapsedDays).toBeCloseTo(15);
    } finally { h.db.close(); }
});

it('the real working physician administers reachable paid medicine before the fatal date, with the existing fee and stay', async () => {
    const h = await atAWorkingPhysician('plague-physician');
    try {
        const life = h.game.currentRun();
        h.game.atHand = await prepareWorldClockForPreciseSpan(life.run, life.cultivator);
        const now = routineTime(h.game.atHand!);
        h.repos.cultivators.update(h.cultivator.id, { realmOrdinal: 0, spiritStones: 500,
            plague: { outbreakId: 'explicit-paid-care-course', contractedOnDay: now, endsOnDay: now + 30,
                fatalOnDay: now + 15, treatedOnDay: null } });
        const before = h.game.atHand!.npcs.find(person => person.id === h.physician.id)!.spiritStones;
        const price = carePricesHere(h.game, h.game.currentRun().cultivator).perWound;
        const answer = await h.game.act('I get my injuries treated');
        expect(answer.narration).toContain('medicine was administered for your plague');
        expect(h.repos.cultivators.getById(h.cultivator.id)!.alive).toBe(true);
        expect(h.game.atHand!.npcs.find(person => person.id === h.physician.id)!.spiritStones - before).toBe(price);
        expect(h.game.currentRun().run.elapsedDays - life.run.elapsedDays).toBeGreaterThanOrEqual(30);
    } finally { h.db.close(); }
}, 120_000);

it('a new infection at an actual boundary interrupts the remaining ordinary span', async () => {
    const h = await scene();
    try {
        h.outbreak.liftedOnDay = h.now;
        h.outbreak.reviewOnDay = h.now;
        const due = h.now + 0.125;
        const { run, cultivator } = h.game.currentRun();
        vi.spyOn(h.game, 'advanceWorld').mockImplementation(async (days) => {
            const day = routineTime(h.world) + days;
            h.world.currentDay = Math.floor(day); h.world.currentHour = (day % 1) * 24;
            const outbreak = beginPlagueOutbreak(h.world, 'plague-player-ground', day)!;
            for (let sample = 0; sample < 200; sample++) {
                h.world.seed = `boundary-plague-${sample}`;
                if (forStream(h.world.seed, 'plague-exposure', outbreak.id, h.bodyId, 0).chance(0.4)) break;
            }
            return { lines: [], structure: [] };
        });
        const spent = await spendAnOrdinarySpanAtTheActualClock(h.game, run, cultivator, 1,
            { seed: run.seed, locationId: cultivator.location!, startDay: h.now, randomEvents: false,
                autoBreakthrough: false, grainAbstinence: true, options: { focusMultiplier: 0 } }, 'pack',
            undefined, undefined, undefined, { dates: [due], afterBoundary() {}, stop: () => null });
        expect(spent.skip.simulatedDays).toBeCloseTo(0.125);
        expect(spent.skip.interrupted).toBe(true);
        expect(spent.skip.interruptReason).toContain('Plague');
        expect(spent.applied.cultivator.plague?.contractedOnDay).toBeCloseTo(due);
    } finally { h.db.close(); }
});

it('a tagged plague encounter opens a real outbreak without claiming fictional deaths', async () => {
    const h = await scene();
    try {
        h.world.statuses = h.world.statuses.filter(status => status.id !== h.outbreak.id);
        const body = h.game.currentRun().cultivator;
        const entry = getEncounter('enc-plague-village')!;
        const occurrence = resolveOccurrence({ entry, activity: 'abroad', ordinal: body.realmOrdinal,
            hp: body.hp, maxHp: body.maxHp, spiritStones: body.spiritStones, absoluteDay: h.now,
            dayOffset: 0, values: { place: body.location! }, grants: [], castIds: [], cast: [], outcome: 'landed' });
        const recorded = recordEncounters(h.game.knowledge, body, h.game.currentRun().run.elapsedDays,
            { occurrences: [occurrence], firstInterruptDay: h.now, checks: 1, poolSize: 1 }, h.repos,
            undefined, () => h.game.plagueEncounterAtTheBody());
        expect(h.world.statuses.some(status => status.kind === 'plague' && status.areaId === 'plague-player-ground')).toBe(true);
        expect(h.repos.cultivators.getById(h.bodyId)!.plague).toBeTruthy();
        expect(recorded.lines.join(' ')).not.toContain('dead so far');
        expect(h.world.history.facts.filter(fact => fact.data.plagueDeath).length).toBe(0);
    } finally { h.db.close(); }
});

it('a stricken actual traveller carries plague to new ground while its previous outbreak remains distinct', async () => {
    const h = await scene();
    try {
        h.game.settlePlagueAtTheBodyBoundary();
        const destination = makeLocation({ id: 'plague-second-ground', name: 'The next reached ground', kind: 'wilds' });
        h.world.locations.push(destination);
        h.repos.cultivators.update(h.bodyId, { location: destination.name });
        h.repos.cultivators.standIn(h.bodyId, null);
        await h.game.act('I look around');
        const carried = h.world.statuses.find(status => status.kind === 'plague' && status.areaId === destination.id)!;
        expect(carried).toBeDefined();
        expect(carried.id).not.toBe(h.outbreak.id);
        expect(h.repos.cultivators.getById(h.bodyId)!.plague?.outbreakId).toBe(h.outbreak.id);
    } finally { h.db.close(); }
});

it('a whole-day direct MCP span uses the same absolute bodily course and stops at its death date', async () => {
    const h = await scene();
    try {
        h.repos.cultivators.update(h.bodyId, { plague: { outbreakId: h.outbreak.id,
            contractedOnDay: h.now, endsOnDay: h.now + 30, fatalOnDay: h.now + 15, treatedOnDay: null } });
        h.game.theWorldMoved();
        const before = h.game.currentRun().run.elapsedDays;
        const answer = await handleCultivate({ action: 'cultivate', cultivatorId: h.bodyId,
            days: 20, focus: 'idle', autoBreakthrough: false, randomEvents: false, rations: 0, carriedRations: 0 });
        expect(answer).not.toHaveProperty('error');
        expect(h.repos.cultivators.getById(h.bodyId)!.alive).toBe(false);
        expect(h.repos.cultivators.getById(h.bodyId)!.deathCause).toBe('plague');
        expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(15);
    } finally { h.db.close(); }
});

it('a death already due on the actual clock is settled before the next attempted medicine dose', async () => {
    const h = await scene();
    try {
        h.repos.cultivators.update(h.bodyId, { plague: { outbreakId: h.outbreak.id,
            contractedOnDay: h.now - 16, endsOnDay: h.now + 14, fatalOnDay: h.now - 1, treatedOnDay: null } });
        const pill = PILLS.find(pill => pill.effect === 'treat_injury' && pill.grade === 'mortal')!;
        addToPouch(h.db, h.bodyId, pill.id, 'pill', 1);
        const before = h.game.currentRun().run.elapsedDays;
        const answer = await h.game.act(`I swallow the ${pill.name}`);
        expect(answer.narration).toContain('died of plague');
        expect(h.repos.cultivators.getById(h.bodyId)!.alive).toBe(false);
        expect(h.game.currentRun().run.elapsedDays).toBe(before);
        expect(answer.toolCalls.some(call => call.name === 'alchemy_manage.consume_pill' && call.ok)).toBe(false);
    } finally { h.db.close(); }
});

it('an immune body still meets a real plague report at its actual native encounter date', async () => {
    const h = await scene();
    let cadence: ReturnType<typeof vi.spyOn> | undefined;
    try {
        h.world.statuses = h.world.statuses.filter(status => status.id !== h.outbreak.id);
        const deity = REALM_TIERS.find(realm => realm.key === 'deity_transformation')!.ordinalStart;
        h.repos.cultivators.update(h.bodyId, { realmOrdinal: deity });
        h.game.theWorldMoved();
        cadence = vi.spyOn(encounterWindow, 'encountersAtChecks').mockImplementation(function* (input):
            Generator<EncounterCheckPhase, EncounterRoll, EncounterRollInput | undefined> {
            const day = input.startDay + 2;
            const actual = (yield { kind: 'check', absoluteDay: day, dayOffset: 2, stage: 'span' }) ?? input;
            const occurrence = resolveOccurrence({ entry: getEncounter('enc-plague-village')!, activity: actual.activity,
                ordinal: actual.cultivator.realmOrdinal, hp: actual.cultivator.hp, maxHp: actual.cultivator.maxHp,
                spiritStones: actual.cultivator.spiritStones, absoluteDay: day, dayOffset: 2,
                values: { place: actual.place.name }, grants: [], castIds: [], cast: [], outcome: 'landed' });
            const roll: EncounterRoll = { occurrences: [occurrence], firstInterruptDay: day, checks: 1, poolSize: 1 };
            yield { kind: 'resolved', occurrences: [occurrence], roll };
            return roll;
        });
        const before = h.game.currentRun().run.elapsedDays;
        await handleCultivate({ action: 'cultivate', cultivatorId: h.bodyId, days: 5, focus: 'idle',
            autoBreakthrough: false, randomEvents: true, rations: 0, carriedRations: 0 });
        expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(2);
        const outbreak = h.world.statuses.find(status => status.kind === 'plague')!;
        expect(outbreak).toBeDefined();
        expect(outbreak.beganOnDay).toBeCloseTo(h.now + 2);
        expect(h.repos.cultivators.getById(h.bodyId)!.plague).toBeFalsy();
        expect(h.repos.cultivators.getById(h.bodyId)!.alive).toBe(true);
    } finally { cadence?.mockRestore(); h.db.close(); }
});
