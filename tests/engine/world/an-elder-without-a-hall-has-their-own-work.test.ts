/** An elder without a hall keeps an actual private practice, not an invented
 * lecture or a turn at somebody else's desk. Existing recorded work keeps its
 * own activity and room. This covers the idle default; staffing and pay are separate. */
import { expect, it } from 'vitest';
import { growCompound, ROOMS_A_THING_IS_MADE_IN, type CompoundInput } from '../../../src/engine/world/architecture';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { portfoliosIn } from '../../../src/engine/social-leverage/authority-for-an-order';
import { routineOf } from '../../../src/engine/world/npc-routines';
import { whatTheyOpenAt } from '../../../src/engine/world/what-somebody-is-at-when-you-walk-up';
import { whereCompoundsAre, whereTheyAreStanding } from '../../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { whoDispensesAtTheHouse } from '../../../src/engine/world/who-is-actually-seeing-to-wounds';
import { theLodgingsOfAHouse, whichRoomARungGets } from '../../../src/engine/world/the-room-a-house-gives-you';
import { MINOR_HEALING_PILL_ID } from '../../../src/data/cultivation/pills';

function build() {
    const state = createWorld({ seed: 'an-elder-at-their-own-work', regionCount: 0, skipPriorAges: true });
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
    state.npcs = Array.from({ length: 11 }, (_, i) => setRealm(createNpc(state.seed, {
        id: `person-${i}`, onDay: 50, bornOnDay: -7300, locationId: seat.id, factionId: house.id,
        factionRankIndex: i === 0 ? 4 : i === 10 ? 0 : 2 }), 3, 50));
    const roll = state.npcs.map(n => ({ id: n.id, rankIndex: n.factionRankIndex }));
    const heads = new Set(portfoliosIn({ locations: state.locations, sectId: house.id,
        roll, rankCount: house.ranks.length, npcs: state.npcs }).map(p => p.holderId));
    const elders = state.npcs.filter(n => n.factionRankIndex === 2 && !heads.has(n.id));
    for (const hour of [10, 15, 20]) {
        state.currentHour = hour;
        const clerk = whoDispensesAtTheHouse(state, house.id)?.id;
        const elder = elders.find(n => n.id !== clerk && routineOf(state, n).activity?.kind === 'the_work_of_their_rank'
            && !routineOf(state, n).home);
        if (elder) return { state, house, elder };
    }
    throw new Error('No unposted elder at ordinary rank work in this arrangement.');
}

it('opens an officeless elder at their own cultivation without inventing pupils', () => {
    const h = build();
    for (const roll of [0, .4, .9]) {
        const activity = whatTheyOpenAt({ npc: h.elder, groundKind: 'sect_seat',
            rungsInTheirHouse: h.house.ranks.length, onDay: h.state.currentDay, roll, words: .5, office: null });
        expect(activity.kind).toBe('the_work_of_their_rank');
        expect(activity.note).toMatch(/cultivating/i);
        expect(activity.withIds).toEqual([]);
    }
});

it('puts that idle work in the elder\'s assigned quarters, preserving the routine label', () => {
    const h = build();
    const before = JSON.stringify(h.state);
    const lodging = whichRoomARungGets(theLodgingsOfAHouse(h.state, h.house.id), h.elder.factionRankIndex);
    expect(lodging).not.toBeNull();
    expect(routineOf(h.state, h.elder).activity?.note).toBe('doing the work of their rank');
    expect(whereTheyAreStanding(h.state, whereCompoundsAre(h.state), h.elder,
        new Set(h.state.npcs.map(n => n.id)))).toBe(lodging!.locationId);
    expect(JSON.stringify(h.state)).toBe(before);
});

it('keeps actual crafting ahead of the idle private-work default', () => {
    const h = build();
    h.elder.activity = { kind: 'the_work_of_their_rank', note: 'Refining wound medicine.',
        thingId: MINOR_HEALING_PILL_ID, withIds: [], sinceDay: 50, untilDay: 51 };
    const before = JSON.stringify(h.elder);
    expect(routineOf(h.state, h.elder).activity?.thingId).toBe(MINOR_HEALING_PILL_ID);
    const rooms = h.state.locations.filter(room => ROOMS_A_THING_IS_MADE_IN.medicine
        .includes(room.data.purpose as never)).map(room => room.id);
    expect(rooms).toContain(whereTheyAreStanding(h.state, whereCompoundsAre(h.state), h.elder,
        new Set(h.state.npcs.map(n => n.id))));
    expect(JSON.stringify(h.elder)).toBe(before);
});
