/**
 * What a sea crossing costs - the arithmetic of being on water with no ground
 * under it, resolved in one pass from a seed.
 *
 * WHY THIS IS NOT TRAVEL WITH A DIFFERENT NOUN
 * --------------------------------------------
 * `regions.ts` already argues that `sea_crossing` is a different KIND of link
 * from a road, and records that the engine had not learned to read it: today
 * `seeding.ts` links every region connection as `'road'`, so an eleven-day
 * cart road and a thirty-four-day open-water passage are the same object with
 * different numbers on them. This module is the other half of that record -
 * the part that says what the difference actually is, in code, so that a
 * caller can charge for it.
 *
 * Five things are true at sea and false on every road in the world, and every
 * one of them is a mechanism here rather than a piece of atmosphere:
 *
 *   1. YOU CANNOT STOP WHERE YOU LIKE. A road has a village on it every day or
 *      two, so a land journey can be abandoned at any point at the cost of the
 *      distance already walked. A crossing has landfalls at fixed points, and
 *      between them there is nowhere to be. Past the commit point, turning
 *      back is longer than going on - see `commitDayOf`, which is the single
 *      most important number about any lane and is not a decision anybody
 *      makes, it is where the middle is.
 *
 *   2. IT IS NOT THERE WHEN THE WEATHER SAYS IT IS NOT. Every land connection
 *      is open unless a party closes it, and a closed road is somebody's
 *      decision that can be appealed to, bought off or arbitrated. A crossing
 *      is closed by a season and by a storm, which is nobody's decision. So
 *      the lane carries `openMonthsPerYear` and a per-day storm hazard, and
 *      neither is negotiable by anything a cultivator can do.
 *
 *   3. IT TAKES WHAT IT TAKES. A road's length is its length. A crossing's is
 *      a distribution: the same lane in the same season runs long or short on
 *      the weather, and the whole of the danger is that a hull provisions
 *      against a figure somebody worked out ashore. `THE ARITHMETIC IS THE
 *      HAZARD` below.
 *
 *   4. WATER IS THE BINDING CONSTRAINT, NOT FOOD. A rail dries fish for the
 *      whole passage and the fresh water is carried in sealed jars and cannot
 *      be made. `waterDaysAboard` is what actually kills people, and it is the
 *      reason the map of the Drowned Reach is a list of wells.
 *
 *   5. THE GROUND GIVES NOTHING. There is no vein under open water, so a Drawn
 *      cultivator does not slow down, they stop. Every day of progress out
 *      there is bought out of a stone chest at a rate that does not care what
 *      realm anybody is - which is the ordinary rule about ground with no vein
 *      under it, applied where it is the whole of the rule rather than the
 *      exception to it. See `stoneBurnFor`.
 *
 * THE ARITHMETIC IS THE HAZARD
 * ----------------------------
 * The Drowned Reach's own threat model says most people who die in the South
 * die because a passage took longer than it was provisioned for, "which is not
 * misfortune, it is a sum somebody did wrong ashore". That sentence is the
 * specification for this module. `resolveCrossing` does not roll a disaster:
 * it rolls a duration, subtracts what was loaded, and reports what ran out.
 * Nothing in here can kill anybody by fiat, and there is no branch anywhere on
 * who is aboard.
 *
 * PURE. State in, deltas out. No I/O, no DB, no mutation of inputs, and every
 * stochastic step takes a seeded stream, so the same seed and the same manifest
 * always produce the same passage.
 */

import { forStream } from '../cultivation/rng.js';

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS
//
// These are cadence and provisioning figures for one subsystem, so they live
// beside the code that reads them, the way `AMBIENT_REFRESH_DAYS` does in
// `ambient.ts`. They are NOT balance numbers in the schema's sense: none of
// them is a survival threshold, and `schema/cultivation.ts` stays the
// authority for anything that decides whether somebody lives.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cups of fresh water per person per day, counted aloud at the same hour.
 *
 * The unit is a cup rather than a volume because that is the unit the province
 * actually uses - the ration is called out and everybody stops to hear it -
 * and a figure a narrator can say is worth more here than a figure that is
 * merely correct.
 */
export const WATER_CUPS_PER_HEAD_PER_DAY = 3;

/**
 * What a careful shipmaster loads over the expected passage, as a fraction.
 *
 * A third is generous by the standards of this water and is still not enough
 * for the tail of the distribution, which is the point: the margin that feels
 * safe ashore is not the margin that survives a lane running long. Callers
 * that model a cheap operator pass a smaller number and find out why.
 */
