/**
 * What is true of a place right now, and what it does while it is true.
 *
 * ── THE PRICE DIAL IS PER TYPE OF GOOD, AND HAS TO BE ────────────────────
 *
 * This layer carried ONE multiplier over everything on sale, and one number
 * cannot say what a famine is. The design owner, on the defect:
 *
 *     also why would the famine move the cost of an inn bed. it should DROP it
 *
 * A failed harvest raises food AND empties the roads, so the beds go begging.
 * A war raises weapons and carriage. Each of those is a single status moving
 * two types of good in opposite directions, and a scalar can only ever move
 * them together. So the dial is keyed on the good's own `category` - the closed
 * enum `PriceSchema` already tags every row on the board with - and the scalar
 * survives as the figure for the types a status has no opinion about.
 *
 * Two things it deliberately is NOT. It is not a table of kind -> category:
 * `kind` is free-form content, the world sim invents kinds, and nothing in this
 * file has ever branched on one. What a famine does to food is carried BY the
 * famine and written where the famine is created. And it does not touch supply.
 * The board stays infinite - *if you're willing to pay the right price you can
 * get a theoretically unlimited supply of something* - so the price is the
 * whole of what moves, and the shelf never empties.
 */

import type { Price } from '../../data/cultivation/mortal-world.js';
import type { KnowingStage } from '../social/discovery.js';
import { isAtLeast, stageRank } from '../social/discovery.js';
import { isOpenOn, nextOpeningDay, type LocationRecord } from './locations.js';
import type { NpcRecord } from './npc-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE RECORD
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why a place is like this.
 */
export interface StatusCause {
    /** What happened. A ground change, a seal, a decision, a harvest failing. */
    what: string;
    /**
     * Whoever chose it. Null when nothing chose: weather, a vein moving, a
     * population that ran out of ground. A war has a value here and a drought
     * does not, and that is the only difference between them in this file.
     */
    decidedById: string | null;
    /** The history fact, when the cause is on the record. */
    factId: string | null;
}

/**
 * What kind of thing is being bought. The board's own tag, so a status and a
 * price row cannot disagree about what counts as food.
 */
export type GoodCategory = Price['category'];

/**
 * What a status does to prices, by type of good.
 *
 * Partial on purpose. A key absent is not "no effect": it is *this status has
 * nothing particular to say about that type*, and the status's scalar answers
 * instead. So a writer that sets only the scalar behaves exactly as it did
 * before this existed.
 */
export type PriceMultiplierByCategory = Readonly<Partial<Record<GoodCategory, number>>>;

/**
 * Something that is true of an area now and will not be forever.
 */
export interface AreaStatus {
    id: string;
    /**
     * The location this is true of. Any level: a province, a town, a district,
     * a single compound. It is true of that place and of everything under it.
     */
    areaId: string;
    /** What it is, in a word. Free-form content. See above. */
    kind: string;
    /** The sentence the world says about this place. The narrator renders it. */
    statement: string;
    cause: StatusCause;
    /**
     * What was and is observable to anyone who reads ground, understanding
     * nothing about why. Generalises `BeastTide.precursors`: the ordinary
     * animals went first and went far, output fell before anything was seen,
     * herds that do not share ground were seen sharing it.
     */
    signs: readonly string[];
    /**
     * Whether asking around here gets you the cause.
     */
    causeKnownLocally: boolean;

    beganOnDay: number;
    /**
     * The day the world looks at this again. Never null, always after
     * `beganOnDay`. Not a promise about when it stops.
     */
    reviewOnDay: number;
    /** Set on the day it actually ended. Null while it is still true. */
    liftedOnDay: number | null;

    /**
     * What is simply not to be had here while this is true.
     */
    stops: readonly string[];
    /**
     * What a good this status has no particular opinion about costs while it
     * is true. The floor of the dial, and the whole of it for a status that
     * moves everything the same way - a blockade, say, where nothing gets in.
     */
    priceMultiplier: number;
    /**
     * And what each type of good costs, where this status DOES have an opinion.
     * A famine lives here: `{ food: 4, lodging: 0.5 }` over a scalar of 1.
     */
    priceMultiplierByCategory: PriceMultiplierByCategory;
    /** Added to the place's danger while this is true. Signed. */
    dangerDelta: number;
}

