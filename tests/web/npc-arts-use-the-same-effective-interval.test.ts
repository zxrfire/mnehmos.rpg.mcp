import Database from 'better-sqlite3';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrateWorld as migrateLegacyWorld} from './controls/npc-qi-legacy-world-schema.js';
import {WorldStateRepository as LegacyWorldRepository} from './controls/npc-qi-legacy-world-repository.js';
import {createWorld as createNativeWorld} from '../../src/engine/world/world-state.js';
import {createNpc,initializeNpcQi} from '../../src/engine/world/npc-state.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
/** Oct7 NPC art audit: the native PC held iterator already burns
 * floor(cumulative)-floor(previous), while separate .125-day actions each burn
 * zero. An absolute NPC last-use date would change this rule. These arms use
 * actual PC art-use receipts, world people, body portions and the same world
 * driver; no copied cooldown arithmetic supplies the expected results.
 * A late native use must not lose cooldown to earlier unspent art time.
 * Root diagnostic34923 proved the original callback launched at365001 before
 * requested365001.583333, then honestly reached cooldown0 at365002.583333.
 * Native appointments also invoke this callback. The fixture now waits for
 * the actual requested boundary; it retains the positive suffix/readiness
 * assertions instead of changing the shared interval source.
 * Explicit native migration accommodates preview schema caches, as the NPC08
 * strict storage controls proved. Scripted engine controls are not live prose. */
import {expect,it} from 'vitest';
import {makeGame} from './harness.js';
import {createWorld,prepareWorldClockForPreciseSpan,resetCultivationWorlds} from '../../src/server/state/cultivation-world.js';
import {migrateWorld} from '../../src/storage/migrations.world.js';
import {getTechnique} from '../../src/data/cultivation/techniques.js';
import {handleUse} from '../../src/server/consolidated/technique-manage.js';
import {setRealm,maxQiOf} from '../../src/engine/world/npc-state.js';
import {useAnNpcArt} from '../../src/engine/world/the-arts-an-npc-has-spent.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {spendAnOrdinarySpanAtTheActualClock} from '../../src/web/spending-an-ordinary-span-at-the-actual-clock.js';
import {PLAYER_ROLL_IDENTITY} from '../../src/web/encounters.js';
import {WorldStateRepository} from '../../src/storage/repos/world-state.repo.js';

async function fixture(){
 const h=makeGame({seed:'native-art-interval',worldEnabled:true});migrateWorld(h.db);
 await createWorld({seed:'native-art-interval-world'});await h.game.newRun('A native art user');
 const opened=h.game.currentRun(),art=getTechnique('gale-riding-sword-flight');
 if(!art)throw Error('Real catalog movement art absent');
 h.repos.cultivators.update(opened.cultivator.id,{realmOrdinal:23,qi:500,maxQi:500,satiety:100,injuries:[]});
 h.repos.techniques.upsert(art);expect(h.repos.techniques.learn(opened.cultivator.id,art.id,1)).not.toBeNull();
 let now=h.game.currentRun();h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
 const world=h.game.atHand,at=world.npcs.findIndex(person=>person.status==='alive');
 if(at<0)throw Error('Actual world has no living art control');
 const native=setRealm(world.npcs[at]!,23,routineTime(world));
 world.npcs[at]={...native,cultivation:{...native.cultivation,qi:maxQiOf(native),techniqueIds:[art.id]},
  activity:{kind:'their_practice',note:'Actual bounded art control',withIds:[],sinceDay:routineTime(world),untilDay:routineTime(world)+10}};
 const npcId=native.id;
 const begin=async()=>{
  const before=h.game.currentRun();const receipt=await handleUse({action:'use',techniqueId:art.id,cultivatorId:before.cultivator.id});
  expect(receipt).toHaveProperty('used',true);
  const live=h.game.atHand;if(!live)throw Error('Native art lost its world');
  const index=live.npcs.findIndex(person=>person.id===npcId),npc=live.npcs[index];
  if(!npc)throw Error('Native art lost actual NPC');const used=useAnNpcArt(npc,art.id,routineTime(live));
  if(!used)throw Error('Actual ready NPC art refused');live.npcs[index]=used;
  expect(used.cultivation.qi).toBe((npc.cultivation.qi??0)-art.qiCost);
 };
 const portion=async(days:number,dates:readonly number[]=[],afterBoundary=()=>{})=>{
  const before=h.game.currentRun();return spendAnOrdinarySpanAtTheActualClock(h.game,before.run,before.cultivator,days,
   {seed:before.run.seed,rollIdentity:PLAYER_ROLL_IDENTITY,turn:before.run.turn,startDay:before.run.elapsedDays,
    locationId:before.cultivator.location??'unknown',options:{...h.game.rateTermsFor(before.cultivator),
     ground:h.game.groundFor(before.cultivator),focusMultiplier:0},randomEvents:false,autoBreakthrough:false,rations:0},
   'reserved',undefined,before.run.turn+1,undefined,{dates,afterBoundary,stop:()=>null});
 };
 const remaining=()=>{
  const world=h.game.atHand,npc=world?.npcs.find(person=>person.id===npcId);
  if(!world||!npc)throw Error('Native cooldown lost actual actor');
  const known=h.repos.techniques.getKnown(h.game.currentRun().cultivator.id,art.id);
  const left=npc.cultivation.techniqueCooldowns?.[art.id];
  if(!known||left===undefined)throw Error('Actual native use has no cooldown receipt');
  return {pc:known.cooldownRemaining,npc:left};
 };
 return {...h,art,npcId,begin,portion,remaining};
}
it('separate fractional actions preserve the native zero burn, while one checked held day spends one',async()=>{
 const separate=await fixture();let separateRemaining:ReturnType<typeof separate.remaining>|undefined;
 try{await separate.begin();for(let n=0;n<8;n++)expect((await separate.portion(.125)).skip.simulatedDays).toBe(.125);
  separateRemaining=separate.remaining();expect(separateRemaining.pc).toBe(separate.art.cooldown);
  expect(separateRemaining.npc).toBe(separateRemaining.pc);
 }finally{resetCultivationWorlds();separate.db.close();}
 if(!separateRemaining)throw Error('Separate native oracle failed');
 const held=await fixture();try{await held.begin();const start=routineTime(held.game.atHand!);
  const result=await held.portion(1,Array.from({length:7},(_,n)=>start+(n+1)*.125));
  expect(result.skip.simulatedDays).toBe(1);expect(held.remaining().pc).toBeLessThan(separateRemaining.pc);
  expect(held.remaining().npc).toBe(held.remaining().pc);
  const world=held.game.atHand;if(!world)throw Error('Actual checked world missing');
  const repo=new WorldStateRepository(held.db);repo.saveWorld(world);
  expect(repo.loadWorld(world.id)?.npcs.find(person=>person.id===held.npcId)?.cultivation.techniqueCooldowns)
   .toEqual(world.npcs.find(person=>person.id===held.npcId)?.cultivation.techniqueCooldowns);
 }finally{resetCultivationWorlds();held.db.close();}
},180000);
it('an art actually started at a later boundary only burns the active suffix',async()=>{
 const h=await fixture();try{const start=routineTime(h.game.atHand!),date=start+1.25;let used=false;
  let usedAt:number|undefined;
  const result=await h.portion(2.25,[date],async()=>{
   const world=h.game.atHand;if(!world)throw Error('Native callback lost actual world');
   const now=routineTime(world);
   if(used||!journeyTimeHasReached(now,date))return;
   usedAt=now;used=true;await h.begin();
  });
  if(usedAt===undefined)throw Error('Native named launch boundary was never reached');
  expect(journeyTimeHasReached(usedAt,date)).toBe(true);
  expect(journeyTimeHasReached(date,usedAt)).toBe(true);
  const endedAt=routineTime(h.game.atHand!);
  expect(endedAt).toBeGreaterThan(usedAt);
  expect(journeyTimeHasReached(usedAt+h.art.cooldown,endedAt)).toBe(true);
  expect(used).toBe(true);expect(result.skip.simulatedDays).toBe(2.25);
  expect(h.remaining().pc).toBeGreaterThan(0);expect(h.remaining().npc).toBe(h.remaining().pc);
 }finally{resetCultivationWorlds();h.db.close();}
},180000);

