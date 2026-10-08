/** Operator area/name arrangement; all placement and access answers remain native. */
import { expect } from 'vitest';
import type { GameService } from '../../../src/web/turn-engine.js';
import { peopleInThisPlace } from '../../../src/web/hearsay.js';
import { worldLocationFor } from '../../../src/web/entities.js';
import { isWater } from '../../../src/engine/world/places-on-the-way.js';
import { crossToWhoeverTheyNamed } from '../../../src/web/walking-across-a-place.js';

export function listenerAcrossAnActualPublicArea(game: GameService, listenerId: string, substrate: 'deck' | 'roadside') {
    const now = game.currentRun(), world = game.atHand!;
    const place = worldLocationFor(world, now.cultivator.location)!;
    const read = peopleInThisPlace(game.repos, now.cultivator, world, place);
    const listener = read.people.find(person => person.id === listenerId);
    expect(listener, 'the actual accepted carrier actor is physically in this place').toBeDefined();
    const theirs = read.whereIs.get(listenerId);
    expect(theirs).toBeDefined();
    const expected = substrate === 'deck' ? 'deck' : 'here';
    expect(isWater(place), 'the actual accepted carrier must be on its asserted substrate').toBe(substrate === 'deck');
    expect(read.areas.find(area => area.id === theirs)?.for,
        'the listener occupies a native deck, or an explicitly roadside area; no street is a cabin').toBe(expected);
    const outside = read.areas.find(area => area.id !== theirs && area.for === expected);
    expect(outside, 'the native layout must contain another area on this actual substrate; no cabin is invented').toBeDefined();
    game.repos.cultivators.standIn(now.cultivator.id, outside!.id);
    game.noteEncounter(game.currentRun().cultivator, now.run,
        { kind: 'cultivator', id: listenerId, name: listener!.name }, 'told',
        'Operator arrangement: the actual listener has previously given this name.');
    const body = game.currentRun().cultivator;
    expect(game.present(body).some(person => person.id === listenerId)).toBe(false);
    expect(game.present({ ...body, standingIn: theirs! }).some(person => person.id === listenerId)).toBe(true);
    expect(crossToWhoeverTheyNamed(game, body, listener!.name, false), 'native access admits the actual named crossing').not.toBeNull();
    return { id: listenerId, name: listener!.name, before: game.currentRun(), place, substrate };
}
export async function askThatActualListener(game: GameService, plans: string[], name: string) {
    plans.push(JSON.stringify({ action: 'interact', target: name, intent: 'talk', topic: 'hello' }));
    const turn = await game.act(`I greet ${name}.`);
    expect(turn.toolCalls.some(call => call.name === 'narrator.plan' && call.source === 'model'),
        JSON.stringify(turn.toolCalls)).toBe(true);
    return turn;
}

/** Engine answer receipt, independent of narrator prose or an approach's success. */
export function actualListenerAnswered(turn: Awaited<ReturnType<GameService['act']>>, name: string): boolean {
    return turn.toolCalls.some(call => call.name === 'engine.askedAbout' && call.ok
        && call.summary.startsWith('Asked ' + name + ' about "hello"'));
}

/** Matched driver/pilot follows the actual observer; no separate cabin is asserted. */
export function listenerInTheActualCarrierScene(game: GameService, listenerId: string, substrate: 'deck' | 'roadside') {
    const before = game.currentRun(), world = game.atHand!;
    const place = worldLocationFor(world, before.cultivator.location)!;
    const listener = game.present(before.cultivator).find(person => person.id === listenerId);
    expect(listener, 'the actual accepted actor is already physically beside the passenger').toBeDefined();
    expect(isWater(place)).toBe(substrate === 'deck');
    const read = peopleInThisPlace(game.repos, before.cultivator, world, place);
    expect(read.areas.find(area => area.id === read.whereIs.get(listenerId))?.for).toBe(substrate === 'deck' ? 'deck' : 'here');
    game.noteEncounter(before.cultivator, before.run,
        { kind: 'cultivator', id: listenerId, name: listener!.name }, 'told',
        'Operator arrangement: this co-located actor previously gave this name.');
    return { id: listenerId, name: listener!.name, before, place, substrate };
}
