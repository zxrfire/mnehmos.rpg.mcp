/**
 * NO TOWN IN THE WORLD BELONGED TO ANYBODY.
 *
 * Measured on a seeded world before this change: 23 settlements with real
 * relative populations - 1 to 60, 537 in total - and `controllingFactionId`
 * null on all 23, with no faction listing a settlement among what it controls.
 * Nothing administered a city, nothing was answerable for one, nobody could
 * lose one and nobody could take one. The half of the economy that taxes the
 * people of a town was blocked on it: `levy` sits on the house and nothing
 * connected it to a place, so there was no holder to collect.
 *
 * THE CATALOG HAD BEEN ANSWERING ALL ALONG. `PREFECTURES` carries `places` as
 * `RegionPlace` names with `heldByFactionId` beside them, and `null` is
 * documented there as a real answer rather than a gap. Nothing in `src/` read
 * it except `ground-holder.ts`, and that read could not reach the economy.
 *
 *     14 of 23   settled by something written: the register for six, a place's
 *                own note for the rest - "The Frostmirror's town", "One gate
 *                station, at Halfway Gate", "Nobody in the Yellow Plain holds
 *                ground". Eight of those name a holder and six name nobody.
 *      3 of 23   a judgement, recorded as one: Iron Ridge and Willow Village to
 *                the Hall that administers the province directly rather than to
 *                the bureau and the contractor standing in them, and The Far
 *                Shore to the house whose nine gate stations it matches.
 *      6 of 23   left unheld because nothing anywhere says, which is a real
 *                answer in this genre and not a gap to fill.
 *
 * After, on seed `settlement-probe`:
 *
 *     held                11 of 23      unheld            12 of 23
 *     town income          8,100 a year across 9 houses
 *     largest one town     1,800 (a city)
 *     largest levy post    2,500 (a province)
 *     weakest vein         4,239
 *     broke at a century   1, with the term and without it
 *
 * WHAT IS PINNED HERE. Not which house holds which town - that is authored
 * content and a second copy of it goes stale - and not the figures above. What
 * is pinned is that the column SEPARATES towns at all, that both answers are
 * real, that a holder collects and a town nobody holds pays nobody, that a rock
 * still gives more than the biggest city in the world, and that a place can
 * answer who collects at it rather than only a house answering what it charges.
 *
 * Every assertion was red-checked by reverting the line it depends on.
 */

import { describe, it, expect } from 'vitest';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld, whatALevyBringsIn } from '../../../src/engine/world/seeding.js';
import {
    whatATownPaysItsHolder,
    whatTheTownsBringIn,
    populationWeightOf
} from '../../../src/engine/world/locations.js';
import { whoCollectsHere } from '../../../src/engine/world/ground-holder.js';
import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { PREFECTURES, REGIONS } from '../../../src/data/cultivation/regions.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'a-town-has-a-holder', catalog, presentYear: 1000, population: 300 });
const towns = state.locations.filter(l => l.kind === 'settlement');

describe('a town belongs to somebody or to nobody, and the world says which', () => {
    it('has towns to ask the question of at all', () => {
        expect(towns.length).toBeGreaterThan(0);
        expect(towns.some(t => populationWeightOf(t) > 0)).toBe(true);
    });

    it('separates the towns somebody administers from the towns nobody does', () => {
        // Both halves, because a column that is set everywhere says as little
        // as one that is set nowhere. A town nobody governs is a real thing in
        // this genre and an invented holder is not.
        const held = towns.filter(t => t.controllingFactionId !== null);
        expect(held.length).toBeGreaterThan(0);
        expect(held.length).toBeLessThan(towns.length);
    });

    it('says the same thing on the town and on the house that holds it', () => {
        // The two would drift if they were two passes writing one fact.
        for (const town of towns) {
            const holder = town.controllingFactionId;
            if (holder === null) continue;
            const faction = state.factions.find(f => f.id === holder);
            expect(faction, `${town.name} names a house nobody seeded`).toBeDefined();
            expect(faction!.controlledLocationIds, town.name).toContain(town.id);
        }
        for (const faction of state.factions) {
            for (const id of faction.controlledLocationIds) {
                const place = towns.find(t => t.id === id);
                if (!place) continue;
                expect(place.controllingFactionId, place.name).toBe(faction.id);
            }
        }
    });

    it('gives every town exactly one holder', () => {
        // A settlement counted under two houses is the same money twice.
        const holderOf = new Map<string, string>();
        for (const faction of state.factions) {
            for (const id of faction.controlledLocationIds) {
                if (!towns.some(t => t.id === id)) continue;
                expect(holderOf.has(id), `${id} is held twice`).toBe(false);
                holderOf.set(id, faction.id);
            }
        }
    });
});

