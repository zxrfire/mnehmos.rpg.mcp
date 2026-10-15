/** Buying a later road seat keeps its tally; boarding is a separate real act. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import { actualSpiritStones, transferActualSpiritStones } from './transferring-actual-spirit-stones.js';
import { offerTheNextPublicCarriage, acceptPublicCarriageOffer, carriageDepartureIn,
    publicCarriageDepartures, quoteBoardingThePublicCarriage, waitForThePublicCarriage,
    type PublicCarriageOffer } from '../engine/world/the-next-public-carriage-is-an-ordinary-trip.js';
import { makePassageTally, passageTallyTerms, theHeldPassageTally, whatStopsHandingInPassageTally }
    from '../engine/world/a-passage-tally-is-the-seat-you-own.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { routineTime, hourOnTheClock } from '../engine/world/npc-routines.js';
import { commitPublicCarriage, carriageIdForRoad, assessPublicCarriage } from '../engine/world/public-carriages.js';
import { worldLocationFor } from './entities.js';
import { locationOfNpcOnItsJourney } from '../engine/world/places-on-the-way.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { keepThePaidCarriage } from './a-paid-carriage-on-the-road.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import { readActualDepartureApproach } from '../engine/world/departure-approach.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';

function when(departureDay: number): string {
    return 'day ' + Math.floor(departureDay) + ' at ' + hourOnTheClock((departureDay % 1) * 24);
}

/** Reading the advertised next load neither publishes a job nor makes a tally. */
export function publicCarriageDepartureNotice(game: GameService, body: Cultivator, destination: string): string[] {
    const world = game.atHand, from = world && worldLocationFor(world, body.location),
        to = world && worldLocationFor(world, destination);
    const offer = world && from && to && offerTheNextPublicCarriage(world, from.id, to.id, body.id,
        { id: body.id, locationId: from.id, alive: body.alive });
    if (!offer) return [];
    return [...(offer.fullDepartureDay === null ? []
        : [`The departure on ${when(offer.fullDepartureDay)} has no passenger seat.`]),
        `The next carriage to ${destination} leaves on ${when(offer.departure.terms.departureDay)}; a passage tally costs ${offer.departure.fareStones} spirit stones.`];
}

