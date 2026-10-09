/** Ordinary people reach the same real station before paying or boarding. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { beginActualDepartureApproach, finishActualDepartureApproach, exteriorGroundOfDeparture } from './departure-approach.js';
import { departureAreaAt } from './where-in-a-place-somebody-is-standing.js';
import { bookNpcPassageForRoute } from './places-on-the-way.js';
import { startNpcJourney } from './dao-ground-stints.js';
import { commitNpcPublicPassage } from './ship-crew.js';
import { publicShipLinesFrom } from './public-shipping.js';
import { routeQueriesFor, type RouteQueries } from './locations.js';

export function prepareNpcDepartureApproach(world:WorldState,npc:NpcRecord,destinationId:string,
    day:number,purpose:string,service:'ship'|'carriage'|'air'|'ground',vehicleId?:string,routes?:RouteQueries):NpcRecord|null|undefined {
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
        ?startNpcJourney(world,ready,intent.destinationId,day,intent.purpose,vessel)
        :intent.vehicleId?(vessel?startNpcJourney(world,ready,intent.destinationId,day,intent.purpose,vessel):null)
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
