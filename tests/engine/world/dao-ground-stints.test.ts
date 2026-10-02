/**
 * Open dao grounds accumulated visitors forever: the measured Drowning Steps
 * population rose from 15 in year 1 to 71 in year 10. On the pinned
 * `purse-a` world, the repaired curve is 21, 60, 75, 37 at years
 * 1, 5, 10, 20; the open-ground peak is 76. A visit must end when
 * its forty years have been paid, when its fixed personal patience runs out,
 * or when the ordinary world has called the visitor elsewhere. The check pins
 * the visible stock, not who happened to be standing there.
 */

import { describe, expect, it } from 'vitest';
import { YEARS_A_ROAD_COSTS } from '../../../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import {
    applyDaoGroundStints,
    yearsBeforeGivingUpAtDaoGround
} from '../../../src/engine/world/dao-ground-stints.js';
import { daoGroundLocationId, groundAtLocation } from '../../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { cloneWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { PLACES_THAT_TEACH_A_DAO } from '../../../src/data/cultivation/places-that-teach-a-dao.js';
import { advanceWorldYears } from '../../support/advance-world-years.js';

const STEP = PLACES_THAT_TEACH_A_DAO.find(place => place.id === 'dao-ground-drowning-steps')!;
const STEP_ID = daoGroundLocationId(STEP);
const catalog = await loadCultivationCatalog();

function world(seed = 'purse-a'): WorldState {
    return seedWorld({ seed, catalog }).state;
}

function preparedVisitor(state: WorldState, sinceDay: number): { at: number; ground: NonNullable<ReturnType<typeof groundAtLocation>> } {
    const at = state.npcs.findIndex(npc => npc.status === 'alive' && npc.locationId !== STEP_ID);
    const location = state.locations.find(place => place.id === STEP_ID)!;
    const ground = groundAtLocation(location)!;
    const visitor = state.npcs[at]!;
    state.npcs[at] = {
        ...visitor,
        locationId: STEP_ID,
        activity: {
            kind: 'comprehending', note: `Studying ${ground.subject}.`, withIds: [],
            sinceDay, untilDay: null, returnTo: visitor.locationId
        }
    };
    return { at, ground };
}

describe('dao-ground stints', () => {
    it('sends a visitor away after the ground has taught them', () => {
        const state = world('dao-ground-comprehension');
        const day = 50 * 365;
        const { at, ground } = preparedVisitor(state, day - YEARS_A_ROAD_COSTS.ground_open * 365);

        expect(applyDaoGroundStints(state, day).comprehended).toBe(1);
        expect(state.npcs[at]!.activity?.kind).toBe('travelling');
        expect(state.npcs[at]!.activity?.returnTo).not.toBe(STEP_ID);
        expect(ground.access).toBe('open');
        const fact = state.history.facts.find(row => row.kind === 'dao_comprehension');
        expect(fact?.day).toBe(day);
        expect(fact?.actors).toEqual([{ id: state.npcs[at]!.id, name: state.npcs[at]!.name, role: 'comprehended' }]);
        expect(fact?.locationId).toBe(STEP_ID);
        expect(fact?.data.daoGroundId).toBe(STEP_ID);
        expect(fact?.summary).toContain(`at ${state.locations.find(place => place.id === STEP_ID)!.name}.`);
    });

    it('sends a visitor away when their own stint runs out before comprehension', () => {
        const state = world('dao-ground-gives-up');
        const day = 30 * 365;
        const { at, ground } = preparedVisitor(state, 0);
        const years = yearsBeforeGivingUpAtDaoGround({
            seed: state.seed, npc: state.npcs[at]!, domain: ground.domain, subject: ground.subject
        });
        state.npcs[at] = { ...state.npcs[at]!, activity: { ...state.npcs[at]!.activity!, sinceDay: day - years * 365 } };

        expect(years).toBeLessThan(YEARS_A_ROAD_COSTS.ground_open);
        expect(applyDaoGroundStints(state, day).gaveUp).toBe(1);
        expect(state.npcs[at]!.activity?.kind).toBe('travelling');
    });

    it('keeps a seeded open ground bounded over twenty years, while new visitors still arrive', () => {
        const state = world();
        const curve: number[] = [];
        const seen = new Set<string>();
        const openGroundIds = new Set(state.locations
            .filter(place => groundAtLocation(place)?.access === 'open')
            .map(place => place.id));
        let highestOpenGroundCount = 0;
        let firstYearVisitors = 0;
        for (let year = 1; year <= 20; year++) {
            advanceWorldYears(state, 1, { stopOnInterrupt: false });
            const here = state.npcs.filter(npc => npc.status === 'alive' && npc.locationId === STEP_ID);
            if ([1, 5, 10, 20].includes(year)) curve.push(here.length);
            if (year === 1) firstYearVisitors = here.length;
            for (const npc of here) seen.add(npc.id);
            for (const groundId of openGroundIds) {
                highestOpenGroundCount = Math.max(highestOpenGroundCount,
                    state.npcs.filter(npc => npc.status === 'alive' && npc.locationId === groundId).length);
            }
        }

        // This is a population curve, so its measured counts are the behaviour.
        expect(curve).toEqual([21, 60, 75, 37]);
        expect(highestOpenGroundCount).toBeLessThanOrEqual(76);
        expect(seen.size).toBeGreaterThan(firstYearVisitors);
    }, 120_000);

    it('uses the same stint outcome for the same seeded world', () => {
        const original = world('dao-ground-repeatable');
        const left = cloneWorld(original);
        const right = cloneWorld(original);
        const a = preparedVisitor(left, 0);
        const b = preparedVisitor(right, 0);
        expect(yearsBeforeGivingUpAtDaoGround({ seed: left.seed, npc: left.npcs[a.at]!, domain: a.ground.domain, subject: a.ground.subject }))
            .toBe(yearsBeforeGivingUpAtDaoGround({ seed: right.seed, npc: right.npcs[b.at]!, domain: b.ground.domain, subject: b.ground.subject }));
    });
});
