/**
 * How far you went to make somebody comply.
 */

// TYPE-ONLY, and must stay so. `grudges.ts` is the ledger's vocabulary and this
// module borrows a word from it rather than minting a parallel one; a value
// import would tie the cultivation package to the social package for nothing.
import type { ObligationCause } from '../social/grudges.js';
import { isPermanentWound, woundsTheCultivation } from '../../data/cultivation/wounds.js';

// THE LEVEL

export type PressureLevel =
    /** Words. A promise of harm. Costs the target nothing yet. */
    | 'said'
    /** Hands. Harm applied to get compliance. */
    | 'done'
    /** The will, taken. An ancient art, and never a verb. */
    | 'taken';

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
 * AT `done`, THE WOUND DECIDES, and it decides two things. Whether it heals
 * decides whether the record is heavier by a step. WHAT it is decides what the
 * ledger calls it: a crippling is a wound to the cultivation itself - its
 * channels, foundation, core or soul - and never a lost limb. The design owner:
 * *"depends on the wound. losing an arm is not a crippled cultivator."* Somebody
 * who lost an arm carries an `injury` that does not heal.
 */
export function whatALevelLeaves(input: {
    level: PressureLevel;
    /**
     * The worst lasting wound the harm left, by its wound key (`woundType` on the
     * injury row). Absent or null: nothing that stays.
     */
    wound?: { woundType: string | null } | null;
    /** True when they were told first and refused. The escalation pair. */
    wordGivenFirst?: boolean;
}): WhatALevelLeaves {
    const wound = input.wound ?? null;
    const permanent = wound !== null && isPermanentWound(wound.woundType);
    const toTheCultivation = permanent && woundsTheCultivation(wound!.woundType);
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
                // held down and let up carries a humiliation; somebody whose
                // cultivation will not mend carries a crippling; somebody short a
                // limb carries an injury, and it is not a crippling.
                cause: toTheCultivation ? 'crippled' : permanent ? 'injury' : 'humiliation',
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
                    + (toTheCultivation
                        ? 'What was done to their cultivation does not mend, so the record is heavier '
                          + 'by a step.'
                        : permanent
                            ? 'What was done to their body does not heal, though their cultivation is '
                              + 'whole, so the record is heavier by a step.'
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
 */
export const ORDINARILY_YIELDS: WhetherTheyYield = Object.freeze({
    willYield: true,
    because: 'nothing on the record says this is somebody who would rather die'
});
