/** House care needs an appointed clinician, payment and the real month.
 * The same month can treat several paid wounds, as for the player. A
 * provider or patient who leaves interrupts it; money never creates an instant cure. */
import { locationOfNpcOnItsJourney, whenTheyReachTheirPost } from '../../../src/engine/world/places-on-the-way';
import { settleHallService, hallServiceWorth } from '../../../src/engine/world/the-people-posted-to-a-houses-halls';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour';

import { expect, it } from 'vitest';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { woundsCloseThisYear } from '../../../src/engine/world/what-a-house-does-about-its-people-being-hurt';
import { DAYS_PER_MONTH, getOccupation, MORTAL_PHYSICIAN_JOB } from '../../../src/data/cultivation/mortal-world';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { appointHouseHealer, whoTendsTheSick } from '../../../src/engine/world/who-is-actually-seeing-to-wounds';
import { beginHouseCare, settleHouseCare } from '../../../src/engine/world/a-house-healer-tends-a-real-member';
import { houseAppointment } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';

function ready(dedicated = false) {
    const state = createWorld({ seed: 'the-house-appoints-a-physician', regionCount: 0, skipPriorAges: true });
    state.currentDay = 0; state.currentHour = 14;
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat', resources: { spirit_stones: 100 } });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: 'Reed House', kind: 'sect_seat', controllingFactionId: house.id }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall', parentId: 'seat', tags: ['interior'],
            data: { factionId: house.id, purpose: 'dormitory' } }));
    if (dedicated) {
        const clinic = makeLocation({ id: 'clinic', name: 'Infirmary', kind: 'hall', parentId: 'seat',
            data: { factionId: house.id, purpose: 'infirmary' } });
        state.locations.push(clinic);
        linkLocations(state.locations.find(place => place.id === 'quarters')!, clinic, 'path', .1);
        linkLocations(state.locations.find(place => place.id === 'seat')!, clinic, 'path', .1);
    }
    const manager = createNpc(state.seed, { id: 'manager', onDay: 0, bornOnDay: -7300,
        locationId: 'seat', factionId: house.id, factionRankIndex: house.ranks.length - 1 });
    const physician = setRealm(createNpc(state.seed, { id: 'physician', onDay: 0, bornOnDay: -7300,
        locationId: 'seat', factionId: house.id, factionRankIndex: 0,
        occupation: getOccupation(MORTAL_PHYSICIAN_JOB)!.name }), 0, 0);
    state.npcs.push(manager, physician);
    const chosen = appointHouseHealer(state, house.id, 0)!;
    expect(chosen).not.toBeNull();
    let hour = 0;
    while (hour < 24 && !whoTendsTheSick(state, house.id, 0)) state.currentHour = ++hour;
    expect(hour).toBeLessThan(24);
    const patient = setRealm(createNpc(state.seed, { id: 'patient', onDay: 0, bornOnDay: -7300,
        locationId: 'quarters', factionId: house.id, factionRankIndex: 0 }), 0, 0);
    patient.cultivation.injuries = [{ id: 'tear', severity: 'minor', source: 'combat', description: 'A torn meridian.',
        sustainedOnTurn: 0, treated: false, cultivationPenalty: .1, breakthroughPenalty: .05, woundType: null }];
    patient.cultivation.untreatedInjuries = 1;
    state.npcs.push(patient);
    return { state, house, patient, chosen };
}

it('pays a real clinician and closes its original wound only at the actual course end', () => {
    const h = ready(), before = h.chosen.spiritStones;
    let due = 0;
    expect(beginHouseCare(h.state, h.patient, 0, (_id, day) => { due = day; })).toBe(true);
    expect(due).toBe(DAYS_PER_MONTH);
    const spent = 100 - h.house.resources.spirit_stones!;
    expect(spent).toBeGreaterThan(0);
    expect(h.state.npcs.find(person => person.id === h.chosen.id)!.spiritStones).toBe(before + spent);
    expect(settleHouseCare(h.state, due - 1)).toBe(0);
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.cultivation.injuries[0]!.treated).toBe(false);
    expect(settleHouseCare(h.state, due)).toBe(1);
    expect(settleHouseCare(h.state, due + 1)).toBe(0);
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.activity).toBeNull();
    expect(houseAppointment(h.state, h.state.npcs.find(person => person.id === h.chosen.id)!)?.data.job).toBe('tending_the_sick');
});