it('a genuine saved legacy NPC acquires only actual cooldowns and preserves exhausted zero on file reopen',()=>{
 const directory=mkdtempSync(join(tmpdir(),'actual-npc-art-legacy-')),file=join(directory,'world.db');let db=new Database(file);
 try{
  migrateLegacyWorld(db);expect(db.prepare<[],{name:string}>('PRAGMA table_info(world_npcs)').all()
   .some(column=>column.name==='technique_cooldowns')).toBe(false);
  const world=createNativeWorld({seed:'actual-art-saved-world',regionCount:0,skipPriorAges:true}),art=getTechnique('gale-riding-sword-flight');
  if(!art)throw Error('Actual saved-world art absent');
  const body=setRealm(createNpc(world.seed,{id:'actual-saved-art-person',name:'Actual saved art user',
   onDay:world.currentDay,bornOnDay:world.currentDay-50*365,locationId:null}),23,world.currentDay);
  body.cultivation.techniqueIds=[art.id];world.npcs.push(body);
  new LegacyWorldRepository(db).saveWorld(world);db.close();db=new Database(file);migrateWorld(db);
  const repository=new WorldStateRepository(db),loaded=repository.loadWorld(world.id);
  if(!loaded)throw Error('Native migration lost legacy world');const actual=loaded.npcs[0];
  if(!actual)throw Error('Native migration lost actual body');expect(actual.cultivation.techniqueCooldowns).toBeUndefined();
  expect(initializeNpcQi(loaded.npcs)).toBe(1);repository.saveWorld(loaded);
  const used=useAnNpcArt(actual,art.id,loaded.currentDay);if(!used)throw Error('Actual legacy art could not start');
  loaded.npcs[0]=used;expect(used.cultivation.techniqueCooldowns?.[art.id]).toBe(art.cooldown);
  advanceWorldForPlay(loaded,{days:2,preciseDays:true});
  expect(loaded.npcs[0]?.cultivation.techniqueCooldowns?.[art.id]).toBe(0);
  repository.saveWorld(loaded);db.close();db=new Database(file);migrateWorld(db);
  const reopened=new WorldStateRepository(db).loadWorld(world.id);
  expect(reopened?.npcs[0]?.cultivation.techniqueCooldowns?.[art.id]).toBe(0);
  expect(reopened?.npcs[0]?.cultivation.qi).toBe(used.cultivation.qi);
 }finally{if(db.open)db.close();}
});
