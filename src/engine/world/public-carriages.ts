import { companyDuringPassage, companyAfterPassage } from './company-during-a-passage.js';
/** Advertised road passage on one ordinary carriage and its actual driver. */
import { createNpc, setLocation, PLAYER_ROW_TAG, type NpcRecord } from './npc-state.js';
import { aVehicleOf, isWithThem, leaveItHere, whoItIsWith, whereItStands } from './a-vehicle.js';
import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { daysByConveyance } from './what-a-conveyance-does-to-a-journey.js';
import { walkingDaysFrom } from './locations.js';
import { locationOnNpcJourney, journeyNeedsWater, journeyTimeHasReached } from './places-on-the-way.js';
import { isTerminal } from '../cultivation/existence.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { isRuined, type ObjectRecord } from './possessions.js';
import type { PassageRunMoment } from './passage-moment.js';
import type { WorldState } from './world-state.js';
import { routineTime } from './npc-routines.js';

const PUBLIC_ROAD = 'public-road-service';

/** A historical accepted course, not another current position. */
export interface PublicRoadLeg {
    vesselId: string;
    driverId: string;
    fromId: string;
    toId: string;
    departureDay: number;
    arrivalDay: number;
    conveyanceId: string;
}

export interface PublicRoadQuote extends PublicRoadLeg {
    /** Immutable purchase inputs; the station has already quoted this price. */
    fareStones: number;
    passengerIds: readonly string[];
    hired: boolean;
    /** The ordinary road distance, read from the existing graph. */
    walkingDays: number;
    /** Transient SQL-backed played presence at this synchronous acceptance. Never persisted. */
    playedPassenger?: { id: string; locationId: string; alive: boolean };
}

/** Both directions of an advertised line use the same source carriage. */
export function carriageIdForRoad(fromId: string, toId: string, conveyanceId: string): string {
    return `public-carriage:${JSON.stringify([...[fromId, toId].sort(), conveyanceId])}`;
}

function vehicleFor(world: WorldState, id: string): ObjectRecord | undefined {
    return world.objects.find(object => object.id === id && object.tags.includes(PUBLIC_ROAD));
}

/** This object's holder is the only live source of its ground. */
export function publicCarriageGround(world: WorldState, vehicle: ObjectRecord, day: number): string | null {
    const withId = vehicle.possessorId ?? whoItIsWith(vehicle);
    const holder = withId ? world.npcs.find(npc => npc.id === withId) : undefined;
    return holder ? locationOnNpcJourney(world.locations, holder, day) : whereItStands(vehicle);
}

function legOf(fact: HistoricalFact): PublicRoadLeg | null {
    const data = fact.data;
    if (data.publicPassage !== true || data.service !== 'carriage'
        || typeof data.vesselId !== 'string' || typeof data.driverId !== 'string'
        || typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number'
        || typeof data.conveyanceId !== 'string') return null;
    return { vesselId: data.vesselId, driverId: data.driverId, fromId: data.fromLocationId,
        toId: data.toLocationId, departureDay: data.departureDay, arrivalDay: data.arrivalDay,
        conveyanceId: data.conveyanceId };
}

export function publicCarriageReceipt(world: WorldState, receiptId: string, passengerId: string): {
    receipt: HistoricalFact; leg: PublicRoadLeg
} | null {
    const receipt = witnessIndexFor(world).byId.get(receiptId);
    const leg = receipt && legOf(receipt);
    return receipt && leg && receipt.actors.some(actor => actor.id === passengerId && actor.role === 'passenger')
        ? { receipt, leg } : null;
}

/** A forgotten dead holder does not erase the ordinary vehicle's parked ground. */
export function groundOfTheAcceptedCarriage(world: WorldState, receiptId: string, passengerId: string, day: number): string | null {
    const receipt = witnessIndexFor(world).byId.get(receiptId);
    if (!receipt || receipt.data.service !== 'carriage'
        || !receipt.actors.some(actor => actor.id === passengerId && actor.role === 'passenger')
        || typeof receipt.data.vesselId !== 'string') return null;
    const vehicle = vehicleFor(world, receipt.data.vesselId);
    return vehicle && vehicle.possessorId === null && !isRuined(vehicle)
        ? publicCarriageGround(world, vehicle, day) : null;
}

function activeReceipts(world: WorldState, vehicleId: string, day: number): HistoricalFact[] {
    return factsWithDataValue(world, 'vesselId', vehicleId).filter(fact => {
        const leg = legOf(fact);
        return leg !== null && day >= leg.departureDay && day < leg.arrivalDay;
    });
}

