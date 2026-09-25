/**
 * A cultivator's body is material, and its grade is the body's own standing.
 *
 * The design owner's statement - *a Void Tribulation cultivator's core is
 * heaven-grade material* - needs no arithmetic here, because the ladder it names
 * is the ladder already in the file.
 *
 * Old remains are unremarkable; FRESH is a question, and it is arithmetic
 * anybody can do rather than a flag on the object. There is no `isStolen` field
 * and there must not be one: what this produces instead is rightly suspected and
 * unprovable, wrongly suspected, and unsuspected.
 *
 * A GAP, NOT A RULING: nothing in play takes material off a dead cultivator
 * yet. The one caller is the beast harvest, which asks this for a dead beast.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { highestGradeRefinableAt } from './who-can-refine-a-grade-of-medicine.js';

// WHAT A BODY IS WORTH AS MATERIAL

/**
 * The grade of what a body at this rung yields, or null when it yields nothing
 * anybody can work.
 */
export function gradeOfWhatABodyYields(realmOrdinal: number): TechniqueGrade | null {
    return highestGradeRefinableAt(realmOrdinal);
}
