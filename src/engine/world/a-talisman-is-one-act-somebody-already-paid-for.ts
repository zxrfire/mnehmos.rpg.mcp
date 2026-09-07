/**
 * A TALISMAN IS ONE ACT SOMEBODY ALREADY PAID FOR.
 *
 * A cultivator spends materials and their own strength to put a single act into
 * a slip of paper. Whoever burns it gets that act once, at the strength of the
 * hand that made it, and then there is no slip.
 *
 * ── WHY IT IS WORTH HAVING AT ALL ────────────────────────────────────────
 *
 * Because it breaks the one rule everything else in this engine obeys: what you
 * can do is what you are. A Qi Condensation disciple cannot throw a Core
 * Formation strike and cannot fold space at all - `FOLD_FLOOR_ORDINAL` is 29
 * and they are nowhere near it. Holding a talisman, they can do exactly one of
 * those things, exactly once, and then they are what they were.
 *
 * That is the shape that makes a weak character survive a strong one without
 * the engine lying about who is stronger, and it is why a house hands them out
 * before it sends anybody anywhere dangerous.
 *
 * ── AND IT IS AN OBJECT, WITH NO RULES OF ITS OWN ────────────────────────
 *
 * Grade decides how much record it deserves (`howMuchAGradeIsWorthTracking`),
 * which hand can make one (`canRefineGrade`), and whether any hand below the
 * Lid can (`madeBelowTheLid`) - the same three functions that already decide it
 * for medicine, furnaces and swords. Immortal talismans are sent down, found,
 * or nothing, like every other immortal thing.
 *
 * Single use is `tags: ['single-use']` and `data.spent`, the shape comprehension
 * materials already use, so a spent slip stays in the world as a row somebody
 * can find two centuries later.
 */

import {
    canRefineGrade,
    highestGradeRefinableAt,
    madeBelowTheLid
} from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { FOLD_FLOOR_ORDINAL, foldRangeInWalkingDays } from './how-far-somebody-can-fold-space-and-what-it-costs.js';
import {
    howMuchAGradeIsWorthTracking,
    makeObject,
    type ObjectRecord
} from './possessions.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

/**
 * What is folded into the paper.
 *
 * Two, because these are the two things a cornered cultivator wants and cannot
 * have: to hit harder than they are, or to not be here any more.
 */
export type WhatIsInTheSlip =
    /** One strike, at the strength of the hand that made it. */
    | 'a_strike'
    /** One fold, over ground the maker could have crossed. */
    | 'a_way_out';

/** The realm floor a talisman lifts somebody over, per use. */
export function whatItLetsYouDo(what: WhatIsInTheSlip): string {
    return what === 'a_strike'
        ? 'One strike lands at the strength that was folded in, whoever is holding it.'
        : 'One fold, once, by somebody who could not otherwise fold at all.';
}

/**
 * Whether this hand can cut a talisman of this grade.
 *
 * The medicine gate, unchanged. A hand that cannot work heaven-grade materials
 * into a pill cannot work them into paper either; the material is what refuses,
 * not the craft.
 */
export function couldCutATalisman(grade: TechniqueGrade, crafterOrdinal: number): boolean {
    return canRefineGrade(grade, crafterOrdinal);
}

/** The best slip this hand could cut, or null for a hand that can cut none. */
export function bestTalismanAHandCanCut(crafterOrdinal: number): TechniqueGrade | null {
    return highestGradeRefinableAt(crafterOrdinal);
}

/**
 * The rung folded into the paper, which is what the finished slip stands at.
 *
 * The MAKER's strength and not the burner's, which is the whole point of the
 * object: the act was paid for when it was cut, and holding one is holding
 * somebody else's arm for a moment.
 *
 * BOTH SLIPS STAND HERE, not only the strike. A finished thing has had a hand
 * applied to it and therefore has one answer to how strong it is - see the
 * grade-and-ordinal rule in `possessions.ts`. A way-out slip that was priced at
 * null read as an unfinished thing, and 91 of the 235 artifacts in a seeded
 * world were that one row.
 */
export function whatWasFoldedIn(crafterOrdinal: number): number {
    return Math.max(0, Math.floor(crafterOrdinal));
}

/**
 * How far a way-out talisman carries, in walking days.
 *
 * The maker's own reach, off the one folding table. A maker below the folding
 * floor cannot put a fold in paper they could not make themselves - so the
 * escape slips in the world all came from hands that could already leave.
 */
export function howFarTheWayOutCarries(crafterOrdinal: number): number {
    return crafterOrdinal < FOLD_FLOOR_ORDINAL ? 0 : foldRangeInWalkingDays(crafterOrdinal);
}

/** Whether this hand could put a fold in paper at all. */
export function couldCutAWayOut(crafterOrdinal: number): boolean {
    return crafterOrdinal >= FOLD_FLOOR_ORDINAL;
}

