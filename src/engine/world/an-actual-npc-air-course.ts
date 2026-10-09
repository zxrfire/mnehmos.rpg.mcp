import { heldPersonalFlightArt } from './the-personal-flight-art-they-hold.js';
import { npcArtReadiness, useAnNpcArt } from './the-arts-an-npc-has-spent.js';
/** Actual NPC air departures use the same metric course and ordinary actor resources.
 * No SQL Run is fabricated for world people. A world-clock receipt holds their
 * accepted course; the activity references its physical site. Ground-only
 * callers remain on their existing route, and an interior is not launched through. */
import { swallowOrdinaryHeldQiMedicine } from './an-npc-takes-held-qi-medicine.js';
import { getPill } from '../../data/cultivation/pills.js';
import { isSettledOnUse } from '../cultivation/grade-spread.js';
import { qiStandingOn } from './npc-state.js';
import type { WorldState } from './world-state.js';
import { type NpcRecord, spendNpcQi } from './npc-state.js';
import type { ObjectRecord } from './possessions.js';
import { isRuined } from './possessions.js';
import { locationOnNpcJourney } from './places-on-the-way.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { routineOf } from './npc-routines.js';
import { beginAnAirCourse, recordPaidAirCourseFuel } from './an-air-course-in-the-world.js';
import { quoteAnAirJourney, conveyanceOfPersonalFlight, canFlyByTheirOwnBody } from './what-an-air-journey-takes.js';
import { getConveyance, INNATE_FLIGHT_LAUNCH_QI } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { isWithThem, itWantsAPilot, A_SPIRIT_BOAT_ANSWERS_TO } from './a-vehicle.js';
import { brokenStatusesOn } from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import {readActualDepartureApproach,departureSceneFor} from './departure-approach.js';
import {routeQueriesFor,type RouteQueries} from './locations.js';

export function theExteriorGroundsOfAnNpcAirDeparture(world:WorldState,npc:NpcRecord,toId:string,day:number,vesselId?:string,
    routes?:RouteQueries,scene?:ReturnType<typeof departureSceneFor>) {
    routes ??= routeQueriesFor(world.locations);
    if (npc.status !== 'alive' || !npc.locationId
        || locationOnNpcJourney(world.locations,npc,day,routes) !== npc.locationId) return null;
    const from=routes.places.get(npc.locationId);
    const to=routes.places.get(toId);
    if(!from||!to||[from,to].some(place=>place.tags.includes('interior')
        || ['precinct','hall','chamber','vault','cave','sealed_domain','secret_realm'].includes(place.kind))) return null;
    if(vesselId&&readActualDepartureApproach(world,npc.id,{intentId:'npc-hull-departure',
        target:{locationId:from.id,vesselId}},day,npc,routes,scene).kind==='already_aboard')return {from,to};
    const clock=scene?.at(day).clock??{...world,currentDay:day,currentHour:(day%1)*24};
    const routine=routineOf(clock,npc,routes);
    if(routine.home) return null;
    const areas=scene?.areas(day,from)??theAreasOf(clock,from,undefined,undefined,routes);
    const area=areas.areas.find(one=>one.id===areas.whereIs.get(npc.id));
    if(area?.for==='room'||area?.for==='clinic') return null;
    return {from,to};
}

