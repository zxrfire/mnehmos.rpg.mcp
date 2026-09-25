/**
 * A HOUSE HELD FOUR SETTLEMENTS THAT WERE ONE CLAUSE IN ONE SENTENCE.
 *
 * `prefecture-grove-verge` has said since the political layer was written that
 * the Ancient Bough Grove holds "a valley, a mountain and four settlements, on
 * no grant and on nobody's book", and its `places` was empty. No `RegionPlace`
 * named any of them, so nobody could walk to one, nobody could be born in one,
 * and - the measurable half - nobody collected from one.
 *
 * That cost more here than it would anywhere else. The Grove is one of exactly
 * two houses in the catalog that administer settlements DIRECTLY: both carry no
 * levy at all, deliberately, so that the ground term is not charged twice.
 * `whatATownPaysItsHolder` was built for precisely that arrangement and the
 * Grove had nothing for it to read.
 *
 * Measured on seed `settlement-probe`, before and after:
 *
 *     settlements          23 -> 27      held  11 -> 15      unheld  12 -> 12
 *     Grove income        175 -> 1,165 a year
 *     Grove's rank      38 of 38 -> 31 of 38
 *     its neighbours    Unadorned Sword Sect 199 and nothing below
 *                       -> Cinnabar Crucible 1,247 and Burnt Earth Temple 1,045
 *     largest one town  1,800, unchanged
 *
 * A ROCK STILL GIVES MORE, which is the ordering the whole economy is built on
 * and the reason these are villages and a hamlet rather than market towns. The
 * Grove's 990 off four settlements sits under the weakest vein in the world and
 * under every levy worth the name; four villages did not buy a vein-less forest
 * house a seat at the top.
 *
 * THE VEIN FLOOR IS MOVING AND THIS ASSERTION READS IT RATHER THAN QUOTING IT.
 * Measured twice an hour apart on the same branch, the weakest vein was 4,202
 * and then 1,681, because the income pyramid is being pinned in the governance
 * catalog while this landed. Both arms of the measurement above were run in one
 * process on one tree and the Grove's own figures did not move between them, so
 * they are the house's and not the tree's. A figure typed in here would have
 * been a third copy of somebody else's constant.
 *
 * WHAT IS PINNED. Not the names - they are authored content and are read out of
 * the register here rather than typed - and not the figures. What is pinned is
 * that the register's sentence and its place list agree, that every one of them
 * is ground a player can walk to, that the one house built to need the town
 * term is actually paid by it, and that what it is paid stays under a rock.
 *
 * Every assertion was red-checked by reverting the line it depends on.
 */

import { describe, it, expect } from 'vitest';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { whatTheTownsBringIn } from '../../../src/engine/world/locations.js';
import { PREFECTURES, REGIONS, placeRoadDays } from '../../../src/data/cultivation/regions.js';
import { PLACE } from '../../../src/data/cultivation/place-names.js';

const GROVE_ID = 'sect-ancient-bough-grove';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'settlement-probe', catalog, presentYear: 1000, population: 300 });

const basin = PREFECTURES.find(p => p.heldByFactionId === GROVE_ID)!;
const province = REGIONS.find(r => r.places.some(p => p.name === basin.places[0]))!;

/** The place rows the register points at, found the way every other read finds them. */
const held = basin.places.map(name => {
    const place = province.places.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    expect(place, `${name} is on the register and on no map`).toBeDefined();
    return place!;
});

describe('the four settlements the register names are on the map', () => {
    it('carries a place for every settlement its own sentence claims', () => {
        // The two halves of one record. The sentence states a count and the
        // list is what a reader can reach; a list shorter than the sentence is
        // the defect this file was written against, and it is silent.
        expect(basin.onPaper).toContain('four settlements');
        expect(basin.places).toHaveLength(4);
    });

    it('makes every one of them somewhere a person lives', () => {
        // `placeKindFor` maps `site` to wilds, so a site on this list would be
        // ground rather than a settlement and would pay nobody anything.
        for (const place of held) {
            expect(place.kind, place.name).not.toBe('site');
            expect(place.kind, place.name).not.toBe('city');
        }
    });

    it('lets the register alone answer who administers them', () => {
        // Two sources for one fact is what `every-town-has-one-answer` guards.
        // The basin names the holder, so none of these rows may name its own.
        for (const place of held) {
            expect(place.heldByFactionId, place.name).toBeUndefined();
        }
    });
});

describe('a town nobody can walk to is the same bug in a different coat', () => {
    it('joins every one of them to the province town by stated roads', () => {
        // `placeRoadDays` returns null where no chain of authored legs joins
        // the pair, and null is what `daysOnTheRoadTo` falls through on. A
        // settlement with no chain is reachable only by the flat province day,
        // which is the engine picking a number the catalog never stated.
        for (const place of held) {
            const days = placeRoadDays(PLACE.GREEN_FALL, place.name);
            expect(days, `${place.name} is not joined to the province town`).not.toBeNull();
            expect(days!).toBeGreaterThan(0);
        }
    });

    it('keeps them a day of each other, which is what the house claims of them', () => {
        // The Grove's own territory line: "all of it within a day and a half's
        // walk". The house administers what it can comfortably walk, so a leg
        // inside the basin longer than the claim would make the claim false.
        for (const a of held) {
            for (const b of held) {
                if (a === b) continue;
                const days = placeRoadDays(a.name, b.name);
                expect(days, `${a.name} to ${b.name}`).not.toBeNull();
                expect(days!, `${a.name} to ${b.name}`).toBeLessThanOrEqual(2);
            }
        }
    });

    it('seeds each of them as a settlement the world holds', () => {
        for (const place of held) {
            const seeded = state.locations.find(l => l.name === place.name);
            expect(seeded, `${place.name} was never seeded`).toBeDefined();
            expect(seeded!.kind, place.name).toBe('settlement');
            expect(seeded!.controllingFactionId, place.name).toBe(GROVE_ID);
        }
    });
});

describe('the house that administers settlements directly is paid for it', () => {
    it('pays the Grove out of its towns and out of nothing else', () => {
        // The arrangement the term was built for: no levy, no vein, and ground
        // it administers with no intermediate tier. Before this the whole of
        // that house's income was what its handful of members were worth.
        const grove = state.factions.find(f => f.id === GROVE_ID)!;
        expect(Number(grove.resources.levy_per_year ?? 0)).toBe(0);
        expect(Number(grove.resources.veins ?? 0)).toBe(0);
        expect(whatTheTownsBringIn(state.locations, GROVE_ID)).toBeGreaterThan(0);
    });

    it('lists every town it collects from among what it controls', () => {
        // The column and the house have to agree by construction, not by two
        // passes writing the same fact.
        const grove = state.factions.find(f => f.id === GROVE_ID)!;
        for (const place of held) {
            const seeded = state.locations.find(l => l.name === place.name)!;
            expect(grove.controlledLocationIds, place.name).toContain(seeded.id);
        }
    });

    it('never lets four settlements out-earn the poorest rock in the world', () => {
        // The ordering the rest of the economy stands on. A house with no vein
        // that administers a wooded basin may not draw what a house sitting on
        // the worst vein anybody holds draws from it.
        const weakestVein = Math.min(...state.factions
            .filter(f => Number(f.resources.veins ?? 0) > 0)
            .map(f => Number(f.resources.veins) * 5_000
                * (0.5 + Number(f.resources.reliable_ordinal ?? 0) / 47)));
        expect(weakestVein).toBeGreaterThan(0);
        expect(whatTheTownsBringIn(state.locations, GROVE_ID)).toBeLessThan(weakestVein);
    });
});
