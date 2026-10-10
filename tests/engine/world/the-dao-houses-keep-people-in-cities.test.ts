/**
 * The owner, 2026-10-09: a house keeps people away from home in three sizes. A posting is one
 * member; a Dao house's shopfront (分号) is at most three, because three is all a scene holds; and
 * only the Immovable Mountain Temple keeps branches (下院), with its own leadership. Not every city
 * has every house. See `docs/world/houses/dao-houses.md`.
 */
import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { A_SHOPFRONT_HOLDS, isACityThatMatters, shopfrontsAt, shopfrontSitesOf } from '../../../src/engine/world/a-dao-house-shopfront.js';
import { A_BRANCH_HOLDS, HOW_MANY_BRANCHES, THE_TEMPLE_ID, templeBranchesOf, whoHeadsTheBranch } from '../../../src/engine/world/a-temple-branch.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { theRollItsPostsNeed } from '../../../src/engine/world/what-a-houses-standing-posts-need.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const catalog = await loadCultivationCatalog();
const world: WorldState = seedWorld({ seed: 'dao-houses-in-cities', catalog }).state;
const onPost = (houseId: string, placeId: string) => world.npcs.filter(n => n.status === 'alive'
    && n.factionId === houseId && n.activity?.kind === 'stationed' && n.locationId === placeId);

describe('a Dao house keeps shopfronts in the cities that matter', () => {
    it('has the Jade Register at every city that matters, and the Flowing Star at some', () => {
        const cities = world.locations.filter(isACityThatMatters);
        expect(cities.length).toBeGreaterThan(1);
        for (const city of cities) {
            expect(shopfrontsAt(world, city).map(s => s.houseId)).toContain('house-jade-register');
        }
        const offices = shopfrontSitesOf(world, 'house-flowing-light');
        expect(offices.length, 'the Tower opened no office anywhere').toBeGreaterThan(0);
        expect(offices.length, 'not every city has every house').toBeLessThanOrEqual(cities.length);
        // No town that does not matter carries a gatehouse.
        const town = world.locations.find(l => l.kind === 'settlement' && !isACityThatMatters(l))!;
        expect(shopfrontsAt(world, town)).toEqual([]);
    });

    it('keeps people on post at its shopfronts, never more than a scene holds', () => {
        for (const houseId of ['house-jade-register', 'house-flowing-light', 'house-vermilion-seal']) {
            const sites = shopfrontSitesOf(world, houseId);
            const staffed = sites.filter(site => onPost(houseId, site.id).length > 0);
            expect(staffed.length, `${houseId} keeps nobody at any shopfront`).toBeGreaterThan(0);
            for (const site of sites) expect(onPost(houseId, site.id).length).toBeLessThanOrEqual(A_SHOPFRONT_HOLDS);
        }
    });

    it('keeps a roll big enough for its posts, and staffs each one fully', () => {
        // The owner: with posts capped at about half the roll, "a house's roll might have to be bigger too".
        for (const houseId of ['house-jade-register', 'house-flowing-light', 'house-vermilion-seal']) {
            const house = world.factions.find(f => f.id === houseId)!;
            if (!house.tags.includes('recruits')) continue;
            const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === houseId).length;
            expect(roll, `${houseId} opens below what its posts need`).toBeGreaterThanOrEqual(theRollItsPostsNeed(world, houseId));
            for (const site of shopfrontSitesOf(world, houseId)) {
                expect(onPost(houseId, site.id).length, `${houseId} at ${site.name}`).toBe(A_SHOPFRONT_HOLDS);
            }
        }
    });

    it('is an area a player can walk to', () => {
        const city = shopfrontSitesOf(world, 'house-jade-register')[0]!;
        expect(theAreasOf(world, city).areas.map(a => a.name)).toContain('the Jade Register gatehouse');
    });
});

describe('only the Temple keeps branches, and each is headed by whoever stands highest there', () => {
    it('has lower cloisters in cities that matter, staffed and headed', () => {
        const branches = templeBranchesOf(world, THE_TEMPLE_ID);
        expect(branches.length).toBe(HOW_MANY_BRANCHES);
        for (const branch of branches) {
            const city = world.locations.find(l => l.id === branch.parentId)!;
            expect(isACityThatMatters(city)).toBe(true);
            const people = onPost(THE_TEMPLE_ID, branch.id);
            expect(people.length, `${branch.name} is empty`).toBeGreaterThan(0);
            expect(people.length).toBeLessThanOrEqual(A_BRANCH_HOLDS);
            const head = whoHeadsTheBranch(world, branch)!;
            expect(head.factionRankIndex).toBe(Math.max(...people.map(p => p.factionRankIndex)));
        }
        for (const house of world.factions.filter(h => h.id !== THE_TEMPLE_ID)) {
            expect(templeBranchesOf(world, house.id)).toEqual([]);
        }
    });
});
