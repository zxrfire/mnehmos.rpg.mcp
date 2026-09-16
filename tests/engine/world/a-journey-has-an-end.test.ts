/**
 * A journey has an end.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `setWhatEverybodyIsAt` opened the world with people `travelling` and no term:
 * somebody standing on a province node, or passing through a town. Nothing ever
 * ended it. That was harmless while `travelling` was not an away activity, and
 * stopped being harmless when it became one - `isAwayOnSomething` gates walking
 * out of a house and being present for a lecture, so those people could do
 * neither, for as long as they lived.
 *
 * Measured on six seeds (`afford-a/b/c`, `roster-d/e`, `demography`), living
 * people holding an away activity with no `untilDay`:
 *
 *                   world open    1 year     25 years          100 years
 *   before          51 to 62      42, 45     16 16 20 22 20 27  0 2 1 0 0 1
 *   after           0             0          0 on every seed    0 on every seed
 *
 * None of them lived on the road: the region-node rows read "going somewhere,
 * and not stopping for long" and the town rows are passing through. So they
 * kept the kind and were given a destination somewhere people live, nearest by
 * `walkingDaysFrom` and drawn by `populationWeightOf` among the nearest, and the
 * walk as a term. Every seeded traveller on all six seeds found one. The terms
 * came out at a day, because a hop between a province and a place inside it
 * costs nothing on the map.
 *
 * Red-checked by removing the call in `setWhatEverybodyIsAt`: both claims go red.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { populationWeightOf } from '../../../src/engine/world/locations.js';
import { isAwayOnSomething } from '../../../src/engine/world/npc-state.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const SEEDS = ['afford-a', 'demography'];

const termless = (state: WorldState) => state.npcs
    .filter(n => n.status === 'alive'
        && n.activity !== null
        && isAwayOnSomething(n.activity.kind)
        && (n.activity.untilDay ?? null) === null)
    .map(n => `${n.name} (${n.activity!.kind} at ${n.locationId})`);

describe('a journey has an end', () => {
    it('so everybody who opens the world travelling is going somewhere people live, by a day', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            const byId = new Map(state.locations.map(l => [l.id, l]));
            const travelling = state.npcs.filter(n => n.status === 'alive' && n.activity?.kind === 'travelling');
            expect(travelling.length, `${seed}: the precondition, somebody opens on the road`).toBeGreaterThan(0);
            for (const who of travelling) {
                const doing = who.activity!;
                expect(doing.untilDay, `${seed}: ${who.name} has no day they arrive`).toBeGreaterThan(state.currentDay - 1);
                const to = byId.get(doing.returnTo ?? '');
                expect(to, `${seed}: ${who.name} is going nowhere`).toBeDefined();
                expect(populationWeightOf(to!), `${seed}: ${who.name} is going to ${to!.name}, where nobody lives`)
                    .toBeGreaterThan(0);
            }
        }
    }, 120_000);

    it('and after the first year nobody alive holds an away activity with no term', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            advanceWorldYears(state, 1, { stopOnInterrupt: false });
            const left = termless(state);
            expect(left, `${seed}: ${left.join(', ')}`).toHaveLength(0);
        }
    }, 240_000);
});