it('does not buy treatment on credit or close a wound when the clinician leaves', () => {
    const h = ready();
    h.house.resources.spirit_stones = 0;
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(false);
    h.house.resources.spirit_stones = 100;
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    h.state.npcs.find(person => person.id === h.chosen.id)!.locationId = 'away';
    expect(settleHouseCare(h.state, 1)).toBe(0);
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.cultivation.injuries[0]!.treated).toBe(false);
    expect(h.state.history.facts.some(fact => fact.data.houseClinicalCareEnded && fact.data.completed === false)).toBe(true);
});

it('lets a patient leave without discarding their new undertaking or trapping the clinician', () => {
    const h = ready();
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    const at = h.state.npcs.findIndex(person => person.id === h.patient.id);
    h.state.npcs[at] = { ...h.state.npcs[at]!, activity: { kind: 'travelling', note: 'Walking away.',
        withIds: [], sinceDay: 1, untilDay: 4, returnTo: 'another-town' } };
    expect(settleHouseCare(h.state, 1)).toBe(0);
    expect(h.state.npcs[at]!.activity?.returnTo).toBe('another-town');
    expect(h.state.npcs.find(person => person.id === h.chosen.id)!.activity?.withIds).toEqual([]);
});

it('settles a background course on its actual endpoint through the native appointment queue', () => {
    const h = ready();
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    advanceWorldForPlay(h.state, { days: DAYS_PER_MONTH + 1, stopOnInterrupt: false });
    const ended = h.state.history.facts.find(fact => fact.data.houseClinicalCareEnded);
    expect(ended).toBeDefined();
    expect(ended!.day).toBe(DAYS_PER_MONTH);
    expect(ended!.data.completed).toBe(true);
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.cultivation.injuries[0]!.treated).toBe(true);
});


it('stops care when the actual patient leaves, even while its old activity remains', () => {
    const h = ready();
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    h.state.npcs.find(person => person.id === h.patient.id)!.locationId = 'another-town';
    expect(settleHouseCare(h.state, 1)).toBe(0);
    expect(h.state.npcs.find(person => person.id === h.chosen.id)!.activity?.withIds).toEqual([]);
    expect(h.state.history.facts.find(fact => fact.data.houseClinicalCareEnded)?.data.completed).toBe(false);
});


it('reports the actual clinical fee when the yearly care read starts a course', () => {
    const h = ready();
    const care = woundsCloseThisYear(h.state, 0, 0);
    expect(care.spent).toBeGreaterThan(0);
    expect(care.spent).toBe(100 - h.house.resources.spirit_stones!);
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.activity?.houseCareFactId).toBeDefined();
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.cultivation.injuries[0]!.treated).toBe(false);
});


it('buys several original wounds in the same month without treating a new wound instead', () => {
    const one = ready();
    expect(beginHouseCare(one.state, one.patient, 0)).toBe(true);
    const oneFee = 100 - one.house.resources.spirit_stones!;
    const h = ready();
    h.patient.cultivation.injuries.push({ ...h.patient.cultivation.injuries[0]!, id: 'second-tear' });
    h.patient.cultivation.untreatedInjuries = 2;
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    expect(100 - h.house.resources.spirit_stones!).toBe(2 * oneFee);
    const actual = h.state.npcs.find(person => person.id === h.patient.id)!;
    actual.cultivation.injuries.push({ ...actual.cultivation.injuries[0]!, id: 'later-tear' });
    actual.cultivation.untreatedInjuries = 3;
    expect(settleHouseCare(h.state, DAYS_PER_MONTH)).toBe(2);
    const after = h.state.npcs.find(person => person.id === h.patient.id)!;
    expect(new Set(after.cultivation.injuries.filter(wound => wound.treated).map(wound => wound.id)))
        .toEqual(new Set(['tear', 'second-tear']));
    expect(after.cultivation.untreatedInjuries).toBe(1);
});


