import { acceptOwnedPassage } from '../../src/web/an-owned-passage';
import { quoteAnAirJourney } from '../../src/engine/world/what-an-air-journey-takes';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on';
import { advancePublicCapitalMission } from '../../src/engine/world/capital-missions-and-calendar';
/**
 * A native party itinerary formerly moved only world NPC activities. A player
 * who accepted company had no link projecting that course to their SQL body.
 * This first adapter control arranges the existing native itinerary and its
 * accepted members, then plays a real body span. Binding has no fare writer;
 * the original sponsoring arrangement remains the payer. Leader questions,
 * decisions preserve paused work or reverse the admitted road, and leaving
 * removes the accepted membership while retaining the body's actual ground.
 * Native encounter checks can interrupt this course and move incidental coins.
 * The money controls include those reported engine deltas; following itself
 * buys no second fare. The accepted rest until dawn is another played turn,
 * so its reported coins enter the same conservation check. A standing gate comes from its real authority, not a
 * random registration catalog row. Group fights are covered in entry 131.
 * Merge validation found an accepted rest falling through to an ordinary
 * six-day wait: the Native party returned while the SQL follower stayed behind.
 * A rest keeps the physical binding through dawn and the resumed real course;
 * an unanswered question still requires the player's voice.
 */
import { ruin } from '../../src/engine/world/possessions';
import { aVehicleOf, takeItAlong } from '../../src/engine/world/a-vehicle';
import { LI_PER_WALKING_DAY } from '../../src/engine/world/the-metric-ground-under-a-journey';
import { beginAnAirCourse, readAnAirCourseAdmission, recordPaidAirCourseFuel, stopAnAirCourse } from '../../src/engine/world/an-air-course-in-the-world';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { agreedRideOn } from '../../src/web/an-offered-ride-is-an-agreement';
import { partyFollowerSource } from '../../src/web/following-the-party-leader';
import type { SimEvent } from '../../src/schema/cultivation';
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc, setRealm, markDead } from '../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../src/engine/world/locations';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { routineTime } from '../../src/engine/world/npc-routines';
import { locationOfNpcOnItsJourney, ROUTE_STOP } from '../../src/engine/world/places-on-the-way';
import { bindFollowingParty, followedParty, partyFollowerClaim, projectPartyFollower, releaseFollowingForIndependentPassage }
    from '../../src/web/following-the-party-leader';
import { pendingPartyQuestion, putTheRouteToTheParty } from '../../src/engine/world/a-party-answers-its-leader';
import { factsWithDataValue } from '../../src/engine/world/witness-reaction-index';
import { stoppedRoadFor } from '../../src/web/a-road-stopped-partway';

