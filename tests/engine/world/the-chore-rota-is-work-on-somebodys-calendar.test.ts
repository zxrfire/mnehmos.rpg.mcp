/** A resident post previously occupied every hour. The outer chore rota is a
 * repeating appointment: two people alternate days, practise between turns,
 * and earn small real contribution. Reads across years must not create daily
 * events, move absent people home, or invent staff from the roll. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { staffTheHalls, theHallStaff, settleHallService, hallServiceWorth } from '../../../src/engine/world/the-people-posted-to-a-houses-halls';
import { houseAppointment } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';
import { onTheirHallShift } from '../../../src/engine/world/a-hall-workers-shift';
import { routineOf } from '../../../src/engine/world/npc-routines';
import { whereCompoundsAre, whereTheyAreStanding } from '../../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { meritWith, whatServiceIsWorth } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour';
import type { RoomPurpose } from '../../../src/engine/world/architecture';

function build() {
    const state = createWorld({ seed: 'a-real-chore-rota', regionCount: 0, skipPriorAges: true });
    state.currentDay = 50; state.currentHour = 10;
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat',
        ranks: ['Outer Disciple', 'Inner Disciple', 'Elder', 'Head'] });
    state.factions.push(house);
    const seat = makeLocation({ id: 'seat', kind: 'sect_seat', name: house.name,
        controllingFactionId: house.id, data: { factionId: house.id } });
    state.locations.push(seat);
    for (const purpose of ['gatehouse', 'forecourt', 'life_lamp_hall', 'refectory', 'dormitory', 'practice_yard', 'punishment_hall'] as RoomPurpose[]) {
        const room = makeLocation({ id: purpose, name: purpose.replaceAll('_', ' '), kind: 'hall', parentId: seat.id, tags: ['interior'],
            data: { factionId: house.id, purpose }, controllingFactionId: house.id });
        linkLocations(seat, room, 'path', .1);
        state.locations.push(room);
    }
    state.npcs = Array.from({ length: 18 }, (_, i) => setRealm(createNpc(state.seed, {
        id: `person-${i}`, onDay: 50, bornOnDay: -7300, locationId: seat.id, factionId: house.id,
        factionRankIndex: i === 0 ? 3 : i < 8 ? 1 : 0 }), 3, 50));
    staffTheHalls(state, house.id, 50, true);
    const rota = state.npcs.filter(person => person.activity?.houseWorkSchedule?.rota);
    expect(rota.length).toBeGreaterThan(0);
    return { state, house, rota };
}

it('covers alternate days with actual appointed people in the hall where the work is done', () => {
    const { state, house, rota } = build();
    const before = JSON.stringify(state);
    for (const person of rota) {
        const fact = houseAppointment(state, person)!;
        const schedule = person.activity!.houseWorkSchedule!;
        const workDay = 50 + ((schedule.offset - 50) % schedule.periodDays + schedule.periodDays) % schedule.periodDays;
        state.currentDay = workDay;
        expect(onTheirHallShift(person.activity!, workDay + 10 / 24)).toBe(true);
        expect(routineOf(state, person).activity?.kind).toBe('stationed');
        expect(theHallStaff(state, house.id, workDay).some(post => post.personId === person.id)).toBe(true);
        expect(whereTheyAreStanding(state, whereCompoundsAre(state), person,
            new Set(state.npcs.map(row => row.id)))).toBe(fact.locationId);
        state.currentDay = workDay + 1;
        expect(onTheirHallShift(person.activity!, state.currentDay + 10 / 24)).toBe(false);
        expect(routineOf(state, person).activity?.kind).not.toBe('stationed');
        expect(theHallStaff(state, house.id, state.currentDay).some(post => post.personId === person.id)).toBe(false);
    }
    state.currentDay = 50;
    expect(JSON.stringify(state)).toBe(before);
});

it('gives the off-duty disciple actual practice ground and sleep instead of a permanent chore', () => {
    const { state, rota } = build();
    const person = rota[0]!;
    const offset = person.activity!.houseWorkSchedule!.offset;
    state.currentDay = 50 + (offset === 0 ? 1 : 0);
    for (const hour of [10, 15, 20]) {
        state.currentHour = hour;
        if (routineOf(state, person).activity?.kind !== 'their_practice') continue;
        expect(whereTheyAreStanding(state, whereCompoundsAre(state), person,
            new Set(state.npcs.map(row => row.id)))).toBe('practice_yard');
        state.currentHour = 23;
        expect(routineOf(state, person).activity?.kind).not.toBe('stationed');
        return;
    }
    throw new Error('No ordinary practice hour in the arranged off-duty day.');
});

it('settles a month of recurring responsibility once, without daily events', () => {
    const { state, house, rota } = build();
    const person = rota[0]!;
    const only = new Set([person.id]);
    const facts = state.history.facts.length;
    const earned = settleHallService(state, 80, only);
    expect(earned).toBe(hallServiceWorth(person.cultivation.realmOrdinal, 30, true));
    expect(earned).toBeGreaterThan(0);
    expect(earned).toBeLessThan(whatServiceIsWorth(person.cultivation.realmOrdinal, 30));
    expect(meritWith(state.npcs.find(row => row.id === person.id)!, house.id)).toBe(earned);
    expect(state.history.facts.length - facts).toBe(1);
    expect(settleHallService(state, 80, only)).toBe(0);
    const before = JSON.stringify(state);
    for (const day of [81, 82, 800, 8000]) routineOf({ ...state, currentDay: day }, state.npcs.find(row => row.id === person.id)!);
    expect(JSON.stringify(state)).toBe(before);
});

it('keeps an actual outward walk ahead of the off-duty calendar', () => {
    const { state, rota } = build();
    const person = rota[0]!;
    const travelling = { ...person, activity: { ...person.activity!, fromLocationId: 'seat', sinceDay: 51 } };
    state.currentDay = 51; state.currentHour = 0;
    expect(routineOf(state, travelling).activity?.kind).toBe('travelling');
});

it('keeps different gate watches in one hall and puts a real senior at the morning forms', () => {
    const { state, house } = build();
    const watch = (job: string) => state.npcs.find(person => houseAppointment(state, person)?.data.job === job)!;
    const day = watch('gate_day_watch'), night = watch('gate_night_watch'), senior = watch('morning_forms');
    expect(day).toBeDefined(); expect(night).toBeDefined(); expect(senior).toBeDefined();
    expect(day.id).not.toBe(night.id);
    state.currentHour = 8;
    expect(theHallStaff(state, house.id, 50).some(post => post.personId === day.id)).toBe(true);
    expect(theHallStaff(state, house.id, 50).some(post => post.personId === night.id)).toBe(false);
    expect(routineOf(state, senior).activity?.note).toBe('Leading the morning forms.');
    expect(whereTheyAreStanding(state, whereCompoundsAre(state), senior,
        new Set(state.npcs.map(row => row.id)))).toBe('practice_yard');
    state.currentHour = 23;
    expect(theHallStaff(state, house.id, 50).some(post => post.personId === day.id)).toBe(false);
    expect(theHallStaff(state, house.id, 50).some(post => post.personId === night.id)).toBe(true);
    expect(routineOf(state, night).activity?.note).toContain('night gate watch');
    expect(routineOf(state, senior).activity?.kind).not.toBe('stationed');
});

it('patrols actual open links, keeping the return route and the door real', () => {
    const { state } = build();
    const guard = state.npcs.find(person => houseAppointment(state, person)?.data.job === 'grounds_night_watch')!;
    expect(guard).toBeDefined();
    const before = JSON.stringify(state);
    const stops = new Set<string>();
    for (const hour of [18, 19, 20, 21, 22, 23]) {
        state.currentHour = hour;
        const work = routineOf(state, guard);
        expect(work.activity?.note).toBe('Patrolling the compound grounds.');
        stops.add(work.standingIn!);
        expect(whereTheyAreStanding(state, whereCompoundsAre(state), guard,
            new Set(state.npcs.map(row => row.id)))).toBe(work.standingIn);
    }
    expect(stops.size).toBeGreaterThan(1);
    state.currentHour = 10;
    expect(JSON.stringify(state)).toBe(before);
    const post = state.locations.find(place => place.id === guard.locationId)!;
    for (const link of post.links) {
        const target = state.locations.find(place => place.id === link.toLocationId)!;
        for (const back of target.links.filter(row => row.toLocationId === post.id)) back.open = false;
    }
    state.currentHour = 22;
    expect(routineOf(state, guard).standingIn ?? guard.locationId).toBe(guard.locationId);
});
