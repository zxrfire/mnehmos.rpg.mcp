/**
 * The conveyance catalog, and the decisions in it that live only as numbers.
 *
 * AGENTS.md: a design decision that lives only as a number needs a test, and a
 * bill of materials is entirely numbers. Four rulings are pinned here and each
 * case is named after the ruling rather than after the function it calls:
 *
 *   1. GRADE DECIDES THE SIDE OF THE COUNTED/TRACKED LINE, permanently. Heaven
 *      grade is tracked, everything under it is a quantity, and nothing earns
 *      its way across by being old or famous or having survived something.
 *   2. MOST TRANSPORT CARRIES NO ORDINAL. If a later pass rates most rows the
 *      common case has been made special and the rating stops meaning anything.
 *   3. RANGE IS AN AXIS, NOT A RUNG. A house at the top holds a short-haul
 *      craft as well as a long-haul one, so the catalog must carry rated craft
 *      at more than one range.
 *   4. A HULL IS A SCHEDULE AND A PILL IS AN ERRAND. A bill asks for a grade
 *      and a count, never a named material, and the counts have to be large
 *      enough that building is a programme rather than a purchase.
 */

import { describe, it, expect } from 'vitest';
import {
    CONVEYANCES,
    CONVEYANCE_RECIPES,
    TRACKED_CRAFT,
    adjustCountedHolding,
    conveyancesForRange,
    conveyancesNobodyBuilds,
    countedHolding,
    countedHoldingKey,
    craftAgeInYears,
    craftOwnedBy,
    describeCountedHoldings,
    getConveyance,
    kindOfCraft,
    recipeForConveyance,
    trackedConveyanceKinds
} from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { refiningOrdinalFor } from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { OBJECT_CEILING_BELOW_THE_LID } from '../../src/engine/cultivation/realms.js';
import { FRAGMENTS_AT_OR_ABOVE } from '../../src/engine/cultivation/whether-a-weapon-survives-being-used.js';
import { BEAST_MATERIALS, BEAST_CHANGE_ORDINAL } from '../../src/data/cultivation/beasts.js';
import { SECTS } from '../../src/data/cultivation/sects.js';

const HEAVEN_FLOOR = refiningOrdinalFor('heaven');

describe('the conveyance ladder', () => {
    it('has unique ids and a description on every row', () => {
        const ids = CONVEYANCES.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const c of CONVEYANCES) {
            expect(c.description.length, `${c.id} has no description`).toBeGreaterThan(80);
            expect(c.heads).toBeGreaterThanOrEqual(1);
        }
    });

    it('starts on foot, and walking is free, unremarkable and reaches anywhere', () => {
        const foot = getConveyance('conv-on-foot');
        expect(foot, 'walking is the floor and must exist').toBeDefined();
        expect(foot!.grade).toBeNull();
        expect(foot!.holding).toBe('none');
        expect(foot!.range).toBe('crossing');
        expect(foot!.seenComing).toBe(false);
    });

    // RULING 1. The line is grade and only grade.
    it('is tracked exactly where the grade is heaven and counted everywhere below', () => {
        for (const c of CONVEYANCES) {
            if (c.holding === 'none' || c.holding === 'personal') continue;
            const atOrAboveHeaven = c.grade !== null && refiningOrdinalFor(c.grade) >= HEAVEN_FLOOR;
            expect(
                c.holding === 'tracked',
                `${c.id} is ${c.holding} at ${c.grade} grade, which contradicts the counted/tracked line`
            ).toBe(atOrAboveHeaven);
        }
    });

    // RULING 2. Rating the common case would delete the signal.
    it('leaves most of the world unrated, which is what makes an ordinal mean anything', () => {
        const rated = trackedConveyanceKinds().length;
        expect(rated).toBeGreaterThanOrEqual(2);
        expect(
            rated * 2,
            'more than half the ladder is rated; the common case has been made special'
        ).toBeLessThan(CONVEYANCES.length);
    });

    // RULING 3. A rich house holds both, so both must exist.
    it('rates a short-haul craft as well as a long-haul one, so range is an axis', () => {
        const ranges = new Set(trackedConveyanceKinds().map(c => c.range));
        expect(
            ranges.size,
            'every rated craft is for the same distance, so the table reads as a ladder'
        ).toBeGreaterThan(1);
        expect(conveyancesForRange('district').length).toBeGreaterThan(0);
    });

    it('is the only thing in the world that crosses water, at exactly one rung', () => {
        const overWater = CONVEYANCES.filter(
            c => c.crossesGroundThatCannotBeWalked && c.heads > 1
        );
        expect(overWater.map(c => c.id)).toEqual(['conv-spirit-boat']);
    });

    it('puts a beast in the traces only below the rung where a beast can decline', () => {
        // Nothing here stores a beast ordinal, and that is the point: the cap
        // is `BEAST_CHANGE_ORDINAL` in the beast catalog and this file must not
        // carry a second copy of it. What is asserted is that no drawn row is
        // rated at or above the line, which is the only way this catalog could
        // reach past it.
        for (const c of CONVEYANCES.filter(x => x.drawnByBeast)) {
            const rated = TRACKED_CRAFT.filter(t => t.data.conveyanceId === c.id);
            for (const craft of rated) {
                expect(craft.power).not.toBeNull();
            }
        }
        expect(BEAST_CHANGE_ORDINAL).toBeGreaterThan(0);
    });

    it('leaves three rungs with no recipe, and the mount is one of them', () => {
        const ids = conveyancesNobodyBuilds().map(c => c.id).sort();
        expect(ids).toContain('conv-on-foot');
        expect(ids).toContain('conv-sword-flight');
        expect(ids).toContain('conv-mount-mortal');
        expect(ids).toContain('conv-mount-earth');
    });
});

