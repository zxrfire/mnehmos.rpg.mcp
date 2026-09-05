/**
 * A cultivator opens a run knowing some people, because they grew up somewhere.
 *
 * The measurement this closes, taken on three seeds before the module existed:
 *
 *     known 9    place x 8,  sect x 1    cultivator: 0
 *     known 14   place x 13, sect x 1    cultivator: 0
 *     known 9    place x 8,  sect x 1    cultivator: 0
 *
 * with thirteen, five and seventeen people standing in the square. Everybody in
 * the world was a permanent stranger, so the four verbs that have to be pointed
 * at somebody could not find anybody to point at.
 *
 * The rule these tests must never let slip: this seeds WHO HAS SAID A NAME in
 * front of this person, and it does not weaken the gate that decides what a
 * name is worth. `discovery.md` is untouched.
 */

import { describe, it, expect } from 'vitest';

import { makeGame } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import {
    A_CHILDHOOD_REACHES,
    FACES_A_CHILDHOOD_LEAVES,
    facesFromHome
} from '../../src/web/who-a-life-like-this-grew-up-knowing';
import { createWorld, type WorldState } from '../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import type { Cultivator } from '../../src/schema/cultivation';

const SEEDS = ['probe-a', 'probe-b', 'probe-c'];

describe('a run does not open with nobody', () => {
    it('knows at least one person by name on day zero, on every seed', async () => {
        for (const seed of SEEDS) {
            const { db, game } = makeGame({ seed, worldEnabled: true });
            const { cultivator } = await game.newRun('Probe');
            const held = new KnowledgeGate(db)
                .awareness(cultivator.id)
                .filter(row => row.kind === 'cultivator');
            expect(held.length, `${seed} knows nobody`).toBeGreaterThan(0);
        }
    }, 120_000);

    it('unlocks the verbs that need somebody to be pointed at', async () => {
        // The whole reason this exists. Four verbs resolved and none of them
        // could find a target, and the game said so: "You have no name to ask
        // for, which is the whole of what is stopping you."
        const { db, game } = makeGame({ seed: 'probe-b', worldEnabled: true });
        const { cultivator } = await game.newRun('Probe');
        const known = new KnowledgeGate(db)
            .awareness(cultivator.id)
            .find(row => row.kind === 'cultivator')!;
        expect(known).toBeDefined();

        const bout = await game.act(`I spar with ${known.name}`) as { narration?: string };
        // Not asserting the outcome - a bout is a bout. Asserting that it found
        // a person, which it did not before.
        expect(bout.narration ?? '').not.toContain('no name');
        expect((bout.narration ?? '').length).toBeGreaterThan(0);
    }, 120_000);

    it('grants acquaintance and nothing else', async () => {
        const { db, game } = makeGame({ seed: 'probe-a', worldEnabled: true });
        const { cultivator } = await game.newRun('Probe');
        const rows = new KnowledgeGate(db)
            .awareness(cultivator.id)
            .filter(row => row.kind === 'cultivator');
        for (const row of rows) {
            // The statement says outright what it is not. A record that implied
            // an obligation would be handing over a favour before anybody asked.
            expect(row.statement).toContain('not the same as being owed');
            expect(row.sourceKind).toBe('witnessed');
        }
        // No membership and no standing came with it.
        expect(cultivator.sectId).toBeNull();
        expect(cultivator.realmOrdinal).toBe(0);
    }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────
// THE SELECTION, ON A WORLD SMALL ENOUGH TO REASON ABOUT
// ─────────────────────────────────────────────────────────────────────────

function village(ordinals: readonly number[]): WorldState {
    const state = createWorld({ seed: 'faces', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'home', name: 'Autumn Gate', kind: 'settlement', qiDensity: 0.4
    }));
    ordinals.forEach((ordinal, i) => {
        let npc = createNpc(state.seed, {
            id: `npc-${i}`, name: `Villager ${i}`,
            bornOnDay: 0, onDay: state.currentDay,
            locationId: 'home', occupation: 'disciple'
        });
        npc = setRealm(npc, ordinal, state.currentDay);
        state.npcs.push(npc);
    });
    return state;
}

const player = { id: 'pc', name: 'Probe', location: 'Autumn Gate', realmOrdinal: 0 } as Cultivator;

describe('who a childhood actually puts in front of you', () => {
    it('takes the neighbours before the notables', () => {
        const world = village([0, 1, 2, 30, 40]);
        const faces = facesFromHome({ world, cultivator: player, origin: 'thin_county', seed: 's' });
        expect(faces.map(f => f.realmOrdinal)).toEqual([0, 1, 2]);
    });

    it('will not put a farm child in a room with somebody out of reach', () => {
        const world = village([30, 40, 44]);
        const faces = facesFromHome({ world, cultivator: player, origin: 'thin_county', seed: 's' });
        expect(faces).toEqual([]);
    });

    it('buys inputs and never rank: a better birth knows more people, higher up', () => {
        const world = village([0, 1, 2, 3, 4, 5, 8, 12, 18, 24]);
        const farm = facesFromHome({ world, cultivator: player, origin: 'thin_county', seed: 's' });
        const house = facesFromHome({
            world, cultivator: player, origin: 'dao_house_bloodline', seed: 's'
        });
        expect(house.length).toBeGreaterThan(farm.length);
        const topFarm = Math.max(...farm.map(f => f.realmOrdinal));
        const topHouse = Math.max(...house.map(f => f.realmOrdinal));
        expect(topHouse).toBeGreaterThan(topFarm);
        // And not one rung of standing came with it.
        expect(player.realmOrdinal).toBe(0);
    });

    it('is empty rather than wrong when the world has no such place', () => {
        const world = village([1, 2]);
        const nowhere = { ...player, location: 'A Place That Is Not There' } as Cultivator;
        expect(facesFromHome({ world, cultivator: nowhere, origin: 'thin_county', seed: 's' }))
            .toEqual([]);
    });

    it('is the same draw from the same seed', () => {
        const world = village([0, 1, 2, 3, 4]);
        const input = { world, cultivator: player, origin: 'thin_county' as const, seed: 's' };
        expect(facesFromHome(input)).toEqual(facesFromHome(input));
    });

    it('never leaves a life with nobody, at any band in the table', () => {
        // The floor is the ruling: "at a minimum, some names."
        for (const band of FACES_A_CHILDHOOD_LEAVES) expect(band.faces).toBeGreaterThan(0);
        for (const band of A_CHILDHOOD_REACHES) expect(band.rungs).toBeGreaterThan(0);
    });
});
