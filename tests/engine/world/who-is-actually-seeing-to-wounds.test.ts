/**
 * Care once existed without any practitioner. The occupation catalog already
 * states where mortal physicians work; seeding now makes ordinary named lives
 * there and their routine controls availability. A house's dispenser is an
 * ordinary member doing rank work, never a mortal job given to a cultivator,
 * an absent member, or somebody diverted from a concrete craft or lesson.
 * A source audit after model rooms08 found another candidate discrepancy:
 * The baseline regression failed on 2026-10-03: selection admitted generic work
 * stored in another inner room, while physical
 * placement rightly preserved that room. The added control places an ordinary
 * worker there and requires the provider answer to agree with their real body.
 * This is separate from rooms08's repaired instrument clock/area selection;
 * it makes no claim that the played failure was caused by this discrepancy.
 * The later universal-work ruling lets the same finite medicine shelf use
 * existing quarters when a house has no dedicated infirmary. Its dispenser
 * must stand on that actual care ground; adding a room is not required.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { whereCompoundsAre, whereTheyAreStanding } from '../../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { givePhysiciansTheirOpeningWork, isAMortalPhysician, mortalPhysicianJob,
    physicianIsWorking, seedTownPhysicians, whoDispensesAtTheHouse }
    from '../../../src/engine/world/who-is-actually-seeing-to-wounds.js';

function empty() { return createWorld({ seed: 'real-clinical-work', regionCount: 0, skipPriorAges: true }); }

describe('the catalog physician is an ordinary mortal life', () => {
    it('seeds only towns the occupation serves, with real names and one occupation source', () => {
        const state = empty();
        for (const kind of ['village', ...mortalPhysicianJob().settlements]) {
            state.locations.push(makeLocation({ id: `town-${kind}`, name: kind, kind: 'settlement', tags: [kind] }));
        }
        const made = seedTownPhysicians(state, 0);
        expect(made.length).toBeGreaterThan(0);
        for (const npc of made) {
            expect(isAMortalPhysician(npc)).toBe(true);
            expect(npc.name).not.toBe('unknown');
            expect(state.locations.find(l => l.id === npc.locationId)!.tags.some(tag =>
                mortalPhysicianJob().settlements.some(kind => kind === tag))).toBe(true);
        }
        expect(made.some(n => n.locationId === 'town-village')).toBe(false);
        expect(seedTownPhysicians(state, 0)).toEqual([]);
    });

    it('does not offer care while sleeping or eating, or after death', () => {
        const state = empty();
        state.locations.push(makeLocation({ id: 'town', name: 'Town', kind: 'settlement', tags: ['city'] }));
        const [npc] = seedTownPhysicians(state, 0);
        givePhysiciansTheirOpeningWork(state, 0);
        const working = Array.from({ length: 24 }, (_, i) => i).some(hour => {
            state.currentHour = hour;
            return physicianIsWorking(state, npc!);
        });
        expect(working).toBe(true);
        npc!.activity = { kind: 'idle', note: 'Sleeping.', withIds: [], sinceDay: 0, untilDay: 1 };
        expect(physicianIsWorking(state, npc!)).toBe(false);
        npc!.activity = { kind: 'at_a_table', note: 'Eating.', withIds: [], sinceDay: 0, untilDay: 1 };
        expect(physicianIsWorking(state, npc!)).toBe(false);
        npc!.status = 'physically_dead';
        expect(physicianIsWorking(state, npc!)).toBe(false);
    });
});

describe('dispensing the house medicine is ordinary rank work', () => {
    it('uses existing quarters for the medicine shelf without a dedicated infirmary', () => {
        const state = empty();
        const house = makeFaction({ id: 'small-house', name: 'Small House', seatLocationId: 'small-seat' });
        state.factions.push(house);
        const seat = makeLocation({ id: 'small-seat', name: 'Small House', kind: 'sect_seat',
            controllingFactionId: house.id });
        const quarters = makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall', parentId: seat.id,
            controllingFactionId: house.id, tags: ['interior'], data: { factionId: house.id, purpose: 'dormitory' } });
        state.locations.push(seat, quarters);
        const member = createNpc(state.seed, { id: 'shelf-worker', bornOnDay: -7300, onDay: 0,
            locationId: seat.id, factionId: house.id, factionRankIndex: 0 });
        member.activity = { kind: 'the_work_of_their_rank', note: 'Working.', withIds: [], sinceDay: 0, untilDay: 1 };
        state.npcs.push(member);
        expect(whoDispensesAtTheHouse(state, house.id)?.id).toBe(member.id);
        expect(whereTheyAreStanding(state, whereCompoundsAre(state), member,
            new Set(state.npcs.map(person => person.id)))).toBe(quarters.id);
        expect(state.locations.map(place => place.id)).toEqual([seat.id, quarters.id]);
        member.locationId = 'away';
        expect(whoDispensesAtTheHouse(state, house.id)).toBeNull();
    });

    it('requires an actual member on that ground and leaves crafting and away duties alone', () => {
        const state = empty();
        const house = makeFaction({ id: 'house', name: 'House', seatLocationId: 'seat' });
        state.factions.push(house);
        state.locations.push(makeLocation({ id: 'seat', name: 'Seat', kind: 'sect_seat', controllingFactionId: house.id }),
            makeLocation({ id: 'infirmary', name: 'Infirmary', kind: 'hall', controllingFactionId: house.id,
                data: { purpose: 'infirmary', factionId: house.id } }));
        const npc = createNpc(state.seed, { id: 'member', name: 'Member', bornOnDay: -7300, onDay: 0,
            locationId: 'seat', factionId: house.id, factionRankIndex: 0 });
        npc.activity = { kind: 'the_work_of_their_rank', note: 'Working.', withIds: [], sinceDay: 0, untilDay: 1 };
        state.npcs.push(npc);
        const occupation = npc.identity.occupation;
        expect(whoDispensesAtTheHouse(state, house.id)?.id).toBe(npc.id);
        expect(npc.identity.occupation).toBe(occupation);
        npc.activity.thingId = 'a-concrete-commission';
        expect(whoDispensesAtTheHouse(state, house.id)).toBeNull();
        delete npc.activity.thingId;
        npc.locationId = 'elsewhere';
        expect(whoDispensesAtTheHouse(state, house.id)).toBeNull();
    });
});


it('does not offer another room’s worker as an infirmary attendant', () => {
    const state = empty();
    const house = makeFaction({ id: 'house-ground', name: 'House', seatLocationId: 'seat-ground' });
    state.factions.push(house);
    const seat = makeLocation({ id: 'seat-ground', name: 'Seat', kind: 'sect_seat', controllingFactionId: house.id });
    const infirmary = makeLocation({ id: 'clinical-ground', name: 'Infirmary', kind: 'hall', parentId: seat.id,
        controllingFactionId: house.id, tags: ['interior'], data: { purpose: 'infirmary', factionId: house.id } });
    const workroom = makeLocation({ id: 'other-ground', name: 'Practice room', kind: 'hall', parentId: seat.id,
        controllingFactionId: house.id, tags: ['interior'], data: { purpose: 'practice_yard', factionId: house.id } });
    state.locations.push(seat, infirmary, workroom);
    const npc = createNpc(state.seed, { id: 'actual-room-worker', name: 'Member', bornOnDay: -7300, onDay: 0,
        locationId: seat.id, factionId: house.id, factionRankIndex: 0 });
    npc.activity = { kind: 'the_work_of_their_rank', note: 'Working.', withIds: [], sinceDay: 0, untilDay: 1 };
    state.npcs.push(npc);
    const at = () => whereTheyAreStanding(state, whereCompoundsAre(state), npc, new Set(state.npcs.map(n => n.id)));
    expect(whoDispensesAtTheHouse(state, house.id)?.id).toBe(npc.id);
    expect(at()).toBe(infirmary.id);
    const activity = npc.activity;
    npc.locationId = workroom.id;
    expect(at()).toBe(workroom.id);
    expect(whoDispensesAtTheHouse(state, house.id)).toBeNull();
    expect(npc.locationId).toBe(workroom.id);
    expect(npc.activity).toBe(activity);
    npc.locationId = infirmary.id;
    expect(whoDispensesAtTheHouse(state, house.id)?.id).toBe(npc.id);
    expect(at()).toBe(infirmary.id);
});
