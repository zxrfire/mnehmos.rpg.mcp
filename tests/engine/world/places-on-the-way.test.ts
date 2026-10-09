/**
 * Travelling used to keep real people at their departure until the yearly
 * return pass; an interrupted player likewise still stood at the starting
 * town after walking most of a road. Ambient discovery then invented another
 * traveller who had no destination or body. These checks require ordinary
 * intermediate ground and a timed real journey, preserving the original
 * distance and leaving no person on that ground after arrival. Fast vehicles
 * share the route, while their actual elapsed days determine who they meet.
 * Live station dispatch formerly put the holder at the post immediately. Its
 * initial passage must take the real route; a term ending is no physical relief.
 * Future quote chains use the hull-position reader; boarding separately requires
 * actual departure position. Reusing boarding position inside pricing refused
 * a return already included in that same pure quote chain.
 * The former captainless-hull positive now runs with its actual live captain;
 * removing that captain is a separate refusal, not another advertised ship.
 * A driver's exact market expiry was projected 3.3e-9 percent beyond its walls;
 * admitted geometry must compare the scheduled absolute date before subtraction.
 */
import { describe, expect, it } from 'vitest';
import { addPlacesOnTheWay, firstTravellerOnTheWay, firstTravellerOnTheWater,
    aPostingThatCanReachItsGround, journeyTimeHasReached, locationOnNpcJourney, npcIsTravellingOnDay, npcJourneyOnDay,
    placePartwayAlong, startNpcPassage, bookNpcPassageForRoute, ROUTE_STOP } from '../../../src/engine/world/places-on-the-way.js';
