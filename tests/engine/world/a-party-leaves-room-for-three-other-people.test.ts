/**
 * Companions used the same three-person area allowance as strangers. Four
 * companions could therefore fill a market scene indefinitely. The owner's
 * amended rule is three other people plus the active party, including a player
 * following a native leader. Expired company and people on a different physical
 * hull are not brought into the scene by that allowance.
 */
import {expect,it} from 'vitest';
import {createWorld} from '../../../src/engine/world/world-state';
import {makeLocation} from '../../../src/engine/world/locations';
import {createNpc} from '../../../src/engine/world/npc-state';
import {routineTime} from '../../../src/engine/world/npc-routines';
import {theAreasOf,threeOthersAndTheParty} from '../../../src/engine/world/where-in-a-place-somebody-is-standing';

function market(partySize: number) {
    const world=createWorld({seed:'room-for-company',skipPriorAges:true,regionCount:0});
    world.currentHour=12;
    const place=makeLocation({id:'market-square',name:'Market Square',kind:'settlement',qiDensity:.3,tags:['city']});
    world.locations.push(place);
    const area=theAreasOf(world,place).areas.find(a=>a.for==='market')!;
    expect(area).toBeDefined();
    const now=routineTime(world), party=new Set<string>();
    for(let i=0;i<partySize+10;i++) {
        const p=createNpc(world.seed,{id:'person-'+i,locationId:place.id,onDay:now,bornOnDay:now-7300});
        const companion=i<partySize;
        p.activity={kind:companion?'out_with_a_party':'trade',note:companion?'Travelling with the party.':'Selling goods in the market.',
            withIds:companion?['player']:[],sinceDay:now,untilDay:now+10,standingIn:companion?null:area.id};
        world.npcs.push(p); if(companion)party.add(p.id);
    }
    return {world,place,area,party,now};
}

it('a party of four meets three other people at the market without losing a companion',()=>{
    const h=market(4), read=theAreasOf(h.world,h.place,undefined,{id:'player',standingIn:h.area.id});
    const here=[...read.whereIs].filter(([,area])=>area===h.area.id).map(([id])=>id);
    expect(here.filter(id=>h.party.has(id))).toHaveLength(4);
    expect(here.filter(id=>!h.party.has(id))).toHaveLength(3);
});
it('a lone player still sees no more than three others in every public area',()=>{
    const h=market(0),read=theAreasOf(h.world,h.place,undefined,{id:'player',standingIn:h.area.id});
    expect([...read.whereIs.values()].filter(id=>id===h.area.id)).toHaveLength(3);
    for(const area of read.areas)expect([...read.whereIs.values()].filter(id=>id===area.id).length).toBeLessThanOrEqual(3);
});
it('an expired companion uses the ordinary three places again',()=>{
    const h=market(4); for(const p of h.world.npcs)if(h.party.has(p.id))p.activity!.untilDay=h.now;
    const read=theAreasOf(h.world,h.place,undefined,{id:'player',standingIn:h.area.id});
    expect([...read.whereIs.values()].filter(id=>id===h.area.id).length).toBeLessThanOrEqual(3);
});
it('a party allowance never overrides the physical reach of the scene',()=>{
    const h=market(4), absent=[...h.party][0]!;
    const read=theAreasOf(h.world,h.place,undefined,{id:'player',standingIn:h.area.id,
        physical:{betweenEndpoints:false,accepts:person=>person.id!==absent}});
    expect(read.whereIs.has(absent)).toBe(false);
    expect([...read.whereIs].filter(([id,area])=>area===h.area.id&&h.party.has(id))).toHaveLength(3);
});
it('a fallback keeps every party member and at most three others in its original order',()=>{
    const people=Array.from({length:10},(_,i)=>({id:String(i)})), party=new Set(['0','2','5','8']);
    const read=threeOthersAndTheParty(people,party);
    expect(read.filter(p=>party.has(p.id))).toHaveLength(4);
    expect(read.filter(p=>!party.has(p.id))).toHaveLength(3);
    expect(read.map(p=>p.id)).toEqual(['0','1','2','3','4','5','8']);
});
