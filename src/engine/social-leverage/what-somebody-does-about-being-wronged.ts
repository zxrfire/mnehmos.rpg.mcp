/**
 * What the person you just wronged does about it, there and then.
 *
 * THE HOLE THIS FILLS, IN THE ENGINE'S OWN WORDS
 * ----------------------------------------------
 * `admin_manage.spawn_encounter` has said this out loud for as long as it has
 * existed, in `dispositionReaches`:
 *
 *   > THERE IS NO STORE FOR HOW A PERSON IS DISPOSED TOWARD THE PLAYER RIGHT
 *   > NOW [...] and no loop in which a co-located hostile cultivator does
 *   > anything about it.
 *
 * Measured in play, which is what turned it from an admission into a defect: a
 * cultivator stood in front of a Void Refinement stranger, threatened them and
 * robbed them, and BOTH LANDED - and the only thing either left behind was a
 * social tie, which is the record this engine writes for people who are
 * getting ON. Coercion and theft were registering as relationship-building.
 * Nothing warned, nothing struck back, nothing died.
 *
 * The design owner's ruling, and the whole specification for this file:
 *
 *   > your bad things are noticed and you get a verbal warning at minimum, or
 *   > heavily injured maybe dead depending on his alignment.
 *
 * TWO QUESTIONS, AND THEY ARE ALLOWED TO DISAGREE
 * -----------------------------------------------
 * The same split `what-a-house-will-do-about-it.ts` makes, for the same
 * reason - what somebody WANTS to do about being wronged and what they CAN do
 * about it are different facts, and the interesting cases are the ones where
 * they disagree.
 *
 *   WHAT THEY CAN DO           {@link whatTheyCanDoAboutIt} - the power gap
 *   HOW FAR THEY WOULD GO      {@link howFarTheyWouldGo}    - the alignment
 *
 * The answer is the lesser of the two, floored at a warning. A Qi Condensation
 * farmer robbed by a False Immortal is furious and can do precisely nothing
 * about it except say so; a demonic elder robbed by a Foundation disciple does
 * not warn anybody twice. Neither is a special case in here - they both fall
 * out of taking the minimum.
 *
 * WHY THE FLOOR IS A WARNING AND NOT SILENCE
 * ------------------------------------------
 * Because silence is what the game already did, and it read as the world not
 * being there. Somebody who cannot touch you can still tell you what you are,
 * and that line is the cheapest possible signal that the act landed on a
 * person rather than on a ledger.
 *
 * WHY ALIGNMENT AND NOT DISPOSITION
 * ---------------------------------
 * Disposition is how somebody felt about you BEFORE you robbed them, and it is
 * not a thing this world stores - see the quotation at the top. Alignment is
 * stored, it sits on the house rather than the mood, and it is the axis the
 * rest of this directory already turns on.
 *
 * A `null` alignment - somebody on no house's roll at all - is read as
 * NEUTRAL, on the design owner's ruling: *"by default its rogue neutral"*. A
 * rogue is not a softer person for having nobody behind them, and an earlier
 * draft that read them one step shorter was inventing a timidity nothing in
 * the setting supports. Being house-less changes who answers for what they do
 * afterwards, which is `what-a-house-will-do-about-it.ts`'s question, and not
 * how far they will go in the moment, which is this one's.
 *
 * AND WHEN THE GAP CANNOT BE CLOSED AT ALL
 * ----------------------------------------
 * The paragraph above ends with a farmer who can do precisely nothing except
 * say so, and for a long time that was the end of the sentence. It is not.
 * {@link wouldTheySpendThemselves} is the one answer that reaches upward, and
 * it is paid for with everything the person has. It is not heroic, nothing
 * rewards it, and the person is gone afterwards. What the world does with it is
 * circulate it, because almost nobody does it - which is a statement about how
 * far the news travels and not about anybody approving.
 *
 * Pure lookup. No state, no rolls, no I/O. Nothing here reads a faction name,
 * which is the test `AGENTS.md` sets for whether a piece of lore is a system.
 */

