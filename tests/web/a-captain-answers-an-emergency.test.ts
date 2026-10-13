/** Captains previously had no autonomous response to real bodily trouble aboard.
 * A noticed case now enters ordinary person odds and the existing physical
 * return. Neither consent nor a cure is guaranteed. These played controls pin
 * the world and select an ordinary low/high decision draw, without mocking
 * the decision or replacing the hull. SQL and Native passengers must actually
 * follow the changed course; the original fare remains the only boarding fare.
 * At the exact review date a lifted hold needs a distinct resumed receipt;
 * deduplicating it to the held parent left that passenger's course marked held.
 */
import { expect, it } from 'vitest';
import { atTheActualCaptain } from './fixtures/at-the-real-captain.js';
import { bodilyTroubleAboard } from '../../src/engine/world/a-captain-answers-trouble.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { makeAreaStatus, liftStatus, STOPS_PASSAGE } from '../../src/engine/world/what-is-true-of-a-place-right-now.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
import {makeFact} from '../../src/engine/world/history.js';
import {appendWorldFact} from '../../src/engine/world/who-was-there-when-it-happened.js';

it('an NPC calendar rechecks a held ship and records resumption at the real status expiry',async()=>{
 const h=await atTheActualCaptain();try{
  const world=h.game.atHand!,day=routineTime(world),position=shipPassengerAt(world,h.receipt.id,day)!;
  const status=makeAreaStatus({id:'short-actual-sea-storm',areaId:position.locationId!,kind:'storm',
   statement:'Storm conditions stop passage here.',cause:{what:'The actual storm.',decidedById:null,factId:null},
   beganOnDay:day,reviewOnDay:day+.25,stops:[STOPS_PASSAGE]});world.statuses.push(status);
  for(let sample=0;sample<10000;sample++){
   const seed=`captain-real-recheck-${sample}`;
   if(forStream(seed,'captain-duty-decision',h.captain.id,`passage:${status.id}:${status.reviewOnDay}`).next()<.01){world.seed=seed;break;}
  }
  h.plans.push(JSON.stringify({action:'look'}));expect((await h.game.act('I look around')).narration).toContain('hold the ship');
  advanceWorldForPlay(world,{days:.251});
  expect(world.history.facts.some(fact=>fact.summary.includes('resumed the accepted voyage')&&fact.day===status.reviewOnDay)).toBe(true);
  const sailing=shipPassengerAt(world,h.receipt.id,routineTime(world))!;
  expect(typeof sailing.receipt.data.heldForStatusId).not.toBe('string');
  expect(sailing.remainingDays).toBeLessThan(position.remainingDays);
 }finally{h.db.close();}
},120_000);

it('a real closed passage makes a captain hold; an actual lifting resumes the same paid voyage', async () => {
    const h = await atTheActualCaptain();
    try {
        const world = h.game.atHand!, day = routineTime(world), position = shipPassengerAt(world, h.receipt.id, day)!;
        const status = makeAreaStatus({ id:'actual-open-water-storm',areaId: position.locationId!, kind: 'storm', statement: 'Storm conditions stop passage here.',
            cause: {what:'The actual storm.',decidedById:null,factId:null}, beganOnDay:day,reviewOnDay:day+3,
            stops:[STOPS_PASSAGE],signs:['Heavy seas.'] });
        world.statuses.push(status);
        const key = `passage:${status.id}:${status.reviewOnDay}`;
        for (let sample = 0; sample < 10000; sample++) {
            const seed = `captain-holds-${sample}`;
            if (forStream(seed, 'captain-duty-decision', h.captain.id, key).next() < .01) {world.seed=seed;break;}
        }
        h.plans.push(JSON.stringify({action:'look'}));
        const held = await h.game.act('I look around');
        expect(held.narration).toContain('hold the ship');
        const waiting = shipPassengerAt(world,h.receipt.id,routineTime(world))!;
        expect(waiting.departureDay).toBe(status.reviewOnDay);
        expect(waiting.remainingDays).toBeCloseTo(position.remainingDays);
        expect(waiting.locationId).toBe(position.locationId);
        world.statuses[world.statuses.indexOf(status)] = liftStatus(status,routineTime(world));
        h.plans.push(JSON.stringify({action:'look'}));
        const resumed = await h.game.act('I look around');
        expect(resumed.narration).toContain('resumed the accepted voyage');
        const sailing = shipPassengerAt(world,h.receipt.id,routineTime(world))!;
        expect(sailing.departureDay).toBe(routineTime(world));
        expect(sailing.toId).toBe(position.toId);
        expect(sailing.remainingDays).toBeCloseTo(position.remainingDays);
    } finally {h.db.close();}
},120_000);

