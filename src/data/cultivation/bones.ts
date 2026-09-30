/**
 * Bones off a dead body, one row per grade: the material demonic arts are worked from.
 *
 * Owner ruling 2026-09-25: artifacts are made of beast or human parts, and demonic
 * cultivators craft from human bones. A body's grade is the dead person's rung read
 * through the one grade table (`gradeOfWhatABodyYields`), so one row per grade covers
 * every body there is. Its value is the median of what `herbs.ts` and `beasts.ts`
 * already price that grade at, so a bone is worth what its grade is worth and no
 * figure is typed here.
 */

import { TechniqueGradeSchema, type TechniqueGrade } from '../../schema/cultivation.js';
import { BEAST_MATERIALS } from './beasts.js';
import { HERBS } from './herbs.js';

export interface Bone {
    /** `material-bone-<grade>`, stable, so a notice or a recipe can name it. */
    id: string;
    name: string;
    grade: TechniqueGrade;
    /** Base market value in spirit stones, read off the two material catalogs. */
    value: number;
}

/** The id of the bone of a grade. */
export function boneItemId(grade: TechniqueGrade): string {
    return `material-bone-${grade}`;
}

const BONE_NAMES: Readonly<Record<TechniqueGrade, string>> = {
    mortal: 'Mortal Bone',
    earth: 'Earth Bone',
    heaven: 'Heaven Bone',
    immortal: 'Immortal Bone',
    chaos: 'Chaos Bone'
};

/** The lower median of the catalogued materials of a grade. */
function whatAGradeOfMaterialIsWorth(grade: TechniqueGrade): number {
    const values = [...HERBS, ...BEAST_MATERIALS]
        .filter(row => row.grade === grade)
        .map(row => row.value)
        .sort((a, b) => a - b);
    return values[Math.floor((values.length - 1) / 2)] ?? 1;
}

export const BONES: readonly Bone[] = TechniqueGradeSchema.options.map(grade => ({
    id: boneItemId(grade),
    name: BONE_NAMES[grade],
    grade,
    value: whatAGradeOfMaterialIsWorth(grade)
}));

const BONE_BY_ID: ReadonlyMap<string, Bone> = new Map(BONES.map(bone => [bone.id, bone]));

export function getBone(id: string): Bone | undefined {
    return BONE_BY_ID.get(id);
}
