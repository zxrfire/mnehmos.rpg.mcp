/** Combat11 native measured 199 PASS / 4 FAIL across 203 cases. The old
 * implicit selector could charge the damage-null partner ritual on a punch.
 * Shared authored combat roles preserve defensive projection and real offensive
 * work; rituals retain their separate people/work authority. The original
 * submission/road controls remain unchanged and their further diagnoses are
 * pending. These additive role controls are unrun, not acceptance claims. */
/** Oct7 source audit: native combatantOf supplied qi100 and bestArt checked
 * only held IDs/rung. Played opponents, native bouts, yard duels, war and escort
 * fights actually consumed that input, so a captain's spent launch art could
 * still be priced as ready. The sparse map must govern actual uses, not only
 * movement. These controls invoke existing numeric round/melee outcomes; no
 * prose, inferred damage, fixed winner or art-price formula supplies a cast.
 * Power reads are free; an unready art does not forbid ordinary striking.
 * Replay reads only the actual cast/exchange identity in existing history,
 * not a shadow qi balance. Native interval advancement alone restores
 * readiness; it does not restore spent qi. New controls unrun by worker. */
import {expect,it} from 'vitest';
import {createWorld} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm,maxQiOf,spendNpcQi,PLAYER_ROW_TAG} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {combatantOf} from '../../../src/engine/world/gatherings.js';
import {assessPower,resolveConfrontationRound,resolveMelee,reachOf,type RoundParty} from '../../../src/engine/cultivation/combat.js';
import {forStream} from '../../../src/engine/cultivation/rng.js';
import {getTechnique,TECHNIQUES} from '../../../src/data/cultivation/techniques.js';
import {writeTheNpcArtsActuallyUsed} from '../../../src/engine/world/the-arts-an-npc-actually-uses-in-a-fight.js';
import {useAnNpcArt} from '../../../src/engine/world/the-arts-an-npc-has-spent.js';
import {advanceWorldForPlay} from '../../../src/engine/world/driver.js';
import {routineTime} from '../../../src/engine/world/npc-routines.js';
import {AN_ORDINARY_SWING} from '../../../src/engine/cultivation/how-a-blow-was-thrown.js';
function fixture(wide=false){
 const world=createWorld({seed:'actual-npc-combat-art',regionCount:0,skipPriorAges:true});
 world.currentDay=1000;world.currentHour=0;
 const place=makeLocation({id:'actual-combat-ground',name:'Actual practice ground',kind:'wilds'});world.locations.push(place);
 const art=TECHNIQUES.find(row=>row.category==='attack'&&row.qiCost>0&&row.cooldown>0
  &&row.requiredOrdinal<29&&(!wide||reachOf(row)!=='single'));
 if(!art)throw Error('Actual eligible catalog combat art absent');
 const people=['actual-caster','actual-defender','actual-other-defender'].map((id,index)=>{
  const native=setRealm(createNpc(world.seed,{id,name:'Actual body '+index,onDay:world.currentDay,
   bornOnDay:world.currentDay-30*365,locationId:place.id}),Math.max(art.requiredOrdinal,15),world.currentDay);
  return {...native,cultivation:{...native.cultivation,qi:maxQiOf(native),techniqueIds:[art.id]},
   activity:{kind:'their_practice' as const,note:'Actual bounded practice',withIds:[],sinceDay:1000,untilDay:1100}};
 });world.npcs.push(...people);return {world,art,id:people[0]!.id,targetId:people[1]!.id};
}
function round(h:ReturnType<typeof fixture>,number=0){
 const person=h.world.npcs.find(n=>n.id===h.id),target=h.world.npcs.find(n=>n.id===h.targetId);
 if(!person||!target)throw Error('Native actual body missing');
 const input=combatantOf(person,h.world),against=combatantOf(target,h.world);
 const side=(body:typeof input,act:RoundParty['act']):RoundParty=>({input:body,power:assessPower(body,{ambient:'normal'}),
  act,edges:[],vector:'body'});
 return resolveConfrontationRound(side(input,'strike'),side(against,'guard'),
  {[input.id]:input.hp,[against.id]:against.hp},{[input.id]:[],[against.id]:[]},
  {rng:forStream(h.world.seed,'actual-cast-control',number),ambient:'normal',turn:number+1,
   opening:false,fromConcealment:false,willWithdraw:false});
}
it('pricing reads actual ready qi and leaves the body and history untouched',()=>{
 const h=fixture(),before=structuredClone(h.world);
 const input=combatantOf(h.world.npcs[0]!,h.world);
 expect(input.qi).toBe(h.world.npcs[0]!.cultivation.qi);
 expect(input.technique?.id).toBe(h.art.id);assessPower(input,{ambient:'normal'});
 expect(h.world).toEqual(before);
});
it('a real numeric cast spends once, starts the native cooldown and replays without another debit',()=>{
 const h=fixture(),before=h.world.npcs[0]!,result=round(h);
 expect(result.exchanges).not.toHaveLength(0);
 const exchanges=result.exchanges.map((e,index)=>({...e,index}));
 expect(exchanges[0]?.artUse?.techniqueId).toBe(h.art.id);
 expect(h.world.npcs[0]).toEqual(before); // pure resolve still has no write
 writeTheNpcArtsActuallyUsed(h.world,exchanges,'actual-native-round',routineTime(h.world));
 const after=h.world.npcs.find(n=>n.id===h.id)!;
 expect(after.cultivation.qi).toBe((before.cultivation.qi??0)-h.art.qiCost);
 expect(after.cultivation.techniqueCooldowns?.[h.art.id]).toBe(h.art.cooldown);
 expect(after.cultivation.hp).toBe(before.cultivation.hp);
 const saved=structuredClone(h.world);writeTheNpcArtsActuallyUsed(saved,exchanges,'actual-native-round',routineTime(saved));
 expect(saved).toEqual(h.world);
});
it('a spent art still permits an ordinary strike and becomes ready only after native time',()=>{
 const h=fixture(),used=useAnNpcArt(h.world.npcs[0]!,h.art.id,routineTime(h.world));
 if(!used)throw Error('Actual initial use refused');h.world.npcs[0]=used;
 expect(combatantOf(used,h.world).technique).toBeNull();
 const physical=round(h);expect(physical.exchanges).not.toHaveLength(0);
 expect(physical.exchanges.some(e=>e.artUse)).toBe(false);
 const spentQi=used.cultivation.qi;
 advanceWorldForPlay(h.world,{days:h.art.cooldown,preciseDays:true});
 const live=h.world.npcs.find(n=>n.id===h.id);if(!live)throw Error('Actual elapsed body vanished');
 expect(live.cultivation.qi).toBe(spentQi);
 expect(live.cultivation.techniqueCooldowns?.[h.art.id]).toBe(0);
 expect(combatantOf(live,h.world).technique?.id).toBe(h.art.id);
 expect(round(h,1).exchanges.some(e=>e.artUse?.techniqueId===h.art.id)).toBe(true);
});
it('an exhausted actual pool cannot cast but is not replaced by a full combat pool',()=>{
 const h=fixture(),exhausted=spendNpcQi(h.world.npcs[0]!,h.world.npcs[0]!.cultivation.qi??0,routineTime(h.world));
 if(!exhausted)throw Error('Native exhaustion refused');h.world.npcs[0]=exhausted;
 const before=structuredClone(h.world),input=combatantOf(exhausted,h.world);
 expect(input.qi).toBe(0);expect(input.technique).toBeNull();
 expect(round(h).exchanges.some(e=>e.artUse)).toBe(false);
 expect(h.world).toEqual(before);
});
it('one native wide action writes one cast for its multiple resolved targets',()=>{
 const h=fixture(true),before=h.world.npcs[0]!,result=resolveMelee([
  {id:'actual-first-side',name:'Actual first side',members:[combatantOf(before,h.world)]},
  {id:'actual-second-side',name:'Actual second side',members:h.world.npcs.slice(1).map(n=>combatantOf(n,h.world))}],
  {rng:forStream(h.world.seed,'actual-wide-use'),ambient:'normal',turn:1,
   intent:{thrown:AN_ORDINARY_SWING,willWithdraw:false}});
 const strikes=result.exchanges.filter(e=>e.attackerId===h.id);
 expect(new Set(strikes.map(e=>e.defenderId)).size).toBeGreaterThan(1);
 expect(strikes.filter(e=>e.artUse)).toHaveLength(1);
 writeTheNpcArtsActuallyUsed(h.world,result.exchanges,'actual-native-wide',routineTime(h.world));
 expect(h.world.npcs.find(n=>n.id===h.id)?.cultivation.qi).toBe((before.cultivation.qi??0)-h.art.qiCost);
});