/**
 * The one `stops` entry with a name.
 *
 * Getting through is not a good, but it is the thing most often stopped, and a
 * magic string matched in two files is a bug waiting for its afternoon.
 */
export const STOPS_PASSAGE = 'passage';

export interface AreaStatusInput {
    id: string;
    areaId: string;
    kind: string;
    statement: string;
    cause: StatusCause;
    beganOnDay: number;
    reviewOnDay: number;
    signs?: readonly string[];
    causeKnownLocally?: boolean;
    stops?: readonly string[];
    priceMultiplier?: number;
    priceMultiplierByCategory?: PriceMultiplierByCategory;
    dangerDelta?: number;
}

/**
 * The only way to make one, and it refuses the two shapes that are bugs.
 */
export function makeAreaStatus(input: AreaStatusInput): AreaStatus {
    if (!Number.isFinite(input.beganOnDay)) {
        throw new Error(`${input.id}: a status has to begin on a day`);
    }
    if (!Number.isFinite(input.reviewOnDay)) {
        throw new Error(
            `${input.id}: a status with no review day never lifts. ` +
            'Give it a date the world looks at it again, and extend it if it is still true.'
        );
    }
    if (input.reviewOnDay <= input.beganOnDay) {
        throw new Error(
            `${input.id}: reviewed on day ${input.reviewOnDay}, began on day ` +
            `${input.beganOnDay}. A status has to be true for at least a day.`
        );
    }
    return {
        id: input.id,
        areaId: input.areaId,
        kind: input.kind,
        statement: input.statement,
        cause: input.cause,
        signs: input.signs ?? [],
        causeKnownLocally: input.causeKnownLocally ?? false,
        beganOnDay: input.beganOnDay,
        reviewOnDay: input.reviewOnDay,
        liftedOnDay: null,
        stops: input.stops ?? [],
        priceMultiplier: input.priceMultiplier ?? 1,
        // Copied rather than aliased: the caller's literal is usually a
        // candidate row that outlives the status and gets reused next year.
        priceMultiplierByCategory: { ...(input.priceMultiplierByCategory ?? {}) },
        dangerDelta: input.dangerDelta ?? 0
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE CLOCK
// Closed-form on (beganOnDay, reviewOnDay, liftedOnDay). Asking about a day
// three centuries out costs what asking about tomorrow costs.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this is true on this day.
 */
export function isStatusRunningOn(status: AreaStatus, day: number): boolean {
    if (day < status.beganOnDay) return false;
    if (status.liftedOnDay !== null && day >= status.liftedOnDay) return false;
    return day < status.reviewOnDay;
}

/** How long it has been true, on this day. Zero before it begins. */
export function daysStatusHasRun(status: AreaStatus, day: number): number {
    const end = status.liftedOnDay !== null
        ? Math.min(day, status.liftedOnDay)
        : Math.min(day, status.reviewOnDay);
    return Math.max(0, end - status.beganOnDay);
}

/** Days until the world looks at it again. Zero once that day has passed. */
export function daysUntilStatusReview(status: AreaStatus, day: number): number {
    return Math.max(0, status.reviewOnDay - day);
}

/** It stopped being true. */
export function liftStatus(status: AreaStatus, onDay: number): AreaStatus {
    return { ...status, liftedOnDay: onDay };
}

/**
 * It was looked at and it is still true.
 *
 * The new review date has to be after the old one, because extending to a day
 * already past is how a status quietly becomes permanent.
 */
export function extendStatus(status: AreaStatus, toDay: number): AreaStatus {
    if (toDay <= status.reviewOnDay) {
        throw new Error(
            `${status.id}: extended to day ${toDay}, already reviewed on ` +
            `${status.reviewOnDay}. An extension has to move the date forward.`
        );
    }
    return { ...status, reviewOnDay: toDay };
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE IT IS TRUE
// A status on a province is true in every town in it. A status on a district
// is true in the district and nowhere else.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A place and every place containing it, innermost first.
 */
export function areaChainOf(
    locations: readonly LocationRecord[],
    locationId: string | null
): string[] {
    return chainFrom(indexById(locations), locationId);
}

function indexById(
    locations: readonly LocationRecord[]
): ReadonlyMap<string, LocationRecord> {
    return new Map(locations.map(l => [l.id, l]));
}

/**
 * The chain off a prepared index.
 */
function chainFrom(
    byId: ReadonlyMap<string, LocationRecord>,
    locationId: string | null
): string[] {
    if (!locationId) return [];
    const chain: string[] = [];
    const seen = new Set<string>();
    let at = byId.get(locationId);
    while (at && !seen.has(at.id)) {
        seen.add(at.id);
        chain.push(at.id);
        at = at.parentId ? byId.get(at.parentId) : undefined;
    }
    return chain;
}

/**
 * Everything true of this place on this day, innermost area first.
 *
 * This is the answer to a player standing somewhere and asking what is going
 * on. It is the join, and it is the reason this layer exists.
 */
export function statusesInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number
): AreaStatus[] {
    const chain = chainFrom(indexById(locations), locationId);
    if (chain.length === 0) return [];
    const depth = new Map(chain.map((id, at) => [id, at]));
    return statuses
        .filter(s => depth.has(s.areaId) && isStatusRunningOn(s, day))
        .sort((a, b) => {
            const byDepth = (depth.get(a.areaId) ?? 0) - (depth.get(b.areaId) ?? 0);
            if (byDepth !== 0) return byDepth;
            if (a.beganOnDay !== b.beganOnDay) return a.beganOnDay - b.beganOnDay;
            return a.id < b.id ? -1 : 1;
        });
}

/**
 * Who is standing in this area right now.
 */
export function whoIsInArea(
    npcs: readonly NpcRecord[],
    locations: readonly LocationRecord[],
    areaId: string
): NpcRecord[] {
    const byId = indexById(locations);
    const inside = new Set<string>();
    for (const l of locations) {
        if (chainFrom(byId, l.id).includes(areaId)) inside.add(l.id);
    }
    return npcs.filter(n => n.locationId !== null && inside.has(n.locationId));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT DOES
// None of this takes a KnowingStage. A famine stops the millet for somebody
// who has never heard the word.
// ─────────────────────────────────────────────────────────────────────────

/** Everything not to be had here, from every status true of this place. */
export function stoppedInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number
): string[] {
    const out = new Set<string>();
    for (const s of statusesInArea(statuses, locations, locationId, day)) {
        for (const what of s.stops) out.add(what);
    }
    return [...out].sort();
}

/** Whether this thing can be had here at all today. */
export function isStoppedInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number,
    what: string
): boolean {
    return stoppedInArea(statuses, locations, locationId, day).includes(what);
}

/**
 * What a good of this type still to be had here costs, as a multiplier.
 *
 * Ask with no category and you get what a status says about goods it has no
 * opinion on, which is what this function answered before types existed. Every
 * caller that has a category in hand should pass it: a famine asked without one
 * reports 1 and is telling the truth about a chisel and nothing about millet.
 */
export function priceMultiplierInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number,
    category?: GoodCategory
): number {
    let m = 1;
    for (const s of statusesInArea(statuses, locations, locationId, day)) {
        m *= dialFor(s, category);
    }
    return Number(m.toFixed(6));
}

