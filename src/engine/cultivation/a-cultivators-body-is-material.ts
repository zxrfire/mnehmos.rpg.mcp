/**
 * A cultivator's body is material, and its grade is the body's own standing.
 *
 * The design owner's statement - *a Void Refinement cultivator's core is
 * heaven-grade material* - needs no arithmetic here, because the ladder it names
 * is the ladder already in the file.
 *
 * Old remains are unremarkable; FRESH is a question, and it is arithmetic
 * anybody can do rather than a flag on the object. There is no `isStolen` field
 * and there must not be one: what this produces instead is rightly suspected and
 * unprovable, wrongly suspected, and unsuspected.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { canRefineGrade, highestGradeRefinableAt } from './who-can-refine-a-grade-of-medicine.js';

// WHAT A BODY IS WORTH AS MATERIAL

/**
 * The grade of what a body at this rung yields, or null when it yields nothing
 * anybody can work.
 */
export function gradeOfWhatABodyYields(realmOrdinal: number): TechniqueGrade | null {
    return highestGradeRefinableAt(realmOrdinal);
}

/**
 * One thing taken off one body.
 */
export interface Harvest {
/**
 * What was taken, as a word. DATA. There is no list of body parts and there must
 * not be one - a `part` is carried through untouched and never read, exactly as
 * `what-a-deed-leaves.ts` carries a cause. A twenty-fourth harvestable thing is
 * a new string in a caller and no code anywhere.
 */
    part: string;
    grade: TechniqueGrade;
    /** Whose it was. The whole of what makes this different from a herb. */
    fromId: string;
    fromName: string;
    /** The rung they stood at, kept so the grade can be checked rather than trusted. */
    fromOrdinal: number;
    onDay: number;
    /** Who took it. */
    byId: string;
}

/** What one body yields, or null when it yields nothing workable. */
export function harvestFrom(input: {
    part: string;
    fromId: string;
    fromName: string;
    fromOrdinal: number;
    byId: string;
    onDay: number;
}): Harvest | null {
    const grade = gradeOfWhatABodyYields(input.fromOrdinal);
    if (grade === null) return null;
    return {
        part: input.part,
        grade,
        fromId: input.fromId,
        fromName: input.fromName,
        fromOrdinal: input.fromOrdinal,
        onDay: input.onDay,
        byId: input.byId
    };
}

/**
 * Whether the holder can do anything with it themselves.
 */
export function couldUseItThemselves(harvest: Harvest, holderOrdinal: number): boolean {
    return canRefineGrade(harvest.grade, holderOrdinal);
}

/**
 * What carrying it says about the person carrying it, in plain words.
 */
export function whatHoldingItSays(harvest: Harvest): string {
    return `${harvest.grade} grade, off ${harvest.fromName}, who stood at ordinal `
        + `${harvest.fromOrdinal}. Anybody who could work it can read all of that off it, and `
        + 'anybody who knew them can read the rest.';
}

/**
 * How much of somebody a harvest cost them, for the deed layer.
 */
export const WHAT_A_HARVEST_COSTS_THE_BODY = 1;