describe('the answer lives in one place', () => {
    it('never lets a place and the register both name a holder for one town', () => {
        // Two sources for one fact is the defect this repo pays for most often.
        // The register is the authority wherever it carries a settlement, so a
        // place inside a basin must not declare its own holder: the two would
        // drift and nothing would say which had won.
        const inABasin = new Set<string>();
        for (const prefecture of PREFECTURES) {
            if (prefecture.kind !== 'basin') continue;
            for (const name of prefecture.places) inABasin.add(name.trim().toLowerCase());
        }
        expect(inABasin.size).toBeGreaterThan(0);
        for (const region of REGIONS) {
            for (const place of region.places) {
                if (place.heldByFactionId === undefined) continue;
                expect(
                    inABasin.has(place.name.trim().toLowerCase()),
                    `${place.name} declares a holder and is already on the register`
                ).toBe(false);
            }
        }
    });

    it('only ever names a house the world actually seeds', () => {
        const seeded = new Set(state.factions.map(f => f.id));
        for (const region of REGIONS) {
            for (const place of region.places) {
                if (!place.heldByFactionId) continue;
                expect(seeded.has(place.heldByFactionId), place.name).toBe(true);
            }
        }
        for (const prefecture of PREFECTURES) {
            if (!prefecture.heldByFactionId) continue;
            if (prefecture.places.length === 0) continue;
            expect(seeded.has(prefecture.heldByFactionId), prefecture.id).toBe(true);
        }
    });
});

describe('a house collects from the towns it governs', () => {
    it('charges the people of a town and nobody else', () => {
        // Only a settlement pays this. A vein, a ruin and a compound pay their
        // holder by other means and charging them here would be a second copy
        // of the ground term.
        const notATown = state.locations.filter(l => l.kind !== 'settlement');
        expect(notATown.length).toBeGreaterThan(0);
        for (const l of notATown) expect(whatATownPaysItsHolder(l), l.id).toBe(0);
        expect(towns.some(t => whatATownPaysItsHolder(t) > 0)).toBe(true);
    });

    it('pays a town nobody holds to nobody', () => {
        const unheld = towns.filter(t => t.controllingFactionId === null);
        expect(unheld.length).toBeGreaterThan(0);
        for (const town of unheld) {
            for (const faction of state.factions) {
                expect(faction.controlledLocationIds).not.toContain(town.id);
            }
        }
    });

    it('separates the houses that govern towns from the houses that do not', () => {
        const earning = state.factions.filter(f => whatTheTownsBringIn(state.locations, f.id) > 0);
        expect(earning.length).toBeGreaterThan(0);
        expect(earning.length).toBeLessThan(state.factions.length);
    });

    it('opens a house that governs towns with a larger purse than it would have', () => {
        // The seeded purse has to actually contain the term. Measured against
        // the same house in a world where nothing holds a town: the difference
        // is what its towns pay, and before this it was zero everywhere.
        const stripped = seedWorld({
            seed: 'a-town-has-a-holder',
            catalog: {
                ...catalog,
                regions: catalog.regions.map(r => ({
                    ...r,
                    places: r.places.map(p => ({ ...p, heldByFactionId: null }))
                }))
            },
            presentYear: 1000,
            population: 300
        }).state;

        const governor = state.factions
            .map(f => ({ f, towns: whatTheTownsBringIn(state.locations, f.id) }))
            .sort((a, b) => b.towns - a.towns)[0];
        expect(governor.towns).toBeGreaterThan(0);

        // The purse draw is keyed on the faction id, so the same house draws
        // the same number in both arms and the whole difference is its towns.
        const same = stripped.factions.find(f => f.id === governor.f.id)!;
        expect(whatTheTownsBringIn(stripped.locations, same.id)).toBe(0);
        expect(Number(governor.f.resources.spirit_stones) - Number(same.resources.spirit_stones))
            .toBe(governor.towns);
    });

    it('follows the town when it changes hands', () => {
        // WHY THIS IS DERIVED AND THE LEVY IS STORED. A charter does not change
        // hands in the ordinary run of a century and ground does - twice in the
        // yearly economy - so a town figure written onto the faction at seeding
        // would go on stating what the house held then, and nothing would fail.
        const town = towns.find(t => t.controllingFactionId !== null)!;
        const lost = town.controllingFactionId!;
        const taker = state.factions.find(f => f.id !== lost)!;
        const before = whatTheTownsBringIn(state.locations, lost);
        const takerBefore = whatTheTownsBringIn(state.locations, taker.id);

        const after = state.locations.map(l =>
            l.id === town.id ? { ...l, controllingFactionId: taker.id } : l);

        expect(whatTheTownsBringIn(after, lost)).toBe(before - whatATownPaysItsHolder(town));
        expect(whatTheTownsBringIn(after, taker.id))
            .toBe(takerBefore + whatATownPaysItsHolder(town));
        // And nothing on the faction record says otherwise, because nothing
        // on the faction record says anything about towns at all.
        expect(Object.keys(state.factions.find(f => f.id === lost)!.resources)
            .some(k => k.includes('town'))).toBe(false);
    });

    it('pays it again every year the world runs', () => {
        // The seeded purse and the yearly income have to be the same term. One
        // year of the same world, from the same seed, with and without the
        // holders: the only difference between the two runs is the column.
        const held = structuredClone(state);
        const stripped = structuredClone(state);
        for (const l of stripped.locations) {
            if (l.kind === 'settlement') l.controllingFactionId = null;
        }
        for (const f of stripped.factions) {
            f.controlledLocationIds = f.controlledLocationIds
                .filter(id => !towns.some(t => t.id === id));
        }
        const governor = state.factions
            .map(f => ({ id: f.id, towns: whatTheTownsBringIn(state.locations, f.id) }))
            .sort((a, b) => b.towns - a.towns)[0];

        const span = 365;
        applyPressure(held, held.currentDay, held.currentDay + span);
        applyPressure(stripped, stripped.currentDay, stripped.currentDay + span);

        const withTowns = Number(held.factions.find(f => f.id === governor.id)!.resources.spirit_stones);
        const without = Number(stripped.factions.find(f => f.id === governor.id)!.resources.spirit_stones);
        expect(withTowns).toBeGreaterThan(without);
    });

    it('never lets a town out-earn a rock', () => {
        // The ruling: obviously a rock gives MORE. Per town against per vein,
        // the same shape the levy term is held to per post.
        const weakestVein = Math.min(...state.factions
            .filter(f => Number(f.resources.veins ?? 0) > 0)
            .map(f => Number(f.resources.veins) * 5_000
                * (0.5 + Number(f.resources.reliable_ordinal ?? 0) / 47)));
        const richestTown = Math.max(...towns.map(whatATownPaysItsHolder));
        expect(richestTown).toBeGreaterThan(0);
        expect(richestTown).toBeLessThan(weakestVein);
    });

    it('leaves the two records that were cleared for this term charging nobody', () => {
        // Double-counting was handled before this term existed, by giving the
        // records that administer ground of their own no levy at all. Nothing
        // here may give them one, and the term has to actually reach them.
        const administersItsOwn = ['sect-myriad-course-hall', 'sect-ancient-bough-grove'];
        for (const id of administersItsOwn) {
            const cf = catalog.factions.find(f => f.id === id);
            expect(cf, id).toBeDefined();
            expect(whatALevyBringsIn(cf!.levy), id).toBe(0);
        }
        expect(
            administersItsOwn.some(id => whatTheTownsBringIn(state.locations, id) > 0),
            'neither record that was waiting for this term is paid by it'
        ).toBe(true);
    });
});

