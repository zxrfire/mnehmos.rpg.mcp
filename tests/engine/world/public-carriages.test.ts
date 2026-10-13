/**
 * Actual paid-road inspection found a benign fellow-traveller stop discarding
 * the purchased carriage: its remaining leg became a walk, and three unnamed
 * escort heads defended it. Advertised service must instead have an ordinary
 * finite driver and vehicle, with capacity including that driver. Quotes are
 * speculative; only an accepted boarding realises the existing public service.
 * A past purchase cannot recall the vehicle from its actual destination, and
 * a dead driver cannot be reset by another booking. No fleet-position copy is
 * used: these assertions read the actual holder and the ordinary parked object.
 * Root diagnostic83273 found a one-ULP clock sum already at canonical landfall
 * while the carriage receipt still reported a positive remainder. A genuinely
 * unfinished one-day leg must stay unfinished; no clock is snapped by a read.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, theWorldForgetsTheMortalDead } from '../../../src/engine/world/world-state.js';
import { createNpc, markDead, setLocation } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { addPlacesOnTheWay, ROUTE_STOP } from '../../../src/engine/world/places-on-the-way.js';
import { publicCarriageGround, quotePublicCarriage, commitPublicCarriage, publicCarriagePassage,
    settlePublicCarriages, stopPublicCarriage } from '../../../src/engine/world/public-carriages.js';
import { journeyTimeHasReached, locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';

function fixture() {
    const world = createWorld({ seed: 'public-carriage-source', regionCount: 0, skipPriorAges: true });
    world.currentDay = 100; world.currentHour = 0;
    const from = makeLocation({ id: 'carrier-from', name: 'Carrier departure', kind: 'settlement' });
    const to = makeLocation({ id: 'carrier-to', name: 'Carrier destination', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    world.locations = [from, to]; addPlacesOnTheWay(world.locations);
    world.npcs = Array.from({ length: 4 }, (_, k) => createNpc(world.seed, {
        id: `passenger-${k}`, locationId: from.id, onDay: 100, bornOnDay: 80,
        name: `Passenger ${k}`, occupation: 'merchant' }));
    world.objects = [];
    const input = { fromId: from.id, toId: to.id, day: 100,
        conveyanceId: 'conv-carriage-mortal', passengerIds: [world.npcs[0]!.id], fareStones: 12, hired: false };
    return { world, from, to, input, stop: world.locations.find(place => place.tags.includes(ROUTE_STOP))! };
}

describe('an actual public carriage', () => {
    it('realises only an accepted booking and carries the same body A to B without the player', () => {
        const { world, from, to, input, stop } = fixture();
        const count = world.npcs.length, facts = world.history.facts.length;
        const quote = quotePublicCarriage(world, input)!;
        expect(quote).not.toBeNull();
        expect(world.npcs).toHaveLength(count); expect(world.objects).toHaveLength(0);
        expect(world.history.facts).toHaveLength(facts);
        const receipt = commitPublicCarriage(world, quote)!;
        expect(receipt).not.toBeNull(); expect(world.objects).toHaveLength(1);
        const driver = world.npcs.find(npc => npc.id === quote.driverId)!;
        const passenger = world.npcs.find(npc => npc.id === input.passengerIds[0])!;
        expect(driver.identity.occupation).toBe('carter');
        expect(driver.activity?.vesselId).toBe(world.objects[0]!.id);
        expect(locationOnNpcJourney(world.locations, driver, 100)).toBe(from.id);
        expect(locationOnNpcJourney(world.locations, driver, 101)).toBe(stop.id);
        expect(publicCarriageGround(world, world.objects[0]!, 101)).toBe(stop.id);
        expect(locationOnNpcJourney(world.locations, passenger, 101, undefined, undefined,
            id => world.npcs.find(person => person.id === id))).toBe(stop.id);
        expect(publicCarriageGround(world, world.objects[0]!, quote.arrivalDay)).toBe(to.id);
        expect(publicCarriagePassage(world, receipt.id, passenger.id, 101)?.leg).toEqual({
            vesselId: quote.vesselId, driverId: quote.driverId, fromId: from.id, toId: to.id,
            departureDay: 100, arrivalDay: quote.arrivalDay, conveyanceId: input.conveyanceId });
    });

    it('holds three mortal passenger berths, including the actual driver in the fourth head', () => {
        const { world, input } = fixture();
        const first = commitPublicCarriage(world, quotePublicCarriage(world, input)!)!;
        const twoMore = { ...input, passengerIds: world.npcs.slice(1, 3).map(npc => npc.id), fareStones: 24 };
        expect(commitPublicCarriage(world, quotePublicCarriage(world, twoMore)!)).not.toBeNull();
        expect(world.objects).toHaveLength(1);
        expect(world.npcs.filter(npc => npc.identity.occupation === 'carter')).toHaveLength(1);
        expect(quotePublicCarriage(world, { ...input, passengerIds: ['passenger-3'] })).toBeNull();
        expect(quotePublicCarriage(world, { ...input, passengerIds: ['passenger-3'], hired: true })).toBeNull();
        expect(publicCarriagePassage(world, first.id, input.passengerIds[0]!, 101)).not.toBeNull();
    });

    it('refuses the old departure after landfall and uses the same source for a real reverse leg', () => {
        const { world, from, to, input } = fixture();
        const quote = quotePublicCarriage(world, input)!;
        commitPublicCarriage(world, quote);
        world.currentDay = quote.arrivalDay;
        expect(quotePublicCarriage(world, { ...input, day: world.currentDay, passengerIds: ['passenger-3'] })).toBeNull();
        world.npcs[3] = setLocation(world.npcs[3]!, to.id, world.currentDay);
        const back = quotePublicCarriage(world, { ...input, fromId: to.id, toId: from.id,
            day: world.currentDay, passengerIds: ['passenger-3'] })!;
        expect(back.vesselId).toBe(quote.vesselId); expect(back.driverId).toBe(quote.driverId);
        expect(commitPublicCarriage(world, back)).not.toBeNull();
        expect(world.objects).toHaveLength(1);
    });

    it('does not charge or mutate an accepted candidate whose last berth changed before commit', () => {
        const { world, input } = fixture();
        const stale = quotePublicCarriage(world, { ...input, passengerIds: ['passenger-3'] })!;
        commitPublicCarriage(world, quotePublicCarriage(world, {
            ...input, passengerIds: ['passenger-0', 'passenger-1', 'passenger-2'] })!);
        const before = { people: world.npcs.length, objects: world.objects.length, facts: world.history.facts.length };
        expect(commitPublicCarriage(world, stale)).toBeNull();
        expect({ people: world.npcs.length, objects: world.objects.length, facts: world.history.facts.length }).toEqual(before);
    });

    it('a real loss ends every bound body on actual ground rather than completing obsolete itineraries', () => {
        const { world, input, stop } = fixture();
        const quote = quotePublicCarriage(world, input)!;
        const receipt = commitPublicCarriage(world, quote)!;
        stopPublicCarriage(world, quote, 102);
        const index = world.npcs.findIndex(npc => npc.id === quote.driverId);
        world.npcs[index] = markDead(world.npcs[index]!, 102, 'Killed defending the actual carriage.');
        world.currentDay = 102;
        settlePublicCarriages(world, 102);
        expect(publicCarriagePassage(world, receipt.id, input.passengerIds[0]!, 102)).toBeNull();
        expect(world.npcs.find(npc => npc.id === input.passengerIds[0])!.locationId).toBe(stop.id);
        expect(publicCarriageGround(world, world.objects[0]!, 110)).toBe(stop.id);
        theWorldForgetsTheMortalDead(world);
        expect(publicCarriageGround(world, world.objects[0]!, 110)).toBe(stop.id);
        expect(quotePublicCarriage(world, { ...input, day: 110, passengerIds: ['passenger-3'] })).toBeNull();
    });

    it('keeps the actual port ground when a completed driver is subsequently forgotten', () => {
        const { world, input, to } = fixture();
        const quote = quotePublicCarriage(world, input)!;
        commitPublicCarriage(world, quote);
        const index = world.npcs.findIndex(npc => npc.id === quote.driverId);
        world.npcs[index] = markDead(setLocation(world.npcs[index]!, to.id, quote.arrivalDay),
            quote.arrivalDay + 1, 'Died after reaching the destination.');
        world.currentDay = quote.arrivalDay + 1;
        settlePublicCarriages(world, world.currentDay); theWorldForgetsTheMortalDead(world);
        expect(publicCarriageGround(world, world.objects[0]!, world.currentDay)).toBe(to.id);
        expect(world.objects).toHaveLength(1);
    });
});

it('agrees with canonical driver and hull landfall while keeping a real unfinished day', () => {
    const { world, input, to } = fixture();
    const quote = quotePublicCarriage(world, input)!;
    const receipt = commitPublicCarriage(world, quote)!;
    const partial = publicCarriagePassage(world, receipt.id, input.passengerIds[0]!, quote.arrivalDay - 1)!;
    expect(partial.arrived).toBe(false);
    expect(partial.remainingDays).toBe(1);
    expect(partial.locationId).not.toBe(to.id);
    // Arrange a representable rounding neighbour, then ask the existing clock authority.
    const moment = quote.arrivalDay - Number.EPSILON * Math.abs(quote.arrivalDay);
    expect(journeyTimeHasReached(moment, quote.arrivalDay)).toBe(true);
    expect(journeyTimeHasReached(quote.arrivalDay, moment)).toBe(true);
    const landed = publicCarriagePassage(world, receipt.id, input.passengerIds[0]!, moment)!;
    expect(landed.arrived).toBe(true);
    expect(landed.remainingDays).toBe(0);
    expect(locationOnNpcJourney(world.locations, landed.driver, moment)).toBe(to.id);
    expect(publicCarriageGround(world, landed.vehicle, moment)).toBe(to.id);
    expect(world.currentDay).toBe(input.day);
});
