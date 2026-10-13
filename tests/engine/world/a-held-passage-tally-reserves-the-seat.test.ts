/**
 * Physical tallies already carry their accepted departure and seat, but native
 * public quotes counted only boarded bodies and mission reservations. Three
 * paid carriage tallies could therefore coexist with another available berth.
 * Admission must count unused physical seats, while the current holder uses
 * their own seat rather than taking a fourth. These controls arrange accepted
 * purchase items; they do not claim to exercise advance counter sales.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { makeFact } from '../../../src/engine/world/history';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened';
import { transferPossession } from '../../../src/engine/world/possessions';
import { makePassageTally, unusedPassageTalliesGoToDust, type PassageTallyTerms }
    from '../../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import { aVehicleOf } from '../../../src/engine/world/a-vehicle';
import { carriageIdForRoad, assessPublicCarriage, commitPublicCarriage } from '../../../src/engine/world/public-carriages';
import { publicShipLinesFrom, quotePublicPassage } from '../../../src/engine/world/public-shipping';
import { shipHandsForHull } from '../../../src/engine/world/a-public-ship-hull';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import { routineTime } from '../../../src/engine/world/npc-routines';

function issue(world: WorldState, buyer: NpcRecord, terms: PassageTallyTerms) {
    const purchase = appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'gathering',
        visibility: 'secret', summary: 'An accepted passage tally purchase.',
        actors: [{ id: buyer.id, name: buyer.name, role: 'buyer' }],
        data: { passageTallyPurchase: true, service: terms.service, vesselId: terms.vesselId,
            fromLocationId: terms.fromId, toLocationId: terms.toId,
            departureDay: terms.departureDay, seat: terms.seat, fareStones: terms.fareStones } }),
        { recur: false, bystanders: false });
    const tally = makePassageTally({ terms, buyer, onDay: routineTime(world), purchase,
        fromName: world.locations.find(place => place.id === terms.fromId)!.name,
        toName: world.locations.find(place => place.id === terms.toId)!.name });
    world.objects.push(tally);
    return tally;
}

function carriage() {
    const world = createWorld({ seed: 'held-public-berths', regionCount: 0, skipPriorAges: true });
    world.currentDay = 10; world.currentHour = 0;
    const from = makeLocation({ id: 'from', name: 'Reed Station', kind: 'settlement' });
    const to = makeLocation({ id: 'to', name: 'Stone Station', kind: 'settlement' });
    linkLocations(from, to, 'road', 3); world.locations = [from, to];
    const driver = createNpc(world.seed, { id: 'driver', locationId: from.id,
        onDay: 10, bornOnDay: -7300, occupation: 'carter' });
    const passengers = Array.from({ length: 4 }, (_, at) => createNpc(world.seed,
        { id: 'passenger-' + at, locationId: from.id, onDay: 10, bornOnDay: -7300 }));
    world.npcs.push(driver, ...passengers);
    const vesselId = carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal');
    const vehicle = aVehicleOf({ id: vesselId, conveyanceId: 'conv-carriage-mortal',
        ownerId: driver.id, ownerName: driver.name, at: from.id });
    vehicle.tags.push('public-road-service'); world.objects.push(vehicle);
    const quote = (ids: string[], day = routineTime(world)) => assessPublicCarriage(world,
        { fromId: from.id, toId: to.id, day, conveyanceId: 'conv-carriage-mortal',
            passengerIds: ids, fareStones: 3, hired: false });
    const terms = { service: 'carriage' as const, vesselId, fromId: from.id, toId: to.id,
        departureDay: routineTime(world), fareStones: 3 };
    const tallies = passengers.slice(0, 3).map((buyer, seat) => issue(world, buyer, { ...terms, seat: seat + 1 }));
    return { world, passengers, tallies, quote, terms };
}

describe('the unused physical tally reserves its actual seat', () => {
    it('counts paid carriage tallies against the same native capacity as boarded people', () => {
        const h = carriage();
        expect(h.quote([h.passengers[3]!.id]).refusal).toEqual({ kind: 'capacity',
            requestedPassengers: 1, remainingPassengers: 0 });
        expect(h.quote([h.passengers[0]!.id]).quote).not.toBeNull();
        expect(h.quote(h.passengers.slice(0, 3).map(person => person.id)).quote).not.toBeNull();
        expect(h.quote([h.passengers[3]!.id], h.terms.departureDay + 1).quote).not.toBeNull();
    });

    it('the current recipient uses the seat after an ordinary transfer; the former holder cannot', () => {
        const h = carriage();
        const at = h.world.objects.indexOf(h.tallies[0]!);
        h.world.objects[at] = transferPossession(h.tallies[0]!, { onDay: routineTime(h.world),
            toHolderId: h.passengers[3]!.id, toHolderName: h.passengers[3]!.name,
            how: 'gifted', transfersOwnership: true });
        expect(h.quote([h.passengers[3]!.id]).quote).not.toBeNull();
        expect(h.quote([h.passengers[0]!.id]).refusal?.kind).toBe('capacity');
    });

    it('the physical seat remains valid and lapses at departure after its purchase paperwork is gone', () => {
        const h = carriage();
        h.world.history.facts = [];
        expect(h.quote([h.passengers[3]!.id]).refusal?.kind).toBe('capacity');
        expect(h.quote([h.passengers[0]!.id]).quote).not.toBeNull();
        expect(unusedPassageTalliesGoToDust(h.world, h.terms, h.terms.departureDay)).toHaveLength(3);
        expect(h.world.objects.some(object => object.tags.includes('passage-tally'))).toBe(false);
    });

    it('a lost seat is still reserved, and holding two tallies does not erase either seat', () => {
        const h = carriage();
        const at = h.world.objects.indexOf(h.tallies[0]!);
        h.world.objects[at] = transferPossession(h.tallies[0]!, { onDay: routineTime(h.world),
            toHolderId: null, toHolderName: 'The station ground', how: 'lost' });
        expect(h.quote([h.passengers[3]!.id]).refusal?.kind).toBe('capacity');
        const second = h.world.objects.indexOf(h.tallies[1]!);
        h.world.objects[second] = transferPossession(h.tallies[1]!, { onDay: routineTime(h.world),
            toHolderId: h.passengers[2]!.id, toHolderName: h.passengers[2]!.name,
            how: 'gifted', transfersOwnership: true });
        expect(h.quote([h.passengers[3]!.id]).refusal?.kind).toBe('capacity');
        expect(h.quote([h.passengers[2]!.id]).quote).not.toBeNull();
    });

    it('unused extra seats lapse without claiming their boarded holder missed the trip', () => {
        const h = carriage();
        const extra = h.tallies[1]!;
        h.world.objects[h.world.objects.indexOf(extra)] = transferPossession(extra,
            { onDay: routineTime(h.world), toHolderId: h.passengers[0]!.id,
                toHolderName: h.passengers[0]!.name, how: 'gifted', transfersOwnership: true });
        expect(commitPublicCarriage(h.world, h.quote([h.passengers[0]!.id]).quote!)).not.toBeNull();
        const unused = h.world.history.facts.find(fact => fact.data.tokenId === extra.id)!;
        expect(unused.data.unusedPassageTally).toBe(true);
        expect(unused.data.missedDeparture).toBe(false);
        expect(unused.actors[0]!.role).toBe('unused tally holder');
        const missed = h.world.history.facts.find(fact => fact.data.tokenId === h.tallies[2]!.id)!;
        expect(missed.data.missedDeparture).toBe(true);
        expect(missed.actors[0]!.id).toBe(h.passengers[2]!.id);
    });

    it('the same physical seats count on a ship, including its actual crew', async () => {
        const world = seedWorld({ seed: 'tally-actual-public-ship', catalog: await loadCultivationCatalog(),
            presentYear: 0 }).state;
        const from = world.locations.find(place => place.name === 'Emerald Water City')!;
        const line = publicShipLinesFrom(world, from.name, world.currentDay).find(line => line.runsFromDay === null)!;
        const to = world.locations.find(place => place.name === line.to)!;
        const day = routineTime(world);
        const first = quotePublicPassage(world, from.id, to.id, day)!;
        expect(first).not.toBeNull();
        const holder = createNpc(world.seed, { id: 'ship-tally-holder', locationId: from.id,
            bornOnDay: day - 7300, onDay: day });
        world.npcs.push(holder);
        const berths = requireConveyance('conv-water-ship').heads - 1 - shipHandsForHull(world.seed, first.vesselId);
        for (let seat = 1; seat <= berths; seat++) issue(world, holder,
            { ...first, service: 'ship', seat, fareStones: first.fareStones });
        expect(quotePublicPassage(world, from.id, to.id, day)).toBeNull();
        expect(quotePublicPassage(world, from.id, to.id, day, 1, [], undefined, [holder.id])).not.toBeNull();
    });
});
