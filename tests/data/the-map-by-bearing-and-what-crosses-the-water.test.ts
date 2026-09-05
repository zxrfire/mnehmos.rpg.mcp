/**
 * The map has a compass on it, the south has ships in the middle of it, and
 * every cargo has somebody who made it.
 *
 * Three defects this file exists to keep fixed:
 *
 *   1. The spine - centre, west, east, north, south - was a comment at the top
 *      of `regions.ts` and nothing in the data, so nothing could group by it.
 *   2. The Drowned Sea was written as coasts. Every place in it was an edge,
 *      and the busiest water in the world had nowhere on it a scene could go.
 *   3. A trade layer with no source would have been merchants conjuring stock,
 *      which is the parallel-system mistake AGENTS.md names. Every cargo row
 *      here has to resolve to a maker or to ground.
 */

import { describe, it, expect } from 'vitest';
import {
    REGIONS,
    SPINE_REGIONS,
    BLOWN_GROUND_ID,
    THE_BLOWN_GROUND,
    HOME_REGION_ID,
    ADJACENT_REGION_ID,
    EAST_REGION_ID,
    NORTH_REGION_ID,
    SOUTH_REGION_ID,
    apexSeats,
    bearingOfFaction,
    factionsByBearing,
    getRegion,
    regionAtBearing,
    regionsByBearing,
    type Bearing
} from '../../src/data/cultivation/regions.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { APEX_INSTITUTIONS } from '../../src/data/cultivation/governance-and-water-rights.js';
import {
    HOUSE_ARTISANS,
    HouseArtisansSchema,
    SEA_CARGO,
    SEA_LANES,
    SEA_TRADERS,
    CargoSchema,
    HALFWATER_TERMS,
    artisansOf,
    cargoOnLane
} from '../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';

const COMPASS: Bearing[] = ['centre', 'north', 'east', 'south', 'west'];

