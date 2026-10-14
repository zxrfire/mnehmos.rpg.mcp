/**
 * Native private ventures excluded the player's SQL row, so the elder could
 * take every personal disciple except the person being played. These controls
 * arrange an actual invitation, then play consent and the ordinary held span.
 * The sponsor's quote admits the real body once, never answers for the human,
 * and leaves the player at the leader's reached ground when they leave.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { makeLocation, linkLocations } from '../../src/engine/world/locations';
import { createNpc, upsertRelationship } from '../../src/engine/world/npc-state';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { invitePlayerToPrivateParty, departAfterPrivateInvitations } from '../../src/engine/world/a-private-party-invites-the-player';
import { withPrivatePlayerContact } from '../../src/web/joining-a-private-party';
import { followedParty } from '../../src/web/following-the-party-leader';
import { factsWithDataValue } from '../../src/engine/world/witness-reaction-index';
import { playerAtTheContact } from '../../src/engine/world/background-incident-draw';
import { stoppedRoadFor } from '../../src/web/a-road-stopped-partway';
import { makeObject } from '../../src/engine/world/possessions';
import { addToPouch, pouchQuantity } from '../../src/storage/cultivator-pouch';
import { thePlayerReceivesPrivatePartyFinds } from '../../src/web/the-player-receives-a-private-party-find';
import { faceOf } from '../../src/engine/world/what-a-face-is-worth';
import { capitalCalendar } from '../../src/engine/world/capital-missions-and-calendar';

async function prepared(kind: 'elder' | 'equals' = 'elder', auctionVisit = false) {
    const h = await makeGameInWorld({ seed: 'private-player-venture', worldSeed: 'private-player-venture-world' });
    const { cultivator } = await h.game.newRun('Pupil');
    const world = h.game.atHand!, day = routineTime(world);
    const home = makeLocation({ id: 'private-player-home', name: 'Pupil Court', kind: 'settlement' });
    const ruin = makeLocation({ id: 'private-player-ruin', name: 'The Open Archive', kind: auctionVisit ? 'settlement' : 'ruin',
        tags: auctionVisit ? ['city'] : [],
        thresholds: { entry: 0, survival: 0, operational: 0, mastery: 0 } });
    linkLocations(home, ruin, 'road', 2);
    world.locations.push(home, ruin);
    let area = theAreasOf(world, home).areas[0].id;
    const elder = createNpc(world.seed, { id: 'the-private-master', name: 'Master Liang', onDay: day,
        bornOnDay: day - 30 * 365, locationId: home.id, spiritStones: 10000,
        cultivation: { realmOrdinal: 20 } });
    elder.activity = { kind: 'their_own_business', standingIn: area, note: 'At home.', withIds: [], sinceDay: day };
    world.npcs.push(elder);
    area = theAreasOf(world, home).whereIs.get(elder.id)!;
    const at = world.npcs.findIndex(person => person.id === cultivator.id);
    world.npcs[at] = upsertRelationship(world.npcs[at], { targetId: elder.id, targetName: elder.name,
        kind: 'master', standing: 0.9, factIds: [] }, day);
    h.game.repos.cultivators.update(cultivator.id, { location: home.name, standingIn: area });
    h.game.repos.cultivators.standIn(cultivator.id, area);
    const body = h.game.currentRun().cultivator;
    const auction = auctionVisit ? capitalCalendar(world, Math.floor(day / 365)).find(occasion =>
        occasion.kind === 'auction' && occasion.venueId === ruin.id && occasion.onDay > day) : undefined;
    if (auctionVisit) expect(auction).toBeDefined();
    const read = withPrivatePlayerContact(h.game, body, () => ({
        offer: invitePlayerToPrivateParty(world, elder, body.id, ruin.id, day, kind, [], auction?.onDay),
        contact: playerAtTheContact(world), area, actualArea: theAreasOf(world, home).whereIs.get(elder.id)
    }));
    const offer = read.offer;
    expect(offer, JSON.stringify(read)).not.toBeNull();
    h.game.theWorldMoved();
    return { ...h, world, home, ruin, elder, offer: offer!, body };
}

describe('a personal disciple joins a private venture', () => {
    it('shows the real invitation without admitting a silent human', async () => {
        const h = await prepared();
        const look = await h.game.act('look around');
        expect(look.narration).toContain('Do you accept?');
        expect(followedParty(h.db, h.game.atHand!, h.body.id)).toBeNull();
        expect(factsWithDataValue(h.game.atHand!, 'privatePartyReply', h.offer.id)).toHaveLength(0);
    });
    it('declines without a fare or accepted itinerary', async () => {
        const h = await prepared(), stones = h.elder.spiritStones;
        const answer = await h.game.act('I decline the private expedition invitation');
        expect(answer.narration).toContain('declined');
        expect(followedParty(h.db, h.game.atHand!, h.body.id)).toBeNull();
        expect(h.game.atHand!.npcs.find(person => person.id === h.elder.id)!.spiritStones).toBe(stones);
    });
    it('accepts one real quoted itinerary, follows it and can leave at reached ground', async () => {
        const h = await prepared(), before = h.game.state().cultivator.spiritStones;
        const answer = await h.game.act('I accept the private expedition invitation');
        expect(answer.narration).toContain('joined the private party');
        const party = followedParty(h.db, h.game.atHand!, h.body.id)!;
        expect(party).not.toBeNull();
        expect(party.itinerary.data.privateSponsorId).toBe(h.elder.id);
        expect(party.itinerary.factionIds).toEqual([]);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        expect(h.game.atHand!.npcs.find(person => person.id === h.body.id)!.locationId).toBeNull();
        const waited = await h.game.act('I wait 1 day');
        expect(h.game.state().run.elapsedDays).toBeGreaterThan(0);
        expect(waited.narration).not.toMatch(/paid.*fare/);
        await h.game.act('I leave the party');
        expect(followedParty(h.db, h.game.atHand!, h.body.id)).toBeNull();
        const stopped = stoppedRoadFor(h.db, h.game.state().cultivator, h.game.atHand!);
        expect(stopped?.position?.kind).toBe('edge');
        expect(stopped!.walked).toBeGreaterThan(0);
        expect(stopped!.walked).toBeLessThan(stopped!.road);
    }, 120000);
    it('does not accept an absent leader or charge a refused quote', async () => {
        const h = await prepared();
        h.game.atHand!.npcs.find(person => person.id === h.elder.id)!.locationId = h.ruin.id;
        h.game.theWorldMoved();
        const answer = await h.game.act('I accept the private expedition invitation');
        expect(answer.narration).toMatch(/leader must still be here|No invitation|no longer|cannot depart/);
        expect(followedParty(h.db, h.game.atHand!, h.body.id)).toBeNull();
    });
    it('silence ends the ordinary discussion window without holding the elder forever', async () => {
        const h = await prepared(), location = h.body.location;
        const due = Number(h.offer.data.respondByDay);
        departAfterPrivateInvitations(h.world, due);
        const departure = factsWithDataValue(h.world, 'privatePartyDeparture', h.offer.id)[0];
        expect(departure.data.itineraryFactId).toBeTypeOf('string');
        const trip = h.world.history.facts.find(fact => fact.id === departure.data.itineraryFactId)!;
        expect(trip.actors.some(actor => actor.id === h.body.id)).toBe(false);
        expect(h.game.state().cultivator.location).toBe(location);
        expect(followedParty(h.db, h.world, h.body.id)).toBeNull();
        departAfterPrivateInvitations(h.world, due + 1);
        expect(factsWithDataValue(h.world, 'privatePartyDeparture', h.offer.id)).toHaveLength(1);
    });
    it('a personal pupil accompanies the elder to the actual upcoming auction', async () => {
        const h = await prepared('elder', true), before = h.body.spiritStones;
        const accepted = await h.game.act('I accept the private auction visit invitation');
        const party = followedParty(h.db, h.game.atHand!, h.body.id)!;
        expect(party, accepted.narration).not.toBeNull();
        const occasion = capitalCalendar(h.game.atHand!, Math.floor(h.offer.day / 365)).find(occasion =>
            occasion.kind === 'auction' && occasion.venueId === h.ruin.id && occasion.onDay === h.offer.data.auctionOnDay)!;
        expect(party.itinerary.data.publicServiceEnd).toBe(occasion.endsOnDay + 1);
        expect(party.itinerary.data.privateSponsorId).toBe(h.elder.id);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        const travelled = await h.game.act('I wait 3 days');
        expect(h.game.state().cultivator.location, travelled.narration).toBe(h.ruin.name);
        expect(followedParty(h.db, h.game.atHand!, h.body.id)?.leader.id).toBe(h.elder.id);
    }, 120000);
    it.each(['elder', 'equals'] as const)('%s allocation follows an actual player pickup and reconciles only its new dose', async kind => {
        const h = await prepared(kind);
        addToPouch(h.db, h.body.id, 'pill-qi-gathering', 'pill', 2);
        await h.game.act('I accept the private party invitation');
        const world = h.game.atHand!, face = faceOf(world.npcs.find(person => person.id === h.elder.id)!);
        world.objects.push(makeObject({ id: 'a-private-player-pickup', name: 'Dropped Qi Gathering Pill',
            kind: 'pill', locationId: h.home.id, data: { pillId: 'pill-qi-gathering', quantity: 1 } }));
        h.game.theWorldMoved();
        const take = await h.game.act('I pick up Dropped Qi Gathering Pill from the ground');
        const pickup = factsWithDataValue(h.game.atHand!, 'privatePlayerFind', 'a-private-player-pickup')[0];
        expect(pickup, take.narration).toBeDefined();
        const current = h.game.atHand!;
        const allocation = current.history.facts.find(fact => fact.data.privateFindAllocation && fact.data.objectId === 'a-private-player-pickup');
        if (kind === 'elder') {
            expect(allocation, take.narration).toBeDefined();
            expect(allocation!.data.beneathElder).toBe(true);
            expect(Math.sign(faceOf(current.npcs.find(person => person.id === h.elder.id)!) - face)).toBe(allocation!.data.shared ? 1 : -1);
        } else expect(allocation).toBeUndefined();
        const kept = kind === 'elder' && allocation!.data.shared === false;
        expect(current.objects.find(object => object.id === 'a-private-player-pickup')!.possessorId).toBe(kept ? h.elder.id : h.body.id);
        expect(pouchQuantity(h.db, h.body.id, 'pill-qi-gathering')).toBe(kept ? 2 : 3);
        thePlayerReceivesPrivatePartyFinds(h.game);
        expect(pouchQuantity(h.db, h.body.id, 'pill-qi-gathering')).toBe(kept ? 2 : 3);
    });
});