/** Pure preflight: no actor, object, receipt, purse or timetable is changed. */
export interface PublicRoadQuoteInput {
    fromId: string; toId: string; day: number; conveyanceId: string;
    passengerIds: readonly string[]; fareStones: number; hired: boolean;
    playedPassenger?: { id: string; locationId: string; alive: boolean };
}
export type PublicRoadAssessment = { quote: PublicRoadQuote; refusal: null } | {
    quote: null;
    refusal: { kind: 'capacity'; requestedPassengers: number; remainingPassengers: number }
        | { kind: 'unavailable' };
};

/** Legacy quote callers read the same pure assessment, without a second seat calculation. */
export function quotePublicCarriage(world: WorldState, input: PublicRoadQuoteInput): PublicRoadQuote | null {
    return assessPublicCarriage(world, input).quote;
}

/** Native availability and refusal counts come from this one reservation/source resolver. */
export function assessPublicCarriage(world: WorldState, input: PublicRoadQuoteInput): PublicRoadAssessment {
    const conveyance = getConveyance(input.conveyanceId);
    const passengers = [...new Set(input.passengerIds)];
    if (!conveyance || conveyance.crossesGroundThatCannotBeWalked || passengers.length === 0) return { quote: null, refusal: { kind: 'unavailable' } };
    if (passengers.length + 1 > conveyance.heads) return { quote: null, refusal: { kind: 'capacity',
        requestedPassengers: passengers.length, remainingPassengers: Math.max(0, conveyance.heads - 1) } };
    if (!Number.isFinite(input.fareStones) || input.fareStones < 0
        || journeyNeedsWater(world.locations, input.fromId, input.toId)) return { quote: null, refusal: { kind: 'unavailable' } };
    for (const id of passengers) {
        const person = world.npcs.find(npc => npc.id === id);
        if (person?.tags.includes(PLAYER_ROW_TAG)) {
            const played = input.playedPassenger;
            if (!played || played.id !== id || !played.alive || played.locationId !== input.fromId) return { quote: null, refusal: { kind: 'unavailable' } };
        } else if (person && (person.status !== 'alive'
            || locationOnNpcJourney(world.locations, person, input.day) !== input.fromId)) return { quote: null, refusal: { kind: 'unavailable' } };
    }
    const walking = walkingDaysFrom(world.locations, input.fromId).get(input.toId);
    if (walking === undefined || walking <= 0) return { quote: null, refusal: { kind: 'unavailable' } };
    const vesselId = carriageIdForRoad(input.fromId, input.toId, conveyance.id);
    const carriage = vehicleFor(world, vesselId);
    let driverId = `${vesselId}:driver:${world.history.nextFactSeq}`;
    let departureDay = input.day;
    let arrivalDay = input.day + daysByConveyance(walking, conveyance);
    if (carriage) {
        if (carriage.possessorId !== null || isRuined(carriage)
            || publicCarriageGround(world, carriage, input.day) !== input.fromId) return { quote: null, refusal: { kind: 'unavailable' } };
        const driver = world.npcs.find(npc => npc.id === whoItIsWith(carriage));
        if (driver && !isTerminal(driver.status)) {
            if (driver.status !== 'alive' || driver.id !== carriage.ownerId
                || !isWithThem(carriage, driver.id, input.fromId)) return { quote: null, refusal: { kind: 'unavailable' } };
            driverId = driver.id;
            const doing = driver.activity;
            if (doing?.kind === 'travelling' && doing.untilDay != null && input.day < doing.untilDay) {
                if (doing.vesselId !== vesselId || doing.fromLocationId !== input.fromId
                    || doing.returnTo !== input.toId || !journeyTimeHasReached(input.day, doing.sinceDay)
                    || !journeyTimeHasReached(doing.sinceDay, input.day)) return { quote: null, refusal: { kind: 'unavailable' } };
                departureDay = doing.sinceDay;
                arrivalDay = doing.untilDay;
            }
        } else if (whoItIsWith(carriage) !== null) return { quote: null, refusal: { kind: 'unavailable' } };
    }
    const reservations = activeReceipts(world, vesselId, input.day);
    if (reservations.some(receipt => receipt.data.hired === true || input.hired)) return { quote: null, refusal: { kind: 'unavailable' } };
    const already = new Set(reservations.flatMap(receipt => receipt.actors
        .filter(actor => actor.role === 'passenger').map(actor => actor.id)));
    if (passengers.some(id => already.has(id))) return { quote: null, refusal: { kind: 'unavailable' } };
    if (already.size + passengers.length + 1 > conveyance.heads) return { quote: null, refusal: { kind: 'capacity',
        requestedPassengers: passengers.length, remainingPassengers: Math.max(0, conveyance.heads - already.size - 1) } };
    return { quote: { vesselId, driverId, fromId: input.fromId, toId: input.toId,
        departureDay, arrivalDay, conveyanceId: conveyance.id,
        fareStones: input.fareStones, passengerIds: passengers, hired: input.hired, walkingDays: walking,
        ...(input.playedPassenger ? { playedPassenger: input.playedPassenger } : {}) }, refusal: null };
}