export const CUSTOMARY_PROVISIONING_MARGIN = 1 / 3;

/**
 * Assayed stones burned per head per day to hold cultivation where there is
 * nothing in the air, before any technique or root is considered.
 *
 * The figure does not vary with realm, and that is not a simplification - it
 * is the province's single most quoted fact about itself: a Core Formation
 * cultivator and a porter are quoted the same number, because what is being
 * bought is the absence of ground rather than any property of the buyer.
 */
export const STONES_BURNED_PER_HEAD_PER_DAY = 1;

/**
 * Multiplier on the burn for somebody trying to ADVANCE rather than merely
 * hold what they have. Holding is standing still; gaining is paying for ground
 * that is not there.
 */
export const ADVANCING_BURN_MULTIPLIER = 4;

/** Per-day chance a storm adds a day, in an open season. */
export const STORM_DAY_CHANCE = 0.06;

/** Days a single storm adds when it lands. A storm is not one bad afternoon. */
export const STORM_DELAY_DAYS = 3;

// ─────────────────────────────────────────────────────────────────────────
// THE LANE
// ─────────────────────────────────────────────────────────────────────────

/**
 * A stretch of open water between two landfalls, as the engine needs it.
 *
 * The content half - what the water is called, what is on it, who runs hulls
 * across it - is in the data catalogs. This is only what the arithmetic reads,
 * and the fields are deliberately the ones a road does not have.
 */
export interface SeaLane {
    id: string;
    /** Named landfalls at each end. Never region ids: a lane joins coasts. */
    fromPlace: string;
    toPlace: string;
    /** What a shipmaster quotes, in a season that is open. */
    expectedDays: number;
    /**
     * Months of the year the lane is worked at all. A land road has no
     * equivalent field, and the absence of one on a road is the difference.
     */
    openMonthsPerYear: number;
    /**
     * Landfalls in the middle, in days from `fromPlace`. Empty means there is
     * nowhere to stop, which is what `Dryrun` and `The Long Middle` are named
     * for and is what makes a lane frightening rather than merely long.
     */
    intermediateLandfallDays: readonly number[];
    /** Multiplier on `STORM_DAY_CHANCE` for a lane that is worse than most. */
    weatherSeverity: number;
}

/**
 * The day past which turning back is no shorter than going on.
 *
 * With no landfall in the middle this is simply the halfway point. With
 * landfalls it is the last one before halfway, because a hull that has passed
 * a landfall and turned round is running for that landfall rather than for
 * where it started - which is why a lane with a rock in the middle of it is a
 * different proposition from one without, at the same number of days.
 */
export function commitDayOf(lane: SeaLane): number {
    const half = lane.expectedDays / 2;
    const behind = lane.intermediateLandfallDays.filter(d => d <= half);
    if (behind.length === 0) return half;
    return Math.max(...behind);
}

/** Whether a hull this many days out still has a shorter way back than on. */
export function canTurnBack(lane: SeaLane, daysElapsed: number): boolean {
    return daysElapsed < commitDayOf(lane);
}

/** Whether the lane is worked at all in a given month, 1-12. */
export function laneIsOpenInMonth(lane: SeaLane, month: number): boolean {
    // Seasons are centred rather than counted from January, because the closed
    // half of a year is a winter and a winter straddles the turn.
    const open = Math.max(0, Math.min(12, Math.floor(lane.openMonthsPerYear)));
    if (open >= 12) return true;
    if (open <= 0) return false;
    const m = ((Math.floor(month) - 1) % 12 + 12) % 12;
    const half = open / 2;
    // Centred on midyear, which is the sailing season everywhere in this world.
    return m >= 6 - half && m < 6 + half;
}

// ─────────────────────────────────────────────────────────────────────────
// PROVISIONING
// ─────────────────────────────────────────────────────────────────────────

export interface CrossingManifest {
    heads: number;
    /** Days of water actually aboard, at the standing ration. */
    waterDaysAboard: number;
    /** Days of food aboard. Rarely the constraint; carried for honesty. */
    foodDaysAboard: number;
    /** Assayed stones in the chest, for everybody aboard together. */
    stonesInChest: number;
    /** Heads aboard who are trying to gain rather than hold. */
    advancingHeads: number;
}

/**
 * What a careful shipmaster loads for a lane, at the customary margin.
 *
 * This is the sum that gets done ashore, and it is correct for the expected
 * passage and wrong for the tail. Handing a caller the "right" answer and then
 * having the lane run long is the whole of the province's threat model.
 */
