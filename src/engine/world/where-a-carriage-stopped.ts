/** A dated loss creates ordinary reached ground, not an origin recovery. The
 * location holds one immutable admitted point; current bodies only reference it. */
import { makeLocation, type LocationRecord } from './locations.js';
import { sameRoadPosition, type RoadPosition } from './road-course.js';
import type { WorldState } from './world-state.js';
export function stoppedRoadPoint(locations:readonly LocationRecord[],id:string|null):RoadPosition|null {
 const text=locations.find(row=>row.id===id)?.data.stoppedRoadPoint;
 if(typeof text!=='string')return null;
 try { const p=JSON.parse(text) as RoadPosition;
  return p.kind==='edge'&&typeof p.originLocationId==='string'&&typeof p.fromId==='string'&&typeof p.toId==='string'
   &&Number.isFinite(p.fraction)&&p.fraction>0&&p.fraction<1&&Number.isFinite(p.admittedDays)&&p.admittedDays>0?p:null;
 }catch{return null;}
}
export function groundWhereACarriageStopped(world:Pick<WorldState,'locations'>,vesselId:string,departureDay:number,day:number,point:RoadPosition,coarseId:string):string {
 if(point.kind==='place')return point.locationId;
 const shared=world.locations.find(row=>sameRoadPosition(stoppedRoadPoint(world.locations,row.id),point));
 if(shared)return shared.id;
 const id='loc-carriage-stop:'+JSON.stringify([vesselId,departureDay,day]);
 if(world.locations.some(row=>row.id===id))return id;
 const from=world.locations.find(row=>row.id===point.fromId),to=world.locations.find(row=>row.id===point.toId),ground=world.locations.find(row=>row.id===coarseId);
 if(!from||!to||!ground)throw Error('An admitted road point must retain its real ground and endpoints.');
 const stop=makeLocation({id,name:'On the road between '+from.name+' and '+to.name+' ('+String(point.fraction*100)+'% from '+from.name+')',kind:'wilds',layer:ground.layer,parentId:null,
  ambient:ground.ambient,qiDensity:ground.qiDensity,hazards:[...ground.hazards],tags:['route-stop','stopped-carriage'],
  data:{stoppedRoadPoint:JSON.stringify(point),vesselId,departureDay,stoppedOnDay:day},
  links:[]});
 world.locations.push(stop);return id;
}
