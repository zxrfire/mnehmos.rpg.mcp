/**
 * How far somebody can fold space, what it costs them, and what it does not buy.
 *
 * THE RULING THIS IMPLEMENTS
 * --------------------------
 * High cultivators do not travel. They fold space, and the range increases with
 * ordinal. `spatial_folding` has been a `CapabilityGrant` on the Void Refinement
 * class since the capability layer was written, and until now it was a switch
 * with exactly one consumer - `convergence.ts`, which uses it as the way to
 * leave a closing window late. This module is the other half: the thing it is
 * FOR, which is getting somewhere.
 *
 * The unit is a WALKING DAY, because that is what every road in this world is
 * already quoted in - `travelDays` on a `RegionConnection` - and inventing a
 * second unit for distance would be a second opinion about how far apart two
 * places are.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HOUSE OF THE MEASURED SPAN DOES THIS FOR A LIVING, AND IT MATTERS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Read `data/cultivation/history.ts` before changing anything here. An entire
 * institution already moves people without crossing the distance, and its
 * shape decides what a personal fold is allowed to be.
 *
 *   WHAT THE SPAN CAN DO      fold a courier down a route it has SURVEYED, and
 *                             build a one-way gate at ruinous cost. It holds
 *                             nine inherited terminals that still answer and
 *                             did not build any of them.
 *   WHAT IT CANNOT DO         produce an original true-distance measurement. It
 *                             maintains a Wide Age table and has never extended
 *                             it in five thousand years. Its own estimate of
 *                             what working a terminal takes is a realm nobody
 *                             in the world currently occupies.
 *   WHAT IT SELLS             the FIX, not the fold. A courier contract is
 *                             priced per li of TRUE distance, off figures only
 *                             the house can state, for pairs of points nobody
 *                             now living has surveyed.
 *
 * So the binding scarcity in this world is not power. It is knowing where the
 * far end is. That is the constraint this module is built on, and it is why the
 * range curve below is not the whole answer: a fold needs a {@link FoldFix},
 * and there are exactly two, both of them things the folder did themselves.
 *
 * ── The two are different shapes, and neither makes the other pointless ──
 *
 * The Span moves OTHER PEOPLE AND CARGO between FIXED POINTS, for a price, for
 * anybody who can pay, off a table it inherited. A cultivator moves THEMSELVES,
 * from wherever they happen to be standing, to somewhere they have been or can
 * see, and carries nothing and nobody. Neither substitutes for the other, and
 * the reason a Void Refinement cultivator still hires a courier is that a
 * courier can be sent somewhere the cultivator has never been.
 *
 * And note where the ladders sit. The Span's reliable rung is 25 and its Elder
 * Surveyors stall in the mid-twenties, which is BELOW {@link FOLD_FLOOR_ORDINAL}.
 * The house that understands space better than anybody alive mostly cannot fold
 * at all, personally, and works off the table instead. Nothing here changes
 * that, and nothing here may hand a cultivator the table.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT RANGE DOES NOT BUY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/places/ruins.md` already reasons this way - "somebody who can
 * fold space is not a person who explores ruins" - and the discipline is worth
 * keeping, because a capability with no stated limit grows one accidentally.
 *
 *   NOT A KEY          a fold is not a way through a seal, a shut window or a
 *                      barrier. Those are `attempt` blockers in `capability.ts`
 *                      and they are physical. Somewhere that will not open does
 *                      not open because you arrived by a different road.
 *   NOT A SURVEY       you cannot fold to somewhere you have never been and
 *                      cannot see. Being TOLD about a place is not a fix. This
 *                      is the Span's own limit, met from the personal side.
 *   NOT A CARRIER      one person, themselves, and what is on them. No cargo,
 *                      no party, no passenger.
 *   NOT AN ESCAPE      it moves you between places, not out of a grip. Nothing
 *                      here is consulted by combat and nothing here should be.
 *   NOT A LIFE         the sharpest cost, and the one no number carries. A road
 *                      is where encounters, hearsay, and everything AGENTS.md
 *                      means by "having been places and survived things" come
 *                      from. Somebody who folds everywhere has been nowhere,
 *                      and arrives at a crossing that asks what they understood
 *                      with nothing to bring to it. That is the greenhouse rule
 *                      applied to transport, and it needs no penalty because it
 *                      is not one - the experiences simply did not happen.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT IS THE LOUDEST ARRIVAL IN THE WORLD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `what-a-conveyance-does-to-a-journey.ts` establishes that what a party
 * arrives on is read at the gate before anybody speaks, and that the read runs
 * in both directions. A fold is the top of that ladder - on foot, mount or
 * drawn carriage, boat, flight on a blade, fold - and it is also the end of it:
 * there is no quiet version. Nobody saw you on the road, no station logged you,
 * and nothing on the true-distance table was paid for the journey you did not
 * make. See {@link whatArrivingByFoldSays}.
 *
 * PURE. State in, deltas out. No I/O, no DB, no mutation of inputs, and nothing
 * stochastic - how far a fold reaches is not a roll.
 */

