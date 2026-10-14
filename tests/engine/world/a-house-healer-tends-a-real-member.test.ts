/** House care needs an appointed clinician, payment and the real month. A
 * provider or patient who leaves interrupts it; money never creates an instant cure. */
import { expect, it } from 'vitest';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { woundsCloseThisYear } from '../../../src/engine/world/what-a-house-does-about-its-people-being-hurt';
import { DAYS_PER_MONTH, getOccupation, MORTAL_PHYSICIAN_JOB } from '../../../src/data/cultivation/mortal-world';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { appointHouseHealer, whoTendsTheSick } from '../../../src/engine/world/who-is-actually-seeing-to-wounds';
import { beginHouseCare, settleHouseCare } from '../../../src/engine/world/a-house-healer-tends-a-real-member';
import { houseAppointment } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';

function ready() {
    const state = createWorld({ seed: 'the-house-appoints-a-physician', regionCount: 0, skipPriorAges: true });
    state.currentDay = 0; state.currentHour = 14;
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat', resources: { spirit_stones: 100 } });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: 'Reed House', kind: 'sect_seat', controllingFactionId: house.id }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall', parentId: 'seat', tags: ['interior'],
            data: { factionId: house.id, purpose: 'dormitory' } }));
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
