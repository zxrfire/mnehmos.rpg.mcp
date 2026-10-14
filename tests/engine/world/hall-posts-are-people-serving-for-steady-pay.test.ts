/** Hall staffing used to be an imaginary round-robin read and native pay only
 * arrived after years away. Internal Affairs now appoints real available people;
 * they walk to their rooms and earn modest contribution for elapsed service.
 * Repeated reads and promotion must not pay that same service again. */
import { createObligation } from '../../../src/engine/social/grudges';
import { onTheirHallShift } from '../../../src/engine/world/a-hall-workers-shift';

import { expect, it } from 'vitest';
import { growCompound, type CompoundInput } from '../../../src/engine/world/architecture';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { hallServiceWorth, staffTheHalls, settleHallService, theHallStaff } from '../../../src/engine/world/the-people-posted-to-a-houses-halls';
import { houseAppointment, personnelManager } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';
import { locationOfNpcOnItsJourney, whenTheyReachTheirPost } from '../../../src/engine/world/places-on-the-way';
import { meritWith, whatServiceIsWorth } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour';
import { witnessIndexFor } from '../../../src/engine/world/witness-reaction-index';
import { appendFact, makeFact } from '../../../src/engine/world/history';

function houseAtWork() {
    const state = createWorld({ seed: 'hall-posts-have-actual-people', regionCount: 0, skipPriorAges: true });
    state.currentDay = 50;
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat',
        ranks: ['Outer Disciple', 'Inner Disciple', 'Elder', 'Grand Elder', 'Head'] });
    const input: CompoundInput = { factionId: house.id, factionName: house.name, ranks: house.ranks,
        admissionOrdinal: 3, powerOrdinal: 30, recruits: true, alignment: 'neutral', reliableOrdinal: 20,
        formationIntegrity: .5, formationNodesTotal: 20, formationNodesLit: 10, inherited: true,
        holdsVein: true, tributeStonesPerYear: 1, sealedCeilingOrdinal: 30,
        preferredRoots: [], teachesElements: ['metal'], specialities: ['attack'] };
    const seat = makeLocation({ id: 'seat', name: house.name, kind: 'sect_seat',
        controllingFactionId: house.id, data: { factionId: house.id } });
    state.factions.push(house);
    state.locations = [seat, ...growCompound(seat, input, { seed: state.seed, presentDay: 0 }).locations];
    state.npcs = Array.from({ length: 30 }, (_, i) => setRealm(createNpc(state.seed, {
        id: `person-${i}`, onDay: 50, bornOnDay: -7300, locationId: seat.id, factionId: house.id,
        factionRankIndex: i === 0 ? 4 : i < 8 ? 2 : 1 }), 3, 50));
    return { state, house };
}

it('appoints real roll members through Internal Affairs and keeps their actual walk', () => {
    const { state, house } = houseAtWork();
    const manager = personnelManager(state, house.id)!;
    const population = state.npcs.length;
    expect(staffTheHalls(state, house.id, 50)).toBeGreaterThan(0);
    const appointed = state.npcs.filter(person => houseAppointment(state, person));
    expect(appointed.length).toBeGreaterThan(0);
    expect(state.npcs.length).toBe(population);
    for (const worker of appointed) {
        const appointment = houseAppointment(state, worker)!;
        expect(appointment.actors.some(actor => actor.id === manager.id && actor.role === 'personnel_manager')).toBe(true);
        expect(worker.activity?.kind).toBe('stationed');
        expect(locationOfNpcOnItsJourney(state, worker, 50)).toBe(house.seatLocationId);
        const arrival = whenTheyReachTheirPost(state.locations, worker)!;
        expect(arrival).toBeGreaterThan(50);
        expect(locationOfNpcOnItsJourney(state, worker, arrival)).toBe(appointment.locationId);
    }
    expect(theHallStaff(state, house.id, 50)).toEqual([]);
    expect(theHallStaff(state, house.id, 80).length).toBe(appointed.filter(person => onTheirHallShift(person.activity!, 80 + 8 / 24)).length);
    expect(new Set(appointed.map(person => houseAppointment(state, person)!.data.job)).size).toBe(appointed.length);
});

