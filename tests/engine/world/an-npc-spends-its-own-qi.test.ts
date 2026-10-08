/**
 * Oct7 flight audit: NPC bodies had hp and a purse but no actual qi balance.
 * Quoting personal flight as if a full pool were always available would grant
 * unlimited launches. This bounded resource extension stores only current qi:
 * insight/rung still derive the pool, native carriedAcross moves its spent
 * fraction with a rung, and the saved-world upgrade initializes absence once.
 * These component controls do not prove NPC mission dispatch, finite medicine
 * or art cooldown integration; those remain separate, unfinished consumers.
 */
import { expect,it } from 'vitest';
import { createNpc,setRealm,maxQiOf,qiStandingOn,spendNpcQi,initializeNpcQi } from '../../../src/engine/world/npc-state.js';
import { carriedAcross } from '../../../src/engine/cultivation/realms.js';

function person(){return setRealm(createNpc('actual-npc-qi',{id:'actual-body',name:'Actual body',onDay:1000,
    bornOnDay:0,locationId:null}),29,1000);}

it('launches spend the actual body balance and cannot refill on a later read',()=>{
    const npc=person();
    const charged=spendNpcQi(npc,25,1000);
    if(!charged)throw new Error('Actual body has no first finite launch');
    if(npc.cultivation.qi===undefined)throw new Error('New actual NPC lacks its qi balance');
    expect(charged.cultivation.qi).toBe(npc.cultivation.qi-25);
    expect(qiStandingOn(charged,1100)).toBe(charged.cultivation.qi);
    const empty={...charged,cultivation:{...charged.cultivation,qi:0}};
    expect(spendNpcQi(empty,25,1100)).toBeNull();
    expect(initializeNpcQi([empty])).toBe(0);
    expect(empty.cultivation.qi).toBe(0);
});

it('a rung carries the existing spent pool through the same native authority',()=>{
    const npc=person(),before={...npc,cultivation:{...npc.cultivation,qi:Math.floor(maxQiOf(npc)/3)}};
    const after=setRealm(before,30,1001);
    expect(after.cultivation.qi).toBe(carriedAcross(before.cultivation.qi,maxQiOf(before),maxQiOf(after)));
    expect(after.cultivation.qi).toBeLessThan(maxQiOf(after));
    const exhausted=setRealm({...before,cultivation:{...before.cultivation,qi:0}},30,1001);
    expect(exhausted.cultivation.qi).toBe(0);
});

it('only missing saved balances initialize, once; an existing spent body is untouched',()=>{
    const old=person(),spent=person();
    delete old.cultivation.qi;
    spent.cultivation.qi=1;
    expect(qiStandingOn(old,1000)).toBe(0);
    expect(initializeNpcQi([old,spent])).toBe(1);
    expect(old.cultivation.qi).toBe(maxQiOf(old));
    expect(spent.cultivation.qi).toBe(1);
    expect(initializeNpcQi([old,spent])).toBe(0);
});