import { clampOrdinal } from '../cultivation/realms.js';
import type { CapabilityGrant } from './capability.js';

// ─────────────────────────────────────────────────────────────────────────
// THE GRANT
// ─────────────────────────────────────────────────────────────────────────

/** The grant that makes any of this possible. Void Refinement, and no lower. */
export const FOLD_GRANT: CapabilityGrant = 'spatial_folding';

/**
 * The rung at which folding becomes possible at all.
 *
 * Void Refinement, which is where `CLASS_GRANTS` puts `spatial_folding`. Stated
 * here rather than imported from the class table because it is the anchor the
 * curve below is fitted at, and a test asserts the two agree so that moving the
 * class floor fails loudly and points at this file.
 */
export const FOLD_FLOOR_ORDINAL = 29;

// ─────────────────────────────────────────────────────────────────────────
// THE RANGE
//
// Two anchors and one growth constant, which is the same shape
// `what-you-can-see-from-up-there.ts` uses for the sight horizon - and that is
// the precedent rather than a design invented here. Both curves are in travel
// days, both are fitted through figures the region catalog already states, and
// both saturate against the map instead of against a cap somebody maintains.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a fold reaches at the rung where folding starts, in walking days.
 *
 * Six, and the figure is the catalog's rather than a choice: the shortest
 * stated road between any two provinces is six days. So somebody who has just
 * refined themselves against emptiness can step to the province next door and
 * nowhere else, which is the honest reading of the grant's own word for itself,
 * "short-range".
 *
 * `convergence.ts` prices a full-strength pierce at exactly this figure and now
 * reads it from here, because the two were the same physical fact carried in
 * two constants.
 */
export const FOLD_RANGE_AT_THE_FLOOR = 6;

/**
 * What one more rung is worth, multiplicatively.
 *
 * Fitted through a second anchor rather than picked. The widest road in the
 * world is thirty-four days, and the rung at which somebody stops being gated
 * by places is Grand Ascension at ordinal 37 - `gates_places`, which the
 * capability layer already grants there. Solving 6 x g^8 = 34 gives 1.242, and
 * 1.24 is what is used.
 *
 * What that produces, and none of it was tuned: the reach at the floor of Grand
 * Ascension is 33.5 days, so the widest road in the world is still just out of
 * one step, and one rung further in it is comfortably inside. The realm that
 * stops being gated by places is the realm in which the world stops being wide.
 *
 * The rungs in between land on the roads the catalog actually states - 6, 9,
 * 11, 17, 21 - close enough that almost every rung from the floor to Grand
 * Ascension opens a road that was shut the rung before, which is what makes the
 * curve legible to somebody climbing it rather than merely monotonic.
 *
 * Growth is unbounded and needs no cap. Past ordinal 38 the whole map is inside
 * one step and the differences above that are not measurable in this world's
 * geography, so the curve saturates against the map exactly as the sight
 * horizon does. It has nine rungs of range to say anything with, and it says
 * all of it between Void Refinement and Grand Ascension - which is roughly one
 * person in twenty in a seeded world. A curve that mattered to most people
 * would be a curve fitted to the wrong population.
 */
