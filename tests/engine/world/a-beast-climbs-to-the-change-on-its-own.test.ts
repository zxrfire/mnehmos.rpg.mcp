/**
 * Nothing the world held could get to 29 except by somebody authoring it there.
 *
 * THE DEFECT, AS OBSERVED. `BEASTS` holds 27 species at or above the core and 6
 * at or above the change, and the six were the only things in the world that
 * could ever stand up as people. A Cloud Roc at 24 was at 24 on the day it was
 * met and at 24 nine hundred years later, because the only rung a beast had was
 * the catalog's and `applyAdvancement` - the pass that moves everybody - refused
 * a beast row at a province ceiling of 20 after computing four things it has no
 * use for. The design owner: *"the top doesn't have to grow but beasts should
 * eventually hit 29 naturally."*
 *
 * THE COST CONSTRAINT IS THE DESIGN. The world advance is already superlinear,
 * so the climb is a READING - species, ground, years sat, in and out - stored
 * nowhere, never accumulated, and evaluated when somebody asks. Measured by
 * `scripts/probe-what-a-beast-becomes-if-nobody-kills-it.ts` on seed
 * `beast-climb-probe`: one reading is 9.9us, and 200 simulated years cost
 * 26.5ms/year with no beast rows in the world, 22.8 with 25 of them and 21.9
 * with 100. The advance did not get dearer, because the branch REPLACES the
 * human one rather than adding to it.
 *
 * THE YEARS COME OFF THE LADDER. `whatItSpentGettingHere` already priced a
 * beast's whole method at a life in the band below, and running it forward is
 * the climb: 200 years old at Core Formation, 500 at Nascent Soul, 1,000 at
 * Deity Transformation, 2,000 at the change. So a species found at 24 is 1,125
 * years of sitting from standing up and one found at 17 is 1,800, which is the
 * register the catalog is written in - the change happens to something that has
 * been on its mountain for a millennium.
 *
 * WHAT THAT PRODUCES, over all 27 cored species on 200 pieces of ground: 50%
 * never move at all; at 400 years 37% have moved a rung and none authored below
 * the change has crossed; at 800 years 114 pairs have stood up; at 2,000 years
 * 1,094; at 5,000 years 2,117 of 5,400. The first species to get anywhere are
 * the ones already at 24 and 26.
 *
 * AND THE CLOCK STARTS AT THE ROW, which was measured rather than chosen. The
 * first cut anchored it on the world's calendar age; a world opens at year
 * 1,000, so every beast in it was minted at what a thousand years does, and
 * `something-with-a-core-is-somebody-you-can-spare.test.ts` went red on a
 * rung-22 player no longer being able to beat a Thunder Hawk placed at 17. A
 * balance change baked into seeding is not the world running.
 *
 * ONE DEFECT FOUND BY PLAYING THIS, and fixed in the same commit: the world's
 * intake pass reads a rung and a province and nothing else, so the moment a
 * beast row could climb into an admission band it was enrolled - a White Tiger
 * that reached Nascent Soul was taken onto the Storm Tyrant Court's roll at
 * rank 3 and then killed by `elder_died`, which only looks at people with a
 * house and a rank.
 *
 * RED-CHECKED, each arm separately. Returning the catalog ordinal from
 * `whatTheYearsDidToTheOneHere` - which is what the engine did before this -
 * fails the crossing arm and the advance arm. Removing the never-move draw from
 * `thePaceThisOneKeeps` fails the odds arm. Collapsing
 * `theNamesThisOneAnswersTo` to the row's own name fails the naming arm and the
 * advance arm.
 */

import { describe, expect, it } from 'vitest';
import {
    A_VEIN_IS_WORTH,
    MOST_NEVER_DO,
    asItStandsNow,
    thePaceThisOneKeeps,
    theRungThisRowShouldBeAt,
    whatItSpentGettingHere,
    yearsItHasSatSinceItsRowWasWritten,
    whatTheYearsDidToTheOneHere,
    yearsOfSittingToReach
} from '../../../src/engine/world/a-beast-climbs-by-sitting-where-it-is.js';
import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    anythingAtThisRungSpeaks
} from '../../../src/data/cultivation/beasts.js';
import { hasACore, readsAsSomebody } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import {
    idOfTheOneOnThisGround,
    itHasCrossed,
    standUpTheOneOnThisGround,
    theNameItTookAtTheChange,
    theNamesThisOneAnswersTo,
    theSpeciesItIs
} from '../../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { MAX_ORDINAL, lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../support/advance-world-years.js';

const catalog = await loadCultivationCatalog();

