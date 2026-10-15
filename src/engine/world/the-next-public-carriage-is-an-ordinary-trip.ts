import { tradeOwnedItemsAtAMeeting } from './a-person-is-offered-a-price-for-what-they-hold.js';
/** Public counter promises are ordinary appointments on one real carriage. */
import { makeScheduledEffect, type ScheduledEffect, type WorldState } from './world-state.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { publicTransportFrom } from './public-transport-at-a-place.js';
import { routineTime } from './npc-routines.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { isRuined, type ObjectRecord } from './possessions.js';
import { whoItIsWith } from './a-vehicle.js';
import { carriageIdForRoad, publicCarriageGround, publicCarriageRoadTerms,
    quotePublicCarriage, commitPublicCarriage, realiseAcceptedPublicCarriageSource,
    type PublicRoadQuote } from './public-carriages.js';
import { passageDepartureKey, passageTalliesForDeparture, passageTallyTerms,
    theHeldPassageTally, unusedPassageTalliesGoToDust, type TallyDeparture } from './a-passage-tally-is-the-seat-you-own.js';
import { stonesFor } from './the-fare-and-calendar-of-a-passage.js';
import { readActualDepartureApproach } from './departure-approach.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { companyAgreement } from './company-during-a-passage.js';
import { PLAYER_ROW_TAG, type NpcRecord } from './npc-state.js';

const CARRIAGE = 'conv-carriage-mortal';

export interface PublicCarriageDeparture {
    effect: ScheduledEffect;
    terms: TallyDeparture;
    operatorId: string;
    conveyanceId: string;
    arrivalDay: number;
    fareStones: number;
}

export function carriageDepartureIn(effect: ScheduledEffect): PublicCarriageDeparture | null {
    const d = effect.data;
    if (d.publicCarrierDeparture !== true || d.service !== 'carriage'
        || typeof d.vesselId !== 'string' || typeof d.operatorId !== 'string'
        || typeof d.fromLocationId !== 'string' || typeof d.toLocationId !== 'string'
        || typeof d.arrivalDay !== 'number' || typeof d.fareStones !== 'number'
        || typeof d.conveyanceId !== 'string') return null;
    return { effect, operatorId: d.operatorId, conveyanceId: d.conveyanceId,
        arrivalDay: d.arrivalDay, fareStones: d.fareStones,
        terms: { service: 'carriage', vesselId: d.vesselId, fromId: d.fromLocationId,
            toId: d.toLocationId, departureDay: effect.dueOnDay } };
}

function completed(world: WorldState, id: string): boolean {
    return factsWithDataValue(world, 'publicDepartureCompleted', id).length > 0;
}

export function publicCarriageDepartures(world: WorldState, vesselId?: string): PublicCarriageDeparture[] {
    return world.schedule.flatMap(effect => {
        if (effect.data.publicCarrierDeparture !== true) return [];
        const departure = carriageDepartureIn(effect);
        return departure && (!vesselId || departure.terms.vesselId === vesselId)
            && !completed(world, effect.id) ? [departure] : [];
    }).sort((a, b) => a.terms.departureDay - b.terms.departureDay);
}

function boardings(world: WorldState, departureId: string): readonly HistoricalFact[] {
    return factsWithDataValue(world, 'publicDepartureId', departureId)
        .filter(fact => fact.data.publicPassage === true && fact.data.service === 'carriage');
}

export function freePublicCarriageSeats(world: WorldState, departure: PublicCarriageDeparture): number[] {
    const road = publicCarriageRoadTerms(world, departure.terms.fromId, departure.terms.toId, departure.conveyanceId);
    if (!road) return [];
    const used = new Set(passageTalliesForDeparture(world, departure.terms)
        .map(tally => passageTallyTerms(tally)!.seat));
    for (const receipt of boardings(world, departure.effect.id)) {
        if (typeof receipt.data.passageTallySeats !== 'string') continue;
        const rows: unknown = JSON.parse(receipt.data.passageTallySeats);
        if (Array.isArray(rows)) for (const row of rows) if (typeof row?.seat === 'number') used.add(row.seat);
    }
    return Array.from({ length: road.conveyance.heads - 1 }, (_, at) => at + 1).filter(seat => !used.has(seat));
}

