/**
 * Ground that never shut is one of two things, and the row already says which.
 *
 * The design owner, settling what these places hold: some of them have
 * legacies, others are treasuries, and a legacy gives *"exactly the same
 * thing"* the arts already in the ground give - the read channel, not a new
 * prize.
 *
 *   A LEGACY    somebody left their art for whoever could take it. What comes
 *               off it is a technique, through `prizeTechniqueIds` ->
 *               `handleLearn(provenance: 'found_in_place')`, the same road an
 *               authored trial's prize takes.
 *   A TREASURY  what is in it is things. What comes off it is whatever is
 *               standing there in `state.objects`, through
 *               `transferPossession`.
 *
 * ── DERIVED, NOT DRAWN ───────────────────────────────────────────────────
 *
 * `howThisGroundIsKept` already answers never-shut off two columns: a hoard
 * behind it, and a name still on it. `A_NAME_IS_STILL_ON_IT` admits two
 * provenance standings, and the gap between them is exactly this question.
 *
 *   documented   the world holds a written record of who built it, and the
 *                record survived. A name on the thing. Somebody meant it to be
 *                read afterwards, which is what a bequest is.
 *   attributed   the province says whose compound that was. A name on the
 *                GROUND, and nothing on what is in it. A store of goods that
 *                outlived the house that stocked it.
 *
 * So this adds no draw, no column and no catalog. It reads `provenanceStanding`,
 * which `ruinProvenance` has written on every ruin since ruins existed.
 *
 * The other candidate was the hoard's own composition - `techniqueCount`
 * against `treasureCount`, both on the same row - and it was measured and
 * dropped. The generator draws 1..3 manuals and 0..2 objects, and a hoard has
 * to reach four to never shut at all, so every never-shut ground in nine pinned
 * worlds came back 3m/2o, 3m/1o or 2m/2o. No ground anywhere holds more objects
 * than manuals, and a rule that sorts thirteen places into thirteen and none is
 * not a rule.
 *
 * Measured on the same nine worlds: 13 never-shut grounds, 3 documented and 10
 * attributed, so roughly a quarter of the category is somebody's bequest.
 */

import type { LocationRecord } from './locations.js';
import { forStream } from '../cultivation/rng.js';
import { TECHNIQUES } from '../../data/cultivation/techniques.js';

/**
 * Which of the two this ground is.
 *
 * `a_treasury` is the answer for anything that is not a legacy, including
 * ground that never shut for no reason this module can see - there is no third
 * value, because a place with a hoard in it that is not somebody's bequest is a
 * store of goods by elimination.
 */
export type WhatWasLeftHere = 'a_legacy' | 'a_treasury';

/** The provenance standing at which the world can still read a builder's name. */
export const A_NAME_IS_ON_THE_THING = 'documented';

/**
 * What this ground was left holding.
 *
 * Answers for any ruin. Callers that only want the never-shut population filter
 * on `LEFT_TO_BE_FOUND` first: this deliberately does not, because the same
 * question is worth asking of a sealed site somebody is about to open.
 */
export function whatThisGroundWasLeftHolding(location: LocationRecord): WhatWasLeftHere {
    return location.data.provenanceStanding === A_NAME_IS_ON_THE_THING
        ? 'a_legacy'
        : 'a_treasury';
}

/**
 * The rung whoever left this was standing at, which is what the trial inside
 * was calibrated for.
 *
 * `locationFromRuin` writes the ruin's `dangerOrdinal` into `thresholds.mastery`
 * and nothing else carries it, so this is a read of that rather than a second
 * copy of the figure.
 */
export function theRungThisWasSetFor(location: LocationRecord): number {
    return location.thresholds.mastery;
}

/**
 * The art written down in this ground, or null where there is none.
 *
 * NO NEW LIST AND NO NEW PRIZE. `TechniqueProvenance` already sorts the catalog
 * into `taught`, `grave` and `ruin`, and `ruin` is defined as the arts no
 * living institution can transmit - every chaos-grade art by rule, most of
 * immortal, and the heaven arts the surviving houses lost the manual for. That
 * set IS what a legacy hands over, and it is the same set an authored trial's
 * `prize.techniqueIds` draws from.
 *
 * `survivingCopy` is the one exclusion: `NO_SURVIVING_COPY_TECHNIQUE_IDS` says
 * the record attests the art and no copy of it is anywhere in the world, so a
 * ground holding one would be the world contradicting itself in two files.
 *
 * THE DEEPEST THE GROUND SUPPORTS, because somebody left THEIR OWN art and
 * their own art sits at their own rung. `thresholds.mastery` is the rung the
 * trials were calibrated for, which is the rung the builder stood at, and an
 * art demanding more of a reader than the trial demands of a claimant is an art
 * whoever built the place could not have been carrying. Where several sit at
 * that depth the ground's own stream picks, so two legacies of one height are
 * not the same book.
 *
 * Null below the shallowest ruin-only art in the catalog. That is a legacy with
 * nothing in it the world still holds a copy of, and it is left as stock.
 */
export function theArtLeftInThisGround(location: LocationRecord): string | null {
    if (whatThisGroundWasLeftHolding(location) !== 'a_legacy') return null;
    const bar = theRungThisWasSetFor(location);
    const eligible = TECHNIQUES
        .filter(t => t.provenance === 'ruin' && t.survivingCopy && t.requiredOrdinal <= bar);
    if (eligible.length === 0) return null;
    const deepest = eligible.reduce((top, t) => Math.max(top, t.requiredOrdinal), 0);
    const atThatDepth = eligible
        .filter(t => t.requiredOrdinal === deepest)
        .map(t => t.id)
        .sort();
    return atThatDepth[
        forStream('a-legacy-in-the-ground', location.id).int(0, atThatDepth.length - 1)
    ];
}
