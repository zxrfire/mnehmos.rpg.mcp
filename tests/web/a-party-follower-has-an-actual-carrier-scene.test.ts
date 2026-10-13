/** A party fight aboard a real public hull leaves its captain's arrival date
 * intact. Its surviving leader asks the party at that actual landfall before
 * the itinerary advances. This control carries food for the complete voyage. */
/**
 * A follower already moved with its admitted native leader, but the scene only
 * read player-owned, individually booked ship and carriage flags. It therefore
 * missed the actual hull and real operator of a sponsored party passage.
 * This played control arranges an accepted ordinary public lane and its real
 * paid carrier, then follows without creating an individual fare or claim.
 * The public passenger course survives a party leader's death: Native clock
 * promotion can remove that dead row and its actor references, but the living
 * passenger's accepted receipt and surviving captain still carry the body.
 */
import { expect, it } from 'vitest';
import { theyCameAtYou } from '../../src/web/when-somebody-comes-at-you';
import { resolveOccurrence } from '../../src/engine/encounters/resolve';
import { ENCOUNTERS } from '../../src/data/cultivation/encounters';
import { pendingPartyQuestion } from '../../src/engine/world/a-party-answers-its-leader';
import { bodyStandingOn } from '../../src/engine/world/npc-state';
import { writeFlag } from '../../src/server/consolidated/cultivation-support';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms';
import { makeGameInWorld } from './harness';
import { realiseAcceptedPublicShipHull } from '../../src/engine/world/a-public-ship-hull';
import { createNpc, markDead, setRealm } from '../../src/engine/world/npc-state';
import { publicShipLinesFrom, quotePublicPassage, recordPublicPassage, activityOfAPublicPassage } from '../../src/engine/world/public-shipping';
import { ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew';
import { routineTime } from '../../src/engine/world/npc-routines';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { worldLocationFor } from '../../src/web/entities';
import { bindFollowingParty, partyFollowerSource } from '../../src/web/following-the-party-leader';
import { actualCarrierScene, areasOfActualCarrier } from '../../src/web/the-actual-carrier-scene';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { agreedRideOn } from '../../src/web/an-offered-ride-is-an-agreement';
import { transferActualSpiritStones } from '../../src/web/transferring-actual-spirit-stones';

async function preparedSponsoredParty(lostLeader: boolean) {
    const h = await makeGameInWorld({ seed: 'party-on-a-public-hull', worldSeed: 'party-on-a-public-hull-world' });
    await h.game.newRun('Following passenger');
    let current = h.game.currentRun();
    h.game.repos.cultivators.update(current.cultivator.id, { location: 'Emerald Water City',
        realmOrdinal: 20, spiritStones: 61, hp: 1000, maxHp: 1000, satiety: 12 });
    current = h.game.currentRun();
    const world = h.game.atHand!, day = routineTime(world);
    const from = worldLocationFor(world, current.cultivator.location)!;
    const line = publicShipLinesFrom(world, from.name, day).find(line => line.runsFromDay === null)!;
    const to = worldLocationFor(world, line.to)!;
    const leader = createNpc(world.seed, { id: 'the-sponsoring-party-leader', locationId: from.id,
        onDay: day, bornOnDay: day - 25 * 365 });
    leader.spiritStones = 10000;
    world.npcs.push(leader);
    const quote = quotePublicPassage(world, from.id, to.id, day, 2)!;
    expect(quote).not.toBeNull();
    const crew = ensureShipCrew(world, quote.lane, from.id, day);
    const captain = crew.find(person => person.identity.occupation === 'shipmaster')!;
    bindShipCrewToPassage(world, quote);
    expect(realiseAcceptedPublicShipHull(world, quote, world.npcs.find(person => person.id === captain.id)!)).not.toBeNull();
    expect(transferActualSpiritStones(h.game, leader.id, captain.id, quote.fareStones).ok).toBe(true);
    recordPublicPassage(world, quote, day, from.id, [leader.id, current.cultivator.id, ...crew.map(person => person.id)]);
    const itinerary = appendWorldFact(world, makeFact({ day, kind: 'gathering', visibility: 'secret',
        locationId: from.id, summary: 'The accepted party left on its sponsored public passage.',
        actors: [{ id: leader.id, name: leader.name, role: 'leader' },
            { id: current.cultivator.id, name: current.cultivator.name, role: 'party_member' }],
        data: { publicMission: true, destinationId: to.id, publicServiceDays: 1,
            publicRoute: JSON.stringify([{ fromId: from.id, toId: to.id, by: 'ship' }]) } }),
        { bystanders: false, recur: false });
    const leg = activityOfAPublicPassage(quote, 'Travelling with the accepted party.');
    const admittedLeader = world.npcs.find(person => person.id === leader.id)!;
    admittedLeader.activity = { ...leg, capitalMissionId: itinerary.id, capitalMissionLeg: 0, withIds: [current.cultivator.id] };
    world.npcs.find(person => person.id === current.cultivator.id)!.activity = { ...admittedLeader.activity, withIds: [leader.id] };
    h.game.theWorldMoved();
    expect(bindFollowingParty(h.game, current.run, current.cultivator, leader.id, itinerary.id).ok).toBe(true);
    if (lostLeader) {
        const at = world.npcs.findIndex(person => person.id === leader.id);
        world.npcs[at] = markDead(world.npcs[at]!, day, 'The party leader died aboard.');
        h.game.theWorldMoved();
    }
    if (lostLeader) expect(partyFollowerSource(h.db, h.game.atHand!, current.cultivator),
        'the living passenger still has its real public source').not.toBeNull();
    const turn = await h.game.act('I wait for 3 hours');
    const body = h.game.currentRun().cultivator;
    const scene = actualCarrierScene(h.game.repos, body, world, routineTime(world));
    return { ...h, body, scene, turn, quote, captain, leader, world };
}

it.each([false, true])('the real sponsored hull carries its consenting follower with lost party leader=%s', async lostLeader => {
    const { game, db, body, scene, turn, quote, captain, world } = await preparedSponsoredParty(lostLeader);
    expect(scene, turn.narration).not.toBeNull();
    expect(scene!.vesselId).toBe(quote.vesselId);
    expect(scene!.operatorId).toBe(captain.id);
    expect(scene!.accepts(world.npcs.find(person => person.id === captain.id)!)).toBe(true);
    const areas = areasOfActualCarrier(world, scene!, body)!;
    expect(areas.areas.some(area => area.id === body.standingIn && area.for === 'deck')).toBe(true);
    expect(body.spiritStones).toBe(61 + turn.events.reduce((sum, event) =>
        sum + (typeof event.data.spiritStones === 'number' ? event.data.spiritStones : 0), 0));
    expect(world.npcs.find(person => person.id === body.id)!.locationId).toBeNull();
    expect(ledgerAbout(db, body.id).some(oath => agreedRideOn(oath))).toBe(false);
});


it('an aboard party and the real crew defend once with the leader beside the guarding player', async () => {
    const h = await preparedSponsoredParty(false);
    const initial = h.game.currentRun();
    writeFlag(h.db, initial.cultivator.id, FLAG_RATIONS_HELD, '20');
    const hp = maxHpForOrdinal(initial.cultivator.attributes.might, 3);
    h.game.repos.cultivators.update(initial.cultivator.id, { realmOrdinal: 3, hp, maxHp: hp });
    const current = h.game.currentRun(), day = routineTime(h.world);
    const crew = h.world.npcs.filter(person => h.scene!.accepts(person)
        && person.tags.includes('crew-of:' + h.scene!.vesselId));
    expect(crew.length).toBeGreaterThan(0);
    const leaderAt = h.world.npcs.findIndex(person => person.id === h.leader.id);
    h.world.npcs[leaderAt] = setRealm(h.world.npcs[leaderAt]!, 14, day);
    const captainCourse = { ...h.world.npcs.find(person => person.id === h.captain.id)!.activity! };
    const before = new Map(crew.map(person => [person.id, bodyStandingOn(person, day)]));
    const entry = ENCOUNTERS.find(row => row.kind === 'bandits' && row.requiresSubstrate === 'water')!;
    const occurrence = resolveOccurrence({ entry, activity: 'travel', ordinal: current.cultivator.realmOrdinal,
        hp: current.cultivator.hp, maxHp: current.cultivator.maxHp, spiritStones: current.cultivator.spiritStones,
        absoluteDay: current.run.elapsedDays, dayOffset: 0, values: { count: 3, place: current.cultivator.location },
        grants: [], castIds: [], cast: [], outcome: 'landed' });
    expect(occurrence.confrontation?.engageable).toBe(true);
    expect(occurrence.interrupts).toBe(true);
    const opened = theyCameAtYou(h.game, current.run, current.cultivator,
        h.game.ambientFor(current.cultivator, current.run), { occurrences: [occurrence],
            firstInterruptDay: occurrence.absoluteDay, checks: 1, poolSize: 1 }, true)!;
    expect(opened).not.toBeNull();
    expect(h.game.fight?.foregroundParty?.ally.id).toBe(h.leader.id);
    expect(opened.facts.lines.join('\n')).toContain(h.captain.name);
    const changed = crew.some(person => bodyStandingOn(h.world.npcs.find(row => row.id === person.id)!, day)
        < before.get(person.id)!);
    expect(changed, 'the actual background crew pays for its own fight').toBe(true);
    const guard = await h.game.act('I guard');
    expect(guard.narration).toContain(h.leader.name);
    expect(h.game.fight?.state.exchanges.some(exchange => exchange.attackerId === current.cultivator.id) ?? false).toBe(false);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(current.cultivator.spiritStones);
    const fightEvent = h.game.fight?.partyFightFactId;
    expect(fightEvent).toBeTruthy();
    for (let round = 0; h.game.fight && round < 30; round++) await h.game.act('I guard');
    expect(h.game.fight).toBeNull();
    expect(h.game.currentRun().cultivator.alive).toBe(true);
    const after = h.game.atHand!;
    expect(after.npcs.find(person => person.id === h.captain.id)!.activity?.untilDay).toBe(captainCourse.untilDay);
    expect(pendingPartyQuestion(after, h.leader.id)).toBeNull();
    const remaining = captainCourse.untilDay! - routineTime(after);
    expect(remaining).toBeGreaterThan(0);
    const landed = await h.game.act(`I wait for ${remaining * 24} hours`);
    expect(pendingPartyQuestion(h.game.atHand!, h.leader.id), landed.narration).not.toBeNull();
    expect(landed.narration).toContain('asks the party');
});
