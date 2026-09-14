/**
 * TWO CATALOG FIELDS THAT CARRIED ONE VALUE FOR EVERY HOUSE IN THE WORLD.
 *
 * Measured on `loadCultivationCatalog()` before the fix, with the script this
 * file replaces:
 *
 *     holdsVein                        38 of 38
 *     production >= 0.6 (workshop)      0 of 38
 *     production >= 0.4 (treasury)     38 of 38
 *     production values                [[0.5, 38]]
 *
 * `holdsVein` was `Boolean(parent.holds)` over `ParentageSchema.holds`, a
 * required prose sentence every record carries - so it was true even for the
 * houses whose sentence says "chosen for having no vein under it" or "Rented
 * cutting houses at the edge of six cities, and no ground at all". Who holds a
 * vein is one of the things houses here fight over, and the engine erased the
 * distinction: every faction got `veins: 1`, a formation hazard on its ground,
 * a vein chamber in its compound and a region vein to control.
 *
 * `production` looked for `character.production.selfSufficiency` or
 * `.tier`. Neither is authored anywhere; `faction-character.ts` authors
 * `ProductionTier`, which is a statement about what RUNG a house turns out. So
 * the 0..1 returned its 0.5 fallback for all 38 and the three things reading it
 * decided nothing. It is gone: what a house can put on the ground reads
 * `reliableOrdinal`, and what it has raw material to work reads `holdsVein`.
 *
 * After, on the same catalog:
 *
 *     holdsVein        12 of 38       workshop      12 of 38
 *     treasury         31 of 38       vein_chamber  12 of 38
 *     precision        exact 8, fitted 26, rough 4
 *
 * WHAT THESE ASSERTIONS ARE FOR. Not the numbers above and not which house
 * holds what - both are authored content and a second copy of either goes
 * stale. What is pinned is that each field SEPARATES houses at all, and that a
 * house recorded as holding no vein is seeded as a house holding no vein all
 * the way down. Every assertion here was red-checked by restoring the line it
 * replaced.
 */

import { describe, it, expect } from 'vitest';
import { loadCultivationCatalog, type CatalogFaction } from '../../../src/engine/world/catalog.js';
import { houseStyleOf, roomsFor, type CompoundInput } from '../../../src/engine/world/architecture.js';
import {
    WHAT_ONE_POST_TAKES_IN_A_YEAR,
    seedWorld,
    whatALevyBringsIn,
    whatItCanPutOnTheGround
} from '../../../src/engine/world/seeding.js';

const catalog = await loadCultivationCatalog();

function compoundInputFor(cf: CatalogFaction): CompoundInput {
    return {
        factionId: cf.id,
        factionName: cf.name,
        ranks: cf.ranks,
        admissionOrdinal: cf.admissionOrdinal,
        powerOrdinal: cf.powerOrdinal,
        recruits: cf.recruits,
        alignment: cf.alignment,
        reliableOrdinal: cf.reliableOrdinal,
        formationIntegrity: cf.formationIntegrity,
        formationNodesTotal: cf.formationNodesTotal ?? 0,
        formationNodesLit: cf.formationNodesLit ?? 0,
        inherited: cf.compoundInherited ?? false,
        holdsVein: cf.holdsVein,
        tributeStonesPerYear: cf.tributeStonesPerYear,
        sealedCeilingOrdinal: cf.sealedCeilingOrdinal,
        preferredRoots: cf.preferredRoots ?? [],
        teachesElements: cf.teachesElements ?? [],
        specialities: cf.specialities ?? []
    };
}

function roomCount(purpose: string): number {
    return catalog.factions.filter(cf => roomsFor(compoundInputFor(cf)).includes(purpose as never)).length;
}

describe('a house holds a vein or it does not, and the catalog says which', () => {
    it('separates the houses that hold one from the houses that do not', () => {
        const holders = catalog.factions.filter(f => f.holdsVein);
        expect(holders.length).toBeGreaterThan(0);
        expect(holders.length).toBeLessThan(catalog.factions.length);
    });

    it('gives a house that holds none no vein, no chamber and no hazard on its ground', () => {
        const { state } = seedWorld({ seed: 'no-vein', catalog, presentYear: 1000, population: 300 });
        const without = catalog.factions.filter(f => !f.holdsVein);
        expect(without.length).toBeGreaterThan(0);

        for (const cf of without) {
            const faction = state.factions.find(f => f.id === cf.id)!;
            expect(Number(faction.resources.veins ?? 0), cf.id).toBe(0);
            expect(roomsFor(compoundInputFor(cf)), cf.id).not.toContain('vein_chamber');

            const seat = state.locations.find(l => l.id === faction.seatLocationId);
            if (seat) expect(seat.hazards, cf.id).not.toContain('formation');
        }
    });

    it('gives a house that holds one all three', () => {
        const { state } = seedWorld({ seed: 'no-vein', catalog, presentYear: 1000, population: 300 });
        const holders = catalog.factions.filter(f => f.holdsVein);

        for (const cf of holders) {
            const faction = state.factions.find(f => f.id === cf.id)!;
            // MORE THAN NONE, not exactly one. This asserted 1, which was true
            // of every holder in the world for the same reason the old
            // `holdsVein` boolean was true of every house: the catalog could
            // only say whether there was rock, so the column was a constant
            // wearing a count. `veinWorth` says how much, and the apexes hold a
            // vein system where a sub-holder holds a thin seam.
            expect(Number(faction.resources.veins ?? 0), cf.id).toBeGreaterThan(0);
            expect(roomsFor(compoundInputFor(cf)), cf.id).toContain('vein_chamber');
        }
    });

    it('does not give every holder in the world the same rock', () => {
        // The defect the count was hiding, and the reason the assertion above
        // had to move: one flat vein apiece made the house on "the least
        // valuable grant in the province" as rich off ground as an apex.
        const worths = new Set(catalog.factions.filter(f => f.holdsVein).map(f => f.veinWorth));
        expect(worths.size).toBeGreaterThan(1);
    });
});