it('buys only the wound count its real purse can pay for', () => {
    const one = ready();
    expect(beginHouseCare(one.state, one.patient, 0)).toBe(true);
    const fee = 100 - one.house.resources.spirit_stones!;
    const h = ready();
    h.patient.cultivation.injuries.push({ ...h.patient.cultivation.injuries[0]!, id: 'second-tear' });
    h.patient.cultivation.untreatedInjuries = 2;
    h.house.resources.spirit_stones = fee;
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    expect(h.house.resources.spirit_stones).toBe(0);
    expect(settleHouseCare(h.state, DAYS_PER_MONTH)).toBe(1);
    expect(h.state.npcs.find(person => person.id === h.patient.id)!.cultivation.untreatedInjuries).toBe(1);
});


it('preserves a new party with the patient when the old course is interrupted', () => {
    const h = ready();
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    const doctor = h.state.npcs.find(person => person.id === h.chosen.id)!;
    const patient = h.state.npcs.find(person => person.id === h.patient.id)!;
    doctor.activity = { ...doctor.activity!, kind: 'out_with_a_party', note: 'Leaving with the party.',
        sinceDay: 1, untilDay: 4, withIds: [patient.id] };
    patient.activity = { kind: 'out_with_a_party', note: 'Leaving with the party.', sinceDay: 1, untilDay: 4,
        withIds: [doctor.id] };
    expect(settleHouseCare(h.state, 1)).toBe(0);
    expect(h.state.npcs.find(person => person.id === doctor.id)!.activity?.withIds).toEqual([patient.id]);
    expect(h.state.npcs.find(person => person.id === patient.id)!.activity?.withIds).toEqual([doctor.id]);
    expect(h.state.npcs.find(person => person.id === doctor.id)!.activity?.houseCareProviderFactId).toBeUndefined();
});

it('lets a worker at a home hall take care and resume without pay for the treatment interval', () => {
    const h = ready();
    h.patient.activity = { kind: 'stationed', note: 'Serving the quarters.', withIds: [],
        sinceDay: -30, untilDay: 90, returnTo: 'seat' };
    const at = h.state.npcs.findIndex(person => person.id === h.patient.id);
    h.state.npcs[at] = h.patient;
    let due = 0;
    expect(beginHouseCare(h.state, h.patient, 0, (_id, day) => { due = day; })).toBe(true);
    const earned = meritWith(h.state.npcs[at]!, h.house.id);
    expect(earned).toBe(hallServiceWorth(h.patient.cultivation.realmOrdinal, 30));
    expect(earned).toBeGreaterThan(0);
    expect(settleHallService(h.state, due - 1, new Set([h.patient.id]))).toBe(0);
    expect(settleHouseCare(h.state, due)).toBe(1);
    const resumed = h.state.npcs[at]!;
    expect(resumed.activity?.kind).toBe('stationed');
    expect(resumed.activity?.sinceDay).toBe(due);
    expect(resumed.activity?.untilDay).toBe(90);
    expect(meritWith(resumed, h.house.id)).toBe(earned);
    expect(settleHallService(h.state, due, new Set([h.patient.id]))).toBe(0);
    expect(settleHallService(h.state, due + 30, new Set([h.patient.id]))).toBe(earned);
    expect(meritWith(h.state.npcs[at]!, h.house.id)).toBe(earned * 2);
});

