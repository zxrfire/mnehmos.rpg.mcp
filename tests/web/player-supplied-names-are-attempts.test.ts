/**
 * Owner ruling, 2026-10-03: player knowledge across runs may guide a named
 * attempt even when this character has not encountered the house/place.
 * Previously resolveSect/resolveKnownPlace refused that supplied name solely
 * for lacking awareness. This changes the attempted name, not passive discovery,
 * actual presence, doors, admission or service permission. The 2026-10-06
 * clarification retains these questions; recognizing a replay-memory name
 * does not give this character the route needed for remote movement.
 *
 * A second defect was exposed by lifting that gate: investigate filed every
 * resolved place as witnessed and read its live ground, even from another town.
 * A remote name question must leave body, clock and knowledge untouched and
 * return only named information. The paired local read still observes the actual
 * ground and records where it was seen. No model or invented world is used here;
 * the played case pins an ordinary catalog world and scripts only intent/prose.
 */
import { describe, expect, it } from 'vitest';
import { SECTS, REGIONS } from '../../src/data/cultivation/index';
import { resolveSect, resolveKnownPlace, type KnowledgeScope } from '../../src/web/entities';
import { KnowledgeGate } from '../../src/web/knowledge';
import { ProviderNarrator } from '../../src/web/narrator';
import { howTheGroundReads } from '../../src/engine/world/what-a-place-still-has-in-the-ground';
import { makeGame, makeGameInWorld, ScriptedProvider, refusedCall } from './harness';

async function reader() {
    const h = makeGame();
    const { cultivator: me } = await h.game.newRun('Reader');
    const gate = new KnowledgeGate(h.db);
    const scope: KnowledgeScope = { gate, holderId: me.id, here: me.location };
    return { ...h, me, gate, scope };
}

