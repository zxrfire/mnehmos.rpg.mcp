/**
 * The four roads that reach the top of the ladder.
 *
 * What is asserted here is mostly arithmetic the catalog is not allowed to
 * restate: that the reach of a road and the reach of the person teaching it are
 * two different numbers, that three of the four holders cannot walk anybody to
 * the end of their own book, and that the one that can is the one whose road
 * has no hard opening in it. None of those is written down as a claim anywhere;
 * they fall out of the seats, the caps and the `opening` field.
 */

import { describe, it, expect } from 'vitest';

import {
    THE_DEEPEST_ROADS,
    DeepRoadHoldingSchema,
    deepRoadOf,
    whoHoldsDeepRoad,
    teachersAtDepth
} from '../../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { TECHNIQUES, getTechnique, carriesTo } from '../../src/data/cultivation/techniques.js';
import {
    APEX_INSTITUTIONS,
    getApexInstitution
} from '../../src/data/cultivation/governance-and-water-rights.js';

const HOLLOW = 'sect-hollow-court';

describe('the deepest roads - the catalog', () => {
    it('parses, and there are four of them', () => {
        expect(THE_DEEPEST_ROADS).toHaveLength(4);
        for (const road of THE_DEEPEST_ROADS) {
            expect(() => DeepRoadHoldingSchema.parse(road), road.factionId).not.toThrow();
        }
    });

    it('gives one road to each of the four bodies at the top of the world', () => {
        const holders = THE_DEEPEST_ROADS.map(r => r.factionId).sort();
        expect(holders).toEqual([
            'apex-deep-survey',
            'apex-long-cut',
            'sect-azure-cloud-pavilion',
            HOLLOW
        ].sort());
        // Three apexes and the one body that is not an apex and stands above
        // all of them. Nothing below that altitude has one, which is the
        // scarcity rule holding by counting rather than by assertion.
        expect(new Set(THE_DEEPEST_ROADS.map(r => r.techniqueId)).size).toBe(4);
    });

    it('resolves every road and every holder', () => {
        for (const road of THE_DEEPEST_ROADS) {
            expect(getTechnique(road.techniqueId), road.techniqueId).toBeDefined();
            const body = getSect(road.factionId) ?? getApexInstitution(road.factionId);
            expect(body, road.factionId).toBeDefined();
            expect(whoHoldsDeepRoad(road.techniqueId)?.factionId).toBe(road.factionId);
            expect(deepRoadOf(road.factionId)?.techniqueId).toBe(road.techniqueId);
            expect(teachersAtDepth(road.factionId)).toBe(road.teachers.length);
        }
    });

    it('keeps every one of them at the height it claims', () => {
        for (const road of THE_DEEPEST_ROADS) {
            const art = getTechnique(road.techniqueId)!;
            expect(art.class, road.techniqueId).toBe('cultivation');
            expect(art.grade, road.techniqueId).toBe('chaos');
            expect(art.requiredOrdinal, road.techniqueId).toBe(41);
        }
    });
});

describe('the deepest roads - copies are hours, not a rarity tier', () => {
    it('gives an apex one or two copies and says whose hours they were', () => {
        for (const road of THE_DEEPEST_ROADS) {
            if (road.factionId === HOLLOW) continue;
            expect(road.copies, `${road.factionId} holds ${road.copies} copies`)
                .toBeLessThanOrEqual(2);
            expect(road.copies).toBeGreaterThanOrEqual(1);
        }
    });

    it('gives the Court more, because it has more hands', () => {
        const court = deepRoadOf(HOLLOW)!;
        const apexes = THE_DEEPEST_ROADS.filter(r => r.factionId !== HOLLOW);
        for (const apex of apexes) {
            expect(court.copies, 'the Court holds no more than an apex').toBeGreaterThan(apex.copies);
        }
    });

    it('never hands a copy over permanently', () => {
        for (const road of THE_DEEPEST_ROADS) {
            expect(['lent', 'read_in_the_hall']).toContain(road.access);
        }
    });
});

describe('the deepest roads - capacity is the difference', () => {
    it('gives every apex exactly one teacher and the Court four', () => {
        for (const road of THE_DEEPEST_ROADS) {
            if (road.factionId === HOLLOW) {
                expect(road.teachers.length, 'the Court has four on it').toBe(4);
            } else {
                expect(road.teachers.length, `${road.factionId} has more than one`).toBe(1);
            }
        }
    });

    it('rations the Court by standing and nobody else by anything', () => {
        for (const road of THE_DEEPEST_ROADS) {
            if (road.factionId === HOLLOW) {
                expect(road.gradedByStanding, 'the Court does not say who gets how much')
                    .not.toBeNull();
            } else {
                expect(road.gradedByStanding, `${road.factionId} rations one person`).toBeNull();
            }
        }
    });

    it('never puts a teacher above the body they stand in', () => {
        for (const road of THE_DEEPEST_ROADS) {
            const body = getSect(road.factionId) ?? getApexInstitution(road.factionId);
            const ceiling = body!.powerOrdinal;
            for (const t of road.teachers) {
                expect(t.realmOrdinal, `${road.factionId}: ${t.who}`).toBeLessThanOrEqual(ceiling);
            }
        }
    });
});

