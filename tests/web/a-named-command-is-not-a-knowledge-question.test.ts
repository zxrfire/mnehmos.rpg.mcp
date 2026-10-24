/** Replay R4/R5: a named command was answered as knowledge of its words.
 * Scripted command readings must reach the actual seal/order writer when
 * bound; an unsealed listener hears speech, never a fabricated question.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { validatePlan } from '../../src/web/planned-action.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { writeActualPersonSeal } from '../../src/web/person-seals-at-the-actual-body.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { agreeOpenContract } from '../../src/engine/social/open-contracts.js';
import { writeObligations } from '../../src/storage/repos/obligation.repo.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { unfinishedSlaveOrders } from '../../src/engine/world/slave-orders.js';

it('keeps a command distinct from a question in the speech lane', () => {
    expect(validatePlan({ lane: 'speak', intent: 'command_person', target: 'the listener', topic: 'Kneel before me.' })).toEqual({
        ok: true, action: { action: 'interact', intent: 'command', target: 'the listener', topic: 'kneel before me.' }
    });
});

for (const binding of ['slave', 'word', 'none', 'absent'] as const) it(`reads a named command with ${binding} binding as an order or speech, not knowledge`, async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The listener answers.'] });
    const h = await makeGameInWorld({ seed: 'reading2-command', worldSeed: 'reading2-command-world', provider });
    try {
        const { cultivator } = await h.game.newRun('Speaker');
        const world = h.game.atHand!, day = routineTime(world);
        const place = worldLocationFor(world, cultivator.location)!;
        const area = theAreasOf(world, place).areas.find(area => area.for === 'street')!;
        const subject = createNpc(world.seed, { id: 'reading2-listener', name: 'The Listener',
            onDay: day, bornOnDay: day - 25 * 365, locationId: place.id });
        subject.activity = { kind: 'idle', note: 'Listening here.', withIds: [], sinceDay: day, untilDay: null, standingIn: area.id };
        world.npcs.push(subject);
        h.repos.cultivators.standIn(cultivator.id, area.id);
        h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, subject);
        if (binding === 'slave' || binding === 'absent') writeActualPersonSeal(h.game, subject.id, {
            kind: 'slave', byId: cultivator.id, sinceDay: day, liftsOnDay: null, note: 'The actual held seal.'
        }, day);
        if (binding === 'absent') {
            const remote = makeLocation({ id: 'unreached-listener', name: 'A distant cave', kind: 'cave' });
            world.locations.push(remote);
            world.npcs.find(person => person.id === subject.id)!.locationId = remote.id;
        }
        if (binding === 'word') writeObligations(h.db, agreeOpenContract({ firstId: subject.id, secondId: cultivator.id,
            firstTerms: 'I will hear your orders.', secondTerms: 'I will provide food.', firstConsents: true,
            secondConsents: true, binding: 'word', end: { condition: 'When released.' }, day, eventId: 'reading2-word' }));
        h.game.theWorldMoved();
        plans.push(JSON.stringify({ lane: 'speak', intent: 'command_person', target: subject.name, topic: 'kneel before me. now.' }));
        const reply = await h.game.act(`${subject.name}, kneel before me. now.`);
        expect(reply.toolCalls.some(call => call.name === 'engine.askedAbout'), JSON.stringify(reply.toolCalls)).toBe(false);
        if (binding === 'absent') {
            expect(reply.toolCalls.some(call => call.name === 'engine.spokenCommand')).toBe(false);
            expect(h.game.atHand!.history.facts.some(fact => fact.data.slaveOrder === true)).toBe(false);
            const card = provider.calls.at(-1)!.messages.map(message => message.content).join('\n');
            expect(card).toContain('The failed address has no listener replying');
            return;
        }
        if (binding === 'slave') {
            expect(h.game.atHand!.history.facts.some(fact => fact.data.slaveOrder === true && fact.data.slaveId === subject.id)).toBe(true);
            expect(h.game.atHand!.memories.records.some(memory => memory.ownerId === subject.id && memory.tags.includes('slave-order'))).toBe(true);
            const heardOrders = h.game.atHand!.history.facts.filter(fact => fact.data.slaveOrder === true).length;
            plans.push(JSON.stringify({ lane: 'speak', intent: 'ask_them_a_question', target: subject.name,
                topic: 'what would happen if I command you to wait here?' }));
            await h.game.act(`${subject.name}, what would happen if I command you to wait here?`);
            expect(h.game.atHand!.history.facts.filter(fact => fact.data.slaveOrder === true)).toHaveLength(heardOrders);
            // A literal order is already read as an instruction. The fallback
            // verb vocabulary must not erase a bodily request it cannot execute.
            plans.push(JSON.stringify({ lane: 'speak', intent: 'command_person', target: subject.name, topic: 'dance and wait' }));
            await h.game.act(`${subject.name}, I command you: dance and wait`);
            const pending = unfinishedSlaveOrders(h.game.atHand!).find(fact => fact.data.slaveId === subject.id)!;
            const literal = JSON.parse(String(pending.data.order));
            expect(literal.action).toBe('request');
            expect(literal.words).toBe('dance');
            expect(literal.following[0].action).toBe('wait');
            const victim = createNpc(world.seed, { id: 'reading2-victim', name: 'The Other Person',
                onDay: day, bornOnDay: day - 25 * 365, locationId: place.id });
            // Replay2 N3: the named victim can precede the commanded person in the roster.
            h.game.atHand!.npcs.unshift(victim);
            h.game.theWorldMoved();
            plans.push(JSON.stringify({ lane: 'speak', intent: 'command_person', target: subject.name, topic: `go kill ${victim.name}` }));
            const attackOrder = await h.game.act(`${subject.name}, I command you: go kill ${victim.name}`);
            expect(attackOrder.toolCalls.some(call => call.name === 'engine.askedAbout')).toBe(false);
            const written = h.game.atHand!.history.facts.find(fact => fact.data.slaveOrder === true
                && JSON.parse(String(fact.data.order)).action === 'attack');
            expect(written).toBeDefined();
            expect(written!.data.holderId).toBe(cultivator.id);
            expect(written!.data.slaveId).toBe(subject.id);
            expect(JSON.parse(String(written!.data.order)).targetId).toBe(victim.id);
        } else {
            expect(reply.toolCalls.some(call => call.name === 'engine.spokenCommand' && call.ok)).toBe(true);
            expect(h.game.atHand!.history.facts.some(fact => fact.data.slaveOrder === true)).toBe(false);
            if (binding === 'word') expect(provider.calls.at(-1)!.messages.map(message => message.content).join('\n')).toContain('I will hear your orders.');
        }
        expect(h.game.state().fight).toBeNull();
    } finally { h.db.close(); }
});
