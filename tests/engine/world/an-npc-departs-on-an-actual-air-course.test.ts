/** Oct7 NPC travel audit: PC direct geometry alone left the native NPC journey
 * starter pricing a spirit boat's walking detour. This controlled ordinary
 * WorldState gives actual exterior anchors an unrelated twelve-day road.
 * The native starter must produce a real world-clock air receipt, one actual
 * finite launch/fuel charge, an airborne physical site, and a living arrival.
 * This proves the generic journey entry. Board acceptance and multi-leg duties
 * have separate controls in capital-mission-journeys and the mission-board tests. */
import { expect,it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc,setRealm,maxQiOf,theWorldEnds } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { startNpcJourney } from '../../../src/engine/world/dao-ground-stints.js';
import { airPositionAt,settleWorldAirTravellers,stopPersonalNpcAirCourseAtDeath } from '../../../src/engine/world/an-air-course-in-the-world.js';
import { settleNpcDeath } from '../../../src/engine/world/time.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { routineTime } from '../../../src/engine/world/npc-routines.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';

function fixture(){
    const world=createWorld({seed:'actual-npc-air-departure',regionCount:0,skipPriorAges:true});
    world.currentHour=8;
    const from=makeLocation({id:'actual-npc-from',name:'Departure ground',kind:'wilds',
        data:{metricXLi:0,metricYLi:0,metricExtentLi:3}});
    const to=makeLocation({id:'actual-npc-to',name:'Destination ground',kind:'wilds',
        data:{metricXLi:48,metricYLi:64,metricExtentLi:3}});
    from.links.push({toLocationId:to.id,kind:'road',travelDays:12,open:true,requiresKeyId:null,note:''});
    world.locations.push(from,to);
    const day=routineTime(world),npc=setRealm(createNpc(world.seed,{id:'actual-flying-person',name:'Actual traveller',
        locationId:from.id,onDay:day,bornOnDay:day-100*365}),29,day);
    // A native timed undertaking is active; ordinary sleep/errand sampling
    // cannot be replaced with a fabricated present-array fixture.
    npc.activity={kind:'their_practice',note:'Preparing the actual journey',withIds:[],sinceDay:day,untilDay:day+1};
    world.npcs.push(npc);return {world,npc,from,to,day};
}

/** The walk-out certification's new arrival check found no receipt. Native air
 * landfall moved the body but did not enter the shared actual-arrival authority.
 * Prove that seam directly, before any later generic journey cleanup. */
it('certification regression: native air landfall records one actual arrival, never a booking',()=>{
    const h=fixture(),travelling=startNpcJourney(h.world,h.npc,h.to.id,h.day,'An actual ground visit');
    h.world.npcs[0]=travelling;
    const leg=travelling.activity!;
    expect(leg.airCourseLocationId).toBeDefined();
    const arrivals=()=>h.world.history.facts.filter(fact=>fact.data.actualBodyArrival===true&&fact.data.bodyId===h.npc.id);
    settleWorldAirTravellers(h.world,h.day);
    expect(arrivals()).toEqual([]);
    settleWorldAirTravellers(h.world,leg.untilDay!);
    expect(h.world.npcs[0]!.locationId).toBe(h.to.id);
    expect(arrivals()).toHaveLength(1);
    expect(arrivals()[0]!.data).toMatchObject({fromLocationId:h.from.id,toLocationId:h.to.id,
        departureDay:leg.sinceDay,arrivalDay:leg.untilDay});
    settleWorldAirTravellers(h.world,leg.untilDay!+1);
    expect(arrivals()).toHaveLength(1);
});

it('the generic NPC starter charges once and reaches a metric target while alive',()=>{
    const h=fixture(),before=h.npc.cultivation.qi;
    if(before===undefined)throw new Error('Native new NPC has no qi balance');
    const travelling=startNpcJourney(h.world,h.npc,h.to.id,h.day,'An actual ground visit');
    h.world.npcs[0]=travelling;
    const site=h.world.locations.find(place=>place.id===travelling.locationId);
    if(!site?.tags.includes('air-course')||travelling.activity?.untilDay==null)throw new Error('NPC did not actually launch');
    expect(travelling.cultivation.qi).toBe(before-25);
    expect(travelling.cultivation.qi).toBeLessThan(maxQiOf(travelling));
    expect(travelling.activity.untilDay-h.day).toBeLessThan(12);
    const halfway=h.day+(travelling.activity.untilDay-h.day)/2;
    expect(airPositionAt(h.world,site,halfway)?.kind).toBe('air');
    expect(locationOnNpcJourney(h.world.locations,travelling,halfway)).toBe(site.id);
    settleWorldAirTravellers(h.world,travelling.activity.untilDay);
    expect(h.world.npcs[0]?.locationId).toBe(h.to.id);
    expect(h.world.npcs[0]?.cultivation.qi).toBe(before-25);
    expect(h.from.links[0]?.travelDays).toBe(12);
});

/** The century census found three people stranded on accepted air-course
 * records: the generic return cleared their binding before settling arrival. */
it('a background world span settles the actual air arrival before clearing the journey',()=>{
    const h=fixture(),travelling=startNpcJourney(h.world,h.npc,h.to.id,h.day,'An actual ground visit');
    h.world.npcs[0]=travelling;
    expect(travelling.activity?.airCourseLocationId).toBeDefined();
    advanceWorldForPlay(h.world,{days:100,pressure:{intensity:0,peopleWalkOutOnTheirOwnAccount:false}});
    expect(h.world.npcs.find(person=>person.id===h.npc.id)!.locationId).toBe(h.to.id);
    expect(h.world.npcs.find(person=>person.id===h.npc.id)!.activity?.airCourseLocationId).toBeUndefined();
});

it('a personal NPC death freezes the actual point before later estate/location reads',()=>{
    const h=fixture(),travelling=startNpcJourney(h.world,h.npc,h.to.id,h.day,'An actual ground visit');
    const site=h.world.locations.find(place=>place.id===travelling.locationId);
    if(!site?.tags.includes('air-course')||travelling.activity?.untilDay==null)throw new Error('NPC did not actually launch');
    const deathDay=h.day+(travelling.activity.untilDay-h.day)/2;
    const before=airPositionAt(h.world,site,deathDay);
    const dead=theWorldEnds(travelling,deathDay,'Actual native body death control');
    if(!dead)throw new Error('Native body death control was refused');
    h.world.npcs[0]=dead;
    const carried=makeObject({id:'actual-airborne-belonging',name:'An actual carried belonging',kind:'artifact',
        ownerId:dead.id,possessorId:dead.id,locationId:site.id});
    h.world.objects.push(carried);
    stopPersonalNpcAirCourseAtDeath(h.world,dead,deathDay);
    settleNpcDeath(h.world,dead,deathDay);
    settleWorldAirTravellers(h.world,deathDay+100);
    expect(h.world.npcs[0]?.locationId).toBe(site.id);
    expect(airPositionAt(h.world,site,deathDay+100)?.point).toEqual(before?.point);
    expect(h.world.npcs[0]?.locationId).not.toBe(h.to.id);
    expect(h.world.objects.find(row=>row.id===carried.id)?.locationId).toBe(site.id);
    expect(h.world.objects.find(row=>row.id===carried.id)?.ownerId).toBe(dead.id);
});
