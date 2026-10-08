import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
/**
 * Spirit boats must cross actual open water with the same precise body clock.
 * A companion pilot is an ordinary independently timed actor. Their real death
 * interrupts the passenger at its actual boundary; the owned craft stays on
 * water, with its title intact. SQL passenger death likewise grounds a held
 * craft or leaves a capable surviving pilot holding it, never back at the quay.
 * These controls use a real existing sea route and the canonical fuel quote.
 * The flying craft spends its actual land approach before the ocean reply;
 * region water is recognised through the existing canonical reader, not a tag.
 * SCRATCH review controls, unrun; no miniature invented crossing or new fuel rate.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { publicShipLinesFrom } from '../../src/engine/world/public-shipping.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { aVehicleOf, takeItAlong, whoItIsWith } from '../../src/engine/world/a-vehicle.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { walkingRouteFrom, walkingDaysFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { acceptOwnedPassage, ownedPassageClaim, ownedCarrierAt, projectOwnedPassenger } from '../../src/web/an-owned-passage.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { isWater } from '../../src/engine/world/places-on-the-way.js';
import { passHours } from '../../src/web/routine-invitations.js';

function observeOwned(game: ReturnType<typeof makeGame>['game'], label: string, result: unknown) {
    const now = game.currentRun(), world = game.atHand!, claim = ownedPassageClaim(game.db, now.cultivator.id);
    const receipt = claim && world.history.facts.find(fact => fact.id === claim.receiptId);
    const file = process.env.TRANSPORT_REVIEW_LOG ?? resolve('.claude/transport-revision05-observations.jsonl');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify({ label, result, body: now.cultivator, elapsedDays: now.run.elapsedDays,
        actualMoment: routineTime(world), claim, receipt, source: claim && ownedCarrierAt(world, claim.receiptId,
            now.cultivator, routineTime(world)), craft: world.objects.find(row => row.id === receipt?.data.vesselId),
        pilot: world.npcs.find(row => row.id === receipt?.data.pilotId) }) + '\n');
}

async function departing(companionPilot = false) {
    const { game, db } = makeGame({ seed: 'precise-owned-ocean', worldEnabled: true });
    await createWorld({ seed: 'precise-owned-ocean-world', presentYear: 0 });
    await game.newRun('Ocean pilot');
    let now = game.currentRun();
    game.repos.cultivators.update(now.cultivator.id, { location: 'Emerald Water City',
        realmOrdinal: 29, spiritStones: 5000, hp: 1000, maxHp: 1000 });
    now = game.currentRun();
    game.atHand = await prepareWorldClockForPreciseSpan(now.run, now.cultivator);
    const world = game.atHand, day = routineTime(world);
    const from = worldLocationFor(world, now.cultivator.location)!;
    const line = publicShipLinesFrom(world, from.name, day).find(one => one.runsFromDay === null)!;
    const to = worldLocationFor(world, line.to)!;
    const boat = aVehicleOf({ id: 'precise-owned-hull', conveyanceId: 'conv-spirit-boat',
        ownerId: now.cultivator.id, ownerName: now.cultivator.name, at: from.id });
    world.objects.push(boat); takeItAlong(world.objects, boat, now.cultivator.id);
    let pilot = companionPilot ? setRealm(createNpc(world.seed, { id: 'actual-ocean-companion',
        name: 'Ocean companion', onDay: day, bornOnDay: day - 40 * 365, locationId: from.id }), 29, day) : null;
    if (pilot) world.npcs.push(pilot);
    const walkingDays = walkingDaysFrom(world.locations, from.id).get(to.id)!;
    const quote = priceJourney({ walkingDays, conveyance: requireConveyance('conv-spirit-boat'),
        power: boat.power, heads: pilot ? 2 : 1 });
    expect(quote.trips).toBe(1);
    expect(quote.daysOneWay).toBeGreaterThan(.125);
    const receiptId = acceptOwnedPassage(game, now.run, now.cultivator, { vesselId: boat.id,
        pilotId: pilot?.id ?? now.cultivator.id, fromId: from.id, toId: to.id,
        walkingDays, days: quote.daysOneWay, conveyanceId: 'conv-spirit-boat', power: boat.power,
        companions: pilot ? [pilot.id] : [] });
    expect(ownedCarrierAt(world, receiptId, now.cultivator, day)?.locationId).toBe(from.id);
    expect(ownedCarrierAt(world, receiptId, now.cultivator, day + quote.daysOneWay)?.locationId).toBe(to.id);
    pilot = pilot && world.npcs.find(one => one.id === pilot!.id)!;
    // A flying craft may first cross a land parent. Spend that real approach;
    // choose a point strictly inside the actual route's water edge, not a quay teleport.
    const route = walkingRouteFrom(world.locations, from.id, to.id)!;
    const waterIndex = route.findIndex((stop, i) => i > 0
        && isWater(world.locations.find(place => place.id === stop.locationId)!));
    expect(waterIndex).toBeGreaterThan(0);
    const edgeStart = route[waterIndex - 1]!.days / walkingDays * quote.daysOneWay;
    const edgeEnd = route[waterIndex]!.days / walkingDays * quote.daysOneWay;
    expect(edgeEnd - edgeStart).toBeGreaterThan(.125);
    const reachedWaterAfter = (edgeStart + edgeEnd - .125) / 2;
    const approach = await passHours(game, game.currentRun().run, game.currentRun().cultivator,
        reachedWaterAfter * 24);
    observeOwned(game, 'owned actual approach to water', approach);
    expect(approach.finished).toBe(true);
    expect(isWater(worldLocationFor(world, game.currentRun().cultivator.location)!)).toBe(true);
    return { game, db, world, day: routineTime(world), departureDay: day, from, to,
        boat, pilot: pilot && world.npcs.find(one => one.id === pilot!.id)!, quote, playerId: now.cultivator.id };
}

it('carries a precise reply over actual water and burns only canonical fuel', async () => {
    const { game, db, world, day, departureDay, from, to, boat, playerId, quote } = await departing();
    try {
        const before = game.currentRun();
        const reply = await passHours(game, before.run, before.cultivator, 3);
        observeOwned(game, 'owned water reply', reply);
        expect(reply.finished).toBe(true);
        expect(routineTime(game.atHand!)).toBeCloseTo(day + .125, 12);
        expect(game.currentRun().run.elapsedDays - before.run.elapsedDays).toBe(.125);
        const ground = worldLocationFor(world, game.currentRun().cultivator.location)!;
        expect(isWater(ground)).toBe(true);
        expect(ground.id).not.toBe(from.id); expect(ground.id).not.toBe(to.id);
        expect(whoItIsWith(world.objects.find(one => one.id === boat.id)!)).toBe(playerId);
        const fuelThrough = (onDay: number) => priceJourney({ walkingDays:
            walkingDaysFrom(world.locations, from.id).get(to.id)!
                * (onDay - departureDay) / quote.daysOneWay,
            conveyance: requireConveyance('conv-spirit-boat'), power: boat.power, heads: 1 }).stonesBurned;
        expect(before.cultivator.spiritStones - game.currentRun().cultivator.spiritStones)
            .toBe(fuelThrough(day + .125) - fuelThrough(day));
        expect(ownedPassageClaim(db, playerId)).not.toBeNull();
    } finally { db.close(); resetCultivationWorlds(); }
});

it('stops the body clock when the actual companion pilot expires on open water', async () => {
    const { game, db, world, day, pilot, to, boat } = await departing(true);
    try {
        pilot!.cultivation.lifespanEndsOnDay = day + .0625;
        const before = game.currentRun();
        const reply = await passHours(game, before.run, before.cultivator, 3);
        observeOwned(game, 'owned pilot expiry on water', reply);
        expect(reply.finished).toBe(false);
        expect(routineTime(game.atHand!)).toBeCloseTo(day + .0625, 12);
        expect(game.currentRun().run.elapsedDays - before.run.elapsedDays).toBe(.0625);
        expect(game.currentRun().cultivator.location).not.toBe(to.name);
        expect(isWater(worldLocationFor(world, game.currentRun().cultivator.location)!)).toBe(true);
        expect(world.objects.find(one => one.id === boat.id)?.ownerId).toBe(before.cultivator.id);
    } finally { db.close(); resetCultivationWorlds(); }
});

for (const companion of [false, true]) it('preserves real craft custody after SQL passenger death, companion=' + companion, async () => {
    const { game, db, world, pilot, boat, playerId } = await departing(companion);
    try {
        const before = game.currentRun();
        await passHours(game, before.run, before.cultivator, 3);
        const ground = worldLocationFor(world, game.currentRun().cultivator.location)!;
        expect(isWater(ground)).toBe(true);
        game.repos.cultivators.markDead(playerId, 'combat_defeat', game.currentRun().run.turn, 'Died on the actual craft.');
        projectOwnedPassenger(db, world, playerId, routineTime(world));
        const actual = world.objects.find(one => one.id === boat.id)!;
        expect(actual.ownerId).toBe(playerId);
        expect(ownedPassageClaim(db, playerId)).toBeNull();
        if (companion) expect(whoItIsWith(actual)).toBe(pilot!.id);
        else { expect(whoItIsWith(actual)).toBeNull(); expect(actual.locationId).toBe(ground.id); }
    } finally { db.close(); resetCultivationWorlds(); }
});

/** Preparatory native time defers completion; the following real wait owns it once.
 * Oct6 native31 run stopped at a branch-specific world.waitForHour label.
 * Accepted carriers may use another wait front door; native result receipt,
 * actual elapsed body/world time, one completion and original claim are the rule. */
