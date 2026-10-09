/** A travel year cost 21.63 seconds because each departure dealt the entire
 * population into areas and rebuilt the dock board. Facility selection needs
 * the same first area, independent of occupancy. Timetable reuse must preserve
 * fractional dates, current geography and independent mutable results, including
 * generated lanes. The lane-mutation assertion failed before copying those lanes.
 * Red-checked: omitting the crew-tag guard admits a full hull after existing
 * hands join its crew through an in-place tag change. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, placeScopeFor, routeQueriesFor, linkLocations } from '../../../src/engine/world/locations.js';
import { departureAreaAt, theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { publicShipLinesFrom, quotePublicPassage, theLandfall } from '../../../src/engine/world/public-shipping.js';
import { REGIONS, isOpenWater } from '../../../src/data/cultivation/regions.js';
import { SEA_LANES } from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { laneIsOpenInMonth } from '../../../src/engine/world/what-a-sea-crossing-costs.js';
import { monthOf } from '../../../src/engine/world/the-fare-and-calendar-of-a-passage.js';
import { worldLocationFor } from '../../../src/engine/world/place-lookup.js';
import { departureSceneFor, readActualDepartureApproach } from '../../../src/engine/world/departure-approach.js';
import { publicWatchTargetsTogether } from '../../../src/engine/world/where-a-house-keeps-its-public-watch.js';
import { SPAN_ROUTES, THE_SPAN_HOUSE_ID } from '../../../src/engine/world/where-the-measured-span-still-answers.js';
import { routineOf, routineLocationOf } from '../../../src/engine/world/npc-routines.js';
import { shipIdForLane } from '../../../src/engine/world/the-ship-on-a-lane.js';
import { shipHandsForHull } from '../../../src/engine/world/a-public-ship-hull.js';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { aVehicleOf } from '../../../src/engine/world/a-vehicle.js';

function docks() {
    const world=createWorld({seed:'checked-departure-scopes',regionCount:0,skipPriorAges:true});
    const sea=REGIONS.find(region=>isOpenWater(region.id))!;
    const water=makeLocation({id:'water',name:sea.name,kind:'region',data:{catalogRegionId:sea.id}});
    const port=makeLocation({id:'port',name:'Reed Lantern Anchorage',kind:'settlement',parentId:water.id});
    const other=makeLocation({id:'other-port',name:'Cloud Pine Anchorage',kind:'settlement',parentId:water.id});
    world.locations.push(water,port,other);
    return {world,water,port,other};
}

it('selects exactly the first real facility that the occupied scene exposes',()=>{
    const {world,port}=docks();
    for(let index=0;index<8;index++)world.npcs.push(createNpc(world.seed,{id:'local-'+index,
        locationId:port.id,onDay:world.currentDay,bornOnDay:world.currentDay-20*365}));
    for(const hour of [8,17,22]){
        world.currentHour=hour;
        for(const kind of ['landing','spirit_berth','carriage_station'] as const)
            expect(departureAreaAt(world,port,kind)).toEqual(theAreasOf(world,port).areas.find(area=>area.for===kind));
    }
    world.objects.push(aVehicleOf({id:'local-air-hull',conveyanceId:'conv-spirit-boat',
        ownerId:'local-0',ownerName:'The holder',at:port.id}));
    expect(departureAreaAt(world,port,'spirit_berth')).toEqual(theAreasOf(world,port).areas.find(area=>area.for==='spirit_berth'));
    expect(departureAreaAt(world,port,'spirit_berth')).toBeDefined();
});

it('keeps same-day fractional openings and independent ship-board results',()=>{
    const lane=SEA_LANES.find(row=>row.openMonthsPerYear<12)!;
    const here=theLandfall(lane.fromPlace)!;
    const closed=Array.from({length:365},(_,day)=>day).find(day=>!laneIsOpenInMonth(lane,monthOf(day)))!;
    const first=publicShipLinesFrom(null,here,closed);
    const quoted=publicShipLinesFrom(null,here,closed+.375).find(row=>row.lane.id===lane.id)!;
    let opening=closed+.375;
    while(!laneIsOpenInMonth(lane,monthOf(opening)))opening++;
    expect(quoted.runsFromDay).toBe(opening);
    first[0]!.to='Changed by this reader';first[0]!.cashPerSeat=0;first.push(first[0]!);
    const again=publicShipLinesFrom(null,here,closed);
    expect(again.some(row=>row.to==='Changed by this reader')).toBe(false);
    expect(again.length).toBe(first.length-1);
    expect(again.every(row=>row.cashPerSeat>0)).toBe(true);
    const {world,port}=docks();
    const passage=publicShipLinesFrom(world,port.name,42).find(row=>row.lane.id.startsWith('passage-'))!;
    const expected={...passage.lane,intermediateLandfallDays:passage.lane.intermediateLandfallDays.slice()};
    passage.lane.expectedDays=99;passage.lane.intermediateLandfallDays=[77];
    expect(publicShipLinesFrom(world,port.name,42).find(row=>row.to===passage.to)!.lane).toEqual(expected);
});

it('rereads changed docks and seeds exactly as a fresh geography read does',()=>{
    const {world,port,other}=docks();
    const check=()=>expect(publicShipLinesFrom(world,port.name,42.25,placeScopeFor(world.locations)))
        .toEqual(publicShipLinesFrom({...world,locations:structuredClone(world.locations)},port.name,42.25));
    check();other.name='The new anchorage';check();
    other.parentId=null;check();other.parentId=port.parentId;check();
    other.sealed=true;check();world.seed='another-dock-draw';check();
    const at=world.locations.indexOf(other);
    world.locations[at]={...other,controllingFactionId:'a-different-holder'};check();
});


it('retains old roads and dock answers while indexing a detached air course',()=>{
    const {world,port,other}=docks();
    linkLocations(port,other,'road',2);
    const places=placeScopeFor(world.locations),routes=routeQueriesFor(world.locations);
    const old=routes.treeFrom(port.id),board=publicShipLinesFrom(world,port.name,42.25,places);
    const air=makeLocation({id:'air-course',name:'A course above the water',kind:'wilds',tags:['air-course']});
    world.locations.push(air);
    expect(placeScopeFor(world.locations)).toBe(places);
    expect(routeQueriesFor(world.locations).treeFrom(port.id)).toBe(old);
    expect(worldLocationFor(world,air.name)).toBe(air);
    expect(routeQueriesFor(world.locations).treeFrom(air.id).days.has(port.id)).toBe(false);
    expect(publicShipLinesFrom(world,port.name,42.25)).toEqual(board);
    port.links[0]!.travelDays=7;
    expect(routeQueriesFor(world.locations).treeFrom(port.id).days.get(other.id)).toBe(7);
    const dock=makeLocation({id:'new-dock',name:'Willow Ferry',parentId:port.parentId,kind:'settlement'});
    world.locations.push(dock);
    expect(publicShipLinesFrom(world,port.name,42.25).some(line=>line.to===dock.name)).toBe(true);
});

it('does not treat an air course with an incoming road as detached',()=>{
    const {world,port}=docks();
    port.links.push({toLocationId:'later-air',kind:'path',travelDays:3,open:true,requiresKeyId:null,note:''});
    const routes=routeQueriesFor(world.locations);
    expect(routes.places.has('later-air')).toBe(false);
    world.locations.push(makeLocation({id:'later-air',name:'The joined course',kind:'wilds',tags:['air-course']}));
    const joined=routeQueriesFor(world.locations);
    expect(joined).not.toBe(routes);
    expect(joined.places.has('later-air')).toBe(true);
    expect(joined.treeFrom(port.id).days.get('later-air')).toBe(3);
});

it('shares one unchanged departure scene and rereads the next hour and activity',()=>{
    const {world,port}=docks();
    world.npcs=Array.from({length:8},(_,i)=>createNpc(world.seed,{id:'traveller-'+i,
        locationId:port.id,onDay:world.currentDay,bornOnDay:world.currentDay-20*365}));
    const routes=routeQueriesFor(world.locations),scene=departureSceneFor(world,routes);
    const request={intentId:'ship',target:{locationId:port.id,areaId:departureAreaAt(world,port,'landing',routes)!.id}};
    for(const day of [world.currentDay+.375,world.currentDay+.75])for(const npc of world.npcs){
        expect(readActualDepartureApproach(world,npc.id,request,day,undefined,routes,scene))
            .toEqual(readActualDepartureApproach(world,npc.id,request,day,undefined,routes));
    }
    const now=world.currentDay+.375;
    world.npcs[0]!.activity={kind:'out_with_a_party',note:'At the landing.',withIds:[],
        standingIn:request.target.areaId,sinceDay:now,untilDay:null};
    expect(readActualDepartureApproach(world,world.npcs[0]!.id,request,now,undefined,routes,
        departureSceneFor(world,routes)).kind).toBe('ready');
});

it('reads the same routine position during a redirect, return walk and ordinary journey',()=>{
    const {world,port,other}=docks();
    linkLocations(port,other,'road',4);
    const npc=createNpc(world.seed,{id:'walking',locationId:port.id,onDay:0,bornOnDay:-20*365});
    npc.activity={kind:'idle',note:'visiting',withIds:[],sinceDay:0,untilDay:null,returnTo:other.id,
        redirect:{until:1,returnDays:2,standingIn:port.id,previous:null}};
    world.npcs=[npc];
    for(const day of [.5,1,2,3,4]){
        world.currentDay=day;world.currentHour=(day%1)*24;
        expect(routineLocationOf(world,npc)).toBe(routineOf(world,npc).locationId);
    }
    npc.activity={kind:'travelling',note:'On the road.',withIds:[],sinceDay:0,untilDay:4,
        fromLocationId:port.id,returnTo:other.id};
    for(const day of [0,1,2,3,4]){
        world.currentDay=day;world.currentHour=(day%1)*24;
        expect(routineLocationOf(world,npc)).toBe(routineOf(world,npc).locationId);
    }
});


it('keeps watch projection current and independent after append and rename',()=>{
    const {world}=docks();
    const sites=publicWatchTargetsTogether(world);
    expect(sites.size).toBe(0);
    const terminal=makeLocation({id:'terminal',name:SPAN_ROUTES.find(route=>route.inheritedTerminal)!.fromPlace,
        kind:'wilds',tags:['air-course']});
    world.locations.push(terminal);
    const held=publicWatchTargetsTogether(world).get(THE_SPAN_HOUSE_ID)!;
    expect(held.some(place=>place.id===terminal.id)).toBe(true);
    held.splice(0);
    expect(publicWatchTargetsTogether(world).get(THE_SPAN_HOUSE_ID)).toHaveLength(1);
    terminal.name='An unstaffed stretch';
    expect(publicWatchTargetsTogether(world).size).toBe(0);
});

it('rebuilds an append with a duplicate identity exactly as a fresh graph does',()=>{
    const {world,port,other}=docks();
    linkLocations(port,other,'road',2);
    const routes=routeQueriesFor(world.locations);
    routes.treeFrom(port.id);
    const replacement=makeLocation({id:other.id,name:'A duplicate course',kind:'wilds',tags:['air-course']});
    world.locations.push(replacement);
    expect(placeScopeFor(world.locations).places.get(other.id)).toBe(replacement);
    const changed=routeQueriesFor(world.locations);
    expect(changed).not.toBe(routes);
    expect([...changed.treeFrom(port.id).days]).toEqual([...routeQueriesFor(structuredClone(world.locations)).treeFrom(port.id).days]);
});


it('rechecks current hull membership after in-place activity and crew-tag changes',()=>{
    const {world,port,other}=docks(),day=world.currentDay;
    const line=publicShipLinesFrom(world,port.name,day).find(row=>row.to===other.name)!;
    const vessel=shipIdForLane(line.lane),crew=1+shipHandsForHull(world.seed,vessel);
    const heads=requireConveyance('conv-water-ship').heads-crew;
    const quote=()=>quotePublicPassage(world,port.id,other.id,day,heads);
    expect(quote()).not.toBeNull();
    const npc=createNpc(world.seed,{id:'aboard',locationId:port.id,onDay:day,bornOnDay:day-20*365});
    npc.activity={kind:'travelling',note:'Aboard.',withIds:[],vesselId:vessel,seaLaneId:line.lane.id,
        fromLocationId:port.id,returnTo:other.id,sinceDay:day,untilDay:day+line.days};
    world.npcs.push(npc);
    expect(quote()).toBeNull();
    npc.activity.vesselId='another-hull';expect(quote()).not.toBeNull();
    npc.activity.vesselId=vessel;expect(quote()).toBeNull();
    npc.activity.kind='idle';
    expect(quote()).not.toBeNull();
    for(let index=0;index<crew+1;index++){
        const hand=createNpc(world.seed,{id:'hand-'+index,locationId:port.id,onDay:day,bornOnDay:day-20*365});
        hand.tags.push('crew-of:another-hull');world.npcs.push(hand);
    }
    expect(quote()).not.toBeNull();
    for(const hand of world.npcs.filter(person=>person.id.startsWith('hand-')))
        hand.tags[hand.tags.indexOf('crew-of:another-hull')]='crew-of:'+vessel;
    expect(quote()).toBeNull();
    for(const hand of world.npcs.filter(person=>person.id.startsWith('hand-')))
        hand.tags[hand.tags.indexOf('crew-of:'+vessel)]='crew-of:another-hull';
    expect(quote()).not.toBeNull();
    for(const hand of world.npcs.filter(person=>person.id.startsWith('hand-')))
        hand.tags[hand.tags.indexOf('crew-of:another-hull')]='crew-of:'+vessel;
    expect(quote()).toBeNull();
    expect(quote()).toEqual(quotePublicPassage({...world,npcs:structuredClone(world.npcs)},port.id,other.id,day,heads));
});
