/**
 * Somebody you had heard of, standing in front of you.
 *
 * The owner: said aloud, "oh you're X, I've heard of you", the reaction follows
 * the reputation - a victory flatters, a disgrace stings. Kept to yourself, the
 * player is sure of the face and the person never learns they were known;
 * whether the face is placed at all is perception.
 */

import { describe, expect, it } from 'vitest';

import type { HistoricalFact } from '../../src/engine/world/history';
import type { WorldState } from '../../src/engine/world/world-state';
import { KnowledgeGate } from '../../src/web/knowledge';
import { whatNamingThemDoes, whatTheyAreKnownFor } from '../../src/web/recognising-somebody-you-had-heard-of';
import { thePlayerIsSureItIsThem } from '../../src/web/the-narrator-plays-the-world';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { npcsAt } from '../../src/engine/world/world-state';
import { worldLocationFor } from '../../src/web/entities';

describe('what somebody is known for', () => {
    const fact = (over: Partial<HistoricalFact>): HistoricalFact => ({
        id: 'f', day: 10, year: 1, eraId: 'e', kind: 'promotion', scale: 'personal',
        actors: [{ id: 'npc-a', role: 'subject' }], witnessIds: [], locationId: null, place: null,
        factionIds: [], summary: '', causes: [], locationChangeIds: [], visibility: 'public',
        ...over
    } as unknown as HistoricalFact);
    const world = (facts: HistoricalFact[]) => ({
        npcs: [{ id: 'npc-a', historyFactIds: facts.map(f => f.id) }],
        history: { facts }
    }) as unknown as Pick<WorldState, 'history' | 'npcs'>;

    it('is flattered by a raising and stung by an expulsion, whichever is latest', () => {
        expect(whatTheyAreKnownFor(world([fact({ id: 'p', kind: 'promotion' })]), 'npc-a')?.cuts).toBe('flatters');
        expect(whatTheyAreKnownFor(world([
            fact({ id: 'p', kind: 'promotion', day: 10 }),
            fact({ id: 'x', kind: 'expulsion', day: 20 })
        ]), 'npc-a')?.cuts).toBe('stings');
    });

    it('counts only what went round, and says so plainly', () => {
        expect(whatTheyAreKnownFor(world([fact({ kind: 'promotion', visibility: 'secret' })]), 'npc-a')).toBeNull();
        expect(whatNamingThemDoes('Wei Lan', { what: 'a betrayal', cuts: 'stings' }))
            .toBe('You call Wei Lan by name. They are known for a betrayal, and hear that you know it: it stings.');
    });
});

describe('on the square', () => {
    /** Everybody here held only as a name heard of, before the turn. */
    async function heardOfEverybody(seed: string, provider?: ScriptedProvider) {
        const harness = await makeGameInWorld({ seed, worldSeed: 'road-world', ...(provider ? { provider } : {}) });
        const { cultivator } = await harness.game.newRun('Probe');
        harness.db.prepare('UPDATE cultivators SET attributes = json_set(attributes, \'$.insight\', 4) WHERE id = ?')
            .run(cultivator.id);
        const gate = new KnowledgeGate(harness.db);
        // Where most of the faces they cannot yet place are: an area holds three at most.
        const world = harness.game.atHand!;
        const unplaced = new Set(npcsAt(world, worldLocationFor(world, cultivator.location)!.id)
            .filter(n => !thePlayerIsSureItIsThem(n.name, gate.awareness(cultivator.id, 'cultivator')))
            .map(n => n.id));
        await standWhereThePeopleAre(harness, cultivator.id, unplaced);
        const here = harness.game.present(harness.repos.cultivators.getById(cultivator.id)!)
            .filter(p => !thePlayerIsSureItIsThem(p.name, gate.awareness(cultivator.id, 'cultivator')));
        for (const person of here) {
            harness.game.knowledge.learnIfNew({
                holderId: cultivator.id, kind: 'cultivator', id: person.id, name: person.name,
                onDay: 0, sourceKind: 'told', sourceNote: 'heard of them', stage: 'named',
                statement: `${person.name} is somebody people talk about.`
            });
        }
        return { ...harness, cultivator, gate, here };
    }

    it('places some of them in silence, and moves nothing between them', async () => {
        const { game, cultivator, gate, here, db } = await heardOfEverybody('heard-of-1');
        expect(here.length).toBeGreaterThan(1);
        await game.act('I look around');

        const placed = here.filter(p => thePlayerIsSureItIsThem(p.name, gate.awareness(cultivator.id, 'cultivator')));
        expect(placed.length, 'insight 4 placed nobody at all').toBeGreaterThan(0);
        for (const person of placed) {
            expect(gate.stageOf(cultivator.id, 'cultivator', person.id)).toBe('encountered');
        }
        const recognisedRows = db.prepare(
            "SELECT COUNT(*) AS n FROM relationship_events WHERE kind = 'recognised'"
        ).get() as { n: number } | undefined;
        expect(recognisedRows?.n ?? 0).toBe(0);
    }, 300_000);

    it('said aloud, makes the player sure of them and says what naming them did', async () => {
        const first = await heardOfEverybody('heard-of-2');
        const target = first.here[0]!;
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({ action: 'interact', target: target.name, intent: 'talk' })],
            narrations: ['(scripted)']
        });
        const { game, cultivator, gate } = await heardOfEverybody('heard-of-2', provider);
        const mark = provider.calls.length;
        await game.act(`${target.name}, I have heard of you`);
        const prompts = provider.calls.slice(mark)
            .map(call => call.messages.find(m => m.role === 'user')?.content ?? '').join(' ');

        expect(gate.stageOf(cultivator.id, 'cultivator', target.id)).toBe('known');
        expect(thePlayerIsSureItIsThem(target.name, gate.awareness(cultivator.id, 'cultivator'))).toBe(true);
        expect(prompts).toContain(`You call ${target.name} by name`);
    }, 300_000);
});