import type { InjurySeverity, SectAlignment } from '../../schema/cultivation.js';
import type { GrudgeCause, Severity } from '../social/grudges.js';
import { SEVERITY_ORDER } from '../social/grudges.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT WAS DONE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The deed, at the level of description a grudge can be written from.
 *
 * Deliberately not the player's verb: `an-attempt-to-move-somebody.ts` is
 * explicit that nothing downstream may branch on what somebody typed. These
 * describe what was actually put on the table, which the resolver already
 * knows.
 *
 * WHAT IS AND IS NOT A PLAYER VERB. This union is the vocabulary of wrongs the
 * world can price. It is NOT the list of things a player may do:
 * `WRONG_BEHIND_INTENT` in `web/game.ts` is a closed table mapping parsed
 * intents onto these, an intent absent from it produces no reprisal at all. The severity vocabulary being
 * honest about what people do to each other and the action list offering it are
 * different questions, and `grudges.ts` settled the first one already - it
 * carries `violated` as one deliberate row, at that level of description, with
 * the world narrating consequence and aftermath rather than the act.
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
     * A wound, done on purpose.
     *
     * ONE ROW FOR THE WHOLE OF `wounds.ts`, on the design owner's ruling:
     * *"look at the possible injuries as things someone could do to you."* Every
     * injury the world can inflict is a wrong somebody can inflict deliberately,
     * and that table already carries the axis this file needs - `permanent` is
     * exactly whether it can be given back. So the maiming band comes for free,
     * a wound added next year is automatically a wrong somebody can commit, and
     * there is no second table of harms to drift from the first. Pass the wound
     * key to {@link shapeOf}.
     */
    | 'wounded'
    /**
     * A grave wrong done to their person. `grudges.ts`'s own row and wording.
     *
     * The maiming shape rather than the murder one: they survive to hold it
     * themselves, and nothing repays it, so `repaid` and `compensated` are
     * unavailable and what is left is `avenged`, `forgiven` or `renounced`. It
     * is here because the ledger must be able to record what this world
     * contains. It is not a thing the parser offers.
     */
    | 'violated'
    /**
     * Somebody reached into a crossing.
     *
     * THE WORST NON-FATAL THING IN THE SETTING, and nothing modelled it.
     * `breakthrough.ts` already establishes why it is the moment: the price has
     * been paid, the tribulation is coming down whether or not anybody is
     * ready, and it cannot be aborted. So the cultivator is maximally exposed
     * and maximally unable to answer.
     *
     * It does not take a limb, it takes the path - `wounds.ts` has the outcome
     * already written, somebody permanently three rungs from the Lid with
     * *"simply nothing further to do"*. And it is deniable in a way a severed
     * arm is not, because crossings fail on their own all the time: see
     * {@link TheShapeOfAWrong.theyMayNeverBeCertain}, which is read.
     */
    | 'interfered_with_a_crossing'
    /** They are dead, and the record has to go somewhere else. */
    | 'killed';

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE OF IT, WHICH IS WHERE THE ORDERING ACTUALLY COMES FROM
// ─────────────────────────────────────────────────────────────────────────

/**
 * Three facts about a wrong, and NOT a severity number.
 *
 * The design owner's correction, and it is the whole of why this table changed:
 * cutting an arm off is worse than robbery, and the reason is not that it
 * deserves a bigger figure. It is that **the set of ways the account can ever
 * close is smaller.** `grudges.ts` has `repaid` and `compensated` because
 * things that come back exist; a severed arm does not come back, so neither
 * discharge is available and the record simply stays open.
 *
 * And murder is structurally unlike everything else in this file, which is the
 * part that could not be expressed as a weight at all: **the person it was done
 * to holds nothing, because there is nobody there to hold it.** The record goes
 * to somebody who was not party to the deed - their house, their kin - which is
 * the same routing `whatADeedLeaves` already performs from
 * `principalCannotHoldIt`, and the same escalation `whenItIsDoneToOneOfOurs`
 * already performs for a house answering for its member. Nothing new is built
 * for it here.
 *
 * The ordering falls out of the three: a wrong that took something, cannot be
 * given back, and recruits an enemy who was not even present is obviously worse
 * than one that can be repaid, and nobody had to choose a number to say so.
 */
