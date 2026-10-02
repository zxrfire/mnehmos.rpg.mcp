/**
 * A slip that can never be burned is a row in a treasury.
 *
 * A teleportation talisman is one fold somebody else paid for. It breaks the rule
 * everything else in this engine obeys - that what you can do is what you are -
 * exactly once, and then it is paper. `FOLD_FLOOR_ORDINAL` is 29 and most of the
 * people it saves are nowhere near it.
 *
 * Measured when the slips existed and nothing handed them out: 151 slips in a
 * seeded world, ZERO held by anybody, zero ever burned. The object was built,
 * the escape was written, and the two could not reach each other because a
 * house handed out swords and kept its paper.
 *
 * Rates over lived worlds. No seed is pinned to a count.
 *
 * ── AND BURNING IS ASKED OF THE CORPUS, NOT OF EACH WORLD ────────────────
 *
 * The burn assertion used to run per world, which is the thing the line above
 * forbids. Measured over 16 pinned worlds at 200 years: 163 slips in every
 * world, 46 to 94 of them held, and 0 to 10 burned - 65 burned in all, a mean
 * of 4.1, and ONE world of the 16 burned none. So a per-world `> 0` was a
 * one-in-sixteen coin flip per seed, and it came up red on a state change that
 * had nothing to do with paper. Holding stays per world, because the thinnest
 * of the 16 still held 46. Burning is summed across the seeds.
 * The later catalog sweep found 167 slips per world and none burned across
 * pyr-a/b/c at 200 years. War deaths transferred the paper before escape was
 * checked. A paired war below pins survival and prevents an estate handoff.
 * After that fix the same worlds burned 13, 6 and 14 slips. One burner was
 * later forgotten by the world's ordinary retention pass, which clears ids
 * in object data. The date remains; identity is asserted at the act below.
 * A 10-second CPU profile of a cold pyr-a walk spent 92% in yearly witness
 * reactions. The account phase rebuilt world knowledge for each authority
 * query; it now receives the reader already used by that year's observations.
 * Rate checks retain the slips and remembered ids from each private world copy;
 * the rest of three complete worlds is not needed for these assertions.
 */

import { describe, expect, it } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';
import { whoBurnedATeleportationTalisman } from '../../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { cutATalisman } from '../../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { makeObject, transferPossession, type ObjectRecord } from '../../../src/engine/world/possessions';
import type { WorldState } from '../../../src/engine/world/world-state';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { fightTheWarsThisYear } from '../../../src/engine/world/war-melee.js';
import { fixtureCatalog } from './fixtures.js';

// The pyramid's seeds at the same horizon, so the walks are shared: see `tests/support/soaked-world.ts`.
const SEEDS = ['pyr-a', 'pyr-b', 'pyr-c'];
const YEARS = 200;
interface LivedSlips { slips: ObjectRecord[]; remembered: Set<string> }
let cached: LivedSlips[] | null = null;

async function worldsLived(): Promise<LivedSlips[]> {
    if (cached) return cached;
    // Kept and shared: see `tests/support/soaked-world.ts`.
    const lived: LivedSlips[] = [];
    for (const seed of SEEDS) {
        lived.push(await soakedWorld(seed, { years: YEARS }).then(state => ({
            slips: slipsIn(state), remembered: new Set(state.npcs.map(n => n.id))
        })));
    }
    cached = lived;
    return cached;
}

const slipsIn = (s: WorldState) => s.objects.filter(o => o.tags.includes('talisman'));

describe('a slip reaches a hand', () => {
    it('is held by somebody, which it never was', async () => {
        for (const state of await worldsLived()) {
            const held = state.slips.filter(o => o.possessorId !== null);
            expect(held.length).toBeGreaterThan(0);
        }
    });

    it('and is burned by somebody, which it never was', async () => {
        let burned = 0;
        const said: string[] = [];
        for (const state of await worldsLived()) {
            const here = state.slips.filter(o => o.data?.spent === true).length;
            burned += here;
            said.push(String(here));
        }
        expect(burned, `nothing was burned in any of them: ${said.join(', ')}`)
            .toBeGreaterThan(0);
    });

    it('but not most of them, because most people do not die in a war', async () => {
        for (const state of await worldsLived()) {
            const slips = state.slips;
            const burned = slips.filter(o => o.data?.spent === true);
            expect(burned.length).toBeLessThan(slips.length / 2);
        }
    });

    it('keeps the burn date and any burner the world still remembers', async () => {
        for (const state of await worldsLived()) {
            for (const slip of state.slips.filter(o => o.data?.spent === true)) {
                const burner = slip.data?.spentBy;
                expect(burner === null || typeof burner === 'string').toBe(true);
                if (typeof burner === 'string') {
                    expect(state.remembered.has(burner)).toBe(true);
                }
                expect(typeof slip.data?.spentOnDay).toBe('number');
                // Used and gone. Nobody is holding it afterwards.
                expect(slip.possessorId).toBeNull();
            }
        }
    });
});

