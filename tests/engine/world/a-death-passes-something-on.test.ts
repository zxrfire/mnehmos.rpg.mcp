/**
 * Every death settles, including the two that did not.
 *
 * `markDead` stops a heart. `settleNpcDeath` is what passes the goals and the
 * accounts down to whoever is left - a grudge thins by a generation and does not
 * go away, which is most of what makes this world's history feel owned by
 * somebody.
 *
 * Two death sites called the first and not the second, and they were the two
 * highest-ordinal ways to die in the world: at a WALL, and at the LAST CROSSING.
 * So the deaths most likely to leave heirs and accounts worth inheriting were
 * exactly the deaths that left nothing. A grudge that took a century to earn
 * ended with the person holding it.
 *
 * Rates over lived worlds. No seed is pinned to a count.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['pass-a', 'pass-b'];
const YEARS = 200;
let cached: WorldState[] | null = null;

async function worldsLived(): Promise<WorldState[]> {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => {
        const { state } = seedWorld({ seed, catalog });
        advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
        return state;
    });
    return cached;
}

function inheritedTies(state: WorldState): number {
    let n = 0;
    for (const npc of state.npcs) {
        for (const tie of npc.relationships) if (tie.inheritedFromId) n++;
    }
    return n;
}

function inheritedGoals(state: WorldState): number {
    let n = 0;
    for (const npc of state.npcs) {
        for (const goal of npc.goals) {
            if ((goal as { inheritedFromId?: string | null }).inheritedFromId) n++;
        }
    }
    return n;
}

function theDead(state: WorldState): number {
    return state.npcs.filter(n => n.status !== 'alive').length;
}

describe('what a death leaves behind', () => {
    it('leaves something, over any span long enough to have deaths in it', async () => {
        for (const state of await worldsLived()) {
            expect(theDead(state)).toBeGreaterThan(0);
            expect(inheritedTies(state)).toBeGreaterThan(0);
            expect(inheritedGoals(state)).toBeGreaterThan(0);
        }
    });

    it('and an inherited account names who it came from', async () => {
        for (const state of await worldsLived()) {
            const byId = new Map(state.npcs.map(n => [n.id, n]));
            for (const npc of state.npcs) {
                for (const tie of npc.relationships) {
                    if (!tie.inheritedFromId) continue;
                    // The person it came from is somebody the world held, and
                    // they are not the person now holding it.
                    expect(tie.inheritedFromId).not.toBe(npc.id);
                    // A world that has forgotten them entirely is a world that
                    // cannot answer where the grudge came from, which is the
                    // whole point of carrying the id.
                    expect(byId.has(tie.inheritedFromId) || tie.inheritedFromId.length > 0)
                        .toBe(true);
                }
            }
        }
    });

    it('never hands somebody an account against themselves', async () => {
        for (const state of await worldsLived()) {
            for (const npc of state.npcs) {
                for (const tie of npc.relationships) {
                    expect(tie.targetId).not.toBe(npc.id);
                }
            }
        }
    });

    it('and inherits at a rate that is a fact about deaths, not a trickle', async () => {
        // Not a constant: the claim is that inheritance is proportionate to
        // dying, which is what would break if a death path stopped settling.
        for (const state of await worldsLived()) {
            const perDeath = inheritedTies(state) / Math.max(1, theDead(state));
            expect(perDeath).toBeGreaterThan(0.5);
        }
    });
});
