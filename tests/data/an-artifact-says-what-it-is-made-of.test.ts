/**
 * AN ARTIFACT SAYS WHAT IT IS MADE OF, AND SOMEBODY HAS TO BE HOLDING IT.
 *
 * The defect, as found: `whetherTheirHandsCanDoIt` carried the comment "The
 * material gate first" and then asked `canRefineGrade` and nothing else.
 * Nothing anywhere in `src/` asked whether a single gram of anything was on the
 * bench, so the whole material economy was authored in prose and enforced
 * nowhere - an elder at Void Tribulation turned out heaven-grade work from an
 * empty room, and the comment was the only thing that said otherwise.
 *
 * WHAT THESE ASSERTIONS ARE FOR, in the order they matter:
 *
 *   1. Every grade anything is worked out of materials for has a recipe, and no
 *      slot of it is unsatisfiable. A slot resolving to an empty set is a
 *      recipe nobody can ever finish and it would be invisible - the gate would
 *      simply refuse everybody, forever, with a correct-sounding reason.
 *   2. The slots of a recipe are DISJOINT. `whatTheBenchIsShortOf` spends one
 *      material on the first slot it fills, which is only right while no
 *      material fills two; the moment two overlap that greedy pass has to
 *      become a matching, and until somebody notices it will quietly say a
 *      whole bench is short.
 *   3. Nobody is forced through a person to make anything. Heaven-grade
 *      material comes off something standing at `BEAST_CHANGE_ORDINAL` or
 *      above, which has a shape and a voice and can decline. A heaven recipe
 *      whose every route ran through a beast would route every heaven-grade
 *      artifact in the world through that act, and the design owner's standing
 *      requirement is that a player who cannot get one thing has another road.
 *   4. A refusal names what is missing and what would stand in for it. The rule
 *      is repo-wide and the blank look is what it exists against.
 *
 * MEASURED, against the catalogs as they stand: the thinnest slot in either
 * recipe is filled by 10 distinct materials and the widest by 20, and an earth
 * recipe is three slots of which two are earth grade and one is roadside.
 *
 * Recipes are NOT lists of ids - a slot is a grade and a source, resolved
 * against the two catalogs at the moment it is asked - so "every material a
 * recipe names exists" is true by construction rather than by assertion, and
 * what is worth asserting instead is that every slot resolves to something.
 * That matters here specifically: a drop's grade follows the rung its source
 * stood at when it died, so rows move between grades and a hard-coded list
 * would have gone stale on somebody else's commit.
 */

import { describe, expect, it } from 'vitest';
import {
    WHAT_AN_ARTIFACT_IS_MADE_OF,
    fillsTheSlot,
    isAWorkedGrade,
    theBenchIsReady,
    whatItIsMadeOf,
    whatTheBenchIsShortOf,
    whatWouldFill,
    whyTheBenchIsShort
} from '../../src/data/cultivation/what-an-artifact-is-made-of.js';
import { everyIngredientThatIs } from '../../src/engine/cultivation/what-a-cauldron-will-take.js';
import { whetherTheirHandsCanDoIt } from '../../src/engine/social-leverage/commissioning-a-craft.js';
import { whatOfThisAHouseKeeps } from '../../src/engine/world/what-a-house-keeps-in-its-treasury.js';
import {
    madeBelowTheLid,
    refiningOrdinalFor
} from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { TechniqueGradeSchema } from '../../src/schema/cultivation.js';

const WORKED = Object.keys(WHAT_AN_ARTIFACT_IS_MADE_OF) as (keyof typeof WHAT_AN_ARTIFACT_IS_MADE_OF)[];

describe('every grade worked out of materials has a recipe', () => {
    it('covers earth and heaven and nothing else', () => {
        expect(new Set(WORKED)).toEqual(new Set(['earth', 'heaven']));
    });

    it('excludes exactly the grades nothing below the Lid makes', () => {
        for (const grade of TechniqueGradeSchema.options) {
            if (madeBelowTheLid(grade)) continue;
            expect(isAWorkedGrade(grade)).toBe(false);
            expect(whatItIsMadeOf(grade)).toBeNull();
        }
    });

    it('asks a mortal hand for nothing, because roadside work refuses nobody', () => {
        expect(whatItIsMadeOf('mortal')).toBeNull();
        expect(theBenchIsReady('mortal', [])).toBe(true);
    });

    it('is few slots, because a recipe of six rare things is one nobody finishes', () => {
        for (const grade of WORKED) {
            expect(WHAT_AN_ARTIFACT_IS_MADE_OF[grade].length).toBeLessThanOrEqual(3);
        }
    });
});