const SEED = 'a-beast-climbs';
const GROUND = 'loc-high-ledge';
const cored = BEASTS.filter(hasACore);
const belowTheChange = cored.filter(b => !readsAsSomebody(b));

/** Enough pieces of ground for the odds to be visible rather than anecdotal. */
const GROUNDS = Array.from({ length: 120 }, (_, i) => `loc-${i}`);

describe('a beast climbs to the change by sitting where it is', () => {
    it('prices a rung off the ladder rather than off a constant of its own', () => {
        // The band edges are exactly where the step function put them, which is
        // the whole claim: this fills the rungs in and moves nothing else.
        for (let rung = 0; rung <= MAX_ORDINAL; rung++) {
            const spent = whatItSpentGettingHere(rung);
            expect(yearsOfSittingToReach(rung), `rung ${rung}`)
                .toBeGreaterThanOrEqual(spent);
        }
        for (let rung = 1; rung <= MAX_ORDINAL; rung++) {
            expect(yearsOfSittingToReach(rung), `rung ${rung}`)
                .toBeGreaterThan(yearsOfSittingToReach(rung - 1));
        }
        // And a rung nothing could be alive at is never reachable.
        for (let rung = 0; rung <= MAX_ORDINAL; rung++) {
            if (yearsOfSittingToReach(rung) <= lifespanForOrdinal(rung)) continue;
            const sat = whatTheYearsDidToTheOneHere({
                beast: cored[0], locationId: GROUND, worldSeed: SEED, years: 1e9
            });
            expect(sat.ordinal, `rung ${rung}`).toBeLessThan(rung);
        }
    });

    it('leaves a world on its opening day exactly where the catalog put it', () => {
        for (const beast of cored) {
            const sat = whatTheYearsDidToTheOneHere({
                beast, locationId: GROUND, worldSeed: SEED, years: 0
            });
            expect(sat.ordinal, beast.id).toBe(beast.ordinal);
            expect(sat.rungsClimbed, beast.id).toBe(0);
            expect(sat.crossed, beast.id).toBe(readsAsSomebody(beast));
        }
    });

    it('never moves a rung backwards, however long the world runs', () => {
        for (const beast of cored) {
            let last = beast.ordinal;
            for (const years of [0, 100, 400, 800, 1200, 2000, 5000, 20_000]) {
                const sat = whatTheYearsDidToTheOneHere({
                    beast, locationId: GROUND, worldSeed: SEED, years
                });
                expect(sat.ordinal, `${beast.id} at ${years}y`).toBeGreaterThanOrEqual(last);
                expect(sat.crossed).toBe(anythingAtThisRungSpeaks(sat.ordinal));
                last = sat.ordinal;
            }
        }
    });

    /**
     * THE HALF OF THE RULING THAT IS NOT ABOUT GROWTH. *"The top doesn't have
     * to grow"* is a constraint in the other direction: most of what is
     * standing on the world's ground is standing exactly where the catalog put
     * it, for as long as the world runs, and that is stated as odds rather than
     * simulated.
     */
    it('leaves about half of them animals forever', () => {
        const never = GROUNDS.filter(ground => thePaceThisOneKeeps({
            beast: cored[0], locationId: ground, worldSeed: SEED
        }) === 0);
        expect(never.length / GROUNDS.length).toBeGreaterThan(MOST_NEVER_DO - 0.15);
        expect(never.length / GROUNDS.length).toBeLessThan(MOST_NEVER_DO + 0.15);
        // And one that never moves does not move at any horizon at all.
        for (const ground of never.slice(0, 5)) {
            const sat = whatTheYearsDidToTheOneHere({
                beast: cored[0], locationId: ground, worldSeed: SEED, years: 100_000
            });
            expect(sat.ordinal, ground).toBe(cored[0].ordinal);
        }
    });

    it('is the same animal every time it is asked about, and a different one next door', () => {
        const paces = GROUNDS.slice(0, 20).map(ground => thePaceThisOneKeeps({
            beast: cored[0], locationId: ground, worldSeed: SEED
        }));
        // Asked twice, the same answer. A pace that moved between two reads
        // would make one creature two different ages depending on who looked.
        for (const [at, ground] of GROUNDS.slice(0, 20).entries()) {
            expect(thePaceThisOneKeeps({
                beast: cored[0], locationId: ground, worldSeed: SEED
            })).toBe(paces[at]);
        }
        expect(new Set(paces).size).toBeGreaterThan(1);
    });

    it('makes a vein worth more than ordinary ground', () => {
        const climber = GROUNDS.find(ground => thePaceThisOneKeeps({
            beast: cored[0], locationId: ground, worldSeed: SEED
        }) > 0)!;
        const plain = thePaceThisOneKeeps({
            beast: cored[0], locationId: climber, worldSeed: SEED
        });
        const vein = thePaceThisOneKeeps({
            beast: cored[0], locationId: climber, worldSeed: SEED, onAVein: true
        });
        expect(vein).toBeCloseTo(plain * A_VEIN_IS_WORTH, 6);
    });

    /**
     * The ruling itself, as one assertion: something authored below the change
     * gets past it on time alone.
     */
    it('gets something authored below the change past it, on years and nothing else', () => {
        expect(belowTheChange.length).toBeGreaterThan(0);
        const crossings = belowTheChange.flatMap(beast =>
            GROUNDS.filter(ground => whatTheYearsDidToTheOneHere({
                beast, locationId: ground, worldSeed: SEED, years: 5000
            }).crossed));
        expect(crossings.length).toBeGreaterThan(0);
        // And the band reads as a person once it is there, through the same
        // predicate everything else in this area goes through.
        for (const beast of belowTheChange) {
            const sat = whatTheYearsDidToTheOneHere({
                beast, locationId: GROUNDS[0], worldSeed: SEED, years: 100_000
            });
            expect(readsAsSomebody(asItStandsNow(beast, sat.ordinal)), beast.id)
                .toBe(sat.ordinal >= BEAST_CHANGE_ORDINAL);
        }
    });

    /**
     * THE CLOCK STARTS AT THE ROW. Measured on the first cut, which anchored it
     * on the world's calendar age instead: a world opens at year 1,000, so
     * every beast in it was minted at what a thousand years does, and a Thunder
     * Hawk placed at 17 came up somewhere in the twenties -
     * `something-with-a-core-is-somebody-you-can-spare.test.ts` went red on a
     * rung-22 player no longer being able to beat one. A row is written at the
     * catalog's rung and climbs from there.
     */
    it('writes a row at the catalog rung, and reads zero years off it that day', () => {
        for (const beast of cored) {
            const row = standUpTheOneOnThisGround({
                beast, locationId: GROUND, seed: SEED, onDay: 365 * 5000
            });
            expect(row.cultivation.realmOrdinal, beast.id).toBe(beast.ordinal);
            expect(yearsItHasSatSinceItsRowWasWritten(
                row.identity.bornOnDay, beast, 365 * 5000
            ), beast.id).toBe(0);
            expect(theRungThisRowShouldBeAt({
                beast,
                locationId: GROUND,
                worldSeed: SEED,
                bornOnDay: row.identity.bornOnDay,
                day: 365 * 5000,
                standingAt: row.cultivation.realmOrdinal
            }), beast.id).toBe(beast.ordinal);
            // The id does not carry the rung, which is what lets a favour
            // written about the animal be held by the person.
            expect(row.id).toBe(idOfTheOneOnThisGround(beast.id, GROUND));
            expect(theSpeciesItIs(row)?.id).toBe(beast.id);
        }
    });

    it('moves the same row once the years have actually gone past', () => {
        const climber = belowTheChange.find(beast => GROUNDS.some(
            g => thePaceThisOneKeeps({ beast, locationId: g, worldSeed: SEED }) > 0))!;
        const ground = GROUNDS.find(
            g => thePaceThisOneKeeps({ beast: climber, locationId: g, worldSeed: SEED }) > 0)!;
        const row = standUpTheOneOnThisGround({
            beast: climber, locationId: ground, seed: SEED, onDay: 0
        });
        const later = theRungThisRowShouldBeAt({
            beast: climber,
            locationId: ground,
            worldSeed: SEED,
            bornOnDay: row.identity.bornOnDay,
            day: 365 * 4000,
            standingAt: row.cultivation.realmOrdinal
        });
        expect(later).toBeGreaterThan(climber.ordinal);
    });

    /**
     * THE RENAMING GAP, WHICH WAS WRITTEN DOWN AND LEFT.
     *
     * A row minted below the change carries the species name, because that is
     * what anybody standing there would say. Renaming it at the crossing was
     * said to be impossible, on the grounds that a name you were told is a name
     * you have and every knowledge row the player holds reads by name.
     *
     * It is not impossible: nothing is taken away. The person's name is added
     * and the species name stays reachable, because it is a function of the
     * row's tag rather than of its `name` column - so no write can forget it
     * and the two cannot drift.
     */
    it('adds a name at the change without taking the one anybody was told', () => {
        const animal = standUpTheOneOnThisGround({
            beast: belowTheChange[0], locationId: GROUND, seed: SEED, onDay: 365
        });
        expect(itHasCrossed(animal)).toBe(false);
        expect(animal.name).toBe(belowTheChange[0].name);
        expect(theNamesThisOneAnswersTo(animal)).toEqual([belowTheChange[0].name]);
        // Nothing to take yet, because it is still an animal.
        expect(theNameItTookAtTheChange(animal, SEED)).toBeNull();

        const crossed = {
            ...animal,
            cultivation: { ...animal.cultivation, realmOrdinal: BEAST_CHANGE_ORDINAL }
        };
        const took = theNameItTookAtTheChange(crossed, SEED)!;
        expect(took).not.toBeNull();
        expect(took).not.toBe(belowTheChange[0].name);

        const named = { ...crossed, name: took };
        // BOTH, SPECIES FIRST, because that is the one the player was told.
        expect(theNamesThisOneAnswersTo(named)).toEqual([belowTheChange[0].name, took]);
        // And it is taken once. A second crossing does not roll a second name.
        expect(theNameItTookAtTheChange(named, SEED)).toBeNull();
    });

    it('leaves an ordinary person with one name and no species behind it', () => {
        const person = { name: 'Wen Shu', tags: ['region:low-fall'] };
        expect(theNamesThisOneAnswersTo(person)).toEqual(['Wen Shu']);
    });

    /**
     * THE ROW ALREADY STANDING, which is the case the reading alone cannot
     * answer: a beast met at year fifty is a row, and the world has to go on
     * moving it. Never downward - a rung reached by any road is a fact.
     */
    it('never takes back a rung a row already stands on', () => {
        for (const beast of belowTheChange) {
            expect(theRungThisRowShouldBeAt({
                beast,
                locationId: GROUND,
                worldSeed: SEED,
                bornOnDay: 0,
                day: 0,
                standingAt: BEAST_CHANGE_ORDINAL + 1
            }), beast.id).toBe(BEAST_CHANGE_ORDINAL + 1);
        }
    });
});

