/** Native76319 measured a forgotten driver erasing the reached .25 road point,
 * followed by an origin station selling the same recovered hull. The site now
 * holds the immutable physical point. Canonical route reads must ask the CURRENT
 * actual directed edge for both partial endpoint continuations: closing, opening
 * or repricing that edge cannot leave an old permission/cost frozen on the site.
 * This pure graph control complements native death/no-rebooking controls; it
 * neither manufactures a crew nor forces an encounter or a consent result. */
import { expect, it } from 'vitest';
import { makeLocation, walkingRouteFrom, walkingStepDays } from '../../../src/engine/world/locations.js';
import { groundWhereACarriageStopped, stoppedRoadPoint } from '../../../src/engine/world/where-a-carriage-stopped.js';
import { metricGroundRead, initializeMetricGround } from '../../../src/engine/world/the-metric-ground-under-a-journey.js';
import { roadContinuationTo } from '../../../src/engine/world/road-course.js';
it('derives generic partial steps and played cursor reversal from current directed roads', () => {

 const a=makeLocation({id:'loss-road-a',name:'Willow Pass',kind:'wilds',data:{metricXLi:0,metricYLi:0},links:[{toLocationId:'loss-road-b',kind:'road',travelDays:8,requiresKeyId:null,open:true,note:''}]}),
 b=makeLocation({id:'loss-road-b',name:'Pine Pass',kind:'wilds',data:{metricXLi:800,metricYLi:0},links:[{toLocationId:a.id,kind:'road',travelDays:12,requiresKeyId:null,open:true,note:''}]});
 const world={locations:[a,b]};
 const point={kind:'edge' as const,originLocationId:a.id,fromId:a.id,toId:b.id,fraction:.25,admittedDays:8};
 const id=groundWhereACarriageStopped(world,'real-test-carriage',0,2,point,a.id),site=world.locations.find(row=>row.id===id)!;
 expect(site.parentId).toBeNull();expect(site.links).toHaveLength(0);
 expect(metricGroundRead(world.locations).point(id)).toEqual({xLi:200,yLi:0});
 initializeMetricGround(world.locations,'unchanged-actual-ground');
 expect(site.data.metricXLi).toBeUndefined();expect(site.data.metricYLi).toBeUndefined();
 expect(walkingStepDays(world.locations,id,b.id)).toBe(6);expect(walkingStepDays(world.locations,id,a.id)).toBe(3);
 b.links[0]!.open=false;
 expect(walkingStepDays(world.locations,id,a.id)).toBeNull();expect(walkingRouteFrom(world.locations,id,a.id)).toBeNull();
 expect(roadContinuationTo(world.locations,point,a.id)).toBeNull();
 a.links[0]!.open=false;expect(walkingRouteFrom(world.locations,id,b.id)).toBeNull();
 b.links[0]!.open=true;b.links[0]!.travelDays=20;
 expect(walkingStepDays(world.locations,id,a.id)).toBe(5);expect(walkingRouteFrom(world.locations,id,a.id)?.at(-1)?.days).toBe(5);
 expect(roadContinuationTo(world.locations,point,a.id)?.days).toBe(5);
 expect(stoppedRoadPoint(world.locations,id)).toEqual(point);
 expect(metricGroundRead(world.locations).point(id)).toEqual({xLi:200,yLi:0});
});
