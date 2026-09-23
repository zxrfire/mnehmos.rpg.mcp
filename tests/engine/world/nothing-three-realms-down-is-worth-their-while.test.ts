/**
 * Why somebody at the top of the world does not go about killing people.
 *
 * The killing read asked what two people would fight over and never asked
 * whether the one doing the reaching had any stake in the other: a Seat could
 * hold a full-weight motive over a mortal's purse, and the strength gap made it
 * quicker and surer rather than costlier. The design owner, asked why they do
 * not: *"and again why would they?"* and *"they have face"* - in that order.
 *
 * MOTIVE FIRST, COST SECOND. What is pinned here: a stake read across realms
 * returns NOTHING rather than a small number, and what survives pays face.
 *
 * See `src/engine/world/why-one-cultivator-kills-another.ts`.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    WHAT_IT_TAKES_TO_INTEREST_SOMEBODY_A_REALM_UP,
    whatPunchingDownCostsInFace,
    whatTheyWouldFightOver
} from '../../../src/engine/world/why-one-cultivator-kills-another.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

async function world(): Promise<WorldState> {
    return seedWorld({ seed: 'afford-a', catalog: await loadCultivationCatalog() }).state;
}

/** Two rows with a grievance between them, standing wherever they are told to. */
function twoOfThem(state: WorldState, killerOrdinal: number, victimOrdinal: number): {
    killer: NpcRecord;
    victim: NpcRecord;
} {
    const [one, two] = state.npcs.filter(n => n.status === 'alive');
    const victim: NpcRecord = {
        ...two!,
        relationships: [],
        spiritStones: 0,
        cultivation: { ...two!.cultivation, realmOrdinal: victimOrdinal }
    };
    const killer: NpcRecord = {
        ...one!,
        cultivation: { ...one!.cultivation, realmOrdinal: killerOrdinal },
        relationships: [{
            targetId: victim.id,
            targetName: victim.name,
            kind: 'enemy',
            standing: -0.9,
            note: 'A grievance, and a heavy one.',
            factIds: [],
            sinceDay: 0,
            lastChangedDay: 0,
            inheritedFromId: null
        }]
    };
    return { killer, victim };
}

describe('what somebody at height has at stake in somebody far beneath them', () => {
    it('answers a grievance between equals and nothing at all three realms down', async () => {
        const state = await world();

        // Level with each other: a heavy grievance is a reason, and it is read.
        const level = twoOfThem(state, 5, 5);
        const between = whatTheyWouldFightOver({
            state, killer: level.killer, victim: level.victim,
            place: null, carried: [], standsInTheirSeat: false
        });
        expect(between).not.toBeNull();
        expect(between!.motive).toBe('a grudge');

        // The same grievance, held by somebody at the top of the ladder against
        // a mortal: not a smaller number, no reason at all.
        const across = twoOfThem(state, 44, 5);
        expect(whatTheyWouldFightOver({
            state, killer: across.killer, victim: across.victim,
            place: null, carried: [], standsInTheirSeat: false
        })).toBeNull();

        // And the bar is a bar rather than a switch: one realm up, only a
        // grievance this heavy clears it.
        expect(WHAT_IT_TAKES_TO_INTEREST_SOMEBODY_A_REALM_UP).toBeLessThan(0.9);
        expect(WHAT_IT_TAKES_TO_INTEREST_SOMEBODY_A_REALM_UP * 3).toBeGreaterThan(1);
    });

    it('charges face for reaching down and nothing for reaching up', () => {
        // Killing upward is the story, not the disgrace.
        expect(whatPunchingDownCostsInFace(13, 44)).toBe(0);
        expect(whatPunchingDownCostsInFace(20, 20)).toBe(0);
        // And it costs more the further down it reaches.
        const oneRealm = whatPunchingDownCostsInFace(17, 13);
        const several = whatPunchingDownCostsInFace(44, 5);
        expect(oneRealm).toBeGreaterThan(0);
        expect(several).toBeGreaterThan(oneRealm);
    });
});
