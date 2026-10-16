/** A native elder's directions used the observer's masked roster values.
 * An unidentified high member became a mortal rogue in their own knowledge
 * reader, even though the world held their actual life and house. Two views
 * of the same person must yield the same real knowledge, without disclosing
 * those hidden body fields to the observer. External profiles stay supplied.
 */
import {expect,it} from 'vitest';
import {createWorld,makeFaction} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm,PLAYER_ROW_TAG} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {whoTheyAreOf} from '../../../src/engine/world/who-knows-the-land.js';
import {whatSomebodyKnowsOfTheLand} from '../../../src/engine/world/what-somebody-knows-of-the-land.js';
function person(){
    const world=createWorld({seed:'their-life-is-not-the-observers-card',regionCount:0,skipPriorAges:true});
    world.locations.push(makeLocation({id:'home',name:'Fourfold Stele',kind:'settlement'}));
    const house=makeFaction({id:'house',name:'Reed House',seatLocationId:'home'});world.factions.push(house);
    const npc={...setRealm(createNpc(world.seed,{id:'elder',locationId:'home',onDay:0,bornOnDay:-40*365}),30,0),
        factionId:house.id,factionRankIndex:house.ranks.length-2};world.npcs.push(npc);
    return {world,house,npc};
}
it('keeps an unidentified native elders actual wayfinding knowledge',()=>{
    const h=person(),known={id:h.npc.id,location:'Fourfold Stele',realmOrdinal:30,sectId:h.house.id};
    const masked={...known,realmOrdinal:0,sectId:null};
    const actual=whatSomebodyKnowsOfTheLand(h.world,whoTheyAreOf(h.world,known));
    expect(actual.places.find(place=>place.name==='Emerald Water City')?.stage).toBe('placed');
    expect(whatSomebodyKnowsOfTheLand(h.world,whoTheyAreOf(h.world,masked))).toEqual(actual);
});
it('does not grant a real rogue knowledge from an observers mistaken affiliation or realm',()=>{
    const h=person();h.world.npcs[0]={...setRealm(h.npc,0,0),factionId:null,factionRankIndex:-1};
    const actual=whoTheyAreOf(h.world,{id:h.npc.id,location:'Fourfold Stele',realmOrdinal:30,sectId:h.house.id});
    expect(actual.house).toBeNull();expect(actual.ordinal).toBe(0);
});
it('retains supplied profiles where no native person row exists',()=>{
    const h=person(),supplied={id:'external',location:'Fourfold Stele',realmOrdinal:8,sectId:h.house.id};
    expect(whoTheyAreOf(h.world,supplied)).toMatchObject({ordinal:8,house:{id:h.house.id}});
});

it('keeps an externally owned player profile authoritative over its world mirror',()=>{
    const h=person();h.world.npcs[0]={...setRealm(h.npc,0,0),tags:[...h.npc.tags,PLAYER_ROW_TAG],factionId:null};
    const actual=whoTheyAreOf(h.world,{id:h.npc.id,location:'Emerald Water City',realmOrdinal:30,sectId:h.house.id});
    expect(actual).toMatchObject({ordinal:30,from:'Emerald Water City',house:{id:h.house.id}});
});
