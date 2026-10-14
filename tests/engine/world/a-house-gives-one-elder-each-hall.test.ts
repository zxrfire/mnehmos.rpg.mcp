import { MEMBERS } from '../../../src/data/cultivation/members';
import { theOneIdAPersonIsKnownBy, worldIdForCatalogPerson } from '../../../src/engine/world/a-catalog-person-and-their-world-row';
/** Grouping seven old office slots produces five groups, with two collisions.
 * One head is chosen by the existing chair order; losing the hall is no demotion.
 * Newly appended discipline rooms must not move the older single-hall claimants. */
import { expect, it } from 'vitest';
import { growCompound, type CompoundInput } from '../../../src/engine/world/architecture';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state';
import { makeLocation } from '../../../src/engine/world/locations';
import { hallResponsibilities } from '../../../src/engine/world/a-house-gives-one-elder-each-hall';
import { hallsForRooms } from '../../../src/engine/world/house-halls';
import { portfoliosIn, whetherTheyMayGiveThisOrder, theRoomsThisHouseHas } from '../../../src/engine/social-leverage/authority-for-an-order';
import { whoAnswersAbout, whoIsInChargeOfWhat } from '../../../src/engine/social-leverage/what-an-elder-is-in-charge-of';

function arranged(over: Partial<CompoundInput> = {}) {
    const input: CompoundInput = { factionId: 'house', factionName: 'Reed House',
        ranks: ['Outer Disciple', 'Inner Disciple', 'Elder', 'Grand Elder', 'Head'], admissionOrdinal: 3,
        powerOrdinal: 30, recruits: true, alignment: 'neutral', reliableOrdinal: 20,
        formationIntegrity: .5, formationNodesTotal: 20, formationNodesLit: 10, inherited: true,
        holdsVein: true, tributeStonesPerYear: 1, sealedCeilingOrdinal: 30,
        preferredRoots: [], teachesElements: ['metal'], specialities: ['attack'], ...over };
    const state = createWorld({ seed: 'one-elder-each-hall', regionCount: 0, skipPriorAges: true });
    const seat = makeLocation({ id: 'seat', name: input.factionName, kind: 'sect_seat' });
    state.locations = [seat, ...growCompound(seat, input, { seed: state.seed, presentDay: 0 }).locations];
    const house = makeFaction({ id: input.factionId, name: input.factionName, ranks: input.ranks, seatLocationId: seat.id });
    state.factions.push(house);
    state.npcs = Array.from({ length: 5 }, (_, i) => setRealm(createNpc(state.seed, { id: `member-${i}`,
        onDay: 0, bornOnDay: -7300, locationId: seat.id, factionId: house.id,
        factionRankIndex: i === 0 ? 4 : 2 }), 3, 0));
    const rooms = theRoomsThisHouseHas(state.locations, house.id);
    const roll = state.npcs.map(person => ({ id: person.id, rankIndex: person.factionRankIndex }));
    return { state, house, rooms, roll };
}

it('chooses one head from colliding claims without taking either elder seat', () => {
    const h = arranged();
    const legacy = whoIsInChargeOfWhat({ rooms: h.rooms, roll: h.roll, rankCount: h.house.ranks.length });
    const first = legacy.find(portfolio => portfolio.purpose === 'treasury')!.holderId!;
    const second = legacy.find(portfolio => portfolio.purpose === 'tribute_room')!.holderId!;
    expect(first).not.toBe(second);
    const strongerAt = h.state.npcs.findIndex(person => person.id === second);
    h.state.npcs[strongerAt] = setRealm(h.state.npcs[strongerAt]!, 30, 0);
    const before = JSON.stringify(h.state);
    const halls = hallResponsibilities(h.state, h.house.id);
    const treasury = halls.find(read => read.hall.id === 'treasury')!;
    expect(treasury.holderId).toBe(second);
    expect(treasury.existingClaimants).toEqual(expect.arrayContaining([first, second]));
    expect(new Set(halls.map(read => read.hall.id)).size).toBe(halls.length);
    expect(JSON.stringify(h.state)).toBe(before);
    expect(h.state.npcs.find(person => person.id === first)!.factionRankIndex).toBe(2);
});

it('keeps earlier single-hall claimants when discipline ground is appended', () => {
    const h = arranged({ recruits: false, tributeStonesPerYear: 0, sealedCeilingOrdinal: 0 });
    const earlier = whoIsInChargeOfWhat({ rooms: h.rooms.filter(room => room !== 'punishment_hall'),
        roll: h.roll, rankCount: h.house.ranks.length });
    const halls = hallResponsibilities(h.state, h.house.id);
    for (const portfolio of earlier) {
        expect(halls.find(read => read.room === portfolio.purpose)?.holderId).toBe(portfolio.holderId);
    }
    expect(halls.find(read => read.hall.id === 'discipline')?.holderId).toBeTruthy();
});

