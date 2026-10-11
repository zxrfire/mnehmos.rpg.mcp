import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { recordedVoyage } from '../../src/web/a-ship-at-sea.js';
import { ownedPassageClaim, ownedCarrierAt } from '../../src/web/an-owned-passage.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
/**
 * A stopped road used to leave its walker in the departure town, and a passing
 * traveller was an invented discovery paragraph rather than somebody whose
 * own journey could finish. A player must reach the intermediate ground,
 * find the actual person there through normal presence, and then continue or
 * leave. The quiet control must reach the requested destination in one act.
 * The arrangement is explicit, with a pinned world and no assumed crowd/name.
 * Paid-carriage coverage originally walked after the benign contact and missed
 * the lost ticket. The rider must now continue the actual bought carriage,
 * retain its one fare and its original journey horizon, with an actual driver.
 * Journeys begin at the actual fractional world clock. An integer-day fixture
 * leaves its traveller ahead of the player before either road is walked.
 * The air control supplies actual metric ground and reads its native quote.
 * It formerly expected a road contact aboard an aircraft; actual air travel now
 * passes over that walker. A different carter on the road is likewise not a
 * passenger on the player's paid carriage. Presence keeps the actual hull.
 * Same-departure paid controls
 * start at the real counter and use the native hull quote; counter approaches
 * are separate time, not time in that departure's leg.
 * Continuing to the town reaches the actual endpoint. The return control walks
 * that learned road directly; asking to revisit the reached midpoint is another
 * actual trip, rather than a free test of an unknown destination.
 * A native fight can interrupt the return; its recorded round spends the ordinary
 * attack span in addition to the eight days walked. Arrival at the Jade gate
 * likewise pays registration separately from the already paid carriage fare.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { addPlacesOnTheWay, firstTravellerOnTheWay, startNpcPassage, ROUTE_STOP } from '../../src/engine/world/places-on-the-way.js';
import { linkLocations, makeLocation } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { startNpcJourney } from '../../src/engine/world/dao-ground-stints.js';
import { routineOf } from '../../src/engine/world/npc-routines.js';
import { HOME_REGION_ID } from '../../src/data/cultivation/regions/region-ids.js';
import { A_SPIRIT_BOAT_ANSWERS_TO, aVehicleOf } from '../../src/engine/world/a-vehicle.js';
import { stonesFor, whatRunsFromHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { quotePublicPassage } from '../../src/engine/world/public-shipping.js';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew.js';
import { theVoyageUnderWay } from '../../src/web/a-ship-at-sea.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { thePaidCarriageClaim } from '../../src/web/a-paid-carriage-on-the-road.js';
import { publicCarriagePassage } from '../../src/engine/world/public-carriages.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { LI_PER_WALKING_DAY } from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import { quoteAnAirJourney } from '../../src/engine/world/what-an-air-journey-takes.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { stoppedRoadFor } from '../../src/web/a-road-stopped-partway.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';

/** Review-only capture of actual authority; never creates or changes a row. */
function observeTransport(game: Awaited<ReturnType<typeof makeGameInWorld>>['game'], label: string,
    result: unknown, relevantIds: readonly string[] = []) {
    const now = game.currentRun(), world = game.atHand!;
    const road = thePaidCarriageClaim(game.db, now.cultivator.id);
    const ship = recordedVoyage(game.db, now.cultivator.id);
    const owned = ownedPassageClaim(game.db, now.cultivator.id);
    const roadSource = road && publicCarriagePassage(world, road.receiptId, now.cultivator.id, routineTime(world));
    const shipSource = ship?.receiptId && shipPassengerAt(world, ship.receiptId, routineTime(world));
    const ownSource = owned && ownedCarrierAt(world, owned.receiptId, now.cultivator, routineTime(world));
    const vesselIds = new Set([roadSource?.leg.vesselId, shipSource && shipSource.vesselId,
        owned && world.history.facts.find(fact => fact.id === owned.receiptId)?.data.vesselId]);
    const actual = world.npcs.filter(person => relevantIds.includes(person.id)
        || person.activity?.withIds.includes(now.cultivator.id)
        || !!person.activity?.vesselId && vesselIds.has(person.activity.vesselId));
    const file = process.env.TRANSPORT_REVIEW_LOG ?? resolve('.claude/transport-revision04-observations.jsonl');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify({ label, result, body: now.cultivator,
        elapsedDays: now.run.elapsedDays, worldDay: world.currentDay, hour: world.currentHour,
        actualMoment: routineTime(world), claims: { road, ship, owned, foot: stoppedRoadFor(game.db, now.cultivator, world) },
        sources: { road: roadSource, ship: shipSource, owned: ownSource },
        actors: actual.map(person => ({ id: person.id, name: person.name, status: person.status,
            rawGround: person.locationId, routine: routineOf(world, person), activity: person.activity })) }) + '\n');
}

