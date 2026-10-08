/**
 * Owner request, 2026-10-07: asking "how do I get to X" should give approximate
 * walking days and real available carriage/paid folding options. Source audit:
 * theWayTo reads catalog walking roads but never asks existing service quotes.
 * These controls select an actual present NPC's placed land knowledge, an
 * unfamiliar destination, and genuine local service quotes. Only the player's
 * scene is arranged; no person, knowledge, counter, fare or outcome is invented.
 * The scripted model supplies intent/prose only. Assertions inspect native
 * narrator facts, actual learned directions, and unchanged purse/location,
 * not scripted prose. Service existence is not universal NPC knowledge: this
 * documents the missing connection between informed directions and local public
 * offerings, not permission to disclose hidden or remote private services.
 * Successor02 corrects the scripted topic to the existing canonical the-way-to
 * topic; the player still types the full how-do-I-get-to question. It adds actual
 * named-only and genuinely unoffered controls. No personal fix is required for
 * a paid span passenger; surveyed route, city counter and native quote govern.
 * Root native directions02 run66433: carriage reached actual Willow Village
 * walk1/ride1/fare3 and failed missing carriage facts; name-only/unoffered passed.
 * Fold fixture failed selection, not service behavior. Successor03 chooses any
 * actual surveyed counter (including sites), an actual local untravelled NPC,
 * and a published destination without demanding old walking-map knowledge.
 * Locals know public hubs as common knowledge even if never passengers; name-only
 * negative now requires no actual locally advertised route to that destination.
 * This package is uncompiled/unrun and test-only; root must establish a
 * meaningful red and review service-information authority before implementing.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, refusedCall } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { whatThisPersonKnowsOfTheLand } from '../../src/web/the-way-to-somewhere-asked-of-somebody.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whatRunsFromHere, stonesFor } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { quotePublicCarriage } from '../../src/engine/world/public-carriages.js';
import { howMuchOfTheRoadALifeHasSeen } from '../../src/engine/world/what-somebody-knows-of-the-land.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { boardAt, quotePassageAtACounter } from '../../src/engine/world/buying-passage-at-a-measured-span-counter.js';
import { SPAN_ROUTES, SPAN_CASH_PER_WALKED_DAY, counterPlaceNameAt } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { localPrice } from '../../src/data/cultivation/regions.js';
import { standingOf } from '../../src/server/consolidated/where-a-cultivator-is-standing.js';
import { humanDays } from '../../src/engine/encounters/how-a-task-is-worded.js';

/** Reusable native scene: actual present informed speaker plus actual service. */
export async function aNativeDirectionsScene(mode: 'carriage' | 'fold' | 'name-only' | 'unoffered') {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The actual directions are answered.'] });
    const h = await makeGameInWorld({ seed: 'remembered-route', worldSeed: 'road-world', worldEnabled: true,
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 }) });
    await h.game.newRun('An actual travel-options asker');
    const initial = h.game.currentRun();
    h.game.atHand = await prepareWorldClockForPreciseSpan(initial.run, initial.cultivator);
    const world = h.game.atHand;
    if (!world) { h.db.close(); throw new Error('Directions fixture has no actual world.'); }
    for (const venue of world.locations.filter(row => mode === 'fold' ? counterPlaceNameAt(row.name) !== null : row.kind === 'settlement')) {
        const areas = theAreasOf(world, venue);
        for (const area of areas.areas.filter(row => row.for !== 'room')) {
            if (![...areas.whereIs.values()].includes(area.id)) continue;
            h.repos.cultivators.update(initial.cultivator.id, { location: venue.name, standingIn: area.id });
            const body = h.game.currentRun().cultivator;
            const speaker = h.game.somebodyAtHand('somebody', body);
            if (!speaker || !world.npcs.some(person => person.id === speaker.id && person.status === 'alive')) continue;
            const actualSpeaker = world.npcs.find(row => row.id === speaker.id)!;
            if (mode === 'fold' && (actualSpeaker.locationId !== venue.id
                || howMuchOfTheRoadALifeHasSeen(actualSpeaker.identity.occupation) !== 0)) continue;
            const land = whatThisPersonKnowsOfTheLand(h.game, body.id, world, speaker);
            const lines = whatRunsFromHere(h.game, body, Math.floor(routineTime(world)));
            const counter = counterPlaceNameAt(venue.name);
            const rate = localPrice(standingOf(body, world).regionId, SPAN_CASH_PER_WALKED_DAY);
            const board = counter ? boardAt(counter, SPAN_ROUTES, rate, Math.floor(h.game.currentRun().run.elapsedDays)) : null;
            for (const destination of world.locations.filter(row => (mode === 'fold' || row.kind === 'settlement') && row.id !== venue.id)) {
                if ((mode !== 'fold' && !land.places.some(row => row.name === destination.name && row.stage === (mode === 'name-only' ? 'named' : 'placed')))
                    || h.game.knowledge.isAwareOf(body.id, 'place', destination.id)
                    || h.game.knowledge.isAwareOf(body.id, 'place', destination.name)) continue;
                const walked = h.game.daysOnTheRoadTo(body, destination.name);
                if (walked === null || walked <= 0) continue;
                const carriage = lines.find(row => row.service === 'carriage' && row.to === destination.name);
                const carriageQuote = carriage ? quotePublicCarriage(world, {
                    fromId: venue.id, toId: destination.id, day: routineTime(world),
                    conveyanceId: 'conv-carriage-mortal', passengerIds: [body.id],
                    fareStones: stonesFor(carriage.cashPerSeat), hired: false,
                    playedPassenger: { id: body.id, locationId: venue.id, alive: body.alive }
                }) : null;
                const span = board?.lines.find(row => row.toPlace === destination.name);
                const route = span ? SPAN_ROUTES.find(row => row.id === span.routeId) : undefined;
                const foldQuote = route ? quotePassageAtACounter(route, {
                    heads: 1, worstPassengerOrdinal: body.realmOrdinal, cashPerWalkedDayReplaced: rate,
                    onDay: Math.floor(h.game.currentRun().run.elapsedDays)
                }) : null;
                if (mode === 'carriage' && (!carriageQuote || !carriage)) continue;
                if (mode === 'fold' && (!foldQuote || !counter)) continue;
                if ((mode === 'unoffered' || mode === 'name-only') && (lines.some(row => row.to === destination.name) || span)) continue;
                console.log(JSON.stringify({ directionsFixture: mode, venue: venue.name, speaker: speaker.id,
                    occupation: actualSpeaker.identity.occupation, target: destination.name,
                    priorLandStage: land.places.find(row => row.name === destination.name)?.stage ?? null,
                    counter, carriageQuote, foldQuote }));
                expect(h.game.present(body).some(row => row.id === speaker.id)).toBe(true);
                expect(h.game.canPointAtLocation(body, destination)).toBe(false);
                return { ...h, plans, provider, world, speaker, destination, walked, carriage, carriageQuote, counter, foldQuote };
            }
        }
    }
    h.db.close(); throw new Error('No actual informed scene supplies an unfamiliar ' + mode + ' option.');
}