export const FOLD_RANGE_GROWTH_PER_RUNG = 1.24;

/**
 * How far this rung can fold, in walking days. Zero below the floor.
 *
 * The whole of what the ordinal buys here, and there is no other threshold
 * anywhere in this file. A tenth thing that becomes reachable at a tenth rung
 * needs no branch, because there are no branches on rung at all: there is a
 * curve, and there is a comparison.
 */
export function foldRangeInWalkingDays(ordinal: number): number {
    const o = clampOrdinal(ordinal);
    if (o < FOLD_FLOOR_ORDINAL) return 0;
    return FOLD_RANGE_AT_THE_FLOOR
        * FOLD_RANGE_GROWTH_PER_RUNG ** (o - FOLD_FLOOR_ORDINAL);
}

// ─────────────────────────────────────────────────────────────────────────
// THE FIX
//
// The Span's constraint, met from the personal side, and the single most
// important thing in this module: range says how far, and a fix says whether
// there is anywhere to aim.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How the folder knows where the far end is.
 *
 * Exactly two, and both are things they did themselves. There is deliberately
 * no third for being told, reading a record, or buying a figure: a fix that
 * could be acquired is the Wide Age true-distance table, and an entire house
 * has spent five thousand years failing to reproduce it. Handing one to any
 * cultivator who asks a clerk would delete that house's whole business and the
 * Late Age premise it expresses.
 *
 *   `stood`  they have been there. Exact, and this is what standing somewhere
 *            buys that hearing about it never does.
 *   `seen`   they have made it out from height - a shape on ground, a bearing
 *            and a distance, which is what `what-you-can-see-from-up-there.ts`
 *            yields and is deliberately all it yields. Good enough to arrive
 *            near, never good enough to arrive at.
 */
export type FoldFix = 'stood' | 'seen';

/**
 * How far short a fold lands when the fix is a sighting, as a fraction of the
 * distance folded.
 *
 * A tenth. Note what it is NOT a function of: the folder's rung. The error is
 * in the fix and not in the folder, which is the same reason the Span cannot
 * improve its table by being good at surveying - it can read a distance and it
 * cannot state one. Somebody at the top of the ladder folding twenty days to a
 * valley they have only looked at lands two days out, exactly as somebody at
 * the floor does, and walks the rest.
 */
export const SEEN_FIX_ERROR = 0.1;

/**
 * Walking days still to cover after arriving, for a given fix.
 *
 * Whole days, because a road is a road - the same reasoning `daysByConveyance`
 * gives for never returning a fraction.
 */