it('the SQL-owned player mirror is not a second NPC resource writer',()=>{
 const h=fixture(),result=round(h),exchanges=result.exchanges.map((e,index)=>({...e,index}));
 expect(exchanges.some(e=>e.artUse)).toBe(true);
 h.world.npcs[0]={...h.world.npcs[0]!,tags:[...h.world.npcs[0]!.tags,PLAYER_ROW_TAG]};
 const before=structuredClone(h.world);writeTheNpcArtsActuallyUsed(h.world,exchanges,'actual-player-owned-cast',routineTime(h.world));
 expect(h.world).toEqual(before);
});

it('a real partner ritual is not spent on an ordinary strike and remains available for its actual separate work',()=>{
 const h=fixture(),rite=getTechnique('lotus-plucking-rite');if(!rite)throw Error('Authored partner ritual absent');
 const n=h.world.npcs[0]!;h.world.npcs[0]={...n,cultivation:{...n.cultivation,techniqueIds:[rite.id]}};
 const before=structuredClone(h.world),input=combatantOf(h.world.npcs[0]!,h.world);
 expect(input.technique).toBeNull();const result=round(h);
 expect(result.exchanges.length).toBeGreaterThan(0);expect(result.exchanges.some(e=>e.artUse)).toBe(false);
 writeTheNpcArtsActuallyUsed(h.world,result.exchanges.map((e,index)=>({...e,index})),'actual-physical-strike',routineTime(h.world));
 expect(h.world).toEqual(before);const actualRite=useAnNpcArt(h.world.npcs[0]!,rite.id,routineTime(h.world));
 if(!actualRite)throw Error('Unspent real ritual lost its ordinary readiness');
 expect(actualRite.cultivation.qi).toBe((before.npcs[0]!.cultivation.qi??0)-rite.qiCost);
 expect(actualRite.cultivation.techniqueCooldowns?.[rite.id]).toBe(rite.cooldown);
});
