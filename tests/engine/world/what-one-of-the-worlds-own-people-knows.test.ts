/**
 * What one of the world's own people knows is a reading, and it answers.
 *
 * THE DEFECT. Nothing anywhere writes a `knowledge_records` row for a world
 * NPC - every writer of that table names the player or somebody an operator
 * spawned - so every question the gate was asked ABOUT one of the world's own
 * people came back `unaware`. Two player-facing consumers acted on it:
 * `asking-verbs` refused a demand with `they_do_not_know` on behalf of
 * somebody who would in fact know, and `combat-verbs` fed `unaware` into
 * `whatTheyRecogniseAboutIt`, so nobody in the world ever recognised anything.
 *
 * Measured over three pinned worlds, two gates over one database differing only
 * in whether the world reader was attached - `probe-what-one-of-the-worlds-own-
 * people-knows.ts`, both arms in one command:
 *
 *                                          asked   before    after
 *   their own house                          101     0.0%   100.0%
 *   the place they are standing in           180     0.0%   100.0%
 *   a house seated in their province         165     0.0%   100.0%
 *   somebody in the same square              180     0.0%   100.0%
 *   sweep: any house in the world           1440     0.0%    93.1%
 *   sweep: any place in the world           1440     0.0%     0.0%
 *   sweep: any person in the world          1428     0.0%     0.6%
 *   recognition: reading is not nothing     1760     0.8%    82.0%
 *
 * THE STORE THAT WAS REFUSED, and the reason this is a reading at all: one row
 * per person per fact on a seeded world of 250 at a thousand years is 28,488
 * rows, and one per person per PLACE is 8,804. Nothing here writes anything.
 *
 * THE SAFETY PROPERTY, which is the last case below: a holder the world does
 * not hold gets `unaware` from every branch. The player has no `NpcRecord`, so
 * this can only ever ADD to what their stored rows say and can never contradict
 * them.
 */

import { describe, it, expect } from 'vitest';

import {
    whatOneOfTheWorldsOwnPeopleKnows
} from '../../../src/engine/world/what-one-of-the-worlds-own-people-knows.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { stageCeilingFor } from '../../../src/engine/social/discovery.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const TODAY = 40_000;

function person(id: string, init: Record<string, unknown> = {}) {
    return {
        id,
        name: id,
        status: 'alive',
        locationId: 'village',
        factionId: null,
        factionRankIndex: -1,
        cultivation: { realmOrdinal: 5 },
        relationships: [],
        activity: null,
        identity: { bornOnDay: 0 },
        ...init
    };
}

/** A province with a village and a compound, and a house seated in it. */
function world(init: Record<string, unknown> = {}): WorldState {
    return {
        id: 'w', seed: 'w', currentDay: TODAY,
        locations: [
            makeLocation({ id: 'province', name: 'Low Fall', kind: 'region' }),
            makeLocation({ id: 'village', name: 'Two Wells', kind: 'settlement', parentId: 'province' }),
            makeLocation({ id: 'compound', name: 'The Compound', kind: 'sect_seat', parentId: 'province' }),
            makeLocation({ id: 'far', name: 'High Fall', kind: 'region' }),
            makeLocation({ id: 'far-town', name: 'Nine Steps', kind: 'settlement', parentId: 'far' })
        ],
        factions: [
            {
                id: 'house', name: 'Azure Step Sect', kind: 'sect', alignment: 'neutral',
                seatLocationId: 'compound', controlledLocationIds: [], ranks: ['Outer', 'Elder'],
                standing: {}, resources: {}, description: '', foundedOnDay: 0,
                dissolvedOnDay: null, tags: []
            },
            {
                id: 'stranger', name: 'Nine Steps Hall', kind: 'sect', alignment: 'neutral',
                seatLocationId: 'far-town', controlledLocationIds: [], ranks: ['Outer'],
                standing: {}, resources: {}, description: '', foundedOnDay: 0,
                dissolvedOnDay: null, tags: []
            }
        ],
        npcs: [
            person('npc-villager'),
            person('npc-neighbour'),
            person('npc-disciple', { locationId: 'compound', factionId: 'house' }),
            person('npc-stranger', { locationId: 'far-town', factionId: 'stranger' })
        ],
        objects: [],
        history: { eras: [], facts: [], nextFactSeq: 1 },
        ...init
    } as unknown as WorldState;
}

const BEING_THERE = stageCeilingFor('witnessed');
const BEING_TOLD = stageCeilingFor('told');