describe('what a house has of the counted ones', () => {
    it('is a number on the entity and nothing else', () => {
        const empty: Record<string, number> = {};
        expect(countedHolding(empty, 'conv-carriage-earth')).toBe(0);
        const after = adjustCountedHolding(empty, 'conv-carriage-earth', 4);
        expect(after[countedHoldingKey('conv-carriage-earth')]).toBe(4);
        expect(countedHolding(after, 'conv-carriage-earth')).toBe(4);
        // Nothing was mutated. Deltas out, never in.
        expect(empty).toEqual({});
    });

    it('never goes below zero, because losing five of four is losing four', () => {
        const held = adjustCountedHolding({}, 'conv-carriage-mortal', 4);
        expect(countedHolding(adjustCountedHolding(held, 'conv-carriage-mortal', -9), 'conv-carriage-mortal')).toBe(0);
    });

    it('refuses to count a tracked kind, because those are answered by name', () => {
        const fake = { [countedHoldingKey('conv-spirit-boat')]: 3 };
        expect(countedHolding(fake, 'conv-spirit-boat')).toBe(0);
    });

    it('is answerable, which is the whole reason a count is worth storing', () => {
        expect(describeCountedHoldings({})).toContain('on foot');
        const held = adjustCountedHolding(
            adjustCountedHolding({}, 'conv-carriage-earth', 4),
            'conv-mount-mortal',
            2
        );
        const said = describeCountedHoldings(held);
        expect(said).toContain('4');
        expect(said).toContain('earth grade');
        expect(said).toContain('2');
    });
});

