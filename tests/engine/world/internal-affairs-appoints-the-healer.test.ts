/** A house's medicine clerk was mistaken for its appointed healer. Internal
 * Affairs chooses through ordinary odds; the appointment uses existing quarters
 * and leaves busy, absent or dead people out of the work. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { MORTAL_PHYSICIAN_JOB, getOccupation } from '../../../src/data/cultivation/mortal-world';
import { appointHouseHealer, whoTendsTheSick } from '../../../src/engine/world/who-is-actually-seeing-to-wounds';
import { houseAppointment } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps';

function household() {
    const state = createWorld({ seed: 'the-house-appoints-a-physician', regionCount: 0, skipPriorAges: true });
    state.currentDay = 0; state.currentHour = 14;
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat' });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: 'Reed House', kind: 'sect_seat', controllingFactionId: house.id }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall', parentId: 'seat', tags: ['interior'],
            data: { factionId: house.id, purpose: 'dormitory' } }));
    const manager = createNpc(state.seed, { id: 'manager', onDay: 0, bornOnDay: -7300,
        locationId: 'seat', factionId: house.id, factionRankIndex: house.ranks.length - 1 });
    const physician = createNpc(state.seed, { id: 'physician', onDay: 0, bornOnDay: -7300,
        locationId: 'seat', factionId: house.id, factionRankIndex: 0,
        occupation: getOccupation(MORTAL_PHYSICIAN_JOB)!.name });
    state.npcs.push(manager, setRealm(physician, 0, 0));
    return { state, house };
}

it('appoints a real healer without adding a dedicated room, and retains the appointment through paperwork cleanup', () => {
    const { state, house } = household();
    expect(whoTendsTheSick(state, house.id, 0)).toBeNull();
    const chosen = appointHouseHealer(state, house.id, 0);
    expect(chosen).not.toBeNull();
    const fact = houseAppointment(state, chosen!)!;
    expect(fact.locationId).toBe('quarters');
    expect(fact.actors.find(actor => actor.role === 'personnel_manager')?.id).toBe('manager');
    let foundWorking = false;
    for (let hour = 0; hour < 24; hour++) {
        state.currentHour = hour;
        foundWorking ||= whoTendsTheSick(state, house.id, 0)?.id === chosen!.id;
    }
    expect(foundWorking).toBe(true);
    expect(state.locations.length).toBe(2);
    expect(appointHouseHealer(state, house.id, 0)?.id).toBe(chosen!.id);
    state.currentDay = 366;
    keepTheBusinessStillOnTheBooks(state);
    expect(houseAppointment(state, chosen!)?.id).toBe(fact.id);
    chosen!.status = 'physically_dead';
    expect(whoTendsTheSick(state, house.id, 366)).toBeNull();
});

it('does not take a physician off their actual commission or bring an absent healer back', () => {
    const { state, house } = household();
    const physician = state.npcs.find(person => person.id === 'physician')!;
    physician.activity = { kind: 'making', note: 'Working on a commission.', withIds: [],
        sinceDay: 0, untilDay: 10, thingId: 'an-actual-commission' };
    const chosen = appointHouseHealer(state, house.id, 0);
    expect(chosen?.id).not.toBe(physician.id);
    expect(physician.activity.thingId).toBe('an-actual-commission');
    physician.locationId = 'elsewhere';
    expect(whoTendsTheSick(state, house.id, 0)?.id).not.toBe(physician.id);
});