for (const mode of ['carriage', 'fold'] as const) {
    it('an informed NPC answers an unfamiliar route with its real ' + mode + ' option and walking duration', async () => {
        const h = await aNativeDirectionsScene(mode);
        try {
            const before = h.game.currentRun();
            expect(h.game.knowledge.isAwareOf(before.cultivator.id, 'place', h.destination.id)).toBe(false);
            expect(h.game.knowledge.isAwareOf(before.cultivator.id, 'place', h.destination.name)).toBe(false);
            const history = h.world.history.facts.filter(row => row.data.publicPassage === true).map(row => row.id);
            h.plans.push(JSON.stringify({ action: 'interact', target: 'somebody', intent: 'ask',
                topic: 'the way to ' + h.destination.name }));
            const answered = await h.game.act('I ask somebody how do I get to ' + h.destination.name + '.');
            console.log(JSON.stringify({ mode, speaker: h.speaker.id, destination: h.destination.name,
                walked: h.walked, carriageQuote: h.carriageQuote, foldQuote: h.foldQuote, calls: answered.toolCalls }));
            expect(refusedCall(answered)).toBeNull();
            expect(answered.toolCalls.some(row => row.name === 'engine.theWayTo' && row.ok)).toBe(true);
            const narrated = [...h.provider.calls].reverse().find(call =>
                !call.messages.some(message => message.role === 'system' && message.content.startsWith('You are the intent router')));
            if (!narrated) throw new Error('Directions never reached native narrator input.');
            const input = narrated.messages.map(message => message.content).join('\n');
            const marker = 'WHAT THE ENGINE RULED.';
            const facts = input.slice(input.indexOf(marker)).split('\n\n')[0]!;
            expect(input).toContain(marker);
            expect(facts).toContain(h.destination.name);
            expect(facts).toContain(humanDays(h.walked));
            if (mode === 'carriage') {
                if (!h.carriage || !h.carriageQuote) throw new Error('Selected actual carriage quote vanished.');
                expect(facts).toMatch(/carriage/i);
                expect(facts).toContain(humanDays(h.carriage.days));
                expect(facts).toContain(String(h.carriageQuote.fareStones));
            } else {
                if (!h.foldQuote || !h.counter) throw new Error('Selected actual folding quote vanished.');
                expect(facts).toMatch(/fold|span|teleport/i);
                expect(facts).toContain(h.counter);
                expect(facts).toContain(String(h.foldQuote.fareCash));
                if (!h.foldQuote.openToday) expect(facts).toContain(String(h.foldQuote.nextDepartureDay));
                expect(facts).toContain(humanDays(h.foldQuote.settlingDays));
            }
            const after = h.game.currentRun();
            expect(after.cultivator.location).toBe(before.cultivator.location);
            expect(after.cultivator.standingIn).toBe(before.cultivator.standingIn);
            expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            expect(h.game.atHand!.history.facts.filter(row => row.data.publicPassage === true).map(row => row.id)).toEqual(history);
            expect(h.game.canPointAtLocation(after.cultivator, h.destination)).toBe(true);
            expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', h.destination.id)
                .some(row => row.sourceKind === 'told' && row.sourceNote.includes(h.speaker.name))).toBe(true);
        } finally { h.db.close(); }
    }, 120_000);
}

