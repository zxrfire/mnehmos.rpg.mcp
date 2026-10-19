/**
 * At year 400, repeated chronicle reads cost 1.15 seconds per year on the full
 * catalog. Sparse readings now follow appended rows and the mortal-dead sweep.
 * This compares them with the ledger itself, including a recurrence that gains
 * a witness; a copied or pruned world must give the same answers as a fresh read.
 * At walked age 1000, two dated knowledge views rebuilt the same 121,048-fact
 * ledger, costing about 1.3 sampled seconds per steady year. The index now
 * belongs to that ledger. Clock views must follow its appends and pruning;
 * a genuinely copied history must continue to own independent facts.
 */
import { expect, it } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { makeFact, reserveFactSlot } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { factsAddedSince, factsInSpan, factsWithData, factsWithDataValue, pendingAuctionLots, witnessIndexFor, witnessHistoryWasPruned } from '../../../src/engine/world/witness-reaction-index.js';
import { cloneWorld, createWorld, theWorldForgetsTheMortalDead, type WorldState } from '../../../src/engine/world/world-state.js';
import { whatStandingOnItGives, whatAHousesOwnErrandsBringBack } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { reactToWitnessedFact, observationOf } from '../../../src/engine/world/witness-reactions.js';

it('clock views follow one ledger through appends and pruning while a clone stays independent', () => {
    const state = createWorld({ seed: 'dated-ledger-views', skipPriorAges: true, regionCount: 0 });
    const view = { ...state, currentDay: state.currentDay + 12, currentHour: 6 };
    const put = (world: WorldState, marker: string) => appendWorldFact(world, makeFact({
        day: world.currentDay, kind: 'said_in_public', summary: marker, data: { marker }
    }), { recur: false, bystanders: false });
    const first = put(state, 'first');
    expect(factsWithData(view, 'marker').map(row => row.id)).toEqual([first.id]);
    const second = put(view, 'second');
    expect(factsWithData(state, 'marker').map(row => row.id)).toEqual([first.id, second.id]);
    const previous = state.history.facts;
    state.history.facts = previous.filter(row => row.id !== first.id);
    witnessHistoryWasPruned(state, previous, new Set([first.id]), new Map());
    expect(factsWithData(view, 'marker').map(row => row.id)).toEqual([second.id]);
    const copy = cloneWorld(state);
    const isolated = put(copy, 'isolated');
    expect(factsWithDataValue(copy, 'marker', 'isolated').map(row => row.id)).toEqual([isolated.id]);
    expect(factsWithDataValue(view, 'marker', 'isolated')).toEqual([]);
    agrees(state); agrees(view); agrees(copy);
});

function agrees(state: WorldState): void {
    const index = witnessIndexFor(state);
    const stood = whatStandingOnItGives(state.history.facts, index.byPlace, index.stoodOn);
    const reported = whatAHousesOwnErrandsBringBack(state.history.facts, index.byPlace, index.reportedGround);
    const readStood = whatStandingOnItGives(state.history.facts);
    const readReported = whatAHousesOwnErrandsBringBack(state.history.facts);
    for (const place of state.locations) {
        for (const person of state.npcs) expect(stood(person.id, place.id)).toBe(readStood(person.id, place.id));
        for (const house of state.factions) expect(reported(house.id, place.id)).toBe(readReported(house.id, place.id));
    }
    expect([...index.byId.values()].map(f => f.id).sort()).toEqual(state.history.facts.map(f => f.id).sort());
    expect(factsWithData(state, 'daoAdmission').map(f => f.id)).toEqual(state.history.facts
        .filter(f => f.data.daoAdmission !== undefined).map(f => f.id));
    expect(factsInSpan(state, state.currentDay - 365, state.currentDay).map(f => f.id)).toEqual(state.history.facts
        .filter(f => f.day >= state.currentDay - 365 && f.day <= state.currentDay).map(f => f.id));
    for (const person of state.npcs) expect([...index.presentAt.get(person.id) ?? []].sort()).toEqual(state.history.facts
        .filter(f => f.witnessIds.includes(person.id) || f.actors.some(a => a.id === person.id)).map(f => f.id).sort());
    for (const [id, facts] of index.factsByPerson) expect(facts.map(fact => fact.id)).toEqual(state.history.facts
        .filter(fact => fact.actors.some(actor => actor.id === id)).map(fact => fact.id));
    for (const value of [null, ...state.npcs.map(npc => npc.id)]) {
        expect(factsWithDataValue(state, 'visitorId', value).map(fact => fact.id)).toEqual(state.history.facts
            .filter(fact => fact.data.visitorId === value).map(fact => fact.id));
    }
}

