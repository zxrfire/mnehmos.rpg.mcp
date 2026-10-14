/**
 * Private expeditions had no writer: every world party was on house business.
 * A private leader now uses the same route, work risk and actual ruin shelves,
 * but no house purse, stock or contribution. A deadline cannot collect finds
 * before the party reaches the ground, nor pass a real door it cannot open.
 * The owner's later ruling replaces automatic elder ownership: the actual
 * finder holds a find; an elder's allocation requires the personal bond.
 */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { undertakePrivateVenture, privateVenturesThisYear } from '../../../src/engine/world/private-ventures.js';
import { advancePublicCapitalMission } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { LEFT_WITH_THE_PLACE } from '../../../src/engine/world/what-a-ruin-has-on-its-shelves.js';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { bidAtCapitalAuction, settleCapitalAuctions, consignCapitalAuction } from '../../../src/engine/world/a-capital-auction.js';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import { putPrivateRequest } from '../../../src/engine/world/private-requests.js';
import { upsertRelationship, PLAYER_ROW_TAG, addGoal } from '../../../src/engine/world/npc-state.js';
import { createObligation } from '../../../src/engine/social/grudges.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';

function arrangement() {
    const world = createWorld({ seed: 'private-venture-world', regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'home', name: 'Home grounds', kind: 'sect_seat' });
    const ruin = makeLocation({ id: 'ruin', name: 'A discovered ruin', kind: 'ruin',
        thresholds: { entry: 0, survival: 0, operational: 0, mastery: 0 } });
    linkLocations(home, ruin, 'road', 4);
    world.locations.push(home, ruin);
    const house = makeFaction({ id: 'house', name: 'Home house', seatLocationId: home.id,
        ranks: ['Disciple', 'Inner', 'Elder', 'Head'], resources: { spirit_stones: 10000 } });
    world.factions.push(house);
    const leader = createNpc(world.seed, { id: 'leader', bornOnDay: -30 * 365, onDay: 0, locationId: home.id,
        factionId: house.id, factionRankIndex: 2, spiritStones: 10000, cultivation: { realmOrdinal: 20 } });
    const disciple = createNpc(world.seed, { id: 'disciple', bornOnDay: -20 * 365, onDay: 0, locationId: home.id,
        factionId: house.id, cultivation: { realmOrdinal: 3 } });
    leader.activity = null; disciple.activity = null;
    world.npcs.push(leader, disciple);
    world.objects.push(makeObject({ id: 'find', name: 'An abandoned blade', kind: 'artifact',
        locationId: ruin.id, tags: [LEFT_WITH_THE_PLACE] }));
    return { world, home, ruin, leader, disciple, house };
}

it('travels, works and returns through actual dates, retaining the find privately and earning no merit', () => {
    const h = arrangement(), priorMerit = meritWith(h.leader, h.house.id);
    const trip = undertakePrivateVenture(h.world, h.leader.id, h.ruin, [h.disciple], 0)!;
    expect(trip).not.toBeNull();
    expect(trip.factionIds).toEqual([]);
    expect(h.world.objects[0].possessorId).toBeNull();
    expect(locationOnNpcJourney(h.world.locations, h.world.npcs[0], 1)).not.toBe(h.ruin.id);
    advancePublicCapitalMission(h.world, h.leader.id, Number(trip.data.publicServiceEnd));
    expect([h.leader.id, h.disciple.id]).toContain(h.world.objects[0].possessorId);
    advancePublicCapitalMission(h.world, h.leader.id, Number(trip.data.plannedReturnDay));
    expect(h.world.npcs[0].locationId).toBe(h.home.id);
    expect(h.world.npcs[1].locationId).toBe(h.home.id);
    expect(meritWith(h.world.npcs[0], h.house.id)).toBe(priorMerit);
    expect(h.house.resources.spirit_stones).toBe(10000);
    expect(h.world.objects[0].ownerId).toBe(h.world.objects[0].possessorId);
});

it('a private request still meets the actual locked entrance and cannot fabricate the key', () => {
    const h = arrangement();
    h.ruin.data.keyId = 'real-key'; h.ruin.sealed = true;
    const purse = h.leader.spiritStones;
    expect(undertakePrivateVenture(h.world, h.leader.id, h.ruin, [h.disciple], 0)).toBeNull();
    expect(h.world.npcs[0].spiritStones).toBe(purse);
    expect(h.world.objects[0].possessorId).toBeNull();
});

it('a door closed during the journey stops work and leaves finds on their actual shelves', () => {
    const h = arrangement();
    const trip = undertakePrivateVenture(h.world, h.leader.id, h.ruin, [h.disciple], 0)!;
    h.ruin.data.keyId = 'real-key'; h.ruin.sealed = true;
    advancePublicCapitalMission(h.world, h.leader.id, Number(trip.data.plannedReturnDay));
    expect(h.world.objects[0].possessorId).toBeNull();
    expect(h.world.npcs[0].locationId).toBe(h.home.id);
    expect(h.world.history.facts.some(fact => fact.data.privateVentureBlocked === trip.id)).toBe(true);
});

