/**
 * The contact reader formerly rounded a route vertex to at least one day and
 * scaled the whole route into the requested body window. A follower halfway
 * through a four-day leg waiting three quarters of a day therefore missed a
 * real crossing half a day away. A tenth-day road crossing was missed too.
 * Contacts must read the actual leg's dated route, within the requested window.
 */
import { expect, it } from 'vitest';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { createNpc } from '../../../src/engine/world/npc-state';
import { firstTravellerOnTheWay, ROUTE_STOP } from '../../../src/engine/world/places-on-the-way';

function crossing(firstDays: number, lastDays: number, departure: number, otherDeparture: number) {
    const from = makeLocation({ id: 'cross-from', name: 'First ground', kind: 'settlement' });
    const middle = makeLocation({ id: 'cross-middle', name: 'The actual waypoint', kind: 'wilds', tags: [ROUTE_STOP] });
    const to = makeLocation({ id: 'cross-to', name: 'Last ground', kind: 'settlement' });
    linkLocations(from, middle, 'road', firstDays);
    linkLocations(middle, to, 'road', lastDays);
    const other = createNpc('actual-dated-crossing', { id: 'other-real-traveller', locationId: from.id,
        onDay: otherDeparture, bornOnDay: otherDeparture - 25 * 365 });
    other.activity = { kind: 'travelling', sinceDay: otherDeparture, untilDay: otherDeparture + firstDays + lastDays,
        fromLocationId: to.id, returnTo: from.id, withIds: [], note: 'Walking the actual road.' };
    return { from, middle, to, other, departure, locations: [from, middle, to] };
}

it('finds a fractional crossing on the actual original course inside a shorter requested window', () => {
    const h = crossing(1, 3, 1000, 998);
    const found = firstTravellerOnTheWay({ locations: h.locations, npcs: [h.other],
        fromId: h.from.id, toId: h.to.id, onDay: 1000.5, days: .75,
        journey: { sinceDay: 1000, untilDay: 1004 } });
    expect(found?.npc.id).toBe(h.other.id);
    expect(found?.place.id).toBe(h.middle.id);
    expect(found?.afterDays).toBeCloseTo(.5);
    expect(firstTravellerOnTheWay({ locations: h.locations, npcs: [h.other],
        fromId: h.from.id, toId: h.to.id, onDay: 1001.5, days: .5,
        journey: { sinceDay: 1000, untilDay: 1004 } })).toBeNull();
});

it('finds a real tenth-day crossing without rounding it out of the span', () => {
    const h = crossing(.1, .1, 1000, 1000);
    const found = firstTravellerOnTheWay({ locations: h.locations, npcs: [h.other],
        fromId: h.from.id, toId: h.to.id, onDay: 1000, days: .2 });
    expect(found?.npc.id).toBe(h.other.id);
    expect(found?.afterDays).toBeCloseTo(.1);
});
