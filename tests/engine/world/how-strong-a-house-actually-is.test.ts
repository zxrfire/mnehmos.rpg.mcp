/**
 * THE WORLD'S POWER RATING WAS A RATING OF ONE PERSON.
 *
 * `CatalogFaction.powerOrdinal` says, in its own doc comment, *"Realm ordinal
 * of its strongest member. Sets who it can bully."* Those are two facts wearing
 * one name. The design owner: *"right now the power rating is of its strongest
 * member, which is wrong, obviously."* A house with one monster and forty
 * children read identical to a house with twenty solid elders.
 *
 * `howStrongAHouseActuallyIs` is a composite index beside it - manpower,
 * materiel, finance, one-offs, readiness - and `powerOrdinal` is untouched,
 * because who a house's strongest person is remains a true fact plenty of code
 * legitimately wants.
 *
 * WHAT IT SAYS THAT THE OLD NUMBER COULD NOT. Measured on seed `rating-probe`,
 * index against `powerOrdinal`:
 *
 *   the Tripod Wardens          powerOrdinal 36 and fourth in the world, on five
 *                             people and every node lit. Eighth by powerOrdinal
 *   the Severed               powerOrdinal 38, sixth - one body at 38 and the
 *                             next at 24. A peak with nothing under it
 *   the Storm Tyrant Court    powerOrdinal 34 and twelfth by it, but eighteenth
 *                             by index: a tether it cannot repair, a compound
 *                             at 0.32 and 30,000 a year going out
 *
 * THE AGGREGATION IS NOT THIS FILE'S. An earlier cut picked a curve - a rung
 * worth the square root of two, log-summed - and it had no THRESHOLD, so twenty
 * Core Formation cultivators weighed what one body at 33.6 weighed and the
 * EMPYREAN COURT came out TWELFTH. What is used now is `war-melee.ts`'s own rule,
 * which every fight in the game already runs on: a body a full major realm below
 * the best thing present buys nothing, and above that line numbers are worth
 * `min(MAX_NUMBERS_MULTIPLIER, effectiveBodies ^ NUMBERS_EXPONENT)`.
 *
 * On it, twenty at Core Formation weigh 28 rungs. So do a hundred and so do six
 * hundred, and one body at 30 out-weighs every one of those crowds. Three of the
 * Empyrean Court weigh 44.5 rungs against the whole Frostmirror Court at 36.0, and
 * the Court is third in the world rather than twelfth.
 *
 * AND IT IS DERIVED, EVERY TIME, FROM THE WORLD. *"The rating changes for
 * obvious reasons, which is as it should be."* Over a seeded century 37 of 38
 * houses moved; the one that did not had lost nothing and gained nothing. The
 * Nine Peaks Order woke its ancestor and fell by 39 points with the ONE-OFFS
 * component carrying the fall - enormous once, and gone the morning after.
 *
 * Every assertion was red-checked by reverting the thing it covers.
 */

import { describe, it, expect } from 'vitest';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    howStrongAHouseActuallyIs,
    howStrongThisHouseIsNow,
    theRungsItCouldField,
    theRungsTheseBodiesCouldField,
    type WhatAHouseHasToField
} from '../../../src/engine/world/how-strong-a-house-actually-is.js';
import {
    rollOf,
    whoCountsTowardThisHouse,
    WHAT_A_SECONDED_PERSON_IS_WORTH_AT_THE_POSTING,
    WHAT_A_SECONDED_PERSON_IS_WORTH_AT_HOME
} from '../../../src/data/cultivation/faction-roll.js';
import { whatItsHoldingsBringIn } from '../../support/what-a-house-takes-off-its-holdings.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'rating-probe', catalog, presentYear: 1000, population: 300 });

const factionRecord = (id: string) => state.factions.find(f => f.id === id)!;
const declineOf = (id: string) => {
    const cf = catalog.factions.find(f => f.id === id);
    return {
        peakOrdinal: cf?.peakOrdinal ?? 0,
        yearsSinceLastPeak: cf?.yearsSinceLastPeak ?? 0
    };
};
const indexOf = (id: string) => howStrongThisHouseIsNow(state, factionRecord(id), declineOf(id)).index;

