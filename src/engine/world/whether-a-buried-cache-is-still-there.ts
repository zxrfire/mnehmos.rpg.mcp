/**
 * Whether a thing put in the ground is still in the ground.
 *
 * The spatial half of what a cultivator can leave behind. A buried cache is
 * cheap, immediate, needs nobody's permission and is at risk from exactly one
 * thing: somebody else finding it. Which is not a flat chance - it turns on
 * where the hole was dug, how much work went into it, who was standing there
 * at the time, and how long ago it all was.
 *
 * ── The three things that decide it ──────────────────────────────────────
 *
 *   GROUND      A market town is walked over. A border waystation is walked
 *               past. Ground nobody has a reason to be on is walked nowhere
 *               near. `CACHE_ANNUAL_DISCOVERY_HAZARD` is that ranking and it is
 *               keyed on `RegionPlace['kind']`, which the region catalog
 *               already assigns to every named place, so a place added to
 *               `regions.ts` is priced without an edit here.
 *
 *   CONCEALMENT What the burier actually did. Days spent, and the rung they
 *               were standing at - somebody at Nascent Soul can set a thing in
 *               ground that a villager with a spade will never turn up, and
 *               somebody at ordinal 0 has dug a hole. Optionally an Anchorhold
 *               anchoring, which is a service the catalog already sells.
 *
 *   TIME        And this is the half that is easy to get wrong. Concealment is
 *               not permanent, and the setting says so in its own voice: the
 *               House of the Quiet Cut sells "concealment retainers, renewed
 *               annually, because concealment decays". So the protection a good
 *               burial buys is spent down over the centuries until the cache is
 *               as findable as a hole in the same ground, and the hazard rises
 *               toward the bare rate rather than sitting at the buried one.
 *
 * ── Why the fate is not rolled, and not stored ───────────────────────────
 *
 * Rolling at burial would settle the cache's whole future before the world had
 * a chance to be a factor, and would have to be re-rolled every time anything
 * about the site changed. Rolling at the moment somebody comes back would make
 * two reads of the same cache disagree, which is the bug that turns a permanent
 * world into a slot machine.
 *
 * So neither. One uniform sample is derived from (world seed, cache id) - the
 * cache's own threshold, fixed for all time and never written anywhere - and
 * the cache is gone at the first year where the cumulative odds of discovery
 * have climbed past it. That is monotone (a cache that was gone in year 200 is
 * still gone in year 400), reproducible from the seed, and answers "when was it
 * found" as a by-product rather than needing a second mechanism.
 *
 * ── What this module does not decide ─────────────────────────────────────
 *
 * Who owns what was taken, or what the finder did with it. `possessions.ts`
 * owns claims and provenance and this does not duplicate any of it. All that is
 * settled here is whether the hole still has anything in it.
 */

import { forStream } from '../cultivation/rng.js';

// ─────────────────────────────────────────────────────────────────────────
// GROUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * The kinds of ground a cache can be under.
 *
 * The first seven are `RegionPlace['kind']` verbatim, so the region catalog is
 * the authority on what a named place counts as. `unplaceable` is the honest
 * eighth: a location the catalog does not describe, which the played game
 * permits because `Cultivator.location` is free text.
 */
export type BurialGround =
    | 'city'
    | 'sect_town'
    | 'market_town'
    | 'village'
    | 'hamlet'
    | 'waystation'
    | 'site'
    | 'unplaceable';

/**
 * Annual probability that somebody turns up a cache in this ground, given no
 * concealment at all - a thing wrapped in cloth and covered over in an
 * afternoon by somebody who cannot do anything a mortal could not.
 *
 * The ordering is footfall and reason-to-dig together, which are not the same
 * axis and pull in the same direction anyway: a city is walked over constantly
 * AND has people cutting foundations, and ground with a ruin on it has almost
 * nobody on it AND everybody on it is there specifically to dig.
 *
 * `site` is deliberately not the safest. A named site in the region catalog is
 * a place with something at it, which is why it has a name, and the people who
 * go there are grave-readers and Gleaners rather than farmers. Burying a cache
 * next to an inheritance ground is burying it where the professionals work.
 *
 * `unplaceable` is the floor and is the honest reading of ground the catalog
 * cannot find: somewhere off the map, with no settlement on it and no reason
 * for anybody to be there. It is the best ground to bury in and the hardest to
 * describe to yourself well enough to find again.
 */
export const CACHE_ANNUAL_DISCOVERY_HAZARD: Record<BurialGround, number> = {
    city: 0.055,
    sect_town: 0.040,
    market_town: 0.035,
    site: 0.030,
    village: 0.018,
    hamlet: 0.011,
    waystation: 0.009,
    unplaceable: 0.005
};