it('a saved private itinerary resumes its work and pays no house contribution', () => {
    const h = arrangement();
    const trip = undertakePrivateVenture(h.world, h.leader.id, h.ruin, [h.disciple], 0)!;
    const db = new Database(':memory:');
    try {
        migrate(db);
        const repo = new WorldStateRepository(db);
        repo.saveWorld(h.world);
        const resumed = repo.loadWorld(h.world.id)!;
        advancePublicCapitalMission(resumed, h.leader.id, Number(trip.data.plannedReturnDay));
        expect([h.leader.id, h.disciple.id]).toContain(resumed.objects[0].ownerId);
        expect(resumed.npcs.find(person => person.id === h.leader.id)!.locationId).toBe(h.home.id);
        expect(meritWith(resumed.npcs[0], h.house.id)).toBe(0);
    } finally { db.close(); }
});

it('duplicate seats and stale member rows cannot silently price a different party', () => {
    const h = arrangement();
    expect(undertakePrivateVenture(h.world, h.leader.id, h.ruin, [h.disciple, h.disciple], 0)).toBeNull();
    h.world.npcs[1] = { ...h.disciple, activity: { kind: 'mending', note: 'Recovering.',
        withIds: [], sinceDay: 0, untilDay: 20 } };
    expect(undertakePrivateVenture(h.world, h.leader.id, h.ruin, [h.disciple], 0)).toBeNull();
});

it('the ordinary auction settlement bids for the elder who actually arrived', () => {
    let sales = 0;
    for (let seed = 0; seed < 20; seed++) {
        const h = arrangement(); h.world.seed = `private-auto-bid-${seed}`;
        h.ruin.kind = 'settlement';
        const seller = createNpc(h.world.seed, { id: 'seller', onDay: 0, bornOnDay: -20 * 365, locationId: h.ruin.id, spiritStones: 0 });
        h.world.npcs.push(seller);
        h.world.objects[0] = { ...h.world.objects[0], ownerId: seller.id, possessorId: seller.id };
        appendWorldFact(h.world, makeFact({ day: 1, kind: 'gathering', visibility: 'public', locationId: h.ruin.id,
            summary: 'A privately owned auction lot.', actors: [{ id: seller.id, name: seller.name, role: 'seller' }],
            data: { auctionLot: true, objectId: h.world.objects[0].id, sellerId: seller.id, payeeId: seller.id,
                reserve: 10, closesOnDay: 22 } }));
        undertakePrivateVenture(h.world, h.leader.id, h.ruin, [], 0, {
            venueId: h.ruin.id, hostId: h.house.id, kind: 'auction', opensOnDay: 1, onDay: 20, endsOnDay: 22 });
        advancePublicCapitalMission(h.world, h.leader.id, 20);
        settleCapitalAuctions(h.world, 22);
        if (h.world.objects[0].ownerId === h.leader.id) {
            sales++;
            expect(h.world.npcs[0].spiritStones + h.world.npcs[2].spiritStones).toBe(10000);
        }
        expect(h.house.resources.spirit_stones).toBe(10000);
    }
    expect(sales).toBeGreaterThan(0);
});

it('an actual owner naturally consigns an artifact and an arrived elder can bid for the thing it wants', () => {
    let listed = 0, bought = 0;
    for (let sample = 0; sample < 40; sample++) {
        const h = arrangement(); h.world.seed = `a-natural-private-artifact-${sample}`;
        h.ruin.kind = 'settlement';
        const seller = createNpc(h.world.seed, { id: `artifact-owner-${sample}`, onDay: 0, bornOnDay: -30 * 365,
            cultivation: { realmOrdinal: 20 }, locationId: h.ruin.id, spiritStones: 0 });
        seller.activity = null; h.world.npcs.push(seller);
        h.world.objects[0] = { ...h.world.objects[0], power: 2, ownerId: seller.id,
            ownerName: seller.name, possessorId: seller.id };
        h.world.npcs[0] = addGoal(h.world.npcs[0], { kind: 'discovery', priority: 1,
            targetId: h.world.objects[0].id, text: 'Acquire the actual artifact offered at the capital.' }, 0);
        const occasion = { venueId: h.ruin.id, hostId: h.house.id, kind: 'auction' as const,
            opensOnDay: 1, onDay: 20, endsOnDay: 22 };
        const trip = undertakePrivateVenture(h.world, h.leader.id, h.ruin, [], 0, occasion)!;
        expect(trip).not.toBeNull();
        consignCapitalAuction(h.world, occasion);
        const lot = h.world.history.facts.find(fact => fact.data.auctionLot && fact.data.objectId === h.world.objects[0].id);
        if (!lot) continue;
        listed++;
        advancePublicCapitalMission(h.world, h.leader.id, 20);
        const before = h.world.npcs[0].spiritStones;
        settleCapitalAuctions(h.world, 22);
        if (h.world.objects[0].ownerId !== h.leader.id) continue;
        bought++;
        const paid = before - h.world.npcs[0].spiritStones;
        expect(paid).toBeGreaterThan(0);
        expect(h.world.npcs.find(person => person.id === seller.id)!.spiritStones).toBe(paid);
        expect(h.world.objects[0].possessorId).toBe(h.leader.id);
        expect(h.house.resources.spirit_stones).toBe(10000);
    }
    expect(listed).toBeGreaterThan(0); expect(bought).toBeGreaterThan(0);
});

