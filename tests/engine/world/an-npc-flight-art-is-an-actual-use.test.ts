/** Oct7 actual NPC flight arts: techniqueIds existed, but the starter could
 * only spend an innate launch. Actual catalog school/rung eligibility, qi,
 * cooldown and held ordinary medicine must precede a real course. No passive
 * refill or nominal route admission stands in for actual use. The existing
 * starter returns a prepared body when medicine is absent/still insufficient;
 * absence of a course and unchanged native resources are the honest oracle,
 * not a made-up null-return contract. Native spending and world elapsed time
 * prepare the exhausted-but-ready control rather than writing a free balance. */
import {expect,it} from 'vitest';
import {createWorld} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm,maxQiOf,spendNpcQi,qiStandingOn} from '../../../src/engine/world/npc-state.js';
import {advanceWorldForPlay} from '../../../src/engine/world/driver.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {startNpcAirJourney} from '../../../src/engine/world/an-actual-npc-air-course.js';
import {useAnNpcArt} from '../../../src/engine/world/the-arts-an-npc-has-spent.js';
import {TECHNIQUES,getTechnique} from '../../../src/data/cultivation/techniques.js';
import {primaryRoadOf} from '../../../src/schema/cultivation.js';
import {PILLS} from '../../../src/data/cultivation/pills.js';
import {isSettledOnUse} from '../../../src/engine/cultivation/grade-spread.js';
import {routineTime} from '../../../src/engine/world/npc-routines.js';
import {makeObject} from '../../../src/engine/world/possessions.js';
function fixture(id:string){const world=createWorld({seed:'actual-npc-held-art',regionCount:0,skipPriorAges:true});
 const from=makeLocation({id:'art-from',name:'Actual departure',kind:'wilds',data:{metricXLi:0,metricYLi:0}}),
 to=makeLocation({id:'art-to',name:'Actual destination',kind:'wilds',data:{metricXLi:80,metricYLi:0}});
 world.currentHour=8;world.locations.push(from,to);const art=getTechnique(id);if(!art)throw Error('Actual movement art missing');
 const school=TECHNIQUES.find(row=>row.id!==id&&primaryRoadOf(row)===primaryRoadOf(art));
 if(!school)throw Error('Actual school art missing');const day=routineTime(world);
 const native=setRealm(createNpc(world.seed,{id:'actual-art-person',name:'Actual art user',locationId:from.id,onDay:day,
  bornOnDay:day-100*365}),art.requiredOrdinal,day);
 const npc={...native,cultivation:{...native.cultivation,qi:maxQiOf(native),techniqueIds:[id,school.id]},
  activity:{kind:'their_practice' as const,note:'Preparing actual flight',withIds:[],sinceDay:day,untilDay:day+10}};
 world.npcs.push(npc);return {world,npc,art,to,day};}
for(const id of ['gale-riding-sword-flight','thousand-li-cloud-tread'])it('actual launch debits and records the real movement art '+id,()=>{
 const h=fixture(id),before=h.npc.cultivation.qi,launched=startNpcAirJourney(h.world,h.npc,h.to.id,h.day,'Actual flight',undefined,id);
 expect(launched?.cultivation.qi).toBe(before-h.art.qiCost);
 expect(launched?.cultivation.techniqueCooldowns?.[id]).toBe(h.art.cooldown);
 expect(h.world.locations.find(place=>place.id===launched?.locationId)?.tags).toContain('air-course');
});
it('cooldown refuses before medicine or a course; an exhausted ready body needs an actual held dose',()=>{
 const h=fixture('gale-riding-sword-flight'),used=useAnNpcArt(h.npc,h.art.id,h.day);if(!used)throw Error('Native art was not used');
 const pill=PILLS.find(row=>row.effect==='restore_qi'&&isSettledOnUse(row.grade)&&row.potency>=h.art.qiCost);if(!pill)throw Error('Actual ordinary qi medicine absent');
 const medicine=makeObject({id:'actual-held-dose',name:pill.name,kind:'pill',possessorId:used.id,ownerId:used.id,
  locationId:used.locationId,data:{pillId:pill.id}});h.world.objects.push(medicine);
 const exhausted=spendNpcQi(used,qiStandingOn(used,h.day),h.day);if(!exhausted)throw Error('Actual pool could not be exhausted');
 const count=h.world.locations.length;
 expect(startNpcAirJourney(h.world,exhausted,h.to.id,h.day,'Unavailable art',undefined,h.art.id)).toBeNull();
 expect(h.world.objects[0]).toEqual(medicine);expect(h.world.locations).toHaveLength(count);
 h.world.npcs[0]=exhausted;h.world.objects=[];
 advanceWorldForPlay(h.world,{days:3,preciseDays:true});
 const ready=h.world.npcs.find(person=>person.id===exhausted.id);if(!ready)throw Error('Native elapsed interval lost actual body');
 const readyDay=routineTime(h.world);
 expect(ready.cultivation.qi).toBe(0);expect(ready.cultivation.techniqueCooldowns?.[h.art.id]).toBe(0);
 const beforeReady=structuredClone(ready),beforeLocations=h.world.locations.length;
 const undosed=startNpcAirJourney(h.world,ready,h.to.id,readyDay,'No actual held medicine',undefined,h.art.id);
 expect(undosed).toEqual(ready);
 expect(ready).toEqual(beforeReady);expect(h.world.locations).toHaveLength(beforeLocations);
 h.world.objects.push(medicine);
 const dosed=startNpcAirJourney(h.world,ready,h.to.id,readyDay,'Actual finite dose',undefined,h.art.id);
 expect(dosed).not.toBeNull();expect(h.world.objects[0]).not.toEqual(medicine);
 expect(dosed?.cultivation.techniqueCooldowns?.[h.art.id]).toBe(h.art.cooldown);
});