describe('every slot is satisfiable, and generously', () => {
    it('resolves to something in the catalogs', () => {
        for (const grade of WORKED) {
            for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF[grade]) {
                expect(whatWouldFill(slot).length).toBeGreaterThan(0);
            }
        }
    });

    it('offers several ways to fill each one', () => {
        for (const grade of WORKED) {
            for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF[grade]) {
                expect(whatWouldFill(slot).length).toBeGreaterThanOrEqual(5);
            }
        }
    });

    it('names only materials the one ingredient resolver knows', () => {
        for (const grade of WORKED) {
            for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF[grade]) {
                for (const row of whatWouldFill(slot)) {
                    expect(fillsTheSlot(slot, row.id)).toBe(true);
                }
            }
        }
    });
});

describe('no material fills two slots of one recipe', () => {
    it('keeps the greedy pass honest', () => {
        for (const grade of WORKED) {
            const slots = WHAT_AN_ARTIFACT_IS_MADE_OF[grade];
            for (let i = 0; i < slots.length; i++) {
                for (let j = i + 1; j < slots.length; j++) {
                    const overlap = whatWouldFill(slots[i]!)
                        .filter(row => fillsTheSlot(slots[j]!, row.id));
                    expect(overlap).toEqual([]);
                }
            }
        }
    });

    it('so two of a kind is two of a kind and not a whole recipe', () => {
        const body = everyIngredientThatIs({ grade: 'earth', from: 'a_beast' })[0]!;
        expect(theBenchIsReady('earth', [body.id, body.id, body.id])).toBe(false);
    });
});

describe('nobody is forced through a person to make anything', () => {
    it('lets a heaven-grade recipe be filled with grown things only', () => {
        const grown: string[] = [];
        for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF.heaven) {
            const picked = everyIngredientThatIs({
                grade: slot.grade,
                from: 'a_growing_thing'
            })[0];
            if (picked !== undefined) grown.push(picked.id);
        }
        // Not every slot: the body is a thing that came off something, and
        // earth-grade quarry stands below the rung at which a beast can
        // decline. What must never be forced is the HEART.
        const heart = WHAT_AN_ARTIFACT_IS_MADE_OF.heaven[0]!;
        expect(heart.grade).toBe('heaven');
        expect(whatWouldFill(heart).filter(row => row.from === 'a_growing_thing').length)
            .toBeGreaterThan(0);
        expect(grown.length).toBeGreaterThan(0);
    });
});

describe('the gate actually consults the bench', () => {
    const anElder = refiningOrdinalFor('heaven');
    const anEarthAsk = { named: 'an earth-grade sword', grade: 'earth' as const };

    it('still answers the rung question when nobody said what is on the bench', () => {
        expect(whetherTheirHandsCanDoIt(anEarthAsk, anElder).theyCan).toBe(true);
    });

    it('refuses a hand that can and a bench that is bare', () => {
        const answer = whetherTheirHandsCanDoIt(anEarthAsk, anElder, []);
        expect(answer.theyCan).toBe(false);
        expect(answer.theBenchIsShortOf.length).toBe(whatItIsMadeOf('earth')!.length);
    });

    it('agrees once the bench is whole', () => {
        const held = WHAT_AN_ARTIFACT_IS_MADE_OF.earth.map(slot => whatWouldFill(slot)[0]!.id);
        const answer = whetherTheirHandsCanDoIt(anEarthAsk, anElder, held);
        expect(answer.theyCan).toBe(true);
        expect(answer.why).toBeNull();
    });

    it('does not read a recipe against a ring, which is a fold and not a working', () => {
        const answer = whetherTheirHandsCanDoIt(
            { named: 'a storage ring', grade: 'earth', aRing: true },
            anElder,
            []
        );
        expect(answer.theBenchIsShortOf).toEqual([]);
    });

    it('keeps the rung refusal ahead of the bench one', () => {
        const answer = whetherTheirHandsCanDoIt(anEarthAsk, 0, []);
        expect(answer.theyCan).toBe(false);
        expect(answer.theBenchIsShortOf).toEqual([]);
        expect(answer.why).toMatch(/Core Formation/);
    });
});