/** Plain words for a ground, for a line the player reads before committing. */
export const GROUND_READS: Record<BurialGround, string> = {
    city: 'Somebody is cutting a footing, sinking a post or digging a drain within a hundred paces of you every week of the year.',
    sect_town: 'Half the people here can feel a formation from the street and the other half are paid to notice strangers behaving oddly after dark.',
    market_town: 'Carts, yards, middens and building. Nothing here stays undisturbed for a generation and everybody has a spade.',
    site: 'Almost nobody comes here, and everybody who does came specifically to dig. Grave-readers work this ground for a living.',
    village: 'Fields turned twice a year, a well, and forty people who would all know if the ground by the boundary stone looked different this morning.',
    hamlet: 'Nine households and no reason to break new ground. What gets dug here gets dug for a grave or a post.',
    waystation: 'Traffic without settlement. People pass through at speed and nobody stops long enough to take an interest in the verge.',
    unplaceable: 'Nothing marks it, nobody has a reason to be here, and you will have to remember it by something that is not a name.'
};

/** Who turns a cache up in this ground, when one is turned up. */
export const WHO_FINDS_IT: Record<BurialGround, string> = {
    city: 'A gang cutting a foundation, who split it before the foreman is told there was anything.',
    sect_town: 'A sect patrol, who report it, which is worse than the gang: it goes into a house\'s inventory and stays there.',
    market_town: 'A carter widening a yard. It reaches the Thousand Treasure Pavilion within the season, because the Pavilion buys dug goods from anyone and asks nothing about the hole.',
    site: 'A grave-reader, working the ground properly, who knew from the surface that something had been put in it.',
    village: 'A family digging a grave for one of their own, in the only ground the village uses for it.',
    hamlet: 'A child, and then the whole hamlet, and then whoever the headman is frightened of.',
    waystation: 'Somebody sheltering off the road who put a stake in for a lean-to and hit it.',
    unplaceable: 'Nobody who was looking. The ground moved, or a beast dug, or a party stopped in the wrong place to make a fire.'
};

// ─────────────────────────────────────────────────────────────────────────
// CONCEALMENT
// ─────────────────────────────────────────────────────────────────────────

/** Days below which a burial is a hole and nothing more. */
export const A_HOLE_IS_ONE_DAY = 1;

/**
 * Days beyond which more work buys nothing.
 *
 * A season. Past that the burier is not concealing better, they are standing
 * around at a place where they have already been seen several times, which is
 * the opposite of the thing they came to do.
 */
export const CONCEALMENT_WORK_CEILING_DAYS = 90;

/**
 * Half-life of a concealment, in years.
 *
 * The Quiet Cut sells concealment retainers renewed annually because
 * concealment decays; nothing in this world stays hidden by having once been
 * hidden well. Two hundred years is the figure the rest of this module is
 * calibrated against and the reason a cache is a medium-term instrument: at one
 * half-life the burial is worth half of what it was, and by four the ground is
 * carrying almost all of the protection on its own.
 */
export const CONCEALMENT_HALF_LIFE_YEARS = 200;

/** What an Anchorhold anchoring is worth as a straight multiplier on hazard. */
export const ANCHORED_HAZARD_FACTOR = 0.45;

/**
 * What being watched is worth, per watcher, as a multiplier on hazard.
 *
 * Compounding rather than additive, and it is brutal on purpose: somebody who
 * stood and watched you dig knows there is a cache, knows where, and does not
 * need to find it. Two watchers is not twice as bad as one, it is worse, and
 * the arithmetic says so.
 */
export const WATCHED_HAZARD_FACTOR = 2.6;

export interface CacheBurial {
    ground: BurialGround;
    /** Days actually spent. Clamped into [1, CONCEALMENT_WORK_CEILING_DAYS]. */
    daysSpent: number;
    /** The rung the burier was standing at when they did it. */
    burierOrdinal: number;
    /** Whether the Anchorhold was paid to anchor the site. */
    anchored: boolean;
    /** How many people were present and could see what was being done. */
    watchers: number;
}

/**
 * How much the burial itself divides the ground's hazard by, at the moment it
 * is finished. Always at least 1 - a burial cannot make a cache easier to find
 * than leaving the goods on the surface.
 *
 * Two contributions, multiplied because they are independent: the work put in,
 * and what the person doing it was capable of. The ordinal term is deliberately
 * gentle - a rung is worth about a tenth - because a cache is a hole rather
 * than a duel, and the whole point of the route is that a nobody can use it.
 */
export function concealmentFactor(burial: CacheBurial): number {
    const days = Math.min(
        CONCEALMENT_WORK_CEILING_DAYS,
        Math.max(A_HOLE_IS_ONE_DAY, Math.floor(burial.daysSpent))
    );
    // A day is 1.0 (a hole). A season is about 3.5.
    const work = 1 + Math.log10(days) * 2.6;
    // Ordinal 0 is 1.0; ordinal 20 is 3.0; ordinal 40 is 5.0.
    const capability = 1 + Math.max(0, burial.burierOrdinal) * 0.1;
    return Math.max(1, work * capability);
}

