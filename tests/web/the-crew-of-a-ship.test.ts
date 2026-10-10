import type {GameService} from '../../src/web/turn-engine.js';
import {shipPassengerAt} from '../../src/engine/world/passenger-on-a-vessel.js';
import {journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {passHours} from '../../src/web/routine-invitations.js';
/**
 * A ship's crew are people: a shipmaster and two or three hands, written the first time anybody
 * boards that ship on its lane, then kept.
 *
 * Before this, a ship stopped at sea on the passage from the river mouth left the passenger on a
 * deck with nobody on it, because the Pearl Ocean's own row holds one person in `road-world`. The
 * owner: the crew are real, "helps with gathering knowledge". So they are world rows that can be
 * talked to and remember, `sailor` and `shipmaster` by occupation, which is a life that has seen
 * the road. They go where the ship goes, and at sea the passenger stands on the shipmaster's deck,
 * three at most in view. And aboard, eating draws on the hull's rations before the pack
 * (`whereFoodComesFromHere`).
 *
 * Played on `road-world` with `sea-6`, the stop on day 6 of the passage from the river mouth.
 * Oct7 actual NPC08 regression69852: five controls stopped in setup because
 * startNpcPassage supplied only a pure itinerary and no accepted boarding
 * receipt. Current presence correctly rejects that tag/activity-only fiction.
 * This fixture now quotes and commits the real finite NPC passage through the
 * same authority as the independently passing fellow-passenger control, retaining
 * fare and every original crew/presence/death/food/port assertion. The sixth
 * defense control found no old Around-the-ship prose line; its original assertion
 * remains and an explicit native JSONL captures actual events before repair.
 * A remembered seed is not proof a human band attacked in today's native world.
 * Native diagnostic33651 proved NPC f359 and player f360 had the same actual
 * vessel, departure365000.3333333333 and arrival365008.3333333333. Diagnostic71371
 * then measured the area defect at365001.3333333333: the player and raw contact
 * read said foredeck, while accepted-hull presence placed the booked passenger,
 * captain and first hand on the afterdeck (three), and the second hand on the
 * stern. Every participant still belonged to that exact dated course. The actual
 * paid callback had selected an area from the general hourly place read instead
 * of the canonical same-hull presence read. Contact now asks that existing reader
 * with the fresh actual SQL observer; no NPC is moved and no presence is widened.
 * All five service/presence/conservation controls below keep their original
 * arrangements and assertions. Native paired verification is pending.
 * The separate defense seed actually produced a band withdrawal in native33651,
 * not the historical attack; that original attack assertion remains an explicit
 * unresolved attacking-occasion fixture and is excluded from this contact pair.
 * Contact03 paired27606: red1 genuine missing-presence failure; green presence, ports and hull-food controls passed, while both later return assertions stayed at sea. Observer95814 measured a real dead-cultivator occasion after7of8 return days: f366 remained the same hull, dep365008.3333333333, arrival365016.3333333333, clock365015.3333333333, healthy crew and one day left. The old assertions assumed uninterrupted travel. These two controls now explicitly continue that actual accepted remainder through native passHours, with no second fare, clock assignment, disabled event or invented port arrival. Original landfall/crew/death/conservation assertions are retained. A zero-progress interruption or genuine death/refusal/loss still fails rather than auto-resolving the world.
 */

import { describe, expect, it } from 'vitest';

import { whatSomebodyKnowsOfTheLand } from '../../src/engine/world/what-somebody-knows-of-the-land';
import { advanceWorldForPlay } from '../../src/engine/world/driver';
import { createNpc, markDead } from '../../src/engine/world/npc-state';
import { startNpcPassage } from '../../src/engine/world/places-on-the-way';
import { quotePublicPassage } from '../../src/engine/world/public-shipping';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew';
import { routineTime } from '../../src/engine/world/npc-routines';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world';
import { shipIdForLane } from '../../src/engine/world/the-ship-on-a-lane';
import { whatRunsFromHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage';
import { theVoyageUnderWay } from '../../src/web/a-ship-at-sea';
import { worldLocationFor } from '../../src/web/entities';
import { makeGameInWorld } from './harness';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';

const THE_CREW = /^npc-crew-/;


/** The caller explicitly continues the accepted return, not a second booking.
 * Remaining time comes from the actual dated course. Each native portion must
 * consume positive time; refusal, death, loss or a changed target fail honestly.
 * No encounter is disabled and no endpoint or clock is assigned by this helper. */
async function finishTheAcceptedReturn(game:GameService,expectedPort:string):Promise<void> {
    let now=game.currentRun();
    if(now.cultivator.location===expectedPort)return;
    const world=game.atHand!,claim=theVoyageUnderWay(game.db,now.cultivator);
    if(!claim?.receiptId)throw Error('The stopped return has no actual accepted receipt.');
    const receiptId=claim.receiptId,expected=worldLocationFor(world,expectedPort);
    if(!expected)throw Error('The actual return port is unavailable.');
    const purse=now.cultivator.spiritStones;
    let source=shipPassengerAt(world,receiptId,routineTime(world));
    if(!source)throw Error('The actual return course cannot be read.');
    const vesselId=source.vesselId;
    while(!source.arrived){
        expect(now.cultivator.alive,'Actual death cannot be completed into an arrival.').toBe(true);
        expect(now.run.status).toBe('active');
        expect(source.unavailable).toBeNull();
        expect(source.toId,'A real changed course is not the requested return.').toBe(expected.id);
        expect(Number.isFinite(source.remainingDays)&&source.remainingDays>0).toBe(true);
        const before=now,day=routineTime(world),remaining=source.remainingDays;
        const continued=await passHours(game,before.run,before.cultivator,remaining*24);
        now=game.currentRun();
        const after=shipPassengerAt(world,receiptId,routineTime(world));
        expect(continued.spent?.outcome,JSON.stringify(continued.spent?.calls)).not.toBe('refused');
        expect(now.cultivator.alive).toBe(true);
        expect(now.run.elapsedDays>before.run.elapsedDays,'No real progress: the interruption needs an actual player decision.').toBe(true);
        expect(routineTime(world)>day).toBe(true);
        expect(now.cultivator.spiritStones,'Continuing the same paid course charges no second fare.').toBe(purse);
        if(!after)throw Error('The actual accepted return disappeared before arrival.');
        expect(after.vesselId).toBe(vesselId);expect(after.toId).toBe(expected.id);
        source=after;
        const held=theVoyageUnderWay(game.db,now.cultivator);
        if(!source.arrived)expect(held?.receiptId).toBe(receiptId);
    }
    expect(journeyTimeHasReached(routineTime(world),source.arrivalDay)).toBe(true);
    expect(now.cultivator.location).toBe(expectedPort);
}

async function stoppedAtSea() {
    // This is the independently booked passenger from real-travellers-have-a-road,
    // not a seed which happens to interrupt. The player and passenger buy the same
    // finite berth; normal travel stops at their shared hull so the crew can be met.
    const harness = await makeGameInWorld({ seed: 'booth-0', worldSeed: 'road-world' });
    await harness.game.newRun('Rider');
    const id = harness.game.state().cultivator.id;
    harness.db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 500 WHERE id = ?").run(id);
    const initial = harness.game.currentRun();
    harness.game.atHand = await prepareWorldClockForPreciseSpan(initial.run, initial.cultivator);
    const world = harness.game.atHand!;
    const player = harness.game.state().cultivator;
    const line = whatRunsFromHere(harness.game, player, 0)
        .find(one => one.service === 'ship' && one.lane && one.runsFromDay === null)!;
    const from = worldLocationFor(world, 'Emerald Water City')!;
    const to = worldLocationFor(world, line.to)!;
    // At the landing already, so the player makes the same sailing the passenger booked: walking
    // across the city costs time (the owner's time rulings), and a ship does not wait.
    harness.repos.cultivators.standIn(id, theAreasOf(world, from).areas.find(area => area.for === 'landing')!.id);
    const run = harness.game.currentRun().run;
    const quote = quotePublicPassage(world, from.id, to.id, routineTime(world), 1, [],
        `${run.seed}:${Math.floor(run.elapsedDays)}`);
    expect(quote, 'The actual advertised hull has a native bookable passage').not.toBeNull();
    const fare = quote!.fareStones;
    const passenger = createNpc(world.seed, { id: 'booked-passenger', name: 'Fixture passenger',
        locationId: from.id, spiritStones: fare + 10, onDay: world.currentDay,
        bornOnDay: world.currentDay - 20 * 365 });
    const booked = startNpcPassage(world.locations, passenger, { lane: quote!.lane, destinationId: to.id,
        onDay: quote!.departureDay, days: quote!.days, fareStones: fare,
        purpose: 'Taking the ship to the island market.' })!;
    expect(booked.spiritStones).toBe(passenger.spiritStones - fare);
    world.npcs = [booked];
    expect(commitNpcPublicPassage(world, booked), 'A pure itinerary is not an actual boarding receipt').toBe(true);
    expect(world.history.facts.some(fact => fact.data.publicPassage === true
        && fact.data.vesselId === quote!.vesselId && fact.actors.some(actor => actor.id === booked.id))).toBe(true);
    harness.game.theWorldMoved();
    await harness.game.act(`I take the ship to ${line.to}`);
    const voyage = theVoyageUnderWay(harness.game.db, harness.game.state().cultivator)!;
    expect(voyage, 'the independently booked passenger stopped the shared passage at sea').toBeDefined();
    expect(harness.game.present(harness.game.state().cultivator).map(person => person.id)).toContain(booked.id);
    const crew = () => harness.game.atHand!.npcs.filter(npc => THE_CREW.test(npc.id));
    return { ...harness, id, crew, from, to, booked, voyage };
}

describe('the crew of a ship', () => {
    it('defend the ship themselves, by name, when a band attacks it', async () => {
        // The owner: the real named crew fights, not four unnamed guards. `east-64` is a band that
        // beats the crew on the Eastern Tideway early and turns the ship back.
        const { game, db } = await makeGameInWorld({ seed: 'east-64', worldSeed: 'road-world' });
        await game.newRun('Rider');
        const id = game.state().cultivator.id;
        db.prepare("UPDATE cultivators SET location = 'Sweet Spring Island', spirit_stones = 500 WHERE id = ?").run(id);
        db.prepare('UPDATE runs SET elapsed_days = 100 WHERE cultivator_id = ?').run(id);
        // The fixture's spring departure is a date in the shared world too.
        // Keep its real hulls and bookings, rather than resetting their season.
        advanceWorldForPlay(game.atHand!, { days: 100, stopOnInterrupt: false });
        game.theWorldMoved();

        const stopped = await game.act('I take the ship to Cloud Gate');

        const crew = game.atHand!.npcs.filter(npc => THE_CREW.test(npc.id));
        const fought = stopped.narration.split('\n').find(line => /^Around the ship, /.test(line)) ?? '';
        expect(crew.length, JSON.stringify({ calls: stopped.toolCalls, narration: stopped.narration,
            worldDay: game.atHand!.currentDay })).toBeGreaterThanOrEqual(3);
        for (const one of crew) expect(fought, one.name).toContain(one.name);
        expect(fought).not.toMatch(/\bguards?\b/);
    }, 120_000);

    it('who have died stay dead, and somebody new is taken on in their place', async () => {
        // Found writing this: the world forgets its mortal dead (`theWorldForgetsTheMortalDead`), and
        // a crew written under fixed ids wrote the forgotten hand again at the next boarding, which
        // the store refused as a resurrection and the turn threw. A replacement has an id of its own.
        const { game, crew, from } = await stoppedAtSea();
        await game.act('I wait until we arrive');
        // Arranged: a hand dies ashore. What is asserted is that nobody raises them.
        const lost = crew().find(npc => npc.identity.occupation === 'sailor')!;
        const at = game.atHand!.npcs.findIndex(npc => npc.id === lost.id);
        game.atHand!.npcs[at] = markDead(game.atHand!.npcs[at]!, Math.floor(game.atHand!.currentDay), 'Drowned in port.');
        game.theWorldMoved();
        const living = crew().filter(npc => npc.status === 'alive').length;

        await game.act(`I take the ship to ${from.name}`);
        await finishTheAcceptedReturn(game,from.name);

        expect(game.state().cultivator.location).toBe(from.name);
        expect(game.atHand!.npcs.filter(npc => npc.id === lost.id).every(npc => npc.status !== 'alive')).toBe(true);
        const aboard = crew().filter(npc => npc.status === 'alive');
        expect(aboard).toHaveLength(living + 1);
        expect(aboard.every(npc => npc.locationId === from.id)).toBe(true);
    }, 120_000);

    it('are a shipmaster and two or three hands, aboard with the passenger, three at most in view', async () => {
        const { game, crew, from, to, voyage } = await stoppedAtSea();

        const aboard = crew();
        expect(aboard.filter(npc => npc.identity.occupation === 'shipmaster')).toHaveLength(1);
        expect(aboard.length).toBeGreaterThanOrEqual(3);
        expect(aboard.length).toBeLessThanOrEqual(4);
        expect(aboard.every(npc => npc.cultivation.realmOrdinal <= 4 && npc.factionId === null)).toBe(true);
        expect(aboard.every(npc => npc.activity?.kind === 'travelling'
            && npc.activity.seaLaneId === voyage.lane.id
            && npc.activity.vesselId === shipIdForLane(voyage.lane)
            && npc.activity.fromLocationId === from.id
            && npc.activity.returnTo === to.id)).toBe(true);

        const seen = game.present(game.state().cultivator);
        expect(seen.length).toBeLessThanOrEqual(3);
        const master = aboard.find(npc => npc.identity.occupation === 'shipmaster')!;
        expect(seen.map(row => row.id)).toContain(master.id);
        expect((await game.act('look around')).narration).not.toMatch(/Nobody is about/);

        const asked = await game.act(`I ask ${master.name} how long until ${to.name}`);
        expect(asked.narration).toContain(master.name);
    }, 120_000);

    it('go where the ship goes, and are the same people on the next voyage of that lane', async () => {
        const { game, crew, from, to } = await stoppedAtSea();
        const first = crew().map(npc => npc.id).sort();
        expect(first.length).toBeGreaterThanOrEqual(3);

        await game.act('I wait until we arrive');
        expect(crew().every(npc => npc.locationId === to.id)).toBe(true);

        await game.act(`I take the ship to ${from.name}`);
        await finishTheAcceptedReturn(game,from.name);
        expect(game.state().cultivator.location).toBe(from.name);
        expect(crew().map(npc => npc.id).sort()).toEqual(first);
        expect(crew().every(npc => npc.locationId === from.id)).toBe(true);
    }, 120_000);

    it('know the ports of the water they work', async () => {
        const { game, crew } = await stoppedAtSea();
        const master = crew().find(npc => npc.identity.occupation === 'shipmaster')!;

        const known = whatSomebodyKnowsOfTheLand(game.atHand!, {
            id: master.id, from: 'Sweet Spring Island', ordinal: master.cultivation.realmOrdinal, travelled: 2
        });

        for (const port of ['Silver Island', 'Bronze Gong Cliff', 'Emerald Water City']) {
            expect(known.places.find(place => place.name === port)?.stage, port).toBe('placed');
        }
    }, 120_000);

    it('feed the passenger from the hull when they eat aboard, at no charge', async () => {
        const { game, db, id } = await stoppedAtSea();
        db.prepare('UPDATE cultivators SET satiety = 60 WHERE id = ?').run(id);
        const stones = game.state().cultivator.spiritStones;
        const before = /The hull's rations cover (\d+) more days?/.exec((await game.act('status')).narration)![1];

        const ate = await game.act('I eat');

        expect(ate.narration).toMatch(/You eat from the ship's rations/);
        expect(game.state().cultivator.satiety).toBeGreaterThan(60);
        expect(game.state().cultivator.spiritStones).toBe(stones);
        const after = /The hull's rations cover (\d+) more days?/.exec((await game.act('status')).narration)?.[1] ?? '0';
        expect(Number(after)).toBeLessThan(Number(before));
    }, 120_000);
});
