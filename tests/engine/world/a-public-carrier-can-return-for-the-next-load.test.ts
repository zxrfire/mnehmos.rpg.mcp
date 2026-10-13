/**
 * A route's next load needs the same actual carrier to return. Inspection
 * found that a public carriage could take another passenger back, but could
 * not make the same ordinary leg empty. Earlier passengers also retained a
 * live dependency on the driver's old course: after a third trip their
 * location became unknown even though they had already disembarked.
 * Each departure below uses native quotes and commits, actual elapsed travel
 * and the same vehicle and driver. No purchased seat recalls either body.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state';
import { createNpc } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { quotePublicCarriage, commitPublicCarriage, publicCarriageGround }
    from '../../../src/engine/world/public-carriages';
import { locationOfNpcOnItsJourney } from '../../../src/engine/world/places-on-the-way';
import { routineTime } from '../../../src/engine/world/npc-routines';

function arrangement() {
    const world = createWorld({ seed: 'public-carrier-next-load', regionCount: 0, skipPriorAges: true });
    world.currentDay = 100; world.currentHour = 0;
    const from = makeLocation({ id: 'departure', name: 'Reed Station', kind: 'settlement' });
    const to = makeLocation({ id: 'destination', name: 'Stone Station', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    world.locations = [from, to];
    const first = createNpc(world.seed, { id: 'first', locationId: from.id, onDay: 100, bornOnDay: 0 });
    const second = createNpc(world.seed, { id: 'second', locationId: to.id, onDay: 100, bornOnDay: 0 });
    const third = createNpc(world.seed, { id: 'third', locationId: from.id, onDay: 100, bornOnDay: 0 });
    world.npcs.push(first, second, third);
    const outward = { fromId: from.id, toId: to.id, day: routineTime(world),
        conveyanceId: 'conv-carriage-mortal', passengerIds: [first.id], fareStones: 3, hired: false };
    const quote = quotePublicCarriage(world, outward)!;
    expect(quote).not.toBeNull();
    const receipt = commitPublicCarriage(world, quote)!;
    expect(receipt).not.toBeNull();
    return { world, from, to, first, second, third, outward, quote };
}

describe('the actual public carrier can bring its next load', () => {
    it('leaves a disembarked passenger at their landfall while the driver works later legs', () => {
        const h = arrangement();
        h.world.currentDay = h.quote.arrivalDay;
        const back = quotePublicCarriage(h.world, { ...h.outward, fromId: h.to.id, toId: h.from.id,
            day: routineTime(h.world), passengerIds: [h.second.id] })!;
        expect(commitPublicCarriage(h.world, back)).not.toBeNull();
        h.world.currentDay = back.arrivalDay;
        const next = quotePublicCarriage(h.world, { ...h.outward,
            day: routineTime(h.world), passengerIds: [h.third.id] })!;
        expect(commitPublicCarriage(h.world, next)).not.toBeNull();
        expect(next.driverId).toBe(h.quote.driverId);
        expect(next.vesselId).toBe(h.quote.vesselId);
        expect(locationOfNpcOnItsJourney(h.world, h.world.npcs.find(person => person.id === h.first.id)!,
            routineTime(h.world))).toBe(h.to.id);
        expect(locationOfNpcOnItsJourney(h.world, h.world.npcs.find(person => person.id === h.second.id)!,
            routineTime(h.world))).toBe(h.from.id);
        expect(h.world.npcs.find(person => person.id === h.quote.driverId)!.activity!.withIds)
            .not.toContain(h.first.id);
    });

    it('makes an ordinary empty return on its actual hull before carrying another load', () => {
        const h = arrangement();
        h.world.currentDay = h.quote.arrivalDay;
        const back = quotePublicCarriage(h.world, { ...h.outward, fromId: h.to.id, toId: h.from.id,
            day: routineTime(h.world), passengerIds: [], fareStones: 0, actualVesselId: h.quote.vesselId });
        expect(back).not.toBeNull();
        expect(back!.driverId).toBe(h.quote.driverId);
        expect(back!.arrivalDay - back!.departureDay).toBeCloseTo(h.quote.arrivalDay - h.quote.departureDay);
        expect(commitPublicCarriage(h.world, back!)).not.toBeNull();
        const vessel = h.world.objects.find(object => object.id === h.quote.vesselId)!;
        expect(publicCarriageGround(h.world, vessel, back!.departureDay)).toBe(h.to.id);
        expect(publicCarriageGround(h.world, vessel, back!.arrivalDay)).toBe(h.from.id);
        h.world.currentDay = back!.arrivalDay;
        const next = quotePublicCarriage(h.world, { ...h.outward,
            day: routineTime(h.world), passengerIds: [h.third.id] })!;
        expect(commitPublicCarriage(h.world, next)).not.toBeNull();
        expect(next.driverId).toBe(h.quote.driverId);
        expect(h.world.objects.filter(object => object.id === h.quote.vesselId)).toHaveLength(1);
        expect(h.world.npcs.find(person => person.id === h.quote.driverId)!.activity!.withIds)
            .toEqual([h.third.id]);
        expect(locationOfNpcOnItsJourney(h.world, h.world.npcs.find(person => person.id === h.first.id)!,
            routineTime(h.world))).toBe(h.to.id);
    });

    it('cannot mint an empty paid service or move a hull before it has actually returned', () => {
        const h = arrangement();
        const empty = { ...h.outward, passengerIds: [], fareStones: 0 };
        expect(quotePublicCarriage(h.world, empty)).toBeNull();
        expect(quotePublicCarriage(h.world, { ...empty, actualVesselId: 'not-a-real-hull' })).toBeNull();
        h.world.currentDay = h.quote.arrivalDay;
        expect(quotePublicCarriage(h.world, { ...empty, day: routineTime(h.world),
            actualVesselId: h.quote.vesselId })).toBeNull();
        const back = { ...empty, fromId: h.to.id, toId: h.from.id, day: routineTime(h.world),
            actualVesselId: h.quote.vesselId };
        expect(quotePublicCarriage(h.world, { ...back, fareStones: 3 })).toBeNull();
        expect(quotePublicCarriage(h.world, { ...back, hired: true })).toBeNull();
    });

    it('restores an existing private company when its passenger disembarks', () => {
        const h = arrangement();
        const person = h.world.npcs.find(person => person.id === h.first.id)!;
        const company = { kind: 'out_with_a_party' as const, note: 'Travelling with a friend.',
            withIds: [h.third.id], sinceDay: 90, untilDay: 400 };
        person.activity = { ...person.activity!, passageCompany: company };
        h.world.currentDay = h.quote.arrivalDay;
        const back = quotePublicCarriage(h.world, { ...h.outward, fromId: h.to.id, toId: h.from.id,
            day: routineTime(h.world), passengerIds: [], fareStones: 0, actualVesselId: h.quote.vesselId })!;
        expect(commitPublicCarriage(h.world, back)).not.toBeNull();
        const landed = h.world.npcs.find(person => person.id === h.first.id)!;
        expect(landed.locationId).toBe(h.to.id);
        expect(landed.activity).toEqual(company);
        expect(landed.activity?.withIds).not.toContain(h.quote.driverId);
    });
});
