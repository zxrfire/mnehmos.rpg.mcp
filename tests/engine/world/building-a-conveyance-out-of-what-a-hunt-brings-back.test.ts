/**
 * Building a conveyance: the bill, the rung, the days, and the half-built thing.
 *
 * What is pinned here, and why each of it is a decision rather than a detail:
 *
 *   1. THE RUNG IS NOT A SECOND OPINION. Who can build a grade is
 *      `refiningOrdinalFor`, the same gate that decides who refines a grade of
 *      medicine. If a bespoke table ever grows here these go red.
 *   2. THE LOOP. `BEAST_CORE_ORDINAL` is where a core can be TAKEN and the
 *      refining floor is where it can be WORKED, and the gap between them is
 *      the whole economy: a poor house can hunt what it cannot use.
 *   3. WORK CANNOT OUTRUN MATERIALS. A house three cores short stops now, with
 *      a yard full of qualified hands and nothing for them to do.
 *   4. CRAFTING CREATES, IT DOES NOT PROMOTE. The output's grade is the
 *      recipe's, never that of what was fed in, and only a heaven-grade recipe
 *      produces anything with an ordinal.
 *   5. A NEW HULL HAS A CLEAN CHAIN, which is the opposite of nearly everything
 *      else tracked in this world.
 */

