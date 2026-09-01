/**
 * The supply side of the dao gate.
 *
 * `breakthrough.ts` refuses a realm crossing to anybody holding fewer
 * comprehension domains than the rung asks for, and that switch was held off
 * for a long time because NOTHING IN THE WORLD SUPPLIED COMPREHENSION TO AN
 * NPC. Measured before this existed: 0 of 1,511 living NPCs held a single road
 * besides their own, and at 1,500 years nothing crossed ordinal 28 again.
 *
 * What is pinned here is the shape of the supply rather than its rate - the
 * rates live in the probe, where they can be re-measured. Four things must hold
 * or the gate is one-sided again:
 *
 *   1. The catalog is coherent: no ground teaches `element`, every road is
 *      reachable without a house, and every province has something in it.
 *   2. A ground is an ORDINARY location, with the holder's control recorded on
 *      the holder as well as on the place.
 *   3. Access actually gates. Standing, province and discovery each refuse
 *      somebody, and each refusal is the one the design named.
 *   4. A spent material still teaches. The object is gone and the row is not,
 *      and the road is read off the row - which is the only channel where "in
 *      reach" is the wrong test.
 */

import { describe, it, expect } from 'vitest';

import {
    PLACES_THAT_TEACH_A_DAO,
    PlaceThatTeachesADaoSchema,
    daoGroundsHeldBy,
    daoGroundsIn
} from '../../../src/data/cultivation/places-that-teach-a-dao.js';
import {
    DAO_GROUND_TAG,
    daoGroundLocationId,
    daoGroundsInReachOf,
    roadsBoughtWithMaterialsBy,
    roadsInReachOf,
    seedPlacesThatTeachADao,
    spendMaterialsOnTheBlocked
} from '../../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import {
    MATERIAL_BANDS,
    isUnspent,
    spend
} from '../../../src/engine/world/single-use-dao-comprehension-materials.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFaction, createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { InsightDomainSchema } from '../../../src/schema/cultivation.js';
import {
    ROADS_BESIDES_YOUR_OWN,
    daoRequirementCurve,
    roadsWalked
} from '../../../src/engine/cultivation/breakthrough.js';

// ═══════════════════════════════════════════════════════════════════════════
// THE CATALOG
// ═══════════════════════════════════════════════════════════════════════════

