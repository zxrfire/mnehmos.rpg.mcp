/** A departure walks real interiors before boarding, at the body's actual clock. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { evaluateAccess, routeQueriesFor, type RouteQueries } from './locations.js';
import { pathTo, reachThrough } from './architecture.js';
import { whereCompoundsAre, whereTheyAreStanding } from './where-inside-a-house-somebody-is-standing.js';
import { theAreasOf, type APlaceReadIntoAreas } from './where-in-a-place-somebody-is-standing.js';
import { journeyTimeHasReached, locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { actualVesselRooms, vesselRoomChosen, vesselRoomAccess } from './rooms-in-a-vessel.js';
import { isRuined } from './possessions.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { routineTime } from './npc-routines.js';

export interface DepartureApproachRequest {
    intentId: string;
    target: { locationId: string; areaId?: string | null; vesselId?: string };
}
type Position = { actor: NpcRecord; groundId: string; areaId: string | null;
    originLocationId: string; originAreaId: string | null };
type ApproachRead = ({ kind: 'ready' | 'local_walk' } & Position)
    | { kind: 'already_aboard'; actor: NpcRecord; vesselId: string }
    | { kind: 'needs_geographic_leg'; actor: NpcRecord; fromId: string; toId: string }
    | { kind: 'refused'; reason: string };

export function exteriorGroundOfDeparture(state: Pick<WorldState, 'locations'>, locationId: string,
    places?: ReadonlyMap<string, import('./locations.js').LocationRecord>) {
    return [...pathTo(state.locations, locationId,places)].reverse().find(place => !place.tags.includes('interior')
        && !['precinct', 'hall', 'chamber', 'vault'].includes(place.kind));
}

/** A synchronous read batch ends before any actor, door or hull is changed. */
export function departureSceneFor(state: WorldState, routes: RouteQueries) {
    const people = new Set(state.npcs.map(person => person.id));
    const clocks = new Map<number, { clock: WorldState; compounds: ReturnType<typeof whereCompoundsAre>;
        areas: Map<string, APlaceReadIntoAreas> }>();
    return {
        people,
        at(day: number) {
            let scene = clocks.get(day);
            if (!scene) {
                const clock = { ...state, currentDay: day, currentHour: (day % 1) * 24 };
                scene = { clock, compounds: whereCompoundsAre(clock), areas: new Map() };
                clocks.set(day, scene);
            }
            return scene;
        },
        areas(day: number, place: import('./locations.js').LocationRecord) {
            const scene = this.at(day);
            let areas = scene.areas.get(place.id);
            if (!areas) {
                areas = theAreasOf(scene.clock, place, scene.compounds, undefined, routes);
                scene.areas.set(place.id, areas);
            }
            return areas;
        }
    };
}
type DepartureScene = ReturnType<typeof departureSceneFor>;

