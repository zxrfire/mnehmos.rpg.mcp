/**
 * Oct7 direct-flight prototype: the old aerial read priced and occupied a road
 * detour. This controlled 80-li exterior pair has an unrelated 12-day road;
 * native geometry/conveyance pricing supplies the actual course duration.
 * A caused interruption freezes the actual reached point while later clocks
 * continue. The ordinary physical site stores only receipt/stop references,
 * so a corpse or object can remain there without an invented landing.
 * These are source-review controls, unrun; no model acceptance is claimed.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { beginAnAirCourse, airPositionAt, stopAnAirCourse, recordPaidAirCourseFuel, paidAirCourseThrough, settleNpcPilotedAirCourses } from '../../../src/engine/world/an-air-course-in-the-world.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { aVehicleOf, takeItAlong } from '../../../src/engine/world/a-vehicle.js';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { metricGroundRead } from '../../../src/engine/world/the-metric-ground-under-a-journey.js';
import { witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';

it('a stopped actual airborne site retains its reached point rather than either endpoint', () => {
    const world = createWorld({seed:'actual-air-point', regionCount:0, skipPriorAges:true});
    const from = makeLocation({id:'from', name:'Departure ground', kind:'settlement',
        data:{metricXLi:0,metricYLi:0,metricExtentLi:3}});
    const to = makeLocation({id:'to', name:'Destination ground', kind:'settlement',
        data:{metricXLi:48,metricYLi:64,metricExtentLi:3}});
    from.links.push({toLocationId:to.id,kind:'road',travelDays:12,open:true,requiresKeyId:null,note:''});
    world.locations.push(from,to);
    const accepted = beginAnAirCourse(world,{bodyId:'body',bodyName:'Flying body',fromId:from.id,toId:to.id,
        conveyanceId:'conv-body-flight',power:null,vesselId:null,artId:null,onDay:world.currentDay,
        runId:'actual-run',runElapsedDays:0,heads:1});
    if (!accepted) throw new Error('Controlled metric endpoints did not quote');
    expect(accepted.quote.distanceLi).toBe(80);
    const half = world.currentDay + accepted.quote.daysOneWay / 2;
    const position = airPositionAt(world,accepted.location,half);
    expect(position?.kind).toBe('air');
    expect(position?.point).toEqual({xLi:24,yLi:32});
    const stop = stopAnAirCourse(world,accepted.location,half,'Actual native interruption');
    expect(stop?.causes).toContain(accepted.fact.id);
    expect(airPositionAt(world,accepted.location,half+100)?.point).toEqual(position?.point);
    expect(airPositionAt(world,accepted.location,half+100)?.kind).toBe('air');
    expect(accepted.location.links).toEqual([]);
    expect(accepted.location.data.metricXLi).toBeUndefined();
    expect(accepted.location.data.metricYLi).toBeUndefined();
    expect(metricGroundRead(world.locations,{facts:witnessIndexFor(world).byId,onDay:half+100})
        .point(accepted.location.id)).toEqual(position?.point);
    expect(from.links[0]?.travelDays).toBe(12);
});

/** These component arrangements explicitly debit the actual NPC's native fuel.
 * They prove paid-course/operator/physical-point accounting, not that NPC mission
 * acceptance or a player dialogue has already reached this new air-course path.
 * The unfunded control preserves a living operator and genuine hull custody:
 * neither is authorization to charge a former owner's bill to that operator. */
for (const funded of [false, true]) it('a real living hull operator needs actual committed fuel: '+funded, () => {
    const world = createWorld({seed:'funded-air-hull', regionCount:0, skipPriorAges:true});
    const from = makeLocation({id:'fuel-from',name:'Departure ground',kind:'settlement',
        data:{metricXLi:0,metricYLi:0,metricExtentLi:3}});
    const to = makeLocation({id:'fuel-to',name:'Destination ground',kind:'settlement',
        data:{metricXLi:48,metricYLi:64,metricExtentLi:3}});
    world.locations.push(from,to);
    const pilot = setRealm(createNpc(world.seed,{id:'actual-pilot',name:'Actual pilot',locationId:from.id,
        onDay:world.currentDay,bornOnDay:world.currentDay-100*365}),29,world.currentDay);
    pilot.spiritStones=1000;
    world.npcs.push(pilot);
    const conveyance=requireConveyance('conv-spirit-boat');
    const craft=aVehicleOf({id:'actual-hull',conveyanceId:conveyance.id,
        ownerId:pilot.id,ownerName:pilot.name,at:from.id});
    world.objects.push(craft);takeItAlong(world.objects,craft,pilot.id);
    const accepted=beginAnAirCourse(world,{bodyId:'former-passenger',bodyName:'Former passenger',
        fromId:from.id,toId:to.id,conveyanceId:conveyance.id,power:craft.power,vesselId:craft.id,
        artId:null,onDay:world.currentDay,runId:'actual-run',runElapsedDays:0,heads:1,
        owned:{ownerId:'former-passenger',pilotId:pilot.id}});
    if(!accepted)throw new Error('Real controlled hull did not quote');
    pilot.locationId=accepted.location.id;
    pilot.activity={kind:'travelling',note:'Accepted actual hull course',withIds:[],vesselId:craft.id,
        fromLocationId:from.id,returnTo:to.id,sinceDay:world.currentDay,
        untilDay:world.currentDay+accepted.quote.daysOneWay,airCourseLocationId:accepted.location.id};
    const before=pilot.spiritStones;
    if(funded){
        pilot.spiritStones-=accepted.quote.stonesBurned;
        recordPaidAirCourseFuel(world,accepted.fact.id,pilot.id,
            world.currentDay+accepted.quote.daysOneWay,accepted.quote.stonesBurned);
    }
    const checked=world.currentDay+accepted.quote.daysOneWay/2;
    settleNpcPilotedAirCourses(world,checked);
    if(funded){
        expect(paidAirCourseThrough(world,accepted.fact.id)).toBe(world.currentDay+accepted.quote.daysOneWay);
        expect(airPositionAt(world,accepted.location,checked)?.fraction).toBe(.5);
        expect(accepted.location.data.airStoppedFactId).toBeNull();
        expect(pilot.spiritStones).toBe(before-accepted.quote.stonesBurned);
    }else{
        expect(paidAirCourseThrough(world,accepted.fact.id)).toBe(world.currentDay);
        expect(typeof accepted.location.data.airStoppedFactId).toBe('string');
        expect(airPositionAt(world,accepted.location,checked)?.fraction).toBe(0);
        expect(pilot.spiritStones).toBe(before);
    }
});