/** The buyer and payer can differ for a real companion standing at the counter. */
export function buyPublicCarriageTally(game: GameService, fromId: string, toId: string,
    buyer: { id: string; name: string; location?: string | null; alive?: boolean; standingIn?: string | null }, payer = buyer,
    keeperId?: string):
    { ok: true; tally: ObjectRecord; offer: PublicCarriageOffer } | { ok: false; reason: string } {
    const world = game.atHand;
    if (!world) return { ok: false, reason: 'There is no actual public carriage here.' };
    const stored = game.repos.cultivators.getById(buyer.id), person = world.npcs.find(person => person.id === buyer.id);
    const placeId = buyer.location !== undefined ? worldLocationFor(world, buyer.location)?.id
        : stored ? worldLocationFor(world, stored.location)?.id : person ? locationOfNpcOnItsJourney(world, person, routineTime(world)) : null;
    const alive = buyer.alive ?? stored?.alive ?? (person?.status === 'alive');
    if (placeId !== fromId || !alive)
        return { ok: false, reason: 'The buyer is not alive at this actual departure counter.' };
    const station = theAreasOf(world, world.locations.find(place => place.id === fromId)!).areas.find(area => area.for === 'carriage_station');
    const atStation = person && !stored ? readActualDepartureApproach(world, person.id,
        { intentId: 'public-tally-counter', target: { locationId: fromId, areaId: station?.id ?? null } },
        routineTime(world)).kind === 'ready'
        : !station || (buyer.standingIn !== undefined ? buyer.standingIn : stored?.standingIn) === station.id;
    if (!atStation) return { ok: false, reason: 'The buyer has not reached the actual carriage station.' };
    const offer = offerTheNextPublicCarriage(world, fromId, toId, buyer.id,
        stored ? { id: stored.id, locationId: fromId, alive } : undefined);
    if (!offer) return { ok: false, reason: 'No actual driver and carriage offer that road departure.' };
    if (buyer.id === offer.departure.operatorId) return { ok: false, reason: 'The driver already works the carriage; that is not a passenger seat.' };
    if (!offer.sourceQuote) {
        const owner = world.npcs.find(person => person.id === offer.departure.operatorId)!;
        const atCounter = (person: typeof owner) => person.status === 'alive'
            && locationOfNpcOnItsJourney(world, person, routineTime(world)) === fromId
            && !(person.activity?.kind === 'travelling' && person.activity.sinceDay < routineTime(world)
                && person.activity.untilDay != null && person.activity.untilDay > routineTime(world));
        const keeper = keeperId && world.npcs.find(person => person.id === keeperId);
        if (!atCounter(owner) && (!keeper || !atCounter(keeper))) return { ok: false,
            reason: 'There is nobody at this counter to sell the actual carriage departure.' };
    }
    const purse = actualSpiritStones(game, payer.id) ?? 0;
    if (purse < offer.departure.fareStones) return { ok: false,
        reason: `The departure on ${when(offer.departure.terms.departureDay)} costs ${offer.departure.fareStones} spirit stones; the payer has ${purse}.` };
    const driver = acceptPublicCarriageOffer(world, offer);
    if (!driver) return { ok: false, reason: 'The actual driver is no longer available.' };
    let tally: ObjectRecord | null = null;
    const paid = transferActualSpiritStones(game, payer.id, driver.id, offer.departure.fareStones, () => {
        const t = offer.departure.terms;
        const purchase = appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'gathering', visibility: 'secret',
            locationId: fromId, witnessIds: game.worldPlaceOf(game.currentRun().cultivator) === fromId
                && game.currentRun().cultivator.standingIn === station?.id
                ? [game.currentRun().cultivator.id, ...game.present(game.currentRun().cultivator).map(person => person.id)] : [],
            actors: [{ ...buyer, role: 'buyer' }, { ...payer, role: 'payer' },
                { id: driver.id, name: driver.name, role: 'carrier' }],
            summary: 'A passage tally was bought for its named public carriage departure.',
            data: { passageTallyPurchase: true, publicDepartureId: offer.departure.effect.id,
                service: t.service, vesselId: t.vesselId, fromLocationId: t.fromId, toLocationId: t.toId,
                departureDay: t.departureDay, seat: offer.seat, fareStones: offer.departure.fareStones,
                stones: buyer.id === payer.id ? offer.departure.fareStones : 0, payerId: payer.id, receiverId: driver.id } }),
            { bystanders: false, recur: false });
        tally = makePassageTally({ terms: { ...t, seat: offer.seat, fareStones: offer.departure.fareStones },
            buyer, purchase, onDay: routineTime(world),
            fromName: world.locations.find(place => place.id === fromId)!.name,
            toName: world.locations.find(place => place.id === toId)!.name });
        world.objects.push(tally);
        if (person) waitForThePublicCarriage(world, person, tally);
    });
    if (!paid.ok || !tally) return { ok: false, reason: 'The actual purses no longer cover this passage tally.' };
    game.theWorldMoved();
    return { ok: true, tally, offer };
}