it('walks a posted worker to dedicated care and back before service starts again', () => {
    const h = ready(true);
    h.patient.activity = { kind: 'stationed', note: 'Serving the quarters.', withIds: [],
        sinceDay: -30, untilDay: 90, returnTo: 'seat' };
    const at = h.state.npcs.findIndex(person => person.id === h.patient.id);
    h.state.npcs[at] = h.patient;
    let due = 0;
    expect(beginHouseCare(h.state, h.patient, 0, (_id, day) => { due = day; })).toBe(true);
    const course = h.state.history.facts.find(fact => fact.data.houseClinicalCare === true)!;
    const begins = Number(course.data.beginsOnDay);
    expect(begins).toBeGreaterThan(0);
    expect(locationOfNpcOnItsJourney(h.state, h.state.npcs[at]!, 0)).toBe('quarters');
    expect(settleHouseCare(h.state, begins / 2)).toBe(0);
    expect(locationOfNpcOnItsJourney(h.state, h.state.npcs[at]!, begins)).toBe('clinic');
    expect(settleHouseCare(h.state, due)).toBe(1);
    const returning = h.state.npcs[at]!;
    expect(locationOfNpcOnItsJourney(h.state, returning, due)).toBe('clinic');
    const returned = whenTheyReachTheirPost(h.state.locations, returning)!;
    expect(returned).toBeGreaterThan(due);
    expect(locationOfNpcOnItsJourney(h.state, returning, returned)).toBe('quarters');
    expect(settleHallService(h.state, returned, new Set([h.patient.id]))).toBe(0);
});

it('returns from the ground actually reached if care is interrupted during the approach', () => {
    const h = ready(true);
    h.patient.activity = { kind: 'stationed', note: 'Serving the quarters.', withIds: [],
        sinceDay: -30, untilDay: 90, returnTo: 'seat' };
    const at = h.state.npcs.findIndex(person => person.id === h.patient.id);
    h.state.npcs[at] = h.patient;
    expect(beginHouseCare(h.state, h.patient, 0)).toBe(true);
    const course = h.state.history.facts.find(fact => fact.data.houseClinicalCare === true)!;
    const day = Number(course.data.beginsOnDay) / 2;
    const reached = locationOfNpcOnItsJourney(h.state, h.state.npcs[at]!, day);
    const healerAt = h.state.npcs.findIndex(person => person.id === h.chosen.id);
    h.state.npcs[healerAt] = { ...h.state.npcs[healerAt]!, activity: null };
    expect(settleHouseCare(h.state, day)).toBe(0);
    expect(locationOfNpcOnItsJourney(h.state, h.state.npcs[at]!, day)).toBe(reached);
    expect(h.state.npcs[at]!.cultivation.injuries[0]!.treated).toBe(false);
});

it('does not take a physician out of their own timed practice to appoint them', () => {
    const state = createWorld({ seed: 'the-house-appoints-a-physician', regionCount: 0, skipPriorAges: true });
    state.currentDay = 0;
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat' });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: house.name, kind: 'sect_seat', controllingFactionId: house.id }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall', parentId: 'seat', tags: ['interior'],
            data: { factionId: house.id, purpose: 'dormitory' } }));
    const manager = createNpc(state.seed, { id: 'manager', onDay: 0, bornOnDay: -7300,
        locationId: 'seat', factionId: house.id, factionRankIndex: house.ranks.length - 1 });
    const physician = setRealm(createNpc(state.seed, { id: 'physician', onDay: 0, bornOnDay: -7300,
        locationId: 'seat', factionId: house.id, factionRankIndex: 0,
        occupation: getOccupation(MORTAL_PHYSICIAN_JOB)!.name }), 0, 0);
    physician.activity = { kind: 'their_practice', note: 'Their own timed practice.', withIds: [], sinceDay: 0, untilDay: 20 };
    state.npcs.push(manager, physician);
    const before = JSON.stringify(physician);
    appointHouseHealer(state, house.id, 0);
    expect(JSON.stringify(state.npcs.find(person => person.id === physician.id))).toBe(before);
});