export function provisionForLane(
    lane: SeaLane,
    heads: number,
    advancingHeads = 0,
    margin: number = CUSTOMARY_PROVISIONING_MARGIN
): CrossingManifest {
    const days = Math.ceil(lane.expectedDays * (1 + Math.max(0, margin)));
    const safeHeads = Math.max(1, Math.floor(heads));
    const advancing = Math.max(0, Math.min(safeHeads, Math.floor(advancingHeads)));
    return {
        heads: safeHeads,
        waterDaysAboard: days,
        foodDaysAboard: days,
        stonesInChest: stoneBurnFor(days, safeHeads, advancing),
        advancingHeads: advancing
    };
}

/** Cups of fresh water a manifest represents, for the ration called aloud. */
export function waterCupsAboard(manifest: CrossingManifest): number {
    return manifest.waterDaysAboard * manifest.heads * WATER_CUPS_PER_HEAD_PER_DAY;
}

/**
 * Stones burned over a passage. Holding for everybody, advancing for some.
 *
 * No branch on realm, faction, root or title anywhere in it, which is the
 * whole content of the Drowned Reach's claim that a stranger with a counting
 * board can price a cultivator's progress exactly and in advance.
 */
export function stoneBurnFor(days: number, heads: number, advancingHeads = 0): number {
    const d = Math.max(0, Math.ceil(days));
    const h = Math.max(0, Math.floor(heads));
    const a = Math.max(0, Math.min(h, Math.floor(advancingHeads)));
    const holding = d * h * STONES_BURNED_PER_HEAD_PER_DAY;
    const extra = d * a * STONES_BURNED_PER_HEAD_PER_DAY * (ADVANCING_BURN_MULTIPLIER - 1);
    return holding + extra;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASSAGE
// ─────────────────────────────────────────────────────────────────────────

/** What the sea did, and what ran out. One pass, no day-by-day simulation. */
export interface CrossingOutcome {
    laneId: string;
    /** Days the passage actually took, weather included. */
    daysTaken: number;
    /** Days added by storms, separately, because it is the story. */
    stormDays: number;
    /** Days short of water. Zero means the sum was right. */
    waterShortDays: number;
    foodShortDays: number;
    /** Stones short. A hull with an empty chest is standing on nothing. */
    stonesShort: number;
    /**
     * Where the trouble began relative to the commit point. `before` means the
     * shipmaster still had a choice; `after` means the sum was already wrong
     * when nobody could act on it, which is the ordinary case and is why the
     * deaths out here are ascribed to somebody ashore.
     */
    ranShortSideOfCommit: 'before' | 'after' | 'never';
    /** True where the lane was shut in that month and no hull left at all. */
    laneWasShut: boolean;
}

/**
 * Resolve one crossing in a single deterministic pass.
 *
 * The only stochastic term is the duration. Everything else is subtraction,
 * and that is on purpose: nothing here decides that somebody dies, it reports
 * how many days of water a hull was short, and what that costs a body is the
 * survival system's question and is asked in the ordinary place.
 */
export function resolveCrossing(
    runSeed: string,
    lane: SeaLane,
    manifest: CrossingManifest,
    month: number
): CrossingOutcome {
    const shut = !laneIsOpenInMonth(lane, month);
    if (shut) {
        return {
            laneId: lane.id,
            daysTaken: 0,
            stormDays: 0,
            waterShortDays: 0,
            foodShortDays: 0,
            stonesShort: 0,
            ranShortSideOfCommit: 'never',
            laneWasShut: true
        };
    }

    const rng = forStream(runSeed, 'sea-crossing', lane.id, Math.floor(month));
    // The base passage varies with the wind either way; the storms only ever
    // add. That asymmetry is why a lane's mean is longer than its quote, and
    // why the customary margin is not as generous as it sounds.
    const windSwing = rng.float(-0.12, 0.18);
    const base = lane.expectedDays * (1 + windSwing);

    let stormDays = 0;
    const perDay = STORM_DAY_CHANCE * Math.max(0, lane.weatherSeverity);
    for (let d = 0; d < Math.ceil(base); d++) {
        if (rng.next() < perDay) stormDays += STORM_DELAY_DAYS;
    }

    const daysTaken = Math.max(1, Math.round(base + stormDays));
    const waterShortDays = Math.max(0, daysTaken - manifest.waterDaysAboard);
    const foodShortDays = Math.max(0, daysTaken - manifest.foodDaysAboard);
    const needed = stoneBurnFor(daysTaken, manifest.heads, manifest.advancingHeads);
    const stonesShort = Math.max(0, needed - manifest.stonesInChest);

    // Which side of the commit point the first shortage falls on. Water first,
    // because water is what the province counts and what it dies of.
    const firstShortDay = waterShortDays > 0
        ? manifest.waterDaysAboard
        : (stonesShort > 0 ? manifest.stonesInChest / Math.max(1, manifest.heads) : null);
    const ranShortSideOfCommit = firstShortDay === null
        ? 'never'
        : (firstShortDay < commitDayOf(lane) ? 'before' : 'after');

    return {
        laneId: lane.id,
        daysTaken,
        stormDays,
        waterShortDays,
        foodShortDays,
        stonesShort,
        ranShortSideOfCommit,
        laneWasShut: false
    };
}

// ─────────────────────────────────────────────────────────────────────────
// BUYING PASSAGE
//
// A hull is somebody's property, so a passage is a purchase and not a walk.
// The price extends the mortal economy's existing transport vocabulary rather
// than starting a second one: `price-ferry` is a crossing you can see both
// banks of, `price-caravan-passage` is priced per 100 li of road, and this is
// priced PER HEAD PER DAY, which is the unit the Drowned Reach actually
// quotes and is a different unit for a reason - on a road you are buying
// distance and out here you are buying somebody else's provisioning risk.
// ─────────────────────────────────────────────────────────────────────────

/** What a hull charges, in cash, before anybody haggles. */
export interface PassageQuote {
    laneId: string;
    heads: number;
    /** Days quoted. A shipmaster quotes the expected passage, never the tail. */
    quotedDays: number;
    /** Cash for the berth, food and water at the standing ration. */
    fareCash: number;
    /** Stones the passenger burns themselves. Never included in the fare. */
    stonesBurned: number;
    /**
     * What the quote does NOT cover, stated because it is the whole complaint
     * every passenger in the province has and every shipmaster's answer to it.
     */
    notCovered: string;
}

/**
 * Price a passage from the mortal economy's per-head-per-day rate.
 *
 * The caller passes the rate rather than this module holding one, because the
 * rate is content: it is in the price table with the ferry and the caravan,
 * it varies by region multiplier, and a body that sets it is a body somebody
 * can bargain with.
 */
export function quotePassage(
    lane: SeaLane,
    heads: number,
    cashPerHeadPerDay: number,
    advancingHeads = 0
): PassageQuote {
    const h = Math.max(1, Math.floor(heads));
    const days = Math.ceil(lane.expectedDays);
    return {
        laneId: lane.id,
        heads: h,
        quotedDays: days,
        fareCash: Math.round(days * h * Math.max(0, cashPerHeadPerDay)),
        stonesBurned: stoneBurnFor(days, h, advancingHeads),
        notCovered:
            'The chest. A fare buys a berth, a share of the rail and the ration called at the same hour every day; it does not buy the stones anybody burns to still be at the rung they boarded at, and no hull in the province has ever included them.'
    };
}

/**
 * WHAT THIS DOES NOT DO YET, recorded rather than quietly left.
 *
 * `LinkKind` in `locations.ts` is `road|path|tunnel|gate|portal|seam` and
 * `seeding.ts` links every region connection as `'road'`, so a seeded world
 * still cannot tell a crossing from a cart track - which means nothing above
 * is reached by ordinary travel today. `regions.ts` already argues that a
 * `crossing` kind would be the only link whose `open` flag is set by the world
 * rather than by a holder or a key, and `laneIsOpenInMonth` is now the
 * function that would answer it.
 *
 * The gap is two lines in a file this module does not own: one union member,
 * and one ternary at the `linkLocations` call. It is deliberately not made
 * here, and this is the record of that.
 */
export const SEA_CROSSING_ENGINE_GAP = {
    what: 'A sea crossing is still seeded as a road, so no route in a live world reads any of the arithmetic above.',
    whereItWouldGo: 'LinkKind in src/engine/world/locations.ts, and the linkLocations call in src/engine/world/seeding.ts.',
    whatItWouldTake: 'One union member `crossing`, and one ternary choosing it for a connection whose kind is `sea_crossing`.',
    whyItIsNotDoneHere: 'Both are somebody else\'s file, and a link kind is a shared contract that conflicts badly when two agents touch it at once.'
} as const;