export async function publicCarriageTalliesAtCounter(game: GameService, run: Run, body: Cultivator,
    toName: string, intent: string, said: string, keeperId: string | undefined,
    boardingAdmission: (purchases?: readonly string[]) => Execution | null): Promise<Execution | null> {
    const world = game.atHand, from = world && worldLocationFor(world, body.location), to = world && worldLocationFor(world, toName);
    if (!world || !from || !to) return null;
    const vesselId = carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal');
    const soldOut = intent === 'buy' && assessPublicCarriage(world, { fromId: from.id, toId: to.id,
        day: routineTime(world), conveyanceId: 'conv-carriage-mortal', fareStones: 0, hired: false,
        passengerIds: [body.id, ...game.whoIsWithYouOnTheRoad(body).map(person => person.id)],
        playedPassenger: { id: body.id, locationId: from.id, alive: body.alive } })
        .refusal?.kind === 'capacity';
    if (intent !== 'ticket' && intent !== 'embark' && !(intent === 'buy'
        && (soldOut || publicCarriageDepartures(world, vesselId).length))) return null;
    let tally = world.objects.filter(object => object.possessorId === body.id)
        .map(object => ({ object, terms: passageTallyTerms(object) }))
        .filter(row => row.terms?.service === 'carriage' && row.terms.fromId === from.id && row.terms.toId === to.id)
        .sort((a, b) => a.terms!.departureDay - b.terms!.departureDay)[0]?.object;
    const bought: string[] = [];
    if (intent === 'embark' || (intent !== 'ticket' && tally)) {
        const refusal = boardingAdmission();
        if (refusal) return refusal;
    }
    if (intent === 'ticket' || !tally) {
        const companions = intent !== 'ticket' || /\b(?:tickets|tallies|for us|our)\b/i.test(said)
            ? game.whoIsWithYouOnTheRoad(body).map(person => ({ id: person.id, name: person.name })) : [];
        const people = [body, ...companions];
        const offer = offerTheNextPublicCarriage(world, from.id, to.id, body.id,
            { id: body.id, locationId: from.id, alive: body.alive });
        if (offer && body.spiritStones < offer.departure.fareStones * people.length) {
            const price = offer.departure.fareStones * people.length;
            return refused('engine.publicCarriageTallyPurchase', 'passage', factsForRefusal(
                'The payer cannot buy all the requested passage tallies.',
                `${howMany(people.length, 'passage tally')} ${people.length === 1 ? 'costs' : 'cost'} ${price} spirit stones; the payer has ${body.spiritStones}. Nothing spent.`,
                'No passage tally was bought and no departure appointment was accepted.'));
        }
        for (const person of people) {
            const result = buyPublicCarriageTally(game, from.id, to.id, person, body, keeperId);
            if (!result.ok) return game.freeAction(run, 'passage', factsForToolResult(result.reason,
                [...bought, result.reason, 'No body was boarded by buying a passage tally.']));
            if (person.id === body.id) tally = result.tally;
            if (result.offer.fullDepartureDay !== null) bought.push(`The departure on ${when(result.offer.fullDepartureDay)} has no passenger seat.`);
            bought.push(`${result.tally.name}: ${result.offer.departure.fareStones} spirit stones paid.`);
        }
    }
    if (!tally) return null;
    if (intent === 'ticket') return game.freeAction(run, 'passage', factsForToolResult('The bought passage tally is in your pack.', bought));
    const terms = passageTallyTerms(tally)!;
    const effect = world.schedule.find(effect => effect.id === 'public-departure:' + JSON.stringify([
        terms.service, terms.vesselId, terms.fromId, terms.toId, terms.departureDay]));
    const departure = effect && carriageDepartureIn(effect);
    if (!departure) return null;
    const stops = whatStopsHandingInPassageTally(world, body.id, terms, departure.operatorId);
    if (stops) return game.freeAction(run, 'passage', factsForToolResult(stops,
        [...bought, stops, `Your passage tally names departure on ${when(terms.departureDay)}.`]));
    const companions = game.whoIsWithYouOnTheRoad(body).filter(person => theHeldPassageTally(world, person.id, terms));
    const ids = [body.id, ...companions.map(person => person.id)];
    const quote = quoteBoardingThePublicCarriage(world, departure, ids,
        { id: body.id, locationId: from.id, alive: body.alive });
    if (!quote) return game.freeAction(run, 'passage', factsForToolResult('This departure cannot board here yet.',
        [...bought, 'The actual carriage or its driver cannot receive this departure here now.',
            `The tally remains yours for departure on ${when(terms.departureDay)}.`]));
    const refusal = boardingAdmission(bought);
    if (refusal) return refusal;
    const receipt = commitPublicCarriage(world, quote, { runId: run.id, elapsedDays: run.elapsedDays });
    if (!receipt) return refused('engine.publicCarriageTallyBoarding', 'passage', factsForRefusal(
        'The actual carriage cannot receive this boarding.', 'Your tally was not handed in.', 'The source changed before native boarding.'));
    keepThePaidCarriage(game.db, body.id, receipt.id);
    game.theWorldMoved();
    return game.takeTheSeat(run, game.repos.cultivators.getById(body.id) ?? body, {
        service: 'carriage', to: to.name, days: quote.arrivalDay - routineTime(world), walkingDays: quote.walkingDays,
        stones: 0, escort: 0, roadReceiptId: receipt.id, departureOccasion: true,
        bought: 'The paid passage tally was handed to the actual driver for boarding.' });
}
