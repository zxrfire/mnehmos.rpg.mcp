/**
 * The carrier-linked journey reader no longer fabricates a passenger route
 * without its actual driver. The audit found world-backed callers supplying
 * only the map and passenger, which made a real riding passenger disappear
 * from presence and economy reads. The world adapter supplies current NPC
 * rows, and a driver lost or diverted elsewhere cannot leave the old passenger
 * booking walking on independently. No body or route is moved by a read.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, npcsAt } from '../../../src/engine/world/world-state.js';
import { createNpc, markDead } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { quotePublicCarriage, commitPublicCarriage } from '../../../src/engine/world/public-carriages.js';
import { addPlacesOnTheWay, locationOfNpcOnItsJourney, locationOnNpcJourney, ROUTE_STOP }
    from '../../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../../src/engine/world/npc-routines.js';

function boarded() {
    const state = createWorld({ seed: 'actual-driver-journey-read', regionCount: 0, skipPriorAges: true });
    const from = makeLocation({ id: 'from', name: 'Reed Station', kind: 'settlement' });
    const to = makeLocation({ id: 'to', name: 'Stone Station', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    state.locations.push(from, to);
    addPlacesOnTheWay(state.locations);
    const passenger = createNpc(state.seed, { id: 'passenger', locationId: from.id,
        bornOnDay: state.currentDay - 7300, onDay: state.currentDay });
    state.npcs.push(passenger);
    const quote = quotePublicCarriage(state, { fromId: from.id, toId: to.id, day: routineTime(state),
        conveyanceId: 'conv-carriage-mortal', passengerIds: [passenger.id], fareStones: 5, hired: false })!;
    expect(quote).not.toBeNull();
    expect(commitPublicCarriage(state, quote)).not.toBeNull();
    const driver = state.npcs.find(n => n.id === quote.driverId)!;
    return { state, quote, driver, passenger: state.npcs.find(n => n.id === passenger.id)!,
        stop: state.locations.find(p => p.tags.includes(ROUTE_STOP))! };
}

describe('world journey reads follow the real operator', () => {
    it('finds the actual riding passenger beside its driver without changing either', () => {
        const h = boarded();
        const day = h.quote.departureDay + 1;
        const before = JSON.stringify(h.state);
        expect(locationOfNpcOnItsJourney(h.state, h.passenger, day)).toBe(h.stop.id);
        expect(locationOfNpcOnItsJourney(h.state, h.driver, day)).toBe(h.stop.id);
        expect(npcsAt({ ...h.state, currentDay: day }, h.stop.id).map(n => n.id))
            .toEqual(expect.arrayContaining([h.passenger.id, h.driver.id]));
        expect(JSON.stringify(h.state)).toBe(before);
    });

    it('does not invent an independent passenger journey when the actual driver is absent', () => {
        const h = boarded();
        h.state.npcs = h.state.npcs.filter(n => n.id !== h.driver.id);
        expect(locationOfNpcOnItsJourney(h.state, h.passenger, h.quote.departureDay + 1)).toBeNull();
        expect(locationOnNpcJourney(h.state.locations, h.passenger, h.quote.departureDay + 1)).toBeNull();
    });

    it('reads the changed current driver row rather than a cached living body', () => {
        const h = boarded();
        const day = h.quote.departureDay + 1;
        expect(locationOfNpcOnItsJourney(h.state, h.passenger, day)).toBe(h.stop.id);
        const at = h.state.npcs.findIndex(n => n.id === h.driver.id);
        h.state.npcs[at] = markDead(h.state.npcs[at]!, day, 'The driver died on the road.');
        expect(locationOfNpcOnItsJourney(h.state, h.passenger, day)).toBeNull();
    });

    it('does not keep the passenger on the old route after the driver ceases serving it', () => {
        const h = boarded();
        const at = h.state.npcs.findIndex(n => n.id === h.driver.id);
        h.state.npcs[at] = { ...h.driver, locationId: h.quote.toId, activity: null,
            updatedOnDay: h.quote.departureDay + 1 };
        expect(locationOfNpcOnItsJourney(h.state, h.passenger, h.quote.departureDay + 1)).toBeNull();
    });
});