/** One status's dial for one type of good. The `?? scalar` is the whole rule. */
function dialFor(status: AreaStatus, category: GoodCategory | undefined): number {
    const named = category === undefined
        ? undefined
        : status.priceMultiplierByCategory[category];
    return Math.max(0, named ?? status.priceMultiplier);
}

/**
 * The other direction: not *what does this type cost here*, but *what has this
 * ground moved, and by how much*.
 *
 * The forward read prices one row. This one is for a board with eight columns
 * on it, and for the sentence a narrator wants - food dear here, beds cheap -
 * which the point read cannot produce without being told what to ask about.
 *
 * `byCategory` names only types some live status actually had an opinion about,
 * so an empty map is a quiet market rather than eight ones. There is no list of
 * every category anywhere in this file on purpose: the keys come off the
 * statuses standing here, so a category added to the board needs no edit here.
 */
export interface GroundPricing {
    /** What a type nothing here named costs. 1 where nothing is going on. */
    everythingElse: number;
    /** Only the types a status here moved, each against the whole stack. */
    byCategory: Partial<Record<GoodCategory, number>>;
}

export function whatTheGroundDoesToPrices(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number
): GroundPricing {
    const live = statusesInArea(statuses, locations, locationId, day);

    let everythingElse = 1;
    const named = new Set<GoodCategory>();
    for (const s of live) {
        everythingElse *= Math.max(0, s.priceMultiplier);
        for (const c of Object.keys(s.priceMultiplierByCategory) as GoodCategory[]) {
            named.add(c);
        }
    }

    // Every named type is multiplied across EVERY status, not only the ones
    // that named it: a war doubling the board and a famine quadrupling the
    // food are eight times the price of a bowl of millet, and taking only the
    // famine's word for food would quietly drop the war.
    const byCategory: Partial<Record<GoodCategory, number>> = {};
    for (const c of named) {
        let m = 1;
        for (const s of live) m *= dialFor(s, c);
        byCategory[c] = Number(m.toFixed(6));
    }

    return { everythingElse: Number(everythingElse.toFixed(6)), byCategory };
}

