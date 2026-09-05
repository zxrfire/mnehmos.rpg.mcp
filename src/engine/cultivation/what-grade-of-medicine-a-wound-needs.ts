/**
 * What grade of medicine will close a given wound on a given body.
 *
 * The design owner's, in two axes: *the rarity of the medicine scales with the
 * severity of the injury and the realm of the injured.* Neither was in the
 * resolver - `treatWorstInjury` gated on `isPermanentWound` and nothing else, so a
 * Nascent Soul at ordinal 26 carrying CRIPPLING torn meridians bought thirty days
 * of mortal splints for fourteen spirit stones and was fully healed.
 *
 * The ladder was already written and nothing consulted it: `pills.ts` grades the
 * treat-injury line 60 -> 420 -> 5,200 -> 42,000 -> 480,000 cash. This file adds
 * no content and invents no threshold; it reads the catalog and returns the grade.
 */

import { pillBandOrdinal } from './breakthrough.js';
import { gradeRank } from '../../data/cultivation/techniques.js';
import type { InjurySeverity, TechniqueGrade } from '../../schema/cultivation.js';

/** The grades, in listing order. Ranking goes through `gradeRank`, never this. */
export const MEDICINE_GRADES: readonly TechniqueGrade[] =
    ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;

/**
 * Where a grade sits on the medicine ladder.
 */
export function medicineRank(grade: TechniqueGrade): number {
    return gradeRank(grade);
}

/**
 * The floor set by how bad the wound is, independent of who is carrying it.
 */
export function severityFloor(severity: InjurySeverity): TechniqueGrade {
    switch (severity) {
        case 'crippling': return 'heaven';
        case 'serious': return 'mortal';
        case 'minor': return 'mortal';
    }
}

/**
 * The floor set by the body itself.
 */
export function realmFloor(realmOrdinal: number): TechniqueGrade {
    let floor: TechniqueGrade = 'mortal';
    for (const grade of MEDICINE_GRADES) {
        if (realmOrdinal < pillBandOrdinal(grade)) continue;
        // STRICTLY greater, so a tie keeps the EARLIER of two peer grades.
        // Immortal and chaos are peers pitched at the same band, so both reach
        // the wound and `medicineReaches` says so either way - but this value
        // is also the one quoted in a refusal, and the sentence a player is
        // sent away with should name the medicine that does what it says on
        // the tin rather than the one that might turn them into something.
        if (gradeRank(grade) > gradeRank(floor)) floor = grade;
    }
    return floor;
}

/**
 * The grade that will actually close this wound on this body: the higher floor.
 */
export function medicineNeededFor(
    severity: InjurySeverity,
    realmOrdinal: number
): TechniqueGrade {
    const bySeverity = severityFloor(severity);
    const byRealm = realmFloor(realmOrdinal);
    return medicineRank(byRealm) > medicineRank(bySeverity) ? byRealm : bySeverity;
}

/** Whether medicine of `grade` reaches a wound of `severity` on that body. */
export function medicineReaches(
    grade: TechniqueGrade,
    severity: InjurySeverity,
    realmOrdinal: number
): boolean {
    return medicineRank(grade) >= medicineRank(medicineNeededFor(severity, realmOrdinal));
}