describe('a place answers who collects at it', () => {
    it('tells somebody standing in a held town who governs it and what they charge', () => {
        // The read that was only ever built one way. A house could say what it
        // charges; no place could say who charges at it, so a verb at a gate
        // would have had to search the levying houses for one whose prose
        // mentioned a gate.
        const held = towns.find(t => t.controllingFactionId !== null)!;
        const answer = whoCollectsHere(state.locations, held.id);
        expect(answer.holding).toBe('held');
        expect(answer.holderFactionId).toBe(held.controllingFactionId);
        expect(answer.holderName).toBeTruthy();
        expect(answer.stonesAYear).toBe(whatATownPaysItsHolder(held));
        expect(answer.why).toContain(held.name);
    });

    it('says which way the question ran out rather than going blank', () => {
        // Not having a holder is not the same as seeing nothing: the reading
        // names the register, the province or the silence, and carries a line.
        const unheld = towns.filter(t => t.controllingFactionId === null);
        expect(unheld.length).toBeGreaterThan(0);
        const ways = new Set<string>();
        for (const town of unheld) {
            const answer = whoCollectsHere(state.locations, town.id);
            expect(answer.holderFactionId, town.name).toBeNull();
            expect(answer.stonesAYear, town.name).toBe(0);
            expect(answer.why.length, town.name).toBeGreaterThan(0);
            ways.add(answer.holding);
        }
        expect(ways.has('held')).toBe(false);
        expect(ways.size).toBeGreaterThan(1);
    });

    it('charges nobody for a town nobody holds, inside a province somebody does', () => {
        // `whoHoldsTheGround` walks UPWARD, so a province that changes hands -
        // which the yearly economy does - would otherwise start collecting the
        // tax of every unheld town under it. Holding the province is not
        // holding the towns in it, and this is the state that says so.
        const unheld = towns.find(t => t.controllingFactionId === null)!;
        const province = state.locations.find(l => l.id === unheld.parentId)!;
        const someone = state.factions[0].id;
        const withHeldProvince = state.locations.map(l =>
            l.id === province.id ? { ...l, controllingFactionId: someone } : l);

        const answer = whoCollectsHere(withHeldProvince, unheld.id);
        expect(answer.holding).toBe('held');
        expect(answer.holderFactionId).toBe(someone);
        expect(answer.stonesAYear).toBe(0);
        // And it is not zero because the town is worth nothing.
        expect(whatATownPaysItsHolder(unheld)).toBeGreaterThan(0);
    });
});