it('pays elapsed service before the term ends, once, below board work', () => {
    const { state, house } = houseAtWork();
    staffTheHalls(state, house.id, 50);
    const worker = state.npcs.find(person => houseAppointment(state, person))!;
    const only = new Set([worker.id]);
    const arrival = whenTheyReachTheirPost(state.locations, worker)!;
    expect(settleHallService(state, arrival, only)).toBe(0);
    const first = settleHallService(state, arrival + 30, only);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(whatServiceIsWorth(worker.cultivation.realmOrdinal, 30));
    expect(meritWith(state.npcs.find(person => person.id === worker.id)!, house.id)).toBe(first);
    expect(settleHallService(state, arrival + 30, only)).toBe(0);
    const second = settleHallService(state, arrival + 60, only);
    expect(first + second).toBe(hallServiceWorth(worker.cultivation.realmOrdinal, 60));
    const before = meritWith(state.npcs.find(person => person.id === worker.id)!, house.id);
    const at = state.npcs.findIndex(person => person.id === worker.id);
    state.npcs[at] = setRealm(state.npcs[at]!, 10, arrival + 60);
    expect(settleHallService(state, arrival + 60, only)).toBe(0);
    expect(meritWith(state.npcs[at]!, house.id)).toBe(before);
});

it('does not fill a hall with members already out on real work', () => {
    const { state, house } = houseAtWork();
    for (const person of state.npcs.filter(person => person.factionRankIndex < 2)) {
        person.activity = { kind: 'out_with_a_party', note: 'Working outside the compound.', withIds: [], sinceDay: 40, untilDay: 90 };
    }
    expect(staffTheHalls(state, house.id, 50)).toBe(0);
    expect(theHallStaff(state, house.id, 80)).toEqual([]);
    expect(settleHallService(state, 80)).toBe(0);
});

// The first two-century regression was stopped after more than 22 minutes:
// each appointment read rebuilt the full history index through a fresh wrapper.
// A repeated read must reuse its actual world's index, even in a long history.
it('reads active appointments without rescanning the complete history on every lookup', () => {
    const { state, house } = houseAtWork();
    staffTheHalls(state, house.id, 50);
    const worker = state.npcs.find(person => houseAppointment(state, person))!;
    for (let i = 0; i < 200; i++) appendFact(state.history, makeFact({ day: i,
        kind: 'gathering', summary: 'The grounds were swept.', data: {} }));
    const facts = state.history.facts;
    let reads = 0;
    state.history.facts = new Proxy(facts, { get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
    } });
    witnessIndexFor(state);
    reads = 0;
    for (let i = 0; i < 20; i++) expect(houseAppointment(state, worker)?.id).toBe(worker.activity!.houseWorkFactId);
    expect(reads).toBeLessThan(facts.length);
});

it('keeps paying an actual worker awaiting relief after the planned tour ends', () => {
    const { state, house } = houseAtWork();
    staffTheHalls(state, house.id, 50);
    const at = state.npcs.findIndex(person => houseAppointment(state, person)?.data.job === 'serving_internal_affairs');
    const worker = state.npcs[at]!;
    expect(worker).toBeDefined();
    state.npcs[at] = { ...worker, activity: { ...worker.activity!, untilDay: 51 } };
    state.currentHour = 10;
    expect(theHallStaff(state, house.id, 80).some(post => post.personId === worker.id)).toBe(true);
    expect(settleHallService(state, 80, new Set([worker.id]))).toBeGreaterThan(0);
});

it("does not also grant a privately paid contractor the member's hall contribution", () => {
    const { state, house } = houseAtWork();
    staffTheHalls(state, house.id, 50, true);
    const worker = state.npcs.find(person => houseAppointment(state, person))!;
    state.obligations.push(createObligation({ kind: 'oath', holderId: worker.id, subjectId: 'member',
        cause: 'service_term', severity: 'serious', onDay: 50, dueOnDay: 90,
        description: "Serving the member's paid duty.", tags: ['hired-duty', `post-at:${worker.locationId}`] }));
    expect(settleHallService(state, 80, new Set([worker.id]))).toBe(0);
    expect(meritWith(state.npcs.find(person => person.id === worker.id)!, house.id)).toBe(0);
});
