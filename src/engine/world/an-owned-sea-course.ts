/** Private water courses reuse the native dock lanes, sea weather and water read.
 * A stored lane is immutable acceptance evidence, not a mutable position. The
 * accepted dates and actual current clock supply all later progress. No public
 * seat, free ship stores, crew factory or new maritime distance is implied.
 */
import type {WorldState} from './world-state.js';
import type {SeaLane} from './what-a-sea-crossing-costs.js';
import {resolveCrossing} from './what-a-sea-crossing-costs.js';
import {publicShipLinesFrom} from './public-shipping.js';
import {monthOf} from './the-fare-and-calendar-of-a-passage.js';
import {waterUnderSeaPassage} from './the-water-under-a-passage.js';
import {worldLocationFor} from './place-lookup.js';
import {journeyTimeHasReached} from './places-on-the-way.js';

export function readAcceptedSeaLane(value:unknown):SeaLane|null {
 if(typeof value!=='string')return null;
 let v:unknown;try{v=JSON.parse(value);}catch{return null;}
 if(!v||typeof v!=='object'||!('id'in v)||typeof v.id!=='string'
  ||!('fromPlace'in v)||typeof v.fromPlace!=='string'||!('toPlace'in v)||typeof v.toPlace!=='string'
  ||!('expectedDays'in v)||typeof v.expectedDays!=='number'||!Number.isFinite(v.expectedDays)||v.expectedDays<=0
  ||!('openMonthsPerYear'in v)||typeof v.openMonthsPerYear!=='number'
  ||!('weatherSeverity'in v)||typeof v.weatherSeverity!=='number'
  ||!('intermediateLandfallDays'in v)||!Array.isArray(v.intermediateLandfallDays)
  ||!v.intermediateLandfallDays.every(d=>typeof d==='number'&&Number.isFinite(d)))return null;
 return {id:v.id,fromPlace:v.fromPlace,toPlace:v.toPlace,expectedDays:v.expectedDays,
  openMonthsPerYear:v.openMonthsPerYear,weatherSeverity:v.weatherSeverity,
  intermediateLandfallDays:v.intermediateLandfallDays,
  ...('name'in v&&typeof v.name==='string'?{name:v.name}:{}),
  ...('water'in v&&typeof v.water==='string'?{water:v.water}:{})};
}

/** Only actual catalog dock endpoints admit a new private sailing. The public
 * fare and hull availability are not private ownership permissions. Seasons and
 * storm duration remain resolveCrossing's existing answer; zero loaded stores
 * here makes no promise of food. The native body/pack supplies actual resources. */
export function quoteOwnedSeaDeparture(world:WorldState,fromId:string,toId:string,day:number,heads:number){
 const from=world.locations.find(p=>p.id===fromId),to=world.locations.find(p=>p.id===toId);
 if(!from||!to||fromId===toId||!(heads>=1))return null;
 const line=publicShipLinesFrom(world,from.name,day).find(one=>one.to===to.name);
 if(!line)return null;
 const crossing=resolveCrossing(world.seed,line.lane,{heads,rationDaysAboard:0,stonesInChest:0,advancingHeads:0},monthOf(day));
 return crossing.laneWasShut?null:{lane:line.lane,days:crossing.daysTaken,walkingDays:line.walkingDays};
}

export function ownedSeaGround(world:WorldState,fromId:string,toId:string,departure:number,arrival:number,
 lane:SeaLane,day:number):string|null {
 if(journeyTimeHasReached(day,arrival))return toId;
 if(day<=departure)return fromId;
 const from=world.locations.find(p=>p.id===fromId),to=world.locations.find(p=>p.id===toId);
 if(!from||!to)return null;
 const water=waterUnderSeaPassage({from:from.name,bound:to.name,lane,sailed:day-departure});
 return water?worldLocationFor(world,water)?.id??null:null;
}
