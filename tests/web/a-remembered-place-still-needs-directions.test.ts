/**
 * Owner clarification 2026-10-06: replay memory permits asking about an actual
 * name, but it does not give this character the route needed to travel there.
 * somewhereReal accepted every world row and formerly bypassed canPointAt.
 * These played controls select real present speakers and their existing land
 * knowledge, not a replacement route roster or a fabricated reply. The informed
 * speaker's actual placed directions teach the destination through theWayTo;
 * a speaker who merely knows a name cannot teach its road. Local facilities
 * retain their earlier physical routing; ordinary journeys retain interruption.
 * Root route01 run36074: both new cases failed fixture selection before any
 * route behavior; requiring both modes in one opening square was incorrect.
 * This successor arranges only the player at existing physical settlement
 * areas per mode and explicitly requires target unaware under id and name.
 * Intent/prose is scripted, never an outcome. This is native proof, not live
 * model acceptance. Unknown-route rejection must leave body/time/route unchanged.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, refusedCall } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { whatThisPersonKnowsOfTheLand } from '../../src/web/the-way-to-somewhere-asked-of-somebody.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { A_SPIRIT_BOAT_ANSWERS_TO, aVehicleOf } from '../../src/engine/world/a-vehicle.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';

async function fixture(mode: 'placed' | 'named') {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The actual reply is given.'] });
    const h = await makeGameInWorld({ seed: 'remembered-route', worldSeed: 'road-world', worldEnabled: true,
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 }) });
    await h.game.newRun('An actual route asker');
    const opened = h.game.currentRun().cultivator;
    const world = await h.game.loadWorld();
    if (!world) throw new Error('The actual directions scene has no world.');
    // Explicit scene arrangement: move only the operator player to the actual
    // public area of an existing person. No NPC, occupation, knowledge or clock
    // is invented. Each test needs only its own speaker-knowledge mode.
    for (const venue of world.locations.filter(row => row.kind === 'settlement')) {
        const reading = theAreasOf(world, venue);
        for (const area of reading.areas.filter(row => row.for !== 'room')) {
            if (![...reading.whereIs.values()].includes(area.id)) continue;
            h.repos.cultivators.update(opened.id, { location: venue.name, standingIn: area.id });
            const visitor = h.game.currentRun().cultivator;
            const speaker = h.game.somebodyAtHand('somebody', visitor);
            if (!speaker || !world.npcs.some(person => person.id === speaker.id && person.status === 'alive')) continue;
            const land = whatThisPersonKnowsOfTheLand(h.game, visitor.id, world, speaker);
            const place = world.locations.find(row => row.kind === 'settlement' && row.id !== venue.id
                && land.places.some(known => known.name === row.name && known.stage === mode)
                && !h.game.knowledge.isAwareOf(visitor.id, 'place', row.id)
                && !h.game.knowledge.isAwareOf(visitor.id, 'place', row.name));
            if (!place) continue;
            expect(h.game.present(visitor).some(person => person.id === speaker.id)).toBe(true);
            expect(h.game.canPointAtLocation(visitor, place)).toBe(false);
            expect(h.game.knowledge.isAwareOf(visitor.id, 'place', place.id)).toBe(false);
            expect(h.game.knowledge.isAwareOf(visitor.id, 'place', place.name)).toBe(false);
            return { ...h, plans, choice: { speaker, place } };
        }
    }
    h.db.close();
    throw new Error('No existing physical settlement scene supplies an unfamiliar ' + mode + ' route control.');
}

it('a remembered real name is a question, and actual placed directions are what allow its journey', async () => {
    const h = await fixture('placed');
    try {
        const { speaker, place } = h.choice;
        const before = h.game.currentRun();
        const world = await h.game.loadWorld();
        if (!world) throw new Error('The real route scene lost its world.');
        const worldMoment = routineTime(world);
        const targetKnowledge = h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id);
        h.plans.push(JSON.stringify({ action: 'move', target: place.name }));
        const refused = await h.game.act(`I travel to ${place.name}.`);
        expect(refusedCall(refused)?.name).toBe('knowledge.canPointAt');
        expect(h.game.currentRun().cultivator).toEqual(before.cultivator);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(routineTime(h.game.atHand!)).toBe(worldMoment);
        expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id)).toEqual(targetKnowledge);
        expect(h.game.canPointAtLocation(before.cultivator, place)).toBe(false);
        h.plans.push(JSON.stringify({ action: 'interact', target: 'somebody', topic: `the way to ${place.name}`, intent: 'ask' }));
        const told = await h.game.act(`I ask somebody how to get to ${place.name}.`);
        expect(refusedCall(told)).toBeNull();
        expect(told.toolCalls.some(call => call.name === 'engine.theWayTo' && call.ok)).toBe(true);
        expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id)
            .some(row => row.sourceKind === 'told' && row.sourceNote.includes(speaker.name))).toBe(true);
        expect(h.game.canPointAtLocation(h.game.currentRun().cultivator, place)).toBe(true);
        const atDeparture = h.game.currentRun();
        h.plans.push(JSON.stringify({ action: 'move', target: place.name }));
        const travelled = await h.game.act(`I travel to ${place.name}.`);
        expect(travelled.toolCalls.some(call => call.name === 'knowledge.canPointAt' && !call.ok)).toBe(false);
        // Real world interruptions remain authoritative; knowing a route does
        // not promise arrival, but the native journey now accepts the attempt.
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(atDeparture.run.elapsedDays);
    } finally { h.db.close(); }
});

it('a present speaker who only knows the name does not grant its route', async () => {
    const h = await fixture('named');
    try {
        const { place } = h.choice;
        const before = h.game.currentRun();
        const rows = h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id);
        h.plans.push(JSON.stringify({ action: 'interact', target: 'somebody', topic: `the way to ${place.name}`, intent: 'ask' }));
        const answered = await h.game.act(`I ask somebody how to get to ${place.name}.`);
        expect(refusedCall(answered)).toBeNull();
        expect(answered.toolCalls.some(call => call.name === 'engine.theWayTo' && call.summary.includes('named'))).toBe(true);
        expect(h.game.canPointAtLocation(h.game.currentRun().cultivator, place)).toBe(false);
        expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id)).toEqual(rows);
        expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
    } finally { h.db.close(); }
});


it('an actual pilot and owned flying boat still require the unfamiliar destination route', async () => {
    const h = await fixture('placed');
    try {
        const { place } = h.choice;
        const entry = h.game.currentRun();
        h.repos.cultivators.update(entry.cultivator.id, { realmOrdinal: A_SPIRIT_BOAT_ANSWERS_TO, spiritStones: 500 });
        const before = h.game.currentRun();
        const here = h.game.worldPlaceOf(before.cultivator);
        if (!here || !h.game.atHand) throw new Error('The actual flying fixture lost its ground.');
        const boat = aVehicleOf({ id: 'route-control-owned-boat', conveyanceId: 'conv-spirit-boat',
            ownerId: before.cultivator.id, ownerName: before.cultivator.name, at: here });
        h.game.atHand.objects.push(boat);
        h.game.theWorldMoved();
        expect(h.game.whatTheyCouldRide(before.cultivator).some(row => row.conveyance.id === 'conv-spirit-boat')).toBe(true);
        const knowledge = h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id);
        const moment = routineTime(h.game.atHand);
        h.plans.push(JSON.stringify({ action: 'ride', target: place.name, topic: 'spirit boat' }));
        const answer = await h.game.act('I fly my spirit boat to ' + place.name + '.');
        expect(refusedCall(answer)?.name).toBe('knowledge.canPointAt');
        expect(h.game.currentRun().cultivator).toEqual(before.cultivator);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(routineTime(h.game.atHand!)).toBe(moment);
        expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', place.id)).toEqual(knowledge);
        expect(h.game.atHand!.objects.find(row => row.id === boat.id)).toEqual(boat);
    } finally { h.db.close(); }
});