/** Current area/routine and actual exterior ground, not inherited room coordinates. */
export function quoteNpcAirDeparture(world: WorldState, npc: NpcRecord, toId: string,
    day: number, vehicle?: ObjectRecord, requireLaunchBalance=true, requestedArt?: string) {
    const ground=theExteriorGroundsOfAnNpcAirDeparture(world,npc,toId,day,vehicle?.id);
    if(!ground)return null;
    const {from,to}=ground;
    const bodily=canFlyByTheirOwnBody(npc.cultivation.realmOrdinal,brokenStatusesOn(npc.cultivation.injuries));
    const art=vehicle?null:requestedArt||!bodily
        ?heldPersonalFlightArt(npc.cultivation.realmOrdinal,npc.cultivation.techniqueIds,requestedArt):null;
    if(!vehicle&&requestedArt&&!art)return null;
    const craft=vehicle?getConveyance(String(vehicle.data.conveyanceId??'')):conveyanceOfPersonalFlight(art?.id??null);
    if(!craft||!craft.crossesGroundThatCannotBeWalked) return null;
    if(vehicle){
        if(isRuined(vehicle)||!isWithThem(vehicle,npc.id,from.id)
            ||(vehicle.ownerId!==npc.id&&vehicle.possessorId!==npc.id)
            ||(itWantsAPilot(craft)&&npc.cultivation.realmOrdinal<A_SPIRIT_BOAT_ANSWERS_TO)) return null;
    }else {
        if(art){const notReady=npcArtReadiness(npc,art.id,day);
            if(notReady&&(requireLaunchBalance||notReady.reason!=='insufficient_qi'))return null;
        }else if(!bodily||(requireLaunchBalance&&!spendNpcQi(npc,INNATE_FLIGHT_LAUNCH_QI,day)))return null;
    }
    const quote=quoteAnAirJourney(world.locations,from.id,to.id,craft,vehicle?.power??null,1,
        {facts:witnessIndexFor(world).byId,onDay:day});
    return quote&&quote.trips===1&&quote.daysOneWay>0&&npc.spiritStones>=quote.stonesBurned
        ? {from,to,craft,quote,art} : null;
}

/** All readiness precedes one actual launch charge or existing full hull-fuel debit. */
export function startNpcAirJourney(world: WorldState,npc: NpcRecord,toId: string,
    day: number,note: string,vehicle?:ObjectRecord,requestedArt?:string):NpcRecord|null {
    const read=quoteNpcAirDeparture(world,npc,toId,day,vehicle,false,requestedArt);
    if(!read) return null;
    const launchCost=read.art?.qiCost??INNATE_FLIGHT_LAUNCH_QI;
    let prepared=npc;
    if(!vehicle && qiStandingOn(prepared,day)<launchCost) {
        const held=world.objects.filter(row=>row.kind==='pill' && row.possessorId===npc.id)
            .map(row=>({row,pill:typeof row.data.pillId==='string'?getPill(row.data.pillId):undefined}))
            .filter(one=>one.pill?.effect==='restore_qi' && isSettledOnUse(one.pill.grade))
            .sort((a,b)=>(a.pill?.value??0)-(b.pill?.value??0));
        for(const one of held) {
            const dosed=swallowOrdinaryHeldQiMedicine(world,prepared,one.row.id,day);
            if(dosed)prepared=dosed;
            if(qiStandingOn(prepared,day)>=launchCost)break;
        }
        // Medicine already taken remains on the actual body even if a native
        // poison wound or the still-short balance prevents departure.
        if(!quoteNpcAirDeparture(world,prepared,toId,day,vehicle,true,requestedArt))return prepared;
    }
    const charged=vehicle?{...prepared,spiritStones:prepared.spiritStones-read.quote.stonesBurned}
        :read.art?useAnNpcArt(prepared,read.art.id,day):spendNpcQi(prepared,launchCost,day);
    if(!charged) return null;
    const accepted=beginAnAirCourse(world,{bodyId:npc.id,bodyName:npc.name,fromId:read.from.id,
        toId:read.to.id,conveyanceId:read.craft.id,power:vehicle?.power??null,vesselId:vehicle?.id??null,
        artId:read.art?.id??null,onDay:day,heads:1,...(vehicle?{owned:{ownerId:npc.id,pilotId:npc.id}}:{})});
    if(!accepted) throw new Error('Validated actual NPC air departure lost its course');
    if(vehicle) recordPaidAirCourseFuel(world,accepted.fact.id,npc.id,
        day+read.quote.daysOneWay,read.quote.stonesBurned);
    return {...charged,locationId:accepted.location.id,activity:{kind:'travelling',note,withIds:[],
        sinceDay:day,untilDay:day+read.quote.daysOneWay,fromLocationId:read.from.id,returnTo:read.to.id,
        conveyanceId:read.craft.id,conveyancePower:vehicle?.power??null,vesselId:vehicle?.id??null,
        airCourseLocationId:accepted.location.id},updatedOnDay:day};
}
