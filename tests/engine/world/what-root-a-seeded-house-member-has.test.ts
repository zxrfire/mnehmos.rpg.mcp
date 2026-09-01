/**
 * Two questions again, and again they must not share a function.
 *
 *   WHAT ROOT IS SOMEBODY BORN WITH?   `rollSpiritRoot`, the root table,
 *                                      untouched, for everybody.
 *
 *   WHAT ROOT DOES A HOUSE'S SWORD      The root table reweighted by which
 *   ELDER TURN OUT TO HAVE HAD?         roots can walk the road they climbed.
 *
 * Measured before this module: root fit with the house road was 58-65% at EVERY
 * rung, flat, with no improvement from bottom to top - and 53.3% at ordinal 37
 * and above, the worst band in the world.
 *
 * The failures in the other direction are asserted too, because each of them
 * would be worse than the defect: a house of nothing but one perfect root, a
 * world whose root histogram has tilted toward whatever the big houses teach, a
 * demonic house reading as a lineage, and a servant rung that has been quietly
 * emptied of the people who give it its reason.
 */

import { describe, it, expect } from 'vitest';
import {
    houseRoadOf,
    roadRefuses,
    reachableCeiling,
    rootWeightsForSomebodyAt,
    rootSharesAt,
    drawRootForSomebodyAlreadyInAHouse,
    STAYS_ON_A_REFUSING_ROAD_PER_RUNG,
    type HouseRoad
} from '../../../src/engine/world/what-root-a-seeded-house-member-has.js';
import {
    SPIRIT_ROOTS,
    rollSpiritRoot,
    getSpiritRoot,
    rootProbability,
    conflictsWithRoot,
    type SpiritRootKey
} from '../../../src/engine/cultivation/spirit-roots.js';
import { CONFLICTING_TECHNIQUE_RISK } from '../../../src/engine/cultivation/deviation.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

const catalog = await loadCultivationCatalog();

const metalRoad = houseRoadOf({ preferredRoots: [], teachesElements: ['metal', 'metal'] });
const twoRoads = houseRoadOf({ preferredRoots: [], teachesElements: ['metal', 'water'] });
const noRoad = houseRoadOf({ preferredRoots: [], teachesElements: [null, null] });
const iceOnly = houseRoadOf({ preferredRoots: ['mutated_ice'], teachesElements: ['ice'] });

// ─────────────────────────────────────────────────────────────────────────

describe('the regime is read off the catalog, never tagged by hand', () => {
    it('separates the four kinds', () => {
        expect(metalRoad.regime).toBe('single_road');
        expect(twoRoads.regime).toBe('several_roads');
        expect(noRoad.regime).toBe('no_road');
        expect(iceOnly.regime).toBe('stated_roots');
    });

    it('lets stated roots beat the element count, because ice refuses nobody', () => {
        // THE FINDING THAT FORCED THIS ORDER. `OVERCOMES` maps ice and lightning
        // to null, so `conflictsWithRoot` says an ice road is open to 100% of
        // births - the Frostmirror Court's narrowness is not in the conflict
        // rule at all, it is in the roots it says it takes. Reading only the
        // element would have missed the narrowest house in the world.
        for (const root of SPIRIT_ROOTS) {
            expect(conflictsWithRoot(root, 'ice')).toBe(false);
        }
        expect(roadRefuses(iceOnly, getSpiritRoot('single_metal'))).toBe(true);
        expect(roadRefuses(iceOnly, getSpiritRoot('mutated_ice'))).toBe(false);
    });

    it('treats a stated preference as strong, and only teaching as a bar', () => {
        // `preferredRoots` is documented as the roots a house RECRUITS. Reading
        // it as an exclusion was wrong and measurable: the Pavilion prefers two
        // roots of twelve, so a bar turned four fifths of its people into
        // servants and emptied the middle of eleven houses. A house that can
        // teach only one road is the genuinely hard case.
        const senior = rootWeightsForSomebodyAt(iceOnly, 40, 4);
        expect(senior.every(r => r.weight > 0)).toBe(true);
        // Strong, though: at the top the stated root dominates on its own.
        const shares = rootSharesAt(iceOnly, 40, 4);
        expect(shares.get('mutated_ice')!).toBeGreaterThan(0.5);
        // And ordinary at the bottom, where nothing has filtered anybody.
        expect(rootSharesAt(iceOnly, 2, 1).get('mutated_ice')!).toBeLessThan(0.1);
    });

    it('never hard-filters a demonic house, whatever its shelf holds', () => {
        // A trophy cabinet is not a lineage. It did not develop the road, there
        // is nobody whose lineage it is, and its seniors may each have come up
        // a different one.
        const stolen = houseRoadOf({
            preferredRoots: ['mutated_ice'], teachesElements: ['metal'], alignment: 'demonic'
        });
        expect(stolen.regime).toBe('several_roads');
        expect(stolen.statedRoots).toEqual([]);
        // Same single road, righteous: it is a lineage, it can teach nothing
        // else, and the roots it refuses have no rung above the bottom. Demonic:
        // the same shelf refuses nobody outright. That gap is the outflow that
        // stops the mismatched roots dead-ending at the bottom of somewhere that
        // will never promote them, and it is most of why anybody joins one.
        const asLineage = houseRoadOf({
            preferredRoots: [], teachesElements: ['metal'], alignment: 'righteous'
        });
        expect(asLineage.regime).toBe('single_road');
        const seniorHere = rootWeightsForSomebodyAt(stolen, 30, 4);
        const seniorThere = rootWeightsForSomebodyAt(asLineage, 30, 4);
        expect(seniorHere.every(r => r.weight > 0)).toBe(true);
        expect(seniorThere.some(r => r.weight === 0)).toBe(true);
    });
});

