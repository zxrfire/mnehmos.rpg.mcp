/**
 * THE VESSEL SOMEBODY WORKS AT: which cauldron or refining furnace a pair of
 * hands actually has, read off what they are carrying.
 *
 * `what-you-refine-in.ts` says what a vessel of a grade is WORTH. Nothing said
 * which one anybody was holding, so every refinement and every forging in the
 * world was worked at the clay pot, whatever the house had lent them.
 *
 * ONE READ FOR EVERYBODY. A player and a person of the world are asked the same
 * question of the same table: which rows they are carrying (`possessorId`), of
 * the vessel's kind, not ruined. A furnace a house lent them is carried by them
 * and is therefore theirs to work at, which is what a loan is for; whose it is
 * stays `ownerId`'s question and is not asked here.
 *
 * THE BEST IS THE ONE THAT ADDS MOST FOR THIS HAND, not the dearest. A
 * heaven-grade cauldron in hands below its rung does not answer
 * (`whatThisVesselAddsFor`), so somebody holding it and an earth-grade one works
 * at the earth-grade one.
 */

import { TechniqueGradeSchema, type TechniqueGrade } from '../../schema/cultivation.js';
import {
    REFINING_VESSELS,
    whatThisVesselAddsFor,
    type RefiningVesselKind
} from '../cultivation/what-you-refine-in.js';
import { refiningOrdinalFor } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { isRuined, type ObjectRecord } from './possessions.js';
import { isBroken } from './object-damage.js';
import { BROKEN_THING_WORKS_AT } from '../cultivation/whether-a-weapon-survives-being-used.js';

/** A vessel somebody has to hand, and what it adds for them. */
export interface AVesselToHand {
    objectId: string;
    name: string;
    kind: RefiningVesselKind;
    grade: TechniqueGrade;
    /** What it adds to the chance for this hand. Zero where it does not answer. */
    adds: number;
}

/**
 * The grade a vessel row is made at.
 *
 * `data.grade` where the row carries one, then a `grade:` tag, and otherwise
 * mortal: a counted lot of clay pots is written with neither, and a clay pot is
 * the mortal grade by what it is.
 */
export function gradeOfAVessel(row: Pick<ObjectRecord, 'data' | 'tags'>): TechniqueGrade {
    const fromData = TechniqueGradeSchema.safeParse(row.data?.grade);
    if (fromData.success) return fromData.data;
    const tag = row.tags.find(t => t.startsWith('grade:'));
    const fromTag = TechniqueGradeSchema.safeParse(tag?.slice('grade:'.length));
    return fromTag.success ? fromTag.data : 'mortal';
}

/** Whether a row is a vessel of this kind. */
export function isAVesselOf(row: Pick<ObjectRecord, 'tags'>, kind: RefiningVesselKind): boolean {
    return row.tags.includes(REFINING_VESSELS[kind].tag);
}

/** Every unruined vessel of this kind this person is carrying. */
export function theVesselsTheyCarry(
    objects: readonly ObjectRecord[],
    personId: string,
    kind: RefiningVesselKind
): ObjectRecord[] {
    return objects.filter(row => row.possessorId === personId && isAVesselOf(row, kind) && !isRuined(row));
}

/**
 * The best vessel of this kind this person has to hand, or null where they are
 * carrying none and work at whatever the room has.
 *
 * Most added first; between two that add the same, the higher grade, then the
 * id, so the answer does not move with the order rows were written in.
 */
export function theBestVesselToHand(
    objects: readonly ObjectRecord[],
    personId: string,
    kind: RefiningVesselKind,
    ordinal: number
): AVesselToHand | null {
    let best: AVesselToHand | null = null;
    for (const row of theVesselsTheyCarry(objects, personId, kind)) {
        const grade = gradeOfAVessel(row);
        const one: AVesselToHand = {
            objectId: row.id,
            name: row.name,
            kind,
            grade,
            // A broken vessel keeps its grade and adds half of what it would.
            adds: whatThisVesselAddsFor(kind, grade, ordinal) * (isBroken(row) ? BROKEN_THING_WORKS_AT : 1)
        };
        if (best === null
            || one.adds > best.adds
            || (one.adds === best.adds && refiningOrdinalFor(one.grade) > refiningOrdinalFor(best.grade))
            || (one.adds === best.adds && one.grade === best.grade && one.objectId < best.objectId)) {
            best = one;
        }
    }
    return best;
}
