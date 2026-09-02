/**
 * WHAT SEX SOMEBODY IS, AND THE ONE QUESTION IT ANSWERS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING, AND IT IS DELIBERATELY SMALL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   > "people need sex so they can have marriages. (No gender please, I don't
 *   >  want to get into that in this game. Just 'sex' please.)"
 *
 * So this is a plain field on a person and its whole purpose is that **a child
 * can have two parents**, which is what `bloodlineTierForChild` needs in order
 * to have anything to read. Reproduction and lineage need one; nothing else in
 * this repository does.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT IS NOT, AND THIS HALF IS ENFORCED RATHER THAN PROMISED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **It has no authority over who may match with whom.** A match in this world
 * is open in every direction: `src/engine/household/` builds one type for both
 * sides, and two tests hold it - a swap test that runs a match both ways round,
 * and a scan of every identifier and string literal in that directory against a
 * gendered vocabulary that fails on a single occurrence. Neither this type nor
 * this word appears anywhere in that directory, and that is the check: if `sex`
 * ever reaches the household layer, it has reached somewhere it should not.
 *
 * Concretely, and each of these is a thing that would be wrong to build here:
 *
 *   - no gender model, no orientation model, and no rule that reads either;
 *   - nothing that decides who proposes, who is asked, or whose house answers -
 *     those are positions in a call, not properties of a person;
 *   - nothing about surnames. **An immortal lineage's surname passes to the
 *     children regardless of which parent carries it**, that rule already
 *     exists, and a field that quietly re-decided it would contradict it;
 *   - no ranking, no modifier, no attribute, and no branch on it anywhere in
 *     combat, cultivation, standing or price.
 *
 * The only consumer is {@link canBeTheTwoParentsOf}, and the only thing it
 * answers is whether a child is of both their blood.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE PARENTAGE QUESTION IS WORTH ASKING AT ALL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Because a child of a match may not be of both parties, and this world already
 * has the other roads: `spending-a-word-to-place-a-child.ts` places a child with
 * somebody, `a-favour-skips-the-admission-bar.ts` prices what that costs, and
 * `birth.ts` reads `intakeRouteOf` for whose roll a person is on. A child who
 * came by one of those routes carries no line from the household that raised
 * them, and saying so is the whole reason the engine needs this fact.
 *
 * That is also why the answer is `false` rather than a refusal: **nothing here
 * refuses anybody anything.** Two people who cannot have a child between them
 * marry, hold a household, raise somebody, and are answered honestly about
 * whose blood that person carries.
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
 *
 * Arbitrary, and legibly arbitrary: there is no honest majority for a coin
 * flip, unlike `origin`'s `thin_county`, which really is what almost everybody
 * was. Every row written since carries a rolled value, so this reaches nothing
 * but the storage default and the parse of a legacy row.
 */
export const SEX_A_LEGACY_ROW_READS_AS: Sex = 'female';

/**
 * Roll a sex from a uniform [0,1) sample.
 *
 * Takes the sample rather than an RNG, matching `rollOrigin` and
 * `rollSpiritRoot`: the caller owns seeding, always. **Give it its own named
 * stream** - a draw added to an existing stream shifts every later draw off it,
 * which is a regression until proved otherwise.
 *
 * Even, and it stays even. A weight here would be a statement about the world
 * that nobody has made and that nothing would read.
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
 *
 * The one reader, and the whole of what the field is for. It is a question
 * about **parentage**, asked after two people already have a household -
 * never before, and never as a condition on having one.
 */
export function canBeTheTwoParentsOf(one: Sex, other: Sex): boolean {
    return one !== other;
}
