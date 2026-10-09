/** Owner correction: taking disciples on real board work earns more face and
 * merit than a talk. This adapter control uses the ordinary priced notice,
 * party selection, duty oath and SQLite membership. A repeated completion pays
 * nothing; neither a parallel experience duty nor a second reward is needed. */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { acceptDuty, completeDuty, dutyFromOffer } from '../../src/web/encounters.js';
import { standInTheWorld } from '../../src/web/the-player-as-a-row-the-world-can-invite.js';
import { dutyTermsFor } from '../../src/engine/encounters/duties.js';
import { aPostingAsAnOffer } from '../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { whoASeniorIsAskedToTakeOut } from '../../src/engine/encounters/who-a-senior-is-asked-to-take-out.js';
import { getSendingReason } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { whatLeadingDisciplesIsWorth, whatAttentionIsWorth } from '../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { faceOf, whatBeingWatchedIsWorth } from '../../src/engine/world/what-a-face-is-worth.js';
import { lostChance } from '../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { regardFor } from '../../src/engine/cultivation/regard.js';

it('the ordinary successful duty credits the scaled lecture reward once to the player leader', async () => {
    const { game, repos, db } = await makeGameInWorld({ seed: 'mission-leader-reward',
        worldSeed: 'mission-leader-reward-world', worldEnabled: true });
    const { cultivator: initial } = await game.newRun('Leader');
    const world = await game.loadWorld();
    const house = world!.factions.find(row => row.dissolvedOnDay === null
        && world!.npcs.filter(person => person.status === 'alive' && person.factionId === row.id
            && person.cultivation.realmOrdinal < 29).length >= 2)!;
    expect(house).toBeTruthy();
    repos.sects.addMember(house.id, initial.id, 0);
    const sect = repos.sects.getById(house.id)!;
    repos.sects.setRank(house.id, initial.id, sect.ranks.length - 2);
    db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(29, initial.id);
    const cultivator = repos.cultivators.getById(initial.id)!;
    const membership = { factionId: house.id, factionName: house.name,
        rankIndex: sect.ranks.length - 2, rankCount: sect.ranks.length, contribution: 0 };
    const roster = world!.npcs.filter(person => person.status === 'alive' && person.factionId === house.id)
        .map(person => ({ id: person.id, name: person.name, rankIndex: person.factionRankIndex,
            realmOrdinal: person.cultivation.realmOrdinal }));
    const pitch = Math.max(...roster.filter(person => person.realmOrdinal < 29).map(person => person.realmOrdinal));
    const reason = getSendingReason('sending-an-escort')!;
    const entry = aPostingAsAnOffer({ reason, house, pitchOrdinal: pitch });
    const terms = dutyTermsFor(entry, cultivator.realmOrdinal, membership, 'commission');
    const day = world!.currentDay;
    const duty = dutyFromOffer({ entry, terms, weight: entry.weight }, membership, day);
    duty.takingOut = whoASeniorIsAskedToTakeOut({ pitchOrdinal: duty.pitchOrdinal, hands: 2,
        roster, seniorId: cultivator.id, seniorOrdinal: cultivator.realmOrdinal });
    expect(duty.takingOut.length).toBeGreaterThan(0);
    standInTheWorld(world!, cultivator, { factionId: house.id, rankIndex: membership.rankIndex }, day);
    const input = { repos, cultivator, duty, onDay: day, entryId: entry.id, what: entry.name, world };
    acceptDuty(input);
    expect(repos.sects.getMembership(cultivator.id)!.contribution).toBe(0);
    const days = duty.days + 8;
    const danger = Math.max(...duty.takingOut.map(person => lostChance(regardFor(duty.pitchOrdinal, person.realmOrdinal))));
    const reward = whatLeadingDisciplesIsWorth(cultivator.realmOrdinal, days,
        duty.takingOut.length, duty.takingOut.length, danger);
    expect(reward.ratio).toBeGreaterThan(2);
    const finished = { ...input, onDay: day + days, acceptedOnDay: day };
    const paid = completeDuty(finished);
    expect(paid.obligation.status).toBe('settled');
    expect(paid.contribution).toBe(duty.contribution + reward.merit);
    expect(repos.sects.getMembership(cultivator.id)!.contribution).toBe(paid.contribution);
    expect(reward.merit).toBe(Math.round(reward.ratio * whatAttentionIsWorth(cultivator.realmOrdinal,
        days, duty.takingOut.length, duty.takingOut.length)));
    expect(reward.face).toBe(reward.ratio * whatBeingWatchedIsWorth(duty.takingOut.length));
    const leader = world!.npcs.find(person => person.id === cultivator.id)!;
    expect(faceOf(leader)).toBeCloseTo(reward.face, 2);
    const again = completeDuty(finished);
    expect(again.contribution).toBe(0);
    expect(again.stones).toBe(0);
    expect(repos.sects.getMembership(cultivator.id)!.contribution).toBe(paid.contribution);
    expect(faceOf(world!.npcs.find(person => person.id === cultivator.id)!)).toBe(faceOf(leader));
}, 120_000);