it('an elder actually reaches an auction and bids from their own purse', () => {
    const h = arrangement();
    h.ruin.kind = 'settlement';
    const seller = createNpc(h.world.seed, { id: 'seller', onDay: 0, bornOnDay: -30 * 365,
        locationId: h.ruin.id, spiritStones: 0 });
    h.world.npcs.push(seller);
    h.world.objects[0] = { ...h.world.objects[0], ownerId: seller.id, possessorId: seller.id };
    const lot = appendWorldFact(h.world, makeFact({ day: 1, kind: 'gathering', visibility: 'public', locationId: h.ruin.id,
        summary: 'An actual auction lot.', actors: [{ id: seller.id, name: seller.name, role: 'seller' }],
        data: { auctionLot: true, objectId: h.world.objects[0].id, sellerId: seller.id, payeeId: seller.id,
            reserve: 10, closesOnDay: 22 } }));
    const trip = undertakePrivateVenture(h.world, h.leader.id, h.ruin, [], 0, {
        venueId: h.ruin.id, hostId: h.house.id, kind: 'auction', opensOnDay: 1, onDay: 20, endsOnDay: 22 })!;
    expect(trip).not.toBeNull();
    expect(bidAtCapitalAuction(h.world, h.world.npcs[0], h.ruin.id, lot.id, 50, 1)).toBeNull();
    advancePublicCapitalMission(h.world, h.leader.id, 20);
    expect(bidAtCapitalAuction(h.world, h.world.npcs[0], h.ruin.id, lot.id, 50, 20)).not.toBeNull();
    settleCapitalAuctions(h.world, 22);
    expect(h.world.objects[0].ownerId).toBe(h.leader.id);
    expect(h.world.npcs.find(person => person.id === seller.id)!.spiritStones).toBe(50);
    expect(h.world.npcs[0].spiritStones).toBe(9950);
    expect(h.house.resources.spirit_stones).toBe(10000);
});

it('the annual producer reaches elders with an actual remembered route', () => {
    let departures = 0;
    for (let year = 0; year < 80; year++) {
        const h = arrangement();
        appendWorldFact(h.world, makeFact({ day: -1, kind: 'migration', visibility: 'secret',
            locationId: h.ruin.id, summary: 'The elder visited this ground.',
            actors: [{ id: h.leader.id, name: h.leader.name, role: 'visitor' }] }));
        departures += privateVenturesThisYear(h.world, year, 0).length;
    }
    expect(departures).toBeGreaterThan(0);
});