describe('the root table is the prior and is never touched', () => {
    it('returns the root table exactly on the bottom rung, in every regime', () => {
        // The servant rung, and the outer disciple among hundreds. Nothing has
        // filtered them, so nothing here does either.
        for (const road of [metalRoad, twoRoads, noRoad, iceOnly]) {
            const shares = rootSharesAt(road, 40, 0);
            for (const root of SPIRIT_ROOTS) {
                expect(shares.get(root.key)).toBeCloseTo(rootProbability(root.key), 12);
            }
        }
    });

    it('returns the root table exactly in a house with no elemental road', () => {
        for (const rank of [0, 1, 5]) {
            const shares = rootSharesAt(noRoad, 44, rank);
            for (const root of SPIRIT_ROOTS) {
                expect(shares.get(root.key)).toBeCloseTo(rootProbability(root.key), 12);
            }
        }
    });

    it('leaves a root the road accepts on its own prior weight', () => {
        const rows = rootWeightsForSomebodyAt(metalRoad, 30, 4);
        for (const row of rows) {
            if (!roadRefuses(metalRoad, row.root) && Number.isFinite(reachableCeiling(metalRoad, row.root))) continue;
            if (!roadRefuses(metalRoad, row.root)) expect(row.weight).toBe(row.root.weight);
        }
    });
});

describe('the decay is derived, not calibrated', () => {
    it('is the complement of what deviation.ts already charges', () => {
        expect(STAYS_ON_A_REFUSING_ROAD_PER_RUNG).toBe(1 - CONFLICTING_TECHNIQUE_RISK);
    });

    it('produces the gradient without any table of rank weights', () => {
        const at = (o: number) => Math.pow(STAYS_ON_A_REFUSING_ROAD_PER_RUNG, o);
        expect(at(0)).toBe(1);
        expect(at(13)).toBeCloseTo(0.19, 2);
        expect(at(40)).toBeCloseTo(0.006, 3);
    });
});

describe('a closed house has one kind of cultivator and a servant rung', () => {
    it('gives a refused root no weight at all above the bottom rung', () => {
        for (const road of [metalRoad]) {
            const rows = rootWeightsForSomebodyAt(road, 20, 3);
            for (const row of rows) {
                if (roadRefuses(road, row.root)) expect(row.weight).toBe(0);
            }
        }
    });

    it('still leaves real spread among the roots it does take', () => {
        // A house of nothing but one perfect root is as wrong as the defect.
        const shares = rootSharesAt(metalRoad, 40, 4);
        const present = [...shares.entries()].filter(([, v]) => v > 0);
        expect(present.length).toBeGreaterThan(2);
        expect(Math.max(...present.map(([, v]) => v))).toBeLessThan(0.9);
    });

    it('never returns nothing, even if the stated roots are unrecognisable', () => {
        const broken = houseRoadOf({ preferredRoots: ['not_a_root'], teachesElements: [null] });
        const drawn = drawRootForSomebodyAlreadyInAHouse(0.5, broken, 40, 5);
        expect(SPIRIT_ROOTS.some(r => r.key === drawn.key)).toBe(true);
    });
});

