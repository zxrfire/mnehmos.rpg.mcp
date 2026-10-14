/**
 * A human in a private hunt formerly made native combat stand down without a
 * foreground replacement. A pending beast is unfinished work, and the real
 * party first settles its danger question. These bounded played samples retain
 * both outcomes: a leader can overrule the human and turn back, or actual consent
 * can reach the existing shared melee. No sample forces a voice or a winner.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { maxHpForOrdinal, maxQiForOrdinal } from '../../src/engine/cultivation/realms';
import { makeLocation, linkLocations } from '../../src/engine/world/locations';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { invitePlayerToPrivateParty } from '../../src/engine/world/a-private-party-invites-the-player';
import { withPrivatePlayerContact } from '../../src/web/joining-a-private-party';
import { followedParty } from '../../src/web/following-the-party-leader';
import { HUNTING_DAYS } from '../../src/engine/world/hunting-a-spirit-beast';
import { factsWithDataValue } from '../../src/engine/world/witness-reaction-index';
import { theSpeciesItIs } from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular';

it('a real danger vote can overrule the human or enter the actual shared hunt fight', async () => {
    let fought = 0, overruled = 0;
    for (let sample = 0; sample < 4; sample++) {
        const h = await makeGameInWorld({ seed: 'private-player-hunt', worldSeed: 'private-player-hunt-world-' + sample });
        const { cultivator } = await h.game.newRun('Hunter');
        const world = h.game.atHand!, day = routineTime(world);
        const from = makeLocation({ id: 'hunter-home', name: 'Hunter Court', kind: 'settlement' });
        const to = makeLocation({ id: 'hunter-ground', name: 'Hunter Wood', kind: 'wilds',
            thresholds: { entry: 0, survival: 0, operational: 0, mastery: 0 } });
        linkLocations(from, to, 'road', 0.25);
        world.locations.push(from, to);
        const leader = createNpc(world.seed, { id: 'private-hunt-leader', name: 'Chen Ru', onDay: day,
            bornOnDay: day - 24 * 365, locationId: from.id, spiritStones: 100,
            cultivation: { realmOrdinal: 3 } });
        world.npcs.push(leader);
        h.game.repos.cultivators.update(cultivator.id, { location: from.name, realmOrdinal: 3,
            maxHp: maxHpForOrdinal(cultivator.attributes.might, 3), hp: maxHpForOrdinal(cultivator.attributes.might, 3),
            maxQi: maxQiForOrdinal(cultivator.attributes.insight, 3), qi: maxQiForOrdinal(cultivator.attributes.insight, 3) });
        h.game.repos.cultivators.standIn(cultivator.id, theAreasOf(world, from).whereIs.get(leader.id)!);
        const offer = withPrivatePlayerContact(h.game, h.game.state().cultivator, () => invitePlayerToPrivateParty(world,
            leader, cultivator.id, to.id, day, 'hunt'));
        expect(offer).not.toBeNull();
        h.game.theWorldMoved();
        await h.game.act('I accept the private party invitation');
        const party = followedParty(h.db, h.game.atHand!, cultivator.id)!;
        const arrived = await h.game.act(`I wait ${HUNTING_DAYS + 0.25} days`);
        const questionId = h.game.atHand!.npcs.find(person => person.id === leader.id)?.activity?.partyQuestionId;
        expect(questionId, arrived.narration).toBeTypeOf('string');
        expect(h.game.fight).toBeNull();
        const answer = await h.game.act('I tell the party to continue');
        const decision = factsWithDataValue(h.game.atHand!, 'partyQuestionDecided', questionId!)[0];
        expect(decision, answer.narration).toBeDefined();
        const voices = JSON.parse(String(decision.data.partyVoices)) as { personId: string; choice: string }[];
        expect(voices.map(voice => voice.personId).sort()).toEqual([cultivator.id, leader.id].sort());
        expect(voices.find(voice => voice.personId === cultivator.id)?.choice).toBe('continue');
        expect(h.game.fight).toBeNull(); // The settled decision is heard before the next movement.
        if (decision.data.choice === 'turn_back') {
            overruled++;
            expect(answer.narration).toContain('decided to turn back');
            await h.game.act('I leave the party');
            expect(h.game.state().cultivator.location).toBe(to.name);
            expect(followedParty(h.db, h.game.atHand!, cultivator.id)).toBeNull();
            continue;
        }
        const next = await h.game.act('I wait 1 day');
        expect(h.game.fight, next.narration).not.toBeNull();
        fought++;
        expect(h.game.fight!.foregroundParty?.ally.id).toBe(leader.id);
        expect(h.game.state().cultivator.location).toBe(to.name);
        const pending = factsWithDataValue(h.game.atHand!, 'privateHuntPending', party.itinerary.id)[0];
        expect(h.game.fight!.theirRecord!.id).toBe(pending.data.beastId);
        expect(theSpeciesItIs(h.game.fight!.theirRecord!)).not.toBeNull();
        expect(factsWithDataValue(h.game.atHand!, 'privateHuntResolved', party.itinerary.id)).toHaveLength(0);
        if (fought === 1) {
            for (let round = 0; round < 20 && h.game.fight && h.game.state().cultivator.alive; round++)
                await h.game.act('I strike');
            expect(h.game.fight).toBeNull();
            const ended = factsWithDataValue(h.game.atHand!, 'privateHuntResolved', party.itinerary.id)[0];
            expect(ended, JSON.stringify({ pending, opened: h.game.atHand!.history.facts.filter(fact =>
                fact.data.privateHuntFightOpened === pending.id || fact.data.partyFightEnded),
                native: h.game.atHand!.npcs.find(person => person.id === leader.id)?.activity,
                body: h.game.state().cultivator.alive })).toBeDefined();
            expect(ended.data.finished).toBe(h.game.atHand!.npcs.find(person => person.id === pending.data.beastId)!.status !== 'alive');
        }
    }
    expect(fought).toBeGreaterThan(0);
    expect(overruled).toBeGreaterThan(0);
}, 120000);
