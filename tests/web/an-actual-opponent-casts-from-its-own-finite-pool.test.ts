/** Combat11 native measured 199 PASS / 4 FAIL across 203 cases. The old
 * implicit selector could charge the damage-null partner ritual on a punch.
 * Shared authored combat roles preserve defensive projection and real offensive
 * work; rituals retain their separate people/work authority. The original
 * submission/road controls remain unchanged and their further diagnoses are
 * pending. These additive role controls are unrun, not acceptance claims. */
/** Oct7 source audit: played opponents reached combatantOf with an invented
 * combat qi100 even when their actual pool/held-art cooldown had been spent
 * on a journey. This uses a real seeded current person, the actual model
 * routing boundary with a scripted provider, and one actual returned strike.
 * Operator setup gives both bodies the same realm and the NPC one real held
 * catalog attack art/finite pool; it does not fabricate presence, a cast,
 * damage or a winner. Numeric native exchange occurrence must reach its
 * canonical world row. The named PC strike tool's separate once-charge and
 * cooldown controls remain in combat-manage.test.ts. These new controls
 * are unrun; scripted routing proves mechanics, never live model acceptance. */
import {expect,it} from 'vitest';
import {makeGameInWorld,ScriptedProvider,engineCalls} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {TECHNIQUES} from '../../src/data/cultivation/techniques.js';
import {setRealm,maxQiOf} from '../../src/engine/world/npc-state.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {theAreasOf} from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import {worldLocationFor} from '../../src/web/entities.js';
it('a played real opponent cast writes its own cost and cooldown before any mortality',async()=>{
 const plans=['{"action":"look"}'];const provider=new ScriptedProvider({plans,narrations:['Actual engine facts.']});
 const h=await makeGameInWorld({seed:'actual-opponent-art-use',worldSeed:'road-world',
  narrator:new ProviderNarrator(provider,{model:'test-model',timeoutMs:5000})});
 await h.game.newRun('Practitioner');await h.game.act('I look around');
 const world=await h.game.loadWorld();if(!world)throw Error('Actual played world absent');
 const entry=h.game.currentRun(),present=h.game.present(entry.cultivator);
 const npc=world.npcs.find(n=>n.status==='alive'&&present.some(row=>row.id===n.id));
 const art=TECHNIQUES.find(a=>a.category==='attack'&&a.qiCost>0&&a.cooldown>0&&a.requiredOrdinal<15);
 if(!npc||!art)throw Error('Actual opening person/catalog attack absent');
 const ordinal=Math.max(15,art.requiredOrdinal),now=routineTime(world);
 const prepared=setRealm(npc,ordinal,now),qi=maxQiOf(prepared);
 const actor={...prepared,cultivation:{...prepared.cultivation,qi,techniqueIds:[art.id],techniqueCooldowns:{}}};
 world.npcs[world.npcs.findIndex(n=>n.id===npc.id)]=actor;
 const place=worldLocationFor(world,entry.cultivator.location);if(!place)throw Error('Actual player ground absent');
 const area=theAreasOf(world,place).whereIs.get(actor.id);if(!area)throw Error('Actual person has no projected area');
 h.game.repos.cultivators.update(entry.cultivator.id,{realmOrdinal:ordinal,hp:10000,maxHp:10000,standingIn:area});
 h.game.noteEncounter(h.game.currentRun().cultivator,entry.run,{kind:'cultivator',id:actor.id,name:actor.name},
  'told','Operator fixture: this actual opponent was introduced before the bounded combat control.');
 expect(h.game.present(h.game.currentRun().cultivator).some(row=>row.id===actor.id)).toBe(true);
 plans.push(JSON.stringify({action:'attack',target:actor.name}));
 const acted=await h.game.act('I attack '+actor.name+'.');
 expect(acted.toolCalls.some(call=>call.name==='narrator.plan'&&call.source==='model')).toBe(true);
 expect(engineCalls(acted).some(call=>call.name==='combat.round'||call.name==='combat_manage.resolve')).toBe(true);
 const actual=await h.game.loadWorld();if(!actual)throw Error('Actual combat world absent');
 const live=actual.npcs.find(n=>n.id===actor.id);if(!live)throw Error('Actual opponent vanished');
 const casts=actual.history.facts.filter(f=>f.data.techniqueId===art.id
  &&typeof f.data.npcCombatArtUse==='string'&&f.actors.some(a=>a.id===actor.id));
 expect(casts).toHaveLength(1);
 expect(live.cultivation.qi).toBe(qi-art.qiCost);
 expect(live.cultivation.techniqueCooldowns?.[art.id]).toBe(art.cooldown);
},120000);

it('implicit played fighting selects actual offensive or defensive work instead of a higher-mastered partner ritual',async()=>{
 const h=await makeGameInWorld({seed:'implicit-art-role',worldSeed:'road-world'});await h.game.newRun('Practitioner');
 const entry=h.game.currentRun(),rite=TECHNIQUES.find(a=>a.category==='dual_cultivation'&&a.runsOn==='the_others'),
  combat=TECHNIQUES.find(a=>a.category==='defense'&&a.damage===null&&a.requiredOrdinal<15);
 if(!rite||!combat)throw Error('Actual catalog lacks ritual/defensive role controls');
 h.game.repos.cultivators.update(entry.cultivator.id,{realmOrdinal:Math.max(rite.requiredOrdinal,combat.requiredOrdinal)});
 for(const known of h.game.repos.techniques.listKnown(entry.cultivator.id))h.game.repos.techniques.forget(entry.cultivator.id,known.id);
 if(!h.game.repos.techniques.learn(entry.cultivator.id,rite.id,1))throw Error('Actual native ritual lesson failed');
 expect(h.game.artTheyWouldFightWith(h.game.currentRun().cultivator)).toBeUndefined();
 if(!h.game.repos.techniques.learn(entry.cultivator.id,combat.id,.25))throw Error('Actual native defensive lesson failed');
 const before=h.game.currentRun();expect(h.game.artTheyWouldFightWith(before.cultivator)).toBe(combat.id);
 expect(h.game.currentRun()).toEqual(before);
},120000);