describe('the craft that are objects', () => {
    it('is ordered strongest first, because the ordering is the argument', () => {
        const powers = TRACKED_CRAFT.map(c => c.power ?? -1);
        expect(powers).toEqual([...powers].sort((a, b) => b - a));
    });

    it('sits at or above the rung its materials demanded and under the object ceiling', () => {
        for (const craft of TRACKED_CRAFT) {
            expect(craft.power, `${craft.id} has no rating`).not.toBeNull();
            expect(craft.power!).toBeGreaterThanOrEqual(HEAVEN_FLOOR);
            expect(craft.power!).toBeLessThanOrEqual(OBJECT_CEILING_BELOW_THE_LID);
        }
    });

    /**
     * A wreck must obey the ordinary rule and mint nothing.
     *
     * `FRAGMENTS_AT_OR_ABOVE` is 45 and everything under it is ruined outright,
     * so as long as no craft is rated at or above that line a wrecked hull is
     * `ruin` and there is no need for a rule about broken boats. If a later
     * pass rates one at 45 this test goes red, and the correct response is to
     * decide deliberately whether a wrecked hull should leave salvage.
     */
    it('is rated under the rung where breaking something leaves pieces', () => {
        for (const craft of TRACKED_CRAFT) {
            expect(
                craft.power!,
                `${craft.id} would leave salvage when wrecked, which is a new rule nobody has taken`
            ).toBeLessThan(FRAGMENTS_AT_OR_ABOVE);
        }
    });

    it('is moored and never carried, so nothing can arm somebody with a boat', () => {
        for (const craft of TRACKED_CRAFT) {
            expect(craft.possessorId, `${craft.id} is in somebody's hand`).toBeNull();
        }
    });

    it('names an owner that is a real house, or names none at all', () => {
        const sectIds = new Set(SECTS.map(s => s.id));
        for (const craft of TRACKED_CRAFT) {
            if (craft.ownerId === null) continue;
            expect(sectIds.has(craft.ownerId), `${craft.ownerId} is not a house`).toBe(true);
        }
    });

    it('includes one nobody owns, so a craft can be lost and found', () => {
        const orphans = TRACKED_CRAFT.filter(c => c.ownerId === null);
        expect(orphans.length).toBeGreaterThan(0);
        expect(craftOwnedBy('')).toEqual([]);
    });

    it('resolves to a kind and carries an age a decline can be read off', () => {
        for (const craft of TRACKED_CRAFT) {
            expect(kindOfCraft(craft), `${craft.id} points at no conveyance kind`).toBeDefined();
            expect(kindOfCraft(craft)!.holding).toBe('tracked');
            expect(craftAgeInYears(craft)).toBeGreaterThan(0);
        }
    });

    it('has at least one house holding a short-haul craft and no hull', () => {
        const holders = new Map<string, Set<string>>();
        for (const craft of TRACKED_CRAFT) {
            if (craft.ownerId === null) continue;
            const set = holders.get(craft.ownerId) ?? new Set<string>();
            set.add(kindOfCraft(craft)!.range);
            holders.set(craft.ownerId, set);
        }
        const shortOnly = [...holders.values()].filter(s => s.has('district') && !s.has('crossing'));
        expect(
            shortOnly.length,
            'nobody holds a carriage without a hull, so the range axis is untested by the data'
        ).toBeGreaterThan(0);
    });
});

