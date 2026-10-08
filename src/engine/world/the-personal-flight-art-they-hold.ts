/** The existing actual school/rung reader is shared by played and world bodies. */
import { getTechnique } from '../../data/cultivation/techniques.js';
import { primaryRoadOf } from '../../schema/cultivation.js';
import { couldFlyOnTheirOwnBlade } from './what-a-conveyance-does-to-a-journey.js';
export function heldPersonalFlightArt(ordinal:number,ids:readonly string[],requested?:string){
 const held=ids.map(id=>getTechnique(id)).filter((art):art is NonNullable<typeof art>=>!!art)
  .map(art=>({...art,subject:primaryRoadOf(art)}));
 return held.filter(art=>art.category==='movement'
  &&(!requested||art.name.toLowerCase().includes(requested.toLowerCase())||art.id===requested)
  &&couldFlyOnTheirOwnBlade({realmOrdinal:ordinal,known:held,flightArt:art}).can)
  .sort((a,b)=>b.requiredOrdinal-a.requiredOrdinal)[0]??null;
}