/**
 * The hazard in a given year of the cache's life.
 *
 * The ground's bare rate, divided by whatever survives of the concealment that
 * year, multiplied up by anchoring and by anybody who watched. Watchers do not
 * decay: somebody who saw you bury it either acts on that or does not, and
 * forgetting is not something this engine models.
 */
export function annualHazard(burial: CacheBurial, yearsElapsed: number): number {
    const bare = CACHE_ANNUAL_DISCOVERY_HAZARD[burial.ground];
    const decay = Math.pow(0.5, Math.max(0, yearsElapsed) / CONCEALMENT_HALF_LIFE_YEARS);
    // Decays toward 1 - no concealment - rather than toward zero.
    const surviving = 1 + (concealmentFactor(burial) - 1) * decay;
    const anchor = burial.anchored ? ANCHORED_HAZARD_FACTOR : 1;
    const watched = Math.pow(WATCHED_HAZARD_FACTOR, Math.max(0, Math.floor(burial.watchers)));
    return Math.min(1, (bare / surviving) * anchor * watched);
}

/**
 * The chance the cache has been found at least once by the end of year `years`.
 *
 * Accumulated year by year rather than closed-form, because the hazard changes
 * every year as the concealment decays and there is no honest constant to
 * integrate. Years are whole: nothing in this model is finer than a year and
 * pretending otherwise would be false precision.
 */
export function cumulativeDiscoveryOdds(burial: CacheBurial, years: number): number {
    const whole = Math.max(0, Math.floor(years));
    let survives = 1;
    for (let year = 0; year < whole; year += 1) {
        survives *= 1 - annualHazard(burial, year);
        if (survives <= 0) return 1;
    }
    return 1 - survives;
}

// ─────────────────────────────────────────────────────────────────────────
// THE FATE
// ─────────────────────────────────────────────────────────────────────────

export interface CacheFate {
    stillThere: boolean;
    /** Years after burial it was turned up. Null while it is still there. */
    foundAfterYears: number | null;
    /** The account of who, in the ground's own terms. Null while it is there. */
    foundBy: string | null;
    /** Odds it would be gone by now, for the inspector. Never narrated raw. */
    oddsItWouldBeGone: number;
    /** The threshold this cache was dealt, so a reader can check the working. */
    threshold: number;
}

/**
 * Whether the cache is still there after `years`, and if not, when it went.
 *
 * Deterministic in (worldSeed, cacheId): the threshold is dealt once from that
 * pair and never stored, so the answer is stable across processes, across
 * restarts, and across as many reads as anybody cares to make. Monotone in
 * `years` by construction, because `cumulativeDiscoveryOdds` is.
 *
 * The search for the year it went is a linear walk rather than an inversion.
 * The hazard changes every year and the horizon is centuries, so the walk is a
 * few hundred multiplications and the closed form would be a lie about a curve
 * that has no closed form.
 */
export function fateOfACache(
    worldSeed: string,
    cacheId: string,
    burial: CacheBurial,
    years: number
): CacheFate {
    const threshold = forStream(worldSeed, 'buried-cache', cacheId).next();
    const horizon = Math.max(0, Math.floor(years));
    const odds = cumulativeDiscoveryOdds(burial, horizon);

    if (odds <= threshold) {
        return {
            stillThere: true,
            foundAfterYears: null,
            foundBy: null,
            oddsItWouldBeGone: odds,
            threshold
        };
    }

    let survives = 1;
    for (let year = 0; year < horizon; year += 1) {
        survives *= 1 - annualHazard(burial, year);
        if (1 - survives > threshold) {
            return {
                stillThere: false,
                foundAfterYears: year + 1,
                foundBy: WHO_FINDS_IT[burial.ground],
                oddsItWouldBeGone: odds,
                threshold
            };
        }
    }

    // Unreachable while `cumulativeDiscoveryOdds` and the walk agree, and left
    // as the honest fallback rather than a throw: a cache the arithmetic cannot
    // place is a cache that is still there, which is the direction that does
    // not silently delete somebody's property.
    return { stillThere: true, foundAfterYears: null, foundBy: null, oddsItWouldBeGone: odds, threshold };
}

/**
 * The ground a place name sits on, where the region catalog knows the place.
 *
 * Kept here rather than in the web layer so that the mapping from a catalog
 * place kind to a burial ground has one home. `null` in means unplaceable, and
 * so does a kind the catalog grows that this has not been taught yet - the
 * conservative direction, because treating unknown ground as busy would delete
 * caches for a reason nobody could read.
 */
export function groundFor(placeKind: string | null | undefined): BurialGround {
    switch (placeKind) {
        case 'city':
        case 'sect_town':
        case 'market_town':
        case 'village':
        case 'hamlet':
        case 'waystation':
        case 'site':
            return placeKind;
        default:
            return 'unplaceable';
    }
}
