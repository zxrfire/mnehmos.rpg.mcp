/** Actual diagnostic72306: a requested B-to-midpoint four-day return stopped
 * after one day. Displayed corridor ground then let a new A target quote four
 * instead of the actual seven. The real actor/fight interruption remains valid.
 * These quiet geometry controls isolate that distance error; they do not claim
 * uninterrupted played travel. New cursors preserve actual admitted edge progress,
 * reverse uses canonical directed admission/cost, and old unknown origin is
 * deliberately not migrated. Caller and current-scene candidate controls now accompany these measures; runtime verification remains pending.
 */
import { expect, it } from 'vitest';
import { makeLocation, linkLocations, walkingRouteFrom, walkingDaysFrom, walkingStepDays } from '../../../src/engine/world/locations.js';
import { positionOnRoad, roadContinuationTo, positionAfterRoadContinuation } from '../../../src/engine/world/road-course.js';
function ground() {
    const a=makeLocation({id:'a',name:'Departure',kind:'settlement'});
    const m=makeLocation({id:'m',name:'Intermediate',kind:'wilds'});
    const b=makeLocation({id:'b',name:'Destination',kind:'settlement'});
    linkLocations(a,m,'road',4);linkLocations(m,b,'road',4);
    return {a,m,b,locations:[a,m,b]};
}
it('one day from B toward midpoint means seven to A, three to midpoint and one back to B',()=>{
    const {locations}=ground(),route=walkingRouteFrom(locations,'b','m')!;
    const at=positionOnRoad(route,1);
    expect(roadContinuationTo(locations,at,'a')!.days).toBe(7);
    expect(roadContinuationTo(locations,at,'m')!.days).toBe(3);
    expect(roadContinuationTo(locations,at,'b')!.days).toBe(1);
    expect(at).toMatchObject({kind:'edge',originLocationId:'b',fromId:'b',toId:'m',fraction:.25});
    const course=roadContinuationTo(locations,at,'a')!;
    expect(positionAfterRoadContinuation(course,2)).toMatchObject({kind:'edge',fromId:'b',toId:'m',fraction:.75});
    expect(positionAfterRoadContinuation(course,3)).toMatchObject({kind:'place',locationId:'m'});
    expect(positionAfterRoadContinuation(course,7)).toMatchObject({kind:'place',locationId:'a'});
});
it('prices a real asymmetric reverse edge instead of dividing the original cost',()=>{
    const {locations,m}=ground();m.links.find(l=>l.toLocationId==='b')!.travelDays=12;
    const at=positionOnRoad(walkingRouteFrom(locations,'b','m')!,1);
    const back=roadContinuationTo(locations,at,'b')!;
    expect(back.days).toBe(3);
    expect(positionAfterRoadContinuation(back,1)).toMatchObject({kind:'edge',fromId:'m',toId:'b',admittedDays:12});
    expect((positionAfterRoadContinuation(back,1) as { fraction: number }).fraction).toBeCloseTo(5/6,14);
    expect(positionAfterRoadContinuation(back,3)).toMatchObject({kind:'place',locationId:'b'});
});
it('never mistakes an indirect detour for an admitted reverse edge',()=>{
    const {locations,a,m,b}=ground();m.links.find(l=>l.toLocationId==='b')!.open=false;
    linkLocations(a,b,'road',8);
    expect(walkingRouteFrom(locations,'m','b')!.at(-1)!.days).toBe(12);
    expect(walkingStepDays(locations,'m','b')).toBeNull();
    const at=positionOnRoad(walkingRouteFrom(locations,'b','m')!,1);
    expect(roadContinuationTo(locations,at,'b')).toMatchObject({endpointId:'m',partialDays:3,days:15});
});
it('keeps the original admitted forward edge despite its later closure',()=>{
    const {locations,b}=ground(),at=positionOnRoad(walkingRouteFrom(locations,'b','m')!,1);
    b.links.find(l=>l.toLocationId==='m')!.open=false;
    expect(roadContinuationTo(locations,at,'m')!.days).toBe(3);
});
it('shared directed steps retain canonical path costs and ordered tie choice',()=>{
    const {locations,a,b}=ground();linkLocations(a,b,'road',8);
    expect(walkingRouteFrom(locations,'a','b')).toEqual([{locationId:'a',days:0},{locationId:'b',days:8}]);
    const quote=walkingDaysFrom(locations,'a');quote.set('b',99);
    expect(walkingDaysFrom(locations,'a').get('b')).toBe(8);
    const route=walkingRouteFrom(locations,'a','m')!;
    expect(positionOnRoad(route,0)).toMatchObject({kind:'place',locationId:'a'});
    expect(positionOnRoad(route,4)).toMatchObject({kind:'place',locationId:'m'});
});
