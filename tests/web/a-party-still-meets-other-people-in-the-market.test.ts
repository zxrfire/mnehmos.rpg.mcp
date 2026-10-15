/**
 * The old three-person area quota split companions away or filled the scene
 * with them. A player party now stands together alongside up to three other
 * people. These played scenes exercise the actual presence, company, narrator
 * cards and greeting target rather than an injected present-list override.
 * The lone-player ceiling and an expired party still use three total others.
 */
import {expect,it} from 'vitest';
import {makeGameInWorld} from './harness';
import {makeLocation} from '../../src/engine/world/locations';
import {createNpc} from '../../src/engine/world/npc-state';
import {routineTime} from '../../src/engine/world/npc-routines';
import {theAreasOf} from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import {thePeopleHere} from '../../src/web/the-narrator-plays-the-world';

async function market(partySize:number) {
    const h=await makeGameInWorld({seed:'company-at-market',worldSeed:'company-at-market-world'});
    const {cultivator}=await h.game.newRun('Walker');
    const world=h.game.atHand!;
    const place=makeLocation({id:'test-market-square',name:'Market Square',kind:'settlement',qiDensity:.3,tags:['city']});
    world.locations.push(place);
    const area=theAreasOf(world,place).areas.find(a=>a.for==='market')!;
    const now=routineTime(world),party=new Set<string>();
    for(let i=0;i<partySize+10;i++) {
        const person=createNpc(world.seed,{id:'market-person-'+i,name:'Market Traveller '+i,locationId:place.id,onDay:now,bornOnDay:now-7300});
        person.activity={kind:i<partySize?'out_with_a_party':'trade',note:i<partySize?'Travelling with the party.':'Selling goods at the market.',
            withIds:i<partySize?[cultivator.id]:[],sinceDay:now,untilDay:now+10,standingIn:i<partySize?null:area.id};
        world.npcs.push(person); if(i<partySize)party.add(person.id);
    }
    h.repos.cultivators.update(cultivator.id,{location:place.name});h.repos.cultivators.standIn(cultivator.id,area.id);
    h.game.theWorldMoved();
    return {...h,party};
}
it('four companions leave three other people present, carded and reachable for a greeting',async()=>{
    const h=await market(4),body=h.game.currentRun().cultivator;
    const present=h.game.present(body);
    expect(present.filter(p=>h.party.has(p.id))).toHaveLength(4);
    const others=present.filter(p=>!h.party.has(p.id));expect(others).toHaveLength(3);
    const company=h.game.company(body);expect(company.total).toBe(7);
    const cards=thePeopleHere(company,body.realmOrdinal,[],null).filter(line=>line.startsWith('- A face with no name to it:'));
    expect(cards).toHaveLength(7);
    const person=others[0]!;
    h.game.noteEncounter(body,h.game.currentRun().run,{kind:'cultivator',id:person.id,name:person.name},'told','The trader gave their name.');
    const turn=await h.game.act(`I greet ${person.name}`);
    expect(turn.narration).not.toMatch(/nobody.*(?:here|name)|not here/i);
    expect(h.game.present(h.game.currentRun().cultivator).some(p=>p.id===person.id)).toBe(true);
});
it('a lone player still has at most three other people in the market',async()=>{
    const h=await market(0);await h.game.act('I look around');
    expect(h.game.present(h.game.currentRun().cultivator)).toHaveLength(3);
    expect(h.game.company(h.game.currentRun().cultivator).total).toBe(3);
});
