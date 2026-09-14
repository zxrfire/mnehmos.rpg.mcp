/**
 * What a beast wants, which is what it wanted before it could say so.
 *
 * `createNpc` hands every row `goals: []` and nothing filled one in, so the
 * whole want layer answered nothing about a beast:
 * `whatTheyWantThatYouCouldReach` found no row to make an asker part of,
 * `whatSomebodyIsAfter` had nothing to read out, and `givingYourWordToDoIt`
 * fell through to *"nothing in the world says what they want done, so what was
 * undertaken is what you said it was"* - the player writing the terms of a
 * service on behalf of the person they were doing it for.
 *
 * ── THE WANT DOES NOT BEGIN AT THE CROSSING ─────────────────────────────
 *
 * The first cut of this file rolled a human goal for a beast that had stood up,
 * out of a pool of person-shaped wants. The design owner overruled it: *"i mean
 * maybe a beast likes raising small animals and that's what they do as a
 * person"*, and *"there's no reason the goals suddenly shift"*.
 *
 * So a changed beast does not acquire a person's wants. It has the wants it
 * already had, in a shape that can now hold a name, a house and other people.
 * The human form is a new set of MEANS and not a new set of ENDS. That makes
 * the want a fact about the animal, which makes it derivable from the species
 * row and writable the moment the row exists - at the core, twelve rungs below
 * the change - and it makes the crossing a thing that happens to the creature
 * holding the want rather than to the want.
 *
 * The spread in *"maybe they wanna rob, maybe they wanna raise orphans"* is
 * therefore not a spread to roll on. It is the spread of what different animals
 * already want, carried across: a thing that hunted people for what they carry
 * goes on wanting what they carry, and a thing that kept its own alive goes on
 * keeping something alive.
 *
 * ── ONE COLUMN PER JOB, WHICH IS THE PRECEDENT ──────────────────────────
 *
 * `WHAT_IT_REACHES_FOR` in `a-beast-that-took-a-shape-is-somebody.ts` keys
 * manner on `ability.kind` because *"a creature deals with a person the way it
 * has always dealt with everything"*. A want is that argument one step further,
 * and this file follows the same shape rather than writing a second one: three
 * tables, each keyed on a column the catalog already has, each doing one job.
 *
 *     `nature`        what its life consists of, and therefore what it wants.
 *                     The catalog's own gloss on `ambush` is that it *"has
 *                     worked out that cultivators are worth more than deer"*,
 *                     and on `herd` that tides come out of them - so the two
 *                     ends of the design owner's range are already written
 *                     down as enum values.
 *     `veinRelation`  what it has got to, because how far along a want is
 *                     depends on whether the thing it is about is ground.
 *     `disposition`   what is in the way, because an obstacle is somebody
 *                     else's claim and this is the column about whose claim.
 *
 * No `beast.id` appears anywhere below. A row added to the catalog gets a want
 * without this file being edited, and two species with the same columns want
 * the same kind of thing, which is correct.
 *
 * ── AND THE TEXT SAYS THE WANT AND NOTHING ELSE ─────────────────────────
 *
 * Nothing here mentions a human shape, a voice, or a house, because the row is
 * written below the change and has to still be true above it. A line that said
 * *"and can now say so in words"* would be a goal that shifts at the crossing,
 * which is the thing that was overruled.
 *
 * `WHAT_GIVES_A_CHANGED_BEAST_AWAY.neverAList` governs this area. A want is a
 * fact. A personality is not, and there is no table of either below.
 */

import type { Beast } from '../../data/cultivation/beasts.js';
import type { GoalInput } from './npc-state.js';

/** What it wants, keyed on what its life consists of. */
interface WhatItIsAfter {
    kind: GoalInput['kind'];
    said: string;
    /** What it drops other things for. A fact about the want, not a mood. */
    priority: number;
}

/**
 * One row per `nature`, which is the catalog's own statement of what sort of
 * creature this is before anything about its strength.
 */