/** A house off the catalog, for the cases that are about the arithmetic. */
function fromCatalog(id: string): WhatAHouseHasToField {
    const cf = catalog.factions.find(f => f.id === id)!;
    return {
        rollOrdinals: rollOf(id).map(r => r.realmOrdinal),
        sealedCeilingOrdinal: cf.sealedCeilingOrdinal,
        formationIntegrity: cf.formationIntegrity,
        reliableOrdinal: cf.reliableOrdinal,
        peakOrdinal: cf.peakOrdinal,
        yearsSinceLastPeak: cf.yearsSinceLastPeak
    };
}

describe('how strong a house actually is', () => {
    it('lets no crowd substitute for height', () => {
        // THE DEFECT THIS REPLACED. There was a curve here - a rung worth the
        // square root of two, log-summed over the roll - and on it twenty Core
        // Formation cultivators weighed what one body at 33.6 weighed. In this
        // genre they lose to a Body Integration cultivator and it is not close,
        // and the consequence was measured: the EMPYREAN COURT, four immortals,
        // came out twelfth, below a house it could end by sending three people.
        //
        // What replaced it is `war-melee.ts`'s own rule, which is a THRESHOLD
        // rather than a slope: a body a full major realm below the best thing
        // present buys nothing, however many of them came.
        const twenty = theRungsItCouldField(Array(20).fill(25));
        const sixHundred = theRungsItCouldField(Array(600).fill(25));
        expect(sixHundred).toBe(twenty);
        expect(twenty).toBeLessThan(theRungsItCouldField([30]));
    });

    it('lets three of the Empyrean Court end the Frostmirror Court', () => {
        // THE ACCEPTANCE TEST, in the design owner's own terms. Both bodies are
        // read off the seeded world rather than named as figures, so the claim
        // survives somebody authoring a different roll.
        const hollow = state.npcs
            .filter(n => n.status === 'alive' && n.factionId === 'sect-hollow-court')
            .map(n => n.cultivation.realmOrdinal)
            .sort((a, b) => b - a);
        const frostmirror = state.npcs
            .filter(n => n.status === 'alive' && n.factionId === 'sect-frostmirror-court')
            .map(n => n.cultivation.realmOrdinal);

        expect(hollow.length).toBeGreaterThanOrEqual(3);
        expect(theRungsItCouldField(hollow.slice(0, 3)))
            .toBeGreaterThan(theRungsItCouldField(frostmirror));
    });

    it('keeps a seconded person to one person', () => {
        // A secondment SPLITS somebody between the posting and the house that
        // sent them. A first draft counted them fully at the posting and a
        // fraction at home, which would have made the world gain people every
        // time anybody was sent anywhere - a silent gain, every figure looking
        // plausible.
        expect(WHAT_A_SECONDED_PERSON_IS_WORTH_AT_THE_POSTING
            + WHAT_A_SECONDED_PERSON_IS_WORTH_AT_HOME).toBe(1);

        const sent = [{
            personId: 'somebody',
            realmOrdinal: 30,
            postingFactionId: 'sect-deeproot-court',
            sendingFactionId: 'sect-cold-sword-sect'
        }];
        const atThePosting = whoCountsTowardThisHouse('sect-deeproot-court', sent)
            .find(b => b.id === 'somebody')!;
        const atHome = whoCountsTowardThisHouse('sect-cold-sword-sect', sent)
            .find(b => b.id === 'somebody')!;
        expect(atThePosting.weight + atHome.weight).toBe(1);
        expect(atThePosting.weight).toBeGreaterThan(atHome.weight);
    });

    it('weighs a share of somebody as a share of a body', () => {
        // The split has to reach the arithmetic, not just the roll. A tenth of
        // a person is a tenth of a body toward the numbers and is never the
        // tallest thing present: a house cannot field a warden four provinces
        // away.
        const whole = theRungsTheseBodiesCouldField([{ realmOrdinal: 30, weight: 1 }]);
        const tenth = theRungsTheseBodiesCouldField([{ realmOrdinal: 30, weight: 0.1 }]);
        expect(tenth).toBeLessThan(whole);
    });

    it('does not order houses the way their strongest member does', () => {
        // The product. If these two orderings agreed everywhere the index would
        // be `powerOrdinal` with extra steps.
        const rated = catalog.factions.map(f => ({
            power: f.powerOrdinal,
            index: howStrongAHouseActuallyIs(fromCatalog(f.id)).index
        }));
        const disagreements = rated.filter(a =>
            rated.some(b => a.power > b.power && a.index < b.index));
        expect(disagreements.length).toBeGreaterThan(0);
    });

    it('puts a court on hard times above a house that out-earns it twice over', () => {
        // THE PAIR, and both readings on it. The Storm Tyrant Court holds a
        // vein it can no longer reach the bottom of and pays 30,000 a year in
        // tribute; the Cinnabar Crucible Sect takes twice what it does off its
        // furnaces and stands nine rungs below it. A rating that only read
        // income would call the camel a horse.
        const court = catalog.factions.find(f => f.id === 'sect-storm-tyrant-court')!;
        const hall = catalog.factions.find(f => f.id === 'sect-cinnabar-crucible-sect')!;

        expect(whatItsHoldingsBringIn(hall, state.locations))
            .toBeGreaterThan(whatItsHoldingsBringIn(court, state.locations));
        expect(indexOf(court.id)).toBeGreaterThan(indexOf(hall.id));
    });

    it('spends a one-off once and never gives it back', () => {
        // `sealedCeilingOrdinal` zeroes permanently on waking, and the rating
        // has to notice the morning after. Nothing else about the house moves.
        const holder = catalog.factions.find(f => f.sealedCeilingOrdinal > 0)!;
        const asleep = howStrongAHouseActuallyIs(fromCatalog(holder.id));
        const spent = howStrongAHouseActuallyIs({
            ...fromCatalog(holder.id), sealedCeilingOrdinal: 0
        });
        expect(spent.index).toBeLessThan(asleep.index);
        expect(spent.components.oneOffs).toBe(0);
        expect(spent.components.ranks).toBe(asleep.components.ranks);
        expect(spent.components.readiness).toBe(asleep.components.readiness);
    });

    it('counts a store differently from an income', () => {
        // A vault is spent once and a vein pays every year. Added on one scale
        // the rating would say a house that sold everything it owns is at its
        // most powerful.
        const base = { ...fromCatalog('sect-cinnabar-crucible-sect'), purse: {
            holdingsPerYear: 10_000, tributeStonesPerYear: 0, stones: 10_000
        } };
        const richerVault = howStrongAHouseActuallyIs({
            ...base, purse: { ...base.purse, stones: 20_000 }
        });
        const richerVein = howStrongAHouseActuallyIs({
            ...base, purse: { ...base.purse, holdingsPerYear: 20_000 }
        });
        expect(richerVein.index).toBeGreaterThan(richerVault.index);
    });

    it('does not count what is already in somebody else\'s hands', () => {
        // Issued is not held. A furnace lent to a disciple is still the house's
        // and is not something it can hand to anybody on the day.
        const id = catalog.factions.find(f =>
            state.objects.some(o => o.ownerId === f.id && o.possessorId === null && o.power))!.id;
        const before = indexOf(id);
        const issued: string[] = [];
        for (const object of state.objects) {
            if (object.ownerId === id && object.possessorId === null) {
                object.possessorId = 'somebody';
                issued.push(object.id);
            }
        }
        expect(indexOf(id)).toBeLessThan(before);
        for (const object of state.objects) {
            if (issued.includes(object.id)) object.possessorId = null;
        }
        expect(indexOf(id)).toBe(before);
    });

    it('falls the year a house loses its ground, with nobody updating a field', () => {
        // DERIVED, NOT STORED. The rating is never written anywhere: take a
        // vein off a house in the world and the next read is lower, which is
        // the whole difference between an index and a label.
        const held = state.factions.find(f => Number(f.resources.veins ?? 0) > 0)!;
        const before = indexOf(held.id);
        const had = Number(held.resources.veins);
        held.resources.veins = had - 1;
        expect(indexOf(held.id)).toBeLessThan(before);
        held.resources.veins = had;
        expect(indexOf(held.id)).toBe(before);
    });
});