async function prepared(contact = true) {
    const { game, db } = await makeGameInWorld({ seed: 'real-road-contact', worldSeed: 'real-road-contact-world' });
    await game.newRun('Walker');
    game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
    const world = game.atHand!;
    const region = world.locations.find(place => place.kind === 'region' && place.data.catalogRegionId === HOME_REGION_ID)!;
    const from = makeLocation({ id: 'road-test-from', name: 'Road departure', kind: 'settlement', parentId: region.id,
        data: { metricXLi: 0, metricYLi: 0 } });
    const to = makeLocation({ id: 'road-test-to', name: 'Road destination', kind: 'settlement', parentId: region.id,
        data: { metricXLi: 8 * LI_PER_WALKING_DAY, metricYLi: 0 } });
    linkLocations(from, to, 'road', 8);
    const locations = [region, from, to];
    addPlacesOnTheWay(locations);
    world.locations = locations;
    const day = routineTime(world);
    const npc = startNpcJourney(world, createNpc(world.seed, { id: 'road-test-person',
        name: 'Fixture traveller', locationId: from.id, onDay: day, bornOnDay: day - 20 * 365,
        occupation: 'merchant' }), to.id, day, 'Taking goods to the destination market.');
    world.npcs = contact ? [npc] : [];
    game.repos.cultivators.update(game.state().cultivator.id, {
        location: from.name, realmOrdinal: 20, hp: 1000, spiritStones: 5000
    });
    game.repos.cultivators.standIn(game.state().cultivator.id, null);
    game.theWorldMoved();
    game.noteEncounter(game.state().cultivator, game.currentRun().run,
        { kind: 'place', id: to.name, name: to.name }, 'told', 'The road is known.');
    game.noteEncounter(game.state().cultivator, game.currentRun().run,
        { kind: 'place', id: from.name, name: from.name }, 'told', 'The return road is known.');
    return { game, db, world, from, to, npc, stop: locations.find(place => place.tags.includes(ROUTE_STOP))! };
}

