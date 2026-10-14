import { routineTime } from '../../src/engine/world/npc-routines.js';
/**
 * A paid roadside pause previously discarded the carriage claim, and a three-
 * hour reply advanced only age/run fractions. These front-door clock controls
 * use an accepted ordinary driver and vehicle, then the real passHours adapter.
 * The driver moves independently; the SQL passenger follows without writing a
 * location onto the membership-only player world row. A dated actual driver
 * expiry stops the committed body span at that boundary, rather than claiming
 * the later destination. No second fare or replacement driver is authorised.
 * Overlay05 passed the physical .0625-day interruption but incorrectly required
 * a forgotten driver ID to stay in history. Native forgetting may null that
 * reference; the parked hull and actual dated paid leg must remain.
 * Root transport13 diagnostic83273 observed a full 3.875-day remainder with
 * SQL passenger, driver and hull at Paid destination and no interruption. The
 * summed clock was 4.333333333333332 against arrival 4.333333333333333: both
 * canonical time comparisons reached, but the receipt's raw >= disagreed.
 * This control now requires the same canonical moment and actual destination
 * for receipt and body; it retains the complete native elapsed-span check.
 * The Frozen14 repair is pending verification; original horizons are retained.
 * Oct10 integration: a dead driver's hull is parked at its exact road position,
 * rather than the corridor's shared display label. The passenger must stand at
 * that same physical ground; pinning the former coarse name hid this distinction.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { createNpc, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { addPlacesOnTheWay, ROUTE_STOP, journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { quotePublicCarriage, commitPublicCarriage, publicCarriagePassage, publicCarriageGround } from '../../src/engine/world/public-carriages.js';
import { keepThePaidCarriage, thePaidCarriageClaim, continueThePaidCarriage } from '../../src/web/a-paid-carriage-on-the-road.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { makeAreaStatus, liftStatus, STOPS_PASSAGE } from '../../src/engine/world/what-is-true-of-a-place-right-now.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { roadPositionOfNpc } from '../../src/engine/world/places-on-the-way.js';

async function boarded() {
    const { game, db } = makeGame({ seed: 'physical-road-run', worldEnabled: true });
    await createWorld({ seed: 'physical-road-world', presentYear: 0 });
    await game.newRun('Paid road passenger');
    const run = game.currentRun().run;
    const player = game.repos.cultivators.getById(game.state().cultivator.id)!;
    const world = await prepareWorldClockForPreciseSpan(run, player);
    game.atHand = world;
    const from = makeLocation({ id: 'paid-from', name: 'Paid departure', kind: 'settlement' });
    const to = makeLocation({ id: 'paid-to', name: 'Paid destination', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    world.locations = [from, to]; addPlacesOnTheWay(world.locations);
    world.npcs = [createNpc(world.seed, { id: player.id, name: player.name, onDay: world.currentDay,
        bornOnDay: world.currentDay - 20 * 365, locationId: null, tags: [PLAYER_ROW_TAG] })];
    world.factions = []; world.objects = []; world.schedule = [];
    game.repos.cultivators.update(player.id, { location: from.name, standingIn: null,
        realmOrdinal: 20, spiritStones: 200, hp: 100, maxHp: 100 });
    const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day: world.currentDay,
        conveyanceId: 'conv-carriage-mortal', passengerIds: [player.id], fareStones: 12, hired: false,
        playedPassenger: { id: player.id, locationId: from.id, alive: true } })!;
    expect(quote).not.toBeNull();
    const receipt = commitPublicCarriage(world, quote)!;
    expect(receipt).not.toBeNull();
    game.repos.cultivators.applyDeltas(player.id, { spiritStones: -quote.fareStones });
    keepThePaidCarriage(db, player.id, receipt.id); game.theWorldMoved();
    return { game, db, world, quote, receipt, player, from, to,
        stop: world.locations.find(place => place.tags.includes(ROUTE_STOP))! };
}

it('a driver holds at the real road point for a reported danger, then resumes without another fare',async()=>{
 const h=await boarded();try{
  const before=h.game.currentRun();
  await passHours(h.game,before.run,before.cultivator,3);
  const world=h.game.atHand!,day=routineTime(world),actual=publicCarriagePassage(world,h.receipt.id,h.player.id,day)!;
  const point=roadPositionOfNpc(world.locations,actual.driver,day);
  const band=createNpc(world.seed,{id:'actual-roadblock-bandit',name:'The roadblock keeper',occupation:'bandit',
   onDay:day,bornOnDay:day-30*365,locationId:actual.locationId});world.npcs.push(band);
  const status=makeAreaStatus({id:'actual-roadblock-warning',areaId:actual.locationId,kind:'roadblock',
   statement:'A person blocks passage on this road.',cause:{what:'The actual roadblock.',decidedById:band.id,factId:null},
   beganOnDay:day,reviewOnDay:day+2,stops:[STOPS_PASSAGE],causeKnownLocally:true});world.statuses.push(status);
  const key=`passage:${status.id}:${status.reviewOnDay}`;
  for(let sample=0;sample<10000;sample++){
   const seed=`driver-holds-${sample}`;
   if(forStream(seed,'captain-duty-decision',actual.driver.id,key).next()<.01){world.seed=seed;break;}
  }
  const purse=h.game.currentRun().cultivator.spiritStones;
  const held=await h.game.act('I look around');
  expect(held.narration).toContain('hold the carriage');
  const waiting=publicCarriagePassage(world,h.receipt.id,h.player.id,routineTime(world))!;
  expect(roadPositionOfNpc(world.locations,waiting.driver,routineTime(world))).toEqual(point);
  expect(h.game.currentRun().cultivator.spiritStones).toBe(purse);
  world.statuses[world.statuses.indexOf(status)]=liftStatus(status,routineTime(world));
  const resumed=await h.game.act('I look around');
  expect(resumed.narration).toContain('resumed the accepted voyage');
  const current=h.game.currentRun();
  const moved=await passHours(h.game,current.run,current.cultivator,3);
  expect(moved.finished).toBe(true);
  expect(roadPositionOfNpc(world.locations,world.npcs.find(person=>person.id===actual.driver.id)!,routineTime(world))).not.toEqual(point);
 }finally{h.db.close();}
},120_000);

it('carries a .125-day reply and the exact remainder on the same paid passage', async () => {
    const { game, db, world, quote, receipt, player, stop, to } = await boarded();
    try {
        const before = game.currentRun();
        const reply = await passHours(game, before.run, before.cultivator, 3);
        expect(reply.finished).toBe(true);
        expect(game.atHand!.currentDay).toBe(quote.departureDay + .125);
        expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays + .125);
        expect(game.currentRun().cultivator.location).toBe(stop.name);
        expect(world.npcs.find(npc => npc.id === player.id)!.locationId).toBeNull();
        const claim = thePaidCarriageClaim(db, player.id)!;
        expect(claim.receiptId).toBe(receipt.id);
        const afterReply = game.currentRun();
        const arrived = await continueThePaidCarriage(game, afterReply.run, afterReply.cultivator,
            to.name, 'passage');
        expect(arrived?.outcome).toBe('executed');
        expect(arrived?.cutShort).toBeNull();
        const landedOn = game.atHand!.currentDay;
        expect(journeyTimeHasReached(landedOn, quote.arrivalDay)).toBe(true);
        expect(journeyTimeHasReached(quote.arrivalDay, landedOn)).toBe(true);
        const passage = publicCarriagePassage(game.atHand!, receipt.id, player.id, landedOn)!;
        expect(passage.arrived).toBe(true);
        expect(passage.remainingDays).toBe(0);
        expect(passage.locationId).toBe(to.id);
        expect(publicCarriageGround(game.atHand!, passage.vehicle, landedOn)).toBe(to.id);
        expect(game.currentRun().run.elapsedDays - before.run.elapsedDays)
            .toBeCloseTo(quote.arrivalDay - quote.departureDay, 12);
        expect(game.currentRun().cultivator.location).toBe(to.name);
        expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(thePaidCarriageClaim(db, player.id)).toBeNull();
        expect(world.npcs.filter(npc => npc.identity.occupation === 'carter')).toHaveLength(1);
    } finally { db.close(); resetCultivationWorlds(); }
});

it('commits only the real fraction before a driver dies during the requested reply', async () => {
    const { game, db, world, quote, receipt, player, to } = await boarded();
    try {
        const driver = world.npcs.find(npc => npc.id === quote.driverId)!;
        driver.cultivation.lifespanEndsOnDay = quote.departureDay + .0625;
        const before = game.currentRun();
        const reply = await passHours(game, before.run, before.cultivator, 3);
        expect(reply.finished).toBe(false);
        expect(reply.spent?.cutShort?.cause).toBe('the_world');
        expect(game.atHand!.currentDay).toBe(quote.departureDay + .0625);
        expect(game.currentRun().run.elapsedDays - before.run.elapsedDays).toBe(.0625);
        const parkedAt = world.objects.find(object => object.id === quote.vesselId)?.locationId;
        expect(parkedAt).toBeTruthy();
        expect(game.currentRun().cultivator.location).toBe(world.locations.find(place => place.id === parkedAt)?.name);
        expect(game.currentRun().cultivator.location).not.toBe(to.name);
        expect(game.currentRun().cultivator.alive).toBe(true);
        expect(thePaidCarriageClaim(db, player.id)).toBeNull();
        // Native forgetting may remove the dead row; it must never mint a replacement.
        expect(world.npcs.filter(npc => npc.status === 'alive' && npc.identity.occupation === 'carter')).toHaveLength(0);
        const actualReceipt = world.history.facts.find(fact => fact.id === receipt.id)!;
        expect(actualReceipt.data.vesselId).toBe(quote.vesselId);
        // Forgetting sanitizes obsolete human references; the physical paid leg remains.
        expect([null, driver.id]).toContain(actualReceipt.data.driverId);
        expect(actualReceipt.data.fromLocationId).toBe(quote.fromId);
        expect(actualReceipt.data.toLocationId).toBe(quote.toId);
        expect(actualReceipt.data.departureDay).toBe(quote.departureDay);
        expect(actualReceipt.data.arrivalDay).toBe(quote.arrivalDay);
        expect(world.npcs.some(person => person.id === driver.id && person.status === 'alive')).toBe(false);
        expect(world.npcs.find(npc => npc.id === player.id)!.locationId).toBeNull();
    } finally { db.close(); resetCultivationWorlds(); }
});

/** Preparatory native time defers completion; the following real wait owns it once.
 * Oct6 native31 run stopped at a branch-specific world.waitForHour label.
 * Accepted carriers may use another wait front door; native result receipt,
 * actual elapsed body/world time, one completion and original claim are the rule. */
