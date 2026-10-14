/**
 * On apex-halls-before-elaboration, after ordinary staffing, the three apexes
 * had 10, 5 and 3 arrived workers across seven halls; none had an officeless
 * elder. Six Li had two workers across five halls. The owner requires deeper
 * institutions, one head per hall, and elders available to ask for help.
 * Raising a larger roll must not re-deal any existing chair or remove a seat.
 * The paired pre-change measurement saved all 40 houses' actual chairs/ranks.
 */
import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APEX_INSTITUTIONS } from '../../../src/data/cultivation/governance-and-water-rights.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { portfoliosIn } from '../../../src/engine/social-leverage/authority-for-an-order.js';
import { theOneIdAPersonIsKnownBy } from '../../../src/engine/world/a-catalog-person-and-their-world-row.js';
import { hallResponsibilities } from '../../../src/engine/world/a-house-gives-one-elder-each-hall.js';
import { hallStaffingDepth, theRollItsHallsNeed } from '../../../src/engine/world/a-house-keeps-the-staff-it-can-support.js';
import { houseAppointment } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work.js';
import { hallForRoom } from '../../../src/engine/world/house-halls.js';
import { purposeOf, type RoomPurpose } from '../../../src/engine/world/architecture.js';
import { whenTheyReachTheirPost } from '../../../src/engine/world/places-on-the-way.js';
import { whoDecidesIn } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/hall-incumbents-before-apex-workforce-20261014.json', import.meta.url), 'utf8')) as {
    seed: string; day: number; houses: { id: string; incumbentChairs: { hallId: string; holderId: string | null }[];
        incumbentRanks: { id: string; rankIndex: number }[] }[] };
let world: WorldState;
beforeAll(async () => { world = seedWorld({ catalog: await loadCultivationCatalog(), seed: baseline.seed }).state; }, 120_000);
function workers(houseId: string, hallId: string): number {
    return world.npcs.filter(person => person.status === 'alive' && person.factionId === houseId
        && person.activity?.kind === 'stationed' && !person.activity.redirect && !person.activity.houseCareFactId
        && (whenTheyReachTheirPost(world.locations, person) ?? Infinity) <= world.currentDay
        && hallForRoom((houseAppointment(world, person)?.data.workPurpose
            ?? purposeOf(world.locations.find(place => place.id === person.locationId)!)) as RoomPurpose)?.id === hallId).length;
}
function elders(houseId: string) {
    const house = world.factions.find(row => row.id === houseId)!;
    return whoDecidesIn({ roll: world.npcs.filter(person => person.status === 'alive' && person.factionId === houseId)
        .map(person => ({ id: person.id, rankIndex: person.factionRankIndex })), rankCount: house.ranks.length }).filter(person => !person.isHead);
}

it('works every apex hall with more real people and keeps elders beyond the hall chairs', () => {
    const ordinary = 'sect-six-li-patrol';
    const ordinaryHalls = hallResponsibilities(world, ordinary);
    for (const apex of APEX_INSTITUTIONS) {
        const houseId = apex.factionId;
        if (!houseId) throw new Error('A seated apex needs a faction.');
        const halls = hallResponsibilities(world, houseId);
        expect(halls.length).toBeGreaterThan(ordinaryHalls.length);
        expect(elders(houseId).length).toBeGreaterThan(elders(ordinary).length);
        const heads = new Set(halls.map(hall => hall.holderId));
        expect(elders(houseId).some(elder => !heads.has(elder.id))).toBe(true);
        for (const hall of halls) {
            expect(hall.holderId, `${apex.factionId}/${hall.hall.id}`).toBeTruthy();
            expect(workers(houseId, hall.hall.id), `${apex.factionId}/${hall.hall.id}`).toBeGreaterThan(workers(ordinary, hall.hall.id));
        }
        const rooms = new Set(world.locations.filter(room => room.data.factionId === houseId).map(purposeOf));
        for (const room of ['audience_hall', 'scripture_pavilion', 'archive', 'treasury', 'infirmary', 'alchemy_hall', 'furnace_room', 'artifact_refining_hall'])
            expect(rooms.has(room as RoomPurpose), `${apex.factionId}/${room}`).toBe(true);
    }
});

it('keeps every pre-existing member seat and every pre-existing hall head', () => {
    for (const house of baseline.houses) {
        const halls = hallResponsibilities(world, house.id);
        for (const previous of house.incumbentChairs)
            expect(halls.find(hall => hall.hall.id === previous.hallId)?.holderId, `${house.id}/${previous.hallId}`).toBe(previous.holderId);
        for (const previous of house.incumbentRanks) {
            const person = world.npcs.find(row => row.id === previous.id)!;
            expect(person.factionId, previous.id).toBe(house.id);
            expect(person.factionRankIndex, previous.id).toBe(previous.rankIndex);
        }
    }
});

it('needs the actual reserve of stones rather than an apex label to fund deeper work', () => {
    const houseId = APEX_INSTITUTIONS[0]!.factionId;
    if (!houseId) throw new Error('A seated apex needs a faction.');
    const house = world.factions.find(row => row.id === houseId)!;
    const original = house.resources.spirit_stones;
    expect(hallStaffingDepth(world, house.id)).toBeGreaterThan(1);
    house.resources.spirit_stones = 0;
    try {
        expect(hallStaffingDepth(world, house.id)).toBe(1);
        expect(theRollItsHallsNeed(world, house.id).people).toBe(0);
    } finally { house.resources.spirit_stones = original; }
});

it('reads the same incumbent through catalog IDs and actual world IDs', () => {
    for (const house of world.factions) {
        const members = world.npcs.filter(person => person.status === 'alive' && person.factionId === house.id);
        const portfolios = portfoliosIn({ locations: world.locations, npcs: world.npcs, sectId: house.id,
            rankCount: house.ranks.length, roll: members.map(person => ({ id: theOneIdAPersonIsKnownBy(person.id), rankIndex: person.factionRankIndex })) });
        for (const actual of hallResponsibilities(world, house.id)) {
            const held = portfolios.find(row => row.hallId === actual.hall.id)!;
            expect(held.holderId && theOneIdAPersonIsKnownBy(held.holderId), `${house.id}/${actual.hall.id}`)
                .toBe(actual.holderId && theOneIdAPersonIsKnownBy(actual.holderId));
            expect(held.purpose).toBe(actual.room);
        }
    }
});

it('lets the surviving claimant take a vacated hall without removing their elder seat', () => {
    for (const house of world.factions) {
        const hall = hallResponsibilities(world, house.id).find(row => row.holderId
            && row.existingClaimants.some(id => id !== row.holderId));
        if (!hall) continue;
        const before = new Map(world.npcs.map(person => [person.id, person.factionRankIndex]));
        const departed = { ...world, npcs: world.npcs.map(person => person.id === hall.holderId ? { ...person, factionId: null } : person) };
        const successor = hallResponsibilities(departed, house.id).find(row => row.hall.id === hall.hall.id)!;
        expect(successor.holderId).not.toBe(hall.holderId);
        expect(hall.existingClaimants).toContain(successor.holderId);
        expect(departed.npcs.find(person => person.id === successor.holderId)?.factionRankIndex)
            .toBe(before.get(successor.holderId!));
        return;
    }
    throw new Error('The baseline must contain a hall with two existing claimants.');
});