describe('the world advance moves the one standing there', () => {
    /**
     * The pass, played rather than asserted. A row is put on the ground at the
     * rung the catalog places its kind, the world runs, and the row has to have
     * moved - through `applyAdvancement`, which is the pass that already runs.
     *
     * A SPECIES AT A REALM BOUNDARY, ON PURPOSE, twice over. The boundary is
     * the cheapest rung to buy - 75 years from Core Formation Perfection into
     * Nascent Soul, against 250 higher up - so the arm is a hundred and fifty
     * simulated years rather than three thousand. And a boundary is the only
     * kind of crossing the news layer carries: `howFarACrossingCarries` returns
     * null inside a realm, because a layer is nobody's business.
     */
    it('climbs a beast row over world time and files the crossing as news', async () => {
        const { state } = seedWorld({ seed: 'beast-advance', catalog });
        const beast = belowTheChange.find(b => b.ordinal === 20)!;
        const ground = state.locations.filter(l => l.kind !== 'region');
        // GROUND WHOSE PACE IS NOT ZERO, ASKED RATHER THAN ASSUMED. Half of
        // every piece of ground in the world never moves at all, so a square
        // picked by hand makes this a coin flip about the odds instead of a
        // test of the pass.
        const where = (ground.find(l => thePaceThisOneKeeps({
            beast, locationId: l.id, worldSeed: state.seed
        }) >= 1) ?? ground[0]).id;

        state.npcs.push(standUpTheOneOnThisGround({
            beast, locationId: where, seed: state.seed, onDay: state.currentDay
        }));
        const before = state.npcs[state.npcs.length - 1];
        expect(before.cultivation.realmOrdinal).toBe(beast.ordinal);
        expect(before.name).toBe(beast.name);

        const crossingsBefore = state.history.facts
            .filter(f => f.kind === 'realm_crossing').length;
        advanceWorldYears(state, 150);

        const after = state.npcs.find(n => n.id === before.id)!;
        expect(after.status).toBe('alive');
        expect(after.cultivation.realmOrdinal).toBeGreaterThan(beast.ordinal);
        // A realm boundary is news, and this one went into the world's own
        // record through the door a cultivator's crossing goes through.
        expect(state.history.facts.filter(f => f.kind === 'realm_crossing').length)
            .toBeGreaterThan(crossingsBefore);
        // Still an animal, so still called what its kind is called. The name is
        // what the change buys and nothing before it.
        expect(itHasCrossed(after)).toBe(false);
        expect(after.name).toBe(beast.name);
    }, 300_000);
});