describe('the deepest roads - what falls out of the numbers', () => {
    /**
     * The measured result, and the one nobody authored. It is asserted here so
     * that moving a seat or a cap has to be a decision rather than an accident.
     */
    it('leaves the last rungs of the three apex roads with no teacher anywhere', () => {
        for (const road of THE_DEEPEST_ROADS) {
            if (road.factionId === HOLLOW) continue;
            const art = getTechnique(road.techniqueId)!;
            const strongest = Math.max(...road.teachers.map(t => t.realmOrdinal));
            const reach = carriesTo(strongest, road.techniqueId)!;
            expect(art.cap, road.techniqueId).not.toBeNull();
            expect(reach, `${road.factionId} can finish its own road`).toBeLessThan(art.cap!);
        }
    });

    it('makes the Hollow Court the only body that can finish its own road', () => {
        const road = deepRoadOf(HOLLOW)!;
        const art = getTechnique(road.techniqueId)!;
        const strongest = Math.max(...road.teachers.map(t => t.realmOrdinal));
        // One rung short of the cap, which is the crossing, and the crossing is
        // in no book and has no teacher. Everything below it the Court can walk
        // somebody through, which is the whole of its record.
        expect(carriesTo(strongest, road.techniqueId)).toBe(strongest);
        expect(art.cap! - strongest).toBe(1);
    });

    it('gives the best-paved road no opening and every other one a hard start', () => {
        for (const road of THE_DEEPEST_ROADS) {
            const art = getTechnique(road.techniqueId)!;
            if (road.factionId === HOLLOW) {
                expect(art.opening, 'the Court road has a bad stretch in it').toBeNull();
                expect(art.quality, 'the best road is not the best-written one').toBe('pristine');
            } else {
                expect(art.opening, `${road.techniqueId} starts easy`).not.toBeNull();
                expect(art.opening!.rateMultiplier, road.techniqueId).toBeLessThan(0.5);
            }
        }
    });

    it('does not let the best road also be the longest one', () => {
        // Same destination for all four. The Court's advantage is what it costs
        // to walk, never how far it goes, and an edit that gave the Court a
        // higher cap would be making it a better secret instead.
        const caps = THE_DEEPEST_ROADS.map(r => getTechnique(r.techniqueId)!.cap);
        expect(new Set(caps).size, 'the four roads no longer end together').toBe(1);
    });
});

describe('the deepest roads - the shelves they sit on', () => {
    it('puts a road on at most one shelf, and only its own holder\'s', () => {
        for (const road of THE_DEEPEST_ROADS) {
            const shelves = SECTS.filter(s => s.teaches.includes(road.techniqueId));
            expect(shelves.length, road.techniqueId).toBeLessThanOrEqual(1);
            if (shelves.length) expect(shelves[0].id).toBe(road.factionId);
        }
    });

    it('leaves the two hidden apexes with a holding and no shelf, which is the point', () => {
        for (const id of ['apex-deep-survey', 'apex-long-cut']) {
            const apex = APEX_INSTITUTIONS.find(a => a.id === id)!;
            expect(apex.factionId, `${id} has acquired a sect row`).toBeNull();
            expect(deepRoadOf(id), `${id} holds no road`).toBeDefined();
        }
    });

    it('stops the Azure Cloud Pavilion topping out in the middle of the ladder', () => {
        // The defect this whole pass started from: an apex that produced an
        // ascension inside living memory had a teach list that ended at Core
        // Formation, so the register reported the strongest house in the region
        // as unable to teach past halfway.
        const pavilion = getSect('sect-azure-cloud-pavilion')!;
        const ceiling = pavilion.teaches
            .map(id => getTechnique(id))
            .filter(t => t?.class === 'cultivation')
            .reduce((n, t) => Math.max(n, t!.cap ?? t!.requiredOrdinal), 0);
        expect(ceiling, 'the Pavilion still cannot teach past the middle').toBeGreaterThan(40);
    });

    it('never gives anything below the top of the world one of these', () => {
        const holders = new Set(THE_DEEPEST_ROADS.map(r => r.factionId));
        for (const t of TECHNIQUES) {
            if (!whoHoldsDeepRoad(t.id)) continue;
            for (const s of SECTS) {
                if (!s.teaches.includes(t.id)) continue;
                expect(holders.has(s.id), `${s.id} teaches a road it should not hold`).toBe(true);
                expect(s.powerOrdinal, `${s.id} is too low to hold a road`).toBeGreaterThanOrEqual(41);
            }
        }
    });
});