it('keeps one completion across a deferred preparatory span and an actual wait', async () => {
    const { game, db } = await departing();
    try {
        const before = game.currentRun(), start = routineTime(game.atHand!);
        const claim = ownedPassageClaim(db, before.cultivator.id);
        expect(claim).not.toBeNull();
        const prepared = await passHours(game, before.run, before.cultivator, 3, before.run.turn + 1, false);
        expect(prepared.finished).toBe(true);
        expect(prepared.spent?.timeSkip?.simulatedDays).toBe(.125);
        expect(game.currentRun().run.turn).toBe(before.run.turn);
        const waited = await game.act('I wait for 3 hours');
        const after = game.currentRun();
        expect(waited.toolCalls.some(call => !call.name.startsWith('narrator.') && call.ok),
            JSON.stringify(waited.toolCalls)).toBe(true);
        expect(waited.toolCalls.filter(call => !call.name.startsWith('narrator.') && !call.ok),
            JSON.stringify(waited.toolCalls)).toEqual([]);
        expect(after.cultivator.alive).toBe(true);
        expect(after.cultivator.age).toBeGreaterThan(before.cultivator.age);
        expect(after.run.turn).toBe(before.run.turn + 1);
        expect(journeyTimeHasReached(after.run.elapsedDays, before.run.elapsedDays + .25)).toBe(true);
        expect(journeyTimeHasReached(before.run.elapsedDays + .25, after.run.elapsedDays)).toBe(true);
        expect(journeyTimeHasReached(routineTime(game.atHand!), start + .25)).toBe(true);
        expect(journeyTimeHasReached(start + .25, routineTime(game.atHand!))).toBe(true);
        expect(ownedPassageClaim(db, after.cultivator.id)?.receiptId).toBe(claim!.receiptId);
    } finally { db.close(); resetCultivationWorlds(); }
});
