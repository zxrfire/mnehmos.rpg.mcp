/**
 * The qi a crossing lends back to the ground it happened on, and how long the
 * loan runs.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT A CROSSING GIVES BACK
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Somebody going through the Lid is the largest thing that can happen here, and
 * the reason is not the person. A late, thinning world gets some of its qi
 * back, in the area they crossed in, and the ground is the only witness that
 * cannot be misremembered.
 *
 * The repository has said what the giving-back IS for a long time, in four
 * files, without anything ever writing it into the world:
 *
 *   `ambient.ts`               "Spirit tides are NOT geology - somebody
 *                              ascending is not a property of the ground under
 *                              your feet", and "A tide is somebody finishing".
 *   `birth.ts`                 "`spirit_tide` is somebody finishing rather than
 *                              a property of a place."
 *   `price-of-advancement.ts`  the True Immortal toll, which takes everything
 *                              the cultivator still had: "What falls back is a
 *                              spirit tide."
 *   `crossings.ts`             what the world sees when the Hollow Court
 *                              crosses: "A spirit tide, arriving without
 *                              warning and without explanation."
 *
 * So the mechanism was never in question. What was missing was a writer.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * FAILURE TAKES GROUND FOREVER AND SUCCESS ONLY LENDS IT BACK
 * ═════════════════════════════════════════════════════════════════════════
 *
 * That sentence is why {@link CROSSING_ENRICHMENT_YEARS} is finite, and it is
 * the thing to read before changing the number.
 *
 * `locationFromScar` in `locations.ts` is this module's mirror, written first
 * and pointing the other way: a FAILED tribulation makes a permanent `scar`
 * location at `spiritualDensity: 0`, tagged `permanent`, whose own special rule
 * is "the qi does not return here". A COMPLETED crossing does the opposite and
 * does not do it permanently.
 *
 * The asymmetry is load-bearing, because the alternative contradicts the
 * setting's own economics. `docs/world/climbing/past-the-ceiling.md` states the
 * premise the whole Hollow Court admission bar is derived from:
 *
 *     "The qi is the finite thing - you can build another room and you cannot
 *      make another vein."
 *
 * A permanent enrichment makes a new vein and takes that sentence with it. A
 * loan of 999 years does not: the ground is richer for a while, and then it is
 * what it always was.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT PUTS A MECHANISM UNDER THE LATE AGE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The setting's premise is a world running thin, and until now that was
 * asserted: an era density that only falls, because it only falls.
 *
 * Under this rule the thinning is not qi vanishing. **It is the last crossings
 * running out, with nobody new finishing to lend any back.** Every rich patch
 * on the map is a loan somebody took out by leaving, and the Late Age is what
 * it looks like when the last of them is most of the way repaid. That is the
 * same fact the setting already states, with something underneath it - and it
 * is the reason the number is 999 rather than permanent. Make it permanent and
 * the world stops being able to thin at all.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * 999 YEARS IS TWO DIFFERENT FACTS AT THE TWO ENDS OF THE LADDER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * To somebody above the Lid, whose span runs to the hundreds of thousands, 999
 * years is a short loan and barely worth noting. To everybody below it, it is
 * beyond any life and beyond nearly every institution - the Ashen Forge Clan's
 * eleven generations at the furnace do not reach it.
 *
 * **The same number is a footnote at one end and the shape of a province at the
 * other.** That is the time-scale asymmetry the setting runs on everywhere
 * else, and it is why the duration is stated in YEARS and must stay stated in
 * years. Expressing it as a fraction of a span, a count of generations or a
 * number of eras collapses exactly the thing it is for.
 *
 * PURE. Arithmetic only - no state, no I/O, no RNG. This file is a leaf so that
 * `locations.ts` can build a crossing's ground from it without either of them
 * importing the other's world.
 */

import { stageCeilingFor, type KnowingStage } from '../social/discovery.js';
import { clampQiDensity, QI_DENSITY_MAX } from './qi-scale.js';

/**
 * How long the ground stays richer for, in years.
 *
 * **Failure takes ground forever and success only lends it back.** That is the
 * reason this is a number and not `Infinity`, and it is the sentence to read
 * before rounding it up: a permanent enrichment makes a new vein, and the
 * setting's own economics say you cannot make one.
 */
export const CROSSING_ENRICHMENT_YEARS = 999;

/**
 * What the ground reads at the moment of the crossing.
 *
 * `QI_DENSITY_MAX` is the ceiling below the Lid - the Hollow Court's own
 * mountain - and for a while the ground somebody crossed from is the best in
 * the world, which is the whole of what a spirit tide is. Anchored on the
 * ceiling rather than on a figure invented here, so nothing can be enriched
 * past what the world already calls the top.
 */
export const CROSSING_ENRICHMENT_PEAK = QI_DENSITY_MAX;

