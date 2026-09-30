/**
 * A conversation must reach schedules and memories, not only a person's name.
 * The pinned world supplies one speaker. Their local opening and held channel
 * reach the model; a distant secret does not. Telling records the listener's
 * knowledge. A witness remembers a crossing; merely being old enough does not.
 * The removed remote-actor prototype supplied reach without a persisted actor;
 * the played interaction must still refuse somebody who is elsewhere.
 */
import { expect, it } from 'vitest';
import type { ProviderCallOpts, ProviderCallResult } from '../../src/agent/provider/types';
import { appendFact, makeFact } from '../../src/engine/world/history';
import { applyLocationChange } from '../../src/engine/world/locations';
import { LID_CHANNEL_TAG } from '../../src/engine/world/immortal-world';
import { claimOpportunity, makeOpportunity } from '../../src/engine/world/opportunities';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import { makeRequirements } from '../../src/engine/world/capability';
import { makeObject } from '../../src/engine/world/possessions';
import { upsertRelationship } from '../../src/engine/world/npc-state';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { engineCalls, makeGameInWorld, ScriptedProvider } from './harness';

class Conversation extends ScriptedProvider {
    plan = '{"action":"look"}';
    constructor() { super({ narrations: ['They answer.'] }); }
    override async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        if (!(opts.messages.find(m => m.role === 'system')?.content ?? '').startsWith('You are the intent router')) {
            return super.call(opts);
        }
        this.calls.push(opts);
        return { text: this.plan, raw: this.plan, durationMs: 0 };
    }
    prompt(): string {
        return this.calls.filter(call =>
            !(call.messages.find(m => m.role === 'system')?.content ?? '').startsWith('You are the intent router'))
            .at(-1)?.messages.find(m => m.role === 'user')?.content ?? '';
    }
}

it('tells local schedules and carries witnessed history and private channel facts into a played conversation', async () => {
    const provider = new Conversation();
    const h = await makeGameInWorld({ worldSeed: 'memory-and-openings', seed: 'conversation', provider });
    const { cultivator } = await h.game.newRun('Shen Ke');
    const world = (await h.game.loadWorld())!;
    const ground = worldLocationFor(world, cultivator.location)!;
    const speaker = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id && n.cultivation.realmOrdinal < 10)!;
    for (const n of world.npcs) if (n.locationId === ground.id && n.id !== cultivator.id) n.locationId = null;
    speaker.locationId = ground.id;
    speaker.activity = null;
    h.game.repos.cultivators.standIn(cultivator.id, theAreasOf(world, ground).whereIs.get(speaker.id)!);
    h.game.knowledge.learnIfNew({
        holderId: cultivator.id, kind: 'cultivator', id: speaker.id, name: speaker.name,
        onDay: world.currentDay, sourceKind: 'witnessed', stage: 'encountered'
    });

    const day = world.currentDay;
    const crossed = appendFact(world.history, makeFact({
        day: day - 365, kind: 'ascension', summary: 'A final crossing completed here.',
        locationId: ground.id, witnessIds: [speaker.id]
    }));
    const at = world.locations.findIndex(l => l.id === ground.id);
    world.locations[at] = applyLocationChange(ground, {
        onDay: day - 365, kind: 'enriched', summary: 'The ground gained qi.',
        causeFactId: crossed.id, patch: { data: { ...ground.data, crossingYear: day / 365 - 1 } }
    }).location;
    world.objects.push(makeObject({
        id: 'held-channel', name: 'A channel tablet', kind: 'other',
        possessorId: speaker.id, tags: [LID_CHANNEL_TAG], data: { lastAnsweredOnDay: day - 730 }
    }));
    world.opportunities = [
        makeOpportunity({ id: 'local', kind: 'resource', name: 'A local harvest',
            summary: 'The local fruit ripens.', locationId: ground.id,
            opensOnDay: day + 2, durationDays: 3, recurrenceDays: 10 }),
        makeOpportunity({ id: 'secret', kind: 'inheritance', name: 'A distant inheritance',
            summary: 'A distant seal opens.', opensOnDay: day + 1, durationDays: 3 }),
        makeOpportunity({ id: 'unreadable', kind: 'realm_opening', name: 'An unreadable seal',
            summary: 'An unreadable seal opens.', locationId: ground.id,
            requirements: makeRequirements({ understand: MAX_ORDINAL }), opensOnDay: day + 1, durationDays: 3 })
    ];
    provider.plan = JSON.stringify({ action: 'interact', intent: 'talk', target: speaker.name, topic: 'opportunities' });
    h.game.theWorldMoved();
    await h.game.act('What opportunities are coming up?');
    expect(provider.prompt()).toContain('The local fruit ripens. Opens in 2 days; closes in 5 days.');
    expect(provider.prompt()).not.toContain('A distant seal opens.');
    expect(provider.prompt()).not.toContain('An unreadable seal opens.');
    expect(world.opportunities[0].knownToIds).toContain(cultivator.id);
    expect(world.opportunities[1].knownToIds).not.toContain(cultivator.id);
    expect(provider.prompt()).toMatch(/lived through it, 1 year[s]? ago: The qi here rose after a completed final crossing/);
    expect(provider.prompt()).toContain('The last answer arrived 2 years ago.');
    expect(provider.prompt()).toContain('The silence does not establish what happened on the far side.');

    // The fruit is gone for this opening, but the next opening can still be told.
    world.opportunities[0] = claimOpportunity(world.opportunities[0], speaker.id, day + 2).opportunity;
    world.currentDay = day + 3;
    h.game.theWorldMoved();
    await h.game.act('What opportunities are coming up?');
    expect(provider.prompt()).toContain('The local fruit ripens. Opens in 9 days; closes in 12 days.');

    crossed.witnessIds = [];
    h.game.theWorldMoved();
    await h.game.act('What opportunities are coming up?');
    expect(provider.prompt()).not.toContain('The qi here rose after a completed final crossing');

    const teacher = world.npcs.find(n => n.status === 'alive' && n.id !== speaker.id && n.id !== cultivator.id)!;
    crossed.witnessIds = [teacher.id];
    speaker.relationships = upsertRelationship(speaker, {
        targetId: teacher.id, targetName: teacher.name, kind: 'teacher', standing: 0
    }, day).relationships;
    h.game.theWorldMoved();
    await h.game.act('What opportunities are coming up?');
    expect(provider.prompt()).toMatch(/told it by somebody who was there, 1 year[s]? ago: The qi here rose/);
    expect(provider.prompt()).not.toMatch(/lived through it, 1 year[s]? ago: The qi here rose/);

    speaker.locationId = world.locations.find(l => l.id !== ground.id && l.kind !== 'region')!.id;
    h.game.theWorldMoved();
    const refused = await h.game.act(`I ask ${speaker.name} about opportunities`);
    expect(engineCalls(refused).some(call => !call.ok)).toBe(true);
}, 120_000);