import { describe, it, expect } from 'vitest';
import {
    MARGIN_PER_RUNG,
    coresRequired,
    deliver,
    fractionStocked,
    launch,
    layDownKeel,
    lotSatisfies,
    mintCraft,
    ratedOrdinalFor,
    readyToLaunch,
    requiredOrdinalForRecipe,
    successRateFor,
    totalComponentsRequired,
    whatIsStillShort,
    workDaysAllowedSoFar,
    workOn,
    type ConveyanceRecipe,
    type MaterialLot
} from '../../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import {
    CONVEYANCE_RECIPES,
    recipeForConveyance
} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {
    refiningOrdinalFor,
    canRefineGrade
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { BEAST_CORE_ORDINAL, BEAST_MATERIALS } from '../../../src/data/cultivation/beasts.js';
import { isRuined, shardPower } from '../../../src/engine/world/possessions.js';

const BOAT = recipeForConveyance('conv-spirit-boat')!;
const CARRIAGE_MORTAL = recipeForConveyance('conv-carriage-mortal')!;

/** Everything a bill asks for, in one heap, so a build can be finished. */
function fullBill(recipe: ConveyanceRecipe): MaterialLot[] {
    return recipe.components.map((line, i) => ({
        id: `lot-${i}`,
        grade: line.grade,
        core: line.mustBeCore,
        count: line.count
    }));
}

describe('who can do the work', () => {
    // RULING 1.
    it('asks the same gate that decides who refines a grade of medicine', () => {
        for (const recipe of CONVEYANCE_RECIPES) {
            expect(requiredOrdinalForRecipe(recipe)).toBe(refiningOrdinalFor(recipe.grade));
        }
    });

    it('puts a heaven-grade hull out of reach of everybody below Void Refinement', () => {
        const bar = requiredOrdinalForRecipe(BOAT);
        expect(canRefineGrade('heaven', bar - 1)).toBe(false);
        expect(canRefineGrade('heaven', bar)).toBe(true);
        expect(successRateFor(BOAT, bar - 1)).toBe(0);
        expect(successRateFor(BOAT, bar)).toBeGreaterThan(0);
    });

    /**
     * RULING 2. The loop, in two numbers neither of which was written for this.
     *
     * A Core Formation party can take a heaven-grade core off an animal and
     * cannot work one. That gap IS the economy: a poor house hunts and sells,
     * a rich house buys the years it cannot spare. If these two constants ever
     * meet, a house that can hunt a core can build with it, and the whole
     * gradient between a house with a hull and a house without disappears.
     */
    it('lets a poor house take a core it can never use', () => {
        const canTake = BEAST_CORE_ORDINAL;
        const canWork = refiningOrdinalFor('heaven');
        expect(canTake).toBeLessThan(canWork);
        const heavenCores = BEAST_MATERIALS.filter(m => m.core && m.grade === 'heaven');
        expect(heavenCores.length).toBeGreaterThan(0);
        for (const core of heavenCores) {
            expect(core.harvestOrdinal).toBeLessThan(canWork);
        }
    });

    it('is worth something to send the best hand and never worth certainty', () => {
        const bar = requiredOrdinalForRecipe(BOAT);
        expect(successRateFor(BOAT, bar + 5) - successRateFor(BOAT, bar))
            .toBeCloseTo(5 * MARGIN_PER_RUNG, 6);
        expect(successRateFor(BOAT, 45)).toBeLessThan(1);
    });
});

describe('the slip', () => {
    it('starts empty and knows the whole bill is missing', () => {
        const berth = layDownKeel(BOAT);
        expect(berth.workDaysDone).toBe(0);
        expect(fractionStocked(berth, BOAT)).toBe(0);
        expect(whatIsStillShort(berth, BOAT).length).toBe(BOAT.components.length);
    });

    it('accepts better material than a line asked for and never worse', () => {
        const plainLine = BOAT.components.find(c => !c.mustBeCore)!;
        const coreLine = BOAT.components.find(c => c.mustBeCore)!;
        expect(lotSatisfies({ id: 'a', grade: 'heaven', core: false, count: 1 }, plainLine)).toBe(true);
        expect(lotSatisfies({ id: 'a', grade: 'earth', core: false, count: 1 }, plainLine)).toBe(false);
        expect(lotSatisfies({ id: 'a', grade: 'immortal', core: false, count: 1 }, plainLine)).toBe(true);
        // Nothing meets a core line but a core. This is the one line more of
        // something else cannot satisfy.
        expect(lotSatisfies({ id: 'a', grade: 'chaos', core: false, count: 99 }, coreLine)).toBe(false);
        expect(lotSatisfies({ id: 'a', grade: 'heaven', core: true, count: 1 }, coreLine)).toBe(true);
    });

    it('does not spend a core on a line a bone would have met', () => {
        const berth = deliver(layDownKeel(BOAT), BOAT, [
            { id: 'lot-cores', grade: 'heaven', core: true, count: coresRequired(BOAT) },
            { id: 'lot-bone', grade: 'heaven', core: false, count: 400 }
        ]);
        expect(whatIsStillShort(berth, BOAT)).toEqual([]);
        expect(berth.spent['lot-cores']).toBe(coresRequired(BOAT));
    });

    it('gives the same answer whatever order the lots arrive in', () => {
        const lots: MaterialLot[] = [
            { id: 'lot-bone', grade: 'heaven', core: false, count: 60 },
            { id: 'lot-cores', grade: 'heaven', core: true, count: 3 },
            { id: 'lot-hide', grade: 'heaven', core: false, count: 30 }
        ];
        const a = deliver(layDownKeel(BOAT), BOAT, lots);
        const b = deliver(layDownKeel(BOAT), BOAT, [...lots].reverse());
        expect(a.delivered).toEqual(b.delivered);
        expect(a.spent).toEqual(b.spent);
    });

    it('reports what is short line by line, so being three short is a situation', () => {
        const short = deliver(layDownKeel(BOAT), BOAT, [
            { id: 'lot-cores', grade: 'heaven', core: true, count: coresRequired(BOAT) - 3 },
            { id: 'lot-bulk', grade: 'heaven', core: false, count: 1_000 }
        ]);
        const missing = whatIsStillShort(short, BOAT);
        expect(missing.length).toBe(1);
        expect(missing[0].line.mustBeCore).toBe(true);
        expect(missing[0].short).toBe(3);
    });
});

describe('the work', () => {
    // RULING 3.
    it('cannot outrun the materials', () => {
        const half = deliver(layDownKeel(BOAT), BOAT, [
            { id: 'lot-bulk', grade: 'heaven', core: false, count: 60 }
        ]);
        const ceiling = workDaysAllowedSoFar(half, BOAT);
        expect(ceiling).toBeGreaterThan(0);
        expect(ceiling).toBeLessThan(BOAT.workDays);

        const bar = requiredOrdinalForRecipe(BOAT);
        const worked = workOn(half, BOAT, { days: BOAT.workDays, hands: [bar] });
        expect(worked.daysWorked).toBe(ceiling);
        expect(worked.stoppedBecause).toContain('the bill');

        const again = workOn(worked.berth, BOAT, { days: 100, hands: [bar] });
        expect(again.daysWorked).toBe(0);
        expect(again.stoppedBecause).toContain('short of');
    });

    it('gets nowhere with a yard full of hands that cannot work the grade', () => {
        const stocked = deliver(layDownKeel(BOAT), BOAT, fullBill(BOAT));
        const r = workOn(stocked, BOAT, { days: 1_000, hands: [20, 24, 28] });
        expect(r.daysWorked).toBe(0);
        expect(r.stoppedBecause).toContain('Void Refinement');
    });

    it('divides the work between qualified hands and ignores the rest', () => {
        const bar = requiredOrdinalForRecipe(CARRIAGE_MORTAL);
        const stocked = deliver(layDownKeel(CARRIAGE_MORTAL), CARRIAGE_MORTAL, fullBill(CARRIAGE_MORTAL));
        const one = workOn(stocked, CARRIAGE_MORTAL, { days: 10, hands: [bar] });
        const four = workOn(stocked, CARRIAGE_MORTAL, { days: 10, hands: [bar, bar, bar, bar] });
        expect(four.daysWorked).toBe(one.daysWorked * 4);
    });

    it('is only ready when the bill is full and every day of work is in it', () => {
        const bar = requiredOrdinalForRecipe(CARRIAGE_MORTAL);
        const stocked = deliver(layDownKeel(CARRIAGE_MORTAL), CARRIAGE_MORTAL, fullBill(CARRIAGE_MORTAL));
        expect(readyToLaunch(stocked, CARRIAGE_MORTAL)).toBe(false);
        const done = workOn(stocked, CARRIAGE_MORTAL, { days: CARRIAGE_MORTAL.workDays, hands: [bar] });
        expect(readyToLaunch(done.berth, CARRIAGE_MORTAL)).toBe(true);
    });
});

describe('the launch', () => {
    function finished(recipe: ConveyanceRecipe, hand: number) {
        const stocked = deliver(layDownKeel(recipe), recipe, fullBill(recipe));
        return workOn(stocked, recipe, { days: recipe.workDays, hands: [hand] }).berth;
    }

    it('attempts nothing and loses nothing when the thing is not finished', () => {
        const r = launch('seed', layDownKeel(BOAT), BOAT, 45);
        expect(r.launched).toBe(false);
        expect(r.spent).toEqual({});
        expect(r.narrationHint).toContain('nothing was lost');
    });

    it('is deterministic from the seed, and different seeds are different runs', () => {
        const berth = finished(BOAT, 33);
        const a = launch('seed-one', berth, BOAT, 33);
        const b = launch('seed-one', berth, BOAT, 33);
        expect(a).toEqual(b);
        const rolls = ['s1', 's2', 's3', 's4', 's5', 's6'].map(s => launch(s, berth, BOAT, 33).roll);
        expect(new Set(rolls).size).toBeGreaterThan(1);
    });

    it('consumes the materials whether or not it holds, which is why it is an event', () => {
        const berth = finished(BOAT, 33);
        for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
            const r = launch(seed, berth, BOAT, 33);
            expect(Object.keys(r.spent).length).toBeGreaterThan(0);
        }
    });

    // RULING 4.
    it('rates only what a heaven-grade recipe produces, and never what fed it', () => {
        expect(ratedOrdinalFor(CARRIAGE_MORTAL, 45)).toBeNull();
        const carriageEarth = recipeForConveyance('conv-carriage-earth')!;
        expect(
            ratedOrdinalFor(carriageEarth, 45),
            'an earth-grade carriage got an ordinal, so grade stopped deciding the side of the line'
        ).toBeNull();
        expect(ratedOrdinalFor(BOAT, 33)).toBe(33);
        expect(ratedOrdinalFor(BOAT, 29)).toBe(29);
    });

    it('never mints anything below heaven grade, however good the material was', () => {
        // The bill is met entirely with chaos-grade cores, which is absurd and
        // legal. The carriage is still an earth-grade carriage and still a
        // number on somebody's row.
        const carriageEarth = recipeForConveyance('conv-carriage-earth')!;
        const lavish: MaterialLot[] = [{ id: 'lot-absurd', grade: 'chaos', core: true, count: 999 }];
        const stocked = deliver(layDownKeel(carriageEarth), carriageEarth, lavish);
        expect(whatIsStillShort(stocked, carriageEarth)).toEqual([]);
        const bar = requiredOrdinalForRecipe(carriageEarth);
        const done = workOn(stocked, carriageEarth, { days: carriageEarth.workDays, hands: [bar] }).berth;
        const outcome = launch('seed', done, carriageEarth, bar);
        expect(outcome.ratedAt).toBeNull();
        expect(mintCraft(carriageEarth, {
            id: 'x', name: 'x', ownerId: 'h', ownerName: 'H',
            wrightId: 'w', wrightName: 'W', bestHandOrdinal: 45, onDay: 1, mooredAt: 'here'
        })).toBeNull();
    });
});