describe('the places that teach a dao', () => {
    it('are all well formed, and none of them teaches the road you were born with', () => {
        for (const place of PLACES_THAT_TEACH_A_DAO) {
            expect(() => PlaceThatTeachesADaoSchema.parse(place), place.id).not.toThrow();
            // A ground teaching `element` would be teaching what everybody
            // already has, and the gate does not count it - so the row would be
            // scenery wearing the shape of supply.
            expect(place.domain, place.id).not.toBe('element');
        }
    });

    it('have distinct ids and distinct names, because a player types the name back', () => {
        const ids = new Set(PLACES_THAT_TEACH_A_DAO.map(p => p.id));
        const names = new Set(PLACES_THAT_TEACH_A_DAO.map(p => p.name));
        expect(ids.size).toBe(PLACES_THAT_TEACH_A_DAO.length);
        expect(names.size).toBe(PLACES_THAT_TEACH_A_DAO.length);
    });

    it('leave every road reachable without joining anything', () => {
        // Specialisation is an advantage, never ownership. If a house held the
        // only door to a domain, that house could close a road to the world,
        // and the Dao houses are held to exactly this rule already.
        const unheld = new Set(
            PLACES_THAT_TEACH_A_DAO.filter(p => p.access !== 'held').map(p => p.domain)
        );
        for (const domain of ROADS_BESIDES_YOUR_OWN) {
            expect(unheld.has(domain), `${domain} is only ever taught by a house`).toBe(true);
        }
    });

    it('teach every road that exists besides the one a root supplies', () => {
        const taught = new Set(PLACES_THAT_TEACH_A_DAO.map(p => p.domain));
        for (const domain of InsightDomainSchema.options) {
            if (domain === 'element') continue;
            expect(taught.has(domain), `nothing teaches ${domain}`).toBe(true);
        }
    });

    it('put something in every province, so being born badly narrows and never empties', () => {
        const provinces = new Set(PLACES_THAT_TEACH_A_DAO.map(p => p.regionId));
        for (const regionId of provinces) {
            const open = daoGroundsIn(regionId).filter(p => p.access !== 'held');
            expect(open.length, `${regionId} has nothing anybody outside a house can reach`)
                .toBeGreaterThan(0);
        }
        // And five provinces, which is every province the world has.
        expect(provinces.size).toBeGreaterThanOrEqual(5);
    });

    it('keep the buried ones genuinely buried and the held ones genuinely held', () => {
        for (const place of PLACES_THAT_TEACH_A_DAO) {
            if (place.access === 'held') {
                expect(place.heldBy, place.id).toBeTruthy();
                expect(daoGroundsHeldBy(place.heldBy!), place.id).toContainEqual(place);
            } else {
                expect(place.heldBy, place.id).toBeNull();
                expect(place.standingRequired, place.id).toBe(0);
            }
        }
        expect(PLACES_THAT_TEACH_A_DAO.filter(p => p.access === 'buried').length)
            .toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE MATERIALS
// ═══════════════════════════════════════════════════════════════════════════

describe('the single-use materials', () => {
    it('each teach one road, and cover the road no technique in the world teaches', () => {
        for (const band of MATERIAL_BANDS) {
            expect(band.domain, `${band.name}`).not.toBe('element');
        }
        // `alchemy` is declared by no technique in the catalog, so a
        // cultivator's practice can never supply it. The commonest and cheapest
        // material is the one that does, which is why houses hoard them.
        const domains = MATERIAL_BANDS.map(b => b.domain);
        expect(domains).toContain('alchemy');
        const cheapest = [...MATERIAL_BANDS].sort((a, b) => a.forOrdinal - b.forOrdinal)[0];
        expect(cheapest.domain).toBe('alchemy');
    });

    it('sit at distinct heights, so one band is one object rather than a lottery', () => {
        const heights = new Set(MATERIAL_BANDS.map(b => b.forOrdinal));
        expect(heights.size).toBe(MATERIAL_BANDS.length);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// A WORLD SMALL ENOUGH TO REASON ABOUT
// ═══════════════════════════════════════════════════════════════════════════

const HOUSE = 'faction-under-test';
const OTHER_HOUSE = 'faction-next-door';

function tinyWorld(): WorldState {
    const state = createWorld({ seed: 'roads-test', presentYear: 1000, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'loc-region-low-fall',
        name: 'The Low Fall',
        kind: 'region',
        data: { catalogRegionId: 'region-low-fall' }
    }));
    state.locations.push(makeLocation({
        id: 'loc-region-white-stair',
        name: 'The White Stair',
        kind: 'region',
        data: { catalogRegionId: 'region-white-stair' }
    }));
    state.locations.push(makeLocation({
        id: 'loc-seat',
        name: 'the seat',
        kind: 'sect_seat',
        parentId: 'loc-region-low-fall'
    }));
    state.factions.push(makeFaction({ id: HOUSE, name: 'The House Under Test', seatLocationId: 'loc-seat' }));
    state.factions.push(makeFaction({ id: OTHER_HOUSE, name: 'The House Next Door' }));
    return state;
}

/** A ground of our own, so the test does not depend on catalog content. */
function ground(
    state: WorldState,
    init: {
        id: string; domain: string; access: string; from: number;
        region: string; holder?: string; standing?: number; discovered?: boolean;
    }
): void {
    state.locations.push(makeLocation({
        id: init.id,
        name: init.id,
        kind: 'wilds',
        parentId: null,
        discovered: init.discovered ?? true,
        controllingFactionId: init.holder ?? null,
        tags: [DAO_GROUND_TAG, init.access],
        data: {
            daoGroundId: init.id,
            daoDomain: init.domain,
            daoSubject: init.domain,
            daoFromOrdinal: init.from,
            daoAccess: init.access,
            daoStandingRequired: init.standing ?? 0,
            catalogRegionId: init.region
        }
    }));
}

function member(overrides: {
    id?: string;
    factionId?: string | null;
    factionRankIndex?: number;
    realmOrdinal?: number;
} = {}): NpcRecord {
    return createNpc('roads-test', {
        id: overrides.id ?? 'npc-under-test',
        name: 'Somebody',
        bornOnDay: 0,
        onDay: 100,
        locationId: 'loc-seat',
        factionId: overrides.factionId === undefined ? HOUSE : overrides.factionId,
        factionRankIndex: overrides.factionRankIndex ?? 2,
        // No arts at all, so every road counted in this file came from the
        // ground or from a spent object and never from `roadsWalkedBy`.
        cultivation: { realmOrdinal: overrides.realmOrdinal ?? 24, techniqueIds: [] }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// SEEDING
// ═══════════════════════════════════════════════════════════════════════════

describe('seeding the ground', () => {
    it('makes ordinary locations, and tells the holder it holds them', () => {
        const state = tinyWorld();
        state.factions.push(makeFaction({
            id: 'sect-azure-cloud-pavilion',
            name: 'Azure Cloud Pavilion',
            seatLocationId: 'loc-seat'
        }));
        const seeded = seedPlacesThatTeachADao(state);
        // Only the provinces this world actually has. A ground is IN a province
        // and a catalog with no Drowned Reach in it does not get the Salt Hall.
        expect(seeded.length).toBe(
            PLACES_THAT_TEACH_A_DAO.filter(
                p => p.regionId === 'region-low-fall' || p.regionId === 'region-white-stair'
            ).length
        );
        expect(seeded.length).toBeLessThan(PLACES_THAT_TEACH_A_DAO.length);

        const cliff = seeded.find(l => l.id === daoGroundLocationId(
            PLACES_THAT_TEACH_A_DAO.find(p => p.heldBy === 'sect-azure-cloud-pavilion')!
        ));
        expect(cliff).toBeTruthy();
        expect(cliff!.controllingFactionId).toBe('sect-azure-cloud-pavilion');
        // Recorded on the holder as well, or `locationsControlledBy` disagrees
        // with the location about who owns it.
        const holder = state.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
        expect(holder.controlledLocationIds).toContain(cliff!.id);
    });

    it('seeds a buried ground undiscovered and everything else discovered', () => {
        const state = tinyWorld();
        const seeded = seedPlacesThatTeachADao(state);
        let buried = 0;
        for (const place of PLACES_THAT_TEACH_A_DAO) {
            const location = seeded.find(l => l.id === daoGroundLocationId(place));
            if (!location) continue;
            expect(location.discovered, place.id).toBe(place.access !== 'buried');
            if (place.access === 'buried') buried++;
        }
        expect(buried, 'the fixture provinces hold no buried ground to check')
            .toBeGreaterThan(0);
    });

    it('never puts a child on one, because a dao ground is somewhere you go', () => {
        const state = tinyWorld();
        for (const location of seedPlacesThatTeachADao(state)) {
            expect(location.data.populationWeight, location.name).toBe(0);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// ACCESS ACTUALLY GATES
// ═══════════════════════════════════════════════════════════════════════════

describe('what is in reach, and what refuses', () => {
    it('gives a member of the right house at the right standing the road', () => {
        const state = tinyWorld();
        ground(state, {
            id: 'g-held', domain: 'weapon', access: 'held', from: 12,
            region: 'region-low-fall', holder: HOUSE, standing: 2
        });
        expect(daoGroundsInReachOf(state, member()).map(r => r.domain)).toEqual(['weapon']);
    });

    it('refuses the same road to somebody in the same house without the standing', () => {
        // This is what forty years of sweeping actually buys, and it is why an
        // outer disciple at a house whose ground asks for an elder is stuck in
        // a way a rogue is not - the rogue can go somewhere else.
        const state = tinyWorld();
        ground(state, {
            id: 'g-held', domain: 'weapon', access: 'held', from: 12,
            region: 'region-low-fall', holder: HOUSE, standing: 4
        });
        expect(daoGroundsInReachOf(state, member({ factionRankIndex: 1 }))).toEqual([]);
    });

    it('refuses it to somebody standing in the building who is not in the house', () => {
        const state = tinyWorld();
        ground(state, {
            id: 'g-held', domain: 'weapon', access: 'held', from: 12,
            region: 'region-low-fall', holder: HOUSE, standing: 0
        });
        expect(daoGroundsInReachOf(state, member({ factionId: OTHER_HOUSE }))).toEqual([]);
    });

    it('gives open ground to anybody in the province and to nobody outside it', () => {
        const state = tinyWorld();
        ground(state, {
            id: 'g-open', domain: 'body', access: 'open', from: 4, region: 'region-low-fall'
        });
        ground(state, {
            id: 'g-elsewhere', domain: 'time', access: 'open', from: 4, region: 'region-white-stair'
        });
        // Reached by walking up the parent chain from where they are standing.
        expect(daoGroundsInReachOf(state, member()).map(r => r.domain)).toEqual(['body']);
    });

    it('teaches nobody from a buried ground until somebody has dug it open', () => {
        const state = tinyWorld();
        ground(state, {
            id: 'g-buried', domain: 'void', access: 'buried', from: 12,
            region: 'region-low-fall', discovered: false
        });
        expect(daoGroundsInReachOf(state, member())).toEqual([]);

        const at = state.locations.findIndex(l => l.id === 'g-buried');
        state.locations[at] = { ...state.locations[at], discovered: true };
        expect(daoGroundsInReachOf(state, member()).map(r => r.domain)).toEqual(['void']);
    });

    it('refuses a ground to anybody standing below its floor', () => {
        // Below `fromOrdinal` a visitor takes nothing, and it is the same floor
        // that makes standing there survivable at all.
        const state = tinyWorld();
        ground(state, {
            id: 'g-high', domain: 'void', access: 'open', from: 28, region: 'region-low-fall'
        });
        expect(daoGroundsInReachOf(state, member({ realmOrdinal: 24 }))).toEqual([]);
        expect(daoGroundsInReachOf(state, member({ realmOrdinal: 28 })).map(r => r.domain)).toEqual(['void']);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE OBJECT THAT IS SPENT BY BEING UNDERSTOOD
// ═══════════════════════════════════════════════════════════════════════════

function material(id: string, domain: string, forOrdinal: number, owner: string | null) {
    return makeObject({
        id,
        name: id,
        kind: 'material',
        power: forOrdinal,
        ownerId: owner,
        possessorId: owner,
        tags: ['comprehension', 'single-use', `road:${domain}`],
        data: { forOrdinal, domain, spent: false }
    });
}

describe('a material is spent once and still teaches afterwards', () => {
    it('reads the road off the spent row, which is why spending marks and never deletes', () => {
        const state = tinyWorld();
        const row = material('mat-1', 'alchemy', 24, HOUSE);
        state.objects.push(spend(row, 'npc-under-test', 500));

        const roads = roadsBoughtWithMaterialsBy(state, 'npc-under-test');
        expect(roads.map(r => r.domain)).toEqual(['alchemy']);
        // The record of who used one is the comprehension. Delete the row and
        // this channel disappears with it, which is correct: the world would
        // then have no record that it was ever used on anybody.
        expect(state.objects[0].data.spentBy).toBe('npc-under-test');
        expect(isUnspent(state.objects[0])).toBe(false);
    });

    it('teaches nobody else, ever', () => {
        const state = tinyWorld();
        state.objects.push(spend(material('mat-1', 'alchemy', 24, HOUSE), 'somebody-else', 500));
        expect(roadsBoughtWithMaterialsBy(state, 'npc-under-test')).toEqual([]);
    });
});

describe('a house spending one on the disciple at the wall', () => {
    it('spends it on somebody who is actually stopped, and not on anybody else', () => {
        const state = tinyWorld();
        // Standing at ordinal 24, which asks for roads, and holding none.
        state.npcs.push(member({ id: 'blocked' }));
        state.objects.push(material('mat-1', 'alchemy', 24, HOUSE));

        expect(daoRequirementCurve(24)).toBeGreaterThan(0);
        expect(spendMaterialsOnTheBlocked(state, 500)).toBe(1);
        expect(state.objects[0].data.spentBy).toBe('blocked');

        // And the road survives the object, which is the whole point.
        const after = roadsInReachOf(state, state.npcs[0]);
        expect(roadsWalked(after)).toBeGreaterThan(0);
    });

    it('does not spend one on somebody who was going to cross anyway', () => {
        const state = tinyWorld();
        // Two roads already in reach at a rung that asks for two.
        ground(state, {
            id: 'g-a', domain: 'weapon', access: 'open', from: 0, region: 'region-low-fall'
        });
        ground(state, {
            id: 'g-b', domain: 'body', access: 'open', from: 0, region: 'region-low-fall'
        });
        state.npcs.push(member({ id: 'fine' }));
        state.objects.push(material('mat-1', 'alchemy', 24, HOUSE));

        expect(spendMaterialsOnTheBlocked(state, 500)).toBe(0);
        expect(isUnspent(state.objects[0])).toBe(true);
    });

    it('will not spend one it does not own, or one pitched nowhere near them', () => {
        const state = tinyWorld();
        state.npcs.push(member({ id: 'blocked' }));
        state.objects.push(material('mat-elsewhere', 'alchemy', 24, OTHER_HOUSE));
        state.objects.push(material('mat-too-high', 'karma', 40, HOUSE));
        expect(spendMaterialsOnTheBlocked(state, 500)).toBe(0);
    });

    it('spends at most one per house per year, on the deepest rung that is stuck', () => {
        const state = tinyWorld();
        state.npcs.push(member({ id: 'junior', realmOrdinal: 20 }));
        state.npcs.push(member({ id: 'senior', realmOrdinal: 24 }));
        state.objects.push(material('mat-1', 'alchemy', 24, HOUSE));
        state.objects.push(material('mat-2', 'karma', 20, HOUSE));

        expect(spendMaterialsOnTheBlocked(state, 500)).toBe(1);
        // The person nearest the top of the ladder, because the house is
        // spending a finite thing and their crossing changes what it is.
        expect(state.objects.filter(o => o.data.spentBy === 'senior').length).toBe(1);
        expect(state.objects.filter(o => o.data.spentBy === 'junior').length).toBe(0);
    });
});
