/** Owner ruling: a slave obeys any order, including an attack on a town. ADMIN
 * arranges the real seal, never a flag. Orders travel on a real course and melee
 * decides named deaths. Replacement frees the prior person with their memory.
 * Both world and run seeds are pinned; no result depends on a previous file's world.
 * Town defenders stand at Foundation so the existing sweep does not immediately
 * forget unremembered mortal corpses. The deaths and their bodies remain inspectable. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import { createNpc, relationshipWith } from '../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { holdsASlaveSeal } from '../../src/engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { swornSiblingsOf } from '../../src/engine/world/close-people-go-together.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { witnessReactions } from '../../src/engine/world/witness-reactions.js';
import { whoTheyAreOutWith } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { forgetWorld, worldForRun } from '../../src/server/state/cultivation-world.js';

let admin: string | undefined;
beforeEach(() => { admin = process.env.ADMIN_MODE; process.env.ADMIN_MODE = 'true'; });
afterEach(() => { if (admin === undefined) delete process.env.ADMIN_MODE; else process.env.ADMIN_MODE = admin; });
async function prepared() {
    const h = await makeGameInWorld({ seed: 'actual-slave-command', worldSeed: 'actual-slave-command-world' });
    const { cultivator } = await h.game.newRun('Holder');
    const home = makeLocation({ id: 'seal-home', name: 'Seal Home', kind: 'settlement' });
    const town = makeLocation({ id: 'seal-town', name: 'River Town', kind: 'settlement' });
    linkLocations(home, town, 'road', 2);
    h.game.atHand!.locations.push(home, town);
    h.game.repos.cultivators.update(cultivator.id, { location: home.name });
    h.game.theWorldMoved();
    return { ...h, home, town };
}
async function spawn(h: Harness, line: string) {
    const before = new Set(h.game.atHand!.npcs.map(person => person.id));
    const result = await h.game.act(line);
    const added = h.game.atHand!.npcs.filter(person => !before.has(person.id));
    expect(added, result.narration).toHaveLength(1);
    return { person: added[0], result };
}
describe('real slave and qi seals through ADMIN and play', () => {
    it('spawns a real slave to me, compels a guard, and keeps the record on reopening', async () => {
        const h = await prepared();
        const { person } = await spawn(h, 'ADMIN spawn_encounter a person at Core Formation named Mo Shan, slave sealed to me');
        expect(holdsASlaveSeal(person.cultivation.seal, h.game.currentRun().cultivator.id, routineTime(h.game.atHand!))).toBe(true);
        const ordered = await h.game.act('I order my slave to guard Seal Home');
        expect(ordered.narration).toContain('compelled');
        const actual = h.game.atHand!.npcs.find(npc => npc.id === person.id)!;
        expect(actual.activity?.kind).toBe('stationed');
        expect(h.game.atHand!.memories.records.some(memory => memory.ownerId === person.id && memory.tags.includes('slave-order'))).toBe(true);
        forgetWorld(h.game.atHand!.id);
        expect((await worldForRun(h.game.currentRun().run)).npcs.find(npc => npc.id === person.id)?.cultivation.seal?.kind).toBe('slave');
    }, 60_000);
    it('supports both kinds and both caster identities, replacing only a slave of the same holder', async () => {
        const h = await prepared();
        const { person: caster } = await spawn(h, 'ADMIN spawn_encounter a man at Nascent Soul named Li Wei');
        const { person: qi } = await spawn(h, 'ADMIN spawn_encounter a person at Foundation named Chen Dao, qi sealed by Li Wei');
        expect(qi.cultivation.seal).toMatchObject({ kind: 'qi', byId: caster.id });
        const { person: ownQi } = await spawn(h, 'ADMIN spawn_encounter a person at Foundation named Mu Feng whose qi I have sealed');
        expect(ownQi.cultivation.seal).toMatchObject({ kind: 'qi', byId: h.game.currentRun().cultivator.id });
        const { person: first } = await spawn(h, 'ADMIN spawn_encounter a person at Foundation named Hong Yu, slave sealed to Li Wei');
        expect(first.cultivation.seal).toMatchObject({ kind: 'slave', byId: caster.id });
        const { person: second } = await spawn(h, 'ADMIN spawn_encounter a person at Foundation named Hong Ren, slave sealed to Li Wei');
        expect(second.cultivation.seal?.byId).toBe(caster.id);
        expect(h.game.atHand!.npcs.find(person => person.id === first.id)?.cultivation.seal).toBeNull();
        expect(h.game.atHand!.npcs.find(person => person.id === qi.id)?.cultivation.seal?.kind).toBe('qi');
    }, 60_000);
    it('makes guesses visible and writes close ties and the same sworn bond as play', async () => {
        const h = await prepared();
        const { person: close, result } = await spawn(h, 'ADMIN spawn_encounter a cheerful old companion at Foundation named Bei Ming');
        expect(result.narration).toContain("Read 'cheerful' as temperament expressive");
        const player = h.game.atHand!.npcs.find(person => person.id === h.game.currentRun().cultivator.id)!;
        expect(relationshipWith(close, player.id)?.standing).toBe(1);
        // A conversation's existing hold is real; after it ends this is ordinary private company.
        close.activity = { kind: 'their_own_business', note: 'Standing with their old companion.',
            withIds: [], sinceDay: routineTime(h.game.atHand!), standingIn: h.game.currentRun().cultivator.standingIn };
        h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, close);
        await withTheAttemptLanding('request', () => h.game.act(`I ask ${close.name} to join my party.`));
        expect(whoTheyAreOutWith(h.game.atHand!.npcs.find(person => person.id === close.id)!, routineTime(h.game.atHand!))?.withIds).toContain(player.id);
        const { person: sibling } = await spawn(h, 'ADMIN spawn_encounter a sworn brother to me at Foundation named Bei Hong');
        expect(swornSiblingsOf(h.game.atHand!, player.id).has(sibling.id)).toBe(true);
        expect(ledgerAbout(h.db, player.id).filter(word => word.cause === 'sworn_brotherhood' && word.status === 'open')).toHaveLength(2);
        expect(h.game.atHand!.obligations.some(word => word.cause === 'sworn_brotherhood' && (word.holderId === player.id || word.subjectId === player.id))).toBe(false);
        const { person: namedClose } = await spawn(h, 'ADMIN spawn_encounter an old companion to Bei Ming at Foundation named Lin Dan');
        expect(relationshipWith(namedClose, close.id)?.standing).toBe(1);
        expect(relationshipWith(h.game.atHand!.npcs.find(person => person.id === close.id)!, namedClose.id)?.standing).toBe(1);
        const { person: namedSibling } = await spawn(h, 'ADMIN spawn_encounter a sworn sister to Bei Ming at Foundation named Lin Yue');
        expect(swornSiblingsOf(h.game.atHand!, close.id).has(namedSibling.id)).toBe(true);
        expect(h.game.atHand!.obligations.filter(word => word.cause === 'sworn_brotherhood'
            && (word.holderId === close.id && word.subjectId === namedSibling.id
                || word.holderId === namedSibling.id && word.subjectId === close.id))).toHaveLength(2);
    }, 60_000);
    it('moves to a town and resolves a commanded attack as real named deaths with command attribution', async () => {
        const h = await prepared(), world = h.game.atHand!, day = routineTime(world);
        const righteous = world.factions.find(house => house.alignment === 'righteous')!;
        const victims = Array.from({ length: 3 }, (_, i) => createNpc(world.seed, { id: `ordered-victim-${i}`,
            name: `River Watch ${i}`, onDay: day, bornOnDay: day - 20 * 365, locationId: h.town.id,
            factionId: righteous.id, factionRankIndex: 0, cultivation: { realmOrdinal: FOUNDATION_ORDINAL } }));
        world.npcs.push(...victims);
        h.game.theWorldMoved();
        const { person: slave } = await spawn(h, 'ADMIN spawn_encounter a person at Nascent Soul named Mo Shan, slave sealed to me');
        const ordered = await h.game.act('I order my slave to attack River Town');
        expect(ordered.narration).toContain('compelled');
        expect(h.game.atHand!.npcs.find(person => person.id === slave.id)?.locationId).not.toBe(h.town.id);
        await h.game.act('I wait for 5 days');
        const now = h.game.atHand!, playerId = h.game.currentRun().cultivator.id;
        const deaths = now.history.facts.filter(fact => fact.kind === 'death' && fact.data.commandedBy === playerId);
        expect(deaths.length).toBeGreaterThan(0);
        expect(deaths.every(death => death.actors.some(actor => actor.id === playerId && actor.role === 'commander'))).toBe(true);
        expect(victims.some(victim => now.npcs.find(person => person.id === victim.id)?.status === 'physically_dead'),
            JSON.stringify({ victims: victims.map(victim => ({ name: victim.name,
                actual: now.npcs.find(person => person.id === victim.id)?.status })), deaths: deaths.map(death => death.summary) })).toBe(true);
        expect(now.memories.records.some(memory => memory.ownerId === slave.id && memory.tags.includes('slave-order'))).toBe(true);
        expect(witnessReactions(now, playerId).length).toBeGreaterThan(0);
        expect(now.obligations.some(word => word.holderId === righteous.id && word.subjectId === playerId
            && (word.kind === 'grudge' || word.kind === 'blood_feud'))).toBe(true);
    }, 60_000);
    it('kills at the holder\'s will through the real named-death path', async () => {
        const h = await prepared();
        const { person } = await spawn(h, 'ADMIN spawn_encounter a person at Foundation named Mo Shan, slave sealed to me');
        const ended = await h.game.act('I kill Mo Shan through my slave seal');
        expect(ended.narration).toContain('killed');
        expect(h.game.atHand!.npcs.find(npc => npc.id === person.id)?.status).toBe('physically_dead');
        expect(h.game.atHand!.history.facts.some(fact => fact.kind === 'death' && fact.actors.some(actor => actor.id === person.id))).toBe(true);
    }, 60_000);
});