export interface PublicCarriageOffer {
    departure: PublicCarriageDeparture;
    newAppointments: ScheduledEffect[];
    sourceQuote: PublicRoadQuote | null;
    fullDepartureDay: number | null;
    seat: number;
}

/** A quote promises future work; only boarding reads the real body at that time. */
export function offerTheNextPublicCarriage(world: WorldState, fromId: string, toId: string,
    buyerId: string, playedPassenger?: PublicRoadQuote['playedPassenger']): PublicCarriageOffer | null {
    const now = routineTime(world), from = world.locations.find(place => place.id === fromId),
        to = world.locations.find(place => place.id === toId);
    if (!from || !to) return null;
    const line = publicTransportFrom(world, from.name, Math.floor(now)).find(line => line.service === 'carriage' && line.to === to.name);
    const road = publicCarriageRoadTerms(world, fromId, toId, CARRIAGE);
    if (!line || !road) return null;
    const vesselId = carriageIdForRoad(fromId, toId, CARRIAGE);
    const vehicle = world.objects.find(object => object.id === vesselId);
    const owner = vehicle ? world.npcs.find(person => person.id === vehicle.ownerId && person.status === 'alive') : undefined;
    if (vehicle && (isRuined(vehicle) || !owner || whoItIsWith(vehicle) !== owner.id)) return null;
    const sourceQuote = vehicle ? null : quotePublicCarriage(world, { fromId, toId, day: now,
        conveyanceId: CARRIAGE, passengerIds: [buyerId], fareStones: stonesFor(line.cashPerSeat),
        hired: false, playedPassenger });
    if (!vehicle && !sourceQuote) return null;
    const operatorId = owner?.id ?? sourceQuote!.driverId;
    const jobs = publicCarriageDepartures(world, vesselId);
    let fullDepartureDay: number | null = null;
    for (const departure of jobs) {
        if (departure.terms.fromId !== fromId || departure.terms.toId !== toId) continue;
        const free = freePublicCarriageSeats(world, departure);
        if (free.length) return { departure, newAppointments: [], sourceQuote, fullDepartureDay, seat: free[0]! };
        fullDepartureDay ??= departure.terms.departureDay;
    }
    let ready = now, position = vehicle ? publicCarriageGround(world, vehicle, now) : fromId;
    const actual = owner?.activity;
    if (actual?.kind === 'travelling' && actual.vesselId === vesselId && actual.untilDay != null && actual.untilDay > now) {
        ready = actual.untilDay; position = actual.returnTo ?? null;
    }
    const last = jobs.at(-1);
    if (last) { ready = Math.max(ready, last.arrivalDay); position = last.terms.toId; }
    if (position !== fromId && position !== toId) return null;
    const additions: ScheduledEffect[] = [];
    const propose = (originId: string, destinationId: string, leaves: number): PublicCarriageDeparture | null => {
        const origin = world.locations.find(place => place.id === originId)!, destination = world.locations.find(place => place.id === destinationId)!;
        const terms = publicCarriageRoadTerms(world, originId, destinationId, CARRIAGE);
        const offered = publicTransportFrom(world, origin.name, Math.floor(leaves))
            .find(line => line.service === 'carriage' && line.to === destination.name);
        if (!terms || !offered) return null;
        const departure: TallyDeparture = { service: 'carriage', vesselId, fromId: originId, toId: destinationId, departureDay: leaves };
        const effect = makeScheduledEffect({ id: 'public-departure:' + passageDepartureKey(departure),
            kind: 'meeting', dueOnDay: leaves, locationId: originId, actorIds: [operatorId, buyerId],
            summary: 'The accepted public carriage departure falls due.',
            data: { publicCarrierDeparture: true, service: 'carriage', vesselId, operatorId,
                fromLocationId: originId, toLocationId: destinationId,
                conveyanceId: CARRIAGE, arrivalDay: leaves + terms.days, fareStones: stonesFor(offered.cashPerSeat) } });
        additions.push(effect);
        return carriageDepartureIn(effect)!;
    };
    // The usual gathering walk is also the loading window for this ordinary run.
    if (position !== fromId) {
        const back = propose(position!, fromId, ready + LOCAL_WALK_DAYS);
        if (!back) return null;
        ready = back.arrivalDay;
    }
    const departure = propose(fromId, toId, ready + LOCAL_WALK_DAYS);
    return departure ? { departure, newAppointments: additions, sourceQuote, fullDepartureDay, seat: 1 } : null;
}