describe('and somebody in the world holds the stuff', () => {
    /**
     * The other half, and the half a recipe is useless without: a gate that
     * names material nobody stocks is correct and unplayable. The stores are
     * built off the recipes' own slots, so this is a property rather than a
     * coincidence.
     *
     * MEASURED on a seeded world (`seed: 'recipe-measure'`, 38 standing
     * houses): 37 could complete an earth recipe out of their own stores and 22
     * a heaven one - which is exactly the 22 whose own best hand can work
     * heaven grade at all, and there are 22 heaven-grade material rows in the
     * whole world against 220 earth and 151 mortal.
     */
    const reachable = (grade: 'mortal' | 'earth' | 'heaven', from?: 'a_beast' | 'a_growing_thing') =>
        everyIngredientThatIs({ grade, ...(from === undefined ? {} : { from }), withinReachOf: 40 });

    it('keeps one row of a tracked grade and a shelf of a counted one', () => {
        const anElder = refiningOrdinalFor('heaven') + 4;
        expect(whatOfThisAHouseKeeps(reachable('heaven'), 'heaven', anElder).length).toBe(1);
        expect(whatOfThisAHouseKeeps(reachable('earth', 'a_beast'), 'earth', anElder).length)
            .toBeGreaterThan(1);
    });

    it('holds nothing of a grade its own best hand cannot work', () => {
        expect(whatOfThisAHouseKeeps(reachable('heaven'), 'heaven', refiningOrdinalFor('earth')))
            .toEqual([]);
    });

    it('gives a stronger house the dearer tracked thing', () => {
        const low = whatOfThisAHouseKeeps(reachable('heaven'), 'heaven', refiningOrdinalFor('heaven'));
        const high = whatOfThisAHouseKeeps(reachable('heaven'), 'heaven', refiningOrdinalFor('heaven') + 6);
        expect(high[0]!.value).toBeGreaterThan(low[0]!.value);
    });

    it('stocks against the recipes, so a house that can work a grade can fill it', () => {
        const anElder = refiningOrdinalFor('heaven') + 4;
        const held: string[] = [];
        for (const grade of WORKED) {
            for (const slot of WHAT_AN_ARTIFACT_IS_MADE_OF[grade]) {
                const fromTheStore = whatOfThisAHouseKeeps(
                    reachable(slot.grade as 'mortal' | 'earth' | 'heaven', slot.from ?? undefined),
                    slot.grade,
                    anElder
                );
                held.push(...fromTheStore.map(row => row.id));
            }
        }
        expect(theBenchIsReady('earth', held)).toBe(true);
        expect(theBenchIsReady('heaven', held)).toBe(true);
    });
});

describe('the refusal names what is missing and what would stand in', () => {
    it('says nothing where nothing is missing', () => {
        const held = WHAT_AN_ARTIFACT_IS_MADE_OF.heaven.map(slot => whatWouldFill(slot)[0]!.id);
        expect(whyTheBenchIsShort('heaven', held)).toBeNull();
    });

    it('names a substitute by name, and the road to it', () => {
        const said = whyTheBenchIsShort('earth', [])!;
        expect(said).not.toBeNull();
        const aSubstitute = whatWouldFill(WHAT_AN_ARTIFACT_IS_MADE_OF.earth[0]!)[0]!;
        expect(said).toContain(aSubstitute.name);
        expect(said).toMatch(/comes off a spirit beast|grows, and somebody has to be standing/);
    });

    it('names only the slot that is short when the rest are filled', () => {
        const recipe = WHAT_AN_ARTIFACT_IS_MADE_OF.earth;
        const allButTheLast = recipe.slice(0, -1).map(slot => whatWouldFill(slot)[0]!.id);
        const short = whatTheBenchIsShortOf('earth', allButTheLast);
        expect(short.length).toBe(1);
        expect(short[0]!.slot).toEqual(recipe[recipe.length - 1]);
    });
});