export function readActualDepartureApproach(state: WorldState, actorId: string,
    request: DepartureApproachRequest, onDay: number, actualBody?: NpcRecord, routes?: RouteQueries, scene?: DepartureScene): ApproachRead {
    const actor = actualBody ?? state.npcs.find(person => person.id === actorId);
    if (!actor || actor.status !== 'alive' || !actor.locationId)
        return { kind: 'refused', reason: 'The traveller is absent.' };
    let heldKeys:string[]|undefined;
    const keys=()=>heldKeys??=state.objects.filter(object=>object.possessorId===actor.id
        &&object.kind==='key'&&!isRuined(object))
        .flatMap(object=>typeof object.data.keyId==='string'?[object.id,object.data.keyId]:[object.id]);
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
        if (!room || !vesselRoomAccess(room, actor.id, keys()).physicalEntry)
            return { kind: 'refused', reason: 'The cabin door is closed.' };
    }
    routes ??= routeQueriesFor(state.locations);
    if (locationOfNpcOnItsJourney(state, actor, onDay,routes) !== actor.locationId)
        return { kind: 'refused', reason: 'The traveller is still on another journey.' };
    const batch = scene?.at(onDay);
    const clock = batch?.clock ?? { ...state, currentDay: onDay, currentHour: (onDay % 1) * 24 };
    const marker = actor.activity?.standingIn;
    const physical = marker && routes.places.has(marker.split('#')[0]!)
        ? marker.split('#')[0]!
        : whereTheyAreStanding(clock, batch?.compounds ?? whereCompoundsAre(clock), actor,
            scene?.people ?? new Set((actor.activity?.withIds.length||actor.activity?.redirect?.previous?.withIds.length)
                ?state.npcs.map(person => person.id):[]),routes);
    if (!physical) return { kind: 'refused', reason: 'The traveller has no physical departure.' };
    const chain = pathTo(state.locations, physical,routes.places);
    const ground = exteriorGroundOfDeparture(state, physical,routes.places);
    const target = routes.places.get(request.target.locationId);
    if (!ground || !target) return { kind: 'refused', reason: 'The departure place is absent.' };
    // Standing inside a precinct permits leaving it; its actual lock still holds.
    for (const place of [...chain].reverse()) {
        if (place.id === ground.id) break;
        const exit = evaluateAccess({ ...place, thresholds: { ...place.thresholds, entry: 0 } },
            { realmOrdinal: actor.cultivation.realmOrdinal, keyIds: place.data.keyId!=null?keys():[], onDay });
        if (exit.closed) return { kind: 'refused', reason: exit.reason };
    }
    if (ground.id !== target.id)
        return { kind: 'needs_geographic_leg', actor, fromId: ground.id, toId: target.id };
    const entrance=pathTo(state.locations,target.id,routes.places);
    const access = reachThrough(entrance,
        { realmOrdinal: actor.cultivation.realmOrdinal, keyIds: entrance.some(place=>place.data.keyId!=null)?keys():[], onDay }, { enteredAt: ground.id });
    if (access.stoppedAt) return { kind: 'refused', reason: access.reason };
    const area = marker ?? (request.target.areaId != null || physical !== target.id
        ?(scene?.areas(onDay,routes.places.get(physical)??ground)
            ??theAreasOf(clock,routes.places.get(physical)??ground,undefined,undefined,routes)).whereIs.get(actor.id):null) ?? null;
    const arrived = physical === target.id && (request.target.areaId == null || area === request.target.areaId);
    return { kind: arrived ? 'ready' : 'local_walk', actor, groundId: target.id, areaId: request.target.areaId ?? null,
        originLocationId:physical,originAreaId:area };
}

export function beginActualDepartureApproach(state: WorldState, actorId: string,
    request: DepartureApproachRequest, onDay: number, actualBody?: NpcRecord,routes?:RouteQueries,scene?:DepartureScene) {
    const read = readActualDepartureApproach(state, actorId, request, onDay, actualBody,routes,scene);
    if (read.kind !== 'local_walk') return read;
    const area = read.originAreaId ?? read.originLocationId;
    return { kind: 'approaching' as const, actor: { ...read.actor, activity: {
        kind: 'travelling' as const, note: 'Walking to the departure point.', withIds: read.actor.activity?.withIds ?? [],
        capitalMissionId: request.intentId, standingIn: area, fromLocationId: read.actor.locationId!,
        returnTo: read.actor.locationId!, sinceDay: onDay, untilDay: onDay + LOCAL_WALK_DAYS
    }, updatedOnDay: onDay } };
}

export function finishActualDepartureApproach(state: WorldState, actorId: string,
    request: DepartureApproachRequest, onDay: number,routes?:RouteQueries,scene?:DepartureScene) {
    const actor = state.npcs.find(person => person.id === actorId);
    if (!actor || actor.status !== 'alive' || actor.activity?.capitalMissionId !== request.intentId)
        return { kind: 'refused' as const, reason: 'The departure intention is no longer held.' };
    if (actor.activity.untilDay != null && !journeyTimeHasReached(onDay, actor.activity.untilDay)
        || !journeyTimeHasReached(routineTime(state), onDay)) return { kind: 'waiting' as const, actor };
    const read = readActualDepartureApproach(state, actorId, request, onDay,undefined,routes,scene);
    if (read.kind !== 'local_walk' && read.kind !== 'ready') return read;
    return { kind: 'ready' as const, groundId: read.groundId, areaId: read.areaId, actor: {
        ...actor, locationId: read.groundId, activity: { ...actor.activity,
            kind: 'out_with_a_party' as const, standingIn: read.areaId, fromLocationId: read.groundId,
            returnTo: read.groundId, untilDay: null }, updatedOnDay: onDay
    } };
}