import { linkLocations, makeLocation, walkingDaysFrom, walkingRouteFrom, routeQueriesFor } from '../../../src/engine/world/locations.js';
import { createNpc, markDead, setExistence } from '../../../src/engine/world/npc-state.js';
import { startNpcJourney } from '../../../src/engine/world/dao-ground-stints.js';
import { routineOf } from '../../../src/engine/world/npc-routines.js';
import { resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';
import { SEA_LANES } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { shipIdForLane } from '../../../src/engine/world/the-ship-on-a-lane.js';
import { postingFor } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { SENDING_REASONS } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { priceJourney } from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { theLandfall } from '../../../src/engine/world/where-a-lane-makes-landfall.js';
import { REGIONS } from '../../../src/data/cultivation/regions.js';
import { publicShipLinesFrom, quotePublicPassage, earliestQuotedPublicPassage, onSponsoredPublicPassage } from '../../../src/engine/world/public-shipping.js';
import { ensureShipCrew, bindShipCrewToPassage, commitNpcPublicPassage } from '../../../src/engine/world/ship-crew.js';
import { stonesFor } from '../../../src/engine/world/the-fare-and-calendar-of-a-passage.js';
import { makeFact, createLedger, appendFact } from '../../../src/engine/world/history.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { positionOnRoad, positionOnAdmittedRoad } from '../../../src/engine/world/road-course.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';

function road() {
    const a = makeLocation({ id: 'a', name: 'Departure', kind: 'settlement' });
    const b = makeLocation({ id: 'b', name: 'Destination', kind: 'settlement' });
    linkLocations(a, b, 'road', 8);
    const locations = [a, b];
    const quote = walkingDaysFrom(locations, a.id).get(b.id);
    addPlacesOnTheWay(locations);
    const stop = locations.find(place => place.tags.includes(ROUTE_STOP))!;
    const person = createNpc('traveller-world', { id: 'person', name: 'Traveller',
        locationId: a.id, onDay: 100, bornOnDay: 0 });
    const npc = startNpcJourney({ locations }, person, b.id, 100, 'Taking goods to market.');
    return { locations, a, b, stop, npc, quote };
}

describe('places on an actual journey', () => {
    it('keeps an admitted carriage at its exact intermediate appointment on a large world clock', () => {
        const route = [{locationId:'start',days:0},{locationId:'market',days:.3125},{locationId:'end',days:.75}];
        const held = {position:positionOnRoad(route,0),route,initialTravelDays:0};
        const departure = 123456.123456, duration = .1;
        const atMarket = departure + duration * .3125 / .75;
        expect(positionOnAdmittedRoad(held,atMarket-departure,duration,departure)).toEqual({
            kind:'place',locationId:'market',originLocationId:'start'});
        expect(positionOnAdmittedRoad(held,atMarket-departure-1e-5,duration,departure).kind).toBe('edge');
        expect(positionOnAdmittedRoad(held,atMarket-departure+1e-5,duration,departure).kind).toBe('edge');
    });
    // A stationary body meets the crossing itself, not everybody on its corridor.
    it('finds actual forward and reverse traffic at a fixed partial road point', () => {
        const { locations, a, b, npc } = road();
        const held = positionOnRoad(walkingRouteFrom(locations, a.id, b.id)!, 1);
        const request = { locations, fromId: a.id, toId: b.id, stationaryAt: held, onDay: 100.5, days: 3 };
        expect(firstTravellerOnTheWay({ ...request, npcs: [npc] })?.afterDays).toBeCloseTo(.5, 8);
        expect(firstTravellerOnTheWay({ ...request, days: .25, npcs: [npc] })).toBeNull();
        expect(firstTravellerOnTheWay({ ...request, npcs: [markDead(npc, 100, 'Died before travelling.')] })).toBeNull();
        const reverse = startNpcJourney({ locations }, { ...npc, locationId: b.id, activity: null },
            a.id, 100, 'Returning on their own road.');
        expect(firstTravellerOnTheWay({ ...request, onDay: 106, npcs: [reverse] })?.afterDays).toBeCloseTo(1, 8);
    });
    it('keeps equal-price path order, closed roads and minimum edge prices in prepared batches', () => {
        // The complete ten-year profile03 spent 13.24 seconds beneath the
        // emitted naming helper inside walkingDaysFrom. Preparing the graph
        // once and creating its relaxation helper once must preserve the actual
        // route: equal prices still follow the original road/push order.
        const a = makeLocation({ id: 'a', name: 'Start', kind: 'settlement' });
        const b = makeLocation({ id: 'b', name: 'Second road', kind: 'settlement' });
        const c = makeLocation({ id: 'c', name: 'First road', kind: 'settlement' });
        const d = makeLocation({ id: 'd', name: 'Meeting', kind: 'settlement' });
        const e = makeLocation({ id: 'e', name: 'Near ground', kind: 'settlement' });
        const shut = makeLocation({ id: 'shut', name: 'Closed ground', kind: 'settlement' });
        linkLocations(a, c, 'road', 1);
        linkLocations(a, b, 'road', 1);
        linkLocations(c, d, 'road', 1);
        linkLocations(b, d, 'road', 1);
        linkLocations(d, e, 'road', 0);
        linkLocations(a, shut, 'road', 0);
        a.links.find(link => link.toLocationId === shut.id)!.open = false;
        const locations = [a, b, c, d, e, shut];
        const routes = routeQueriesFor(locations);
        const expected = [
            { locationId: a.id, days: 0 }, { locationId: c.id, days: 1 },
            { locationId: d.id, days: 2 }, { locationId: e.id, days: 2.1 }
        ];
        expect(walkingRouteFrom(locations, a.id, e.id, routes)).toEqual(expected);
        expect(walkingRouteFrom(locations, a.id, e.id)).toEqual(expected);
        expect([...walkingDaysFrom(locations, a.id, undefined, routes)]).toEqual([
            [a.id, 0], [c.id, 1], [b.id, 1], [d.id, 2], [e.id, 2.1]
        ]);
        expect(walkingRouteFrom(locations, a.id, shut.id, routes)).toBeNull();
        expect([...walkingDaysFrom(locations, 'not-on-the-map', undefined, routes)])
            .toEqual([['not-on-the-map', 0]]);
        expect(walkingRouteFrom(locations, 'not-on-the-map', 'not-on-the-map', routes))
            .toEqual([{ locationId: 'not-on-the-map', days: 0 }]);
    });

    it('books the real generated dock service with sponsored seats and one finite hull', () => {
        // The board already sold these passages; SEA_LANES-only NPC lookup
        // falsely refused them. Moving the board authority must preserve its
        // whole quote and allow an actual house purse to pay ordinary berths.
        const province = REGIONS.find(region => region.places.some(place => place.name === 'Silver Island'))!;
        const water = makeLocation({ id: 'dock-water', name: province.name, kind: 'region',
            data: { catalogRegionId: province.id } });
        const from = makeLocation({ id: 'ordinary-dock', name: 'World-only dock', kind: 'sect_seat', parentId: water.id });
        const to = makeLocation({ id: 'silver-dock', name: 'Silver Island', kind: 'settlement', parentId: water.id });
        const world = { ...createWorld({ seed: 'generated-dock-world', regionCount: 0, skipPriorAges: true }),
            currentDay: 100, locations: [water, from, to], npcs: [] as ReturnType<typeof createNpc>[] };
        const line = publicShipLinesFrom(world, from.name, 100).find(one => one.to === to.name)!;
        expect(line.lane.id).toMatch(/^passage-/);
        const quote = quotePublicPassage(world, from.id, to.id, 100, 2)!;
        expect(quote.lane).toEqual(line.lane);
        expect(quote.fareStones).toBe(stonesFor(line.cashPerSeat) * 2);
        expect(quote.vesselId).toBe(shipIdForLane(line.lane));
        const person = createNpc(world.seed, { id: 'sponsored-hand', name: 'Sponsored hand',
            locationId: from.id, spiritStones: 0, onDay: 100, bornOnDay: 0 });
        // Candidate comparison stays pure; only the chosen, stored paid
        // booking creates the crew and an immutable actual passage receipt.
        const funded = { ...person, id: 'ordinary-paying-traveller', spiritStones: quote.fareStones * 3,
            activity: { kind: 'idle' as const, note: 'At the actual landing.', withIds: [], sinceDay: 100, untilDay: null,
                standingIn: theAreasOf(world, from).areas.find(area => area.for === 'landing')!.id } };
        const candidate = resolveWithPlayerPresent(world, from.id,
            () => bookNpcPassageForRoute(world, funded, to.id, 100, 'Taking ordinary passage.'))!;
        expect(world.npcs).toHaveLength(0);
        expect(world.history.facts).toHaveLength(0);
        expect(commitNpcPublicPassage(world, candidate)).toBe(false);
        world.npcs.push(candidate);
        expect(commitNpcPublicPassage(world, world.npcs[0]!)).toBe(true);
        expect(world.npcs.some(npc => npc.identity.occupation === 'shipmaster')).toBe(true);
        expect(world.history.facts.some(fact => fact.data.publicPassage === true
            && fact.data.vesselId === candidate.activity?.vesselId)).toBe(true);
        expect(world.npcs.find(npc => npc.id === candidate.id)!.spiritStones).toBe(candidate.spiritStones);
        const forgottenBodies = { ...world, npcs: [] };
        expect(quotePublicPassage(forgottenBodies, from.id, to.id, quote.arrivalDay + 2)).toBeNull();
        const booked = onSponsoredPublicPassage(world, person, quote, 'Travelling to a house service.')!;
        expect(booked.spiritStones).toBe(0);
        world.npcs.push(booked);
        ensureShipCrew(world, quote.lane, from.id, quote.departureDay);
        bindShipCrewToPassage(world, quote);
        expect(world.npcs.filter(npc => npc.identity.occupation === 'shipmaster')).toHaveLength(1);
        expect(world.npcs.every(npc => npc.activity?.vesselId === quote.vesselId)).toBe(true);
        expect(quotePublicPassage(world, from.id, to.id, 100)!.arrivalDay).toBe(quote.arrivalDay);
        expect(quotePublicPassage(world, to.id, from.id, 100.5)).toBeNull();
        expect(quotePublicPassage(world, from.id, to.id, quote.arrivalDay + 2)).toBeNull();
        const back = quotePublicPassage(world, to.id, from.id, quote.arrivalDay + 2, 2)!;
        expect(back.vesselId).toBe(quote.vesselId);
        expect(back.fromId).toBe(to.id);
        // A lifespan-sized deadline cannot make a hull permanently at the
        // other port sail here. Only an existing return can change that fact.
        expect(earliestQuotedPublicPassage(world, from.id, to.id, quote.arrivalDay + 2,
            quote.arrivalDay + 365 * 10_000)).toBeNull();
        const actualBodies = structuredClone(world.npcs), actualHulls = structuredClone(world.objects);
        const returned = earliestQuotedPublicPassage(world, from.id, to.id, quote.arrivalDay + 2,
            back.arrivalDay + 365, 2, [back])!;
        expect(returned.departureDay).toBe(back.arrivalDay);
        expect(world.npcs).toEqual(actualBodies);expect(world.objects).toEqual(actualHulls);
        const distantDeparture = back.arrivalDay + 365 * 10_000;
        const futureBooked = quotePublicPassage(world, from.id, to.id, distantDeparture, 2, [back])!;
        const sameFutureSailing = earliestQuotedPublicPassage(world, from.id, to.id, back.arrivalDay + 1,
            futureBooked.arrivalDay, 2, [back, futureBooked])!;
        expect(sameFutureSailing.departureDay).toBe(futureBooked.departureDay);


        const earliest = earliestQuotedPublicPassage(world, to.id, from.id, quote.departureDay + 0.5,
            back.arrivalDay + 365, 2)!;
        expect(earliest.departureDay).toBe(quote.arrivalDay);
        expect(earliestQuotedPublicPassage(world, to.id, from.id, quote.departureDay + 0.5,
            quote.arrivalDay, 2)).toBeNull();
        expect(earliestQuotedPublicPassage({ ...world, npcs: [] }, to.id, from.id,
            quote.arrivalDay, back.arrivalDay + 365, 2, [quote])).toBeNull();
        expect(earliestQuotedPublicPassage(world, to.id, from.id,
            quote.arrivalDay, back.arrivalDay + 365, 2, [quote])!.departureDay).toBe(quote.arrivalDay);

        expect(locationOnNpcJourney(world.locations, booked, quote.arrivalDay)).toBe(to.id);
        const planned = quotePublicPassage(world, to.id, from.id,
            quote.arrivalDay + 2, 2, [quote])!;
        expect(planned.arrivalDay).toBe(back.arrivalDay);
        // Prepaid return legs cannot be preempted while any living member
        // continues the mission. Leader death alone does not abandon peers.
        const mission = appendFact(world.history, makeFact({ day: quote.departureDay, kind: 'gathering',
            summary: 'The house prepaid its outward and return berths.', data: {
                publicMission: true, publicReservations: JSON.stringify([quote, back]) } }));
        const continuing = (npc: typeof booked) => ({ ...npc,
            activity: { ...npc.activity!, capitalMissionId: mission.id, capitalMissionLeg: 2, capitalMissionWaiting: false } });
        world.npcs = world.npcs.map(npc => npc.id === booked.id ? continuing(npc) : npc);
        const peer = continuing({ ...createNpc(world.seed, { id: 'continuing-peer', name: 'Continuing peer',
            locationId: to.id, onDay: quote.arrivalDay, bornOnDay: 0 }), activity: booked.activity });
        world.npcs.push(peer);
        expect(quotePublicPassage(world, to.id, from.id, back.departureDay)!.arrivalDay).toBe(back.arrivalDay);
        expect(quotePublicPassage(world, to.id, from.id, back.departureDay + 0.25)).toBeNull();
        const survivingParty = { ...world, npcs: world.npcs.map(npc => npc.id === booked.id
            ? markDead(npc, quote.arrivalDay, 'Died after landfall.') : npc) };
        expect(quotePublicPassage(survivingParty, to.id, from.id, back.departureDay + 0.25)).toBeNull();
        const deadParty = { ...survivingParty, npcs: survivingParty.npcs.map(npc => npc.id === peer.id
            ? markDead(npc, quote.arrivalDay, 'The last continuation died.') : npc) };
        expect(quotePublicPassage(deadParty, to.id, from.id, back.departureDay + 0.25)).not.toBeNull();
        const endedParty = { ...survivingParty, npcs: survivingParty.npcs.map(npc => npc.id === peer.id
            ? { ...npc, activity: null } : npc) };
        expect(quotePublicPassage(endedParty, to.id, from.id, back.departureDay + 0.25)).not.toBeNull();
        // Cancellation releases future berths even with a living former party.
        world.npcs = world.npcs.map(npc => npc.id === booked.id || npc.id === peer.id
            ? { ...npc, activity: npc.id === booked.id ? booked.activity : null } : npc);
        expect(quotePublicPassage(world, to.id, from.id, back.departureDay + 0.25)).not.toBeNull();
        world.npcs = world.npcs.map(npc => npc.id === booked.id ? continuing(npc) : npc);
        const turned = { ...quote, toId: from.id };
        bindShipCrewToPassage(world, turned, quote.departureDay + quote.days / 2);
        expect((world.npcs.find(npc => npc.id === booked.id)!.activity as typeof peer.activity)
            .capitalMissionId).toBe(mission.id);
        expect((world.npcs.find(npc => npc.id === booked.id)!.activity as typeof peer.activity)
            .capitalMissionLeg).toBe(2);
        expect((world.npcs.find(npc => npc.id === booked.id)!.activity as typeof peer.activity)
            .capitalMissionWaiting).toBe(false);
        world.npcs = world.npcs.map(npc => npc.id === booked.id
            ? { ...npc, activity: { ...npc.activity!, capitalMissionId: undefined } } : npc);
        const turnedPassenger = world.npcs.find(npc => npc.id === booked.id)!;
        expect(turnedPassenger.activity?.note).toBe(booked.activity?.note);
        expect(turnedPassenger.activity?.withIds).toEqual(booked.activity?.withIds);
        expect((turnedPassenger.activity as typeof peer.activity).capitalMissionId).toBeUndefined();
        expect(turnedPassenger.activity?.returnTo).toBe(from.id);
        expect(locationOnNpcJourney(world.locations, turnedPassenger, turned.arrivalDay)).toBe(from.id);
        // The actual crew's turnback supersedes the original promised landfall.
        expect(quotePublicPassage(world, from.id, to.id, turned.arrivalDay + 2)).not.toBeNull();
        const oldPlan = appendFact(world.history, makeFact({ day: quote.departureDay, kind: 'gathering',
            summary: 'Only this paid sailing remains planned.', data: {
                publicMission: true, publicReservations: JSON.stringify([quote]) } }));
        // A delayed/retrying mission can retain its pointer after an original
        // unboarded reservation elapsed. Its promised arrival is no hull location.
        const unboarded: typeof world = { ...world, history: createLedger(), npcs: world.npcs
            .filter(npc => npc.tags.includes(`crew-of:${quote.vesselId}`))
            .map(npc => ({ ...npc, locationId: from.id, activity: null, updatedOnDay: quote.departureDay })) };
        const unboardedPlan = appendFact(unboarded.history, makeFact({ day: oldPlan.day, kind: oldPlan.kind,
            summary: oldPlan.summary, data: oldPlan.data }));
        unboarded.npcs.push({ ...peer, locationId: from.id,
            activity: { kind: 'out_with_a_party', note: 'Waiting for a delayed public passage.', withIds: [],
                sinceDay: quote.arrivalDay + 2, untilDay: quote.arrivalDay + 32,
                capitalMissionId: unboardedPlan.id } });
        expect(quotePublicPassage(unboarded, from.id, to.id, quote.arrivalDay + 2)).not.toBeNull();
        expect(quotePublicPassage(unboarded, to.id, from.id, quote.arrivalDay + 2)).toBeNull();
        world.npcs.push({ ...peer, activity: { ...peer.activity!, capitalMissionId: oldPlan.id } });
        expect(quotePublicPassage(world, from.id, to.id, turned.arrivalDay + 2)).not.toBeNull();
        world.npcs = [];
        expect(quotePublicPassage(world, from.id, to.id, quote.arrivalDay + 2)).toBeNull();
    });
    it('shares route prices within a read batch without retaining people or a changed graph', () => {
        // The combined ten-year profile spent87% of CPU in repeated shortest
        // trees. A batch may share graph answers, never a body's changing fact.
        const { locations, a, b, stop, npc } = road();
        const routes = routeQueriesFor(locations);
        expect([...walkingDaysFrom(locations, a.id, undefined, routes)])
            .toEqual([...walkingDaysFrom(locations, a.id)]);
        expect(walkingRouteFrom(locations, a.id, b.id, routes))
            .toEqual(walkingRouteFrom(locations, a.id, b.id));
        expect(walkingRouteFrom(locations, b.id, a.id, routes))
            .toEqual(walkingRouteFrom(locations, b.id, a.id));
        const external = walkingDaysFrom(locations, a.id, undefined, routes);
        external.set(b.id, 99);
        expect(walkingDaysFrom(locations, a.id, undefined, routes).get(b.id)).toBe(8);
        const clock = { seed: 'batch-world', locations, currentDay: 104, currentHour: 0 };
        expect(routineOf(clock, npc, routes)).toEqual(routineOf(clock, npc));
        expect(routineOf(clock, npc, routes).locationId).toBe(stop.id);
        const arrived = { ...npc, activity: { ...npc.activity!, untilDay: 103 } };
        expect(routineOf(clock, arrived, routes).locationId).toBe(b.id);
        expect(routineOf(clock, arrived, routes)).toEqual(routineOf(clock, arrived));
        const corpse = markDead({ ...npc, locationId: a.id }, 104, 'Died here.');
        expect(routineOf(clock, corpse, routes).locationId).toBe(a.id);
        // A graph mutation ends the old scope. A new scope observes its new
        // price/opening, including when the array and objects keep their IDs.
        a.links.find(link => link.toLocationId === stop.id)!.travelDays = 6;
        const fresh = routeQueriesFor(locations);
        expect(walkingDaysFrom(locations, a.id, undefined, fresh).get(b.id)).toBe(10);
        expect([...walkingDaysFrom(locations, a.id, undefined, fresh)])
            .toEqual([...walkingDaysFrom(locations, a.id)]);
        a.links.find(link => link.toLocationId === stop.id)!.open = false;
        expect(walkingRouteFrom(locations, a.id, b.id, routeQueriesFor(locations))).toBeNull();
    });

    it('waits for the existing seasonal opening within the useful arrival deadline', () => {
        const lane = SEA_LANES.find(one => one.openMonthsPerYear > 0 && one.openMonthsPerYear < 12)!;
        const from = makeLocation({ id: 'seasonal-from', name: theLandfall(lane.fromPlace)!, kind: 'settlement' });
        const to = makeLocation({ id: 'seasonal-to', name: theLandfall(lane.toPlace)!, kind: 'settlement' });
        const world = { seed: 'seasonal-shipping', locations: [from, to], npcs: [] };
        const opening = publicShipLinesFrom(world, from.name, 0).find(line => line.to === to.name)!.runsFromDay!;
        expect(opening).toBeGreaterThan(0);
        expect(earliestQuotedPublicPassage(world, from.id, to.id, 0, opening)).toBeNull();
        const earliest = earliestQuotedPublicPassage(world, from.id, to.id, 0, opening + 365)!;
        expect(earliest.departureDay).toBe(opening);
        expect(earliest).toEqual(quotePublicPassage(world, from.id, to.id, opening));
    });

    it('reaches a live post on its actual route clock and stays there past the posting term', () => {
        const from = makeLocation({ id: 'dispatch', name: 'Dispatch ground', kind: 'settlement' });
        const post = makeLocation({ id: 'post', name: 'Posted ground', kind: 'settlement' });
        linkLocations(from, post, 'road', 10);
        const locations = [from, post];
        addPlacesOnTheWay(locations);
        const npc = { ...createNpc('station-world', { id: 'posted-person', name: 'Posted person',
            locationId: post.id, onDay: 100, bornOnDay: 0 }), activity: {
            kind: 'stationed' as const, note: 'Holding the post.', withIds: [],
            fromLocationId: from.id, returnTo: from.id, sinceDay: 100, untilDay: 103
        } };
        expect(locationOnNpcJourney(locations, npc, 100)).toBe(from.id);
        expect(routineOf({ seed: 'station-world', locations, currentDay: 109, currentHour: 8 }, npc).locationId).not.toBe(post.id);
        expect(npcIsTravellingOnDay(locations, npc, 109)).toBe(true);
        expect(npcJourneyOnDay(locations, npc, 109)).toEqual({ from: from.id, to: post.id, sinceDay: 100, untilDay: 110 });
        expect(locationOnNpcJourney(locations, npc, 110)).toBe(post.id);
        expect(locationOnNpcJourney(locations, npc, 200)).toBe(post.id);
        expect(npcIsTravellingOnDay(locations, npc, 110)).toBe(false);
        const established = { ...npc, activity: { ...npc.activity, fromLocationId: null } };
        expect(locationOnNpcJourney(locations, established, 101)).toBe(post.id);
        expect(npcIsTravellingOnDay(locations, established, 101)).toBe(false);
        const craft = requireConveyance('conv-carriage-mortal');
        const carried = { ...npc, activity: { ...npc.activity, conveyanceId: craft.id } };
        const arrival = 100 + priceJourney({ walkingDays: 10, conveyance: craft, heads: 1 }).daysForEverybody;
        expect(locationOnNpcJourney(locations, carried, arrival - 1)).not.toBe(post.id);
        expect(locationOnNpcJourney(locations, carried, arrival)).toBe(post.id);
    });
    it('fits both physical legs inside a short posting and preserves a longer service term', () => {
        const { locations, a, b, npc, stop } = road();
        const craft = requireConveyance('conv-carriage-mortal');
        const posting = postingFor({ reason: { ...SENDING_REASONS[0]!, days: 1 },
            house: { id: 'house', name: 'House' }, pitchOrdinal: 1, conveyance: craft, hands: 1 });
        const feasible = aPostingThatCanReachItsGround(posting, locations, a.id, b.id, craft);
        expect(feasible.days).toBe(8);
        const party = { ...npc, locationId: b.id, activity: { kind: 'out_with_a_party' as const,
            note: 'Delivering supplies.', withIds: [], fromLocationId: a.id, returnTo: a.id,
            sinceDay: 100, untilDay: 112, conveyanceId: craft.id } };
        expect(locationOnNpcJourney(locations, party, 102)).toBe(stop.id);
        expect(locationOnNpcJourney(locations, party, 104)).toBe(b.id);
        expect(locationOnNpcJourney(locations, party, 107)).toBe(b.id);
        expect(locationOnNpcJourney(locations, party, 110)).toBe(stop.id);
        expect(locationOnNpcJourney(locations, party, 112)).toBe(a.id);
        const boat = requireConveyance('conv-spirit-boat');
        const quoted = aPostingThatCanReachItsGround({ ...posting, days: 100 }, locations, a.id, b.id, boat);
        expect(quoted.days).toBe(100);
        expect(quoted.stonesBurned).toBe(2 * priceJourney({ walkingDays: 8, conveyance: boat, heads: 1 }).stonesBurned);
    });

    it('waits for the actual whole-party carriage waves before declaring arrival', () => {
        const { locations, a, b, npc } = road();
        const craft = requireConveyance('conv-carriage-mortal');
        const others = Array.from({ length: craft.heads }, (_, i) => createNpc('party-world', {
            id: `party-hand-${i}`, name: `Hand ${i}`, locationId: a.id, onDay: 100, bornOnDay: 0
        }));
        const ids = others.map(person => person.id);
        const quote = priceJourney({ walkingDays: 8, conveyance: craft, heads: ids.length + 1 });
        expect(quote.daysForEverybody).toBeGreaterThan(quote.daysOneWay);
        const party = { ...npc, locationId: b.id, activity: { kind: 'out_with_a_party' as const,
            note: 'Taking supplies in the available carriage.', withIds: ids,
            fromLocationId: a.id, returnTo: a.id, sinceDay: 100,
            untilDay: 100 + 2 * quote.daysForEverybody + 1, conveyanceId: craft.id } };
        expect(locationOnNpcJourney(locations, party, 100 + quote.daysOneWay)).not.toBe(b.id);
        expect(locationOnNpcJourney(locations, party, 100 + quote.daysForEverybody)).toBe(b.id);
        expect(locationOnNpcJourney(locations, party, party.activity.untilDay)).toBe(a.id);
    });
    it('preserves each direction of the original price and has reachable intermediate ground', () => {
        const { locations, a, b, stop, quote } = road();
        expect(walkingDaysFrom(locations, a.id).get(b.id)).toBe(quote);
        expect(walkingDaysFrom(locations, b.id).get(a.id)).toBe(quote);
        const walked = walkingDaysFrom(locations, a.id).get(stop.id)!;
        expect(walked).toBeGreaterThan(0);
        expect(walked).toBeLessThan(quote!);
        expect(walkingRouteFrom(locations, a.id, b.id)?.map(one => one.locationId)).toContain(stop.id);
        addPlacesOnTheWay(locations);
        expect(walkingDaysFrom(locations, a.id).get(b.id)).toBe(quote);
    });

    it('preserves unequal reverse prices and a road that only opens one way', () => {
        const a = makeLocation({ id: 'z', name: 'One shore', kind: 'settlement' });
        const b = makeLocation({ id: 'a', name: 'Other shore', kind: 'settlement' });
        linkLocations(a, b, 'road', 8);
        b.links[0]!.travelDays = 12;
        const locations = [a, b];
        addPlacesOnTheWay(locations);
        expect(walkingDaysFrom(locations, a.id).get(b.id)).toBe(8);
        expect(walkingDaysFrom(locations, b.id).get(a.id)).toBe(12);
        const c = makeLocation({ id: 'z-one-way', name: 'One-way departure', kind: 'settlement' });
        const d = makeLocation({ id: 'a-one-way', name: 'One-way destination', kind: 'settlement' });
        linkLocations(c, d, 'road', 6);
        d.links = [];
        const oneWay = [c, d];
        addPlacesOnTheWay(oneWay);
        expect(walkingDaysFrom(oneWay, c.id).get(d.id)).toBe(6);
        expect(walkingDaysFrom(oneWay, d.id).has(c.id)).toBe(false);
    });

    it('meets a real person between their departure and arrival, then they are gone', () => {
        const { locations, a, b, stop, npc } = road();
        expect(locationOnNpcJourney(locations, npc, 100)).toBe(a.id);
        expect(locationOnNpcJourney(locations, npc, 101)).toBe(stop.id);
        expect(routineOf({ seed: 'world', locations, currentDay: 101, currentHour: 8 }, npc).locationId).not.toBe(a.id);
        expect(locationOnNpcJourney(locations, npc, 104)).toBe(stop.id);
        expect(locationOnNpcJourney(locations, npc, 108)).toBe(b.id);
        expect(locationOnNpcJourney(locations, npc, 108 - Number.EPSILON * 108)).toBe(b.id);
        expect(journeyTimeHasReached(3.9999999999999996, 4)).toBe(true);
        expect(journeyTimeHasReached(3.999, 4)).toBe(false);
        expect(locationOnNpcJourney(locations, npc, 109)).toBe(b.id);
        // A completed death leaves its body where it ended, even if an old
        // itinerary remains. A surviving soul keeps the ordinary journey read.
        const corpse = markDead({ ...npc, locationId: stop.id }, 104, 'Died on the road.');
        expect(locationOnNpcJourney(locations, corpse, 109)).toBe(stop.id);
        expect(locationOnNpcJourney(locations,
            setExistence({ ...npc, locationId: stop.id }, { to: 'soul_preserved', onDay: 104 }), 109)).toBe(b.id);
        expect(routineOf({ seed: 'world', locations, currentDay: 104, currentHour: 8 }, npc).locationId).toBe(stop.id);
        const contact = firstTravellerOnTheWay({ locations, npcs: [npc], fromId: a.id,
            toId: b.id, onDay: 100, days: 8 });
        expect(contact?.npc.id).toBe(npc.id);
        expect(contact?.place.id).toBe(stop.id);
        expect(firstTravellerOnTheWay({ locations, npcs: [npc], fromId: a.id,
            toId: b.id, onDay: 110, days: 8 })).toBeNull();
    });

    it('prices contact against the vehicle clock rather than walking days', () => {
        const { locations, a, b, npc } = road();
        expect(firstTravellerOnTheWay({ locations, npcs: [npc], fromId: a.id,
            toId: b.id, onDay: 100, days: 4 })).toBeNull();
        expect(firstTravellerOnTheWay({ locations, npcs: [npc], fromId: a.id,
            toId: b.id, onDay: 102, days: 4 })?.afterDays).toBe(2);
    });

    it('leaves crossings intact and finds real journeys sharing existing water', () => {
        const lane = SEA_LANES.find(one => one.water)!;
        const port = makeLocation({ id: 'port', name: theLandfall(lane.fromPlace)!, kind: 'settlement' });
        const water = makeLocation({ id: 'water', name: lane.water!, kind: 'region' });
        const far = makeLocation({ id: 'far', name: theLandfall(lane.toPlace)!, kind: 'settlement' });
        linkLocations(port, water, 'crossing', 4);
        linkLocations(water, far, 'crossing', 4);
        const locations = [port, water, far];
        addPlacesOnTheWay(locations);
        expect(locations.some(place => place.tags.includes(ROUTE_STOP))).toBe(false);
        expect(placePartwayAlong(locations, port.id, far.id, 1, 8, true)?.id).toBe(water.id);
        const person = createNpc('water-world', {
            id: 'sailor', name: 'Sailor', locationId: port.id, onDay: 100, bornOnDay: 0, spiritStones: 10
        });
        const npc = startNpcPassage(locations, person, { lane, destinationId: far.id, onDay: 100,
            days: lane.expectedDays, fareStones: 3, purpose: 'Taking booked passage to the far port.' })!;
        expect(npc.spiritStones).toBe(7);
        const funded = { ...person, spiritStones: 100_000 };
        const planned = startNpcJourney({ locations, seed: 'ordinary-passenger' }, funded, far.id, 100,
            'Taking ordinary public passage.');
        expect(planned.activity?.vesselId).toBe(shipIdForLane(lane));
        expect(planned.activity?.seaLaneId).toBe(lane.id);
        expect(planned.spiritStones).toBeLessThan(funded.spiritStones);
        expect(locationOnNpcJourney(locations, planned, planned.activity!.untilDay!)).toBe(far.id);
        const broke = { ...person, spiritStones: 0 };
        expect(startNpcJourney({ locations }, broke, far.id, 100, 'Cannot buy passage.')).toBe(broke);
        const impossible = { ...person, locationId: far.id, activity: { kind: 'out_with_a_party' as const,
            note: 'An old impossible water assignment.', withIds: [], fromLocationId: port.id,
            returnTo: port.id, sinceDay: 100, untilDay: 108 } };
        expect(locationOnNpcJourney(locations, impossible, 108)).toBe(port.id);
        const differentHome = makeLocation({ id: 'different-home', name: 'Home beyond the water', kind: 'settlement' });
        linkLocations(far, differentHome, 'road', 1);
        locations.push(differentHome);
        expect(locationOnNpcJourney(locations, { ...impossible, activity: {
            ...impossible.activity, returnTo: differentHome.id } }, 109)).toBe(port.id);
        const contact = firstTravellerOnTheWater({ locations, npcs: [npc], waterId: water.id,
            vesselId: shipIdForLane(lane), onDay: 100, days: lane.expectedDays });
        expect(contact?.npc.id).toBe(npc.id);
        expect(locationOnNpcJourney(locations, npc, 100 + contact!.afterDays)).toBe(water.id);
        expect(firstTravellerOnTheWater({ locations, npcs: [npc], waterId: water.id,
            vesselId: shipIdForLane(lane), onDay: 100 + lane.expectedDays, days: lane.expectedDays })).toBeNull();
        expect(firstTravellerOnTheWater({ locations, npcs: [npc], waterId: water.id,
            vesselId: 'a-different-hull', onDay: 100, days: lane.expectedDays })).toBeNull();
    });
});
