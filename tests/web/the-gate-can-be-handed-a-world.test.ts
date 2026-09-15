/**
 * The knowledge gate may be handed a world, and a gate without one is unchanged.
 *
 * THE DEFECT. `knowledge_records` holds the player and whoever an operator
 * spawned. No path anywhere writes a row for one of the world's own people, so
 * `isAwareOf` and `stageOf` answered `false` and `unaware` for every NPC in the
 * world - and two player-facing consumers acted on it:
 *
 *   asking-verbs ~306   `holdsIt` decides whether `whatStandsInTheWay` reads
 *                       `they_do_not_know`, so the engine refused a demand on
 *                       behalf of somebody who would in fact know.
 *   combat-verbs ~919   the reference axis of `whatTheyRecogniseAboutIt`, so
 *                       nobody in the world recognised anything on sight.
 *
 * THE OBSTACLE, and why the reader is optional. The gate is constructed from a
 * bare `Database` in about twenty places with no world in reach - the MCP
 * tools, the operator surface, the perception layer - and every one of them
 * asks about the PLAYER, who has rows. So the world is a second, optional
 * reader, and the first two cases below are the contract that keeps those
 * twenty legal: no world, no change, and no cost beyond one undefined check.
 *
 * WHY `highestStage` IS THE RIGHT COMPOSITION. Stages never fall, a row is the
 * authority wherever a row exists, and the reading says `unaware` about every
 * holder the world does not hold. So it can only ever add.
 *
 * RED-CHECKED: dropping the world argument in `turn-engine.ts` turns the third
 * and fourth cases red; making the reading answer for holders with no world row
 * turns the fifth red.
 */

import { describe, it, expect } from 'vitest';

import { makeDb } from './harness.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

const TODAY = 40_000;

function world(): WorldState {
    return {
        id: 'w', seed: 'w', currentDay: TODAY,
        locations: [
            makeLocation({ id: 'province', name: 'Low Fall', kind: 'region' }),
            makeLocation({ id: 'village', name: 'Two Wells', kind: 'settlement', parentId: 'province' })
        ],
        factions: [{
            id: 'house', name: 'Azure Step Sect', kind: 'sect', alignment: 'neutral',
            seatLocationId: 'village', controlledLocationIds: [], ranks: ['Outer'],
            standing: {}, resources: {}, description: '', foundedOnDay: 0,
            dissolvedOnDay: null, tags: []
        }],
        npcs: [{
            id: 'npc-disciple', name: 'Yun Qi', status: 'alive', locationId: 'village',
            factionId: 'house', factionRankIndex: 0,
            cultivation: { realmOrdinal: 5 }, relationships: [], activity: null,
            identity: { bornOnDay: 0 },
            // `tags` IS NOT OPTIONAL, and the cast below is why this row got
            // away without it. The gate asks `isTheWorldsToMove` now - the
            // world does not know things on the player's behalf - and that
            // reads `tags` on whoever is asking, so a row without it crashed
            // rather than answering. An empty list is what an ordinary person
            // of the world carries; the player's row is the one that is marked.
            tags: []
        }],
        objects: [],
        history: { eras: [], facts: [], nextFactSeq: 1 }
    } as unknown as WorldState;
}

describe('a gate with no world behaves exactly as it always did', () => {
    it('says an NPC has never heard of the house they are standing in', () => {
        const gate = new KnowledgeGate(makeDb());
        expect(gate.isAwareOf('npc-disciple', 'sect', 'house')).toBe(false);
        expect(gate.stageOf('npc-disciple', 'sect', 'house')).toBe('unaware');
        expect(gate.canPointAt('npc-disciple', 'place', 'village')).toBe(false);
    });

    it('is the same when the supplier is there and has no world loaded', () => {
        // `GameService.atHand` is null between actions. A gate that threw, or
        // answered differently, at that moment would make the answer depend on
        // when in a turn it was asked.
        const gate = new KnowledgeGate(makeDb(), () => null);
        expect(gate.isAwareOf('npc-disciple', 'sect', 'house')).toBe(false);
        expect(gate.stageOf('npc-disciple', 'sect', 'house')).toBe('unaware');
    });
});

describe('a gate with a world answers about the world', () => {
    it('lets somebody on a roll have heard of their own house', () => {
        const gate = new KnowledgeGate(makeDb(), world);
        expect(gate.isAwareOf('npc-disciple', 'sect', 'house')).toBe(true);
        expect(gate.stageOf('npc-disciple', 'sect', 'house')).toBe('known');
    });

    it('lets somebody point at the ground under their feet', () => {
        const gate = new KnowledgeGate(makeDb(), world);
        expect(gate.canPointAt('npc-disciple', 'place', 'village')).toBe(true);
    });

    it('still says nothing about somebody the world does not hold', () => {
        // The player is a `cultivators` row. Handing the gate a world must not
        // hand the player anything they were never told.
        const gate = new KnowledgeGate(makeDb(), world);
        expect(gate.isAwareOf('cultivator-1', 'sect', 'house')).toBe(false);
        expect(gate.stageOf('cultivator-1', 'place', 'village')).toBe('unaware');
    });

    it('keeps a stored row that stands higher than the reading', () => {
        // A row is the authority where one exists, and nothing on this ladder
        // falls. The village reading gives this holder nothing; the row does.
        const gate = new KnowledgeGate(makeDb(), world);
        gate.learn({
            holderId: 'cultivator-1', kind: 'place', id: 'village', name: 'Two Wells',
            onDay: 1, sourceKind: 'witnessed', stage: 'known'
        });
        expect(gate.stageOf('cultivator-1', 'place', 'village')).toBe('known');
    });

    it('rebuilds when the world handle is replaced', () => {
        // `atHand` is reloaded per action. A gate that cached the first world
        // it saw would answer off a world several turns stale.
        let current = world();
        const gate = new KnowledgeGate(makeDb(), () => current);
        expect(gate.stageOf('npc-disciple', 'sect', 'house')).toBe('known');

        const next = world();
        next.npcs = [{ ...next.npcs[0], factionId: null }];
        current = next;
        expect(gate.stageOf('npc-disciple', 'sect', 'house')).not.toBe('known');
    });
});
