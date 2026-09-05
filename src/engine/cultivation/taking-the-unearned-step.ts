/**
 * The one crossing that is given rather than made.
 *
 * `immortal-items.ts` has described The Unearned Step in full since it was
 * written and its own `ENGINE_GAPS` entry says plainly that nothing implements
 * it: *"There is no `PillEffect` for advancing a rank. [...] What is missing is
 * the effect, not room for it."* Measured, `promote_realm` has zero consumers in
 * `src/` outside the catalog that declares it.
 *
 * What is deliberately NOT decided here is the Price of Advancement. A crossing
 * taken this way never reaches `evaluateToll`, because it never reaches
 * `attemptBreakthrough` at all. Leaving it open is the point - it is the design
 * owner's to settle, and the alternative is this file quietly settling it.
 */

import {
    MAX_ORDINAL,
    REALM_TIERS,
    isRealmBoundary,
    rankName,
    realmForOrdinal,
    type RealmKey
} from './realms.js';
import type { FoundationQuality } from '../../schema/cultivation.js';
import type { ImmortalGrade } from '../../data/cultivation/immortal-items.js';

/**
 * The highest realm each grade may deliver somebody INTO.
 */
export const STEP_CEILING_BY_GRADE: Readonly<Record<ImmortalGrade, RealmKey>> = {
    lower: 'deity_transformation',
    middle: 'void_refinement',
    higher: 'grand_ascension'
};

/**
 * The rung nothing may deliver anybody to, by any route, ever.
 */
export const NOTHING_IS_GIVEN_AT_OR_ABOVE = 41;

/**
 * What the far side of a given crossing is worth to stand on.
 */
export const FOUNDATION_A_GIVEN_CROSSING_LEAVES: FoundationQuality = 'incomplete';

export type StepRefusal =
    /** They have spent their one, whenever that was and whatever it bought. */
    | 'already_taken'
    /** Where they stand is not a wall. The Step crosses a boundary or nothing. */
    | 'not_at_a_boundary'
    /** This grade does not reach the realm on the far side of that wall. */
    | 'above_the_grade'
    /** Nothing given reaches 41. Not a modifier and not negotiable. */
    | 'above_what_is_ever_given';

export interface StepVerdict {
    taken: boolean;
    refusal: StepRefusal | null;
    fromOrdinal: number;
    /** Where they end up. Equal to `fromOrdinal` on every refusal. */
    toOrdinal: number;
    /**
     * The foundation the far side leaves, or null where it leaves none.
     */
    foundationQuality: FoundationQuality | null;
    /** Engine-authored, factual. Never narration. */
    line: string;
}

/** Whether an ordinal is the top rung of its realm. The clean case, not a bar. */
export function atPerfectionOfTheirRealm(ordinal: number): boolean {
    const tier = REALM_TIERS.find(t => t.key === realmForOrdinal(ordinal).key);
    return tier !== undefined && ordinal === tier.ordinalEnd;
}

/**
 * Spend one Unearned Step, and say what it did.
 */
export function takeTheUnearnedStep(input: {
    fromOrdinal: number;
    grade: ImmortalGrade;
    alreadyTaken: boolean;
}): StepVerdict {
    const { fromOrdinal, grade } = input;
    const stay = (refusal: StepRefusal, line: string): StepVerdict => ({
        taken: false,
        refusal,
        fromOrdinal,
        toOrdinal: fromOrdinal,
        foundationQuality: null,
        line
    });

    if (input.alreadyTaken) {
        // "A second one of either does nothing at all to somebody who has
        // already taken one - it is simply consumed against a body that will
        // not take it twice." Consumed, which is the caller's business; what
        // this says is that nothing happened.
        return stay(
            'already_taken',
            'This body has been carried across once already and will not be carried again. The '
            + 'pill is spent against it and nothing moves.'
        );
    }

    if (!isRealmBoundary(fromOrdinal)) {
        // "It never grants a within-realm rung." The one refusal that is about
        // where somebody is standing rather than about what they are holding,
        // and the one that names a route: walk to the wall and take it there.
        return stay(
            'not_at_a_boundary',
            `${rankName(fromOrdinal)} is not a wall. The Step carries somebody across a realm `
            + 'boundary and does nothing else at all, so it is worth nothing from here and worth '
            + `everything from ${rankName(topOfTheRealmAt(fromOrdinal))}.`
        );
    }

    const toOrdinal = fromOrdinal + 1;

    if (toOrdinal >= NOTHING_IS_GIVEN_AT_OR_ABOVE) {
        return stay(
            'above_what_is_ever_given',
            `Nothing delivers anybody to ${rankName(toOrdinal)}. Not this, not a higher grade of `
            + 'this, and not anything else that has ever been made or sent down. The last realm is '
            + 'walked to.'
        );
    }

    const ceiling = STEP_CEILING_BY_GRADE[grade];
    const arriving = realmForOrdinal(toOrdinal);
    if (!withinCeiling(arriving.key, ceiling)) {
        return stay(
            'above_the_grade',
            `A ${grade} Step delivers nobody past ${realmName(ceiling)}, and the far side of this `
            + `wall is ${realmName(arriving.key)}. The grade caps where it can put somebody, not `
            + 'how far it carries them, so a better one would do this and this one never will.'
        );
    }

    const clean = atPerfectionOfTheirRealm(fromOrdinal);
    return {
        taken: true,
        refusal: null,
        fromOrdinal,
        toOrdinal,
        // Below Perfection the accumulation that was skipped is the thing the
        // far side is missing, and it is permanent. At Perfection there was
        // nothing left to skip, so nothing is left behind.
        foundationQuality: clean ? null : FOUNDATION_A_GIVEN_CROSSING_LEAVES,
        line:
            `${rankName(fromOrdinal)} to ${rankName(toOrdinal)}, without an attempt and without a `
            + 'roll. Nothing was struck, nothing was risked, and the body arrives on the far side '
            + 'of a wall it never met. '
            + (clean
                ? 'It was taken from Perfection, which is where it is worth the most: there was '
                  + 'nothing left to accumulate, so nothing was skipped.'
                : 'It was taken short of Perfection, so the accumulation that would have gone into '
                  + 'the crossing was never made, and it does not get made later. What is under '
                  + 'them now is what they will be standing on for the rest of a very long life.')
    };
}

/** The top rung of the realm somebody is standing in, which is their wall. */
function topOfTheRealmAt(ordinal: number): number {
    const tier = REALM_TIERS.find(t => t.key === realmForOrdinal(ordinal).key);
    return tier ? Math.min(MAX_ORDINAL, tier.ordinalEnd) : ordinal;
}

/** Whether `arriving` is at or below `ceiling` in the ladder's own order. */
function withinCeiling(arriving: RealmKey, ceiling: RealmKey): boolean {
    const index = (key: RealmKey) => REALM_TIERS.findIndex(t => t.key === key);
    return index(arriving) <= index(ceiling);
}

function realmName(key: RealmKey): string {
    return REALM_TIERS.find(t => t.key === key)?.name ?? key;
}
