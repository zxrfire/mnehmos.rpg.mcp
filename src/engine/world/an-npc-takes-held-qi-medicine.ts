/** An ordinary, settled qi medicine already in the actual person's hand.
 * No house stock is taken without its own authority and no medicine is minted.
 * Unsettled medicine's wider sheet consequences still need an NPC persistence
 * port; this ordinary-medicine choice does not claim to implement those acts. */
import type { WorldState } from './world-state.js';
import { type NpcRecord,maxQiOf,carryingWounds } from './npc-state.js';
import { getPill } from '../../data/cultivation/pills.js';
import { isRuined } from './possessions.js';
import { swallow } from './where-the-pills-actually-are.js';
import { isSettledOnUse } from '../cultivation/grade-spread.js';
import { forStream } from '../cultivation/rng.js';
import { round4 } from '../social/common.js';
import { preparePillDose,preparePillToxicity,qiRestoredByDose } from '../cultivation/a-pill-dose-on-an-actual-body.js';

/** The actual row is a unique dose, so it also names this consumption's stream occasion. */
export function swallowOrdinaryHeldQiMedicine(world:WorldState,npc:NpcRecord,rowId:string,onDay:number):NpcRecord|null {
    if(npc.status!=='alive')return null;
    const at=world.objects.findIndex(row=>row.id===rowId),row=world.objects[at];
    if(!row || row.kind!=='pill' || row.possessorId!==npc.id || isRuined(row)
        || row.data.spent===true || row.tags.includes('spent') || typeof row.data.pillId!=='string')return null;
    const pill=getPill(row.data.pillId);
    if(!pill || pill.effect!=='restore_qi' || !isSettledOnUse(pill.grade)
        || npc.cultivation.qi===undefined || npc.cultivation.qi>=maxQiOf(npc))return null;
    // Settled medicines have no sheet consequence; no unknown NPC Insight[] is fabricated.
    const dose=preparePillDose(pill,{realmOrdinal:npc.cultivation.realmOrdinal,
        spiritRoot:npc.cultivation.spiritRoot,insights:[]},forStream(world.seed,'pill_outcome',npc.id,row.id));
    const toxicity=preparePillToxicity(pill,dose.outcome.toxicityMultiplier,npc.cultivation.pillToxicity??0,
        Math.floor(onDay),forStream(world.seed,'pill_toxicity',npc.id,row.id));
    const restored=qiRestoredByDose(npc.cultivation.qi,maxQiOf(npc),dose.dosed.potency);
    let next:NpcRecord={...npc,cultivation:{...npc.cultivation,qi:npc.cultivation.qi+restored,
        pillToxicity:round4(toxicity.toxicityAfter)},updatedOnDay:onDay};
    if(toxicity.poisonInjury)next=carryingWounds(next,[toxicity.poisonInjury],onDay);
    world.objects[at]=swallow(row,npc.id,onDay);
    return next;
}
