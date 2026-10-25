/** Replay3 N6: the kill reached melee, but the reply hid its outcome. Scripted
 * orders must deliver the actual result, or absence, to the narrator input. */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { writeActualPersonSeal } from '../../src/web/person-seals-at-the-actual-body.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';

for (const present of [true, false]) it(`reports the actual ordered attack to the narrator (${present ? 'death' : 'absent target'})`, async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The resolved outcome is heard.'] });
    const h = await makeGameInWorld({ seed: 'reading4-command', worldSeed: 'reading4-command-world', provider });
    try {
        const { cultivator } = await h.game.newRun('Holder');
        const world = h.game.atHand!, day = routineTime(world);
        const place = worldLocationFor(world, cultivator.location)!;
        world.npcs = world.npcs.filter(person => person.id === cultivator.id);
        const areas = theAreasOf(world, place).areas.filter(area => area.for !== 'room');
        const area = areas[0];
        const ordinal = (key: string) => REALM_TIERS.find(tier => tier.key === key)!.ordinalStart;
        const slave = createNpc(world.seed, { id: 'reading4-hand', name: 'The Bound Person', onDay: day,
            bornOnDay: day - 25 * 365, locationId: place.id,
            cultivation: { realmOrdinal: ordinal('nascent_soul') } });
        const victim = createNpc(world.seed, { id: 'reading4-target', name: 'The Other Person', onDay: day,
            bornOnDay: day - 25 * 365, locationId: place.id,
            cultivation: { realmOrdinal: ordinal('foundation_establishment') } });
        for (const person of [slave, victim]) person.activity = { kind: 'talking', note: 'The actual encounter.',
            withIds: [cultivator.id], sinceDay: day, untilDay: day + 1, standingIn: area.id };
        if (!present) victim.activity = { ...victim.activity!, kind: 'stationed', withIds: [], standingIn: areas[1].id };
        world.npcs.push(slave, victim);
        h.repos.cultivators.standIn(cultivator.id, area.id);
        writeActualPersonSeal(h.game, slave.id, { kind: 'slave', byId: cultivator.id,
            sinceDay: day, liftsOnDay: null, note: 'Actual held seal.' }, day);
        for (const person of [slave, victim]) h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, person);
        h.game.theWorldMoved();
        plans.push(JSON.stringify({ lane: 'speak', intent: 'command_person', target: slave.name, topic: `kill ${victim.name}`,
            orders: [{ action: 'attack', target: victim.name, destination: area.name, words: `kill ${victim.name}` }] }));
        const reply = await h.game.act(`${slave.name}, I command you to kill ${victim.name}`);
        const actual = h.game.atHand!.npcs.find(person => person.id === victim.id)!;
        expect(actual.status).toBe(present ? 'physically_dead' : 'alive');
        const outcome = present ? `${victim.name} died` : `${victim.name} is not at`;
        const command = h.game.atHand!.history.facts.find(fact => fact.data.slaveOrder === true)!;
        expect(h.game.atHand!.history.facts.find(fact => fact.data.slaveOrderEnded === command.id)?.summary).toContain(outcome);
        expect(JSON.stringify(reply.toolCalls)).toContain(outcome);
        expect(provider.calls.at(-1)!.messages.map(message => message.content).join('\n')).toContain(outcome);
        if (present) expect(h.game.atHand!.history.facts.find(fact => fact.kind === 'death'
            && fact.actors.some(actor => actor.id === victim.id))?.data.commandedBy).toBe(cultivator.id);
        else expect(provider.calls.at(-1)!.messages.map(message => message.content).join('\n')).toContain('No attack occurred.');
        expect(h.game.atHand!.memories.records.some(memory => memory.ownerId === slave.id && memory.tags.includes('slave-order'))).toBe(true);
    } finally { h.db.close(); }
});
