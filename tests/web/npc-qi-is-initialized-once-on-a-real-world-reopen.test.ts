/** Oct7 NPC flight resource extension: a saved world previously had no qi
 * column on its actual people. This real SQLite operator arrangement removes
 * only one balance and retains another person's genuine zero. Native reopening
 * must initialize the missing body once, persist it, and preserve later spending.
 * Native04 measured 30 rather than zero after reopening: the repository lacked
 * a qi column, so the genuine spent balance was discarded and filled on load.
 * The nullable storage extension preserves absence and zero independently.
 * Strict06 then failed before INSERT: the overlay loaded new migration code
 * while makeDb cloned a schema cached from unchanged actual files. Both arms
 * now run the same native migration on that copied DB before candidate writes.
 * Additional controls use a genuinely saved old-schema database and a fresh
 * native DDL, independent of that cache. No direct ALTER or pool fallback is used.
 * No NPC, medicine, membership, location or cooldown chronology is fabricated. */
import { expect,it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld,activeWorld,resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { maxQiOf,createNpc,spendNpcQi,qiStandingOn } from '../../src/engine/world/npc-state.js';
import {createWorld as createEngineWorld} from '../../src/engine/world/world-state.js';
import {migrateWorld} from '../../src/storage/migrations.world.js';
import Database from 'better-sqlite3';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setDb} from '../../src/storage/index.js';
import {migrateWorld as migrateLegacyWorld} from './controls/npc-qi-legacy-world-schema.js';
import {WorldStateRepository as LegacyWorldRepository} from './controls/npc-qi-legacy-world-repository.js';

it('a native saved-world upgrade initializes absence once and preserves an actual spent zero',async()=>{
    const h=makeGame({worldEnabled:true});
    try{
        migrateWorld(h.db);
        await createWorld({seed:'npc-qi-native-reopen',population:12,presentYear:0});
        const opened=(await activeWorld()).state;
        const living=opened.npcs.filter(person=>person.status==='alive');
        const missing=living[0],spent=living[1];
        if(!missing||!spent)throw new Error('Native world lacks two actual living bodies');
        expect(typeof missing.cultivation.qi).toBe('number');
        delete missing.cultivation.qi;spent.cultivation.qi=0;
        const repo=new WorldStateRepository(h.db);repo.saveWorld(opened);resetCultivationWorlds();
        const upgraded=(await activeWorld()).state;
        const actual=upgraded.npcs.find(person=>person.id===missing.id);
        if(!actual)throw new Error('Actual legacy body disappeared during resource upgrade');
        expect(actual.cultivation.qi).toBe(maxQiOf(actual));
        expect(upgraded.npcs.find(person=>person.id===spent.id)?.cultivation.qi).toBe(0);
        const persisted=repo.loadWorld(upgraded.id);
        if(!persisted)throw new Error('Native upgrade did not save its actual world');
        expect(persisted.npcs.find(person=>person.id===missing.id)?.cultivation.qi).toBe(actual.cultivation.qi);
        actual.cultivation.qi=0;repo.saveWorld(upgraded);resetCultivationWorlds();
        const reopened=(await activeWorld()).state;
        expect(reopened.npcs.find(person=>person.id===missing.id)?.cultivation.qi).toBe(0);
        expect(reopened.npcs.find(person=>person.id===spent.id)?.cultivation.qi).toBe(0);
    }finally{resetCultivationWorlds();h.db.close();}
},180000);

function columns(db:Database.Database){return db.prepare<[],{name:string,type:string,notnull:number,dflt_value:string|null}>('PRAGMA table_info(world_npcs)').all();}
function aSmallActualWorld(seed:string){
 const state=createEngineWorld({seed,regionCount:0,skipPriorAges:true});
 const body=createNpc(seed,{id:'persisted-actual-body',name:'Actual body',onDay:state.currentDay,bornOnDay:state.currentDay-20*365,locationId:null});
 state.npcs.push(body);return {state,body};
}
it('fresh native DDL stores an actual exhausted balance without a default refill',()=>{
 const db=new Database(':memory:');try{
  migrateWorld(db);const column=columns(db).find(row=>row.name==='qi');
  expect(column?.type).toBe('REAL');expect(column?.notnull).toBe(0);expect(column?.dflt_value).toBeNull();
  const {state,body}=aSmallActualWorld('fresh-native-qi-ddl');
  const exhausted=spendNpcQi(body,qiStandingOn(body,state.currentDay),state.currentDay);
  if(!exhausted)throw Error('Actual fresh body could not spend its native pool');state.npcs[0]=exhausted;
  const repo=new WorldStateRepository(db);repo.saveWorld(state);
  expect(repo.loadWorld(state.id)?.npcs.find(person=>person.id===body.id)?.cultivation.qi).toBe(0);
  migrateWorld(db);expect(repo.loadWorld(state.id)?.npcs[0]?.cultivation.qi).toBe(0);
 }finally{db.close();}
});
it('a saved legacy schema migrates its real row, initializes absence once and preserves native spending through file reopen',async()=>{
 const h=makeGame({worldEnabled:true}),directory=mkdtempSync(join(tmpdir(),'npc-qi-legacy-native-')),file=join(directory,'world.db');
 let db:Database.Database|null=new Database(file);
 try{
  migrateLegacyWorld(db);expect(columns(db).some(row=>row.name==='qi')).toBe(false);
  const {state,body}=aSmallActualWorld('genuine-saved-legacy-qi');
  new LegacyWorldRepository(db).saveWorld(state);db.close();db=new Database(file);
  migrateWorld(db);expect(columns(db).some(row=>row.name==='qi')).toBe(true);
  const repo=new WorldStateRepository(db);expect(repo.loadWorld(state.id)?.npcs[0]?.cultivation.qi).toBeUndefined();
  setDb(db);resetCultivationWorlds();const upgraded=(await activeWorld()).state;
  const actual=upgraded.npcs.find(person=>person.id===body.id);if(!actual)throw Error('Real legacy body disappeared on opening');
  expect(actual.cultivation.qi).toBe(maxQiOf(actual));
  expect(repo.loadWorld(state.id)?.npcs[0]?.cultivation.qi).toBe(actual.cultivation.qi);
  const exhausted=spendNpcQi(actual,qiStandingOn(actual,upgraded.currentDay),upgraded.currentDay);
  if(!exhausted)throw Error('Migrated actual body could not spend its native pool');
  upgraded.npcs[upgraded.npcs.findIndex(person=>person.id===body.id)]=exhausted;repo.saveWorld(upgraded);
  resetCultivationWorlds();db.close();db=new Database(file);migrateWorld(db);setDb(db);
  const reopened=(await activeWorld()).state;expect(reopened.npcs.find(person=>person.id===body.id)?.cultivation.qi).toBe(0);
 }finally{resetCultivationWorlds();if(db?.open)db.close();setDb(h.db);h.db.close();}
},180000);