describe('real travellers on the played road', () => {
    it('lets the traveller leave and arrive while the player stays in the departure town', async () => {
        const { game, from, to, npc, stop } = await prepared();
        await game.act('I wait for one day');
        expect(game.state().cultivator.location).toBe(from.name);
        expect(game.present(game.state().cultivator).map(person => person.id)).not.toContain(npc.id);
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === npc.id)!).locationId).toBe(stop.id);
        await game.act('I wait for eight days');
        expect(game.state().cultivator.location).toBe(from.name);
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === npc.id)!).locationId).toBe(to.id);
    }, 120_000);
    it('flies the quoted leg while an independent walker stays on the road', async () => {
        const { game, world, from, to, npc, stop } = await prepared();
        game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
        const me = game.state().cultivator;
        game.repos.cultivators.update(me.id, { realmOrdinal: A_SPIRIT_BOAT_ANSWERS_TO });
        const boat = aVehicleOf({ id: 'player-road-boat', conveyanceId: 'conv-spirit-boat',
            ownerId: me.id, ownerName: me.name, at: from.id });
        world.objects.push(boat);
        const quote = quoteAnAirJourney(world.locations, from.id, to.id,
            requireConveyance('conv-spirit-boat'), boat.power);
        expect(quote).not.toBeNull();
        const departedAt = routineTime(world);
        world.npcs = [{ ...npc, activity: { ...npc.activity!, sinceDay: departedAt - 3,
            untilDay: departedAt + 5 } }];
        const berth = theAreasOf(world, from).areas.find(area => area.for === 'spirit_berth');
        expect(berth, 'the flight control starts at its actual departure berth').toBeDefined();
        game.repos.cultivators.standIn(me.id, berth!.id);
        game.theWorldMoved();
        const before = game.state().run.elapsedDays;
        const stones = game.state().cultivator.spiritStones;
        const flown = await game.act(`I fly my spirit boat to ${to.name}`);
        observeTransport(game, 'owned road contact', flown, [npc.id]);
        expect(game.state().cultivator.location).toBe(to.name);
        expect(game.state().run.elapsedDays - before).toBeCloseTo(quote!.daysOneWay, 10);
        expect(game.state().cultivator.spiritStones).toBeLessThan(stones);
        expect(game.present(game.state().cultivator).map(person => person.id)).not.toContain(npc.id);
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === npc.id)!).locationId).toBe(stop.id);
    }, 120_000);

    it('buys a carriage seat and reaches the same road as an independently departing carter', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'road-5', worldSeed: 'road-world' });
        await game.newRun('Rider');
        const me = game.state().cultivator;
        game.repos.cultivators.update(me.id, { spiritStones: 5000, realmOrdinal: 20, hp: 1000 });
        game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
        const world = game.atHand!;
        const line = whatRunsFromHere(game, me, 0).find(one => one.service === 'carriage' && one.days > 1)!;
        const from = worldLocationFor(world, me.location)!;
        const to = worldLocationFor(world, line.to)!;
        const station = theAreasOf(world, from).areas.find(area => area.for === 'carriage_station');
        expect(station).toBeDefined();
        game.repos.cultivators.standIn(me.id, station!.id);
        const departedAt = routineTime(world);
        const driver = createNpc(world.seed, { id: 'independent-carter', name: 'Fixture carter',
            locationId: from.id, onDay: world.currentDay, bornOnDay: world.currentDay - 20 * 365 });
        const carriage = aVehicleOf({ id: 'carter-carriage', conveyanceId: 'conv-carriage-mortal',
            ownerId: driver.id, ownerName: driver.name, at: from.id });
        world.objects.push(carriage);
        const traveller = startNpcJourney(world, driver, to.id, departedAt,
            'Taking a load to the next town.', carriage);
        world.npcs = [traveller];
        game.theWorldMoved();
        const contact = firstTravellerOnTheWay({ locations: world.locations, npcs: [traveller],
            fromId: from.id, toId: to.id, onDay: departedAt, days: line.days });
        expect(contact).not.toBeNull();
        const fareBefore = game.state().cultivator.spiritStones;
        const beganAt = game.state().run.elapsedDays;
        const attempted = await game.act(`I book a carriage to ${line.to}`);
        observeTransport(game, 'paid road boarding', attempted, [traveller.id]);
        expect(game.state().cultivator.spiritStones).toBeLessThan(fareBefore);
        expect(game.state().cultivator.location, JSON.stringify(attempted)).toBe(contact!.place.name);
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === traveller.id)!).locationId).toBe(contact!.place.id);
        expect(game.present(game.state().cultivator).map(person => person.id)).not.toContain(traveller.id);
        const claim = thePaidCarriageClaim(db, me.id)!;
        expect(claim).not.toBeNull();
        const booked = publicCarriagePassage(game.atHand!, claim.receiptId, me.id, routineTime(game.atHand!))!;
        expect(booked).not.toBeNull();
        expect(game.present(game.state().cultivator).map(person => person.id)).toContain(booked.driver.id);
        const paidOnce = game.state().cultivator.spiritStones;
        expect(fareBefore - paidOnce).toBe(stonesFor(line.cashPerSeat));
        // The same fractional boundary used by conversation carries the body,
        // instead of parking an independent driver for as long as we talk.
        await passHours(game, game.currentRun().run, game.state().cultivator, 4);
        observeTransport(game, 'paid road after four hours', null, [traveller.id]);
        expect(game.state().cultivator.location).toBe(game.atHand!.locations.find(place =>
            place.id === routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === booked.driver.id)!).locationId)!.name);
        const continued = await game.act(`I travel to ${line.to}`);
        observeTransport(game, 'paid road continued', continued, [traveller.id]);
        expect(game.state().cultivator.location).toBe(line.to);
        const arrivalCharges = game.atHand!.history.facts.filter(fact => fact.data.gateRegistration === true
            && fact.data.gateRegistrant === me.id && fact.day >= Math.floor(departedAt));
        expect(game.state().cultivator.spiritStones).toBe(paidOnce
            - arrivalCharges.reduce((sum, fact) => sum + Number(fact.data.stones ?? 0), 0));
        expect(game.state().run.elapsedDays - beganAt).toBeCloseTo(booked.leg.arrivalDay - booked.leg.departureDay, 10);
        expect(thePaidCarriageClaim(db, me.id)).toBeNull();
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === booked.driver.id)!).locationId).toBe(to.id);
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === traveller.id)!).locationId).toBe(to.id);
    }, 120_000);

    it('meets a passenger who bought the same finite ship passage and leaves the water after arrival', async () => {
        const { game } = await makeGameInWorld({ seed: 'booth-0', worldSeed: 'road-world' });
        await game.newRun('Rider');
        const me = game.state().cultivator;
        game.repos.cultivators.update(me.id, { location: 'Emerald Water City', spiritStones: 5000,
            realmOrdinal: 20, hp: 1000 });
        game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
        const world = game.atHand!;
        const line = whatRunsFromHere(game, game.state().cultivator, 0)
            .find(one => one.service === 'ship' && one.lane && one.runsFromDay === null)!;
        const from = worldLocationFor(world, 'Emerald Water City')!;
        const to = worldLocationFor(world, line.to)!;
        const landing = theAreasOf(world, from).areas.find(area => area.for === 'landing');
        expect(landing).toBeDefined();
        game.repos.cultivators.standIn(me.id, landing!.id);
        const run = game.currentRun().run;
        const departedAt = routineTime(world);
        const quote = quotePublicPassage(world, from.id, to.id, departedAt, 1, [],
            `${run.seed}:${Math.floor(run.elapsedDays)}`);
        expect(quote, 'the independently booked passenger uses the actual hull quote').not.toBeNull();
        const fare = stonesFor(line.cashPerSeat);
        const passenger = createNpc(world.seed, { id: 'booked-passenger', name: 'Fixture passenger',
            locationId: from.id, spiritStones: fare + 10, onDay: world.currentDay,
            bornOnDay: world.currentDay - 20 * 365 });
        const booked = startNpcPassage(world.locations, passenger, { lane: line.lane!, destinationId: to.id,
            onDay: departedAt, days: quote!.days, fareStones: quote!.fareStones,
            purpose: 'Taking the ship to the island market.' })!;
        expect(booked.spiritStones).toBe(passenger.spiritStones - fare);
        world.npcs = [booked];
        expect(commitNpcPublicPassage(world, booked)).toBe(true);
        game.theWorldMoved();
        const attempted = await game.act(`I take the ship to ${line.to}`);
        observeTransport(game, 'paid same-hull boarding', attempted, [booked.id]);
        expect(theVoyageUnderWay(game.db, game.state().cultivator), JSON.stringify(attempted)).not.toBeNull();
        // Contact formerly overwrote the master's deck with the passenger's
        // separately dealt area, leaving the actual crew unreachable in view.
        const master = game.atHand!.npcs.find(person => person.status === 'alive'
            && person.identity.occupation === 'shipmaster'
            && person.activity?.vesselId === booked.activity!.vesselId)!;
        expect(master, 'the actual booked hull has its own living shipmaster').toBeDefined();
        const seen = game.present(game.state().cultivator);
        expect(seen.map(person => person.id)).toContain(booked.id);
        expect(seen.map(person => person.id)).toContain(master.id);
        expect(seen.length).toBeLessThanOrEqual(3);
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === booked.id)!).locationId)
            .not.toBe(from.id);
        await game.act(`I sail on to ${line.to}`);
        expect(game.state().cultivator.location).toBe(line.to);
        expect(theVoyageUnderWay(game.db, game.state().cultivator)).toBeNull();
        expect(routineOf(game.atHand!, game.atHand!.npcs.find(person => person.id === booked.id)!).locationId).toBe(to.id);
    }, 120_000);
    it('stops between towns beside the actual traveller and continues only the remaining road', async () => {
        const { game, to, npc, stop } = await prepared();
        const before = game.state().run.elapsedDays;
        const moved = await game.act(`I travel to ${to.name}`);
        expect(game.state().cultivator.location).toBe(stop.name);
        expect(game.state().run.elapsedDays - before).toBeCloseTo(4, 10);
        expect(game.present(game.state().cultivator).map(person => person.id)).toContain(npc.id);
        expect(moved.narration).toMatch(/traveller/i);
        await game.act(`I travel to ${to.name}`);
        expect(game.state().cultivator.location).toBe(to.name);
        expect(game.state().run.elapsedDays - before).toBeCloseTo(8, 10);
        const current = game.atHand!.npcs.find(person => person.id === npc.id)!;
        expect(routineOf(game.atHand!, current).locationId).toBe(to.id);
    }, 120_000);

    it('reaches the requested destination in one quiet act', async () => {
        const { game, to } = await prepared(false);
        const before = game.state().run.elapsedDays;
        await game.act(`I travel to ${to.name}`);
        expect(game.state().cultivator.location).toBe(to.name);
        expect(game.state().run.elapsedDays - before).toBeCloseTo(8, 10);
    }, 120_000);

    it('returns on the road it actually walked', async () => {
        const { game, from, to, npc, stop } = await prepared();
        const before = game.state().run.elapsedDays;
        await game.act(`I travel to ${to.name}`);
        expect(game.state().cultivator.location).toBe(stop.name);
        await game.act(`I travel to ${to.name}`);
        expect(game.state().cultivator.location).toBe(to.name);
        const routes = await game.act('Where can I go?');
        expect(routes.narration).not.toContain(stop.name);
        expect(game.canPointAtLocation(game.state().cultivator, to)).toBe(true);
        expect(game.canPointAtLocation(game.state().cultivator, from)).toBe(true);
        const returned = await game.act(`I travel to ${from.name}`);
        observeTransport(game, 'known road return', returned, [npc.id]);
        const returnTurns = [returned];
        // The world can interrupt the return too. Repeating the destination walks its remainder.
        for (let attempts = 0; attempts < 8 && game.state().cultivator.location !== from.name; attempts++) {
            const next = await game.act(`I travel to ${from.name}`);
            returnTurns.push(next);
            observeTransport(game, 'known road return resumed', next, [npc.id]);
        }
        expect(game.state().cultivator.location).toBe(from.name);
        const fightRounds = returnTurns.flatMap(turn => turn.toolCalls).filter(call => call.name === 'combat.round').length;
        expect(game.state().run.elapsedDays - before).toBeCloseTo(16 + fightRounds * LESSER_ACTION_DAYS.attack, 10);
    }, 120_000);

    it('pilots the privately owned spirit boat across actual open water and lands at its port', async () => {
        const { game } = await makeGameInWorld({ seed: 'owned-ocean-boat', worldSeed: 'road-world' });
        await game.newRun('Pilot');
        const me = game.state().cultivator;
        game.repos.cultivators.update(me.id, { location: 'Emerald Water City',
            realmOrdinal: A_SPIRIT_BOAT_ANSWERS_TO, hp: 1000, spiritStones: 5000 });
        game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
        const world = game.atHand!;
        const line = whatRunsFromHere(game, game.state().cultivator, 0)
            .find(one => one.service === 'ship' && one.lane && one.runsFromDay === null)!;
        const from = worldLocationFor(world, 'Emerald Water City')!;
        const to = worldLocationFor(world, line.to)!;
        world.npcs = [];
        const boat = aVehicleOf({ id: 'owned-ocean-craft', conveyanceId: 'conv-spirit-boat',
            ownerId: me.id, ownerName: me.name, at: from.id });
        world.objects.push(boat);
        game.theWorldMoved();
        game.noteEncounter(game.state().cultivator, game.currentRun().run,
            { kind: 'place', id: to.name, name: to.name }, 'told', 'The actual landfall was named.');
        const stones = game.state().cultivator.spiritStones;
        const sailed = await game.act(`I fly my spirit boat to ${to.name}`);
        observeTransport(game, 'owned ocean landing', sailed);
        expect(sailed.toolCalls.some(call => call.name === 'engine.priceJourney')).toBe(true);
        expect(game.state().cultivator.location).toBe(to.name);
        expect(game.state().cultivator.spiritStones).toBeLessThan(stones);
        expect(theVoyageUnderWay(game.db, game.state().cultivator)).toBeNull();
        expect(world.objects.find(object => object.id === boat.id)?.data.withId).toBe(me.id);
    }, 120_000);
});
