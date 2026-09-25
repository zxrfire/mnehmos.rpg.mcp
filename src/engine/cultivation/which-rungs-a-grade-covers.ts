/**
 * Which rungs a grade covers: the one table every grade is read from.
 *
 * Owner ruling 2026-09-25: one scale governs a technique's grade and a thing's.
 * Each grade covers a band of rungs; immortal and chaos are peers and open
 * together. The two ladders the owner ruled on earlier are columns of this same
 * table rather than tables of their own: the realm a hand must stand in to work
 * a grade (`items.md`, "Who is allowed to make it") and the realm a grade's
 * medicine is pitched at. They stay distinct on purpose - the maker stands
 * above the patient - and every reader of any of the three reads it here:
 *
 *   what a manual is for, a thing's grade from its rung   the band
 *   who can work a grade (`refiningOrdinalFor`)            `madeFrom`
 *   where a grade's pills pitch (`PILL_GRADE_REALM`)       `pitchedAt`
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { MAX_ORDINAL, REALM_TIERS, TRUE_IMMORTAL_ORDINAL, type RealmKey } from './realms.js';

interface AGrade {
    /** The realm the band opens at. */
    opens: RealmKey;
    /** The realm the band closes with; null is the top of the ladder. */
    closes: RealmKey | null;
    /** The realm a hand must stand in to work its materials; null is nobody below the Lid. */
    madeFrom: RealmKey | null;
    /** The realm its medicine is pitched at. */
    pitchedAt: RealmKey;
}

const THE_GRADES: Readonly<Record<TechniqueGrade, AGrade>> = {
    mortal: { opens: 'qi_condensation', closes: 'qi_condensation', madeFrom: 'qi_condensation', pitchedAt: 'foundation_establishment' },
    earth: { opens: 'foundation_establishment', closes: 'core_formation', madeFrom: 'core_formation', pitchedAt: 'core_formation' },
    heaven: { opens: 'nascent_soul', closes: 'deity_transformation', madeFrom: 'void_tribulation', pitchedAt: 'nascent_soul' },
    immortal: { opens: 'void_tribulation', closes: 'body_integration', madeFrom: null, pitchedAt: 'void_tribulation' },
    chaos: { opens: 'void_tribulation', closes: null, madeFrom: null, pitchedAt: 'void_tribulation' }
};

function tier(key: RealmKey) {
    const found = REALM_TIERS.find(t => t.key === key);
    // Unreachable while the table names real realms.
    if (!found) throw new Error(`No realm ${key}.`);
    return found;
}

const GRADES = Object.keys(THE_GRADES) as TechniqueGrade[];

/** The rungs each grade covers. Immortal and chaos overlap, because they are peers. */
export const GRADE_ORDINAL_BANDS: Readonly<Record<TechniqueGrade, { readonly min: number; readonly max: number }>> =
    Object.fromEntries(GRADES.map(grade => {
        const { opens, closes } = THE_GRADES[grade];
        return [grade, { min: tier(opens).ordinalStart, max: closes === null ? MAX_ORDINAL : tier(closes).ordinalEnd }];
    })) as Record<TechniqueGrade, { min: number; max: number }>;

/** The rung a hand must have reached to work a grade's materials. */
export function theRungAGradeIsMadeFrom(grade: TechniqueGrade): number {
    const from = THE_GRADES[grade].madeFrom;
    return from === null ? TRUE_IMMORTAL_ORDINAL : tier(from).ordinalStart;
}

/** The realm a grade's medicine is pitched at. */
export const PITCHED_AT: Readonly<Record<TechniqueGrade, RealmKey>> =
    Object.fromEntries(GRADES.map(grade => [grade, THE_GRADES[grade].pitchedAt])) as Record<TechniqueGrade, RealmKey>;
