/**
 * What realm a body has to stand at before it can WORK the materials a grade is
 * made of.
 *
 * The design owner's: *a cultivator cannot work with materials above their realm,
 * and that is what makes the higher grades rare* - not price, not a quota,
 * *"a Qi Condensation can't work with the materials to make a heaven grade pill,
 * that's what makes it rare."*
 *
 * Note what the catalog is careful about and this file must not undo: it has no
 * price field and must never have one, because a price would imply the economy
 * reaches those objects. Nothing here quotes a figure for anything.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import {
    REALM_TIERS,
    TRUE_IMMORTAL_ORDINAL,
    isExpelledFromBelow,
    realmForOrdinal,
    type RealmKey
} from './realms.js';

/**
 * The realm a refiner must stand in to work a grade's materials at all.
 */
export const REFINING_REALM_BY_GRADE: Readonly<Record<TechniqueGrade, RealmKey>> = {
    mortal: 'qi_condensation',
    earth: 'core_formation',
    heaven: 'void_refinement',
    immortal: 'immortal',
    chaos: 'immortal'
};

/**
 * The rung a refiner must have reached to work this grade.
 */
export function refiningOrdinalFor(grade: TechniqueGrade): number {
    const key = REFINING_REALM_BY_GRADE[grade];
    if (key === 'immortal') return TRUE_IMMORTAL_ORDINAL;
    const tier = REALM_TIERS.find(t => t.key === key);
    // Unreachable while the table names real realms. A loud 0 rather than a
    // throw, because a bad edit here should fail a test and not a run.
    return tier?.ordinalStart ?? 0;
}

/**
 * Whether anybody who can live in the lower realm can make this grade.
 *
 * False exactly where the requirement is a rung the world below the Lid ejects.
 * Nothing is asserted here that `isExpelledFromBelow` does not already say.
 */
export function madeBelowTheLid(grade: TechniqueGrade): boolean {
    return !isExpelledFromBelow(refiningOrdinalFor(grade));
}

/** Every grade that is only ever sent down, never refined here. */
export function sentDownGrades(): TechniqueGrade[] {
    return (Object.keys(REFINING_REALM_BY_GRADE) as TechniqueGrade[])
        .filter(grade => !madeBelowTheLid(grade));
}

/**
 * The realm's own display name, for saying the requirement out loud.
 */
export function refiningRealmNameFor(grade: TechniqueGrade): string {
    return realmForOrdinal(refiningOrdinalFor(grade)).name;
}

/** Whether a cultivator standing at this rung may attempt this grade at all. */
export function canRefineGrade(grade: TechniqueGrade, realmOrdinal: number): boolean {
    return realmOrdinal >= refiningOrdinalFor(grade);
}

/**
 * The best grade a cultivator at this rung can work, or null below the bottom
 * of the ladder - which nobody is, since mortal grade opens at ordinal zero.
 */
export function highestGradeRefinableAt(realmOrdinal: number): TechniqueGrade | null {
    let best: TechniqueGrade | null = null;
    // The table is written in listing order and `>=` keeps the LATER of two
    // grades that share a rung. That matters for exactly one pair: immortal and
    // chaos both ask for the True Immortal rung.
    //
    // THIS IS THE ONE PLACE A TOTAL ORDER IS FORCED ON A TIE, AND IT IS
    // DELIBERATE. The two grades are peers, so "the best grade this hand can
    // work" has two correct answers and this function's signature can return
    // only one. It returns chaos, on the reasoning that a hand which can work
    // either should be told about the harder object rather than the safer one.
    // Any caller that needs both must ask `canRefineGrade` per grade instead.
    for (const grade of Object.keys(REFINING_REALM_BY_GRADE) as TechniqueGrade[]) {
        if (!canRefineGrade(grade, realmOrdinal)) continue;
        if (best === null || refiningOrdinalFor(grade) >= refiningOrdinalFor(best)) best = grade;
    }
    return best;
}

/**
 * Why the cauldron will not take it, in words, or null where it will.
 */
export function whyTheCauldronRefuses(
    grade: TechniqueGrade,
    realmOrdinal: number
): string | null {
    if (canRefineGrade(grade, realmOrdinal)) return null;
    if (!madeBelowTheLid(grade)) {
        return `Nobody below the Lid refines ${grade}-grade medicine. The materials it wants `
            + 'do not occur on this side and no cultivator alive has hands that could hold them; '
            + 'every dose in the world was sent down by somebody who crossed, and stopped being '
            + 'made the day they stopped sending. One can still be found, bought with something '
            + 'other than money, inherited, or dug out of a sealed site. It cannot be refined.';
    }
    return `Working ${grade}-grade materials wants ${refiningRealmNameFor(grade)} or better. `
        + 'Below that the ingredients do not answer the hand holding them, and the cauldron '
        + 'takes the difference out of the alchemist.';
}
