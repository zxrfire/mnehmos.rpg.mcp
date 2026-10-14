/** A recreated service previously lost its unfinished fight while the native
 * party remained stopped. The same stored round must answer again and clear
 * on conclusion, alongside the ordinary party-risk controls below. */
/**
 * A walking party formerly left all its companions outside an incoming fight,
 * even when a pack attacked them on forbidden ground. Only paid guards and ship
 * crew entered the existing group melee. These played controls arrange the
 * catalog's actual wolf attack and accepted real company, never a winner. One
 * companion shares the foreground melee and the others meet the remainder; their
 * actual bodies retain what the resolver spent at the absolute world day,
 * even though an encounter carries the run-relative day. A surviving NPC-led party asks
 * everyone about its course after the player's foreground fight has ended.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc, setRealm, bodyStandingOn } from '../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../src/engine/world/locations';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { maxHpForOrdinal, maxQiForOrdinal } from '../../src/engine/cultivation/realms';
import { resolveOccurrence } from '../../src/engine/encounters/resolve';
import { ENCOUNTERS } from '../../src/data/cultivation/encounters';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theSpeciesItIs } from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular';
import { pendingPartyQuestion } from '../../src/engine/world/a-party-answers-its-leader';
import { bindFollowingParty } from '../../src/web/following-the-party-leader';
import { GameService } from '../../src/web/turn-engine';
import { theyCameAtYou } from '../../src/web/when-somebody-comes-at-you';

async function prepared(following: boolean, count = 3, leaderOrdinal = 14) {
    const h = await makeGameInWorld({ seed: 'party-on-forbidden-ground', worldSeed: 'party-on-forbidden-ground-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!, day = routineTime(world);
    const home = makeLocation({ id: 'party-fight-home', name: 'Reed Court', kind: 'settlement' });
    const ground = makeLocation({ id: 'party-fight-ground', name: 'Sealed Wood', kind: 'wilds', tags: ['forbidden-ground'] });
    linkLocations(home, ground, 'road', 1);
    world.locations.push(home, ground);
    const people = ['leader', 'companion'].map((id, index) => setRealm(createNpc(world.seed, {
        id: 'party-fight-' + id, locationId: ground.id, onDay: day, bornOnDay: day - 25 * 365 }), index ? 0 : leaderOrdinal, day));
    const ids = [cultivator.id, ...people.map(person => person.id)];
    const itinerary = appendWorldFact(world, makeFact({ day, kind: 'gathering', locationId: ground.id,
        visibility: 'secret', summary: 'The accepted party reached the forbidden ground.',
        actors: ids.map(id => ({ id, name: id === cultivator.id ? cultivator.name : people.find(person => person.id === id)!.name,
            role: id === people[0]!.id ? 'leader' : 'party_member' })),
        factionIds: [world.factions.find(house => house.dissolvedOnDay === null)!.id],
        data: { publicMission: true, publicRoute: JSON.stringify([{ fromId: home.id, toId: ground.id, by: 'land' }]),
            destinationId: ground.id, publicServiceDays: 10, reason: 'an agreed search', plannedReturnDay: day + 11 } }),
        { bystanders: false, recur: false });
    for (const person of people) person.activity = { kind: 'out_with_a_party', note: 'Searching with the party.',
        sinceDay: day, untilDay: day + 10, withIds: ids.filter(id => id !== person.id),
        ...(following ? { capitalMissionId: itinerary.id, capitalMissionLeg: 1 } : {}) };
    world.npcs.push(...people);
    if (following) world.npcs.find(person => person.id === cultivator.id)!.activity = {
        ...people[0]!.activity!, withIds: people.map(person => person.id) };
    const maxHp = maxHpForOrdinal(cultivator.attributes.might, 3);
    const maxQi = maxQiForOrdinal(cultivator.attributes.insight, 3);
    h.game.repos.cultivators.update(cultivator.id, { location: ground.name, realmOrdinal: 3,
        hp: maxHp, maxHp, qi: maxQi, maxQi, spiritStones: 57 });
    h.game.theWorldMoved();
    const current = h.game.currentRun();
    if (following) expect(bindFollowingParty(h.game, current.run, current.cultivator, people[0]!.id, itinerary.id).ok).toBe(true);
    const entry = ENCOUNTERS.find(row => row.id === 'enc-spirit-wolf-pack')!;
    const occurrence = resolveOccurrence({ entry, activity: 'travel', ordinal: 3, maxHp, hp: maxHp, spiritStones: 57,
        absoluteDay: current.run.elapsedDays, dayOffset: 0, values: { count, place: ground.name },
        grants: [], castIds: [], cast: [], outcome: 'landed' });
    expect(occurrence.confrontation?.count).toBe(count);
    return { ...h, world, day, ground, people, current, occurrence };
}

describe('a real party fights on forbidden ground', () => {
    it('the leader stands beside the follower and the other companion pays for their own fight', async () => {
        const h = await prepared(true);
        const before = bodyStandingOn(h.people[1]!, h.day);
        const fight = theyCameAtYou(h.game, h.current.run, h.current.cultivator,
            h.game.ambientFor(h.current.cultivator, h.current.run), { occurrences: [h.occurrence],
                firstInterruptDay: h.day, checks: 1, poolSize: 1 })!;
        expect(fight).not.toBeNull();
        expect(fight.facts.lines.join('\n')).toContain(h.people[0]!.name + ' fights beside you');
        expect(fight.facts.lines.join('\n')).toContain(h.people[1]!.name);
        expect(fight.facts.lines.join('\n')).toContain('the beasts');
        expect(fight.facts.lines.join('\n')).not.toContain('the cultivator attacks');
        const hurt = h.world.npcs.find(person => person.id === h.people[1]!.id)!;
        expect(bodyStandingOn(hurt, h.day)).toBeLessThan(before);
        expect(hurt.cultivation.bodyOnDay).toBe(h.day);
        expect(h.game.fight?.alongside).toBeUndefined();
        expect(theSpeciesItIs(h.game.fight!.theirRecord!)?.id).toBe('beast-grey-wolf-pack');
        let said = fight.facts.lines.join('\n');
        for (let round = 0; h.game.fight && h.game.currentRun().cultivator.alive && round < 20; round++)
            said += '\n' + (await h.game.act('I strike')).narration;
        expect(h.game.fight).toBeNull();
        expect(h.game.currentRun().cultivator.alive, said).toBe(true);
        expect(pendingPartyQuestion(h.world, h.people[0]!.id), said).not.toBeNull();
        expect(said).toContain('asks the party whether to continue, rest or turn back');
        expect(h.game.currentRun().cultivator.location).toBe(h.ground.name);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(57);
    });

    it('the same melee includes a player-led company without a paid vehicle', async () => {
        const h = await prepared(false), before = bodyStandingOn(h.people[1]!, h.day);
        const fight = theyCameAtYou(h.game, h.current.run, h.current.cultivator,
            h.game.ambientFor(h.current.cultivator, h.current.run), { occurrences: [h.occurrence],
                firstInterruptDay: h.day, checks: 1, poolSize: 1 })!;
        expect(fight).not.toBeNull();
        expect(fight.facts.lines.join('\n')).toContain('fights beside you');
        expect(fight.facts.lines.join('\n')).toContain(h.people[1]!.name);
        expect(bodyStandingOn(h.world.npcs.find(person => person.id === h.people[1]!.id)!, h.day)).toBeLessThan(before);
    });
    it('one attacker still meets the real companion while the player guards', async () => {
        const h = await prepared(true, 1, 7);
        theyCameAtYou(h.game, h.current.run, h.current.cultivator,
            h.game.ambientFor(h.current.cultivator, h.current.run), { occurrences: [h.occurrence],
                firstInterruptDay: h.day, checks: 1, poolSize: 1 });
        expect(h.game.fight?.foregroundParty?.ally.id).toBe(h.people[0]!.id);
        const answer = await h.game.act('I guard');
        const exchanges = h.game.fight?.state.exchanges ?? h.game.fightJustEnded;
        expect(exchanges).not.toBeNull();
        expect(answer.narration).toContain(h.people[0]!.name);
        expect(answer.narration).toContain('lands');
        expect(answer.narration).not.toContain('you land');
        expect(h.game.currentRun().cultivator.alive).toBe(true);
    });
    it('an insufficient companion does not make the player survive two foreground wolves', async () => {
        const h = await prepared(true, 3, 4);
        theyCameAtYou(h.game, h.current.run, h.current.cultivator,
            h.game.ambientFor(h.current.cultivator, h.current.run), { occurrences: [h.occurrence],
                firstInterruptDay: h.day, checks: 1, poolSize: 1 });
        for (let round = 0; h.game.fight && h.game.currentRun().cultivator.alive && round < 20; round++)
            await h.game.act('I strike');
        expect(h.game.currentRun().cultivator.alive).toBe(false);
        expect(h.game.fight).toBeNull();
    });

    it('trying to leave the fight pays for flight while the companion resolves their own fight', async () => {
        const h = await prepared(true, 1, 7);
        theyCameAtYou(h.game, h.current.run, h.current.cultivator,
            h.game.ambientFor(h.current.cultivator, h.current.run), { occurrences: [h.occurrence],
                firstInterruptDay: h.day, checks: 1, poolSize: 1 });
        const before = h.game.currentRun().cultivator.hp;
        const turn = await h.game.act('I break off toward Reed Court');
        const left = h.game.fight?.state.hp[h.current.cultivator.id] ?? h.game.currentRun().cultivator.hp;
        expect(left, turn.narration).toBeLessThan(before);
        expect(turn.narration).toMatch(/clear|caught|attempt|cost/i);
        expect(h.world.npcs.find(person => person.id === h.people[0]!.id)?.status).toBe('alive');
        expect(h.world.npcs.find(person => person.id === h.current.cultivator.id)!.locationId).toBeNull();
    });

    it('recreating the service preserves the stopped party and its actual fight round', async () => {
        const h = await prepared(true, 1, 7);
        theyCameAtYou(h.game, h.current.run, h.current.cultivator,
            h.game.ambientFor(h.current.cultivator, h.current.run), { occurrences: [h.occurrence],
                firstInterruptDay: h.day, checks: 1, poolSize: 1 });
        await h.game.act('I guard');
        const held = h.game.fight!;
        expect(held).not.toBeNull();
        const rounds = held.state.roundsFought, hp = held.state.hp[h.current.cultivator.id];
        const restored = new GameService({ db: h.db, narrator: h.narrator, worldEnabled: true });
        expect(restored.fight?.state.id).toBe(held.state.id);
        expect(restored.fight?.state.roundsFought).toBe(rounds);
        expect(restored.fight?.state.hp[h.current.cultivator.id]).toBe(hp);
        expect(restored.fight?.partyFightFactId).toBe(held.partyFightFactId);
        const answer = await restored.act('I guard');
        expect(answer.narration).toContain(h.people[0]!.name);
        expect(restored.fight?.state.roundsFought ?? rounds + 1).toBe(rounds + 1);
        for (let round = 0; restored.fight && round < 30; round++) await restored.act('I guard');
        expect(restored.fight).toBeNull();
        expect(new GameService({ db: h.db, narrator: h.narrator, worldEnabled: true }).fight).toBeNull();
    });

});
