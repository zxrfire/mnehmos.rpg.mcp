/** Referenced archival evidence keeps its original historical participant
 * identity and terms; the actual NPC body still disappears. This is an old
 * factual record, never a current listener/location/permission grant. Mixed
 * surviving testimony still sanitizes its forgotten live-body fields. */
/** Archive06 changes the earlier cause-dropping contract: a living testimony
 * keeps its actual dead-only cause, with forgotten actor/body fields sanitized.
 * Pricing05 measured a paid public notice lost despite its surviving receipt.
 * Unreferenced private records and dead-only reference cycles still disappear;
 * transitive actual links retain evidence without retaining the dead body. */
/**
 * Live census profile census-live-20261003-01 sampled 12.736s at 118 years;
 * forgetting used .983s with 190,408 facts on record. Fusing its two full-ledger
 * passes must preserve actual memories: mixed facts keep surviving actors,
 * witnesses and causes, flat forgotten-ID data becomes null, and nested existing
 * consequences lose only forgotten participants. Unrelated evidence keeps its
 * existing row handle because recurrence/evidence indices rely on that contract.
 */
import { expect, it } from 'vitest';
import { createWorld, theWorldForgetsTheMortalDead } from '../../../src/engine/world/world-state.js';
import { createNpc, markDead, setRealm } from '../../../src/engine/world/npc-state.js';
import { fillConsequences, makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';

it('keeps surviving testimony, its cause order and existing unrelated evidence', () => {
    const state = createWorld({ seed: 'mixed-forgetting', regionCount: 0, skipPriorAges: true });
    const dead = markDead(setRealm(createNpc(state.seed, { id: 'npc-90001', locationId: null, onDay: 0, bornOnDay: -30 * 365 }), 0, 0), 1, 'Old age.');
    const living = setRealm(createNpc(state.seed, { id: 'npc-90002', locationId: null, onDay: 0, bornOnDay: -30 * 365 }), 8, 0);
    state.npcs.push(dead, living);
    state.currentDay = 2;
    const forgottenActor = { id: dead.id, name: dead.name, role: 'witness' };
    const keptActor = { id: living.id, name: living.name, role: 'witness' };
    const add = (fact: ReturnType<typeof makeFact>) => appendWorldFact(state, fact, { recur: false, bystanders: false });
    const dropped = add(makeFact({ day: 1, kind: 'gathering', summary: 'Only the forgotten.', actors: [forgottenActor] }));
    const unrelated = add(makeFact({ day: 1, kind: 'gathering', summary: 'A living account.', actors: [keptActor] }));
    const mixed = add(makeFact({ day: 2, kind: 'gathering', summary: 'A shared account.', actors: [forgottenActor, keptActor], witnessIds: [dead.id, living.id], causes: [dropped.id, unrelated.id], data: { forgottenId: dead.id, keptId: living.id }, consequences: fillConsequences({ beneficiaries: [forgottenActor, keptActor], losers: [forgottenActor, keptActor], relationshipChanges: [{ aId: dead.id, bId: living.id, change: 'gone' }, { aId: living.id, bId: living.id, change: 'kept' }] }) }));
    expect(factsWithDataValue(state, 'forgottenId', dead.id)).toContain(mixed);
    theWorldForgetsTheMortalDead(state);
    expect(state.npcs.map(n => n.id)).toEqual([living.id]);
    expect(state.history.facts.map(f => f.id)).toEqual([dropped.id, unrelated.id, mixed.id]);
    const kept = state.history.facts.find(f => f.id === mixed.id)!;
    expect(kept.actors).toEqual([keptActor]);
    expect(kept.witnessIds).toEqual([living.id]);
    expect(kept.causes).toEqual([dropped.id, unrelated.id]);
    expect(kept.data.forgottenId).toBeNull();
    expect(kept.data.keptId).toBe(living.id);
    expect(kept.consequences!.beneficiaries).toEqual([keptActor]);
    expect(kept.consequences!.losers).toEqual([keptActor]);
    expect(kept.consequences!.relationshipChanges).toEqual([{ aId: living.id, bId: living.id, change: 'kept' }]);
    expect(factsWithDataValue(state, 'forgottenId', dead.id)).toEqual([]);
    expect(factsWithDataValue(state, 'forgottenId', null)).toContain(kept);
    expect(witnessIndexFor(state).byId.get(unrelated.id)).toBe(unrelated);
    expect(state.history.facts.find(f => f.id === unrelated.id)).toBe(unrelated);
});

function referenceScene(){
 const state=createWorld({seed:'surviving-actual-references',regionCount:0,skipPriorAges:true});
 const dead=markDead(setRealm(createNpc(state.seed,{id:'reference-dead',locationId:null,onDay:0,bornOnDay:-30*365}),0,0),1,'Old age.');
 const living=setRealm(createNpc(state.seed,{id:'reference-living',locationId:null,onDay:0,bornOnDay:-30*365}),8,0);
 state.npcs.push(dead,living);state.currentDay=2;
 const add=(name:string,alive=false,data:Record<string,string|number|boolean|null>={})=>appendWorldFact(state,makeFact({day:1,kind:'gathering',summary:name,actors:[{id:alive?living.id:dead.id,name:alive?living.name:dead.name,role:'witness'}],data}),{recur:false,bystanders:false});
 return{state,dead,living,add};
}
it('actual transitive receipt references retain evidence while the dead body disappears',()=>{
 const {state,dead,add}=referenceScene();const first=add('Original evidence.');const middle=add('Related evidence.',false,{originalFactId:first.id});const receipt=add('A living receipt.',true,{acceptedFactId:middle.id});
 theWorldForgetsTheMortalDead(state);expect(state.npcs.some(n=>n.id===dead.id)).toBe(false);expect(state.history.facts.map(f=>f.id)).toEqual([first.id,middle.id,receipt.id]);expect(witnessIndexFor(state).byId.get(first.id)?.actors.map(actor=>actor.id)).toEqual([dead.id]);
});
it('an unreferenced private dead record supplies no archival presence',()=>{
 const {state,dead,add}=referenceScene();const forgotten=add('Unshared private record.');theWorldForgetsTheMortalDead(state);expect(state.npcs.some(n=>n.id===dead.id)).toBe(false);expect(witnessIndexFor(state).byId.has(forgotten.id)).toBe(false);
});
it('dead-only reference cycles have no surviving factual root',()=>{
 const {state,add}=referenceScene();const first=add('Orphan first.');const second=add('Orphan second.',false,{backReference:first.id});first.data.backReference=second.id;theWorldForgetsTheMortalDead(state);expect(state.history.facts).toHaveLength(0);
});