it('a shipmaster notices a stricken actual passenger and puts the same hull back toward the nearer port', async () => {
    const h = await atTheActualCaptain();
    try {
        const world = h.game.atHand!, day = routineTime(world), at = world.npcs.findIndex(person => person.id === h.passenger.id);
        world.npcs[at].cultivation.plague = { outbreakId: 'actual-course-plague', contractedOnDay: day,
            endsOnDay: day + 30, fatalOnDay: null, treatedOnDay: null };
        const trouble = bodilyTroubleAboard(world.npcs[at], day)!;
        expect(trouble).not.toBeNull();
        // The passenger's actual paid leg also carries an unfinished private
        // undertaking. Returning for care cannot complete it at the old venue.
        const accepted=shipPassengerAt(world,h.receipt.id,day)!;
        const undertaking=appendWorldFact(world,makeFact({day,kind:'gathering',visibility:'secret',
            locationId:accepted.locationId,causes:[h.receipt.id],actors:[{id:h.passenger.id,name:h.passenger.name,role:'traveller'}],
            summary:'An actual passenger has private work at the accepted destination.',data:{publicMission:true,
                privateSponsorId:h.passenger.id,destinationId:h.to.id,reason:'private work',
                publicRoute:JSON.stringify([{fromId:h.from.id,toId:h.to.id,service:'ship',days:accepted.arrivalDay-accepted.departureDay,
                    walkingDays:accepted.arrivalDay-accepted.departureDay}]),publicServiceEnd:accepted.arrivalDay+1,
                plannedReturnDay:accepted.arrivalDay*2+1}}),{recur:false,bystanders:false});
        const working=world.npcs.find(person=>person.id===h.passenger.id)!;
        working.activity={...working.activity!,capitalMissionId:undertaking.id,capitalMissionLeg:0};
        for (let sample = 0; sample < 10000; sample++) {
            const seed = `captain-assists-${sample}`;
            if (forStream(seed, 'captain-duty-decision', h.captain.id, trouble.key).next() < .01) { world.seed = seed; break; }
        }
        const before = h.game.currentRun();
        h.plans.push(JSON.stringify({action:'look'}));
        const told = await h.game.act('I look around');
        expect(told.narration).toContain(`put in at ${h.from.name} for care`);
        const actual = shipPassengerAt(h.game.atHand!, h.receipt.id, routineTime(h.game.atHand!))!;
        expect(actual.toId).toBe(h.from.id);
        expect(h.game.currentRun().cultivator.location).not.toBe(h.from.name);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(h.game.atHand!.npcs.find(person => person.id === h.passenger.id)!.activity!.returnTo).toBe(h.from.id);
        h.plans.push(JSON.stringify({action:'wait',days:actual.remainingDays}));
        const onward = await h.game.act('I wait aboard until we put in');
        expect(h.game.currentRun().cultivator.location, onward.narration).toBe(h.from.name);
        expect(h.game.atHand!.npcs.find(person => person.id === h.passenger.id)!.locationId).toBe(h.from.id);
        expect(h.game.atHand!.npcs.find(person => person.id === h.passenger.id)!.activity!.note).toContain('original undertaking is waiting');
        expect(h.game.atHand!.history.facts.some(fact=>fact.data.missionWork===undertaking.id&&fact.data.finished===true)).toBe(false);
        expect(h.game.atHand!.npcs.find(person => person.id === h.passenger.id)!.cultivation.plague?.treatedOnDay).toBeNull();
    } finally { h.db.close(); }
}, 120_000);

it('the ordinary captain can continue despite the report, and repeated looks do not reroll the same incident', async () => {
    const h = await atTheActualCaptain();
    try {
        const world = h.game.atHand!, day = routineTime(world), passenger = world.npcs.find(person => person.id === h.passenger.id)!;
        passenger.cultivation.plague = { outbreakId: 'actual-refused-course-plague', contractedOnDay: day,
            endsOnDay: day + 30, fatalOnDay: null, treatedOnDay: null };
        const trouble = bodilyTroubleAboard(passenger, day)!;
        for (let sample = 0; sample < 10000; sample++) {
            const seed = `captain-continues-${sample}`;
            if (forStream(seed, 'captain-duty-decision', h.captain.id, trouble.key).next() > .99) { world.seed = seed; break; }
        }
        h.plans.push(JSON.stringify({action:'look'}));
        const said = await h.game.act('I look around');
        expect(said.narration).toContain('continued the accepted course');
        expect(shipPassengerAt(h.game.atHand!, h.receipt.id, routineTime(h.game.atHand!))!.toId).toBe(h.to.id);
        const facts = h.game.atHand!.history.facts.filter(fact => fact.data.captainTrouble).length;
        await h.game.act('I look around');
        expect(h.game.atHand!.history.facts.filter(fact => fact.data.captainTrouble).length).toBe(facts);
    } finally { h.db.close(); }
}, 120_000);
