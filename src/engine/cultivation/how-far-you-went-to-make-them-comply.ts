/**
 * How far you went to make somebody comply.
 *
 * Design owner: **"coerce is using violence directly, different levels of the
 * same thing."** And, on the level above that: *"that's where the mind control
 * ancient arts come into play."*
 *
 * So this is ONE act at a level, not three mechanisms. The target is the same,
 * the want is the same, the record is the same; what differs is how far up you
 * went and therefore what it costs both of you. The level is a VALUE, which is
 * the discipline the rest of this codebase runs on - a tenth reason for doing
 * it should need no code, and a fourth level should need a row rather than a
 * branch.
 *
 * ── THE LADDER ───────────────────────────────────────────────────────────
 *
 *   said     Words. A promise of harm, and nothing has happened yet.
 *            `what-somebody-does-about-being-wronged.ts` states the definition
 *            in as many words: "a threat costs its target nothing until it is
 *            made good on." That is why threatening lives among the `interact`
 *            intents, beside talking and bargaining. It is a thing you SAY.
 *
 *   done     Hands. The harm actually applied to get compliance, or the thing
 *            taken while they are held. Not a heavier threat - the point at
 *            which the target stops being somebody being talked to. It fails
 *            the way a fight fails rather than the way a conversation fails,
 *            which is why it resolves through `resolveConfrontation` and not
 *            through the social layer.
 *
 *   taken    The will itself, which no elemental art reaches. This is an
 *            ANCIENT art and it is deliberately not a verb - see the section
 *            at the bottom - and it is the only level where what you are left
 *            with is worth less than what the level below leaves you.
 *
 * ── WHY THE TOP OF THE LADDER IS NOT THE BEST PLACE ON IT ────────────────
 *
 * `docs/world/history/ancient.md` forbids a strict upgrade by name - "an
 * ancient art that is better in every situation... then the abandonment makes
 * no sense and the whole tier collapses into 'old is stronger'" - and this is
 * exactly the shape that walks into one, because taking the will beats every
 * refusal. So the thing it is useless for has to be named, and it is:
 *
 *   IT TAKES THE WILL AND LEAVES NOTHING UNDERNEATH IT. Somebody who submitted
 *   because you beat them has a REASON to keep complying and knows what happens
 *   if they stop, so the compliance survives you leaving the room and can be
 *   traded on later. Somebody whose will was taken complies while the art holds
 *   and for not one moment after, is no better at anything than they were, and
 *   owes you nothing - because they never decided anything. The level that
 *   cannot be refused is the level that buys nothing durable.
 *
 *   AND IT CAN BE READ OFF THEM. `ancient.md`'s own trigger list includes "a
 *   player picks up, is offered, or is seen practising an ancient art", and the
 *   unauthorised-practice path already answers who wants a word about it. An
 *   art that leaves a legible mark on a living person who then walks around is
 *   the most findable thing in the world. That is a permanent cost rather than
 *   a per-use one, which is what stops it being situationally free.
 *
 * Neither of those is a penalty bolted on. They both fall out of what the level
 * IS: compliance with nobody behind it, and a thing done to a person who
 * survives to be examined.
 */

// TYPE-ONLY, and must stay so. `grudges.ts` is the ledger's vocabulary and this
// module borrows a word from it rather than minting a parallel one; a value
// import would tie the cultivation package to the social package for nothing.
import type { ObligationCause } from '../social/grudges.js';

// ─────────────────────────────────────────────────────────────────────────
// THE LEVEL
// ─────────────────────────────────────────────────────────────────────────

export type PressureLevel =
    /** Words. A promise of harm. Costs the target nothing yet. */
    | 'said'
    /** Hands. Harm applied to get compliance. */
    | 'done'
    /** The will, taken. An ancient art, and never a verb. */
    | 'taken';

export const PRESSURE_ORDER: readonly PressureLevel[] = Object.freeze(['said', 'done', 'taken']);

/** Whether `a` went further than `b`. The ladder is total and ordered. */
export function wentFurtherThan(a: PressureLevel, b: PressureLevel): boolean {
    return PRESSURE_ORDER.indexOf(a) > PRESSURE_ORDER.indexOf(b);
}

/**
 * How long the compliance outlives the moment.
 *
 * The column that makes the ladder not an upgrade path. Read it top to bottom
 * and the top level is the worst one.
 */
export type HowLongItHolds =
    /** As long as they believe you would do it. A word, and words are cheap. */
    | 'while_believed'
    /** As long as you could do it again. They know what you are, and so do they. */
    | 'while_you_could_repeat_it'
    /** As long as the art holds, and nothing at all afterwards. */
    | 'while_the_art_holds';

export interface WhatALevelLeaves {
    level: PressureLevel;
    /** What the ledger calls it. Data, carried onto the record. */
    cause: ObligationCause;
    /**
     * True when what was done to them does not come back. Fed straight to
     * `whatItWasWorth`, which counts irreversibility as a step of severity.
     *
     * Never true for `said` - nothing happened. Never true for `done` on its
     * own: whether a beating was irreversible is a fact about the WOUND, and
     * `permanent` on the wound row is what answers it, which is why this field
     * takes the wound rather than guessing from the level.
     */
    irreversible: boolean;
    holds: HowLongItHolds;
    /** True when the target ends up owing something they can be held to. */
    leavesAnObligation: boolean;
    /**
     * True when somebody who examines the target afterwards can tell it was
     * done. Only the top level, and it is most of that level's price.
     */
    leavesAReadableMark: boolean;
    /** Engine-authored account. Facts, never narration. */
    why: string;
}

