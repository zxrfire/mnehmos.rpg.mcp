/** A passenger follows an accepted hull's actual crew, never a copied sailed counter. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { HistoricalFact } from './history.js';
import { canTurnBack } from './what-a-sea-crossing-costs.js';
import { bindShipCrewToPassage } from './ship-crew.js';
import { witnessIndexFor, factsWithDataValue } from './witness-reaction-index.js';
import { publicShipLinesFrom, recordPublicPassage, type PublicPassageLeg } from './public-shipping.js';
import { journeyTimeHasReached, locationOnNpcJourney } from './places-on-the-way.js';

export interface ShipPassengerPosition {
    receipt: HistoricalFact;
    vesselId: string;
    seaLaneId: string;
    fromId: string;
    toId: string;
    departureDay: number;
    boardedOnDay: number;
    arrivalDay: number;
    sailed: number;
    remainingDays: number;
    crew: NpcRecord[];
    locationId: string | null;
    arrived: boolean;
    unavailable: string | null;
}

/** No quote, recruitment, course write, hull respawn or body movement occurs in this read. */
export function shipPassengerAt(world: WorldState, receiptId: string, onDay: number): ShipPassengerPosition | null {
    const booked = witnessIndexFor(world).byId.get(receiptId);
    const origin = booked?.data;
    if (!booked || origin?.publicPassage !== true || typeof origin.vesselId !== 'string'
        || typeof origin.seaLaneId !== 'string' || typeof origin.departureDay !== 'number') return null;
    const courses = factsWithDataValue(world, 'vesselId', origin.vesselId)
        .filter(fact => fact.data.publicPassage === true && fact.data.seaLaneId === origin.seaLaneId && fact.day <= onDay)
        .sort((a, b) => a.day - b.day || (witnessIndexFor(world).order.get(a.id) ?? 0)
            - (witnessIndexFor(world).order.get(b.id) ?? 0));
    let receipt = booked;
    const linked = new Set([booked.id]);
    for (const course of courses) if (course.id === booked.id || course.causes.some(id => linked.has(id))) {
        linked.add(course.id); receipt = course;
    }
    const data = receipt.data;
    if (typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number' || data.arrivalDay < data.departureDay) return null;
    const arrivalDay = data.arrivalDay, departureDay = data.departureDay;
    const arrived = journeyTimeHasReached(onDay, arrivalDay);
    const crew = world.npcs.filter(npc => npc.status === 'alive'
        && npc.tags.includes(`crew-of:${origin.vesselId}`)
        && ((arrived && npc.locationId === data.toLocationId && journeyTimeHasReached(npc.updatedOnDay, arrivalDay)
            && npc.activity?.kind !== 'travelling')
        || npc.activity?.kind === 'travelling' && npc.activity.vesselId === origin.vesselId
        && npc.activity.seaLaneId === origin.seaLaneId
        && npc.activity.sinceDay === departureDay
        && npc.activity.fromLocationId === data.fromLocationId
        && npc.activity.returnTo === data.toLocationId
        && npc.activity.untilDay === data.arrivalDay));
    const elapsed = Math.max(0, onDay - departureDay);
    // A surviving matched source, not the passenger's stored water name, supplies ground.
    const source = crew.find(npc => npc.identity.occupation === 'shipmaster') ?? crew[0];
    const last = world.npcs.filter(npc => npc.tags.includes('crew-of:' + origin.vesselId)
        && npc.activity?.vesselId === origin.vesselId && npc.activity.sinceDay === departureDay
        && npc.diedOnDay != null && npc.diedOnDay <= onDay)
        .sort((a, b) => (b.diedOnDay ?? 0) - (a.diedOnDay ?? 0))[0];
    const locationId = source ? locationOnNpcJourney(world.locations, source, onDay)
        : last?.locationId ?? (data.toLocationId !== origin.toLocationId ? data.toLocationId : null);
    const atPort = arrived && locationId === data.toLocationId && !!source;
    return { receipt, vesselId: origin.vesselId, seaLaneId: origin.seaLaneId,
        fromId: data.fromLocationId, toId: data.toLocationId,
        departureDay, boardedOnDay: origin.departureDay, arrivalDay: data.arrivalDay,
        sailed: atPort ? data.arrivalDay - departureDay : Math.min(elapsed, data.arrivalDay - departureDay),
        remainingDays: atPort ? 0 : Math.max(0, data.arrivalDay - onDay), crew, locationId,
        arrived: atPort,
        unavailable: source ? null : 'The accepted hull has no actual crew carrying this leg.' };
}

/** Loss writes the actual final ground before the last mortal source can be forgotten. */
export function settleLostPublicPassages(world: WorldState, day: number): void {
    const ended = new Set<string>();
    for (const npc of world.npcs) {
        const activity = npc.activity;
        if (npc.status === 'alive' || npc.diedOnDay == null || npc.diedOnDay > day
            || activity?.kind !== 'travelling' || !activity.seaLaneId || !activity.vesselId
            || !npc.tags.includes('crew-of:' + activity.vesselId) || !activity.fromLocationId
            || !activity.returnTo || activity.untilDay == null || npc.diedOnDay >= activity.untilDay) continue;
        const key = activity.vesselId + ':' + activity.sinceDay;
        if (ended.has(key)) continue;
        ended.add(key);
        const crew = world.npcs.filter(one => one.tags.includes('crew-of:' + activity.vesselId)
            && one.activity?.vesselId === activity.vesselId && one.activity?.sinceDay === activity.sinceDay);
        if (crew.some(one => one.status === 'alive')) continue;
        const last = [...crew].sort((a, b) => (b.diedOnDay ?? 0) - (a.diedOnDay ?? 0))[0];
        const from = world.locations.find(place => place.id === activity.fromLocationId);
        const bound = world.locations.find(place => place.id === activity.returnTo);
        const lane = from && bound && publicShipLinesFrom(world, from.name, activity.sinceDay)
            .find(line => line.lane.id === activity.seaLaneId && line.to === bound.name)?.lane;
        if (!lane || !last?.locationId || last.diedOnDay == null) continue;
        recordPublicPassage(world, { lane, vesselId: activity.vesselId, fromId: from!.id,
            toId: last.locationId, departureDay: activity.sinceDay, arrivalDay: last.diedOnDay },
            last.diedOnDay, last.locationId, crew.map(one => one.id));
    }
}

/** Only living actual crew can begin a real shorter-way return; the old receipt remains history. */
export function turnBackPublicPassage(world: WorldState, receiptId: string, day: number): PublicPassageLeg | null {
    const actual = shipPassengerAt(world, receiptId, day);
    const original = witnessIndexFor(world).byId.get(receiptId)?.data;
    if (!actual || actual.unavailable || actual.arrived || !actual.locationId || !actual.crew.length
        || !original || typeof original.fromLocationId !== 'string'
        || actual.toId === original.fromLocationId || actual.sailed <= 0) return null;
    const from = world.locations.find(place => place.id === original.fromLocationId);
    const to = world.locations.find(place => place.id === original.toLocationId);
    const lane = from && to && publicShipLinesFrom(world, from.name, actual.boardedOnDay)
        .find(line => line.lane.id === actual.seaLaneId && line.to === to.name)?.lane;
    if (!lane || !canTurnBack(lane, day - actual.boardedOnDay)) return null;
    const leg: PublicPassageLeg = { lane, vesselId: actual.vesselId, fromId: actual.locationId,
        toId: original.fromLocationId, departureDay: day, arrivalDay: day + (day - actual.boardedOnDay) };
    bindShipCrewToPassage(world, leg, day, actual.departureDay);
    recordPublicPassage(world, leg, day, leg.fromId, actual.crew.map(one => one.id), actual.receipt.id);
    return leg;
}
