/**
 * Every world party used to be house work, although people can choose their
 * own company. These controls require ordinary consent, a real paid itinerary,
 * lateral sworn kin and the same oath ledger. A close client or acquaintance
 * counts as company; changing its relationship label must not erase the bond.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { swearBrotherhood, swornSiblingsOf, recordSwornBrotherhood, privateCompanyCandidates,
    formPrivateParty, closePeopleThisYear } from '../../../src/engine/world/close-people-go-together.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { heirsOf, generationOf } from '../../../src/engine/world/lineage.js';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { advancePublicCapitalMission } from '../../../src/engine/world/capital-missions-and-calendar.js';

function arrangement(seed: number) {
    const world = createWorld({ seed: `close-company-${seed}`, regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'home', name: 'Home grounds', kind: 'wilds' });
    const ruin = makeLocation({ id: 'ruin', name: 'The known ruin', kind: 'ruin',
        thresholds: { entry: 0, survival: 0, operational: 0, mastery: 0 } });
    linkLocations(home, ruin, 'road', 2);
    world.locations.push(home, ruin);
    const leader = createNpc(world.seed, { id: `leader-${seed}`, name: 'The leader', locationId: home.id,
        onDay: 0, bornOnDay: -30 * 365, spiritStones: 10000, cultivation: { realmOrdinal: 10 } });
    const friend = createNpc(world.seed, { id: `friend-${seed}`, name: 'The close client', locationId: home.id,
        onDay: 0, bornOnDay: -30 * 365, spiritStones: 100, cultivation: { realmOrdinal: 10 } });
    leader.activity = null; friend.activity = null; world.npcs.push(leader, friend);
    world.npcs[0] = upsertRelationship(leader, { targetId: friend.id, targetName: friend.name, kind: 'client', standing: 0.9 }, 0);
    world.npcs[1] = upsertRelationship(friend, { targetId: leader.id, targetName: leader.name, kind: 'patron', standing: 0.9 }, 0);
    const area = theAreasOf({ ...world, currentHour: 12 }, home).whereIs.get(leader.id)!;
    for (const person of world.npcs) person.activity = { kind: 'talking', note: 'Meeting their close company.',
        standingIn: area, sinceDay: 0, untilDay: 0.5, withIds: [] };
    return { world, home, ruin, leaderId: leader.id, friendId: friend.id };
}

it('world people can accept or refuse brotherhood, and an accepted bond writes mutual oaths and lateral kin', () => {
    let accepted = 0, refused = 0;
    for (let seed = 0; seed < 64; seed++) {
        const h = arrangement(seed);
        if (!swearBrotherhood(h.world, h.leaderId, h.friendId, 0.5)) { refused++; continue; }
        accepted++;
        const words = h.world.obligations.filter(word => word.cause === 'sworn_brotherhood');
        expect(words).toHaveLength(2);
        expect(new Set(words.map(word => word.holderId))).toEqual(new Set([h.leaderId, h.friendId]));
        expect(swornSiblingsOf(h.world, h.leaderId).has(h.friendId)).toBe(true);
        expect(swornSiblingsOf(h.world, h.friendId).has(h.leaderId)).toBe(true);
        expect(generationOf(h.world.lineages[0], h.friendId)).toBe(0);
        expect(heirsOf(h.world.lineages[0], h.friendId).some(heir => heir.id === h.leaderId && heir.relation === 'sworn_sibling')).toBe(true);
        expect(swearBrotherhood(h.world, h.leaderId, h.friendId, 0.5)).toBe(false);
        expect(h.world.obligations.filter(word => word.cause === 'sworn_brotherhood')).toHaveLength(2);
        expect(h.world.npcs[0].relationships.find(tie => tie.targetId === h.friendId)!.kind).toBe('client');
    }
    expect(accepted).toBeGreaterThan(0); expect(refused).toBeGreaterThan(0);
});

it('close people of any tie count, and sworn siblings are asked first', () => {
    const h = arrangement(100);
    expect(privateCompanyCandidates(h.world, h.world.npcs[0], 0.5).map(person => person.id)).toContain(h.friendId);
    const sibling = createNpc(h.world.seed, { id: 'sibling', name: 'A sworn sibling', locationId: h.home.id,
        onDay: 0, bornOnDay: -30 * 365, cultivation: { realmOrdinal: 10 } });
    sibling.activity = { ...h.world.npcs[0].activity!, untilDay: 0.5 };
    h.world.npcs.push(sibling);
    recordSwornBrotherhood(h.world, h.world.npcs[0], sibling, 0.5);
    expect(privateCompanyCandidates(h.world, h.world.npcs[0], 0.5)[0].id).toBe(sibling.id);
});

it('an equal rogue party pays from its leader, reaches the actual ruin and returns without house merit', () => {
    let followed = false;
    for (let seed = 0; seed < 40; seed++) {
        const h = arrangement(seed);
        const before = h.world.npcs[0].spiritStones;
        const party = formPrivateParty(h.world, h.leaderId, h.ruin, [h.friendId], 0.5);
        if (!party) continue;
        followed = true;
        expect(party.actors.map(actor => actor.id)).toContain(h.friendId);
        expect(party.data.privateSponsorId).toBe(h.leaderId);
        expect(h.world.factions).toHaveLength(0);
        // Walking has no fare. The actual quote, including zero, decides it.
        expect(h.world.npcs[0].spiritStones).toBe(before - Number(party.data.publicFareStones));
        for (let day = 1; day <= 160; day += 0.25) advancePublicCapitalMission(h.world, h.leaderId, day);
        for (const person of h.world.npcs) {
            expect(person.locationId).toBe(h.home.id);
            expect(person.activity?.capitalMissionId).toBeUndefined();
            expect(meritWith(person, 'any-house')).toBe(0);
        }
        break;
    }
    expect(followed).toBe(true);
});

it('the actual rate producer forms private company and sworn bonds without a house roll', () => {
    let parties = 0, bonds = 0;
    for (let seed = 0; seed < 160; seed++) {
        const h = arrangement(seed), day = 60.5;
        h.world.currentDay = 60; h.world.currentHour = 12;
        for (const person of h.world.npcs) person.activity = { ...person.activity!, untilDay: day };
        appendWorldFact(h.world, makeFact({ day: -1, kind: 'migration', visibility: 'secret', locationId: h.ruin.id,
            actors: [{ id: h.leaderId, name: 'The leader', role: 'visitor' }], summary: 'The leader visited the ruin.' }));
        parties += closePeopleThisYear(h.world, 0, day).length;
        bonds += h.world.obligations.filter(word => word.cause === 'sworn_brotherhood').length;
        expect(h.world.factions).toHaveLength(0);
    }
    expect(parties).toBeGreaterThan(0); expect(bonds).toBeGreaterThan(0);
});