/**
 * THE THIRD WAY TO EAT, and for most of this catalog it is the only one.
 *
 * The yearly economy knew how to extract from rock and nothing else, so a house
 * holding nine city gates was modelled as destitute. Measured over a seeded
 * century before the levy existed: 12 of 38 houses reached zero, 11 of them
 * holding no vein - including an assay monopoly, an auction charter and a
 * register compulsory in nine cities. With a levy authored on the parentage
 * record it is 6, and the six are houses whose own entries say they charge
 * nobody ("Nothing whatsoever, which the league presents as philosophy",
 * "will trade labour for paint before stones") or whose tribute exceeds
 * everything they take.
 *
 * A rock still gives more, and the ordering is per post against per vein: the
 * largest one post can be is 2,500 stones a year against the weakest vein in
 * the catalog at 3,043. A house with nine gates out-earns one vein because it
 * has nine of them.
 */
describe('a house eats off a gate as well as off rock', () => {
    it('separates the houses that charge somebody from the houses that do not', () => {
        const charging = catalog.factions.filter(f => f.levy !== null);
        expect(charging.length).toBeGreaterThan(0);
        expect(charging.length).toBeLessThan(catalog.factions.length);
    });

    it('does not make a vein and a levy exclusive', () => {
        // A house may hold ground and a gate. Building this as an either/or
        // would have silently zeroed one of them for whoever holds both.
        expect(catalog.factions.some(f => f.holdsVein && f.levy !== null)).toBe(true);
        expect(catalog.factions.some(f => !f.holdsVein && f.levy !== null)).toBe(true);
    });

    it('never lets one post out-earn one ordinary vein', () => {
        // The ruling this pins: a rock gives more. Per post against per vein -
        // a house with nine gates beating one vein is the point of having nine.
        //
        // AN ORDINARY ONE. `veinWorth` grades rock now, and a thin seam is a
        // fifth of a working vein by authored intent, so a toll over a whole
        // province does out-earn the least valuable grant in that province.
        // The expression below is one vein at this house's rung and always was.
        const weakestVein = Math.min(...catalog.factions
            .filter(f => f.holdsVein)
            .map(f => 5_000 * (0.5 + whatItCanPutOnTheGround(f.reliableOrdinal))));
        for (const take of Object.values(WHAT_ONE_POST_TAKES_IN_A_YEAR)) {
            expect(take).toBeLessThan(weakestVein);
        }
    });

    it('carries what a house takes at a gate onto the faction record', () => {
        const { state } = seedWorld({ seed: 'no-vein', catalog, presentYear: 1000, population: 300 });
        const takings = new Set(state.factions.map(f => Number(f.resources.levy_per_year ?? 0)));
        expect(takings.size).toBeGreaterThan(1);

        for (const cf of catalog.factions) {
            const faction = state.factions.find(f => f.id === cf.id)!;
            const expected = whatALevyBringsIn(cf.levy);
            expect(Number(faction.resources.levy_per_year ?? -1), cf.id).toBe(expected);
            // A house that charges nobody carries a zero, not a default.
            if (cf.levy === null) expect(expected, cf.id).toBe(0);
        }
    });
});

describe('what a house turns out reaches the things that used to read a constant', () => {
    it('does not give every compound in the world the same rooms', () => {
        // An ore hall needs ore, so it follows the ground rather than a number
        // that was 0.5 everywhere. Both of these read 0 of 38 and 38 of 38.
        const houses = catalog.factions.length;
        expect(roomCount('workshop')).toBeGreaterThan(0);
        expect(roomCount('workshop')).toBeLessThan(houses);
        expect(roomCount('treasury')).toBeGreaterThan(0);
        expect(roomCount('treasury')).toBeLessThan(houses);
    });

    it('does not cut every compound in the world to the same tolerance', () => {
        const precisions = new Set(catalog.factions.map(cf => houseStyleOf({
            factionId: cf.id,
            alignment: cf.alignment,
            recruits: cf.recruits,
            reliableOrdinal: cf.reliableOrdinal,
            formationIntegrity: cf.formationIntegrity,
            inherited: cf.compoundInherited,
            powerOrdinal: cf.powerOrdinal,
            admissionOrdinal: cf.admissionOrdinal,
            preferredRoots: cf.preferredRoots,
            teachesElements: cf.teachesElements
        }).precision));
        expect(precisions.size).toBeGreaterThan(1);
    });

    it('does not scale every house income by the same factor', () => {
        const shares = new Set(catalog.factions.map(cf => whatItCanPutOnTheGround(cf.reliableOrdinal)));
        expect(shares.size).toBeGreaterThan(1);
    });

    it('carries the rung onto the faction record, because the yearly economy reads it there', () => {
        // `applyFactionEconomy` and `abundanceOf` read `resources`, never the
        // catalog. The field they read was `production`, seeded at 0.5 on every
        // house ever made, so both were constants across the whole world.
        const { state } = seedWorld({ seed: 'no-vein', catalog, presentYear: 1000, population: 300 });
        const carried = new Set(state.factions.map(f => Number(f.resources.reliable_ordinal ?? 0)));
        expect(carried.size).toBeGreaterThan(1);
        for (const cf of catalog.factions) {
            const faction = state.factions.find(f => f.id === cf.id)!;
            expect(Number(faction.resources.reliable_ordinal ?? -1), cf.id).toBe(cf.reliableOrdinal);
        }
    });
});