describe('a world person is asked about a house', () => {
    it('knows their own, because they have dealt with it and it with them', () => {
        const reads = whatOneOfTheWorldsOwnPeopleKnows(world());
        expect(reads('npc-disciple', 'sect', 'house')).toBe(BEING_THERE);
    });

    it('has a name for the house seated in the province they live in', () => {
        // A name and no more than a name, which is the rung the player's own
        // starting awareness gives their local house. `named` is below
        // `REACHABLE_FROM`, so this does not let anybody set out for it.
        const reads = whatOneOfTheWorldsOwnPeopleKnows(world());
        expect(reads('npc-villager', 'sect', 'house')).toBe('named');
    });

    it('has never heard of a house a province away that has done nothing', () => {
        const reads = whatOneOfTheWorldsOwnPeopleKnows(world());
        expect(reads('npc-villager', 'sect', 'stranger')).toBe('unaware');
    });

    it('has heard of a house the province is talking about', () => {
        // The same predicate the ground reading asks - `isInTheAirFor` - asked
        // about a house instead of about a piece of ground, so how far news
        // gets is still decided in exactly one place.
        const loud = world();
        loud.history.facts = [{
            ...makeFact({
                day: TODAY - 400, kind: 'war', summary: 'They fought over the pass.',
                scale: 'regional', magnitude: 1, locationId: 'village',
                factionIds: ['stranger']
            }),
            id: 'f1', year: 0, eraId: 'e'
        }];
        const reads = whatOneOfTheWorldsOwnPeopleKnows(loud);
        expect(reads('npc-villager', 'sect', 'stranger')).toBe(BEING_TOLD);
    });

    it('knows a house it stood beside when the house did something', () => {
        const there = world();
        there.history.facts = [{
            ...makeFact({
                day: TODAY - 400, kind: 'war', summary: 'They fought over the pass.',
                locationId: 'far-town', factionIds: ['stranger'],
                witnessIds: ['npc-villager']
            }),
            id: 'f1', year: 0, eraId: 'e'
        }];
        const reads = whatOneOfTheWorldsOwnPeopleKnows(there);
        expect(reads('npc-villager', 'sect', 'stranger')).toBe(BEING_THERE);
    });
});

describe('a world person is asked about a place and about somebody', () => {
    it('knows the place they are standing in, and can point at the province', () => {
        const reads = whatOneOfTheWorldsOwnPeopleKnows(world());
        expect(reads('npc-villager', 'place', 'village')).toBe(BEING_THERE);
        // A container of where you stand is a place you can point at. No fact
        // has to have happened in a province for somebody living in it to know
        // which province it is.
        expect(reads('npc-villager', 'place', 'province')).toBe(BEING_TOLD);
        expect(reads('npc-villager', 'place', 'far-town')).toBe('unaware');
    });

    it('has met whoever is standing in the same square, and no more than met', () => {
        // `encountered` and not `known`: the genre is full of people who have
        // been in a room with somebody they could not name.
        const reads = whatOneOfTheWorldsOwnPeopleKnows(world());
        expect(reads('npc-villager', 'cultivator', 'npc-neighbour')).toBe('encountered');
        expect(reads('npc-villager', 'cultivator', 'npc-stranger')).toBe('unaware');
    });

    it('knows somebody the world has written a tie to', () => {
        const tied = world();
        tied.npcs[0] = {
            ...tied.npcs[0],
            relationships: [{
                targetId: 'npc-stranger', targetName: 'npc-stranger', kind: 'rival',
                standing: -0.4, note: '', sinceDay: 0, lastChangedDay: 0,
                factIds: [], inheritedFromId: null
            }]
        };
        const reads = whatOneOfTheWorldsOwnPeopleKnows(tied);
        expect(reads('npc-villager', 'cultivator', 'npc-stranger')).toBe(BEING_THERE);
    });
});

describe('it answers about the world and about nobody else', () => {
    it('says unaware about everything for a holder the world does not hold', () => {
        // The player is a `cultivators` row and has no `NpcRecord`. This is the
        // whole reason the gate may compose the two with `highestStage`: the
        // reading cannot contradict a player's stored records because it never
        // says anything about them at all.
        const reads = whatOneOfTheWorldsOwnPeopleKnows(world());
        for (const kind of ['sect', 'place', 'cultivator', 'event'] as const) {
            expect(reads('cultivator-the-player', kind, 'house')).toBe('unaware');
        }
    });

    it('writes nothing to the world it reads', () => {
        const state = world();
        const before = JSON.stringify(state);
        const reads = whatOneOfTheWorldsOwnPeopleKnows(state);
        reads('npc-villager', 'sect', 'house');
        reads('npc-disciple', 'place', 'village');
        reads('npc-villager', 'cultivator', 'npc-neighbour');
        expect(JSON.stringify(state)).toBe(before);
    });
});
