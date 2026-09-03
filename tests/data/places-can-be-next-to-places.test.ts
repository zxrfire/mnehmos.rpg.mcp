/**
 * A place road is an adjacency list with a time, and it is not a second
 * distance.
 *
 * `Region.connections` prices a crossing between provinces. Until
 * `RegionPlaceConnectionSchema` landed there was nothing that could price a
 * road inside one: the only containment was `Prefecture.places[]`, which puts
 * two names in one catchment without saying that either is near the other, and
 * prefectures exist in two of the six provinces anyway. So the played game
 * charged one flat day for stepping across a valley and one flat day for
 * crossing to the next town, and the catalog had no way to disagree.
 *
 * THE CLAIM THIS FILE PINS is the one that was hardest to get right and is
 * invisible in the data: there is still exactly ONE answer to "how far is it",
 * because the two layers' domains are disjoint. A province road joins two
 * provinces; a place road joins two places of one province; no pair of places
 * has an answer from both. That is a decision rather than an accident - it is
 * why `daysOnTheRoadTo` can consult both without a precedence rule that could
 * one day pick the wrong one - and AGENTS.md is explicit that a decision
 * living only as a shape in the data needs a test saying so.
 */

import { describe, it, expect } from 'vitest';
import {
    REGIONS,
    RegionPlaceConnectionSchema,
    placeRoadBetween,
    placeRoadDays,
    placesNextTo,
    regionIdOfPlace
} from '../../src/data/cultivation/regions.js';
import { PLACE } from '../../src/data/cultivation/place-names.js';

/** Every declared road, with the province and the place it was declared on. */
function declaredRoads(): Array<{
    regionId: string;
    from: string;
    to: string;
    kind: string;
    travelDays: number;
}> {
    const out: Array<{ regionId: string; from: string; to: string; kind: string; travelDays: number }> = [];
    for (const region of REGIONS) {
        for (const place of region.places) {
            for (const road of place.connections ?? []) {
                out.push({
                    regionId: region.id,
                    from: place.name,
                    to: road.otherPlaceName,
                    kind: road.kind,
                    travelDays: road.travelDays
                });
            }
        }
    }
    return out;
}

describe('a place road is stated once and read both ways', () => {
    it('has at least one, because a field nothing writes is a defect one size smaller', () => {
        // AGENTS.md's own entry. A schema with three readers and no writer
        // reads as a value everywhere and is empty everywhere.
        expect(declaredRoads().length).toBeGreaterThan(0);
    });

    it('answers in both directions off a single declared row', () => {
        for (const road of declaredRoads()) {
            const forward = placeRoadBetween(road.from, road.to);
            const back = placeRoadBetween(road.to, road.from);
            expect(forward, `${road.from} -> ${road.to}`).toBeDefined();
            expect(back, `${road.to} -> ${road.from}`).toBeDefined();
            expect(back!.travelDays).toBe(forward!.travelDays);
            expect(back!.kind).toBe(forward!.kind);
            // And each names the OTHER end, whichever way it was asked.
            expect(forward!.otherPlaceName.toLowerCase()).toBe(road.to.toLowerCase());
            expect(back!.otherPlaceName.toLowerCase()).toBe(road.from.toLowerCase());
        }
    });

    it('is declared on one end only, so there is no second row to disagree', () => {
        // The catalog derives the back-link for the sixth province's roads
        // rather than typing it twice, and says why in its own comment: one
        // place in the file states what the road costs and no way for the two
        // ends to disagree about it. This is the same rule at place scale.
        const seen = new Set<string>();
        for (const road of declaredRoads()) {
            const pair = [road.from.toLowerCase(), road.to.toLowerCase()].sort().join(' <-> ');
            expect(seen.has(pair), `${pair} is declared from both ends`).toBe(false);
            seen.add(pair);
        }
    });

    it('is case- and article-insensitive the way every other place lookup is', () => {
        expect(placeRoadDays('scarwater', 'low fall')).toBe(2);
        expect(placeRoadDays('  Low Fall  ', 'Scarwater')).toBe(2);
    });
});