/** Commit synchronously, after rechecking source and seats, before the caller pays. */
export function commitPublicCarriage(world: WorldState, quote: PublicRoadQuote, boardingMoment?: PassageRunMoment): HistoricalFact | null {
    const now = routineTime(world);
    if (!journeyTimeHasReached(now, quote.departureDay) || !journeyTimeHasReached(quote.departureDay, now)) return null;
    const fresh = quotePublicCarriage(world, { fromId: quote.fromId, toId: quote.toId,
        day: quote.departureDay, conveyanceId: quote.conveyanceId, passengerIds: quote.passengerIds,
        fareStones: quote.fareStones, hired: quote.hired, playedPassenger: quote.playedPassenger });
    if (!fresh || fresh.vesselId !== quote.vesselId || fresh.driverId !== quote.driverId
        || fresh.arrivalDay !== quote.arrivalDay) return null;
    let carriage = vehicleFor(world, quote.vesselId);
    let driver = world.npcs.find(npc => npc.id === quote.driverId);
    if (!driver) {
        driver = createNpc(world.seed, { id: quote.driverId, locationId: quote.fromId,
            onDay: quote.departureDay, bornOnDay: quote.departureDay - 30 * 365,
            occupation: 'carter', takenNames: new Set(world.npcs.map(npc => npc.name)),
            tags: [`crew-of:${quote.vesselId}`] });
        world.npcs.push(driver);
    }
    if (!carriage) {
        carriage = aVehicleOf({ id: quote.vesselId, conveyanceId: quote.conveyanceId,
            ownerId: driver.id, ownerName: driver.name, at: quote.fromId });
        carriage = { ...carriage, locationId: null, data: { ...carriage.data, mooredAt: '' } };
        carriage.tags.push(PUBLIC_ROAD);
        world.objects.push(carriage);
    } else if (whoItIsWith(carriage) === null) {
        const at = world.objects.indexOf(carriage);
        carriage = { ...carriage, ownerId: driver.id, ownerName: driver.name, locationId: null,
            data: { ...carriage.data, withId: driver.id, mooredAt: '' } };
        world.objects[at] = carriage;
    }
    const index = world.npcs.findIndex(npc => npc.id === driver!.id);
    world.npcs[index] = { ...setLocation(driver, quote.fromId, quote.departureDay), activity: companyDuringPassage(driver.activity, { ...driver.activity,
        kind: 'travelling', note: 'Driving the carriage on its paid road passage.',
        withIds: [...new Set([...(driver.activity?.withIds ?? []), ...quote.passengerIds])], fromLocationId: quote.fromId,
        returnTo: quote.toId, sinceDay: quote.departureDay, untilDay: quote.arrivalDay,
        conveyanceId: quote.conveyanceId, conveyancePower: carriage.power, vesselId: quote.vesselId }, quote.departureDay),
        updatedOnDay: quote.departureDay };
    for (const id of quote.passengerIds) {
        const at = world.npcs.findIndex(npc => npc.id === id && !npc.tags.includes(PLAYER_ROW_TAG));
        const person = world.npcs[at];
        if (!person) continue;
        world.npcs[at] = { ...setLocation(person, quote.fromId, quote.departureDay), activity: companyDuringPassage(person.activity, { ...person.activity,
            kind: 'travelling', note: person.activity?.kind === 'travelling'
                ? person.activity.note : 'Travelling on the paid carriage to its destination.',
            withIds: [...new Set([...(person.activity?.withIds ?? []), driver.id])],
            fromLocationId: quote.fromId, returnTo: quote.toId,
            sinceDay: quote.departureDay, untilDay: quote.arrivalDay,
            conveyanceId: quote.conveyanceId, conveyancePower: carriage.power,
            vesselId: quote.vesselId }, quote.departureDay), updatedOnDay: quote.departureDay };
    }
    return appendWorldFact(world, makeFact({ day: quote.departureDay, kind: 'gathering',
        locationId: quote.fromId, visibility: 'secret', summary: 'An accepted public carriage passage.',
        actors: quote.passengerIds.map(id => ({ id,
            name: world.npcs.find(npc => npc.id === id)?.name ?? id, role: 'passenger' })),
        data: { publicPassage: true, service: 'carriage', vesselId: quote.vesselId,
            driverId: driver.id, fromLocationId: quote.fromId, toLocationId: quote.toId,
            departureDay: quote.departureDay, arrivalDay: quote.arrivalDay,
            conveyanceId: quote.conveyanceId, fareStones: quote.fareStones, hired: quote.hired,
            ...(boardingMoment ? { runId: boardingMoment.runId,
                boardingRunElapsedDays: boardingMoment.elapsedDays } : {}) }
    }), { recur: false, bystanders: false });
}

