/**
 * A war chest is a treasury somebody opens.
 *
 * Measured before this pass existed: the treasury was moved from exactly three
 * places in the whole engine - rebuilding a flattened compound and two
 * player-facing takes - and `armItsOwn` had no caller anywhere. So a house could
 * be driven to its last hall with its best weapons still on the rack, and the
 * rule that says otherwise was a module nothing called.
 *
 * Everything here is a rate over seeded worlds actually advanced. No seed is
 * pinned to a count.
 */

import { describe, expect, it } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';
import { whoseThisIs, couldBeCalledBackIn } from '../../../src/engine/world/a-house-holds-its-own';
import type { WorldState } from '../../../src/engine/world/world-state';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own';

// The pyramid's seeds at the same horizon, so the walks are shared: see `tests/support/soaked-world.ts`.
const SEEDS = ['pyr-a', 'pyr-b', 'pyr-c'];
const YEARS = 200;

let cached: WorldState[] | null = null;

/** Three worlds, actually lived. Built once. */
async function worldsLived(): Promise<WorldState[]> {
    if (cached) return cached;
    // Kept and shared: see `tests/support/soaked-world.ts`.
    const lived: WorldState[] = [];
    for (const seed of SEEDS) lived.push(await soakedWorld(seed, { years: YEARS }));
    cached = lived;
    return cached;
}

function armings(state: WorldState): number {
    return state.history.facts.filter(f => f.summary.includes('armed its own')).length;
}

function lentByAHouse(state: WorldState) {
    const houseIds = new Set(state.factions.map(f => f.id));
    return state.objects.filter(o => whoseThisIs({
        ownerId: o.ownerId,
        possessorId: o.possessorId,
        houseIds,
        provenance: o.provenance
    }) === 'lent_by_their_house');
}

describe('a house at war opens its vault', () => {
    it('happens at all, which it did not before', async () => {
        for (const state of await worldsLived()) {
            expect(armings(state)).toBeGreaterThan(0);
        }
    });

    it('and is rare enough to still be an event', async () => {
        // A house opening its vault every year is not a house opening its
        // vault. The claim is that it is memorable, so it has to be uncommon
        // against the years it could have happened in.
        for (const state of await worldsLived()) {
            expect(armings(state)).toBeLessThan(YEARS);
        }
    });

    it('puts things into hands that were not holding them', async () => {
        for (const state of await worldsLived()) {
            expect(lentByAHouse(state).length).toBeGreaterThan(0);
        }
    });

    it('LENDS them, so every one can be called back in', async () => {
        for (const state of await worldsLived()) {
            const houseIds = new Set(state.factions.map(f => f.id));
            for (const object of lentByAHouse(state)) {
                // The house is still the owner. A house that gave its swords
                // away has spent them; a house that lent them has not.
                expect(houseIds.has(object.ownerId ?? '')).toBe(true);
                expect(couldBeCalledBackIn(whoseThisIs({
                    ownerId: object.ownerId,
                    possessorId: object.possessorId,
                    houseIds,
                    provenance: object.provenance
                }))).toBe(true);
            }
        }
    });

    it('hands each thing to exactly one person', async () => {
        for (const state of await worldsLived()) {
            const seen = new Set<string>();
            for (const object of lentByAHouse(state)) {
                expect(seen.has(object.id)).toBe(false);
                seen.add(object.id);
            }
        }
    });

    it('to its own people at the time, and some of them leave still holding it', async () => {
        // MEASURED, and kept rather than tidied away: a lent sword ends up in
        // the hands of somebody who is no longer in the house that owns it. It
        // is not a defect - `armItsOwn` only ever hands to a member - it is
        // what happens afterwards, and it is the whole reason a loan is
        // different from a gift. The house can want it back, from somebody who
        // has walked off the mountain with it.
        let stillInside = 0;
        let walkedOffWithIt = 0;
        for (const state of await worldsLived()) {
            const memberOf = new Map(state.npcs.map(n => [n.id, n.factionId]));
            for (const object of lentByAHouse(state)) {
                const holder = object.possessorId;
                if (holder === null) continue;
                const theirHouse = memberOf.get(holder);
                // Somebody the world no longer holds a row for died holding it,
                // which is a third story and not this one.
                if (theirHouse === undefined) continue;
                if (theirHouse === object.ownerId) stillInside++;
                else walkedOffWithIt++;
            }
        }
        // Most of them are where they were put.
        expect(stillInside).toBeGreaterThan(walkedOffWithIt);
        // And the leverage is real rather than theoretical.
        expect(walkedOffWithIt).toBeGreaterThan(0);
    });
});

describe('and a war takes stones out of the chest', () => {
    /**
     * BOTH ARMS IN ONE COMMAND, and they differ in one tag: the house is at
     * war in one and not in the other. A year of wages, levies and towns moves
     * both alike and cancels, so the gap between the two chests is the war's
     * bill. Per house, because whether a room opens is its own elders' call.
     */
    it('a house at war ends the year with less than the same house at peace, and never below nothing', async () => {
        const catalog = await loadCultivationCatalog();
        const base = seedWorld({ seed: 'war-chest', catalog }).state;
        const houses = base.factions
            .filter(f => f.dissolvedOnDay === null && !f.tags.includes('at_war')
                && base.npcs.some(n => n.factionId === f.id && n.status === 'alive'))
            .slice(0, 8);
        let spent = 0;
        for (const house of houses) {
            const atPeace = JSON.parse(JSON.stringify(base)) as WorldState;
            const atWar = JSON.parse(JSON.stringify(base)) as WorldState;
            atWar.factions.find(f => f.id === house.id)!.tags.push('at_war');
            const from = base.currentDay;
            applyPressure(atPeace, from, from + 365, { intensity: 0 });
            applyPressure(atWar, from, from + 365, { intensity: 0 });
            const chest = (state: WorldState) =>
                Number(state.factions.find(f => f.id === house.id)!.resources.spirit_stones ?? 0);
            expect(chest(atWar)).toBeGreaterThanOrEqual(0);
            expect(chest(atWar)).toBeLessThanOrEqual(chest(atPeace));
            if (chest(atWar) < chest(atPeace)) spent++;
        }
        // Most rooms open for a war (see `what-a-house-opens-its-treasury-for.ts`,
        // measured at 83%), and a room that says no spends nothing.
        expect(spent).toBeGreaterThanOrEqual(Math.ceil(houses.length / 2));
    });

    it('and over a lived world no chest is ever overdrawn', async () => {
        for (const state of await worldsLived()) {
            for (const house of state.factions) {
                expect(Number(house.resources.spirit_stones ?? 0)).toBeGreaterThanOrEqual(0);
            }
        }
    });
});
