/**
 * What the person you just wronged does about it, there and then. The design
 * owner's ruling is the whole specification: *"your bad things are noticed and
 * you get a verbal warning at minimum, or heavily injured maybe dead depending
 * on his alignment."*
 *
 * Measured before this existed: a cultivator threatened and robbed a Void
 * Refinement stranger, both landed, and the only thing either left behind was a
 * social tie - the record this engine writes for people who are getting ON.
 * Coercion and theft were registering as relationship-building.
 *
 * TWO QUESTIONS ALLOWED TO DISAGREE. {@link whatTheyCanDoAboutIt} is the power
 * gap, {@link howFarTheyWouldGo} is the alignment, and the answer is the LESSER
 * of the two, floored at a warning. Neither extreme is a special case.
 *
 * A NULL ALIGNMENT IS NEUTRAL, on the owner's ruling *"by default its rogue
 * neutral"*. Do not give it a gentler branch: being house-less changes who
 * answers for it afterwards, which is another file's question.
 *
 * Pure lookup. Nothing here reads a faction name, which is AGENTS.md's test for
 * whether a piece of lore is a system.
 */

import type { InjurySeverity, SectAlignment } from '../../schema/cultivation.js';
import type { GrudgeCause, Severity } from '../social/grudges.js';
import { SEVERITY_ORDER } from '../social/grudges.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';

/**
 * The deed, at the level of description a grudge can be written from. NEVER the
 * player's verb - nothing downstream may branch on what somebody typed.
 *
 * This is the vocabulary of wrongs the world can PRICE, not the list of things a
 * player may DO: `WRONG_BEHIND_INTENT` in `web/game.ts` is the closed table
 * mapping parsed intents onto these, and an intent absent from it produces no
 * reprisal at all.
 */
export type Wrong =
    /** Force offered as the reason to comply. Cannot be done quietly. */
    | 'threatened'
    /** Their property, taken or tried for. */
    | 'robbed'
    /** A lie told to move them. */
    | 'deceived'
    /** Answers taken under pressure. */
    | 'interrogated'
    /**
     * A wound, done on purpose. ONE ROW FOR THE WHOLE OF `wounds.ts`, on the
     * owner's ruling *"look at the possible injuries as things someone could do
     * to you."* That table already carries the axis: `permanent` is exactly
     * whether it can be given back. Do not build a second table of harms. Pass
     * the wound key to {@link shapeOf}.
     */
    | 'wounded'
    /**
     * A grave wrong done to their person. `grudges.ts`'s own row and wording.
     * Here because the ledger must be able to record what this world contains;
     * it is not a thing the parser offers.
     */
    | 'violated'
    /**
     * Somebody reached into a crossing: the worst non-fatal thing in the setting,
     * because the price is paid, the tribulation cannot be aborted, and the
     * cultivator is maximally exposed and unable to answer. Deniable in a way a
     * severed arm is not - crossings fail on their own. See
     * {@link TheShapeOfAWrong.theyMayNeverBeCertain}.
     */
    | 'interfered_with_a_crossing'
    /** They are dead, and the record has to go somewhere else. */
    | 'killed';

/**
 * Facts about a wrong, and NOT a severity number. The design owner's correction:
 * cutting an arm off is worse than robbery not because it deserves a bigger
 * figure but because THE SET OF WAYS THE ACCOUNT CAN CLOSE IS SMALLER. A severed
 * arm does not come back, so `repaid` and `compensated` are unavailable.
 *
 * Murder could not be expressed as a weight at all: the person it was done to
 * holds nothing, because there is nobody there to hold it. The ordering falls
 * out of the facts, so nobody had to choose a number.
 */
export interface TheShapeOfAWrong {
    /** Force was on the table rather than words. Cannot be done quietly. */
    force: boolean;
    /** Something was actually taken out of them, not merely offered for. */
    somethingWasTaken: boolean;
    /** It can come back. `repaid` and `compensated` are available discharges. */
    canBeGivenBack: boolean;
    theySurviveToHoldIt: boolean;
    /**
     * The thing happens on its own often enough that they cannot be sure. READ:
     * an uncertain party is capped at a warning and writes a `fromBelief` record,
     * which `proven_false` can discharge. Not a discount - a feud founded on a
     * suspicion still kills people until somebody proves it.
     */
    theyMayNeverBeCertain: boolean;
    /** The ledger's own word for it. Data, carried and never branched on. */
    cause: GrudgeCause;
}

