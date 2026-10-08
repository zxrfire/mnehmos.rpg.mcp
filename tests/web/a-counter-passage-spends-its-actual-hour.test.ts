/* CalendarAudit01 root native measured world365000.333/run.333, partyDay365000:
 * local0 said running, actual published phase0 world365000 is closed until365004.
 * Calendar01 corrects shared counter/NPC date to the existing persistent world
 * reader. This existing clock observer now quotes that same real published date;
 * every original hour, wait, body/run/world elapsed, location and fare assertion
 * remains. No crossing/recovery/calendar/fare rule is changed. */
/* Native08 bought passage in both arms. Its observer quoted the absolute persistent world date, while the actual counter API quotes floor(run.elapsedDays). Read that same native timetable date before purchase; route/time/fare/body/world assertions and runtime are unchanged. */
/* Native07 proved both arms only read the board: passage requires the exact native buy intent. This fixture correction purchases the advertised route; all clock/fare/location assertions remain unchanged. */
/* The native fixture prepares the same precise world authority as passage before reading its published routes, and retains the immutable pre-purchase quote instead of re-quoting on the later arrival date. These are setup/observation changes only, not a measured runtime finding. */
/* Native03 found the actual seeded timetable shut, so both arms stopped at fixture selection before passage. This successor retains the real published route and includes its actual advertised wait; it creates no open day and waives no clock assertion. */
/* Fixture02 compiler caught two misspelled quote-rate fields and a missing native passage intent; this successor corrects only those API arguments. All runtime and behavioural assertions are retained. */
/** A real surveyed counter advertised an hour, quoted zero days at the folding
 * floor, and its native arrival then charged a full day (counter70039 evidence).
 * The old quote deliberately omitted the hour when all journeys rounded to days.
 * This test spends actual native passage and observes body/world clocks before
 * checking the quote. A low passenger also retains the existing recovery term.
 * Only the player's opening body/place are arranged; route, fare, calendar and
 * arrival remain the native counter's decisions. No model prose is asserted.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { routesFrom } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { quotePassageAtACounter, settlingDaysForPassenger } from '../../src/engine/world/buying-passage-at-a-measured-span-counter.js';
import { FOLD_FLOOR_ORDINAL } from '../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
for (const ordinal of [FOLD_FLOOR_ORDINAL, 0]) it('native counter clocks retain the crossing hour at passenger ordinal '+ordinal, async () => {
 const h=await makeGameInWorld({seed:'guided-route',worldSeed:'road-world',worldEnabled:true});
 try {
  await h.game.newRun('A span traveller');
  const native=h.game.currentRun();
  h.game.atHand=await prepareWorldClockForPreciseSpan(native.run,native.cultivator);
  const world=h.game.atHand;
  if(!world)throw Error('Native counter world missing');
  const selected=world.locations.flatMap(from=>routesFrom(from.name).map(route=>({from,route})))
   .find(({route})=>worldLocationFor(world,route.toPlace)&&quotePassageAtACounter(route,
    {heads:1,worstPassengerOrdinal:ordinal,onDay:world.currentDay,cashPerWalkedDayReplaced:1}));
  if(!selected)throw Error('Actual opening world has no surveyed counter');
  h.repos.cultivators.update(native.cultivator.id,{realmOrdinal:ordinal,spiritStones:5000,
   location:selected.from.name,standingIn:null});
  const before=h.game.currentRun(),moment=routineTime(h.game.atHand!),quotedDay=h.game.theDayAPartyIsOn()!;
  const quoted=quotePassageAtACounter(selected.route,{heads:1,worstPassengerOrdinal:ordinal,onDay:quotedDay,cashPerWalkedDayReplaced:1});
  const result=await h.game.passage(before.run,before.cultivator,selected.route.toPlace, 'buy');
  expect(result.outcome).toBe('executed');
  const after=h.game.currentRun(),wait=quoted.openToday?0:Math.max(0,(quoted.nextDepartureDay??quotedDay)-quotedDay);
  const expected=wait+settlingDaysForPassenger(ordinal)+1/24;
  expect(after.run.elapsedDays-before.run.elapsedDays).toBeCloseTo(expected,9);
  expect(routineTime(h.game.atHand!)-moment).toBeCloseTo(expected,9);
  expect(after.cultivator.location).toBe(h.game.whereTheRoadEndsIn(selected.route.toPlace).name);
  expect(after.cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
  expect(quoted.daysSpent).toBeCloseTo(expected,9);
 } finally {h.db.close();}
},180000);
