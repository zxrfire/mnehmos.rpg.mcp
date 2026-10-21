/**
 * Gemma findings 4/29: walking up to a person became an unresolved geographic
 * destination and discarded the following question/blow. An honorific plus a
 * known surname also failed. The model reads the description; the engine must
 * resolve the actual local listener, pay any real approach and continue.
 */
import { expect, it } from 'vitest';
import { makeGame, makeGameInWorld, ScriptedProvider } from './harness.js';
import { resolveCultivator } from '../../src/web/entities.js';

it('resolves an honorific and surname without inventing a relationship', async () => {
    const h = makeGame({ seed: 'reading-person-address' });
    try {
        await h.game.newRun('Visitor');
        const me = h.game.currentRun().cultivator;
        const actual = { ...h.repos.cultivators.roster()[0], id: 'guardian', name: 'Ning Jingzhi', sex: 'female' as const };
        const scope = { gate: h.game.knowledge, holderId: me.id, here: me.location, present: [actual] };
        expect(resolveCultivator(h.repos, 'grandma ning', me.id, scope)?.id).toBe(actual.id);
        expect(resolveCultivator(h.repos, 'grandma nobody', me.id, scope)).toBeNull();
        expect(resolveCultivator(h.repos, 'grandma ning', me.id, { ...scope,
            present: [actual, { ...actual, id: 'other-ning', name: 'Ning Yun' }] })).toBeNull();
    } finally { h.db.close(); }
});

it('a model-read approach to a real person does not discard the following blow', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The people are here.'] });
    const h = await makeGameInWorld({ seed: 'open-1', worldSeed: 'w-open-1', provider });
    try {
        await h.game.newRun('Walker');
        plans.push(JSON.stringify({ action: 'look' }));
        await h.game.act('I look around');
        const body = h.game.currentRun().cultivator;
        const person = h.game.present(body).find(person => h.game.knowledge.isAwareOf(body.id, 'cultivator', person.id))!;
        expect(person).toBeDefined();
        plans.push(JSON.stringify({ steps: [
            { action: 'move', intent: 'approach', target: person.name, said: 'i walk up to the guy in the fancy colours' },
            { action: 'attack', target: person.name, said: 'punch him in the face' }
        ] }));
        const reply = await h.game.act('i walk up to the guy in the fancy colours and punch him in the face');
        expect(reply.toolCalls.some(call => call.name === 'combat.round' || call.name === 'combat_manage.resolve'), JSON.stringify(reply.toolCalls)).toBe(true);
        expect(h.game.currentRun().cultivator.location).toBe(body.location);
    } finally { h.db.close(); }
});

it('keeps a question after approaching a person by an honorific', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The words are exchanged.'] });
    const h = await makeGameInWorld({ seed: 'open-1', worldSeed: 'w-open-1', provider });
    try {
        await h.game.newRun('Visitor');
        const body = h.game.currentRun().cultivator;
        const person = h.game.present(body)[0]!;
        const alias = `elder ${person.name}`;
        const said = `i go over to ${alias}`;
        plans.push(JSON.stringify({ steps: [
            { action: 'move', intent: 'approach', target: alias, said },
            { action: 'interact', intent: 'talk', target: alias, topic: 'What are you selling?', said: 'ask what you are selling' }
        ] }));
        const reply = await h.game.act(`${said} and ask what you are selling`);
        expect(reply.toolCalls.some(call => call.action === 'interact' && !call.name.startsWith('narrator.')), JSON.stringify(reply.toolCalls)).toBe(true);
        expect(reply.toolCalls.some(call => call.name === 'engine.resolvePlace' && !call.ok)).toBe(false);
    } finally { h.db.close(); }
});