const SHAPE_OF: Readonly<Record<Wrong, TheShapeOfAWrong>> = Object.freeze({
    deceived: {
        force: false, somethingWasTaken: false, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'betrayal'
    },
    interrogated: {
        force: false, somethingWasTaken: false, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'humiliation'
    },
    threatened: {
        // Nothing taken until it is made good on; force, because it cannot be
        // done quietly.
        force: true, somethingWasTaken: false, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'humiliation'
    },
    robbed: {
        force: false, somethingWasTaken: true, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'robbery'
    },
    wounded: {
        // The DEFAULT for a wound with no key. Pass the key to `shapeOf` and
        // `permanent` decides `canBeGivenBack`.
        force: true, somethingWasTaken: true, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'injury'
    },
    violated: {
        force: true, somethingWasTaken: true, canBeGivenBack: false,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'violated'
    },
    interfered_with_a_crossing: {
        force: true, somethingWasTaken: true, canBeGivenBack: false,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: true,
        cause: 'blocked_advancement'
    },
    killed: {
        force: true, somethingWasTaken: true, canBeGivenBack: false,
        // The one row where this is false.
        theySurviveToHoldIt: false, theyMayNeverBeCertain: false, cause: 'killed_kin'
    }
});

/**
 * The shape of one wrong. The single place `wounds.ts` is consulted, and the
 * only thing taken from it is `permanent`.
 */
export function shapeOf(wrong: Wrong, woundKey?: string | null): TheShapeOfAWrong {
    const base = SHAPE_OF[wrong];
    if (wrong !== 'wounded') return base;
    return { ...base, canBeGivenBack: !isPermanentWound(woundKey) };
}

export type WhoHoldsIt =
    | 'the person it was done to'
    /** Their house, their kin, whoever cared. They were not party to it. */
    | 'whoever was theirs';

export function whoEndsUpHoldingIt(wrong: Wrong): WhoHoldsIt {
    return SHAPE_OF[wrong].theySurviveToHoldIt
        ? 'the person it was done to'
        : 'whoever was theirs';
}

/**
 * The two fields a caller hands straight to `what-a-deed-leaves.ts`, named for
 * the fields they fill so the wiring cannot be got backwards.
 */
export function howToWriteTheDeed(wrong: Wrong, woundKey?: string | null): {
    irreversible: boolean;
    principalCannotHoldIt: boolean;
} {
    const shape = shapeOf(wrong, woundKey);
    return {
        irreversible: !shape.canBeGivenBack,
        principalCannotHoldIt: !shape.theySurviveToHoldIt
    };
}

/**
 * How heavy the deed is, derived from the shape rather than typed in: an eighth
 * kind of wrong is a row in {@link SHAPE_OF} and no figure is re-argued.
 */
function weightOfTheDeed(wrong: Wrong, woundKey?: string | null): number {
    const shape = shapeOf(wrong, woundKey);
    return 1
        + (shape.force ? 1 : 0)
        + (shape.somethingWasTaken ? 2 : 0)
        + (shape.canBeGivenBack ? 0 : 2)
        + (shape.theySurviveToHoldIt ? 0 : 2);
}

/**
 * How heavy the RECORD is, from what was done and never from what the wronged
 * party managed to do back. Separate from {@link SEVERITY_OF} because conflating
 * them wrote the wrong thing down: a robbery is not `slight` because the person
 * robbed was helpless.
 */
export function severityOfTheWrong(wrong: Wrong, woundKey?: string | null): Severity {
    const shape = shapeOf(wrong, woundKey);
    if (!shape.theySurviveToHoldIt) return 'unforgivable';
    if (!shape.canBeGivenBack) return 'grave';
    if (shape.somethingWasTaken) return 'serious';
    return 'slight';
}

/**
 * The answer, ascending. An ordered vocabulary rather than a number, so nothing
 * downstream can be tempted to do arithmetic on it.
 */