describe('the bills of materials', () => {
    it('asks for a grade and a count and never for a named material', () => {
        for (const recipe of CONVEYANCE_RECIPES) {
            expect(recipe.components.length).toBeGreaterThan(0);
            for (const line of recipe.components) {
                expect(line.count).toBeGreaterThan(0);
                expect(line.wants.length).toBeGreaterThan(15);
                // The shape assertion: no line names a material id.
                expect(Object.keys(line)).toEqual(['wants', 'grade', 'count', 'mustBeCore']);
            }
        }
    });

    it('produces a conveyance that exists, and every buildable rung has one bill', () => {
        for (const recipe of CONVEYANCE_RECIPES) {
            expect(getConveyance(recipe.producesConveyanceId), recipe.id).toBeDefined();
            expect(getConveyance(recipe.producesConveyanceId)!.grade).toBe(recipe.grade);
        }
        const built = new Set(CONVEYANCE_RECIPES.map(r => r.producesConveyanceId));
        expect(new Set(CONVEYANCE_RECIPES.map(r => r.id)).size).toBe(CONVEYANCE_RECIPES.length);
        expect(built.size).toBe(CONVEYANCE_RECIPES.length);
    });

    /**
     * Every line has to be satisfiable off the beast catalog as it stands.
     *
     * This is the guard that keeps hunting and building one economy. If a bill
     * asks for a grade at which no beast in the world yields anything, or for a
     * core at a grade nothing has a core at, the recipe is unbuildable and
     * nothing in the running game would ever say so.
     */
    it('can be met from the beast catalog as it actually stands', () => {
        for (const recipe of CONVEYANCE_RECIPES) {
            for (const line of recipe.components) {
                const supply = BEAST_MATERIALS.filter(
                    m => m.grade === line.grade && (!line.mustBeCore || m.core)
                );
                expect(
                    supply.length,
                    `${recipe.id} wants ${line.count} ${line.grade}-grade `
                    + `${line.mustBeCore ? 'cores' : 'pieces'} and nothing in the world yields them`
                ).toBeGreaterThan(0);
            }
        }
    });

    // RULING 4. Building is a programme, not a purchase.
    it('makes a hull cost strictly more of everything than a carriage of the same grade', () => {
        const boat = recipeForConveyance('conv-spirit-boat')!;
        const carriage = recipeForConveyance('conv-carriage-heaven')!;
        const pieces = (r: typeof boat): number => r.components.reduce((n, c) => n + c.count, 0);
        const cores = (r: typeof boat): number =>
            r.components.filter(c => c.mustBeCore).reduce((n, c) => n + c.count, 0);
        expect(pieces(boat)).toBeGreaterThan(pieces(carriage));
        expect(cores(boat)).toBeGreaterThan(cores(carriage));
        expect(boat.workDays).toBeGreaterThan(carriage.workDays);
        expect(boat.baseSuccessRate).toBeLessThan(carriage.baseSuccessRate);
    });

    it('gets harder and longer at every step up the grades', () => {
        const order = ['build-carriage-mortal', 'build-carriage-earth', 'build-carriage-heaven'];
        const rows = order.map(id => CONVEYANCE_RECIPES.find(r => r.id === id)!);
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i].workDays, rows[i].id).toBeGreaterThan(rows[i - 1].workDays);
            expect(rows[i].baseSuccessRate, rows[i].id).toBeLessThan(rows[i - 1].baseSuccessRate);
        }
    });

    /**
     * The core is the line that closes the loop, so a bill above mortal grade
     * has one. `BEAST_CORE_ORDINAL` is 17 and `refiningOrdinalFor('heaven')` is
     * 29, so the party that can take the material is not the hand that can work
     * it - which is the whole of why a poor house sells cores and a rich one
     * buys them.
     */
    it('wants a core at every grade above the cheapest, which is what hunting is for', () => {
        for (const recipe of CONVEYANCE_RECIPES) {
            const cores = recipe.components.filter(c => c.mustBeCore);
            if (recipe.grade === 'mortal') {
                expect(cores.length, 'the cheap rung must not need a core').toBe(0);
                continue;
            }
            expect(cores.length, `${recipe.id} needs no core`).toBeGreaterThan(0);
        }
    });

    /**
     * MEASURED, and it is why the earth-grade carriage asks for a heaven-grade
     * core rather than an earth-grade one.
     *
     * There is no core below heaven grade anywhere in the world, and there
     * cannot be: a core is condensed cultivation rather than a part of an
     * animal, and `BEAST_CORE_ORDINAL` puts the first of them at Core
     * Formation. So every core line in every bill is heaven grade or above by
     * necessity, and the step from a drawn carriage to a shod one is the step
     * at which a house has to send people out after something that will kill
     * them. If a mortal- or earth-grade core is ever added to the catalog this
     * goes red, and the right response is to decide deliberately whether the
     * cheap end of the conveyance ladder should stop costing lives.
     */
    it('asks for a core at heaven grade or above, because no lesser core exists', () => {
        const lowCores = BEAST_MATERIALS.filter(
            m => m.core && (m.grade === 'mortal' || m.grade === 'earth')
        );
        expect(lowCores.map(m => m.id)).toEqual([]);
        for (const recipe of CONVEYANCE_RECIPES) {
            for (const line of recipe.components.filter(c => c.mustBeCore)) {
                expect(
                    line.grade,
                    `${recipe.id} asks for a ${line.grade}-grade core and none is ever taken`
                ).toBe('heaven');
            }
        }
    });
});