it('keeps one completion across a deferred preparatory span and an actual wait', async () => {
    const { game, db, receipt } = await boarded();
    try {
        const before = game.currentRun(), start = routineTime(game.atHand!);
        
        const prepared = await passHours(game, before.run, before.cultivator, 3, before.run.turn + 1, false);
        expect(prepared.finished).toBe(true);
        expect(prepared.spent?.timeSkip?.simulatedDays).toBe(.125);
        expect(game.currentRun().run.turn).toBe(before.run.turn);
        const waited = await game.act('I wait for 3 hours');
        const after = game.currentRun();
        expect(waited.toolCalls.some(call => !call.name.startsWith('narrator.') && call.ok),
            JSON.stringify(waited.toolCalls)).toBe(true);
        expect(waited.toolCalls.filter(call => !call.name.startsWith('narrator.') && !call.ok),
            JSON.stringify(waited.toolCalls)).toEqual([]);
        expect(after.cultivator.alive).toBe(true);
        expect(after.cultivator.age).toBeGreaterThan(before.cultivator.age);
        expect(after.run.turn).toBe(before.run.turn + 1);
        expect(journeyTimeHasReached(after.run.elapsedDays, before.run.elapsedDays + .25)).toBe(true);
        expect(journeyTimeHasReached(before.run.elapsedDays + .25, after.run.elapsedDays)).toBe(true);
        expect(journeyTimeHasReached(routineTime(game.atHand!), start + .25)).toBe(true);
        expect(journeyTimeHasReached(start + .25, routineTime(game.atHand!))).toBe(true);
        expect(thePaidCarriageClaim(db, after.cultivator.id)?.receiptId).toBe(receipt.id);
    } finally { db.close(); resetCultivationWorlds(); }
});