/**
 * What one level leaves behind.
 *
 * `permanentWound` is the wound layer's own answer about the harm actually
 * done, passed in rather than inferred: a bruise and a maiming are the same
 * verb at the same level and are not the same deed, and `isPermanentWound` is
 * already the thing that separates them.
 *
 * `wordGivenFirst` is the pair the owner named: somebody who threatened, was
 * refused, and then used force HAS DONE THE THING THEY SAID THEY WOULD. That is
 * `promised` in the deed model, pointed the other way, and it costs a step of
 * severity through `whatItWasWorth` with no code of its own.
 */
export function whatALevelLeaves(input: {
    level: PressureLevel;
    /** True when the harm actually applied does not heal. From the wound row. */
    permanentWound?: boolean;
    /** True when they were told first and refused. The escalation pair. */
    wordGivenFirst?: boolean;
}): WhatALevelLeaves {
    const permanent = input.permanentWound === true;
    const promised = input.wordGivenFirst === true;

    switch (input.level) {
        case 'said':
            return {
                level: 'said',
                cause: 'other',
                irreversible: false,
                holds: 'while_believed',
                leavesAnObligation: false,
                leavesAReadableMark: false,
                why:
                    'Words. Nothing has been done to them, so nothing has been taken and there is '
                    + 'nothing to come back from. It holds exactly as long as they believe you '
                    + 'would go further.'
            };
        case 'done':
            return {
                level: 'done',
                // The ledger's own words, and the wound picks which. Somebody
                // held down and let up carries a humiliation; somebody who does
                // not walk right afterwards carries a crippling, and the ledger
                // already has both rows.
                cause: permanent ? 'crippled' : 'humiliation',
                // The wound decides, not the verb. A beating they walk off and a
                // beating they never walk right again are the same act and are
                // not the same record.
                irreversible: permanent,
                holds: 'while_you_could_repeat_it',
                leavesAnObligation: true,
                leavesAReadableMark: false,
                why:
                    'Hands. They complied because they were made to, and they know it can happen '
                    + 'again, which is why the compliance outlives the room. '
                    + (permanent
                        ? 'What was done to them does not heal, so the record is heavier by a step.'
                        : 'What was done to them heals.')
                    + (promised
                        ? ' They were told first and refused, so this is somebody making good on '
                          + 'their word, which is worth another step.'
                        : '')
            };
        case 'taken':
            return {
                level: 'taken',
                // `violated` - the ledger's row for a grave wrong done to
                // somebody's person, which is what taking a will is. Not
                // `betrayal`, which needs a trust to break first.
                cause: 'violated',
                // The will is not a thing that comes back the way a bruise does,
                // and it is the one level where that is true of the level rather
                // than of the wound.
                irreversible: true,
                holds: 'while_the_art_holds',
                // NOTHING. This is the whole reason the top of the ladder is not
                // the best place on it: they never decided anything, so there is
                // no decision to hold them to afterwards.
                leavesAnObligation: false,
                leavesAReadableMark: true,
                why:
                    'The will, taken. They comply while the art holds and owe you nothing, because '
                    + 'they decided nothing - so it buys no loyalty, no standing and no future '
                    + 'favour, which the level below all buys. And it can be read off them by '
                    + 'anybody who knows what to look for, for as long as they are alive to be '
                    + 'looked at.'
            };
    }
}

/**
 * The facts `whatItWasWorth` in the deed model asks for, from a level.
 *
 * A convenience so a caller writing the record does not have to remember which
 * of the three fields the deed model reads. It writes no record itself - this
 * module knows nothing about ledgers - it only answers.
 */
export function theDeedFactsFor(input: {
    level: PressureLevel;
    permanentWound?: boolean;
    wordGivenFirst?: boolean;
}): { cause: ObligationCause; irreversible: boolean; promised: boolean } {
    const leaves = whatALevelLeaves(input);
    return {
        cause: leaves.cause,
        irreversible: leaves.irreversible,
        promised: input.wordGivenFirst === true
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHETHER THEY YIELD AT ALL
//
// Design owner: **"depending on some character traits some would rather die.
// Animals AND people."**
//
// So submission is NOT what losing means. It is one of the things that can
// happen when somebody has lost, and whether it does is a fact about who they
// are. There is deliberately no will-to-submit number here and there must not
// be one: the reading is taken off records the world already keeps, and the
// CALLER takes it, because the caller is the layer that holds them.
//
//   for a person   whatever already answers "will this person go along with
//                  something they did not choose" - their wants, and their
//                  standing toward whoever is in the room. Somebody whose want
//                  this forecloses, or who is tied to the people watching, does
//                  not kneel.
//   for a beast    `BeastNatureSchema` already grades what kind of problem a
//                  thing is, and `territorial` is the one that dies where it
//                  stands. Written as its nature, and needing no new field.
//
// This module holds the SHAPE of that answer and the consequence of it, so that
// both callers say it the same way and neither invents a scale.
// ─────────────────────────────────────────────────────────────────────────

export interface WhetherTheyYield {
    /** False when they would rather die, and they then do. */
    willYield: boolean;
    /**
     * The record the reading was taken off, in the caller's own words -
     * "the want this forecloses", "territorial", "their own house is watching".
     * Engine-authored fact. It exists so a refusal can be stated rather than
     * reported as a failure.
     */
    because: string;
}

/**
 * The ordinary reading, for a caller with nothing to go on.
 *
 * Most people beaten badly enough do yield, so the default is that they do -
 * and it is a DEFAULT rather than a rule, which is what leaves the interesting
 * case reachable. A caller that holds the record says otherwise and is believed.
 */
export const ORDINARILY_YIELDS: WhetherTheyYield = Object.freeze({
    willYield: true,
    because: 'nothing on the record says this is somebody who would rather die'
});