it('an elder who actually hears the plan can call in a favour for its own disciple through the real producer', () => {
    let asked = 0, taken = 0;
    for (let sample = 0; sample < 1000 && taken < 2; sample++) {
        const h = arrangement(); h.world.seed = `a-private-elder-favour-${sample}`;
        h.world.currentDay = 0; h.world.currentHour = 12;
        const going = createNpc(h.world.seed, { id: `going-${sample}`, locationId: h.home.id, factionId: h.house.id,
            factionRankIndex: 2, bornOnDay: -30 * 365, onDay: 0, spiritStones: 10000, cultivation: { realmOrdinal: 20 } });
        const other = createNpc(h.world.seed, { id: `other-${sample}`, locationId: h.home.id, factionId: h.house.id,
            factionRankIndex: 2, bornOnDay: -30 * 365, onDay: 0, spiritStones: 10000, cultivation: { realmOrdinal: 20 } });
        const junior = upsertRelationship(createNpc(h.world.seed, { id: `visiting-junior-${sample}`, locationId: h.home.id,
            factionId: h.house.id, bornOnDay: -20 * 365, onDay: 0, cultivation: { realmOrdinal: 3 } }),
            { targetId: other.id, targetName: other.name, kind: 'master', standing: 0.8 }, 0);
        h.world.npcs[0] = going; h.world.npcs.push(other, junior);
        const areas = theAreasOf(h.world, h.home).areas;
        const together = areas.find(area => area.for !== 'room')!.id;
        for (const person of [going, other, junior]) person.activity = { kind: 'talking', note: 'At the end of a conversation.',
            withIds: [], standingIn: together, sinceDay: 0, untilDay: 0.5 };
        h.world.npcs[1].activity = { kind: 'talking', note: 'Elsewhere.', withIds: [],
            standingIn: areas.find(area => area.id !== together)!.id, sinceDay: 0, untilDay: 0.5 };
        const favour = createObligation({ kind: 'favor', holderId: other.id, subjectId: going.id,
            cause: 'other', severity: 'slight', onDay: -1, description: 'An actual prior favour.' });
        h.world.obligations.push(favour);
        appendWorldFact(h.world, makeFact({ day: -1, kind: 'migration', visibility: 'secret', locationId: h.ruin.id,
            actors: [{ id: going.id, name: going.name, role: 'visited' }], summary: 'The elder has visited this ruin.' }));
        privateVenturesThisYear(h.world, sample, 0.5);
        const request = h.world.history.facts.find(fact => fact.data.privateRequest === true
            && fact.actors.some(actor => actor.id === other.id && actor.role === 'asked'));
        if (!request) continue;
        asked++;
        const announcement = h.world.history.facts.find(fact => fact.data.plannedPrivateVenture === true
            && fact.actors.some(actor => actor.id === going.id))!;
        expect(announcement.witnessIds).toContain(other.id);
        expect(h.world.obligations.find(word => word.id === favour.id)!.status).toBe(request.data.accepted ? 'settled' : 'open');
        const trip = h.world.history.facts.find(fact => fact.data.privateSponsorId === going.id && fact.data.publicMission);
        if (trip?.actors.some(actor => actor.id === junior.id)) {
            taken++;
            expect(h.world.npcs.find(person => person.id === junior.id)!.relationships
                .some(tie => tie.kind === 'master' && tie.targetId === other.id)).toBe(true);
            expect(trip.factionIds).toEqual([]);
            expect(h.house.resources.spirit_stones).toBe(10000);
        }
    }
    expect(asked).toBeGreaterThan(0); expect(taken).toBeGreaterThan(0);
});

it('ordinary invitations can be accepted or refused, preserve the personal bond and spend a held favour only on consent', () => {
    let accepted = 0, refused = 0;
    for (let seed = 0; seed < 80; seed++) {
        const h = arrangement(); h.world.seed = `private-request-${seed}`;
        h.world.npcs[0] = upsertRelationship(h.leader, { targetId: h.disciple.id, targetName: h.disciple.name,
            kind: 'disciple', standing: 0.5 }, 0);
        h.world.npcs[1] = upsertRelationship(h.disciple, { targetId: h.leader.id, targetName: h.leader.name,
            kind: 'master', standing: 0.5 }, 0);
        for (const person of h.world.npcs) person.activity = { kind: 'talking', note: 'Discussing an expedition.',
            withIds: h.world.npcs.filter(other => other.id !== person.id).map(other => other.id), sinceDay: 0, untilDay: 1 };
        const favour = createObligation({ kind: 'favor', holderId: h.leader.id, subjectId: h.disciple.id,
            cause: 'other', severity: 'slight', onDay: 0, description: 'An existing favour.' });
        h.world.obligations.push(favour);
        const consent = putPrivateRequest(h.world, h.world.npcs[0], h.world.npcs[1], 0.5, 'Asked to come along.', 'invitation-control');
        if (consent) accepted++; else refused++;
        expect(h.world.obligations.find(term => term.id === favour.id)!.status).toBe(consent ? 'settled' : 'open');
        expect(h.world.npcs[1].relationships.some(tie => tie.targetId === h.leader.id && tie.kind === 'master')).toBe(true);
        expect(h.world.history.facts.find(fact => fact.data.privateRequest === true)!.data.attentionDays).toBeGreaterThan(0);
    }
    expect(accepted).toBeGreaterThan(0); expect(refused).toBeGreaterThan(0);
});

it('a private invitation cannot answer for a human player or reach a closed door', () => {
    const h = arrangement();
    h.disciple.tags.push(PLAYER_ROW_TAG);
    expect(putPrivateRequest(h.world, h.leader, h.disciple, 0.5, 'Asked to come along.', 'human-control')).toBe(false);
    expect(h.world.history.facts).toHaveLength(0);
    h.disciple.tags = [];
    h.disciple.activity = { kind: 'closed_door_cultivation', note: 'Closed-door cultivation.',
        withIds: [], sinceDay: 0, untilDay: 100 };
    expect(putPrivateRequest(h.world, h.leader, h.disciple, 0.5, 'Asked to come along.', 'door-control')).toBe(false);
    expect(h.world.history.facts).toHaveLength(0);
});
