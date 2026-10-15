/** Run3's 26-year checkpoint comparison differed only in four timestamp fields
 * on two people. The business sweep retained old competition entries without
 * their results, reopening completed boards and moving entrants to old dates.
 * Keep the actual closing evidence with a held entry; unheld boards still age out.
 */
import {expect,it} from 'vitest';
import {createWorld,makeFaction} from '../../../src/engine/world/world-state.js';
import {createNpc,setLocation} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {makeObject,transferPossession} from '../../../src/engine/world/possessions.js';
import {enterAnOpenCompetition,settleOpenCompetitions} from '../../../src/engine/world/entering-an-open-competition.js';
import {keepTheBusinessStillOnTheBooks} from '../../../src/engine/world/the-business-the-world-still-keeps.js';
function finished(keepEntry:boolean){
 const world=createWorld({seed:'closed-competition-paperwork',regionCount:0,skipPriorAges:true});
 const host=makeFaction({id:'host',name:'House',seatLocationId:'grounds'});world.factions.push(host);
 world.locations.push(makeLocation({id:'capital',name:'Capital',kind:'settlement',tags:['city']}));
 const entrant=createNpc(world.seed,{id:'entrant',name:'Entrant',locationId:'capital',bornOnDay:-30*365,onDay:0});world.npcs.push(entrant);
 const entry=enterAnOpenCompetition(world,host,entrant,7,0,'capital')!;expect(entry).not.toBeNull();
 const results=settleOpenCompetitions(world,7,7);expect(results.some(f=>f.data.result===true)).toBe(true);
 if(keepEntry)world.objects.push(transferPossession(makeObject({id:'entry-token',name:'Entry token',kind:'token',ownerId:entrant.id,possessorId:entrant.id}),{onDay:0,toHolderId:entrant.id,toHolderName:entrant.name,how:'gifted',transfersOwnership:false,factId:entry.id}));
 world.currentDay=730;world.npcs[0]=setLocation(world.npcs[0]!,'capital',730);return {world,entry};
}
it('keeps a held entry closed without moving the entrant to its old contest date',()=>{
 const {world,entry}=finished(true);const before=JSON.parse(JSON.stringify(world.npcs));
 keepTheBusinessStillOnTheBooks(world);expect(world.history.facts.some(f=>f.id===entry.id)).toBe(true);
 expect(settleOpenCompetitions(world,730,730)).toEqual([]);expect(world.npcs).toEqual(before);
 const reloaded=JSON.parse(JSON.stringify(world)) as typeof world;
 expect(settleOpenCompetitions(reloaded,730,730)).toEqual([]);expect(reloaded.npcs).toEqual(before);
});
it('lets an unheld completed board age out together',()=>{
 const {world}=finished(false);keepTheBusinessStillOnTheBooks(world);
 expect(world.history.facts.filter(f=>f.data.openCompetition===true)).toEqual([]);
 expect(settleOpenCompetitions(world,730,730)).toEqual([]);
});