/** How much more dangerous the place is today than the record says it is. */
export function dangerDeltaInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number
): number {
    let d = 0;
    for (const s of statusesInArea(statuses, locations, locationId, day)) {
        d += s.dangerDelta;
    }
    return Number(d.toFixed(6));
}

/**
 * Whether getting through is stopped today, and why.
 */
export interface PassageReading {
    stopped: boolean;
    /** Statuses stopping passage. Empty when only the season is in the way. */
    byStatus: AreaStatus[];
    /** True when the place's own opening schedule has it shut today. */
    bySeason: boolean;
    /** First day the schedule has it open again. Null when never, or not shut. */
    seasonOpensOnDay: number | null;
}

export function passageStoppedInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    location: LocationRecord,
    day: number
): PassageReading {
    const byStatus = statusesInArea(statuses, locations, location.id, day)
        .filter(s => s.stops.includes(STOPS_PASSAGE));
    const open = isOpenOn(location, day);
    return {
        stopped: byStatus.length > 0 || !open,
        byStatus,
        bySeason: !open,
        seasonOpensOnDay: open ? null : nextOpeningDay(location, day)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT ANYBODY CAN SAY ABOUT IT
// The knowledge model is `KnowingStage` and it lives in the social layer.
// Nothing here stores one; every function takes one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most anybody local can hand you about this.
 */
export function localCeilingFor(status: AreaStatus): KnowingStage {
    return status.causeKnownLocally ? 'known' : 'encountered';
}

export interface StatusReading {
    statusId: string;
    stage: KnowingStage;
    /** What this knower can say about it. Empty when they know nothing. */
    lines: string[];
    /** Whether they have the cause. */
    knowsCause: boolean;
}

/**
 * What somebody at this stage can say about this status.
 */
export function readStatusAtStage(
    status: AreaStatus,
    stage: KnowingStage,
    day: number
): StatusReading {
    const lines: string[] = [];
    if (isAtLeast(stage, 'whisper') && stageRank(stage) < stageRank('named')) {
        lines.push('Something is wrong here. Nobody has said what.');
    }
    if (isAtLeast(stage, 'named')) lines.push(status.statement);
    if (isAtLeast(stage, 'placed')) {
        const run = daysStatusHasRun(status, day);
        lines.push(
            run <= 0
                ? 'It started today.'
                : `It has been like this for ${run} ${run === 1 ? 'day' : 'days'}.`
        );
    }
    if (isAtLeast(stage, 'encountered')) {
        for (const sign of status.signs) lines.push(sign);
    }
    const knowsCause = isAtLeast(stage, 'known');
    if (knowsCause) lines.push(status.cause.what);
    return { statusId: status.id, stage, lines, knowsCause };
}

/**
 * The whole answer to "what is going on here", at one person's stage.
 */
export function whatIsGoingOnHere(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number,
    stageOf: (statusId: string) => KnowingStage = () => 'unaware'
): StatusReading[] {
    return statusesInArea(statuses, locations, locationId, day)
        .map(s => readStatusAtStage(s, stageOf(s.id), day))
        .filter(r => r.lines.length > 0);
}
