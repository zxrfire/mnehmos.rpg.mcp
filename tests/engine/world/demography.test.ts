/**
 * People are born in places, and the places stay populated.
 *
 * THE BUG THIS PINS
 * -----------------
 * `applyDemography` placed every newborn at `locationId: region.id`. A region
 * is a container - nobody stands in one - and `npcsAt` matches on an exact
 * `locationId`, so every settlement drained as its original inhabitants died
 * while the region node filled up with people nobody could ever meet.
 *
 * Measured over a seeded, advanced world before the fix:
 *
 *   day 0   Sweptground 25   Low Fall 30   Kettle 14   Sixmile 13
 *   +20y    Sweptground 18   Low Fall 18   Kettle  6   Sixmile  6
 *   +50y    Sweptground  7   Low Fall  4   Kettle  0   Sixmile  1
 *
 * Total alive held at about 350 the whole time - nobody was dying off - and
 * "The Quiet Marches (region)" went from 39 to 170. The encounter system draws
 * its cast from who is present, so the end state is person-free events forever.
 *
 * Three separate filters had the same defect: a newborn's home, a parent's
 * whereabouts, and a faction's seat all compared something to `region.id` when
 * every one of them meant "under this region".
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { npcsAt, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

function headcount(state: WorldState, kind: string): number {
    return state.locations
        .filter(l => l.kind === kind)
        .reduce((sum, l) => sum + npcsAt(state, l.id).length, 0);
}

function livingCount(state: WorldState): number {
    return state.npcs.filter(n => n.status === 'alive').length;
}

async function advancedWorld(years: number) {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: 'demography', catalog });
    const before = {
        alive: livingCount(state),
        region: headcount(state, 'region'),
        settlements: headcount(state, 'settlement'),
        sectGround: headcount(state, 'sect_seat')
    };
    advanceWorldForPlay(state, { days: YEAR * years, stopOnInterrupt: false });
    return {
        state,
        before,
        after: {
            alive: livingCount(state),
            region: headcount(state, 'region'),
            settlements: headcount(state, 'settlement'),
            sectGround: headcount(state, 'sect_seat')
        }
    };
}

describe('a newborn is born somewhere somebody can stand', () => {
    it('drains the region containers instead of filling them', async () => {
        const { before, after } = await advancedWorld(80);
        // The exact inversion of the reported symptom. The container empties as
        // the wrongly-placed original cohort dies and is never replaced.
        expect(before.region).toBeGreaterThan(0);
        expect(after.region).toBeLessThan(before.region / 2);
    }, 180_000);

    it('keeps settlements populated across a long span', async () => {
        const { before, after } = await advancedWorld(80);
        expect(after.settlements).toBeGreaterThanOrEqual(before.settlements);
        // And the world is not simply growing: the headcount is held to target
        // by the same demography, so this is redistribution, not inflation.
        expect(after.alive).toBeLessThanOrEqual(before.alive * 1.1);
    }, 180_000);

    it('leaves no settlement without a soul in it', async () => {
        // The condition the encounter system actually depends on. An empty
        // settlement produces person-free events forever.
        const { state } = await advancedWorld(80);
        const empty = state.locations
            .filter(l => l.kind === 'settlement' && npcsAt(state, l.id).length === 0)
            .map(l => l.name);
        expect(empty, `settlements with nobody in them: ${empty.join(', ')}`).toHaveLength(0);
    }, 180_000);

    it('puts nobody on a region node after the original cohort is gone', async () => {
        const { state } = await advancedWorld(250);
        // Anyone still standing on a container is a survivor of the old
        // placement, not a new birth. Long enough and there should be almost
        // none - and crucially the count must FALL, never climb.
        expect(headcount(state, 'region')).toBeLessThan(20);
    }, 240_000);
});

describe('who lives where is decided by a weight, not by a coin flip', () => {
    it('gives every habitable place a population weight at seeding', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'weights', catalog });
        for (const l of state.locations.filter(l => l.kind === 'settlement' || l.kind === 'sect_seat')) {
            const weight = Number(l.data.populationWeight);
            expect(Number.isFinite(weight), `${l.name} has no populationWeight`).toBe(true);
            expect(weight).toBeGreaterThanOrEqual(0);
        }
    });

    it('does not put most of the world inside a sect compound', async () => {
        // There are far more houses in the catalog than there are towns, so an
        // unweighted draw over habitable ground put 61% of the living world
        // inside a compound within 150 years. A sect is a thing you join.
        const { after } = await advancedWorld(150);
        const share = after.sectGround / Math.max(1, after.alive);
        expect(share, `${Math.round(share * 100)}% of the world lives on sect ground`)
            .toBeLessThan(0.35);
        // But not zero: sect grounds are inhabited places, not scenery.
        expect(after.sectGround).toBeGreaterThan(0);
    }, 240_000);
});

describe('the other two filters that meant "under this region"', () => {
    it('still attaches newborns to lineages once births leave the container', async () => {
        // The parent filter was `n.locationId === region.id`, which matched only
        // the cohort the placement bug had parked on the container. Fixing the
        // placement without fixing this would have silently ended lineage.
        const { state } = await advancedWorld(80);
        expect(state.lineages.length).toBeGreaterThan(0);
        const withEdges = state.lineages.filter(l => l.edges.length > 0);
        expect(withEdges.length).toBeGreaterThan(0);
    }, 180_000);

    it('still lets factions recruit once their seats leave the container', async () => {
        // `f.seatLocationId === region.id` was true while factions were seated
        // on region nodes. Sects now hold ground of their own, so that
        // comparison went false for every faction in the world and the rolls
        // could only ever shrink.
        const { state, before } = await advancedWorld(80);
        const affiliated = state.npcs.filter(n => n.status === 'alive' && n.factionId !== null).length;
        expect(affiliated).toBeGreaterThan(0);
        expect(affiliated / Math.max(1, before.alive)).toBeGreaterThan(0.2);
    }, 180_000);
});
