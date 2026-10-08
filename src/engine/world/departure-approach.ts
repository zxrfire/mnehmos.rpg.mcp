/** A departure walks real interiors before boarding, at the body's actual clock. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { evaluateAccess } from './locations.js';
import { pathTo, reachThrough } from './architecture.js';
import { whereCompoundsAre, whereTheyAreStanding } from './where-inside-a-house-somebody-is-standing.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { locationOnNpcJourney, journeyTimeHasReached } from './places-on-the-way.js';
import { actualVesselRooms, vesselRoomChosen, vesselRoomAccess } from './rooms-in-a-vessel.js';
import { isRuined } from './possessions.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';

export interface DepartureApproachRequest {
    intentId: string;
    target: { locationId: string; areaId?: string | null; vesselId?: string };
}
type Position = { actor: NpcRecord; groundId: string; areaId: string | null };
type ApproachRead = ({ kind: 'ready' | 'local_walk' } & Position)
    | { kind: 'already_aboard'; actor: NpcRecord; vesselId: string }
    | { kind: 'needs_geographic_leg'; actor: NpcRecord; fromId: string; toId: string }
    | { kind: 'refused'; reason: string };

export function exteriorGroundOfDeparture(state: Pick<WorldState, 'locations'>, locationId: string) {
    return [...pathTo(state.locations, locationId)].reverse().find(place => !place.tags.includes('interior')
        && !['precinct', 'hall', 'chamber', 'vault'].includes(place.kind));
}

export function readActualDepartureApproach(state: WorldState, actorId: string,
    request: DepartureApproachRequest, onDay: number, actualBody?: NpcRecord): ApproachRead {
    const actor = actualBody ?? state.npcs.find(person => person.id === actorId);
    if (!actor || actor.status !== 'alive' || !actor.locationId)
        return { kind: 'refused', reason: 'The traveller is absent.' };
    const keys = state.objects.filter(object => object.possessorId === actor.id && object.kind === 'key' && !isRuined(object))
        .flatMap(object => typeof object.data.keyId === 'string' ? [object.id, object.data.keyId] : [object.id]);
    const cabin = vesselRoomChosen(actor.activity?.standingIn);
    const aboard = actor.activity?.vesselId;
    if (request.target.vesselId && (aboard === request.target.vesselId || cabin?.vesselId===request.target.vesselId)) {
        const hull=state.objects.find(object=>object.id===request.target.vesselId&&!isRuined(object));
        const actualRoom=!cabin||hull&&actualVesselRooms(hull).some(room=>room.slot.id===cabin.slotId);
        const leg=state.history.facts.some(fact=>fact.data.vesselId===request.target.vesselId
            &&fact.actors.some(person=>person.id===actor.id)
            &&fact.data.departureDay===actor.activity?.sinceDay&&fact.data.arrivalDay===actor.activity?.untilDay
            &&typeof fact.data.arrivalDay==='number'&&onDay<=fact.data.arrivalDay);
        if(hull&&actualRoom&&(hull.locationId===actor.locationId||leg))
            return { kind: 'already_aboard', actor, vesselId: hull.id };
        return {kind:'refused',reason:'The actual vessel no longer holds the traveller.'};
    }
    if (cabin) {
        const hull = state.objects.find(object => object.id === cabin.vesselId && !isRuined(object));
        const room = hull && actualVesselRooms(hull).find(room => room.slot.id === cabin.slotId);
        if (!room || !vesselRoomAccess(room, actor.id, keys).physicalEntry)
            return { kind: 'refused', reason: 'The cabin door is closed.' };
    }
    if (locationOnNpcJourney(state.locations, actor, onDay) !== actor.locationId)
        return { kind: 'refused', reason: 'The traveller is still on another journey.' };
    const clock = { ...state, currentDay: onDay, currentHour: (onDay % 1) * 24 };
    const marker = actor.activity?.standingIn;
    const physical = marker && state.locations.some(place => place.id === marker.split('#')[0])
        ? marker.split('#')[0]!
        : whereTheyAreStanding(clock, whereCompoundsAre(clock), actor, new Set(state.npcs.map(person => person.id)));
    if (!physical) return { kind: 'refused', reason: 'The traveller has no physical departure.' };
    const chain = pathTo(state.locations, physical);
    const ground = exteriorGroundOfDeparture(state, physical);
    const target = state.locations.find(place => place.id === request.target.locationId);
    if (!ground || !target) return { kind: 'refused', reason: 'The departure place is absent.' };
    // Standing inside a precinct permits leaving it; its actual lock still holds.
    for (const place of [...chain].reverse()) {
        if (place.id === ground.id) break;
        const exit = evaluateAccess({ ...place, thresholds: { ...place.thresholds, entry: 0 } },
            { realmOrdinal: actor.cultivation.realmOrdinal, keyIds: keys, onDay });
        if (exit.closed) return { kind: 'refused', reason: exit.reason };
    }
    if (ground.id !== target.id)
        return { kind: 'needs_geographic_leg', actor, fromId: ground.id, toId: target.id };
    const access = reachThrough(pathTo(state.locations, target.id),
        { realmOrdinal: actor.cultivation.realmOrdinal, keyIds: keys, onDay }, { enteredAt: ground.id });
    if (access.stoppedAt) return { kind: 'refused', reason: access.reason };
    const areas = theAreasOf(clock, state.locations.find(place => place.id === physical) ?? ground);
    const area = marker ?? areas.whereIs.get(actor.id) ?? null;
    const arrived = physical === target.id && (request.target.areaId == null || area === request.target.areaId);
    return { kind: arrived ? 'ready' : 'local_walk', actor, groundId: target.id, areaId: request.target.areaId ?? null };
}

export function beginActualDepartureApproach(state: WorldState, actorId: string,
    request: DepartureApproachRequest, onDay: number, actualBody?: NpcRecord) {
    const read = readActualDepartureApproach(state, actorId, request, onDay, actualBody);
    if (read.kind !== 'local_walk') return read;
    const clock = { ...state, currentDay: onDay, currentHour: (onDay % 1) * 24 };
    const physical = whereTheyAreStanding(clock, whereCompoundsAre(clock), read.actor,
        new Set(state.npcs.map(person => person.id))) ?? read.actor.locationId!;
    const area = read.actor.activity?.standingIn ?? theAreasOf(clock,
        state.locations.find(place => place.id === physical)!).whereIs.get(actorId) ?? physical;
    return { kind: 'approaching' as const, actor: { ...read.actor, activity: {
        kind: 'travelling' as const, note: 'Walking to the departure point.', withIds: read.actor.activity?.withIds ?? [],
        capitalMissionId: request.intentId, standingIn: area, fromLocationId: read.actor.locationId!,
        returnTo: read.actor.locationId!, sinceDay: onDay, untilDay: onDay + LOCAL_WALK_DAYS
    }, updatedOnDay: onDay } };
}

export function finishActualDepartureApproach(state: WorldState, actorId: string,
    request: DepartureApproachRequest, onDay: number) {
    const actor = state.npcs.find(person => person.id === actorId);
    if (!actor || actor.status !== 'alive' || actor.activity?.capitalMissionId !== request.intentId)
        return { kind: 'refused' as const, reason: 'The departure intention is no longer held.' };
    if (actor.activity.untilDay != null && !journeyTimeHasReached(onDay, actor.activity.untilDay)
        || !journeyTimeHasReached(state.currentDay, onDay)) return { kind: 'waiting' as const, actor };
    const read = readActualDepartureApproach(state, actorId, request, onDay);
    if (read.kind !== 'local_walk' && read.kind !== 'ready') return read;
    return { kind: 'ready' as const, groundId: read.groundId, areaId: read.areaId, actor: {
        ...actor, locationId: read.groundId, activity: { ...actor.activity,
            kind: 'out_with_a_party' as const, standingIn: read.areaId, fromLocationId: read.groundId,
            returnTo: read.groundId, untilDay: null }, updatedOnDay: onDay
    } };
}