// ─────────────────────────────────────────────────────────────────────────
describe('the map has a compass on it', () => {
    it('gives every province exactly one bearing, and no two the same', () => {
        const seen = REGIONS.map(r => r.bearing);
        expect(new Set(seen).size, 'two provinces share a bearing').toBe(REGIONS.length);
        for (const b of COMPASS) {
            expect(regionAtBearing(b), `nothing is ${b}`).toBeDefined();
        }
        // And the arrangement is the one the file header has always claimed.
        expect(getRegion(HOME_REGION_ID)!.bearing).toBe('centre');
        expect(getRegion(ADJACENT_REGION_ID)!.bearing).toBe('west');
        expect(getRegion(EAST_REGION_ID)!.bearing).toBe('east');
        expect(getRegion(NORTH_REGION_ID)!.bearing).toBe('north');
        expect(getRegion(SOUTH_REGION_ID)!.bearing).toBe('south');
    });

    it('keeps the interior out of the compass', () => {
        // The Burial Sands is between the four arms and inside none of them.
        // Filing it north or east to complete a set would make a vacuum into
        // a suburb, which is the thing its own section comment argues against.
        //
        // This used to assert that the interior was EMPTY, which was true only
        // because the ground was on no map at all. It is now on the map and
        // still in none of the arms, which is the stronger form of the same
        // claim: exactly one row at `interior`, and it is not a province.
        expect(THE_BLOWN_GROUND.bearing).toBe('interior');
        expect(regionsByBearing().interior.map(r => r.id)).toEqual([BLOWN_GROUND_ID]);
        expect(SPINE_REGIONS.some(r => r.bearing === 'interior')).toBe(false);
        for (const bearing of ['centre', 'north', 'east', 'south', 'west'] as const) {
            expect(regionsByBearing()[bearing].some(r => r.id === BLOWN_GROUND_ID),
                `the wedge was filed ${bearing}`).toBe(false);
        }
    });

    it('seats every house at a bearing, and the centre does not hold everything', () => {
        const byBearing = factionsByBearing();
        const seated = COMPASS.flatMap(b => byBearing[b]);
        expect(seated.length).toBe(SECTS.length);
        for (const s of SECTS) {
            expect(bearingOfFaction(s.id), `${s.id} is nowhere on the compass`).toBeDefined();
        }
        // Every arm of the world holds somebody. A bearing with nothing at it
        // is the map defect this whole pass exists to fix.
        for (const b of COMPASS) {
            expect(byBearing[b].length, `nothing is seated ${b}`).toBeGreaterThanOrEqual(2);
        }
        // And the centre, while densest, does not hold more than the rest of
        // the world put together.
        const centre = byBearing.centre.length;
        const elsewhere = seated.length - centre;
        expect(centre, 'the centre outweighs the whole rest of the map').toBeLessThanOrEqual(elsewhere);
    });

    it('does not pretend the three apexes divide the compass between them', () => {
        const seats = apexSeats();
        expect(seats.length).toBe(APEX_INSTITUTIONS.length);
        for (const s of seats) {
            expect(APEX_INSTITUTIONS.some(a => a.id === s.apexId), s.apexId).toBe(true);
            expect(COMPASS).toContain(s.bearing);
            expect(s.why.length, `${s.apexId} does not say why`).toBeGreaterThan(60);
            if (s.seatedIn !== null) {
                expect(getRegion(s.seatedIn), `${s.apexId} sits nowhere`).toBeDefined();
                expect(getRegion(s.seatedIn)!.bearing).toBe(s.bearing);
            }
        }
        // Not one each. Two in the centre and one in the west, and the north
        // and east have none - both of which are load-bearing rather than
        // untidy, so a later editor who "balances" them breaks the setting.
        expect(new Set(seats.map(s => s.bearing)).size).toBeLessThan(seats.length);
        expect(seats.filter(s => s.bearing === 'centre').length).toBe(2);
        expect(seats.filter(s => s.bearing === 'west').length).toBe(1);
        // Exactly one apex is also a house you could walk up to.
        const walkUpTo = seats.filter(s => s.seatedIn !== null);
        expect(walkUpTo.length).toBe(1);
        expect(walkUpTo[0].apexId).toBe('apex-azure-cloud');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the south has ships in the middle of it', () => {
    const south = getRegion(SOUTH_REGION_ID)!;

    it('puts places on open water and not only on coasts', () => {
        const names = south.places.map(p => p.name);
        for (const middle of ['Silver Island', 'Waiting Sails', 'Boundless Sea', 'Salt Fields']) {
            expect(names, `${middle} is not on the map`).toContain(middle);
        }
        // A province of edges is a province with a hole in the middle of it.
        // More than half its places are now water rather than landfall.
        const sites = south.places.filter(p => p.kind === 'site' || p.kind === 'city');
        expect(sites.length).toBeGreaterThanOrEqual(5);
    });

    it('keeps the water the worst ground in the world even with a port on it', () => {
        // A market in the middle of it must not quietly make the sea liveable.
        // Everything at Silver Island is bought out of a chest, exactly as before.
        expect(south.localCeilingOrdinal).toBe(2);
        const port = south.places.find(p => p.name === 'Silver Island')!;
        expect(port.ambient).toBe('thin');
        for (const r of REGIONS) {
            if (r.id === SOUTH_REGION_ID) continue;
            expect(south.cultivation.ambientRateMultiplier)
                .toBeLessThanOrEqual(r.cultivation.ambientRateMultiplier);
        }
    });

    it('names no place twice across the whole map', () => {
        // The spine's places plus the wedge's, counted from the two authored
        // sources rather than from `REGIONS` - which now holds the wedge's
        // projection as well and would count every one of its six twice.
        const all = [
            ...SPINE_REGIONS.flatMap(r => r.places.map(p => p.name.toLowerCase())),
            ...THE_BLOWN_GROUND.places.map(p => p.name.toLowerCase())
        ];
        expect(new Set(all).size, 'two places share a name').toBe(all.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('every house has artisans', () => {
    it('parses every written row, and every row names a real house', () => {
        for (const a of HOUSE_ARTISANS) {
            expect(() => HouseArtisansSchema.parse(a), a.factionId).not.toThrow();
            expect(getSect(a.factionId), `${a.factionId} is not a house`).toBeDefined();
        }
        expect(new Set(HOUSE_ARTISANS.map(a => a.factionId)).size).toBe(HOUSE_ARTISANS.length);
    });

    it('answers for every faction in the catalog, written row or not', () => {
        // The universality is the point. A body with no row makes what its
        // province makes, because that is what there is to make on that ground
        // with those materials - which `regions.ts` has stated all along.
        for (const s of SECTS) {
            const made = artisansOf(s.id);
            expect(made, `${s.id} makes nothing`).toBeDefined();
            expect(made!.makes.length, `${s.id} makes an empty list`).toBeGreaterThan(0);
        }
        expect(artisansOf('sect-does-not-exist')).toBeUndefined();
    });

    it('derives most of them rather than writing them out', () => {
        // If this table grows to cover every house it has stopped being a
        // statement about factions and become a production catalog, which is
        // the thing the file says it must not be.
        const written = SECTS.filter(s => artisansOf(s.id)!.derivedFromProvince === false);
        expect(written.length).toBe(HOUSE_ARTISANS.length);
        expect(written.length, 'the artisan table has become a crafting system')
            .toBeLessThan(SECTS.length / 2);
    });

    it('says what each written house cannot make, because that is the trade', () => {
        for (const a of HOUSE_ARTISANS) {
            expect(a.cannotMake.length, `${a.factionId} makes everything`).toBeGreaterThan(60);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('what is on the hulls', () => {
    it('gives every cargo a maker or a ground, a real lane and a real carrier', () => {
        for (const c of SEA_CARGO) {
            expect(() => CargoSchema.parse(c), c.id).not.toThrow();
            expect(SEA_LANES.some(l => l.id === c.laneId), `${c.id} on no lane`).toBe(true);
            expect(getSect(c.carriedByFactionId), `${c.id} carried by nobody`).toBeDefined();
            if (c.madeByFactionId !== null) {
                expect(getSect(c.madeByFactionId), `${c.id} made by nobody`).toBeDefined();
                // And the maker must actually be somebody the artisan layer
                // says makes things, or the cargo has been conjured.
                expect(artisansOf(c.madeByFactionId), c.id).toBeDefined();
            }
            expect(c.whyByWater.length, `${c.id} could have gone by road`).toBeGreaterThan(60);
        }
        expect(new Set(SEA_CARGO.map(c => c.id)).size).toBe(SEA_CARGO.length);
    });

    it('puts something on every lane', () => {
        for (const lane of SEA_LANES) {
            expect(cargoOnLane(lane.id).length, `${lane.id} carries nothing`).toBeGreaterThan(0);
        }
    });

    it('has no two carriers that are the same kind of operator', () => {
        // "Traders" as one undifferentiated noun is a guild with another name.
        expect(SEA_TRADERS.length).toBeGreaterThanOrEqual(3);
        for (const t of SEA_TRADERS) {
            expect(getSect(t.factionId), `${t.factionId} is not a house`).toBeDefined();
            expect(t.whereItWillNotGo.length, `${t.factionId} goes anywhere`).toBeGreaterThan(40);
        }
        expect(new Set(SEA_TRADERS.map(t => t.whatKindOfOperator)).size).toBe(SEA_TRADERS.length);
        // One of them carries for nobody at all, which is what stops the list
        // from being four names for the same job.
        expect(SEA_TRADERS.some(t => /carr(y|ies) (goods )?for nobody|does not carry for hire/i
            .test(t.whereItWillNotGo + t.whatKindOfOperator))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the free port, and the two regimes of order on it', () => {
    it('is unbacked for a reason that is not the desert\'s reason', () => {
        const port = getSect('sect-halfwater-rail')!;
        const shed = getSect('sect-sink-carriers')!;
        expect(port).toBeDefined();
        expect(shed).toBeDefined();
        // Both hold nothing inherited and neither has a compound to have lost,
        // but they must not read as one idea written twice.
        expect(port.compound.formationNodesTotal).toBe(0);
        expect(shed.compound.formationNodesTotal).toBe(0);
        expect(port.description).not.toBe(shed.description);
        expect(HALFWATER_TERMS.whyNobodyTakesIt.length).toBeGreaterThan(120);
    });

    it('funds a watch that stops at a stated rung, and says so', () => {
        const watch = HALFWATER_TERMS.theWatch;
        expect(watch.topRungItCanHold).toBe(16);
        // Foundation Establishment ends at 16 and Core Formation opens at 17,
        // so the watch's reach is a realm boundary rather than a number
        // somebody picked - and the seam is exactly the realm above it.
        expect(HALFWATER_TERMS.theSeam.ordinalFrom).toBe(watch.topRungItCanHold + 1);
        expect(HALFWATER_TERMS.theSeam.ordinalTo).toBe(20);
        expect(watch.whyItStopsThere.length).toBeGreaterThan(120);
    });

    it('makes the port weaker than the watch\'s ceiling implies, on purpose', () => {
        // The port's own strongest is one person, and she is not the watch.
        // If the Rail could police the seam it would be a power rather than a
        // counter, and the neutrality that protects it would be gone.
        const port = getSect('sect-halfwater-rail')!;
        expect(port.powerOrdinal).toBe(21);
        expect(port.powerOrdinal).toBeGreaterThan(HALFWATER_TERMS.theSeam.ordinalTo);
        expect(port.rivals, 'a free port with a feud is not a free port').toEqual([]);
    });

    it('lives on the spread rather than on the rate', () => {
        expect(HALFWATER_TERMS.theRate).toMatch(/fortieth/);
        expect(HALFWATER_TERMS.whereTheMoneyActuallyIs.length).toBeGreaterThan(120);
        expect(HALFWATER_TERMS.discretionIsPriced.length).toBeGreaterThan(80);
        // And it draws a line somewhere, because a body that buys anything is
        // a fence rather than a market and would not survive the first hunt.
        expect(HALFWATER_TERMS.theLineItDraws.length).toBeGreaterThan(120);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the lawless sand, and the body on it', () => {
    it('keeps the shed present on ground it does not hold', () => {
        const onIt = THE_BLOWN_GROUND.whoIsOnIt.find(p => p.factionId === 'sect-sink-carriers');
        expect(onIt, 'the Carriers are not on the sand').toBeDefined();
        // Being present is not holding, and the ground's whole argument is that
        // nothing here can be held by anybody.
        expect(onIt!.holds).toBe('nothing');
        // Seating records holding, so a body present here is seated elsewhere.
        expect(bearingOfFaction('sect-sink-carriers')).toBe('west');
    });

    it('asks little at the door and a great deal afterwards', () => {
        const shed = getSect('sect-sink-carriers')!;
        expect(shed.admissionOrdinal).toBe(0);
        expect(shed.recruits).toBe(true);
        // The three omissions are the identity: where you came from, what you
        // did, and whose art you are practising are exactly the three questions
        // a rogue cannot answer at any other gate in the world.
        expect(shed.description).toMatch(/does not ask where you came from/i);
        // And the cost is not the door.
        expect(shed.description).toMatch(/by the cup/i);
    });
});