describe('what a new hull is, socially', () => {
    // RULING 5.
    it('starts its chain at link one with nothing missing', () => {
        const made = mintCraft(BOAT, {
            id: 'craft-new',
            name: 'The Second Answer',
            ownerId: 'sect-azure-cloud-pavilion',
            ownerName: 'Azure Cloud Pavilion',
            wrightId: 'npc-wright',
            wrightName: 'Elder Shen',
            bestHandOrdinal: 34,
            onDay: 900_000,
            mooredAt: 'the terraces'
        })!;
        expect(made.power).toBe(34);
        expect(made.provenance.length).toBe(1);
        expect(made.provenance[0].how).toBe('crafted');
        expect(made.provenance[0].previousHolderId).toBeNull();
        expect(made.provenance[0].note).toContain('Elder Shen');
        // Somebody can be asked where it came from, which is the whole of what
        // a clean chain buys and is exactly what an inherited hull lacks.
        expect(made.knownOwnershipBy).toContain('sect-azure-cloud-pavilion');
        expect(made.knownOwnershipBy).toContain('npc-wright');
    });

    it('is moored and not in anybody\'s hand', () => {
        const made = mintCraft(BOAT, {
            id: 'craft-new', name: 'x', ownerId: 'h', ownerName: 'H',
            wrightId: 'w', wrightName: 'W', bestHandOrdinal: 33, onDay: 1, mooredAt: 'here'
        })!;
        expect(made.possessorId).toBeNull();
        expect(isRuined(made)).toBe(false);
    });

    it('obeys the ordinary rule about breaking, and needs no rule of its own', () => {
        const made = mintCraft(BOAT, {
            id: 'craft-new', name: 'x', ownerId: 'h', ownerName: 'H',
            wrightId: 'w', wrightName: 'W', bestHandOrdinal: 33, onDay: 1, mooredAt: 'here'
        })!;
        // The only grade movement anywhere in this world, and it is downward.
        expect(shardPower(made.power)).toBe(made.power! - 1);
    });
});

describe('the bill and the catalog agree', () => {
    it('counts what it asks for', () => {
        for (const recipe of CONVEYANCE_RECIPES) {
            const bill = fullBill(recipe);
            const berth = deliver(layDownKeel(recipe), recipe, bill);
            expect(fractionStocked(berth, recipe), recipe.id).toBe(1);
            expect(totalComponentsRequired(recipe)).toBe(bill.reduce((n, l) => n + l.count, 0));
        }
    });
});
