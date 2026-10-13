/** Immediate public boarding buys physical tallies before handing them in. */
import type { GameService } from './turn-engine.js';
import type { HistoricalFact } from '../engine/world/history.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { makePassageTally, theHeldPassageTally, type TallyDeparture } from '../engine/world/a-passage-tally-is-the-seat-you-own.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { locationOfNpcOnItsJourney } from '../engine/world/places-on-the-way.js';
import { payForAcceptedPublicPassage } from './paying-the-actual-public-carrier.js';

export function buyTalliesForActualPublicBoarding(game: GameService, receipt: HistoricalFact,
    payer: { id: string; name: string }, passengers: readonly { id: string; name: string }[],
    stones: number): boolean {
    const world = game.atHand;
    const d = receipt.data;
    if (!world || !passengers.length || new Set(passengers.map(person => person.id)).size !== passengers.length
        || d.publicPassage !== true || typeof d.vesselId !== 'string'
        || typeof d.fromLocationId !== 'string' || typeof d.toLocationId !== 'string'
        || typeof d.departureDay !== 'number' || d.departureDay !== routineTime(world)
        || (d.service !== 'carriage' && d.actualBoarding !== true)
        || !passengers.every(person => receipt.actors.some(actor => actor.id === person.id
            && (actor.role === 'passenger' || actor.role === 'aboard')))) return false;
    const departure: TallyDeparture = { service: d.service === 'carriage' ? 'carriage' : 'ship',
        vesselId: d.vesselId, fromId: d.fromLocationId, toId: d.toLocationId, departureDay: d.departureDay };
    const receiver = world.npcs.find(person => person.status === 'alive'
        && (departure.service === 'carriage' ? person.id === d.driverId
            : person.tags.includes('crew-of:' + departure.vesselId))
        && locationOfNpcOnItsJourney(world, person, departure.departureDay) === departure.fromId);
    if (!receiver || passengers.some(person => person.id === receiver.id)) return false;
    // Hiring the entire carriage does not buy individual public seats.
    if (d.hired === true) return payForAcceptedPublicPassage(game, receipt.id, payer, stones);
    const purchases = factsWithDataValue(world, 'passageTallyPurchase', true);
    const already = purchases.filter(fact => fact.data.boardingReceiptId === receipt.id);
    if (already.length) return payForAcceptedPublicPassage(game, receipt.id, payer, stones)
        && passengers.every(person => theHeldPassageTally(world, person.id, departure)
            || already.some(fact => fact.actors.some(actor => actor.id === person.id && actor.role === 'buyer')));
    const unpaid = passengers.filter(person => !theHeldPassageTally(world, person.id, departure));
    if (!unpaid.length) return stones === 0 && d.fareStones === 0;
    if (!payForAcceptedPublicPassage(game, receipt.id, payer, stones)) return false;
    const from = world.locations.find(place => place.id === departure.fromId);
    const to = world.locations.find(place => place.id === departure.toId);
    if (!from || !to) throw new Error('An accepted public passage has no actual route endpoints.');
    let seat = purchases.reduce((last, fact) => fact.data.service === departure.service
        && fact.data.vesselId === departure.vesselId && fact.data.fromLocationId === departure.fromId
        && fact.data.toLocationId === departure.toId && fact.data.departureDay === departure.departureDay
        && typeof fact.data.seat === 'number' ? Math.max(last, fact.data.seat) : last, 0);
    const fareStones = stones / unpaid.length;
    for (const passenger of unpaid) {
        const terms = { ...departure, seat: ++seat, fareStones };
        const purchase = appendWorldFact(world, makeFact({ day: departure.departureDay, kind: 'gathering',
            locationId: departure.fromId, visibility: 'secret', causes: [receipt.id],
            actors: [{ ...passenger, role: 'buyer' }, { ...payer, role: 'payer' }],
            summary: 'A passage tally was bought for the accepted public seat.',
            data: { passageTallyPurchase: true, boardingReceiptId: receipt.id,
                service: departure.service, vesselId: departure.vesselId,
                fromLocationId: departure.fromId, toLocationId: departure.toId,
                departureDay: departure.departureDay, seat: terms.seat, fareStones,
                payerId: payer.id, stones: passenger.id === payer.id ? fareStones : 0 } }),
            { bystanders: false, recur: false });
        world.objects.push(makePassageTally({ terms, buyer: passenger, fromName: from.name,
            toName: to.name, onDay: departure.departureDay, purchase }));
    }
    world.objects = [...world.objects];
    return true;
}
