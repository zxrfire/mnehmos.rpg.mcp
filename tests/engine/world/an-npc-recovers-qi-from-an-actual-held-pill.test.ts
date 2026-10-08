/** Oct7 flight resource audit: NPCs had no qi balance, and copying catalog
 * potency into a launch would mint recovery without a consumed dose. These
 * component arrangements use the ordinary object factory and catalog, native
 * dose/toxicity preparation and the actual person's single balance. Spent rows
 * retain title and provenance. No house stock approval, chaos sheet aftermath,
 * player dialogue, or mission dispatch acceptance is claimed by these tests. */
import { expect,it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc,setRealm,maxQiOf } from '../../../src/engine/world/npc-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { swallowOrdinaryHeldQiMedicine } from '../../../src/engine/world/an-npc-takes-held-qi-medicine.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { isSettledOnUse } from '../../../src/engine/cultivation/grade-spread.js';
import { TOXICITY_TOLERANCE } from '../../../src/engine/cultivation/a-pill-dose-on-an-actual-body.js';

function fixture(){
    const world=createWorld({seed:'actual-npc-qi-dose',regionCount:0,skipPriorAges:true});
    const npc=setRealm(createNpc(world.seed,{id:'actual-dose-body',name:'Actual body',onDay:world.currentDay,
        bornOnDay:world.currentDay-100*365,locationId:null}),29,world.currentDay);
    const pill=PILLS.find(p=>p.effect==='restore_qi'&&isSettledOnUse(p.grade)&&p.toxicity>0);
    if(!pill)throw new Error('Native catalog has no ordinary qi medicine');
    npc.cultivation.qi=0;
    const row=makeObject({id:'actual-held-dose',name:pill.name,kind:'pill',ownerId:npc.id,
        possessorId:npc.id,data:{pillId:pill.id,spent:false}});
    world.npcs.push(npc);world.objects.push(row);
    return {world,npc,pill,row};
}

it('a finite actual held dose restores qi once and retains its spent row/title',()=>{
    const h=fixture();
    const after=swallowOrdinaryHeldQiMedicine(h.world,h.npc,h.row.id,h.world.currentDay);
    if(!after)throw new Error('Actual held ordinary dose was not accepted');
    expect(after.cultivation.qi).toBeGreaterThan(0);
    expect(after.cultivation.qi).toBeLessThanOrEqual(maxQiOf(after));
    expect(h.world.objects).toHaveLength(1);
    expect(h.world.objects[0]?.id).toBe(h.row.id);
    expect(h.world.objects[0]?.ownerId).toBe(h.npc.id);
    expect(h.world.objects[0]?.possessorId).toBeNull();
    expect(h.world.objects[0]?.data.spentBy).toBe(h.npc.id);
    expect(swallowOrdinaryHeldQiMedicine(h.world,after,h.row.id,h.world.currentDay+1)).toBeNull();
});

it('another actual possessor is not a free source of medicine',()=>{
    const h=fixture();h.world.objects[0]!.possessorId='somebody-else';
    expect(swallowOrdinaryHeldQiMedicine(h.world,h.npc,h.row.id,h.world.currentDay)).toBeNull();
    expect(h.npc.cultivation.qi).toBe(0);
    expect(h.world.objects[0]?.data.spent).toBe(false);
});

it('the native accumulated toxicity produces an actual poison wound',()=>{
    const h=fixture();h.npc.cultivation.pillToxicity=TOXICITY_TOLERANCE-h.pill.toxicity;
    const after=swallowOrdinaryHeldQiMedicine(h.world,h.npc,h.row.id,h.world.currentDay);
    if(!after)throw new Error('Actual poison-boundary dose was not consumed');
    expect(after.cultivation.injuries.some(injury=>injury.source==='poison'&&!injury.treated)).toBe(true);
    expect(after.cultivation.untreatedInjuries).toBeGreaterThan(h.npc.cultivation.untreatedInjuries);
    expect(after.cultivation.pillToxicity).toBe(0);
    expect(h.world.objects[0]?.data.spent).toBe(true);
});
