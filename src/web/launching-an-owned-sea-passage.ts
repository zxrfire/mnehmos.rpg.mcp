/** An owned timber ship boards only an actual admitted dock-to-dock water lane.
 * Its ordinary owner/pilot, finite heads, native season/weather and actual chest
 * are checked before custody/acceptance. No public fare or invented ship stores.
 */
import type {Cultivator,Run} from '../schema/cultivation.js';
import type {GameService} from './turn-engine.js';
import {worldLocationFor} from './entities.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {quoteOwnedSeaDeparture} from '../engine/world/an-owned-sea-course.js';
import {requireConveyance} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import {takeItAlong,isWithThem} from '../engine/world/a-vehicle.js';
import {isRuined} from '../engine/world/possessions.js';
import {whatTheChestBurns} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {acceptOwnedPassage,spendOnOwnedPassage,peopleUnavailableForOwnedBoarding} from './an-owned-passage.js';
import {factsForRefusal} from './facts.js';
import {refused} from './tool-result-prose.js';

export async function launchOwnedSeaPassage(game:GameService,run:Run,body:Cultivator,
 vesselId:string,toId:string,pilotId:string,companions:string[]){
 const world=game.atHand,fresh=game.repos.cultivators.getById(body.id)??body;
 const craft=world?.objects.find(o=>o.id===vesselId),from=world&&worldLocationFor(world,fresh.location);
 const refusal=(why:string)=>refused('engine.actualOwnedSeaCourse','ride',factsForRefusal(
  'The ship cannot begin that water passage.',why,'No craft, body, purse, claim or time was altered.'));
 if(!world||!fresh.alive||!craft||isRuined(craft)||craft.ownerId!==body.id||craft.possessorId!==null||!from
  ||!isWithThem(craft,body.id,from.id)||typeof craft.data.conveyanceId!=='string')return refusal('The actual owned ship and operator must be here at the boarding dock.');
 const kind=requireConveyance(craft.data.conveyanceId),heads=1+new Set(companions).size,day=routineTime(world);
 if(!kind.waterOnly||heads>kind.heads||pilotId!==body.id&&!companions.includes(pilotId)
  ||peopleUnavailableForOwnedBoarding(world,companions,from.id,day).length)return refusal('The actual pilot and passengers must be present and fit in the same finite hull.');
 const quote=quoteOwnedSeaDeparture(world,from.id,toId,day,heads);
 if(!quote)return refusal('No native dock-to-dock water lane is open for this actual departure. A walking road or a named ocean is not a sailing route.');
 const fuel=whatTheChestBurns({conveyance:kind,daysOneWay:quote.days,heads,trips:1});
 if(fuel>fresh.spiritStones)return refusal(fuel+' spirit stones are needed for this actual sailing; '+fresh.spiritStones+' are held.');
 // No async interleave follows the final quote before the accepted boarding.
 takeItAlong(world.objects,craft,body.id);
 acceptOwnedPassage(game,run,fresh,{vesselId,pilotId,fromId:from.id,toId,walkingDays:quote.walkingDays,
  days:quote.days,conveyanceId:kind.id,power:craft.power,companions,seaLane:quote.lane});
 const sailed=await spendOnOwnedPassage(game,run,game.currentRun().cultivator,quote.days,undefined,run.turn+1,true);
 if(!sailed)throw new Error('An accepted private sea course lost its native span input');
 return sailed;
}