/**
 * How much of the loan is still in the ground: 1 at the crossing, 0 at
 * {@link CROSSING_ENRICHMENT_YEARS}.
 *
 * LINEAR, and the choice is worth stating because two other decay shapes exist
 * in this repository and neither fits.
 *
 *   `wardIntegrityOf` in `how-far-gone-a-formation-is.ts` is an exponential
 *   half-life. It never reaches zero, so it cannot express a loan that is
 *   repaid on a stated year - which is the whole of the ruling.
 *
 *   `airtimeOf` in `what-people-are-saying.ts` subtracts `years / 400` up to a
 *   clamp. That IS a linear ramp to a floor over a stated number of years, and
 *   it is the shape reused here.
 *
 * A prettier curve was available and was rejected for a storage reason rather
 * than an aesthetic one: `LocationChange` records dated STATES, not functions,
 * so a curve would have to be re-derived by every reader from a formula none of
 * them import, or approximated by steps anyway. A straight line between two
 * dated changes is a thing the layer can hold, and it is honest about its own
 * resolution.
 */
export function crossingEnrichmentRemaining(yearsSinceCrossing: number): number {
    if (!Number.isFinite(yearsSinceCrossing)) return 0;
    const elapsed = Math.max(0, yearsSinceCrossing);
    if (elapsed >= CROSSING_ENRICHMENT_YEARS) return 0;
    return 1 - elapsed / CROSSING_ENRICHMENT_YEARS;
}

/** True while there is anything left in the ground to find. */
export function crossingStillGiving(yearsSinceCrossing: number): boolean {
    return crossingEnrichmentRemaining(yearsSinceCrossing) > 0;
}

/**
 * The density this ground reads at, this many years after a crossing on it.
 *
 * Never below the ground's own geology - a crossing lends, it does not take -
 * and never above the world's ceiling.
 */
export function enrichedDensity(ownDensity: number, yearsSinceCrossing: number): number {
    const base = clampQiDensity(ownDensity);
    const headroom = Math.max(0, CROSSING_ENRICHMENT_PEAK - base);
    return clampQiDensity(base + headroom * crossingEnrichmentRemaining(yearsSinceCrossing));
}

// ─────────────────────────────────────────────────────────────────────────
// WHO KNOWS WHAT A TIDE ACTUALLY IS
//
// The record says a vein shifted or a seal failed, and that is not the world
// being kept in the dark - it is what a document written by people whose
// grandparents were not born yet honestly says. But a crossing is once in an
// age and the top of the ladder lives across ages, so the fact is not out of
// reach. It is out of LIVING MEMORY for nearly everybody, which is a different
// claim and a much better one.
//
// Three states, no fourth, and no partial credit:
//
//   SAW IT      alive when it happened. The long-lived, at the top. Firsthand,
//               and `stageCeilingFor('witnessed')` is what that reaches.
//   WAS TOLD    standing close enough to one of those to have been told - an
//               apex's disciples, a house's inner people. They know the
//               MECHANISM and were not there, which is exactly the told
//               ceiling and not a lesser version of firsthand.
//   THE RUMOUR  everybody else, and they have not seen one. An ordinary person
//               has no direct experience of a crossing at all, and neither did
//               anybody they knew. Being near a tide teaches you that a tide
//               happened, never what one IS.
//
// **This inverts the ladder in a way the setting likes.** A wandering
// cultivator at rung 30 with nobody to have been told by may not know. An apex
// outer disciple at rung 12 does. The knowledge is a marker of proximity to
// power rather than of personal height - the same shape as a village carter not
// knowing the Standing Edge from any other sword while the house that lost it
// knows it across a courtyard.
//
// Derived, never stored: the inputs are the crossing's date and facts the world
// already keeps about a person. There is no `knowsAboutTides` field and there
// must not be one.
// ─────────────────────────────────────────────────────────────────────────

/** What somebody brings to the question, in facts the world already holds. */
export interface WhatTheyBringToATide {
    /** Their age in years. Compared against how long ago the crossing was. */
    ageYears: number;
    /**
     * Somebody in reach who was alive for it and would say so - an elder of
     * their house, a master, anybody they stand close enough to.
     *
     * A caller answers this off the roster it already has. It is deliberately
     * not a membership test: what buys the telling is having somebody to be
     * told BY, and an apex's people simply have one.
     */
    hasSomebodyWhoSawIt: boolean;
}

/**
 * How well this person can know what the tide on that ground actually was.
 *
 * Both ceilings come from `stageCeilingFor`, so this adds no scale of its own -
 * it decides which SOURCE somebody has and lets the knowledge layer say what
 * that source is worth. A caller wanting the reading in prose asks the
 * knowledge layer with the stage this returns.
 */
export function whoCouldRememberACrossing(
    yearsSinceCrossing: number,
    who: WhatTheyBringToATide
): KnowingStage {
    if (who.ageYears >= yearsSinceCrossing) return stageCeilingFor('witnessed');
    if (who.hasSomebodyWhoSawIt) return stageCeilingFor('told');
    // Not "half remembers". They have never seen one, and the ground changing
    // is the whole of the evidence they ever had to reason from.
    return 'whisper';
}