describe('a player-supplied name is an attempt, not an encounter', () => {
    it('accepts a real unheard full house name/key without adding awareness or accepting an unknown fuzzy name', async () => {
        const { repos, me, gate, scope } = await reader();
        const house = SECTS.find(h => !gate.isAwareOf(me.id, 'sect', h.id))!;
        expect(house).toBeDefined();
        const before = gate.awareness(me.id, 'sect');
        expect(resolveSect(repos, house.name, scope)).toMatchObject({ id: house.id, name: house.name });
        expect(resolveSect(repos, house.id, scope)?.id).toBe(house.id);
        expect(resolveSect(repos, 'A house that does not exist', scope)).toBeNull();
        const ordinary = repos.sects.list()[0]!;
        repos.sects.upsert({ ...ordinary, id: 'fixture-unheard-house', name: 'A Solitary Unheard House' });
        expect(resolveSect(repos, 'Solitary Unheard', scope)).toBeNull();
        expect(gate.awareness(me.id, 'sect')).toEqual(before);
    });

    it('uses a stored house name for its stable key instead of reviving its old catalog name', async () => {
        const { repos, scope } = await reader();
        const original = repos.sects.list().find(h => SECTS.some(c => c.id === h.id))!;
        expect(original).toBeDefined();
        repos.sects.upsert({ ...original, name: 'The Changed House' });
        expect(resolveSect(repos, original.id, scope)).toMatchObject({ id: original.id, name: 'The Changed House' });
        expect(resolveSect(repos, 'The Changed House', scope)?.id).toBe(original.id);
    });

    it('refuses an explicitly arranged ambiguous house name instead of choosing an office or rank for the player', async () => {
        const { repos, scope } = await reader();
        const original = repos.sects.list()[0]!;
        expect(original).toBeDefined();
        for (const id of ['fixture-house-a', 'fixture-house-b']) {
            repos.sects.upsert({ ...original, id, name: 'An Ambiguous House' });
        }
        expect(resolveSect(repos, 'An Ambiguous House', scope)).toBeNull();
    });

    it('accepts only a unique actual supplied place and does not write knowledge or invent unknown places', async () => {
        const { me, gate, scope } = await reader();
        const actual = REGIONS.flatMap(r => r.places).find(p => p.name !== me.location)!;
        const suppliedScope = { ...scope, locations: [{ id: 'actual-place', name: actual.name }] };
        const before = gate.awareness(me.id, 'place');
        expect(resolveKnownPlace(actual.name.toUpperCase(), me, suppliedScope)).toMatchObject({ id: 'actual-place', name: actual.name });
        expect(resolveKnownPlace('actual-place', me, suppliedScope)).toBeNull();
        expect(resolveKnownPlace('The Changed Settlement', me, { ...scope,
            locations: [{ id: 'renamed-place', name: 'The Changed Settlement' }] }))
            .toMatchObject({ id: 'renamed-place', name: 'The Changed Settlement' });
        expect(resolveKnownPlace('A completely nonexistent village', me, suppliedScope)).toBeNull();
        expect(gate.awareness(me.id, 'place')).toEqual(before);
        expect(resolveKnownPlace('Repeated Place', { ...me, location: 'Repeated Place' }, { ...scope, locations: [
            { id: 'one', name: 'Repeated Place' }, { id: 'two', name: 'Repeated Place' }
        ] })).toBeNull();
    });

    it('does not resurrect a removed world place from the catalog', async () => {
        const { me, gate, scope } = await reader();
        const removed = REGIONS.flatMap(r => r.places).find(p => p.name !== me.location
            && !gate.isAwareOf(me.id, 'place', p.name))!;
        expect(removed).toBeDefined();
        expect(resolveKnownPlace(removed.name, me, { ...scope, locations: [] })).toBeNull();
    });

    it('answers a remote name without a visit/live inspection, while a real local investigation still observes that ground', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['An answer.'] });
        const h = await makeGameInWorld({ seed: 'supplied-name-reader', worldSeed: 'road-world',
            narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 }) });
        const { cultivator: me } = await h.game.newRun('Reader');
        const world = (await h.game.loadWorld())!;
        const gate = new KnowledgeGate(h.db);
        const hidden = world.locations.find(p => p.sealed && p.parentId !== null
            && !gate.isAwareOf(me.id, 'place', p.id) && !gate.isAwareOf(me.id, 'place', p.name))!;
        expect(hidden).toBeDefined();
        expect(resolveKnownPlace(hidden.id, me, { gate, holderId: me.id, here: me.location,
            locations: world.locations })).toBeNull();
        const remote = world.locations.find(p => p.kind === 'settlement'
            && p.id !== h.game.worldPlaceOf(me)
            && !gate.isAwareOf(me.id, 'place', p.id) && !gate.isAwareOf(me.id, 'place', p.name))!;
        expect(remote).toBeDefined();
        plans.push(JSON.stringify({ action: 'investigate', target: remote.name }));
        const before = h.game.state();
        const day = world.currentDay;
        const hour = world.currentHour;
        const awareness = gate.awareness(me.id, 'place');
        const asked = await h.game.act(`What can you tell me about ${remote.name}?`);
        expect(refusedCall(asked)).toBeNull();
        expect(asked.toolCalls.some(c => c.name === 'narrator.plan' && c.source === 'model')).toBe(true);
        expect(h.game.state().cultivator).toEqual(before.cultivator);
        expect(h.game.state().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.atHand!.currentDay).toBe(day);
        expect(h.game.atHand!.currentHour).toBe(hour);
        expect(gate.awareness(me.id, 'place')).toEqual(awareness);
        expect(asked.toolCalls.some(c => c.name === 'knowledge.learn')).toBe(false);
        const remoteInput = JSON.stringify(provider.calls.at(-1));
        expect(remoteInput).toContain('not a look at what is there now');
        expect(remoteInput).not.toContain(howTheGroundReads(remote, day));

        // Operator arranges a real arrival, as other physical room fixtures do.
        // The second act is an actual local read, not a remote knowledge grant.
        h.repos.cultivators.update(me.id, { location: remote.name });
        h.repos.cultivators.standIn(me.id, null);
        plans.push(JSON.stringify({ action: 'investigate', target: remote.name }));
        const seen = await h.game.act(`I examine ${remote.name}.`);
        expect(refusedCall(seen)).toBeNull();
        expect(seen.toolCalls.some(c => c.name === 'knowledge.learn')).toBe(true);
        expect(JSON.stringify(provider.calls.at(-1))).toContain(howTheGroundReads(remote, world.currentDay));
        expect(gate.provenanceOf(me.id, 'place', remote.id).some(row => row.sourceKind === 'witnessed')).toBe(true);
    }, 180_000);
});