/** Acceptance publishes the ordinary appointments; it changes no passenger's place. */
export function acceptPublicCarriageOffer(world: WorldState, offer: PublicCarriageOffer): NpcRecord | null {
    const source = offer.sourceQuote ? realiseAcceptedPublicCarriageSource(world, offer.sourceQuote) : null;
    const driver = source?.driver ?? world.npcs.find(person => person.id === offer.departure.operatorId && person.status === 'alive');
    if (!driver) return null;
    for (const effect of offer.newAppointments) if (!world.schedule.some(old => old.id === effect.id)) world.schedule.push(effect);
    const next = publicCarriageDepartures(world, offer.departure.terms.vesselId)[0];
    if (next) {
        const at = world.npcs.findIndex(person => person.id === driver.id);
        const activity = driver.activity ?? { kind: 'idle' as const, note: 'At the carriage station.', withIds: [], sinceDay: routineTime(world), untilDay: null };
        world.npcs[at] = { ...driver, activity: { ...activity, publicDepartureId: next.effect.id } };
        if (activity.kind !== 'travelling' && next.terms.departureDay - routineTime(world) <= LOCAL_WALK_DAYS) {
            const station = theAreasOf(world, world.locations.find(place => place.id === next.terms.fromId)!).areas
                .find(area => area.for === 'carriage_station');
            world.npcs[at]!.activity = { ...world.npcs[at]!.activity!, kind: 'trade',
                note: 'Receiving passengers before the carriage departure.', sinceDay: routineTime(world),
                untilDay: next.terms.departureDay, standingIn: station?.id ?? null };
        }
    }
    return world.npcs.find(person => person.id === driver.id)!;
}

export function waitForThePublicCarriage(world: WorldState, person: NpcRecord, tally: ObjectRecord): void {
    if (person.tags.includes(PLAYER_ROW_TAG)) return;
    const terms = passageTallyTerms(tally)!;
    const at = world.npcs.findIndex(candidate => candidate.id === person.id);
    const company = companyAgreement(person.activity, routineTime(world));
    world.npcs[at] = { ...person, activity: { kind: 'waiting_for_a_departure',
        note: 'Waiting to use the bought passage tally.',
        withIds: company?.withIds ?? [], sinceDay: routineTime(world), untilDay: terms.departureDay,
        returnTo: terms.toId, passageTallyId: tally.id,
        publicDepartureId: 'public-departure:' + passageDepartureKey(terms), standingIn: person.activity?.standingIn,
        ...(person.activity?.capitalMissionId ? { capitalMissionId: person.activity.capitalMissionId,
            capitalMissionLeg: person.activity.capitalMissionLeg, capitalMissionWaiting: person.activity.capitalMissionWaiting } : {}),
        ...(company ? { passageCompany: company } : {}) } };
}

export function quoteBoardingThePublicCarriage(world: WorldState, departure: PublicCarriageDeparture,
    ids: readonly string[], playedPassenger?: PublicRoadQuote['playedPassenger']): PublicRoadQuote | null {
    const day = Math.max(routineTime(world), departure.terms.departureDay);
    return quotePublicCarriage(world, { fromId: departure.terms.fromId, toId: departure.terms.toId,
        day, conveyanceId: departure.conveyanceId, passengerIds: ids, fareStones: 0, hired: false,
        actualVesselId: departure.terms.vesselId, publicDepartureId: departure.effect.id,
        tallyDepartureDay: departure.terms.departureDay, playedPassenger });
}

