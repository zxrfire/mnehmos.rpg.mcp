/** Oct7 physical shuttle audit: eight bodies/capacity four quoted two loads.
 * One actual pilot plus seven passengers needs three loads. A genuine operator
 * remains aboard each leg and consumes native fuel; the old unspecified quote
 * remains its legacy contract. These pure quote controls are unrun and do not
 * claim that a live multi-load itinerary is already admitted. */
import {expect,it} from 'vitest';
import {requireConveyance} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {priceJourney,whatTheChestBurns} from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
it('one pilot and seven passengers need three real loads in the existing four-seat carriage',()=>{
 const craft=requireConveyance('conv-carriage-mortal');expect(craft.heads).toBe(4);
 const old=priceJourney({walkingDays:8,conveyance:craft,heads:8});
 const actual=priceJourney({walkingDays:8,conveyance:craft,heads:8,pilotHeads:1});
 expect(old.trips).toBe(2);expect(actual?.trips).toBe(3);
 expect(actual?.daysForEverybody).toBe(old.daysOneWay*5);
 expect(priceJourney({walkingDays:8,conveyance:craft,heads:1,pilotHeads:1})?.trips).toBe(1);
 expect(priceJourney({walkingDays:8,conveyance:craft,heads:5,pilotHeads:4})).toBeNull();
});
it('the actual spirit-boat quote equals its loaded and pilot-only native leg fuel',()=>{
 const craft=requireConveyance('conv-spirit-boat'),heads=2*craft.heads;
 const actual=priceJourney({walkingDays:10,conveyance:craft,heads,pilotHeads:1});
 if(!actual)throw Error('Real boat has no actual pilot capacity');
 expect(actual.trips).toBe(3);
 // The actual group has one pilot and the remaining passengers. Two full
 // loads leave one passenger on the third load, with the same pilot.
 const loaded=[craft.heads,craft.heads,2];
 const nativeLegs=[loaded[0]!,1,loaded[1]!,1,loaded[2]!];
 const summed=nativeLegs.reduce((sum,aboard)=>sum+whatTheChestBurns({conveyance:craft,
  daysOneWay:actual.daysOneWay,heads:aboard,trips:1}),0);
 expect(actual.stonesBurned).toBe(summed);
 expect(actual.daysForEverybody).toBe(actual.daysOneWay*nativeLegs.length);
});
