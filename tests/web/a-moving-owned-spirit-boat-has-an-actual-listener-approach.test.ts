/**
 * Moving-carrier contact acceptance, 2026-10-03.
 * Oct6 actual09 run: moving the observer to another native area did not
 * separate a matched driver/pilot; native company follows the real passenger.
 * These revised controls cover genuine co-located contact, not an invented
 * cabin crossing. Separate-deck approach remains the public ship control. Approach04's existing controls
 * covered deferred carrier time, but did not actually reach a named listener
 * from another area. These copy the corresponding already-existing native
 * accepted-passage fixture, then choose an existing public area with the native
 * placement/access reader. Area/name arrangement is explicit operator setup;
 * there are no invented bookings, people, cabins or projected positions.
 * Scripted phase-1 routing plus empty narration exercises engine authority,
 * not live-model prose. Actual hull identity, elapsed body/world time, completion
 * and fresh native contact reads are the evidence. Real arrival/death/ruin
 * refuses the requested conversation rather than finishing an old scene.
 * Oct6 review adds the actual named engine answer receipt: approachTime alone
 * could also precede a handler refusal. Both listener and observer areas now
 * require the actual native substrate rather than a street/table fallback.
 */
import { expect, it } from 'vitest';
import { makeGame, ScriptedProvider } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';
import { listenerInTheActualCarrierScene, askThatActualListener, actualListenerAnswered } from './fixtures/a-listener-on-an-actual-carrier.js';
import { publicShipLinesFrom } from '../../src/engine/world/public-shipping.js';
import { aVehicleOf, takeItAlong, whoItIsWith } from '../../src/engine/world/a-vehicle.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { walkingRouteFrom, walkingDaysFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { acceptOwnedPassage, ownedPassageClaim, ownedCarrierAt } from '../../src/web/an-owned-passage.js';
import { isWater } from '../../src/engine/world/places-on-the-way.js';
import { ruin, isRuined } from '../../src/engine/world/possessions.js';
async function departing(companionPilot = false) {
    const plans: string[] = [];
    const { game, db } = makeGame({ provider: new ScriptedProvider({ plans, narrations: [] }), seed: 'precise-owned-ocean', worldEnabled: true });
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
    expect(edgeEnd - edgeStart).toBeGreaterThan(LESSER_ACTION_DAYS.move + LESSER_ACTION_DAYS.interact);
    const reachedWaterAfter = (edgeStart + edgeEnd - LESSER_ACTION_DAYS.move - LESSER_ACTION_DAYS.interact) / 2;
    const approach = await passHours(game, game.currentRun().run, game.currentRun().cultivator,
        reachedWaterAfter * 24);
    expect(approach.finished).toBe(true);
    expect(isWater(worldLocationFor(world, game.currentRun().cultivator.location)!)).toBe(true);
    return { plans, game, db, world, day: routineTime(world), departureDay: day, from, to,
        boat, pilot: pilot && world.npcs.find(one => one.id === pilot!.id)!, quote, playerId: now.cultivator.id };
}

it('speaks with the actual co-located pilot on the same owned spirit boat', async () => {
    const h = await departing(true);
    try {
        expect(h.pilot).not.toBeNull();
        const listener = listenerInTheActualCarrierScene(h.game, h.pilot!.id, 'deck');
        const claim = ownedPassageClaim(h.db, h.playerId)!;
        const moment = routineTime(h.game.atHand!);
        const turn = await askThatActualListener(h.game, h.plans, listener.name);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachTime')).toBe(false);
        expect(turn.toolCalls.some(call => call.name === 'engine.approachUnfinished')).toBe(false);
        expect(actualListenerAnswered(turn, listener.name), JSON.stringify(turn.toolCalls)).toBe(true);
        const span = LESSER_ACTION_DAYS.interact;
        expect(h.game.currentRun().run.elapsedDays - listener.before.run.elapsedDays).toBeCloseTo(span, 12);
        expect(routineTime(h.game.atHand!) - moment).toBeCloseTo(span, 12);
        expect(h.game.currentRun().run.turn).toBe(listener.before.run.turn + 1);
        expect(ownedPassageClaim(h.db, h.playerId)!.receiptId).toBe(claim.receiptId);
        const actual = ownedCarrierAt(h.game.atHand!, claim.receiptId,
            h.game.currentRun().cultivator, routineTime(h.game.atHand!))!;
        expect(actual.unavailable).toBeNull();
        expect(h.game.currentRun().cultivator.location).toBe(h.game.atHand!.locations.find(row => row.id === actual.locationId)!.name);
        expect(whoItIsWith(h.game.atHand!.objects.find(row => row.id === h.boat.id)!)).toBe(h.playerId);
        expect(h.game.currentRun().cultivator.spiritStones).toBeLessThanOrEqual(listener.before.cultivator.spiritStones);
        expect(h.game.present(h.game.currentRun().cultivator).length).toBeLessThanOrEqual(3);
    } finally { h.db.close(); resetCultivationWorlds(); }
});
// Loss at the final instant retains the time already lived. The unavailable
// hull ends the accepted passage, rather than erasing the completed hours.
it('actual hull ruin at the final boundary ends the accepted owned passage', async () => {
    const h = await departing(true);
    try {
        const listener = listenerInTheActualCarrierScene(h.game, h.pilot!.id, 'deck');
        const claim = ownedPassageClaim(h.db, h.playerId)!;
        const advance = h.game.advancePreparedWorld.bind(h.game);
        h.game.advancePreparedWorld = (...args: Parameters<typeof h.game.advancePreparedWorld>) => {
            const result = advance(...args);
            const world = h.game.atHand!;
            const at = world.objects.findIndex(row => row.id === h.boat.id);
            if (!isRuined(world.objects[at]!)) world.objects[at] = ruin(world.objects[at]!,
                { onDay: routineTime(world), source: 'Explicit native hull loss at actual boundary' });
            h.game.theWorldMoved();
            return result;
        };
        const stopped = await passHours(h.game, listener.before.run, listener.before.cultivator, 3);
        expect(stopped.finished).toBe(true);
        expect(h.game.currentRun().run.elapsedDays - listener.before.run.elapsedDays).toBeCloseTo(3 / 24);
        expect(ownedCarrierAt(h.game.atHand!, claim.receiptId, h.game.currentRun().cultivator,
            routineTime(h.game.atHand!))!.unavailable).not.toBeNull();
        // A ruined object does not kill or silence a genuinely surviving nearby pilot.
        expect(h.game.atHand!.npcs.some(person => person.id === h.pilot!.id)).toBe(true);
        expect(isRuined(h.game.atHand!.objects.find(row => row.id === h.boat.id)!)).toBe(true);
        expect(h.game.currentRun().cultivator.location).not.toBe(h.to.name);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(listener.before.run.elapsedDays);
        expect(h.game.currentRun().run.turn).toBe(listener.before.run.turn + 1);
        expect(ownedPassageClaim(h.db, h.playerId)).toBeNull();
    } finally { h.db.close(); resetCultivationWorlds(); }
});
