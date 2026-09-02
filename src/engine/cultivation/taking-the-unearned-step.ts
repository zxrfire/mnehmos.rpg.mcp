/**
 * The one crossing that is given rather than made.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS HERE RATHER THAN IN THE CATALOG ───────
 *
 * `immortal-items.ts` has described The Unearned Step in full since it was
 * written - what it does, what a grade caps, what it costs socially, and what
 * it leaves behind - and its own `ENGINE_GAPS` entry says plainly that nothing
 * implements it: *"There is no `PillEffect` for advancing a rank. [...] What is
 * missing is the effect, not room for it."* Measured: `promote_realm` has zero
 * consumers in `src/` outside the catalog that declares it and one test that
 * reads the catalog. `AGENTS.md` calls that shape by name - a module nothing
 * calls is not a feature - and this is its smaller sibling, an EFFECT nothing
 * can apply.
 *
 * It matters now because of what the Step is FOR. The design owner's ruling:
 *
 *   > don't forget that crossing deals damage too (unless via admin panel) or
 *   > the immortal pill that lets you skip a ordinal - that's the diff between
 *   > the immortal pill and the ones that give you qi, the qi ones you still
 *   > have to cross and risk it.
 *
 * So the Step is the exemption that gives the crossing toll its meaning. A qi
 * pill hands you accumulation and you still have to strike the wall, roll it,
 * and pay `bodyCost` for arriving. The Step hands you the far side. With the
 * toll built and the Step unbuildable, the toll would have had an exemption
 * list with nothing on it, and the distinction the owner is drawing would exist
 * only in a document.
 *
 * ── WHAT IS DECIDED HERE AND WHAT IS NOT ─────────────────────────────────
 *
 * Every rule below is quoted from the catalog's own `contract`, not invented:
 * one boundary, never a within-realm rung, never two; grade caps the
 * DESTINATION rather than the distance; 41 and above is a hard stop for
 * everybody by any route; once per cultivator for life; and taking it below
 * Perfection still crosses, with the skipped accumulation landing as a
 * permanently poor foundation.
 *
 * What is deliberately NOT decided here is the Price of Advancement. The
 * catalog's own note ends: *"The remaining engine decision is what the Price of
 * Advancement does about a boundary crossed without accumulation. Content has
 * answered the social half [...] and deliberately not the arithmetic."* A
 * crossing taken this way never reaches `evaluateToll`, because it never
 * reaches `attemptBreakthrough` at all, and that is the honest state of it
 * rather than a ruling. Leaving it open is the point: it is the design owner's
 * to settle, and the alternative is this file quietly settling it.
 *
 * Pure. State in, a verdict out, no mutation and no I/O. The caller writes.
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
 *
 * Straight off the catalog's `grades` prose, which states the top crossing each
 * one enables: lower 24 to 25, middle 28 to 29, higher 36 to 37. Expressed as
 * the realm rather than as the ordinal, because that is how the catalog states
 * it and because a realm survives the ladder being re-cut.
 */
export const STEP_CEILING_BY_GRADE: Readonly<Record<ImmortalGrade, RealmKey>> = {
    lower: 'deity_transformation',
    middle: 'void_refinement',
    higher: 'grand_ascension'
};

/**
 * The rung nothing may deliver anybody to, by any route, ever.
 *
 * `THE_LAST_REALM_IS_UNBUYABLE` in the catalog: *"No object, at any grade, from
 * any source, in any circumstance, delivers anybody to ordinal 41 or above.
 * Tribulation Transcendence is walked to or it is not reached."* A hard stop
 * rather than a modifier, which is why it is checked separately from the grade
 * ceiling instead of being folded into it.
 */
export const NOTHING_IS_GIVEN_AT_OR_ABOVE = 41;

/**
 * What the far side of a given crossing is worth to stand on.
 *
 * The catalog: *"Taken below Perfection it still crosses, and the skipped
 * accumulation lands as a permanently poor `foundationQuality` on the far
 * side."*
 *
 * `incomplete` rather than a new band, and it is the schema's own words that
 * decide it: *"rushed; part of the structure was never formed"*. That is the
 * catalog's sentence from the other side - the accumulation was skipped rather
 * than completed - and the social half of the catalog's answer, *they stall,
 * visibly, for the rest of a much longer life*, is a description of somebody
 * standing on one. Adding a tenth band for this would be a parallel catalog for
 * an important thing, which `AGENTS.md` forbids by name.
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
     *
     * Null when the crossing did not lay one to begin with - the caller
     * persists a foundation the way it persists any other, and
     * `persistFoundation` refuses to overwrite an existing one.
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
 *
 * `alreadyTaken` is the caller's, read off whatever it keeps the once-per-life
 * record on. It is an input rather than something this derives, because
 * `ONCE_IN_A_LIFE` is a fact about a whole life and this function sees one
 * moment of it.
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
