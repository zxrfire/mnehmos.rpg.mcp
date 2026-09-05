/**
 * WHAT SEX SOMEBODY IS, AND THE ONE QUESTION IT ANSWERS.
 *
 * The ruling: *"people need sex so they can have marriages. (No gender please, I
 * don't want to get into that in this game. Just 'sex' please.)"*
 *
 * So it is a plain field whose whole purpose is that a child can have two
 * parents, which is what `bloodlineTierForChild` needs to read.
 *
 * IT HAS NO AUTHORITY OVER WHO MAY MATCH WITH WHOM, and that half is enforced
 * rather than promised: neither this type nor this word appears anywhere in
 * `src/engine/household/`, and two tests hold it - a swap test that runs a match
 * both ways round, and a scan of every identifier and string literal in that
 * directory against a gendered vocabulary that fails on a single occurrence. No
 * gender or orientation model, nothing that decides who proposes, nothing about
 * surnames (an immortal lineage's surname passes regardless of which parent
 * carries it), and no branch on it in combat, cultivation, standing or price.
 *
 * The only consumer is {@link canBeTheTwoParentsOf}, and it answers `false`
 * rather than refusing: nothing here refuses anybody anything.
 */

import { z } from 'zod';

/**
 * The field. Two values, and there is no third because there is no question a
 * third would answer - see the header: this exists so a child can have two
 * parents.
 */
export const SexSchema = z.enum(['female', 'male']);
export type Sex = z.infer<typeof SexSchema>;

export const SEXES: readonly Sex[] = SexSchema.options;

/**
 * What a row written before this axis existed reads as.
 */
export const SEX_A_LEGACY_ROW_READS_AS: Sex = 'female';

/**
 * Roll a sex from a uniform [0,1) sample.
 */
export function rollSex(sample: number): Sex {
    return sample < 0.5 ? 'female' : 'male';
}

/** Whether a stored value is one this build knows. */
export function isSex(value: unknown): value is Sex {
    return value === 'male' || value === 'female';
}

/**
 * Whether a child could be of both these people's blood.
 */
export function canBeTheTwoParentsOf(one: Sex, other: Sex): boolean {
    return one !== other;
}