for (const mode of ['name-only', 'unoffered'] as const) {
    it('directions preserve an actual ' + mode + ' boundary without inventing service or route knowledge', async () => {
        const h = await aNativeDirectionsScene(mode);
        try {
            const before = h.game.currentRun();
            const prior = h.game.knowledge.provenanceOf(before.cultivator.id, 'place', h.destination.id);
            h.plans.push(JSON.stringify({ action: 'interact', target: 'somebody', intent: 'ask',
                topic: 'the way to ' + h.destination.name }));
            const answered = await h.game.act('I ask somebody how do I get to ' + h.destination.name + '.');
            expect(refusedCall(answered)).toBeNull();
            expect(answered.toolCalls.some(row => row.name === 'engine.theWayTo' && row.ok)).toBe(true);
            const call = [...h.provider.calls].reverse().find(row =>
                !row.messages.some(message => message.role === 'system' && message.content.startsWith('You are the intent router')));
            if (!call) throw new Error('Actual boundary answer never reached narration.');
            const input = call.messages.map(row => row.content).join('\n');
            const marker = 'WHAT THE ENGINE RULED.';
            expect(input).toContain(marker);
            const facts = input.slice(input.indexOf(marker)).split('\n\n')[0]!;
            expect(facts).toContain(h.destination.name);
            expect(facts).not.toMatch(/(?:carriage|fold|teleport).*(?:fare|cash|stones)/i);
            const after = h.game.currentRun();
            expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            expect(after.cultivator.location).toBe(before.cultivator.location);
            if (mode === 'name-only') {
                expect(facts).toMatch(/do not know the road/i);
                expect(h.game.canPointAtLocation(after.cultivator, h.destination)).toBe(false);
                expect(h.game.knowledge.provenanceOf(before.cultivator.id, 'place', h.destination.id)).toEqual(prior);
            } else {
                expect(h.game.canPointAtLocation(after.cultivator, h.destination)).toBe(true);
                expect(facts).toContain(humanDays(h.walked));
            }
        } finally { h.db.close(); }
    }, 120_000);
}
