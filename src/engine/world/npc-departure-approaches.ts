/** Ordinary people reach the same real station before paying or boarding. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { beginActualDepartureApproach, finishActualDepartureApproach, exteriorGroundOfDeparture } from './departure-approach.js';
import { departureAreaAt } from './where-in-a-place-somebody-is-standing.js';
import { bookNpcPassageForRoute } from './places-on-the-way.js';
import { startNpcJourney } from './dao-ground-stints.js';
import { commitNpcPublicPassage } from './ship-crew.js';
import { publicShipLinesFrom, quotePublicPassage } from './public-shipping.js';
import { shipIdForLane } from './the-ship-on-a-lane.js';
import { routeQueriesFor, type RouteQueries } from './locations.js';
import { isPlayerInvolved } from './background-incident-draw.js';

/** Contact realizes the current passage without restarting its paid journey. */
export function settleNpcTravelOnContact(world: WorldState, personIds: ReadonlySet<string>): boolean {
    let changed = false;
    const routes = routeQueriesFor(world.locations);
    for (const id of personIds) {
        const at = world.npcs.findIndex(person => person.id === id);
        const person = world.npcs[at], doing = person?.activity;
        if (person?.status !== 'alive' || doing?.kind !== 'travelling' || !doing.seaLaneId
            || doing.vesselId || !doing.fromLocationId || !doing.returnTo || doing.untilDay == null
            || world.currentDay < doing.sinceDay || world.currentDay >= doing.untilDay) continue;
        const from = routes.places.get(doing.fromLocationId), to = routes.places.get(doing.returnTo);
        const line = from && to ? publicShipLinesFrom(world, from.name, doing.sinceDay, routes)
            .find(row => row.lane.id === doing.seaLaneId && row.to === to.name) : undefined;
        if (!line) continue;
        // Contact checks current custody and finite berths before realizing a hull.
        if (!quotePublicPassage(world, from!.id, to!.id, doing.sinceDay,
            1, [], undefined, [person.id], routes)) continue;
        const accepted = { ...person, activity: { ...doing, vesselId: shipIdForLane(line.lane) } };
        world.npcs[at] = accepted;
        if (commitNpcPublicPassage(world, accepted)) changed = true;
        else world.npcs[at] = person;
    }
    return changed;
}

export function prepareNpcDepartureApproach(world:WorldState,npc:NpcRecord,destinationId:string,
    day:number,purpose:string,service:'ship'|'carriage'|'air'|'ground',vehicleId?:string,routes?:RouteQueries):NpcRecord|null|undefined {
    if (!isPlayerInvolved(world, npc)) return undefined;
    routes ??= routeQueriesFor(world.locations);
    const place=npc.locationId?exteriorGroundOfDeparture(world,npc.locationId,routes.places):undefined;
    const area=place&&(service==='ship'||service==='carriage'||service==='air'&&vehicleId)
        ?departureAreaAt(world,place,service==='ship'?'landing':service==='air'?'spirit_berth':'carriage_station',routes):undefined;
    if(!place)return null;
    const intentId='npc-departure:'+npc.id+':'+day;
    const result=beginActualDepartureApproach(world,npc.id,{intentId,target:{locationId:place.id,areaId:area?.id,vesselId:vehicleId}},day,npc,routes);
    if(result.kind==='ready'||result.kind==='already_aboard')return undefined;
    if(result.kind!=='approaching')return null;
    return {...result.actor,activity:{...result.actor.activity!,departureApproach:{locationId:place.id,
        areaId:area?.id??null,destinationId,purpose,service,...(vehicleId?{vehicleId}: {})}}};
}

export function continueNpcDepartureApproach(world:WorldState,npc:NpcRecord,day:number,routes?:RouteQueries):boolean {
    const intent=npc.activity?.departureApproach,binding=npc.activity?.capitalMissionId;
    if(!intent||!binding)return false;
    // Explicit gathering belongs to the player's physical departure, including
    // a rider whose company agreement has not begun yet.
    if (!isPlayerInvolved(world, npc) && intent.service !== 'gather') {
        const due = npc.activity?.untilDay;
        if (due == null || due > day) return true;
        const at = world.npcs.findIndex(person => person.id === npc.id);
        if (at < 0) return true;
        const ready = { ...npc, locationId: intent.locationId, activity: {
            ...npc.activity!, standingIn: intent.areaId, departureApproach: undefined, capitalMissionId: undefined
        } };
        const vessel = intent.vehicleId ? world.objects.find(object => object.id === intent.vehicleId) : undefined;
        world.npcs[at] = intent.service === 'gather' ? ready
            : intent.service === 'ground' || intent.service === 'air' || vessel
                ? startNpcJourney(world, ready, intent.destinationId, due, intent.purpose, vessel, routes)
                : bookNpcPassageForRoute(world, ready, intent.destinationId, due, intent.purpose, routes) ?? ready;
        return true;
    }
    const request={intentId:binding,target:{locationId:intent.locationId,areaId:intent.areaId,vesselId:intent.vehicleId}};
    const result=finishActualDepartureApproach(world,npc.id,request,day,routes);
    if(result.kind!=='ready')return true;
    const at=world.npcs.findIndex(person=>person.id===npc.id);
    if(at<0)return true;
    const ready={...result.actor,activity:{...result.actor.activity!,departureApproach:undefined,capitalMissionId:undefined}};
    world.npcs[at]=ready;
    if(intent.service==='gather')return true;
    const vessel=intent.vehicleId?world.objects.find(object=>object.id===intent.vehicleId):undefined;
    const booked=intent.service==='ground'||intent.service==='air'
        ?startNpcJourney(world,ready,intent.destinationId,day,intent.purpose,vessel,routes)
        :intent.vehicleId?(vessel?startNpcJourney(world,ready,intent.destinationId,day,intent.purpose,vessel,routes):null)
        :bookNpcPassageForRoute(world,ready,intent.destinationId,day,intent.purpose,routes);
    if(booked&&booked!==ready&&(!booked.activity?.departureApproach)){
        world.npcs[at]=booked;
        if(intent.service==='ground'||intent.service==='air'||intent.vehicleId||commitNpcPublicPassage(world,booked))return true;
        world.npcs[at]=ready;
    }
    const from=world.locations.find(place=>place.id===intent.locationId);
    const to=world.locations.find(place=>place.id===intent.destinationId);
    const next=from&&to?publicShipLinesFrom(world,from.name,day,routes).find(line=>line.to===to.name)?.runsFromDay:null;
    world.npcs[at]={...world.npcs[at]!,activity:{...npc.activity!,untilDay:next&&next>day?next:null,
        standingIn:intent.areaId},locationId:intent.locationId};
    return true;
}