export function landsShortByDays(walkingDays: number, fix: FoldFix): number {
    if (fix === 'stood') return 0;
    return Math.ceil(Math.max(0, walkingDays) * SEEN_FIX_ERROR);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Days spent settling after a fold at the very edge of the range.
 *
 * The price is how hard they reached and not how far they went, which is why it
 * is relative to the range rather than absolute: a Grand Ascension cultivator
 * stepping across a district pays nothing worth counting, and somebody at the
 * floor stepping the whole six days pays three.
 *
 * The shape being defended is that A FOLD AT FULL STRETCH IS NOT THE FAST
 * OPTION. Three days over a six-day road is about what a mortal-grade cart
 * does, and a heaven-grade hull beats it outright - so the conveyance ladder
 * keeps its top rungs, and folding stays what it is: the thing you do when
 * there is no road, no hull, no time and nobody you want to be seen by.
 */
export const SETTLING_DAYS_AT_FULL_STRETCH = 3;

/**
 * Days lost to settling, quadratic in how much of the range was spent.
 *
 * Quadratic rather than linear on purpose, and it is what stops the range being
 * a cliff: comfortably inside the range a fold costs the one day everything in
 * this engine costs, near the edge it costs real time, and past the edge it is
 * simply a distance the folder does not have. Three answers where the grant
 * used to give two.
 */
export function settlingDaysFor(walkingDays: number, rangeDays: number): number {
    if (rangeDays <= 0) return 0;
    const spent = Math.max(0, walkingDays) / rangeDays;
    return Math.ceil(SETTLING_DAYS_AT_FULL_STRETCH * spent * spent);
}

// ─────────────────────────────────────────────────────────────────────────
// PRICING ONE FOLD
// ─────────────────────────────────────────────────────────────────────────

export interface FoldInput {
    ordinal: number;
    /**
     * What this cultivator actually holds.
     *
     * Potential is decided by realm and possession is decided here, the same
     * division `capability.ts` keeps. A partial refinement is at the rung with
     * the grant taken back, and this is where that reaches the road.
     */
    heldGrants?: readonly CapabilityGrant[];
    /** What the road costs on foot. `travelDays` on a `RegionConnection`. */
    walkingDays: number;
    fix: FoldFix;
}

export interface FoldCost {
    /** How far this rung reaches today, in walking days. */
    rangeDays: number;
    /** Whether the far end is inside it. */
    withinRange: boolean;
    /** False for everybody who does not hold the grant, which is nearly everybody. */
    canFoldAtAll: boolean;
    /** Walking days still to cover on arrival. Zero where they have stood there. */
    landsShortBy: number;
    /** Days lost to settling. Never fractional, never zero. */
    settlingDays: number;
    /** Everything the fold costs, in days. Compare against `walkingDays`. */
    daysSpent: number;
    /** Days saved against walking it. The figure that makes a rung legible. */
    daysSavedAgainstWalking: number;
    /** What a watcher at the far end reads off the arrival. Never blank. */
    arrivalReads: string;
    /** The honest sentence, including when the answer is no. */
    reason: string;
}

/**
 * Price one fold.
 *
 * Deterministic. How far somebody can fold is not a roll, and neither is what
 * it takes out of them.
 *
 * Beyond the range this returns `withinRange: false` and is NOT a refusal - it
 * is a distance. Nothing anywhere stops the cultivator setting out on the road
 * like everybody else, and the engine's job here is to say what each way of
 * getting there costs rather than to decide which one they take.
 */
export function priceFold(input: FoldInput): FoldCost {
    const rangeDays = foldRangeInWalkingDays(input.ordinal);
    const holds = (input.heldGrants ?? []).includes(FOLD_GRANT);
    const canFoldAtAll = rangeDays > 0 && holds;
    const walkingDays = Math.max(0, Math.ceil(input.walkingDays));

    if (!canFoldAtAll) {
        return {
            rangeDays: holds ? rangeDays : 0,
            withinRange: false,
            canFoldAtAll: false,
            landsShortBy: 0,
            settlingDays: 0,
            daysSpent: walkingDays,
            daysSavedAgainstWalking: 0,
            arrivalReads: '',
            reason: rangeDays <= 0
                ? 'Space does not fold for them. It is a road, and it is as long as it is.'
                : 'They stand high enough for it and it is not theirs. Whatever they refined '
                    + 'themselves against, it was not this.'
        };
    }

    if (walkingDays > rangeDays) {
        return {
            rangeDays,
            withinRange: false,
            canFoldAtAll: true,
            landsShortBy: 0,
            settlingDays: 0,
            daysSpent: walkingDays,
            daysSavedAgainstWalking: 0,
            arrivalReads: '',
            reason: `${walkingDays} days of road against ${rangeDays.toFixed(1)} days of reach. `
                + 'It is not a refusal, it is a distance: they go the way everybody goes, or they '
                + 'go part of the way and fold the rest.'
        };
    }

    const landsShortBy = landsShortByDays(walkingDays, input.fix);
    const settlingDays = settlingDaysFor(walkingDays, rangeDays);
    const daysSpent = Math.max(1, settlingDays + landsShortBy);

    return {
        rangeDays,
        withinRange: true,
        canFoldAtAll: true,
        landsShortBy,
        settlingDays,
        daysSpent,
        daysSavedAgainstWalking: Math.max(0, walkingDays - daysSpent),
        arrivalReads: whatArrivingByFoldSays(landsShortBy),
        reason: input.fix === 'stood'
            ? `${walkingDays} days of road inside ${rangeDays.toFixed(1)} days of reach, to `
                + `ground they have stood on. They arrive where they meant to, and ${settlingDays} `
                + `day${settlingDays === 1 ? '' : 's'} of them is somewhere else for a while.`
            : `${walkingDays} days of road inside ${rangeDays.toFixed(1)} days of reach, to `
                + `something they have only looked at. They come out ${landsShortBy} day`
                + `${landsShortBy === 1 ? '' : 's'} short of it and walk the rest, which is what `
                + 'a sighting is worth and what having stood somewhere is worth instead.'
    };
}

/**
 * What arriving this way says about somebody, before a word is spoken.
 *
 * The same axis as a spirit boat and a delegation on foot, and the end of it.
 * One sentence, engine-authored, no branch on faction or title anywhere.
 */
export function whatArrivingByFoldSays(landsShortBy: number): string {
    const walked = landsShortBy > 0
        ? ' They walked the last of it, which fools the gate and nobody who counts days.'
        : '';
    return 'They were not on the road. Nobody passed them, no station wrote them down, and '
        + 'nothing was paid at true distance for a journey that was not made - which is the one '
        + 'arrival in this world that cannot be arranged, borrowed or faked.' + walked;
}

/**
 * Whether this cultivator could get there in one step. The single question a
 * caller most often has.
 */
export function couldFoldThere(
    ordinal: number,
    heldGrants: readonly CapabilityGrant[] | undefined,
    walkingDays: number
): boolean {
    return priceFold({ ordinal, heldGrants, walkingDays, fix: 'stood' }).withinRange;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES NOT REACH YET
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recorded rather than quietly left, the way `SEA_CROSSING_ENGINE_GAP` is.
 *
 * The seam this belongs in does not carry distance yet. `move` in
 * `src/web/game.ts` spends a flat `SHORT_ACTION_DAYS = 1` for any journey to
 * anywhere, so the player's own travel has no length in it at all - while
 * `destinations` in the same file prints the catalog's `travelDays` beside
 * every province, which is the honest figure. Nothing in the running world
 * currently spends a walking day.
 *
 * So a saving cannot be shown to a player without printing a number the engine
 * does not charge. `priceFold` returns the same shape `priceJourney` does -
 * days one way, days saved, what the arrival reads - so that the fold drops in
 * as the top rung of the conveyance ladder the moment that seam prices a road,
 * and not before.
 */
export const FOLD_TRAVEL_ENGINE_GAP = {
    what: 'No journey in the running game is priced in walking days, so the range curve above saves nobody any time yet.',
    whereItWouldGo: 'The move handler in src/web/game.ts, which spends SHORT_ACTION_DAYS for every journey regardless of distance, and bestForThisRoad in src/engine/world/what-a-conveyance-does-to-a-journey.ts, which ranks conveyances and does not know about folding.',
    whatItWouldTake: 'The catalog travelDays for the chosen road in place of the flat constant, and one branch that prefers a fold when priceFold reports withinRange and fewer days.',
    whyItIsNotDoneHere: 'Both files are owned by other agents and one of them is uncommitted. A journey seam edited from two ends at once is the failure AGENTS.md names.'
} as const;

// The one place a fold's reach does NOT grow with the rung is
// `convergence.ts`, and `PIERCE_REACH_DAYS` there carries the reason. It is a
// deliberate boundary rather than an oversight: inside a closing convergence
// the far end is receding, so there is nothing to take a fix on and nothing for
// the ordinal to buy.