export type Reprisal =
    /** Reserved. The floor is a warning, so nothing else returns this. */
    | 'nothing'
    /** Words. What somebody who cannot reach you has instead. */
    | 'warned'
    /** Put out, moved on, told not to come back. No wound. */
    | 'driven_off'
    /** A real wound, of the kind that does not close on its own. */
    | 'injured'
    /** A wound that does not come back. */
    | 'crippled'
    /** They kill you. */
    | 'killed';

export const REPRISAL_ORDER: readonly Reprisal[] = Object.freeze([
    'nothing', 'warned', 'driven_off', 'injured', 'crippled', 'killed'
]);

function reprisalRank(r: Reprisal): number {
    return REPRISAL_ORDER.indexOf(r);
}

function lesser(a: Reprisal, b: Reprisal): Reprisal {
    return reprisalRank(a) <= reprisalRank(b) ? a : b;
}

/** Major-realm index, the unit `assessGap` in `combat.ts` counts in. */
function realmIndexOf(ordinal: number): number {
    const tier = realmForOrdinal(ordinal);
    return REALM_TIERS.findIndex(t => t.key === tier.key);
}

/**
 * The most this person could do about it. Counted in MAJOR REALMS and not
 * ordinals, for `combat.ts`'s reason: thirteen sub-ranks of Qi Condensation are
 * one realm and the step out is worth more than all thirteen. Two realms is
 * where that file stops calling a fight a fight.
 */
export function whatTheyCanDoAboutIt(realmGap: number): Reprisal {
    if (realmGap <= -1) return 'warned';
    if (realmGap === 0) return 'injured';
    if (realmGap === 1) return 'crippled';
    return 'killed';
}

/**
 * The most this person is WILLING to do. One rule keyed on alignment, with no
 * branch on any house's name. `weight` is a small integer and is compared,
 * never multiplied.
 */
export function howFarTheyWouldGo(
    alignment: SectAlignment | null,
    weight: number
): Reprisal {
    switch (alignment) {
        case 'righteous':
            // Restraint, not softness: they still put somebody down at the top
            // of the scale, they simply do not start there.
            if (weight >= 8) return 'killed';
            if (weight >= 5) return 'crippled';
            if (weight >= 3) return 'injured';
            return 'driven_off';
        case 'demonic':
            // Not proportionate to what you did, proportionate to what they can
            // get away with. A demonic cultivator who warns you wanted something.
            if (weight >= 4) return 'killed';
            if (weight >= 2) return 'crippled';
            return 'injured';
        case 'neutral':
        default:
            // `null` shares this branch on the owner's ruling. Do not give it a
            // gentler one.
            if (weight >= 8) return 'killed';
            if (weight >= 5) return 'crippled';
            if (weight >= 2) return 'injured';
            return 'driven_off';
    }
}

/**
 * What a detonation costs the person it is aimed at, indexed from the
 * DETONATOR'S side: 0 is level with the offender, 3 is three realms below.
 * PINNED BY TEST - a Core Formation cultivator against a Void Refinement elder
 * takes a real bite; a Qi Condensation one is a scene.
 */
const WHAT_SPENDING_EVERYTHING_REACHES: readonly number[] = Object.freeze([
    1,     // level with them. It kills them.
    0.6,   // one realm above them
    0.3,   // two
    0.12,  // three
    0.05   // four or more. A scene, and it is still a scene worth telling.
]);

export function whatADetonationCosts(realmsBelowTheOffender: number): number {
    const at = Math.min(
        WHAT_SPENDING_EVERYTHING_REACHES.length - 1,
        Math.max(0, Math.round(realmsBelowTheOffender))
    );
    return WHAT_SPENDING_EVERYTHING_REACHES[at];
}

/**
 * Whether spending themselves is the answer they reach for: the account cannot
 * be settled, they cannot reach the offender any other way, and they are still
 * alive to do it. All three conditions come off rows the ledger already has.
 *
 * NOT WRITTEN AS HEROIC AND NOTHING REWARDS IT. What the world does is circulate
 * it, because almost nobody does it - notability, never approval.
 */
export function wouldTheySpendThemselves(input: {
    wrong: Wrong;
    woundKey?: string | null;
    canDo: Reprisal;
}): boolean {
    const shape = shapeOf(input.wrong, input.woundKey);
    return shape.theySurviveToHoldIt
        && !shape.canBeGivenBack
        && input.canDo === 'warned';
}