async function prepared() {
    const h = await makeGameInWorld({ seed: 'actual-party-follower', worldSeed: 'actual-party-follower-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!, day = routineTime(world);
    const from = makeLocation({ id: 'follower-start', name: 'Reed Court', kind: 'settlement' });
    const to = makeLocation({ id: 'follower-work', name: 'Stone Court', kind: 'settlement' });
    linkLocations(from, to, 'road', 2);
    world.locations.push(from, to);
    const leader = createNpc(world.seed, { id: 'follower-leader', name: 'The party leader',
        locationId: from.id, onDay: day, bornOnDay: day - 25 * 365 });
    leader.spiritStones = 37;
    const itinerary = appendWorldFact(world, makeFact({ day, kind: 'gathering',
        visibility: 'secret', locationId: from.id, summary: 'The accepted party left on its ordinary itinerary.',
        actors: [{ id: leader.id, name: leader.name, role: 'leader' },
            { id: cultivator.id, name: cultivator.name, role: 'delegate' }],
        // Use the existing house itinerary transition in this adapter fixture;
        // Sol World's private sponsor producer is validated in its own tree.
        factionIds: [world.factions.find(house => house.dissolvedOnDay === null)!.id],
        data: { publicMission: true, reason: 'an agreed visit', publicFareStones: 0,
            destinationId: to.id, publicRoute: JSON.stringify([{ fromId: from.id, toId: to.id, by: 'land' }]),
            publicServiceDays: 1, publicServiceEnd: day + 3, plannedReturnDay: day + 5 } }),
        { bystanders: false, recur: false });
    leader.activity = { kind: 'travelling', note: 'Travelling with the accepted party.',
        withIds: [cultivator.id], sinceDay: day, untilDay: day + 2,
        fromLocationId: from.id, returnTo: to.id, capitalMissionId: itinerary.id, capitalMissionLeg: 0 };
    // Actual native admission names every accepted member on this phase. A
    // historic actor list alone is not a current capacity/party admission.
    world.npcs.find(person => person.id === cultivator.id)!.activity = {
        ...leader.activity, withIds: [leader.id] };
    world.npcs.push(leader);
    h.game.repos.cultivators.update(cultivator.id, { location: from.name, spiritStones: 61 });
    h.game.theWorldMoved();
    return { ...h, world, from, to, leader, itinerary, cultivator: h.game.currentRun().cultivator };
}

async function preparedPrivateFlight(otherOwner = false) {
    const h = await prepared(), current = h.game.currentRun(), day = routineTime(h.world);
    h.from.data.metricXLi = 0; h.from.data.metricYLi = 0;
    h.to.data.metricXLi = 2 * LI_PER_WALKING_DAY; h.to.data.metricYLi = 0;
    const leaderAt = h.world.npcs.findIndex(person => person.id === h.leader.id);
    if (otherOwner) {
        const friend = createNpc(h.world.seed, { id: 'the-friend-who-owns-this-boat', name: 'The boat owner',
            locationId: h.from.id, onDay: day, bornOnDay: day - 25 * 365 });
        friend.activity = { ...h.world.npcs[leaderAt]!.activity!, withIds: [h.leader.id, current.cultivator.id] };
        h.world.npcs[leaderAt]!.activity!.withIds.push(friend.id);
        h.world.npcs.push(friend);
    }
    const at = otherOwner ? h.world.npcs.length - 1 : leaderAt;
    h.world.npcs[at] = { ...setRealm(h.world.npcs[at]!, 29, day), spiritStones: 10000 };
    const pilot = h.world.npcs[at]!;
    const boat = aVehicleOf({ id: 'the-leaders-own-private-boat', conveyanceId: 'conv-spirit-boat',
        ownerId: pilot.id, ownerName: pilot.name, at: h.from.id });
    h.world.objects.push(boat); takeItAlong(h.world.objects, boat, pilot.id);
    expect(bindFollowingParty(h.game, current.run, current.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
    const input = { bodyId: pilot.id, bodyName: pilot.name, fromId: h.from.id, toId: h.to.id,
        conveyanceId: 'conv-spirit-boat', power: boat.power, vesselId: boat.id, artId: null, onDay: day,
        heads: otherOwner ? 3 : 2, owned: { ownerId: pilot.id, pilotId: pilot.id }, dutyCauses: [h.itinerary.id],
        actualLoad: [{ id: pilot.id, name: pilot.name }, { id: current.cultivator.id, name: current.cultivator.name },
            ...(otherOwner ? [{ id: h.leader.id, name: h.leader.name }] : [])],
        actualPlayerContact: { id: current.cultivator.id, name: current.cultivator.name,
            alive: current.cultivator.alive, locationId: h.from.id } };
    expect(readAnAirCourseAdmission(h.world, { ...input, actualPlayerContact: undefined })).toBeNull();
    expect(readAnAirCourseAdmission(h.world, { ...input,
        actualPlayerContact: { ...input.actualPlayerContact, locationId: h.to.id } })).toBeNull();
    const flight = beginAnAirCourse(h.world, input)!;
    expect(flight, 'the actual SQL body and named load can board the owned craft').not.toBeNull();
    expect(pilot.spiritStones).toBeGreaterThanOrEqual(flight.quote.stonesBurned);
    const arrival = day + flight.quote.daysOneWay;
    h.world.npcs[at] = { ...pilot, locationId: flight.location.id,
        spiritStones: pilot.spiritStones - flight.quote.stonesBurned,
        activity: { ...pilot.activity!, kind: 'travelling', sinceDay: day, untilDay: arrival,
            fromLocationId: h.from.id, returnTo: h.to.id, vesselId: boat.id,
            conveyanceId: 'conv-spirit-boat', airCourseLocationId: flight.location.id } };
    if (otherOwner) h.world.npcs[leaderAt] = { ...h.world.npcs[leaderAt]!, locationId: flight.location.id,
        activity: { ...h.world.npcs[at]!.activity!, withIds: [pilot.id, current.cultivator.id] } };
    h.world.npcs.find(person => person.id === current.cultivator.id)!.activity = {
        ...h.world.npcs[at]!.activity!, withIds: [...new Set([pilot.id, h.leader.id])] };
    const boatAt = h.world.objects.findIndex(object => object.id === boat.id);
    h.world.objects[boatAt] = { ...h.world.objects[boatAt]!, locationId: flight.location.id };
    expect(recordPaidAirCourseFuel(h.world, flight.fact.id, pilot.id, arrival, flight.quote.stonesBurned, day)).not.toBeNull();
    h.game.theWorldMoved();
    return { ...h, pilot, boat, flight, arrival, day };
}

function reportedCoins(events: readonly SimEvent[]): number {
    return events.reduce((total, event) => total + (typeof event.data.spiritStones === 'number'
        ? event.data.spiritStones : 0), 0);
}

async function finishFollowing(h: Awaited<ReturnType<typeof prepared>>) {
    const events: SimEvent[] = [];
    const lines: string[] = [];
    for (let stop = 0; partyFollowerClaim(h.db, h.cultivator.id) && stop < 12; stop++) {
        const question = pendingPartyQuestion(h.world, h.leader.id);
        const result = await h.game.act(question ? 'I tell the party to continue' : 'I wait for 6 days');
        events.push(...result.events);
        lines.push(result.narration);
        const party = followedParty(h.db, h.world, h.cultivator.id);
        if (party) {
            const placeId = locationOfNpcOnItsJourney(h.world, party.leader, routineTime(h.world));
            expect(h.game.currentRun().cultivator.location, result.narration)
                .toBe(h.world.locations.find(place => place.id === placeId)!.name);
        }
    }
    expect(partyFollowerClaim(h.db, h.cultivator.id), lines.join('\n')).toBeNull();
    return { events, narration: lines.join('\n') };
}

describe('the follower binding projects the actual player body', () => {
    it('the first turn after losing a foot-party leader ends the binding and later waiting works', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const at = h.world.npcs.findIndex(person => person.id === h.leader.id);
        h.world.npcs[at] = markDead(h.world.npcs[at]!, routineTime(h.world), 'The party leader died.');
        h.game.theWorldMoved();
        const stopped = await h.game.act('I wait for 1 hour');
        expect(stopped.narration).toContain('no longer carrying the accepted journey');
        expect(partyFollowerClaim(h.db, before.cultivator.id)).toBeNull();
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        const waited = await h.game.act('I wait for 1 hour');
        expect(h.game.currentRun().run.elapsedDays - before.run.elapsedDays, waited.narration).toBeCloseTo(1 / 24);
    });

    it('a projection at a different clock cannot release a follower whose leader is gone', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const at = h.world.npcs.findIndex(person => person.id === h.leader.id);
        h.world.npcs[at] = markDead(h.world.npcs[at]!, routineTime(h.world), 'The party leader died.');
        const claim = partyFollowerClaim(h.db, before.cultivator.id);
        projectPartyFollower(h.db, h.world, before.cultivator.id, routineTime(h.world) + 1);
        expect(partyFollowerClaim(h.db, before.cultivator.id)).toEqual(claim);
        expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
    });

    it('an independently accepted owned flight releases the party before actual boarding projection', async () => {
        const h = await prepared();
        h.from.data.metricXLi = 0; h.from.data.metricYLi = 0;
        h.to.data.metricXLi = 2 * LI_PER_WALKING_DAY; h.to.data.metricYLi = 0;
        h.game.repos.cultivators.update(h.cultivator.id, { realmOrdinal: 29, spiritStones: 10000 });
        const before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const boat = aVehicleOf({ id: 'the-followers-own-boat', conveyanceId: 'conv-spirit-boat',
            ownerId: before.cultivator.id, ownerName: before.cultivator.name, at: h.from.id });
        h.world.objects.push(boat); takeItAlong(h.world.objects, boat, before.cultivator.id);
        const quote = quoteAnAirJourney(h.world.locations, h.from.id, h.to.id,
            requireConveyance('conv-spirit-boat'), boat.power, 1)!;
        expect(quote).not.toBeNull();
        acceptOwnedPassage(h.game, before.run, before.cultivator, { vesselId: boat.id,
            pilotId: before.cultivator.id, fromId: h.from.id, toId: h.to.id,
            walkingDays: 2, days: quote.daysOneWay, conveyanceId: 'conv-spirit-boat',
            power: boat.power, companions: [], air: true });
        expect(releaseFollowingForIndependentPassage(h.db, h.world, before.cultivator.id,
            routineTime(h.world) + 1)).toBe(false);
        expect(partyFollowerClaim(h.db, before.cultivator.id)).not.toBeNull();
        const travelled = await h.game.act('I wait for ' + quote.daysOneWay * 24 + ' hours');
        expect(partyFollowerClaim(h.db, before.cultivator.id)).toBeNull();
        expect(h.game.currentRun().cultivator.location, travelled.narration).toBe(h.to.name);
        expect(h.world.npcs.find(person => person.id === h.leader.id)!.activity!.withIds)
            .not.toContain(before.cultivator.id);
        await h.game.act('I wait for 1 hour');
        expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
    });

    it('saying they will not leave does not remove their actual party membership', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const said = await h.game.act('I will not leave the party');
        expect(said.narration).not.toContain('You left the party.');
        expect(partyFollowerClaim(h.db, before.cultivator.id)).not.toBeNull();
    });

    it('an independent road journey leaves the party instead of projecting the traveller back', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        await h.game.act('I wait for 12 hours');
        const moved = await h.game.act('I travel to ' + h.from.name);
        expect(moved.narration).toContain('You left the party.');
        expect(partyFollowerClaim(h.db, before.cultivator.id)).toBeNull();
        const actual = h.game.currentRun().cultivator.location;
        await h.game.act('I wait for 1 hour');
        expect(h.game.currentRun().cultivator.location).toBe(actual);
        expect(h.world.npcs.find(person => person.id === h.leader.id)!.activity!.withIds)
            .not.toContain(before.cultivator.id);
    });

    it('leaving mid-road leaves the actual body there and ends its membership', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        await h.game.act('I wait for 12 hours');
        const left = await h.game.act('I leave the party');
        const here = h.game.currentRun().cultivator;
        expect(left.narration).toContain('You left the party');
        expect(partyFollowerClaim(h.db, here.id)).toBeNull();
        expect(here.location).toContain('On the road between');
        const cursor = stoppedRoadFor(h.db, here, h.world);
        expect(cursor?.position?.kind).toBe('edge');
        expect(h.world.npcs.find(person => person.id === h.leader.id)!.activity!.withIds).not.toContain(here.id);
        await h.game.act('I wait for 3 days');
        expect(h.game.currentRun().cultivator.location).toBe(here.location);
    });

    it('a played reply records every voice and applies the decided real course', async () => {
        const h = await prepared(), before = h.game.currentRun(), day = routineTime(h.world);
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const question = putTheRouteToTheParty(h.world, h.leader.id, h.cultivator.id,
            day, 'played-route-question', 'The leader asked whether to continue.')!;
        h.game.theWorldMoved();
        const reply = await h.game.act('I tell the party to continue');
        const decision = factsWithDataValue(h.world, 'partyQuestionDecided', question.id)[0];
        expect(decision, reply.narration).toBeDefined();
        const voices = JSON.parse(String(decision!.data.partyVoices));
        expect(voices.map((voice: { personId: string }) => voice.personId).sort())
            .toEqual([h.leader.id, h.cultivator.id].sort());
        expect(reply.narration).toContain(decision!.summary);
        const restEvents: SimEvent[] = [];
        if (decision!.data.choice === 'rest') {
            const dawn = await h.game.act('I wait until dawn');
            restEvents.push(...dawn.events);
            expect(h.world.npcs.find(person => person.id === h.leader.id)!.activity?.partyQuestionId).toBeUndefined();
        } else expect(h.world.npcs.find(person => person.id === h.leader.id)!.activity?.partyQuestionId).toBeUndefined();
        const home = await finishFollowing(h);
        expect(h.game.currentRun().cultivator.location, home.narration).toBe(h.from.name);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).toBeNull();
        expect(h.game.currentRun().cultivator.spiritStones).toBe(61 + reportedCoins(reply.events) + reportedCoins(restEvents) + reportedCoins(home.events));
    });

    it('the remaining people settle a held question without a vote from someone who left', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const question = putTheRouteToTheParty(h.world, h.leader.id, h.cultivator.id,
            routineTime(h.world), 'question-before-leaving', 'The leader asked whether to continue.')!;
        h.game.theWorldMoved();
        const left = await h.game.act('I leave the party');
        const decision = factsWithDataValue(h.world, 'partyQuestionDecided', question.id)[0];
        expect(decision, left.narration).toBeDefined();
        expect(JSON.parse(String(decision!.data.partyVoices)).map((voice: { personId: string }) => voice.personId))
            .toEqual([h.leader.id]);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).toBeNull();
    });

    it('a historical actor without current native admission cannot claim a seat in the party', async () => {
        const h = await prepared(), before = h.game.currentRun();
        h.world.npcs.find(person => person.id === h.cultivator.id)!.activity = null;
        const refused = bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id);
        expect(refused.ok).toBe(false);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).toBeNull();
    });

    it('a real leader question holds the native phase and the stored body while time passes', async () => {
        const h = await prepared(), before = h.game.currentRun(), day = routineTime(h.world);
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const question = putTheRouteToTheParty(h.world, h.leader.id, h.cultivator.id,
            day, 'a-real-route-question', 'The leader put this route to the party.');
        expect(question).not.toBeNull();
        h.game.theWorldMoved();
        const turn = await h.game.act('I wait for 49 hours');
        const leader = h.world.npcs.find(person => person.id === h.leader.id)!;
        expect(h.game.currentRun().cultivator.location, turn.narration).toBe(h.from.name);
        expect(leader.activity!.partyQuestionId).toBe(question!.id);
        expect(advancePublicCapitalMission(h.world, leader.id, day + 3)).toBe(true);
        expect(leader.activity!.capitalMissionLeg).toBe(0);
        expect(locationOfNpcOnItsJourney(h.world, leader, day + 3)).toBe(h.from.id);
        expect(h.game.currentRun().run.elapsedDays - before.run.elapsedDays).toBeCloseTo(49 / 24);
    });

    it('the actual follower remains admitted through an ordinary outward arrival and service phase', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const turn = await h.game.act('I wait for 49 hours');
        const party = followedParty(h.db, h.world, h.cultivator.id);
        expect(party, turn.narration).not.toBeNull();
        expect(party!.leader.activity!.capitalMissionLeg).toBe(1);
        expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(61 + reportedCoins(turn.events));
        expect(h.game.currentRun().run.elapsedDays - before.run.elapsedDays).toBeCloseTo(49 / 24);
    });

    it('the actual SQL body follows the same admitted party home after its service', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const outward = await h.game.act('I wait for 49 hours');
        expect(h.game.currentRun().cultivator.location, outward.narration).toBe(h.to.name);
        const home = await finishFollowing(h);
        expect(h.game.currentRun().cultivator.location, home.narration).toBe(h.from.name);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).toBeNull();
        expect(h.game.currentRun().cultivator.spiritStones)
            .toBe(61 + reportedCoins(outward.events) + reportedCoins(home.events));
        expect(locationOfNpcOnItsJourney(h.world, h.world.npcs.find(person => person.id === h.leader.id)!,
            routineTime(h.world))).toBe(h.from.id);
        expect(home.narration).toContain('The party\'s agreed journey has ended.');
    });

    it('binds accepted company without a second fare or another route roster', async () => {
        const h = await prepared(), run = h.game.currentRun().run;
        const before = JSON.stringify(h.leader.activity);
        const accepted = bindFollowingParty(h.game, run, h.cultivator, h.leader.id, h.itinerary.id);
        expect(accepted.ok, accepted.ok ? '' : accepted.reason).toBe(true);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(61);
        expect(h.leader.spiritStones).toBe(37);
        expect(JSON.stringify(h.leader.activity)).toBe(before);
        const claim = partyFollowerClaim(h.db, h.cultivator.id)!;
        expect(Object.keys(claim)).toEqual(['bindingFactId']);
        expect(followedParty(h.db, h.world, h.cultivator.id)!.itinerary.id).toBe(h.itinerary.id);
        expect(bindFollowingParty(h.game, run, h.cultivator, h.leader.id, h.itinerary.id)).toEqual(accepted);
    });

    it.each([false, true])('a consenting follower uses the real private owner with another party leader=%s', async otherOwner => {
        const h = await preparedPrivateFlight(otherOwner), before = h.game.currentRun();
        const half = h.flight.quote.daysOneWay / 2;
        const first = await h.game.act('I wait for ' + half * 24 + ' hours');
        const riding = h.game.currentRun();
        expect(riding.run.elapsedDays - before.run.elapsedDays, first.narration).toBeCloseTo(half);
        expect(riding.cultivator.location).toBe(h.flight.location.name);
        expect(h.world.npcs.find(person => person.id === riding.cultivator.id)!.locationId).toBeNull();
        const terms = ledgerAbout(h.db, riding.cultivator.id).map(agreedRideOn).filter(Boolean);
        expect(terms).toHaveLength(1);
        expect(terms[0]!.driverId).toBe(h.pilot.id);
        expect(terms[0]!.payment).toEqual({ kind: 'free' });
        expect(h.world.objects.some(object => object.tags.includes('passage-tally')
            && object.possessorId === riding.cultivator.id)).toBe(false);
        const arrived = await h.game.act('I wait for ' + half * 24 + ' hours');
        expect(h.game.currentRun().cultivator.location, arrived.narration).toBe(h.to.name);
        const agreements = ledgerAbout(h.db, riding.cultivator.id).filter(oath => agreedRideOn(oath));
        expect(agreements).toHaveLength(1);
        expect(agreements[0]!.status, arrived.narration).toBe('settled');
        expect(h.game.currentRun().cultivator.spiritStones)
            .toBe(61 + reportedCoins(first.events) + reportedCoins(arrived.events));
    });

    it('a lost private craft cannot turn the admitted flight into a generic follower journey', async () => {
        const h = await preparedPrivateFlight(), before = h.game.currentRun();
        const at = h.world.objects.findIndex(object => object.id === h.flight.fact.data.vesselId);
        h.world.objects[at] = ruin(h.world.objects[at]!, { onDay: h.day, source: 'a broken private hull' });
        h.game.theWorldMoved();
        expect(partyFollowerSource(h.db, h.world, before.cultivator)!.unavailable)
            .toBe('The actual privately held craft is no longer carrying this leg.');
        projectPartyFollower(h.db, h.world, before.cultivator.id, h.day);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        const refused = await h.game.act('I wait for 1 hour');
        expect(refused.narration).toContain('The actual privately held craft is no longer carrying this leg.');
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
    });

    it('a physically stopped air course does not finish its party phase at the old arrival date', async () => {
        const h = await preparedPrivateFlight();
        stopAnAirCourse(h.world, h.flight.location, h.day, 'The actual private hull stopped.');
        expect(advancePublicCapitalMission(h.world, h.pilot.id, h.flight.fact.data.arrivalDay as number)).toBe(true);
        const leader = h.world.npcs.find(person => person.id === h.pilot.id)!;
        expect(leader.activity!.capitalMissionLeg).toBe(0);
        expect(leader.locationId).toBe(h.flight.location.id);
        expect(partyFollowerSource(h.db, h.world, h.game.currentRun().cultivator)!.unavailable)
            .toBe('The actual air course stopped at its reached point.');
    });

    it('an old party roster does not overfill a private leg that did not name this follower', async () => {
        const h = await preparedPrivateFlight();
        h.flight.fact.actors = h.flight.fact.actors.filter(actor => actor.id !== h.cultivator.id);
        const before = h.game.currentRun();
        projectPartyFollower(h.db, h.world, before.cultivator.id, h.day);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        const source = partyFollowerSource(h.db, h.world, before.cultivator)!;
        expect(source.unavailable).toBe('The private craft has not boarded you on this actual leg.');
        const refused = await h.game.act('I wait for 1 hour');
        expect(refused.narration).toContain('The private craft has not boarded you');
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(ledgerAbout(h.db, h.cultivator.id).some(oath => agreedRideOn(oath))).toBe(false);
    });

    it('a real crossing interrupts a short follower span and the leader asks the party there', async () => {
        const h = await prepared(), before = h.game.currentRun(), day = routineTime(h.world);
        const middle = makeLocation({ id: 'actual-party-crossing', name: 'The crossing on this road',
            kind: 'wilds', tags: [ROUTE_STOP] });
        h.from.links = h.from.links.filter(link => link.toLocationId !== h.to.id);
        h.to.links = h.to.links.filter(link => link.toLocationId !== h.from.id);
        linkLocations(h.from, middle, 'road', .5);
        linkLocations(middle, h.to, 'road', 1.5);
        h.world.locations.push(middle);
        const other = createNpc(h.world.seed, { id: 'the-person-crossing-the-party', locationId: h.from.id,
            onDay: day - 1, bornOnDay: day - 25 * 365 });
        other.activity = { kind: 'travelling', sinceDay: day - 1, untilDay: day + 1,
            fromLocationId: h.to.id, returnTo: h.from.id, withIds: [], note: 'Walking this road.' };
        h.world.npcs.push(other);
        h.game.theWorldMoved();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const met = await h.game.act('I wait for 18 hours');
        const after = h.game.currentRun();
        expect(after.run.elapsedDays - before.run.elapsedDays, met.narration).toBeCloseTo(.5);
        expect(after.cultivator.location).toBe(middle.name);
        expect(locationOfNpcOnItsJourney(h.world, h.world.npcs.find(person => person.id === other.id)!,
            routineTime(h.world))).toBe(middle.id);
        expect(met.narration).toContain('A real traveller is here on the road.');
        expect(pendingPartyQuestion(h.world, h.leader.id)?.locationId).toBe(middle.id);
        expect(met.narration).toContain('asks the party whether to continue, rest or turn back');
    });

    it('a played span advances the stored body with the actual leader', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        const turn = await h.game.act('I wait for 3 hours');
        const after = h.game.currentRun();
        const leader = h.world.npcs.find(person => person.id === h.leader.id)!;
        const placeId = locationOfNpcOnItsJourney(h.world, leader, routineTime(h.world));
        expect(placeId, turn.narration).not.toBeNull();
        expect(after.cultivator.location).toBe(h.world.locations.find(place => place.id === placeId)!.name);
        expect(after.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(3 / 24);
        expect(after.cultivator.age).toBeGreaterThan(before.cultivator.age);
        expect(after.cultivator.spiritStones).toBe(61 + reportedCoins(turn.events));
        expect(h.world.npcs.find(person => person.id === h.leader.id)!.spiritStones).toBe(37);
    });

    it('a missing acceptance or absent actual leader cannot bind or move the body', async () => {
        const h = await prepared(), before = h.game.currentRun();
        const leader = h.world.npcs.find(person => person.id === h.leader.id)!;
        leader.activity!.withIds = [];
        expect(bindFollowingParty(h.game, before.run, before.cultivator, leader.id, h.itinerary.id).ok).toBe(false);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).toBeNull();
        leader.activity!.withIds = [h.cultivator.id];
        h.game.repos.cultivators.update(h.cultivator.id, { location: h.to.name });
        expect(bindFollowingParty(h.game, before.run, before.cultivator, leader.id, h.itinerary.id).ok).toBe(false);
        expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
    });

    it('a future route read cannot advance the actual stored body or its clock', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        projectPartyFollower(h.db, h.world, h.cultivator.id, routineTime(h.world) + 2);
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).not.toBeNull();
    });

    it('a departed or dead leader cannot drag the stored body to an old promised destination', async () => {
        const h = await prepared(), before = h.game.currentRun();
        expect(bindFollowingParty(h.game, before.run, before.cultivator, h.leader.id, h.itinerary.id).ok).toBe(true);
        h.world.npcs.find(person => person.id === h.leader.id)!.status = 'physically_dead';
        projectPartyFollower(h.db, h.world, h.cultivator.id, routineTime(h.world));
        expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
        expect(partyFollowerClaim(h.db, h.cultivator.id)).toBeNull();
    });
});
