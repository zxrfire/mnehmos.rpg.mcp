/**
 * What grade of medicine will close a given wound on a given body.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING THIS IMPLEMENTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's, in two axes: **the rarity of the medicine scales with
 * the severity of the injury and the realm of the injured.** Neither was in the
 * resolver. `treatWorstInjury` gated on `isPermanentWound` and nothing else, so
 * a Nascent Soul cultivator at ordinal 26 carrying CRIPPLING torn meridians
 * walked into a village, bought thirty days of mortal splints for fourteen
 * spirit stones, and was fully healed.
 *
 * The ladder it should have been reading was already written, in full, and
 * nothing consulted it: `pills.ts` grades the treat-injury line 60 -> 420 ->
 * 5,200 -> 42,000 -> 480,000 cash, and the Meridian Rebirth Pill's own
 * description says it is "the only medicine below immortal grade that touches
 * crippling damage". So this file adds no content and invents no threshold. It
 * reads what the catalog already says and returns the grade.
 *
 * ── The bottom of the ladder stays open, deliberately ────────────────────
 *
 * Untreated meridian injuries were the leading cause of death in this game -
 * eleven of eighteen sampled runs, median age at death 22 - and the whole of
 * that was the cure being invisible rather than absent. Making it visible moved
 * the median peak from rung 2 to rung 9 and the median age at death from 22 to
 * 100. NOTHING HERE MAY UNDO THAT. A minor tear at Qi Condensation is still an
 * afternoon and a handful of stones, which is what `severityFloor` says and
 * what the tests pin.
 *
 * What is gated is HEIGHT and SEVERITY, which is exactly what was asked for.
 *
 * ── Why `pillBandOrdinal` and not a table of my own ──────────────────────
 *
 * Because there is already one mapping from grade to the realm it belongs to,
 * `PILL_GRADE_REALM`, and a second one beside it is how two readers come to
 * disagree about the same fact. This project has had that twice today alone -
 * a second qi banding table and a second market slice - and both were found by
 * a player rather than by a test.
 */

import { pillBandOrdinal } from './breakthrough.js';
import type { InjurySeverity, TechniqueGrade } from '../../schema/cultivation.js';

/** Ascending, so a higher index is a rarer medicine. The catalog's own order. */
export const MEDICINE_GRADES: readonly TechniqueGrade[] =
    ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;

/** Where a grade sits on that ladder. -1 for anything not on it. */
export function medicineRank(grade: TechniqueGrade): number {
    return MEDICINE_GRADES.indexOf(grade);
}

/**
 * The floor set by how bad the wound is, independent of who is carrying it.
 *
 * `crippling` is heaven because the catalog says so in as many words, on the
 * Meridian Rebirth Pill: "the only medicine below immortal grade that touches
 * crippling damage". Minor and serious sit at the bottom because nothing in the
 * catalog says otherwise, and because the realm axis below does the lifting for
 * anybody far enough up to need it.
 *
 * Crippling is about six per cent of what `rollInjurySeverity` produces, so
 * this is a rare crisis rather than an ordinary tax - and a cultivator carrying
 * one can still clear the other two by ordinary means and stay under the lethal
 * count while they go and find what it costs.
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
 *
 * A larger body is not mended by a village splint, whatever is wrong with it.
 * Read off `pillBandOrdinal`, which is the existing grade-to-realm mapping, so
 * this moves if the bands move and cannot drift from them.
 */
export function realmFloor(realmOrdinal: number): TechniqueGrade {
    let floor: TechniqueGrade = 'mortal';
    for (const grade of MEDICINE_GRADES) {
        if (realmOrdinal >= pillBandOrdinal(grade)) floor = grade;
    }
    return floor;
}

/**
 * The grade that will actually close this wound on this body: the higher floor.
 *
 * Both axes, and the rarer of the two wins - a minor scratch on a Nascent Soul
 * needs what a Nascent Soul body needs, and a crippling tear on a novice needs
 * what crippling damage needs.
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