export interface CuttingATalisman {
    id: string;
    name: string;
    grade: TechniqueGrade;
    what: WhatIsInTheSlip;
    /** Who cut it. Null for one that came down or came out of a ruin. */
    crafterId: string | null;
    crafterName?: string;
    /** The maker's realm ordinal, which is what is folded in. */
    crafterOrdinal: number;
    onDay: number;
    ownerId?: string | null;
    ownerName?: string;
}

/**
 * Cut one.
 *
 * Refuses nothing: whether this hand may is `couldCutATalisman`, and a caller
 * that seeds a heaven-grade slip into a ruin has no crafter to check.
 */
export function cutATalisman(input: CuttingATalisman): ObjectRecord {
    const power = whatWasFoldedIn(input.crafterOrdinal);
    return makeObject({
        id: input.id,
        name: input.name,
        kind: 'artifact',
        significance: howMuchAGradeIsWorthTracking(input.grade),
        description: whatItLetsYouDo(input.what),
        power,
        ownerId: input.ownerId ?? null,
        ownerName: input.ownerName ?? '',
        // A slip of paper. Nothing in a ring is cheaper to carry.
        volume: WHAT_A_SLIP_TAKES,
        weight: WHAT_A_SLIP_WEIGHS,
        tags: ['talisman', 'single-use', input.what === 'a_strike' ? 'offensive' : 'escape'],
        data: {
            talisman: input.what,
            grade: input.grade,
            cutBy: input.crafterId,
            cutOnDay: input.onDay,
            // The rung folded in is the slip's own ordinal and is not repeated
            // here. It was, and a second copy of a number is a number that
            // drifts.
            ...(input.what === 'a_way_out'
                ? { carriesWalkingDays: howFarTheWayOutCarries(input.crafterOrdinal) }
                : {}),
            sentDown: madeBelowTheLid(input.grade) ? false : true
        }
    });
}

/** Litres. It is paper. */
export const WHAT_A_SLIP_TAKES = 0.05;
/** Kilos. It is paper. */
export const WHAT_A_SLIP_WEIGHS = 0.01;

/** A slip nobody has burned. */
export function isUnburnt(object: ObjectRecord): boolean {
    return object.tags.includes('talisman') && object.data?.spent !== true;
}

/**
 * Burn one, which is the only thing you can do with it.
 *
 * The row stays. A spent slip is how anybody ever learns that this house armed
 * that disciple, and that the disciple used it.
 */
export function burnIt(object: ObjectRecord, byId: string, onDay: number): ObjectRecord {
    return {
        ...object,
        possessorId: null,
        power: null,
        tags: [...object.tags, 'spent'],
        data: { ...object.data, spent: true, spentBy: byId, spentOnDay: onDay }
    };
}

// ═════════════════════════════════════════════════════════════════════════
// AND THE ONE ACT, TAKEN
// ═════════════════════════════════════════════════════════════════════════

/**
 * WHO WALKED OUT OF A KILLING BECAUSE THEY WERE CARRYING A DOOR.
 *
 * The whole point of the object, and until this it had none: a slip that can
 * never be burned is a row in a treasury. This is the moment it is for - a
 * cultivator about to be finished, holding a fold somebody else paid for, using
 * it once and being somewhere else.
 *
 * It breaks the rule everything in this engine obeys, that what you can do is
 * what you are, exactly once and then it is paper. `FOLD_FLOOR_ORDINAL` is 29
 * and most of the people this saves are nowhere near it.
 *
 * ONLY THE DEAD ARE OFFERED IT. Somebody who is going to survive the exchange
 * does not spend a heaven-grade slip on it, and a caller that asked this about
 * everybody present would empty the world's paper in one war.
 *
 * The slip is burned whether or not anybody ever hears about it, and the spent
 * row stays: that this person had one, and used it here, is exactly the kind of
 * thing somebody should be able to find out two centuries later.
 */
export function whoBurnedAWayOut(input: {
    /** Every object the world holds. Mutated in place for the ones burned. */
    objects: ObjectRecord[];
    /** Ids of the people who are about to be finished. */
    aboutToFall: readonly string[];
    onDay: number;
}): string[] {
    const walkedOut: string[] = [];
    for (const who of input.aboutToFall) {
        const at = input.objects.findIndex(o =>
            o.possessorId === who
            && o.tags.includes('escape')
            && isUnburnt(o)
            && Number(o.data?.carriesWalkingDays ?? 0) > 0);
        if (at < 0) continue;
        const slip = input.objects[at];
        if (slip === undefined) continue;
        input.objects[at] = burnIt(slip, who, input.onDay);
        walkedOut.push(who);
    }
    return walkedOut;
}