/** One event per bought run; there is no daily or indefinitely repeating loop. */
export function settleDuePublicCarriages(world: WorldState, day = routineTime(world)): void {
    for (const departure of publicCarriageDepartures(world)) {
        if (departure.terms.departureDay > day) continue;
        const driver = world.npcs.find(person => person.id === departure.operatorId && person.status === 'alive');
        const hull = world.objects.find(object => object.id === departure.terms.vesselId);
        if (!driver || !hull || isRuined(hull) || hull.ownerId !== driver.id || whoItIsWith(hull) !== driver.id) continue;
        const existing = boardings(world, departure.effect.id);
        let receipt = existing.find(fact => fact.actors.some(actor => actor.role === 'passenger'));
        const station = theAreasOf(world, world.locations.find(place => place.id === departure.terms.fromId)!).areas
            .find(area => area.for === 'carriage_station');
        const atCounter = world.npcs.filter(person => person.status === 'alive' && !person.tags.includes(PLAYER_ROW_TAG)
            && readActualDepartureApproach(world, person.id,
                { intentId: departure.effect.id, target: { locationId: departure.terms.fromId, areaId: station?.id ?? null } }, day).kind === 'ready');
        tradeOwnedItemsAtAMeeting(world, atCounter.map(person => person.id), departure.terms.fromId, day);
        const passengers = atCounter.filter(person => theHeldPassageTally(world, person.id, departure.terms)
            && readActualDepartureApproach(world, person.id,
                { intentId: departure.effect.id, target: { locationId: departure.terms.fromId, areaId: station?.id ?? null } }, day).kind === 'ready');
        if (passengers.length || !receipt) {
            const quote = quoteBoardingThePublicCarriage(world, departure, passengers.map(person => person.id));
            if (!quote) continue;
            receipt = commitPublicCarriage(world, quote) ?? undefined;
            if (!receipt) continue;
        } else {
            if (driver.activity?.publicDepartureId !== departure.effect.id
                || driver.activity.kind !== 'travelling' || driver.activity.sinceDay > day) continue;
            unusedPassageTalliesGoToDust(world, departure.terms, departure.terms.departureDay);
        }
        const at = world.npcs.findIndex(person => person.id === driver.id);
        const current = world.npcs[at]!;
        if (current.activity) world.npcs[at] = { ...current, activity: { ...current.activity,
            note: 'Driving the carriage on its scheduled public road passage.', publicDepartureId: undefined } };
        appendWorldFact(world, makeFact({ day: Math.max(departure.terms.departureDay, Number(receipt.data.departureDay)),
            kind: 'gathering', visibility: 'public', locationId: departure.terms.fromId,
            actors: [{ id: driver.id, name: driver.name, role: 'driver' }], causes: [receipt.id],
            summary: 'The carriage left for its accepted public destination.',
            data: { publicCarrierDeparture: true, publicDepartureCompleted: departure.effect.id,
                boardingReceiptId: receipt.id } }), { recur: false });
        // The completed appointment leaves the ordinary queue. Its actual
        // departure is already a fact; forgotten paperwork cannot replay it.
        world.schedule = world.schedule.filter(effect => effect.id !== departure.effect.id);
        const next = publicCarriageDepartures(world, departure.terms.vesselId)[0];
        if (next && world.npcs[at]!.activity) world.npcs[at]!.activity!.publicDepartureId = next.effect.id;
        for (let personAt = 0; personAt < world.npcs.length; personAt++) {
            const person = world.npcs[personAt]!;
            if (person.activity?.kind !== 'waiting_for_a_departure' || person.activity.publicDepartureId !== departure.effect.id) continue;
            world.npcs[personAt] = { ...person, activity: companyAgreement(person.activity, day) };
        }
    }
}
