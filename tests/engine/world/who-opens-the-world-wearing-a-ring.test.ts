/**
 * A world opens with storage rings on the hands of the people rich or high enough to own one.
 *
 * Rings are bartered for, looted, given or folded, never bought at a counter, so looting and
 * barter need somebody holding one. Before this no seeded person did.
 *
 * What is pinned:
 *
 *   SOMEBODY HOLDS ONE   a seeded world has ring holders, each wearing a ring marked to them
 *   RARE AND HIGH        no Qi Condensation cultivator holds one, and the share holding one climbs
 *                        with the realm: Foundation below Core Formation below Nascent Soul
 *   A FOLDER HAS ONE     everybody who can fold a ring holds at least the smallest
 *
 * Red-checked: with the seeding call removed it fails on a Void Tribulation elder holding none.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import { realmForOrdinal } from '../../../src/engine/cultivation/realms';
import { isAStorageRing, whoseMarkIsOn, canReachInto } from '../../../src/engine/world/a-storage-ring';
import { couldFoldARing } from '../../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds';
import { WORLD_POPULATION } from '../../../src/server/state/cultivation-world';

describe('who opens the world wearing a ring', () => {
    it('puts a ring on the rich and the high, and on nobody at the bottom', async () => {
        const catalog = await loadCultivationCatalog();
        for (const seed of ['road-world', 'w-2']) {
            const { state } = seedWorld({ seed, catalog, population: WORLD_POPULATION });
            const rings = state.objects.filter(isAStorageRing);
            const holders = new Set(rings.map(ring => ring.possessorId));
            const byRealm = new Map<string, { n: number; rings: number }>();
            for (const npc of state.npcs.filter(n => n.status === 'alive')) {
                const realm = realmForOrdinal(npc.cultivation.realmOrdinal).key;
                const row = byRealm.get(realm) ?? { n: 0, rings: 0 };
                row.n++;
                if (holders.has(npc.id)) row.rings++;
                byRealm.set(realm, row);
                if (couldFoldARing('mortal', npc.cultivation.realmOrdinal)) {
                    expect(holders.has(npc.id), `${npc.name} can fold a ring and holds none`).toBe(true);
                }
            }
            const share = (realm: string) => {
                const row = byRealm.get(realm) ?? { n: 0, rings: 0 };
                return row.n === 0 ? 0 : row.rings / row.n;
            };
            console.log(`[rings] ${seed}: ${rings.length} rings; ${[...byRealm.entries()]
                .map(([realm, row]) => `${realm} ${row.rings}/${row.n}`).join(', ')}`);

            expect(rings.length).toBeGreaterThan(0);
            for (const ring of rings) {
                expect(ring.ownerId).toBe(ring.possessorId);
                expect(whoseMarkIsOn(ring)?.by).toBe(ring.ownerId);
                expect(canReachInto(ring, ring.possessorId!)).toBe(true);
            }
            // One ring a hand.
            expect(holders.size).toBe(rings.length);
            expect(share('qi_condensation')).toBe(0);
            expect(share('foundation_establishment')).toBeLessThan(share('core_formation'));
            expect(share('core_formation')).toBeLessThanOrEqual(share('nascent_soul'));
            expect(share('core_formation')).toBeGreaterThan(0.5);
            expect(share('foundation_establishment')).toBeLessThan(0.1);
        }
    }, 120_000);
});