/** Read the same immutable booking and the holder's current physical body. */
export function publicCarriagePassage(world: WorldState, receiptId: string, passengerId: string, day: number): {
    leg: PublicRoadLeg; receipt: HistoricalFact; vehicle: ObjectRecord; driver: NpcRecord;
    locationId: string; remainingDays: number; arrived: boolean;
} | null {
    const accepted = publicCarriageReceipt(world, receiptId, passengerId);
    if (!accepted) return null;
    const { receipt, leg } = accepted;
    const vehicle = vehicleFor(world, leg.vesselId);
    const driver = world.npcs.find(npc => npc.id === leg.driverId);
    if (!vehicle || !driver || isRuined(vehicle) || vehicle.possessorId !== null || vehicle.ownerId !== driver.id
        || whoItIsWith(vehicle) !== driver.id || driver.status !== 'alive') return null;
    const locationId = locationOnNpcJourney(world.locations, driver, day);
    if (!locationId) return null;
    const doing = driver.activity;
    const arrived = journeyTimeHasReached(day, leg.arrivalDay) && locationId === leg.toId;
    if (!arrived && (doing?.kind !== 'travelling' || doing.vesselId !== leg.vesselId
        || doing.fromLocationId !== leg.fromId || doing.returnTo !== leg.toId
        || doing.sinceDay !== leg.departureDay || doing.untilDay !== leg.arrivalDay)) return null;
    return { leg, receipt, vehicle, driver, locationId,
        remainingDays: arrived ? 0 : Math.max(0, leg.arrivalDay - day), arrived };
}

/** Before mortal pruning, a lost holder leaves the ordinary object on corpse ground. */
export function settlePublicCarriages(world: WorldState, day: number): void {
    for (const vehicle of world.objects.filter(object => object.tags.includes(PUBLIC_ROAD))) {
        const id = whoItIsWith(vehicle);
        const driver = id && world.npcs.find(npc => npc.id === id);
        if (!driver || !isTerminal(driver.status)) continue;
        const doing = driver.activity;
        if (doing?.kind === 'travelling' && doing.fromLocationId && doing.returnTo && doing.untilDay != null) {
            stopPublicCarriage(world, { vesselId: vehicle.id, driverId: driver.id,
                fromId: doing.fromLocationId, toId: doing.returnTo,
                departureDay: doing.sinceDay, arrivalDay: doing.untilDay,
                conveyanceId: String(vehicle.data.conveyanceId) }, driver.diedOnDay ?? day);
        } else leaveItHere(world.objects, vehicle, locationOnNpcJourney(world.locations, driver, day));
    }
}

/** A real loss ends the actual leg on the ground reached, before any passenger resumes. */
export function stopPublicCarriage(world: WorldState, leg: PublicRoadLeg, day: number): void {
    const vehicle = vehicleFor(world, leg.vesselId);
    const index = world.npcs.findIndex(npc => npc.id === leg.driverId);
    const driver = world.npcs[index];
    if (!vehicle || !driver) return;
    const ground = locationOnNpcJourney(world.locations, driver, day);
    leaveItHere(world.objects, vehicle, ground);
    if (!isTerminal(driver.status)) world.npcs[index] = { ...setLocation(driver, ground, day), activity: companyAfterPassage(driver, day) };
    for (let at = 0; at < world.npcs.length; at++) {
        const person = world.npcs[at]!;
        const doing = person.activity;
        if (person.id === driver.id || person.tags.includes(PLAYER_ROW_TAG) || isTerminal(person.status)
            || doing?.kind !== 'travelling' || doing.vesselId !== leg.vesselId
            || doing.sinceDay !== leg.departureDay || doing.untilDay !== leg.arrivalDay) continue;
        world.npcs[at] = { ...setLocation(person, ground, day), activity: companyAfterPassage(person, day) };
    }
}
