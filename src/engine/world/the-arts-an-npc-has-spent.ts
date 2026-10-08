/** Actual NPC art use stores one remaining cooldown, alongside its one qi pool.
 * World intervals arrive from native receipts, not time since the last use. */
import { getTechnique } from '../../data/cultivation/techniques.js';
import { artUseReadiness,effectiveArtCooldownDays,type AnArtUseInterval } from '../cultivation/an-art-that-is-ready-to-use.js';
import { type NpcRecord,qiStandingOn,spendNpcQi } from './npc-state.js';
export function npcArtReadiness(npc:NpcRecord,id:string,day:number){
 const art=getTechnique(id);
 if(npc.status!=='alive'||!art||!npc.cultivation.techniqueIds.includes(id))return {reason:'technique_not_known'} as const;
 return artUseReadiness(art,npc.cultivation.techniqueCooldowns?.[id]??0,qiStandingOn(npc,day));
}
/** Readiness precedes a single native qi debit and catalog cooldown. */
export function useAnNpcArt(npc:NpcRecord,id:string,day:number):NpcRecord|null {
 const art=getTechnique(id);if(!art||npcArtReadiness(npc,id,day))return null;
 const charged=spendNpcQi(npc,art.qiCost,day);if(!charged)return null;
 return {...charged,cultivation:{...charged.cultivation,techniqueCooldowns:{
  ...charged.cultivation.techniqueCooldowns,[id]:art.cooldown}}};
}
export function spendNpcArtInterval(npc:NpcRecord,interval:AnArtUseInterval,day:number):NpcRecord {
 const days=effectiveArtCooldownDays(interval.cumulativeElapsed,interval.previousElapsed);
 if(days<=0||!npc.cultivation.techniqueCooldowns)return npc;
 return {...npc,cultivation:{...npc.cultivation,techniqueCooldowns:Object.fromEntries(
  Object.entries(npc.cultivation.techniqueCooldowns).map(([id,left])=>[id,Math.max(0,left-days)]))},updatedOnDay:day};
}
