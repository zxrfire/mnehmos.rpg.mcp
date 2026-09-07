/**
 * A slip that can never be burned is a row in a treasury.
 *
 * A departure talisman is one fold somebody else paid for. It breaks the rule
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
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { whoBurnedAWayOut } from '../../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { cutATalisman } from '../../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { transferPossession, type ObjectRecord } from '../../../src/engine/world/possessions';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['walk-a', 'walk-b'];
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

const slipsIn = (s: WorldState) => s.objects.filter(o => o.tags.includes('talisman'));

describe('a slip reaches a hand', () => {
    it('is held by somebody, which it never was', async () => {
        for (const state of await worldsLived()) {
            const held = slipsIn(state).filter(o => o.possessorId !== null);
            expect(held.length).toBeGreaterThan(0);
        }
    });

    it('and is burned by somebody, which it never was', async () => {
        for (const state of await worldsLived()) {
            const burned = slipsIn(state).filter(o => o.data?.spent === true);
            expect(burned.length).toBeGreaterThan(0);
        }
    });

    it('but not most of them, because most people do not die in a war', async () => {
        for (const state of await worldsLived()) {
            const slips = slipsIn(state);
            const burned = slips.filter(o => o.data?.spent === true);
            expect(burned.length).toBeLessThan(slips.length / 2);
        }
    });

    it('and a burned one names who burned it and when', async () => {
        for (const state of await worldsLived()) {
            for (const slip of slipsIn(state).filter(o => o.data?.spent === true)) {
                expect(typeof slip.data?.spentBy).toBe('string');
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
            name: 'a departure talisman',
            grade: 'earth',
            what: 'a_way_out',
            crafterId: null,
            crafterOrdinal: carries > 0 ? 40 : 10,
            onDay: 0
        });
        return transferPossession(cut, {
            onDay: 1, toHolderId: who, toHolderName: who, how: 'lent'
        });
    }

    it('takes the person who was about to be finished, and nobody else', () => {
        const objects = [aSlipInTheHandOf('doomed', 1), aSlipInTheHandOf('fine', 1)];
        const out = whoBurnedAWayOut({ objects, aboutToFall: ['doomed'], onDay: 5 });
        expect(out).toEqual(['doomed']);
        // The bystander still has theirs. A caller that asked about everybody
        // present would empty the world's paper in one war.
        expect(objects.find(o => o.possessorId === 'fine')).toBeDefined();
    });

    it('does nothing for somebody carrying nothing', () => {
        const objects: ObjectRecord[] = [];
        expect(whoBurnedAWayOut({ objects, aboutToFall: ['empty-handed'], onDay: 5 })).toEqual([]);
    });

    it('and nothing for a slip that carries no distance', () => {
        // Cut by a hand under the folding floor: a way out that is not one.
        const objects = [aSlipInTheHandOf('holding-nothing-useful', 0)];
        expect(whoBurnedAWayOut({ objects, aboutToFall: ['holding-nothing-useful'], onDay: 5 }))
            .toEqual([]);
    });

    it('and never twice out of one slip', () => {
        const objects = [aSlipInTheHandOf('lucky', 1)];
        expect(whoBurnedAWayOut({ objects, aboutToFall: ['lucky'], onDay: 5 })).toEqual(['lucky']);
        // It is paper now.
        expect(whoBurnedAWayOut({ objects, aboutToFall: ['lucky'], onDay: 6 })).toEqual([]);
    });
});