it('adds no hall where its rooms are absent and lets a small house cover several', () => {
    const h = arranged({ powerOrdinal: 3, holdsVein: false, tributeStonesPerYear: 0,
        sealedCeilingOrdinal: 0, inherited: false, recruits: false, formationIntegrity: .1,
        formationNodesTotal: 0, formationNodesLit: 0 });
    h.state.npcs = h.state.npcs.filter(person => person.factionRankIndex === 4);
    const halls = hallResponsibilities(h.state, h.house.id);
    expect(halls.map(read => read.hall.id)).toEqual(hallsForRooms(h.rooms).map(hall => hall.id));
    for (const id of ['treasury', 'alchemy', 'artifact']) expect(halls.some(read => read.hall.id === id)).toBe(false);
    expect(halls.length).toBeGreaterThan(1);
    expect(new Set(halls.map(read => read.holderId)).size).toBe(1);
});

it('the actual authority reader gives both treasury rooms to one head and leaves private rooms private', () => {
    const h = arranged();
    const old = whoIsInChargeOfWhat({ rooms: h.rooms, roll: h.roll, rankCount: h.house.ranks.length });
    const stronger = old.find(portfolio => portfolio.purpose === 'tribute_room')!.holderId!;
    const at = h.state.npcs.findIndex(person => person.id === stronger);
    h.state.npcs[at] = setRealm(h.state.npcs[at]!, 30, 0);
    const portfolios = portfoliosIn({ locations: h.state.locations, sectId: h.house.id,
        roll: h.roll, rankCount: h.house.ranks.length, npcs: h.state.npcs });
    for (const room of ['treasury', 'tribute_room'] as const) {
        expect(whoAnswersAbout(portfolios, room)).toBe(stronger);
        expect(whetherTheyMayGiveThisOrder({ claim: 'delegated', giverId: stronger,
            portfolios, under: room }).legitimate).toBe(true);
    }
    expect(whoAnswersAbout(portfolios, 'residence')).toBeNull();
    expect(portfolios.filter(portfolio => portfolio.hallId === 'treasury')).toHaveLength(1);
});

it('reads the supplied member seat even while the world mirror still has its former rank', () => {
    const h = arranged();
    const head = h.state.npcs[0]!;
    head.factionRankIndex = 0;
    const portfolios = portfoliosIn({ locations: h.state.locations, sectId: h.house.id,
        roll: h.roll, rankCount: h.house.ranks.length, npcs: h.state.npcs });
    expect(portfolios.some(portfolio => portfolio.holderId === head.id)).toBe(true);
    expect(head.factionRankIndex).toBe(0);
});

it('a small house keeps its purse and care work without inventing the absent dedicated halls', () => {
    const h = arranged({ powerOrdinal: 3, holdsVein: false, tributeStonesPerYear: 0,
        sealedCeilingOrdinal: 0, inherited: false, recruits: false, formationIntegrity: .1,
        formationNodesTotal: 0, formationNodesLit: 0 });
    const head = h.state.npcs[0]!;
    const portfolios = portfoliosIn({ locations: h.state.locations, sectId: h.house.id,
        roll: h.roll, rankCount: h.house.ranks.length, npcs: h.state.npcs });
    expect(portfolios.some(portfolio => portfolio.hallId === 'treasury')).toBe(false);
    expect(whoAnswersAbout(portfolios, 'treasury')).toBe(head.id);
    expect(whetherTheyMayGiveThisOrder({ claim: 'delegated', giverId: head.id,
        portfolios, under: 'treasury' }).legitimate).toBe(true);
    expect(portfolios.some(portfolio => portfolio.hallId === 'alchemy')).toBe(false);
    expect(whoAnswersAbout(portfolios, 'infirmary')).toBe(whoAnswersAbout(portfolios, 'life_lamp_hall'));
    expect(whoAnswersAbout(portfolios, 'alchemy_hall')).toBeNull();
});

it('uses the same stronger chair for a catalog roster and its actual world rows', () => {
    const h = arranged();
    h.state.npcs = h.state.npcs.map((person, i) => ({ ...person, id: worldIdForCatalogPerson(MEMBERS[i]!.id) }));
    const roll = h.state.npcs.map(person => ({ id: theOneIdAPersonIsKnownBy(person.id), rankIndex: person.factionRankIndex }));
    const old = whoIsInChargeOfWhat({ rooms: h.rooms, roll, rankCount: h.house.ranks.length });
    const stronger = old.find(portfolio => portfolio.purpose === 'tribute_room')!.holderId!;
    const at = h.state.npcs.findIndex(person => theOneIdAPersonIsKnownBy(person.id) === stronger);
    h.state.npcs[at] = setRealm(h.state.npcs[at]!, 30, 0);
    const portfolios = portfoliosIn({ locations: h.state.locations, sectId: h.house.id,
        roll, rankCount: h.house.ranks.length, npcs: h.state.npcs });
    expect(whoAnswersAbout(portfolios, 'treasury')).toBe(stronger);
    expect(whoAnswersAbout(portfolios, 'tribute_room')).toBe(stronger);
});