export interface TheShapeOfAWrong {
    /** Force was on the table rather than words. Cannot be done quietly. */
    force: boolean;
    /** Something was actually taken out of them, not merely offered for. */
    somethingWasTaken: boolean;
    /** It can come back. `repaid` and `compensated` are available discharges. */
    canBeGivenBack: boolean;
    /** They are still there to hold the record. */
    theySurviveToHoldIt: boolean;
    /**
     * The thing happens on its own often enough that they cannot be sure.
     *
     * READ, not decoration: an uncertain party is capped at a warning and the
     * record they write is `fromBelief`, which `grudges.ts` already carries and
     * which `whatWouldCloseIt` already lets `proven_false` discharge. A feud
     * founded on a suspicion still kills people until somebody proves it.
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
        // A threat costs its target nothing until it is made good on, which is
        // why nothing was taken - and it cannot be done quietly, which is why
        // force is true.
        force: true, somethingWasTaken: false, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'humiliation'
    },
    robbed: {
        force: false, somethingWasTaken: true, canBeGivenBack: true,
        theySurviveToHoldIt: true, theyMayNeverBeCertain: false, cause: 'robbery'
    },
    wounded: {
        // `canBeGivenBack` here is the DEFAULT for a wound with no key on it,
        // which `getWoundType` already treats as an ordinary wound of its
        // severity. Pass the key to `shapeOf` and `permanent` decides it.
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
        // The one row where this is false, and the reason the file needed a
        // routing question rather than a heavier number.
        theySurviveToHoldIt: false, theyMayNeverBeCertain: false, cause: 'killed_kin'
    }
});

/**
 * The shape of one wrong, with a wound key read where there is one.
 *
 * The single place `wounds.ts` is consulted, and the only thing taken from it
 * is `permanent`. A parted meridian, a cracked core and a crippled nascent soul
 * are permanent rows and therefore cannot be given back; a torn meridian can.
 * The whole maiming band arrives without a line of it being restated here.
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
 * The two fields a caller hands straight to `what-a-deed-leaves.ts`.
 *
 * Named for the fields they fill so the wiring is one line and cannot be got
 * backwards. `irreversible` was already a step in `whatItWasWorth` and no wrong
 * in this file ever set it, which is exactly the gap the owner found.
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
 * How heavy the deed is, derived from the shape rather than typed in.
 *
 * One step per fact that is true, which is `whatItWasWorth`'s shape and for the
 * same reason: adding an eighth kind of wrong is adding a row to {@link
 * SHAPE_OF}, and no figure here has to be re-argued.
 */
function weightOfTheDeed(wrong: Wrong, woundKey?: string | null): number {
    const shape = shapeOf(wrong, woundKey);
    return 1
        + (shape.force ? 1 : 0)
        + (shape.somethingWasTaken ? 2 : 0)
        + (shape.canBeGivenBack ? 0 : 2)
        // Worst on its own, because it is the one that puts the account in
        // somebody else's hands and takes every settlement with it.
        + (shape.theySurviveToHoldIt ? 0 : 2);
}

/**
 * How heavy the record is, from what was done - never from what the wronged
 * party managed to do back.
 *
 * Separated from {@link SEVERITY_OF} because they answer different questions
 * and conflating them wrote the wrong thing down: a farmer robbed by a Void
 * Refinement cultivator can do nothing but say so, and the record of the
 * robbery is not `slight` because the farmer was helpless. The written severity
 * is the heavier of the two.
 */
export function severityOfTheWrong(wrong: Wrong, woundKey?: string | null): Severity {
    const shape = shapeOf(wrong, woundKey);
    if (!shape.theySurviveToHoldIt) return 'unforgivable';
    if (!shape.canBeGivenBack) return 'grave';
    if (shape.somethingWasTaken) return 'serious';
    return 'slight';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY DO
// ─────────────────────────────────────────────────────────────────────────

/**
 * The answer, in ascending order of how much of it the player carries away.
 *
 * `SEVERITY_ORDER` in `grudges.ts` is the model: an ordered vocabulary rather
 * than a number, so nothing downstream can be tempted to do arithmetic on it.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY CAN DO - THE GAP
// ─────────────────────────────────────────────────────────────────────────

/** Major-realm index, the unit `assessGap` in `combat.ts` counts in. */
function realmIndexOf(ordinal: number): number {
    const tier = realmForOrdinal(ordinal);
    return REALM_TIERS.findIndex(t => t.key === tier.key);
}

/**
 * The most this person could do about it, whatever they would like to do.
 *
 * Counted in major realms and not ordinals, for the reason `combat.ts` gives:
 * thirteen sub-ranks of Qi Condensation are one realm, and the step out of it
 * is worth more than all thirteen. Two realms is where that file stops calling
 * a fight a fight, and a reprisal becomes unanswerable at exactly the same
 * place, read from the other side.
 */
export function whatTheyCanDoAboutIt(realmGap: number): Reprisal {
    // A full realm or more BELOW the player. Words are what is left, and words
    // are free at any rung.
    if (realmGap <= -1) return 'warned';
    // Level. They can make it hurt and cannot make it permanent.
    if (realmGap === 0) return 'injured';
    // One realm up: they can end your cultivation without ending you.
    if (realmGap === 1) return 'crippled';
    // Two or more: helpless, from the other side of the same fact.
    return 'killed';
}

// ─────────────────────────────────────────────────────────────────────────
// HOW FAR THEY WOULD GO - THE ALIGNMENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most this person is WILLING to do, whatever they are able to do.
 *
 * The shape is `whenItIsDoneToOneOfOurs`: one rule keyed on alignment turning
 * into three genuinely different situations, with no branch on any house's
 * name. Take the alignment column away and this function has nothing to say.
 *
 * `weight` is the deed plus what it cost them plus who was watching - see
 * {@link weighTheWrong}. It is a small integer, and it is compared, never
 * multiplied.
 */
export function howFarTheyWouldGo(
    alignment: SectAlignment | null,
    weight: number
): Reprisal {
    switch (alignment) {
        case 'righteous':
            // A righteous house does not answer a slight with a corpse, and
            // that restraint is most of what belonging to one costs. It is not
            // softness: at the top of the scale they will still put somebody
            // down. They simply will not start there - and the top of the scale
            // is now reachable, because the deed table goes as far as a killing.
            if (weight >= 8) return 'killed';
            if (weight >= 5) return 'crippled';
            if (weight >= 3) return 'injured';
            return 'driven_off';
        case 'demonic':
            // The ugly one, on purpose, and the mirror of a demonic house
            // pricing its own member: what lands on you is not proportionate
            // to what you did, it is proportionate to what they can get away
            // with. A demonic cultivator who warns you wanted something.
            if (weight >= 4) return 'killed';
            if (weight >= 2) return 'crippled';
            return 'injured';
        case 'neutral':
        default:
            // A ROGUE IS NEUTRAL, not a softer thing for having nobody behind
            // them - the design owner's ruling, and the reason `null` shares
            // this branch rather than getting a gentler one of its own. What
            // being house-less changes is who answers for it afterwards, and
            // that is a different file's question.
            if (weight >= 8) return 'killed';
            if (weight >= 5) return 'crippled';
            if (weight >= 2) return 'injured';
            return 'driven_off';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE ONE ANSWER THAT REACHES UPWARD
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a detonation costs the person it is aimed at, by how many realms apart
 * they are.
 *
 * Counted in major realms, the unit this file already counts in. Read from the
 * DETONATOR'S side: 0 is level with the offender, -3 is three realms below
 * them. Everything spent at once strikes far above the detonator's ordinary
 * weight - that is the whole of what makes it a threat - and it still falls
 * away with distance, because nothing in this world is unanswerable and nothing
 * reaches everybody.
 *
 * PINNED BY TEST. A Core Formation cultivator against a Void Refinement elder
 * is three realms and takes a real bite; a Qi Condensation one is five and is a
 * scene. That asymmetry is the mechanic and it is a decision living as five
 * numbers.
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
 * Whether this is the answer they reach for.
 *
 * The hole this fills is named in this file's own header: a farmer robbed by a
 * False Immortal is furious and can do nothing except say so. Spending
 * themselves is the only thing that reaches, and the three conditions are the
 * three the ledger already knows:
 *
 *   THE ACCOUNT CANNOT BE SETTLED   `canBeGivenBack` is false, so `repaid` and
 *                                   `compensated` are not available and nothing
 *                                   short of this closes it.
 *   THEY CANNOT REACH THEM          `whatTheyCanDoAboutIt` came back `warned`.
 *                                   Words were the whole of what they had.
 *   THEY ARE STILL THERE            A dead person spends nothing. Where they are
 *                                   not, the account went to somebody else and
 *                                   that person answers it on their own terms.
 *
 * IT IS NOT WRITTEN AS HEROIC AND NOTHING REWARDS IT. It is the last thing a
 * person has, spent, and the person is gone. What the world does with it is
 * circulate it, because almost nobody does it - which is notability and not
 * approval, and the two are different fields everywhere they are stored.
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

// ─────────────────────────────────────────────────────────────────────────
// THE VERDICT
// ─────────────────────────────────────────────────────────────────────────

export interface ReprisalVerdict {
    response: Reprisal;
    /** The wound to mint, or null when nothing physical happened. */
    wound: InjurySeverity | null;
    /**
     * Fraction of the player's own health to take off; 0 when none.
     *
     * A fraction rather than a number of points, because the body does not
     * scale with the ladder in this engine and a flat figure would be trivial
     * at one rung and lethal at another.
     */
    hpFraction: number;
    /** Whether the run ends here. */
    fatal: boolean;
    grudge: {
        cause: GrudgeCause;
        severity: Severity;
        /**
         * The record rests on a suspicion rather than a confirmed fact.
         *
         * `grudges.ts`'s own field, and it is not a discount: a feud founded on
         * a belief kills people just as thoroughly until somebody proves it,
         * which is what `proven_false` is for.
         */
        fromBelief: boolean;
    };
    /** Who ends up holding it. `whoever was theirs` when they did not survive. */
    holder: WhoHoldsIt;
    /** Hand straight to `whatADeedLeaves` as `principalCannotHoldIt`. */
    principalCannotHoldIt: boolean;
    /** Hand straight to `Deed.irreversible`. */
    irreversible: boolean;
    /**
     * They spent themselves to reach the offender.
     *
     * Not a rung on {@link REPRISAL_ORDER}, deliberately: putting it there would
     * let `lesser` pick it by accident, and the whole point is that it is
     * available precisely where every ordinary answer came back `warned`.
     * `hpFraction` carries what it cost the offender and the detonator is gone.
     */
    spentThemselves: boolean;
    /**
     * How far the news of it travels, 0..1, for `makeFact`'s own `magnitude`.
     *
     * NOTABILITY, NEVER APPROVAL. `history.ts` states its own field the same
     * way - *"reporting weight. Digests filter on it; simulation never reads
     * it"* - so nothing anywhere reads a large magnitude as an endorsement.
     * A detonation travels because almost nobody does it, and what travels is
     * what the offender did that was answered that way.
     */
    howFarItTravels: number;
    /** Engine-authored and factual. Never narration; phase 3 dresses it. */
    line: string;
}

/**
 * The deed, plus what it cost them, plus who saw it.
 *
 * Exported because the number is worth pinning in a test, and because a caller
 * explaining a verdict needs the same arithmetic.
 */
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
        // It came off, so they are out something real rather than merely
        // insulted. A refused attempt is still weighed: trying is the part
        // they answer, and the engine already writes a grudge for it.
        + (input.landed ? 1 : 0)
        // Being done in front of people is a second wrong on top of the first,
        // which is the reading `AUDIENCE_RESISTANCE` already takes of a room.
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
    // Heavy on purpose. "Heavily injured" was the specification, and a wound
    // you walk away from to try again next turn is the same nothing in a
    // longer sentence.
    injured: 0.5,
    crippled: 0.85,
    killed: 1
});

/**
 * What happens to somebody who wrongs this person, in front of them.
 *
 * NOTICING IS NOT ROLLED, and that is a ruling rather than an omission. Every
 * deed this function answers is done to somebody's face - a threat cannot be
 * made quietly, and a hand in the purse of a cultivator who can hear a heart
 * beat through a wall is not a secret. What varies is whether they can do
 * anything about having noticed, and that is the gap's job.
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
     * They know rather than suspect.
     *
     * Only consulted for the wrongs that happen on their own often enough to be
     * deniable - reaching into a crossing is the one. Defaults to true, so every
     * existing caller is unaffected and nothing else in the table changes.
     */
    certain?: boolean;
}): ReprisalVerdict {
    const realmGap = realmIndexOf(input.theirOrdinal) - realmIndexOf(input.yourOrdinal);
    const shape = shapeOf(input.wrong, input.woundKey);
    const weight = weighTheWrong(input);

    const canDo = whatTheyCanDoAboutIt(realmGap);
    const wouldDo = howFarTheyWouldGo(input.alignment, weight);

    // The lesser of the two, and never below a warning: they noticed, so
    // something is said even when nothing can be done.
    const settled = lesser(canDo, wouldDo);
    // And a person who only suspects acts like one. They are not sure it was
    // anybody, so the record is written on a belief and nothing is done in the
    // body over it - which is the whole content of a deniable wrong.
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

    // What the record says is what was DONE, floored by what the answer cost -
    // never the other way round. A robbery is a serious account whether or not
    // the person robbed could do anything about it.
    const written = severityOfTheWrong(input.wrong, input.woundKey);
    const severity = heavier(written, SEVERITY_OF[response]);

    return {
        response,
        wound: spentThemselves ? null : WOUND_OF[response],
        hpFraction: spentThemselves
            // Counted from the detonator's side: how many realms below the
            // offender they were standing when they spent everything.
            ? whatADetonationCosts(-realmGap)
            : HP_FRACTION_OF[response],
        fatal: response === 'killed' || (spentThemselves && whatADetonationCosts(-realmGap) >= 1),
        grudge: { cause: shape.cause, severity, fromBelief: unsure },
        holder: whoEndsUpHoldingIt(input.wrong),
        principalCannotHoldIt: !shape.theySurviveToHoldIt,
        irreversible: !shape.canBeGivenBack,
        spentThemselves,
        howFarItTravels: spentThemselves
            // Extraordinary, and that is the whole of why it moves. It is not a
            // score of how right anybody was.
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
 * The deed named in the engine's own voice, at the level of description
 * `grudges.ts` sets: what happened and to whom, never a depiction of it.
 * `docs/world/writing/tone.md` governs and the grave rows get no different
 * treatment, because they need none.
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
 * The factual account, in the engine's voice.
 *
 * Named parties and the reason, because a line nobody can read in two
 * centuries is the failure `grudges.ts` exists to prevent - and this line is
 * what the narrator is handed and what the log keeps.
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