describe('an open house keeps everybody and caps them instead', () => {
    it('softens rather than excludes when there is somewhere else to go', () => {
        const rows = rootWeightsForSomebodyAt(twoRoads, 30, 4);
        const refused = rows.filter(r => roadRefuses(twoRoads, r.root));
        for (const row of refused) {
            expect(row.weight).toBeGreaterThan(0);
            expect(row.weight).toBeLessThan(row.root.weight);
        }
    });

    it('stalls a secondary road at its own ceiling and not before', () => {
        // A wood-rooted member of a water house that teaches wood to 20 is
        // neither excluded nor equal: a real career with a real end to it.
        const shelf: HouseRoad = houseRoadOf({
            preferredRoots: [],
            teachesElements: ['water', 'wood'],
            teachesRoads: [{ element: 'water', cap: 44 }, { element: 'wood', cap: 20 }]
        });
        const woodOnly = SPIRIT_ROOTS.find(r =>
            !conflictsWithRoot(r, 'wood') && conflictsWithRoot(r, 'water'))!;
        expect(reachableCeiling(shelf, woodOnly)).toBe(20);
        const atCap = rootWeightsForSomebodyAt(shelf, 20, 3).find(r => r.root.key === woodOnly.key)!;
        const past = rootWeightsForSomebodyAt(shelf, 34, 3).find(r => r.root.key === woodOnly.key)!;
        expect(atCap.weight).toBe(woodOnly.weight);
        expect(past.weight).toBeLessThan(woodOnly.weight * 0.3);
    });

    it('falls back to the plain refusal test when no ceilings are recorded', () => {
        expect(reachableCeiling(twoRoads, getSpiritRoot('single_metal'))).toBe(Infinity);
    });
});

describe('anybody being BORN still draws from the root lottery', () => {
    it('leaves createNpc on rollSpiritRoot when no root is supplied', () => {
        for (const id of ['npc-2', 'npc-88', 'npc-501']) {
            const npc = createNpc('root-lottery', { id, bornOnDay: 0, onDay: 0 });
            expect(npc.cultivation.spiritRoot)
                .toBe(rollSpiritRoot(forStream('root-lottery', 'npc-root', id).next()).key);
        }
    });
});

describe('the seeded world, read off the register', () => {
    const { state } = seedWorld({ seed: 'root-read', catalog });
    const byId = new Map(catalog.factions.map(f => [f.id, f]));

    it('has nobody above a closed house\'s servant rung that its road refuses', () => {
        // THE LOAD-BEARING ASSERTION. A house whose whole teaching is one road
        // has nothing to have promoted such a person on.
        let checked = 0;
        for (const npc of state.npcs) {
            if (npc.status !== 'alive' || !npc.factionId) continue;
            const cf = byId.get(npc.factionId);
            if (!cf) continue;
            const road = houseRoadOf(cf);
            if (road.regime !== 'single_road') continue;
            checked++;
            if (roadRefuses(road, getSpiritRoot(npc.cultivation.spiritRoot))) {
                expect(npc.factionRankIndex).toBe(0);
            }
        }
        expect(checked).toBeGreaterThan(20);
    });

    it('keeps the servant rung populated rather than emptying it', () => {
        // The mismatched people are still there. If this ever reads zero, the
        // conditioning has stopped being a draw and become a rule.
        let servants = 0;
        for (const npc of state.npcs) {
            if (npc.status !== 'alive' || !npc.factionId || npc.factionRankIndex !== 0) continue;
            const cf = byId.get(npc.factionId);
            if (!cf) continue;
            const road = houseRoadOf(cf);
            if (road.regime === 'no_road') continue;
            if (roadRefuses(road, getSpiritRoot(npc.cultivation.spiritRoot))) servants++;
        }
        expect(servants).toBeGreaterThan(0);
    });

    it('never lets specialties drift from the root they are derived from', () => {
        // Conditioning the root means OVERRIDING a rolled one, and `createNpc`
        // derives `specialties` from the roll before the override is applied.
        // Every seeding path recomputes it; this is what catches one that stops.
        for (const npc of state.npcs) {
            expect(npc.cultivation.specialties)
                .toEqual(getSpiritRoot(npc.cultivation.spiritRoot).elements);
        }
    });

    it('leaves the world root histogram on the table it always had', () => {
        // THE REVERSE FAILURE. Conditioning placed people must not tilt the
        // world's roots toward whatever the big houses teach.
        const derived = state.npcs.filter(n =>
            n.status === 'alive' && !n.tags.some(t => t.startsWith('catalog:')));
        expect(derived.length).toBeGreaterThan(200);
        const tally = new Map<SpiritRootKey, number>();
        for (const n of derived) {
            tally.set(n.cultivation.spiritRoot, (tally.get(n.cultivation.spiritRoot) ?? 0) + 1);
        }
        for (const root of SPIRIT_ROOTS) {
            const share = (tally.get(root.key) ?? 0) / derived.length;
            expect(Math.abs(share - rootProbability(root.key))).toBeLessThan(0.04);
        }
    });

    it('gives the same world on the same seed', () => {
        const again = seedWorld({ seed: 'root-read', catalog }).state;
        expect(again.npcs.map(n => `${n.id}:${n.cultivation.spiritRoot}:${n.factionRankIndex}`))
            .toEqual(state.npcs.map(n => `${n.id}:${n.cultivation.spiritRoot}:${n.factionRankIndex}`));
    });
});