const WHAT_ITS_LIFE_IS_FOR: Readonly<Record<Beast['nature'], WhatItIsAfter>> = Object.freeze({
    ordinary: {
        kind: 'survival',
        said: 'Wants to go on standing where it is standing. It has no business with anybody '
            + 'and has never started anything.',
        priority: 0.4
    },
    herd: {
        kind: 'protection',
        said: 'Wants the small things that came up alongside it kept fed and kept alive. It has '
            + 'spent its whole life doing that and has never done anything else.',
        priority: 0.8
    },
    ambush: {
        kind: 'wealth',
        said: 'Wants what the people crossing here are carrying. It worked out a long time ago '
            + 'that they are worth more than the animals, and it has taken from them since.',
        priority: 0.7
    },
    territorial: {
        kind: 'protection',
        said: 'Wants everything off the ground it holds. It has held that ground against every '
            + 'single thing that wanted it and has not once given any of it up.',
        priority: 0.9
    },
    intelligent: {
        kind: 'status',
        said: 'Wants the houses whose ground touches this to deal with it the way they deal '
            + 'with each other. They send hunting parties instead.',
        priority: 0.75
    },
    ancient: {
        kind: 'reunion',
        said: 'Wants to find what is left of the world it was awake in. Everything it ever '
            + 'dealt with is under what has been built on top of it.',
        priority: 0.6
    }
});

/**
 * How far along it is, keyed on what it does with the ground.
 *
 * The same column `WHAT_IT_WANTS` reads in the manner file, doing a different
 * job here: whether a want has got anywhere depends on whether the thing it is
 * about is a piece of earth that stays where it is.
 */
const WHERE_IT_HAS_GOT_TO: Readonly<Record<Beast['veinRelation'], string>> = Object.freeze({
    holds: 'Has it, and has had it for centuries. What is left is keeping it.',
    drains: 'Has taken what is nearest and is working outward from there.',
    follows: 'Has been at it on four or five pieces of ground and is on this one now.',
    indifferent: 'Has got as far as anything gets that does not begin with a piece of ground.'
});

/**
 * What is in the way, keyed on who pays and whether they agreed.
 *
 * `disposition` is the houses' own three-way axis and means here what it means
 * everywhere, so the obstacle is stated as somebody else's claim rather than as
 * a difficulty. Singular lists: one obstacle that is true beats three that are
 * filler, and `whatIsInTheWay` prints whatever is here verbatim.
 */
const WHOSE_CLAIM_IS_IN_THE_WAY: Readonly<Record<Beast['disposition'], string>> = Object.freeze({
    righteous: 'Nothing it wants can be taken from anybody who has not agreed to it, and '
        + 'nobody has agreed to anything.',
    neutral: 'Everything it wants is already priced by somebody, and it has not been in a '
        + 'position to pay.',
    demonic: 'What it takes it takes first, so every party it could deal with has a reason '
        + 'not to.'
});

export interface WhatThisOneIsAfter {
    beast: Beast;
    /** The ground it holds. What a ground-facing want points at. */
    locationId: string;
}

/**
 * Whether the thing it wants is the piece of earth it is standing on.
 *
 * `whatTheyWantThatYouCouldReach` reads `targetId` against the asker and the
 * asker's house, so a want that is genuinely about ground says so and the rest
 * point at nothing rather than at something invented.
 */
export function itsWantIsAboutTheGround(beast: Beast): boolean {
    return beast.veinRelation === 'holds' || beast.veinRelation === 'drains';
}

/**
 * The one thing this beast is after.
 *
 * ONE GOAL, NOT A SET, and it is derived rather than drawn. There is no roll
 * here at all: a species' want is a fact about the species the way its element
 * is, and two of these on two mountains want the same thing because they are
 * the same animal. What differs between them is everything else the world has
 * done to them.
 *
 * Every branch is total over an enum, so this never returns null and no caller
 * needs a case for a creature that wants nothing.
 */
export function whatThisOneHasAlwaysWanted(input: WhatThisOneIsAfter): GoalInput {
    const after = WHAT_ITS_LIFE_IS_FOR[input.beast.nature];
    return {
        kind: after.kind,
        text: after.said,
        priority: after.priority,
        progress: WHERE_IT_HAS_GOT_TO[input.beast.veinRelation],
        obstacles: [WHOSE_CLAIM_IS_IN_THE_WAY[input.beast.disposition]],
        targetId: itsWantIsAboutTheGround(input.beast) ? input.locationId : null
    };
}
