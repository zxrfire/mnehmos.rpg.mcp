/** The existing menial rung supplies a house's kitchen, cleaning and carrying
 * work before outer disciples are assigned recurring chores. Both are real
 * Internal Affairs appointments with pay. A servant away on something is not
 * silently brought home to make that preference true. */
import { expect, it } from 'vitest';
import { SECTS } from '../../../src/data/cultivation/sects';
import { houseFloorsOf, servantBarOf } from '../../../src/data/cultivation/the-three-floors-a-house-admits-at';
import { elderRungOf } from '../../../src/engine/cultivation/leadership';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { staffTheHalls, settleHallService } from '../../../src/engine/world/the-people-posted-to-a-houses-halls';
import { houseAppointment, personnelManager } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour';

function build(menial: boolean, servantsAway = false) {
    const sect = SECTS.find(row => houseFloorsOf(row.id)?.hasMenialTier === menial)!;
    expect(sect).toBeDefined();
    const state = createWorld({ seed: 'servants-before-the-outer-rota', regionCount: 0, skipPriorAges: true });
    state.currentDay = 50; state.currentHour = 10;
    const house = makeFaction({ id: sect.id, name: sect.name, ranks: [...sect.ranks], seatLocationId: 'seat' });
    state.factions.push(house);
    const seat = makeLocation({ id: 'seat', name: house.name, kind: 'sect_seat',
        data: { factionId: house.id }, controllingFactionId: house.id });
    state.locations.push(seat);
    for (const purpose of ['gatehouse', 'forecourt', 'life_lamp_hall', 'refectory', 'dormitory', 'practice_yard']) {
        const room = makeLocation({ id: purpose, name: purpose.replaceAll('_', ' '), kind: 'hall', parentId: seat.id,
            tags: ['interior'], data: { factionId: house.id, purpose }, controllingFactionId: house.id });
        state.locations.push(room); linkLocations(seat, room, 'path', .1);
    }
    state.npcs = Array.from({ length: 40 }, (_, i) => {
        const rank = i === 0 ? house.ranks.length - 1 : i < 5 ? elderRungOf(house.ranks.length)
            : menial && i >= 21 ? 1 : 0;
        const person = setRealm(createNpc(state.seed, { id: `person-${i}`, factionId: house.id,
            factionRankIndex: rank, locationId: 'seat', onDay: 50, bornOnDay: -7300 }),
            rank >= elderRungOf(house.ranks.length) ? sect.powerOrdinal
                : rank === 0 ? servantBarOf(sect.id)! : sect.admissionOrdinal, 50);
        if (servantsAway && rank === 0) {
            person.locationId = 'outside';
            person.activity = { kind: 'out_with_a_party', note: 'Carrying supplies outside the compound.',
                withIds: [], sinceDay: 40, untilDay: 100 };
        }
        return person;
    });
    const manager = personnelManager(state, house.id)!;
    staffTheHalls(state, house.id, 50, true);
    const menials = state.npcs.filter(person => String(houseAppointment(state, person)?.data.job).startsWith('menial_'));
    const rota = state.npcs.filter(person => person.activity?.houseWorkSchedule?.rota);
    return { state, house, manager, menials, rota };
}

it('puts the existing servants in menial posts, leaving the outer rota empty or small', () => {
    const h = build(true);
    expect(h.menials.length).toBeGreaterThan(0);
    expect(h.rota.length).toBeLessThanOrEqual(2);
    for (const worker of h.menials) {
        expect(worker.factionRankIndex).toBe(0);
        expect(houseAppointment(h.state, worker)!.actors.some(actor => actor.id === h.manager.id
            && actor.role === 'personnel_manager')).toBe(true);
        expect(worker.activity?.kind).toBe('stationed');
    }
    const worker = h.menials[0]!;
    expect(settleHallService(h.state, 80, new Set([worker.id]))).toBeGreaterThan(0);
    expect(meritWith(h.state.npcs.find(person => person.id === worker.id)!, h.house.id)).toBeGreaterThan(0);
});

it('uses paid outer chores where the house has no menial tier', () => {
    const h = build(false);
    expect(h.menials).toEqual([]);
    expect(h.rota.length).toBeGreaterThan(0);
    const worker = h.rota[0]!;
    expect(settleHallService(h.state, 80, new Set([worker.id]))).toBeGreaterThan(0);
    expect(meritWith(h.state.npcs.find(person => person.id === worker.id)!, h.house.id)).toBeGreaterThan(0);
});

it('does not move away servants home and lets the outer rota cover their work', () => {
    const h = build(true, true);
    expect(h.menials).toEqual([]);
    expect(h.rota.length).toBeGreaterThan(0);
    expect(h.state.npcs.filter(person => person.factionRankIndex === 0)
        .every(person => person.locationId === 'outside' && person.activity?.kind === 'out_with_a_party')).toBe(true);
});