describe('who the door opens for', () => {
    function aSlipInTheHandOf(who: string, carries: number): ObjectRecord {
        const cut = cutATalisman({
            id: `slip-${who}`,
            name: 'a teleportation talisman',
            grade: 'earth',
            what: 'a_teleportation',
            crafterId: null,
            crafterOrdinal: carries > 0 ? 40 : 10,
            onDay: 0
        });
        return transferPossession(cut, {
            onDay: 1, toHolderId: who, toHolderName: who, how: 'lent'
        });
    }

    it('escapes a lethal war before death can transfer the slip', () => {
        const { state } = seedWorld({ seed: 'a-slip-before-an-estate', catalog: fixtureCatalog() });
        const houses = state.factions.filter(house => state.npcs.some(n =>
            n.status === 'alive' && n.factionId === house.id)).slice(0, 2);
        expect(houses).toHaveLength(2);
        for (const house of houses) house.tags.push('at_war');
        state.npcs = houses.map((house, i) => {
            const npc = state.npcs.find(n => n.status === 'alive' && n.factionId === house.id)!;
            return { ...npc, tags: [], cultivation: { ...npc.cultivation, realmOrdinal: i === 0 ? 0 : 13 } };
        });
        const victim = state.npcs[0]!;
        state.objects = [makeObject({ id: 'test-blade', name: 'a blade', kind: 'artifact',
            significance: 'significant', power: 13, possessorId: state.npcs[1]!.id,
            tags: ['weapon'] })];
        state.schedule = [{
            id: 'test-war', kind: 'war_resolves', dueOnDay: 999_999, summary: 'a war',
            actorIds: [], locationId: null, factionId: houses[0]!.id, repeatDays: null,
            interrupts: false, chance: 1, fired: false, firedOnDay: null,
            data: { kind: 'war_resolution', sideA: houses[0]!.id, sideB: houses[1]!.id,
                magnitude: 0.7, openedOnDay: 0, musteredA: 1, musteredB: 1, ledA: 0, ledB: 0 }
        }];
        let lethal = false;
        for (let seed = 0; seed < 64; seed++) {
            const bare = structuredClone(state);
            const equipped = structuredClone(state);
            equipped.objects.push(aSlipInTheHandOf(victim.id, 1));
            const key = `escape-war-${seed}`;
            fightTheWarsThisYear(bare, 400, forStream(key, 'war-melee', 1));
            const did = fightTheWarsThisYear(equipped, 400, forStream(key, 'war-melee', 1));
            if (bare.npcs.find(n => n.id === victim.id)!.status === 'alive') continue;
            lethal = true;
            expect(equipped.npcs.find(n => n.id === victim.id)!.status).toBe('alive');
            const slip = equipped.objects.find(o => o.tags.includes('talisman'))!;
            expect(slip.data?.spentBy).toBe(victim.id);
            expect(slip.possessorId).toBeNull();
            expect(did.fought.flatMap(year => year.deaths).some(death => death.deceasedId === victim.id)).toBe(false);
            break;
        }
        expect(lethal, 'the control must actually suffer a lethal encounter').toBe(true);
    });

    it('takes the person who was about to be finished, and nobody else', () => {
        const objects = [aSlipInTheHandOf('doomed', 1), aSlipInTheHandOf('fine', 1)];
        const out = whoBurnedATeleportationTalisman({ objects, aboutToFall: ['doomed'], onDay: 5 });
        expect(out).toEqual(['doomed']);
        // The bystander still has theirs. A caller that asked about everybody
        // present would empty the world's paper in one war.
        expect(objects.find(o => o.possessorId === 'fine')).toBeDefined();
    });

    it('does nothing for somebody carrying nothing', () => {
        const objects: ObjectRecord[] = [];
        expect(whoBurnedATeleportationTalisman({ objects, aboutToFall: ['empty-handed'], onDay: 5 })).toEqual([]);
    });

    it('and nothing for a slip that carries no distance', () => {
        // Cut by a hand under the folding floor: a way out that is not one.
        const objects = [aSlipInTheHandOf('holding-nothing-useful', 0)];
        expect(whoBurnedATeleportationTalisman({ objects, aboutToFall: ['holding-nothing-useful'], onDay: 5 }))
            .toEqual([]);
    });

    it('and never twice out of one slip', () => {
        const objects = [aSlipInTheHandOf('lucky', 1)];
        expect(whoBurnedATeleportationTalisman({ objects, aboutToFall: ['lucky'], onDay: 5 })).toEqual(['lucky']);
        // It is paper now.
        expect(whoBurnedATeleportationTalisman({ objects, aboutToFall: ['lucky'], onDay: 6 })).toEqual([]);
    });
});
