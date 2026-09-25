/**
 * THE PYRAMID WAS INVERTED IN PLACES AND NOTHING COULD SAY SO.
 *
 * The world's economy became real - a vein, a levy at a gate, a tax on a town
 * a house governs, and what a house makes - and the moment houses had incomes
 * the holding chain could be read as arithmetic for the first time. It did not
 * hold. Measured on seed `pyramid-probe` before this work, in stones a year off
 * what each house holds:
 *
 *     the Crimson Abyss Fortress      5,652   answering to
 *     the Storm Tyrant Court          4,783   which granted it its ground
 *
 *     the Jade Register Hall          9,000   against the poorest apex
 *     the Azure Cloud Pavilion        6,148   which is one of the three
 *
 * Both had one cause and the cause was a boolean. `holdsVein` could say yes or
 * no, so every holder in the world drew one identical vein: the Fortress, whose
 * own `holds` line reads "the thin vein beneath the town, on the least valuable
 * grant in the province", drew exactly what an apex drew off a vein system. The
 * catalog had been saying so in words the whole time. `veinWorth` is the word,
 * and `HOW_MANY_ORDINARY_VEINS` is the one place it becomes stones.
 *
 * THREE CLAIMS ON TWO AXES, and they are not one claim. The design owner:
 * a rando sect cannot out-earn an apex; it may out-earn a court on hard times;
 * and whatever a body is, the house it answers to is strictly richer than it.
 * The second and third are compatible and the difference is the whole point - a
 * court may be poorer than SOME sect and never poorer than ITS OWN sect. A test
 * that forbade the first inversion would block content somebody should be free
 * to write, so this file asserts that it is still reachable rather than leaving
 * it to be "fixed" later.
 *
 * AND INCOME IS NOT STANDING. A starving camel is bigger than a horse: a court
 * whose income has fallen still has the vault, the compound and people standing
 * at rungs an ordinary sect cannot reach. After this work the Cinnabar Crucible
 * Sect takes 10,000 a year off its furnaces and the Storm Tyrant Court takes
 * 4,873 off a vein it can no longer reach the bottom of - and the Court stands
 * nine rungs above it. The last test here pins that the two orderings are
 * different orderings, because a suite that only checked income would call the
 * camel a horse.
 *
 * After, on the same seed: 15 holding edges, 0 inversions; poorest apex 40,183
 * against the richest sect at 20,960.
 *
 * WHAT IS PINNED. The claims, not the figures - every number above moves the
 * moment somebody authors a house, and none of them is asserted here. Every
 * assertion was red-checked by reverting the row it depends on.
 */

import { describe, it, expect } from 'vitest';
import { loadCultivationCatalog, type CatalogFaction } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    APEX_INSTITUTIONS,
    FACTION_PARENTAGE,
    theBodyItAnswersTo
} from '../../../src/data/cultivation/governance-and-water-rights.js';
import { whatItsHoldingsBringIn } from '../../support/what-a-house-takes-off-its-holdings.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'pyramid-probe', catalog, presentYear: 1000, population: 300 });

const byId = new Map(catalog.factions.map(f => [f.id, f]));
const income = (f: CatalogFaction) => whatItsHoldingsBringIn(f, state.locations);

/** The three apexes, as the houses they are. All three have a sect row. */
const apexIds = new Set(
    APEX_INSTITUTIONS.map(a => a.factionId).filter((id): id is string => id !== null)
);
const relationOf = (id: string) => FACTION_PARENTAGE[id]?.relation ?? 'unaffiliated';

/** Every holding edge, resolved to two bodies the world actually seeds. */
const edges = catalog.factions
    .map(child => ({ child, parentId: theBodyItAnswersTo(child.id) }))
    .filter((e): e is { child: CatalogFaction; parentId: string } => e.parentId !== null)
    .map(e => ({ child: e.child, parent: byId.get(e.parentId) }))
    .filter((e): e is { child: CatalogFaction; parent: CatalogFaction } => e.parent !== undefined);

describe('the body you answer to is richer than you', () => {
    it('resolves every parentage to a body the world seeds', () => {
        // Without this the walk below can go vacuous in silence. Seven rows
        // answer to a court or an apex id, which are rows in COURTS and
        // APEX_INSTITUTIONS rather than in SECTS, so a naive map lookup
        // dropped seven of the fifteen edges and reported a clean pyramid.
        const stated = catalog.factions.filter(f => FACTION_PARENTAGE[f.id]?.parentFactionId != null);
        expect(stated.length).toBeGreaterThan(0);
        expect(edges.length).toBe(stated.length);
    });

    it('has every house answering to something strictly richer than itself', () => {
        // THE CHAIN CLAIM, and the only per-edge one. Not a global ordering:
        // it says nothing about two houses that have no grant between them.
        const inverted = edges
            .filter(e => income(e.parent) <= income(e.child))
            .map(e => `${e.child.id} ${income(e.child)} -> ${e.parent.id} ${income(e.parent)}`);
        expect(inverted).toEqual([]);
    });

    it('lets no sect out-earn any apex, related or not', () => {
        // THE ONE GLOBAL CLAIM. A court is not a sect and is not measured here;
        // the test below says why that is deliberate.
        const poorestApex = Math.min(...[...apexIds].map(id => income(byId.get(id)!)));
        const over = catalog.factions
            .filter(f => !apexIds.has(f.id) && relationOf(f.id) !== 'court')
            .filter(f => income(f) >= poorestApex)
            .map(f => `${f.id} ${income(f)} >= ${poorestApex}`);
        expect(over).toEqual([]);
    });

    it('still lets a sect out-earn a court it has nothing to do with', () => {
        // DELIBERATELY NOT FORBIDDEN, and asserted present so that nobody
        // levels it in the belief that it is a defect. A court on hard times
        // out-earned by a house it never granted anything to is ordinary in
        // this genre, and the chain claim above already stops the only version
        // of it that would be wrong.
        const courts = catalog.factions.filter(f => relationOf(f.id) === 'court');
        const richerElsewhere = courts.some(court =>
            catalog.factions.some(sect =>
                relationOf(sect.id) !== 'court'
                && !apexIds.has(sect.id)
                && theBodyItAnswersTo(sect.id) !== court.id
                && income(sect) > income(court)));
        expect(richerElsewhere).toBe(true);
    });

    it('does not read what a house takes in as what a house is', () => {
        // THE SECOND AXIS, as the starving camel: a court whose income has
        // fallen below an ordinary house's is still standing rungs above it.
        // If income and standing were one ordering there would be no such pair,
        // and the world would have nothing to say about a court on hard times
        // except that it is poor.
        const courts = catalog.factions.filter(f => relationOf(f.id) === 'court');
        const outEarnedFromBelow = courts.some(court =>
            catalog.factions.some(house =>
                income(house) > income(court) && house.powerOrdinal < court.powerOrdinal));
        expect(outEarnedFromBelow).toBe(true);
    });

    it('asks nobody for tribute it could not raise in a year', () => {
        // The arithmetic nobody had checked. The Nine Abyss Flame Sect held a
        // vent vein worth about 6,000 a year and was billed 55,000, and the
        // yearly economy takes a tenth of a stated tribute - so the drain alone
        // was 89% of everything the sect earned before a stone of payroll.
        const unpayable = catalog.factions
            .filter(f => f.tributeStonesPerYear > 0)
            .filter(f => f.tributeStonesPerYear * 0.1 >= income(f) * 0.75)
            .map(f => `${f.id} owes ${f.tributeStonesPerYear} on ${income(f)} a year`);
        expect(unpayable).toEqual([]);
    });
});