export interface ReprisalVerdict {
    response: Reprisal;
    /** The wound to mint, or null when nothing physical happened. */
    wound: InjurySeverity | null;
    /**
     * Fraction of the player's own health to take off. A FRACTION and not a
     * number of points: the body does not scale with the ladder here, so a flat
     * figure is trivial at one rung and lethal at another.
     */
    hpFraction: number;
    /** Whether the run ends here. */
    fatal: boolean;
    grudge: {
        cause: GrudgeCause;
        severity: Severity;
        /** The record rests on a suspicion. Not a discount. */
        fromBelief: boolean;
    };
    /** Who ends up holding it. `whoever was theirs` when they did not survive. */
    holder: WhoHoldsIt;
    /** Hand straight to `whatADeedLeaves` as `principalCannotHoldIt`. */
    principalCannotHoldIt: boolean;
    /** Hand straight to `Deed.irreversible`. */
    irreversible: boolean;
    /**
     * They spent themselves to reach the offender. DELIBERATELY NOT a rung on
     * {@link REPRISAL_ORDER} - putting it there would let `lesser` pick it by
     * accident, and it exists precisely where every ordinary answer came back
     * `warned`.
     */
    spentThemselves: boolean;
    /** How far the news travels, 0..1. NOTABILITY, NEVER APPROVAL. */
    howFarItTravels: number;
    /** Engine-authored and factual. Never narration; phase 3 dresses it. */
    line: string;
}

/** The deed, plus what it cost them, plus who saw it. */
export function weighTheWrong(input: {
    wrong: Wrong;
    /** The wound row, where the wrong was a wound. `permanent` is read off it. */
    woundKey?: string | null;
    /** Whether the attempt landed. A failed robbery is still a robbery. */
    landed: boolean;
    /** Whether anybody was there to see it. */
    inPublic: boolean;
}): number {
    return weightOfTheDeed(input.wrong, input.woundKey)
        // A refused attempt is still weighed: trying is the part they answer.
        + (input.landed ? 1 : 0)
        + (input.inPublic ? 1 : 0);
}

const SEVERITY_OF: Readonly<Record<Reprisal, Severity>> = Object.freeze({
    nothing: 'slight',
    warned: 'slight',
    driven_off: 'slight',
    injured: 'serious',
    crippled: 'grave',
    killed: 'unforgivable'
});

const WOUND_OF: Readonly<Record<Reprisal, InjurySeverity | null>> = Object.freeze({
    nothing: null,
    warned: null,
    driven_off: null,
    injured: 'serious',
    crippled: 'crippling',
    killed: 'crippling'
});

const HP_FRACTION_OF: Readonly<Record<Reprisal, number>> = Object.freeze({
    nothing: 0,
    warned: 0,
    driven_off: 0,
    // Heavy on purpose: "heavily injured" was the specification, and a wound you
    // walk away from to try again next turn is the same nothing, longer.
    injured: 0.5,
    crippled: 0.85,
    killed: 1
});

/**
 * What happens to somebody who wrongs this person, in front of them.
 *
 * NOTICING IS NOT ROLLED, and that is a ruling rather than an omission: every
 * deed here is done to somebody's face. What varies is whether they can do
 * anything about having noticed, which is the gap's job.
 */
