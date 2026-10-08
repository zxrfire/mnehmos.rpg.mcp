/** An intermediate market need not coincide with a daily/native encounter grid.
 * Exact dates come from existing directed route/cursor geometry, not new links.
 * A partial initial edge must finish before route[0]; already reached moments
 * are naturally excluded by the existing clock boundary reader. No airborne
 * route semantics are asserted here. Native sibling checks actual SQL/driver.
 */
import { expect, it } from 'vitest';
import { makeLocation, linkLocations, walkingRouteFrom } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { locationOnNpcJourney, roadPositionOfNpc, locationOnRoute } from '../../../src/engine/world/places-on-the-way.js';
import { positionOnRoad, positionAfterRoadContinuation, roadContinuationAhead, roadVertexMoments } from '../../../src/engine/world/road-course.js';
it('projects exact intermediate dates for ground speed and the admitted partial initial edge',()=>{
    const a=makeLocation({id:'vertex-a',name:'A',kind:'settlement'});
    const b=makeLocation({id:'vertex-b',name:'B',kind:'settlement'});
    const c=makeLocation({id:'vertex-c',name:'C',kind:'settlement'});
    linkLocations(a,b,'road',4);linkLocations(b,c,'road',3);
    const places=[a,b,c],route=walkingRouteFrom(places,a.id,c.id)!;
    expect(roadVertexMoments(route,10,7)).toEqual([14,17]);
    expect(roadVertexMoments(route,10,3.5)).toEqual([12,13.5]);
    const course=roadContinuationAhead(places,positionOnRoad(route,1),c.id)!;
    expect(course.partialDays).toBe(3);
    expect(roadVertexMoments(course.route,10,course.days,course.partialDays)).toEqual([13,16]);
    const departure=365000+1/3;
    const dates=roadVertexMoments(route,departure,3.5);
    expect(locationOnRoute(places,a.id,c.id,dates[0]!-departure,3.5)).toBe(b.id);
    expect(locationOnRoute(places,a.id,c.id,dates[0]!-departure-.01,3.5)).not.toBe(b.id);
    expect(route.map(stop=>[stop.locationId,stop.days])).toEqual([[a.id,0],[b.id,4],[c.id,7]]);
});

it('a nonintegral dated vertex agrees for the NPC ground and the sole course position',()=>{
    const a=makeLocation({id:'dated-a',name:'A',kind:'settlement'});
    const b=makeLocation({id:'dated-b',name:'B',kind:'settlement'});
    const c=makeLocation({id:'dated-c',name:'C',kind:'settlement'});
    linkLocations(a,b,'road',.3125);linkLocations(b,c,'road',.4375);
    const places=[a,b,c],route=walkingRouteFrom(places,a.id,c.id)!;
    const departure=365000+1/3,day=roadVertexMoments(route,departure,1)[0]!;
    const npc=createNpc('dated-vertex',{id:'dated-driver',name:'Driver',locationId:a.id,
        onDay:departure,bornOnDay:departure-20*365});
    npc.activity={kind:'travelling',fromLocationId:a.id,returnTo:c.id,sinceDay:departure,
        untilDay:departure+1,note:'Driving this actual dated road.',withIds:[]};
    expect(locationOnNpcJourney(places,npc,day)).toBe(b.id);
    expect(roadPositionOfNpc(places,npc,day)?.kind).toBe('place');
    expect(locationOnNpcJourney(places,npc,day-.001)).not.toBe(b.id);
    const course=roadContinuationAhead(places,positionOnRoad(route,0),c.id)!;
    const footVertex=roadVertexMoments(course.route,departure,course.days)[0]!;
    expect(positionAfterRoadContinuation(course,footVertex-departure,departure))
        .toEqual({kind:'place',originLocationId:a.id,locationId:b.id});
});