describe('a place road is not a second distance', () => {
    it('never crosses a province boundary, which is what makes the two layers disjoint', () => {
        // THE LOAD-BEARING ASSERTION IN THIS FILE. A place road that left its
        // province would price a journey that `Region.connections` also
        // prices, and then the world would hold two figures for one fact. The
        // seeder enforces the same rule structurally - it resolves the far end
        // in a per-province table and skips a name that is not in it - so this
        // pins the catalog side of a constraint that is already true of the
        // engine side.
        for (const road of declaredRoads()) {
            expect(regionIdOfPlace(road.from), `${road.from} is in no province`).toBe(road.regionId);
            expect(regionIdOfPlace(road.to), `${road.to} is in another province`).toBe(road.regionId);
        }
    });

    it('names a place the catalog actually has', () => {
        const names = new Set(
            REGIONS.flatMap(r => r.places.map(p => p.name.trim().toLowerCase()))
        );
        for (const road of declaredRoads()) {
            expect(names.has(road.to.trim().toLowerCase()), `${road.to} is not a place`).toBe(true);
        }
    });

    it('quotes walking days, the same unit and field as a province road', () => {
        // `how-far-somebody-can-fold-space-and-what-it-costs.ts` is explicit
        // that inventing a second unit for distance would be a second opinion
        // about how far apart two places are, and `priceFold` compares its
        // reach against whatever this yields.
        for (const road of declaredRoads()) {
            expect(Number.isInteger(road.travelDays)).toBe(true);
            expect(road.travelDays).toBeGreaterThanOrEqual(0);
        }
    });

    it('is sparse, and absence means unpriced rather than unreachable', () => {
        // Most pairs have no row and should not. The reader says so by
        // returning null, which `daysOnTheRoadTo` already documents as meaning
        // "unpriced", never "free" and never "you cannot go".
        expect(placeRoadDays(PLACE.SWEPTGROUND, PLACE.NINE_PEAKS)).toBeNull();
        expect(placeRoadDays(PLACE.LOW_FALL, 'somewhere that is not a place')).toBeNull();
        expect(placeRoadDays(null, PLACE.LOW_FALL)).toBeNull();

        const withRoads = REGIONS.flatMap(r => r.places).filter(p => (p.connections ?? []).length > 0);
        const allPlaces = REGIONS.flatMap(r => r.places);
        expect(withRoads.length, 'every place has a neighbour, which is not sparse')
            .toBeLessThan(allPlaces.length);
    });
});

describe('the kind is the engine LinkKind and not a second vocabulary', () => {
    it('accepts only values `linkLocations` already takes', () => {
        // The seeder hands `kind` straight to `linkLocations` with no mapping
        // table, so the typechecker is the guard and this pins the schema
        // against somebody widening it into a social vocabulary. The
        // PROVINCE-scale kinds are social - a trade route, a refugee flow, a
        // shared feud - because what two provinces have between them is a
        // relationship. Two towns of one province have a way.
        const kinds = RegionPlaceConnectionSchema.shape.kind.options;
        expect([...kinds].sort()).toEqual(['gate', 'path', 'portal', 'road', 'seam', 'tunnel']);
    });

    it('refuses a province-scale kind', () => {
        const bad = RegionPlaceConnectionSchema.safeParse({
            kind: 'trade_route',
            otherPlaceName: PLACE.LOW_FALL,
            description: 'A description that is comfortably longer than the forty characters the schema asks for.',
            travelDays: 3
        });
        expect(bad.success).toBe(false);
    });
});

describe('what is next to somewhere', () => {
    it('answers from either end without the caller knowing which end declared it', () => {
        expect(placesNextTo(PLACE.LOW_FALL).map(p => p.name)).toContain(PLACE.SCARWATER);
        expect(placesNextTo(PLACE.SCARWATER).map(p => p.name)).toContain(PLACE.LOW_FALL);
    });

    it('returns nothing for a place with no stated neighbour, and does not throw', () => {
        expect(placesNextTo(PLACE.SWEPTGROUND)).toEqual([]);
        expect(placesNextTo('not a place at all')).toEqual([]);
        expect(placesNextTo(null)).toEqual([]);
    });

    it('puts the nearest first', () => {
        for (const region of REGIONS) {
            for (const place of region.places) {
                const near = placesNextTo(place.name);
                for (let i = 1; i < near.length; i += 1) {
                    expect(near[i].travelDays).toBeGreaterThanOrEqual(near[i - 1].travelDays);
                }
            }
        }
    });
});
