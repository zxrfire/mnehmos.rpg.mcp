/** Oct7 owner requires actual ship objects, capacity and rooms, not spirit-boat
 * fiction for mortal public crews. A public ship is realised only at accepted
 * boarding under its existing living operator. Its maritime lane remains the
 * duration/fare authority; possession loss and ruin never mint another hull.
 * Hull admission is checked here; played cabin acceptance is in a-public-ship-has-real-cabins.test.ts.
 */
import {expect,it} from 'vitest';
import {seedWorld} from '../../../src/engine/world/seeding.js';
import {loadCultivationCatalog} from '../../../src/engine/world/catalog.js';
import {SEA_LANES} from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import {publicShipLinesFrom,quotePublicPassage,theLandfall} from '../../../src/engine/world/public-shipping.js';
import {ensureShipCrew,bindShipCrewToPassage} from '../../../src/engine/world/ship-crew.js';
import {publicShipHullCanBeBoarded,realiseAcceptedPublicShipHull} from '../../../src/engine/world/a-public-ship-hull.js';
import {requireConveyance} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {itWantsAPilot,whoItIsWith} from '../../../src/engine/world/a-vehicle.js';
import {isRuined,ruin} from '../../../src/engine/world/possessions.js';
import {locationOnNpcJourney} from '../../../src/engine/world/places-on-the-way.js';

const catalog=await loadCultivationCatalog();
function acceptedCourse(){
 const world=seedWorld({seed:'ordinary-public-water-hull',catalog,presentYear:0}).state;
 const lane=SEA_LANES.find(one=>one.openMonthsPerYear===12)??SEA_LANES[0]!;
 const from=world.locations.find(place=>place.name===theLandfall(lane.fromPlace))!;
 const day=world.currentDay;
 const line=publicShipLinesFrom(world,from.name,day).find(one=>one.runsFromDay===null)!;
 const to=world.locations.find(place=>place.name===line.to)!;
 const quote=quotePublicPassage(world,from.id,to.id,day)!;
 expect(quote).not.toBeNull();
 return {world,quote};
}
it('realises one water-only hull under the actual low-realm operator only after boarding',()=>{
 const {world,quote}=acceptedCourse();
 expect(world.objects.some(one=>one.id===quote.vesselId)).toBe(false);
 const crew=ensureShipCrew(world,quote.lane,quote.fromId,quote.departureDay);
 bindShipCrewToPassage(world,quote);
 const operator=world.npcs.find(one=>one.id===crew.find(person=>person.identity.occupation==='shipmaster')!.id)!;
 expect(operator.cultivation.realmOrdinal).toBeLessThan(29);
 const hull=realiseAcceptedPublicShipHull(world,quote,operator)!;
 expect(hull.id).toBe(quote.vesselId);expect(hull.ownerId).toBe(operator.id);
 expect(whoItIsWith(hull)).toBe(operator.id);
 const kind=requireConveyance(String(hull.data?.conveyanceId));
 expect(kind.waterOnly).toBe(true);expect(itWantsAPilot(kind)).toBe(false);
 expect(kind.heads).toBeGreaterThan(crew.length);expect(kind.interiorLayout?.length).toBeGreaterThan(0);
 expect(realiseAcceptedPublicShipHull(world,quote,operator)).toBe(hull);
 expect(world.objects.filter(one=>one.id===hull.id)).toHaveLength(1);
 expect(locationOnNpcJourney(world.locations,operator,quote.arrivalDay)).toBe(quote.toId);
});
it('refuses a ruined or transferred actual hull without a replacement or crew warp',()=>{
 const {world,quote}=acceptedCourse();
 const crew=ensureShipCrew(world,quote.lane,quote.fromId,quote.departureDay);
 bindShipCrewToPassage(world,quote);
 const operator=world.npcs.find(one=>one.id===crew.find(person=>person.identity.occupation==='shipmaster')!.id)!;
 const hull=realiseAcceptedPublicShipHull(world,quote,operator)!;
 const at=world.objects.findIndex(one=>one.id===hull.id),count=world.objects.length;
 world.objects[at]={...hull,possessorId:'actual-other-holder'};
 expect(publicShipHullCanBeBoarded(world,quote)).toBe(false);
 expect(realiseAcceptedPublicShipHull(world,quote,operator)).toBeNull();
 world.objects[at]=ruin(hull,{onDay:quote.departureDay,source:'Native loss'});
 expect(isRuined(world.objects[at]!)).toBe(true);
 expect(publicShipHullCanBeBoarded(world,quote)).toBe(false);
 expect(realiseAcceptedPublicShipHull(world,quote,operator)).toBeNull();
 expect(world.objects).toHaveLength(count);
 expect(operator.activity?.fromLocationId).toBe(quote.fromId);
});
