import { finishTheAcceptedVoyage } from './finishing-an-accepted-voyage.js';
/**
 * A ship's crew are real people kept from one voyage to the next. Before this
 * was wired, a passenger stopped on an empty deck. Crew now have ordinary bodies,
 * names, port knowledge and work; three people at most share a visible area.
 * Hull food is used before the passenger's pack.
 *
 * Earlier fixtures supplied a pure NPC itinerary without actual boarding. They
 * now commit the finite shared passage. The contact audit also found the player
 * on the foredeck while their accepted fellow passenger and crew were on the
 * afterdeck; contact now uses the canonical same-hull presence reader.
 *
 * Oct11 diagnostics found that the historical attacking seed actually withdrew.
 * The shared-hull return below has a real attack instead. On its ordinary return
 * at day 365012.5833333333, the captain and a hand died defending the ship and the
 * mortal-dead sweep removed them. Crew continuity means the survivors continue;
 * it cannot require those people to return alive. Each missing original must be
 * named as fallen in that turn's actual fight facts. The replacement control
 * still requires a new hire and keeps its arranged dead hand dead.
 * The continuity controls follow the captain's actual course, including a
 * turnback. The defense control uses the measured attacking return. A held fight
 * cannot be skipped, and a requested port cannot replace the actual destination.
 *
 * Interrupted voyages continue their actual accepted remainder through passHours.
 * No second fare, disabled encounter, assigned endpoint or forced outcome is used.
 */

import { describe, expect, it } from 'vitest';

import { whatSomebodyKnowsOfTheLand } from '../../src/engine/world/what-somebody-knows-of-the-land';
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

function namedAsFallen(said: string, people: readonly { id: string; name: string }[]) {
    const groups = [...said.matchAll(/of the crew (.*?) fell/g)].map(match => match[1]!);
    return people.filter(person => groups.some(group => group.includes(person.name)));
}


async function stoppedAtSea(seed = 'booth-1') {
    // This is the independently booked passenger from real-travellers-have-a-road,
    // not a seed which happens to interrupt. The player and passenger buy the same
    // finite berth; normal travel stops at their shared hull so the crew can be met.
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world' });
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
        const { game, crew, from, to } = await stoppedAtSea('booth-0');
        await game.act('I wait until we arrive');
        expect(game.currentRun().cultivator.location).toBe(to.name);
        const people = crew().filter(person => person.status === 'alive');
        const stopped = await game.act(`I take the ship to ${from.name}`);
        const fought = stopped.narration.split('\n')
            .filter(line => /^Around the ship, | fights beside you /.test(line)).join('\n');
        expect(fought, stopped.narration).toMatch(/Around the ship, /);
        expect(people.length, JSON.stringify({ calls: stopped.toolCalls, narration: stopped.narration,
            worldDay: game.atHand!.currentDay })).toBeGreaterThanOrEqual(3);
        for (const one of people) expect(fought, stopped.narration).toContain(one.name);
        expect(fought).not.toMatch(/\bguards?\b/);
    }, 120_000);

    it('who have died stay dead, and somebody new is taken on in their place', async () => {
        // Found writing this: the world forgets its mortal dead (`theWorldForgetsTheMortalDead`), and
        // a crew written under fixed ids wrote the forgotten hand again at the next boarding, which
        // the store refused as a resurrection and the turn threw. A replacement has an id of its own.
        const { game, crew, from, to } = await stoppedAtSea();
        await game.act('I wait until we arrive');
        await finishTheAcceptedVoyage(game,to.name,true);
        // Arranged: a hand dies ashore. What is asserted is that nobody raises them.
        const lost = crew().find(npc => npc.identity.occupation === 'sailor')!;
        const at = game.atHand!.npcs.findIndex(npc => npc.id === lost.id);
        game.atHand!.npcs[at] = markDead(game.atHand!.npcs[at]!, Math.floor(game.atHand!.currentDay), 'Drowned in port.');
        game.theWorldMoved();
        const living = crew().filter(npc => npc.status === 'alive').length;
        const original = crew().filter(npc => npc.status === 'alive').map(npc => ({ id: npc.id, name: npc.name }));

        const nextPort=game.state().cultivator.location===to.name?from:to;
        const returned = await game.act(`I take the ship to ${nextPort.name}`);
        const continued = await finishTheAcceptedVoyage(game,nextPort.name,true);

        const actualPort=worldLocationFor(game.atHand!,game.state().cultivator.location)!;
        expect(actualPort).toBeDefined();
        expect(game.atHand!.npcs.filter(npc => npc.id === lost.id).every(npc => npc.status !== 'alive')).toBe(true);
        const aboard = crew().filter(npc => npc.status === 'alive');
        const fallen = namedAsFallen([returned.narration, ...continued].join('\n'), original);
        expect(aboard, returned.narration).toHaveLength(living + 1 - fallen.length);
        const replacements = aboard.filter(npc => !original.some(person => person.id === npc.id));
        expect(replacements, 'the dead hand must be replaced by a different person').toHaveLength(1);
        for (const person of original.filter(one => !fallen.some(dead => dead.id === one.id))) {
            expect(aboard.map(npc => npc.id), 'an original disappeared without a named death').toContain(person.id);
        }
        expect(aboard.every(npc => npc.locationId === actualPort.id),returned.narration).toBe(true);
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
        const first = crew().map(npc => ({ id: npc.id, name: npc.name }));
        expect(first.length).toBeGreaterThanOrEqual(3);

        await game.act('I wait until we arrive');
        await finishTheAcceptedVoyage(game,to.name,true);
        const firstPort=worldLocationFor(game.atHand!,game.state().cultivator.location)!;
        expect(crew().every(npc => npc.locationId === firstPort.id)).toBe(true);

        const nextPort=firstPort.id===to.id?from:to;
        const returned = await game.act(`I take the ship to ${nextPort.name}`);
        const continued = await finishTheAcceptedVoyage(game,nextPort.name,true);
        const actualPort=worldLocationFor(game.atHand!,game.state().cultivator.location)!;
        const fallen = namedAsFallen([returned.narration, ...continued].join('\n'), first);
        expect(crew().filter(npc => npc.status === 'alive').map(npc => npc.id).sort(), returned.narration)
            .toEqual(first.filter(person => !fallen.some(dead => dead.id === person.id)).map(person => person.id).sort());
        expect(crew().every(npc => npc.locationId === actualPort.id),returned.narration).toBe(true);
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
