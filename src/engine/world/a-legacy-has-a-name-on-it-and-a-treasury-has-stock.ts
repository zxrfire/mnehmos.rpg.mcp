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
import { TECHNIQUES, type TechniqueProvenance } from '../../data/cultivation/techniques.js';

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
    return theArtsWrittenDownIn(location, { provenance: 'ruin', howMany: 1 })[0] ?? null;
}

/**
 * The same reading, without the legacy gate and for more than one book.
 *
 * ONE READING, and this is the one. A legacy hands over the deepest art the
 * ground supports; so does a shelf in an archive, and so does the arrangement
 * behind a sealed door - the question *what is written down in here* does not
 * change because of how the place is closed. The gate above decides whether
 * anybody left a BEQUEST; it was never a statement about what is on the paper.
 *
 * A second derivation of this was written beside it and deleted: two functions
 * choosing which ruin-provenance art a piece of ground holds would have
 * disagreed the first time either the bar or the exclusion moved, and
 * `survivingCopy` is exactly the sort of exclusion the second copy forgot.
 *
 * Deepest first, then downward, so a shelf is the builder's own road with what
 * they had finished with under it. One stream per piece of ground, drawn in
 * order, so the first book a caller asks for is the book the single-art caller
 * above has always got.
 *
 * `provenance` because an ossuary is a body rather than a shelf, and the catalog
 * already has a separate word for what comes off one.
 *
 * `onlyWhatStopsSomewhere` because a SHELF is a list of books and a book stops
 * somewhere - the line `manualsOf` already draws, and for its reason: eight arts
 * in the catalog state no rung they stop at and those are not shelf stock. A
 * LEGACY draws no such line, and must not: the summit arts are exactly what a
 * bequest at that height hands over. Measured without it - ground calibrated at
 * 46 had three uncapped arts standing above every book in the catalog, so its
 * shelf came back empty and the deepest ground in the world held no manual at
 * all.
 */
export function theArtsWrittenDownIn(
    location: LocationRecord,
    input: {
        provenance: TechniqueProvenance;
        howMany: number;
        onlyWhatStopsSomewhere?: boolean;
    }
): string[] {
    const { provenance, howMany } = input;
    if (howMany <= 0) return [];
    const bar = theRungThisWasSetFor(location);
    const eligible = TECHNIQUES
        .filter(t => t.provenance === provenance && t.survivingCopy && t.requiredOrdinal <= bar)
        .filter(t => !input.onlyWhatStopsSomewhere || t.cap != null)
        .map(t => ({ id: t.id, opens: Number(t.requiredOrdinal ?? 0) }))
        .sort((a, b) => b.opens - a.opens || (a.id < b.id ? -1 : 1));
    if (eligible.length === 0) return [];

    const rng = forStream('a-legacy-in-the-ground', location.id);
    const out: string[] = [];
    let at = 0;
    while (out.length < howMany && at < eligible.length) {
        const opens = eligible[at].opens;
        const tied: string[] = [];
        while (at < eligible.length && eligible[at].opens === opens) tied.push(eligible[at++].id);
        while (tied.length > 0 && out.length < howMany) {
            out.push(tied.splice(rng.int(0, tied.length - 1), 1)[0]);
        }
    }
    return out;
}
