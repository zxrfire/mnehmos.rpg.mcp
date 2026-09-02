/**
 * The ladder that decides who may MAKE a grade of medicine.
 *
 * The design owner's ruling, in four rows, and the thing this file is most
 * careful about is that it is NOT the other medicine ladder. Two grade rules
 * live in this engine, they answer different questions of different people, and
 * collapsing them would let a Core Formation alchemist's cauldron decide what a
 * Core Formation patient's wound needs.
 */

import { describe, expect, it } from 'vitest';
import {
    REFINING_REALM_BY_GRADE,
    canRefineGrade,
    highestGradeRefinableAt,
    madeBelowTheLid,
    refiningOrdinalFor,
    refiningRealmNameFor,
    sentDownGrades,
    whyTheCauldronRefuses
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    MAX_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    realmForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { PILL_GRADE_REALM } from '../../../src/engine/cultivation/breakthrough.js';
import { medicineNeededFor } from '../../../src/engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import { RECIPES } from '../../../src/data/cultivation/recipes.js';
import { getPill } from '../../../src/data/cultivation/pills.js';
import {
    STRUCTURAL_REPAIR_MEDICINES
} from '../../../src/data/cultivation/structural-repair-medicine.js';

describe('the ruling, row by row', () => {
    it('puts each grade in the realm the owner named', () => {
        expect(refiningRealmNameFor('mortal')).toBe('Qi Condensation');
        expect(refiningRealmNameFor('earth')).toBe('Core Formation');
        expect(refiningRealmNameFor('heaven')).toBe('Void Refinement');
        expect(REFINING_REALM_BY_GRADE.immortal).toBe('immortal');
        expect(REFINING_REALM_BY_GRADE.chaos).toBe('immortal');
    });

    it('opens the bottom of the ladder to everybody, deliberately', () => {
        // A world where the cheapest medicine also needs a realm is a world
        // with no medicine in it at all. Mortal grade starts at rung zero.
        expect(refiningOrdinalFor('mortal')).toBe(0);
        expect(canRefineGrade('mortal', 0)).toBe(true);
    });

    it('rises strictly with the grade', () => {
        const rungs = (['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const)
            .map(refiningOrdinalFor);
        for (let i = 1; i < rungs.length; i++) {
            expect(rungs[i], `grade ${i} is not above grade ${i - 1}`)
                .toBeGreaterThanOrEqual(rungs[i - 1]);
        }
        expect(refiningOrdinalFor('earth')).toBeGreaterThan(refiningOrdinalFor('mortal'));
        expect(refiningOrdinalFor('heaven')).toBeGreaterThan(refiningOrdinalFor('earth'));
        expect(refiningOrdinalFor('immortal')).toBeGreaterThan(refiningOrdinalFor('heaven'));
    });
});

describe('nobody in this world makes immortal grade', () => {
    it('asks for the rung the lower realm expels, and nothing else', () => {
        expect(refiningOrdinalFor('immortal')).toBe(TRUE_IMMORTAL_ORDINAL);
        expect(refiningOrdinalFor('chaos')).toBe(TRUE_IMMORTAL_ORDINAL);
        expect(madeBelowTheLid('immortal')).toBe(false);
        expect(madeBelowTheLid('chaos')).toBe(false);
        expect(sentDownGrades().sort()).toEqual(['chaos', 'immortal']);
    });

    it('does not let a False Immortal do it', () => {
        // Forty-five may stay below the Lid and forty-six may not, which is the
        // whole practical difference between the two rungs. A False Immortal
        // never crossed, so never had the materials.
        expect(canRefineGrade('immortal', FALSE_IMMORTAL_ORDINAL)).toBe(false);
        expect(canRefineGrade('immortal', TRUE_IMMORTAL_ORDINAL)).toBe(true);
    });

    it('leaves everything below it reachable by somebody who lives here', () => {
        expect(madeBelowTheLid('mortal')).toBe(true);
        expect(madeBelowTheLid('earth')).toBe(true);
        expect(madeBelowTheLid('heaven')).toBe(true);
        // And the best a body that can go on existing down here can work.
        expect(highestGradeRefinableAt(FALSE_IMMORTAL_ORDINAL)).toBe('heaven');
        expect(highestGradeRefinableAt(MAX_ORDINAL)).toBe('chaos');
    });

    it('agrees with the structural-repair catalog rather than sitting beside it', () => {
        // That catalog carried this rule for its own four objects first, as
        // `madeBelowTheLid`. Two tables saying the same thing is how they start
        // disagreeing, so the one that is derived checks the one that is typed.
        for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
            expect(medicine.madeBelowTheLid, `${medicine.name} (${medicine.grade})`)
                .toBe(madeBelowTheLid(medicine.grade));
        }
    });
});

describe('it is not the other two grade ladders', () => {
    it('is not PILL_GRADE_REALM: the maker stands above the patient', () => {
        // `PILL_GRADE_REALM` says who a pill is FOR. This says who can MAKE
        // one. If they were ever equal, one of the two would be redundant and
        // somebody would delete the wrong one.
        let differs = 0;
        for (const grade of ['mortal', 'earth', 'heaven', 'immortal'] as const) {
            if (PILL_GRADE_REALM[grade] !== REFINING_REALM_BY_GRADE[grade]) differs++;
        }
        expect(differs).toBeGreaterThan(0);
        expect(refiningRealmNameFor('mortal')).not.toBe('Foundation Establishment');
    });

    it('is not the wound ladder: what you can make says nothing about what you need', () => {
        // A Core Formation alchemist refines earth grade and can still be
        // carrying a crippling tear that only heaven grade closes. Both
        // sentences are true of the same person at the same moment.
        const ordinal = refiningOrdinalFor('earth');
        expect(canRefineGrade('earth', ordinal)).toBe(true);
        expect(canRefineGrade('heaven', ordinal)).toBe(false);
        expect(medicineNeededFor('crippling', ordinal)).toBe('heaven');
    });
});

describe('the refusal names what would work', () => {
    it('names the realm when a realm would answer it', () => {
        const said = whyTheCauldronRefuses('heaven', 0)!;
        expect(said).toContain('Void Refinement');
        expect(whyTheCauldronRefuses('heaven', refiningOrdinalFor('heaven'))).toBeNull();
    });

    it('names the other roads when no realm would', () => {
        const said = whyTheCauldronRefuses('immortal', MAX_ORDINAL - 1)!;
        // Never a rung, because quoting one would be a lie about a road.
        expect(said).not.toContain(realmForOrdinal(TRUE_IMMORTAL_ORDINAL).name);
        expect(said).toMatch(/sent down/i);
        // And it never removes the verb: the dose still exists and can still be
        // got, by roads that do not run through a cauldron.
        expect(said).toMatch(/found|bought|inherited|dug/i);
    });
});

describe('the catalog obeys the ladder', () => {
    it('gates every recipe at or above its grade floor', () => {
        for (const recipe of RECIPES) {
            const grade = getPill(recipe.producesPillId)!.grade;
            expect(recipe.requiredOrdinal, `${recipe.id} (${grade})`)
                .toBeGreaterThanOrEqual(refiningOrdinalFor(grade));
        }
    });

    it('leaves no immortal or chaos formula fillable by anybody living here', () => {
        const fillable = RECIPES.filter(recipe => {
            const grade = getPill(recipe.producesPillId)!.grade;
            return !madeBelowTheLid(grade) && recipe.requiredOrdinal <= FALSE_IMMORTAL_ORDINAL;
        });
        expect(fillable.map(r => r.id)).toEqual([]);
    });

    it('still leaves the whole bottom of the ladder open on day one', () => {
        // The guard against fixing rarity by deleting the medicine. A cultivator
        // at rung zero must still be able to attempt something.
        const openAtZero = RECIPES.filter(r => r.requiredOrdinal === 0);
        expect(openAtZero.length).toBeGreaterThan(0);
    });
});