export function whatTheyDoAboutBeingWronged(input: {
    wrong: Wrong;
    /** The wound row, where the wrong was a wound done on purpose. */
    woundKey?: string | null;
    landed: boolean;
    inPublic: boolean;
    /** The wronged party's rung. */
    theirOrdinal: number;
    /** The player's rung. */
    yourOrdinal: number;
    /** The wronged party's house, or null if they are on nobody's roll. */
    alignment: SectAlignment | null;
    theirName: string;
    yourName: string;
    /**
     * They know rather than suspect. Only consulted for wrongs that happen on
     * their own often enough to be deniable. Defaults to true.
     */
    certain?: boolean;
}): ReprisalVerdict {
    const realmGap = realmIndexOf(input.theirOrdinal) - realmIndexOf(input.yourOrdinal);
    const shape = shapeOf(input.wrong, input.woundKey);
    const weight = weighTheWrong(input);

    const canDo = whatTheyCanDoAboutIt(realmGap);
    const wouldDo = howFarTheyWouldGo(input.alignment, weight);

    // The lesser of the two, never below a warning: they noticed, so something
    // is said even when nothing can be done. Silence read as the world not
    // being there.
    const settled = lesser(canDo, wouldDo);
    // Somebody who only suspects writes the record on a belief and does nothing
    // in the body over it.
    const unsure = shape.theyMayNeverBeCertain && input.certain === false;
    const floored: Reprisal = reprisalRank(settled) < reprisalRank('warned')
        ? 'warned'
        : settled;
    const response: Reprisal = unsure ? 'warned' : floored;

    const spentThemselves = !unsure && wouldTheySpendThemselves({
        wrong: input.wrong,
        woundKey: input.woundKey,
        canDo
    });

    // What the record says is what was DONE, floored by what the answer cost,
    // never the other way round.
    const written = severityOfTheWrong(input.wrong, input.woundKey);
    const severity = heavier(written, SEVERITY_OF[response]);

    return {
        response,
        wound: spentThemselves ? null : WOUND_OF[response],
        hpFraction: spentThemselves
            // Sign flipped: `whatADetonationCosts` counts from the detonator's
            // side, and `realmGap` is the wronged party's minus the player's.
            ? whatADetonationCosts(-realmGap)
            : HP_FRACTION_OF[response],
        fatal: response === 'killed' || (spentThemselves && whatADetonationCosts(-realmGap) >= 1),
        grudge: { cause: shape.cause, severity, fromBelief: unsure },
        holder: whoEndsUpHoldingIt(input.wrong),
        principalCannotHoldIt: !shape.theySurviveToHoldIt,
        irreversible: !shape.canBeGivenBack,
        spentThemselves,
        howFarItTravels: spentThemselves
            ? 0.9
            : SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf('grave')
                ? 0.5
                : 0.2,
        line: spentThemselves
            ? `${input.theirName} could do nothing about ${whatWasDone(input.wrong)} and did the `
              + `one thing that reaches. There is nothing left of them. ${input.yourName} did not `
              + 'walk away from it untouched, and it is the kind of thing people repeat.'
            : unsure
                ? `${input.theirName} cannot say it was ${input.yourName}. These things fail on `
                  + 'their own. What they hold is a suspicion, and they hold it hard.'
                : lineFor(response, input.wrong, input.theirName, input.yourName, realmGap)
    };
}

function heavier(a: Severity, b: Severity): Severity {
    return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/**
 * The deed in the engine's own voice: what happened and to whom, never a
 * depiction of it. `docs/world/writing/tone.md` governs.
 */
function whatWasDone(wrong: Wrong): string {
    return {
        threatened: 'being threatened',
        robbed: 'being robbed',
        deceived: 'being lied to',
        interrogated: 'being leaned on for answers',
        wounded: 'being cut',
        violated: 'what was done to them',
        interfered_with_a_crossing: 'somebody reaching into their crossing',
        killed: 'a death'
    }[wrong];
}

/**
 * The factual account. Named parties and the reason, because a line nobody can
 * read in two centuries is the failure `grudges.ts` exists to prevent.
 */
function lineFor(
    response: Reprisal,
    wrong: Wrong,
    theirName: string,
    yourName: string,
    realmGap: number
): string {
    const what = whatWasDone(wrong);

    switch (response) {
        case 'warned':
            return realmGap <= -1
                ? `${theirName} noticed ${what}, and is in no position to do a thing about it. `
                  + `They tell ${yourName} exactly that, and it is all they have.`
                : `${theirName} noticed ${what} and lets it go with words. ${yourName} has been `
                  + 'told once.';
        case 'driven_off':
            return `${theirName} answers ${what} by putting ${yourName} out. No wound and no `
                + 'quarter: they are not welcome where this person stands.';
        case 'injured':
            return `${theirName} answers ${what} in the body. ${yourName} does not walk away `
                + 'from it whole.';
        case 'crippled':
            return `${theirName} answers ${what} by taking the road away. What ${yourName} `
                + 'carries out of this does not close.';
        case 'killed':
            return `${theirName} answers ${what} by killing ${yourName}. The gap was wide `
                + 'enough that it was a decision rather than a fight.';
        default:
            return `${theirName} does nothing about ${what}.`;
    }
}