it('reads appended, recurring and pruned facts from the surviving ledger', () => {
    const state = seedWorld({ seed: 'sparse-history', catalog: fixtureCatalog(), population: 40 }).state;
    const first = state.npcs.find(n => n.cultivation.realmOrdinal === 0 && !n.tags.includes('player'))!;
    const second = state.npcs.find(n => n.id !== first.id)!;
    agrees(state);
    const deed = makeFact({ day: state.currentDay, kind: 'said_in_public', summary: 'A season on the ground.',
        actors: [], witnessIds: [first.id], data: { daoAdmission: true, visitorId: first.id } });
    appendWorldFact(state, deed, { bystanders: false });
    agrees(state);
    const seen = appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'opportunity',
        locationId: state.locations[0]!.id, summary: 'Somebody stood on the ground.',
        actors: [{ id: second.id, name: second.name, role: 'actor' }] }), { bystanders: false });
    reactToWitnessedFact(state, seen, { actorId: second.id, victimId: null,
        witnesses: [{ id: first.id, seen: observationOf(seen) }] });
    agrees(state);
    appendWorldFact(state, { ...deed, day: state.currentDay + 1, witnessIds: [second.id] }, { bystanders: false });
    agrees(state);
    appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'said_in_public', summary: 'A competition entry.',
        actors: [{ id: second.id, name: second.name, role: 'entrant' }],
        data: { openCompetition: true, entry: true, hostId: 'host', contestDay: state.currentDay } }), { bystanders: false });
    appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'gathering', summary: 'A competition result.',
        actors: [{ id: first.id, name: first.name, role: 'entrant' }],
        data: { openCompetition: true, result: true, hostId: 'host', contestDay: state.currentDay } }), { bystanders: false });
    const board = `host|${state.currentDay}`;
    expect(witnessIndexFor(state).competitions.get(board)?.closed).toBe(true);
    expect(factsWithDataValue(state, 'visitorId', first.id).map(fact => fact.id)).toContain(
        state.history.facts.find(fact => fact.summary === deed.summary)!.id);
    state.npcs = state.npcs.map(n => n.id === first.id ? { ...n, status: 'physically_dead', diedOnDay: state.currentDay } : n);
    theWorldForgetsTheMortalDead(state);
    expect(factsWithDataValue(state, 'visitorId', first.id).map(fact => fact.id)).toEqual(state.history.facts
        .filter(fact => fact.data.visitorId === first.id).map(fact => fact.id));
    agrees(state);
    expect(witnessIndexFor(state).competitions.get(board)?.closed).toBe(false);
    expect(witnessIndexFor(state).pendingCompetitions.has(board)).toBe(true);
    agrees(cloneWorld(state));
    const sameDeed = state.history.facts.find(fact => fact.summary === deed.summary)!;
    const repeated = appendWorldFact(state, makeFact({ day: state.currentDay, kind: deed.kind,
        summary: deed.summary, actors: [], data: { daoAdmission: true, visitorId: null } }), { bystanders: false });
    expect(repeated.id).toBe(sameDeed.id);
    const cursor = witnessIndexFor(state).nextOrder;
    const slot = reserveFactSlot(state.history);
    expect(factsWithDataValue(state, 'auctionLot', true)).toEqual([]);
    const following = appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'said_in_public',
        summary: 'The following deed.', data: { auctionLot: true, objectId: 'later', closesOnDay: state.currentDay + 7 } }), { bystanders: false });
    expect(factsWithDataValue(state, 'auctionLot', true).map(fact => fact.id)).toEqual([following.id]);
    expect(pendingAuctionLots(state).map(fact => fact.id)).toEqual([following.id]);
    witnessIndexFor(state);
    const reserved = appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'gathering',
        summary: 'The gathering before its deeds.', data: { auctionLot: true, objectId: 'earlier', closesOnDay: state.currentDay + 7 } }), { bystanders: false, reserved: slot });
    expect(factsAddedSince(state, cursor).map(fact => fact.id)).toEqual([reserved.id, following.id]);
    expect(factsWithDataValue(state, 'auctionLot', true).map(fact => fact.id)).toEqual([reserved.id, following.id]);
    expect(pendingAuctionLots(state).map(fact => fact.id)).toEqual([reserved.id, following.id]);
    appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'gathering',
        summary: 'The earlier lot settled.', data: { auctionResult: true, lotId: reserved.id } }), { bystanders: false });
    expect(pendingAuctionLots(state).map(fact => fact.id)).toEqual([following.id]);
    expect(pendingAuctionLots(cloneWorld(state)).map(fact => fact.id)).toEqual([following.id]);
    state.history.facts = state.history.facts.filter(fact => fact.data.auctionResult !== true);
    expect(pendingAuctionLots(state).map(fact => fact.id)).toEqual([reserved.id, following.id]);
    agrees(state);
});
