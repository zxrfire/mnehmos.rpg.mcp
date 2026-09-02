/**
 * What is true of a place right now, and what it does while it is true.
 *
 * A place is not only a fixed set of properties. Things are true of it for a
 * while and then stop being true: a famine, a pass shut for the winter, a beast
 * tide running, a district worked out, a blockade, a war on the ground a house
 * stands on. This module is that layer, and it is the substrate the rest of the
 * world's answers about availability sit on top of.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CAUSATION DIRECTION IS THE WHOLE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Mundane goods are never counted. Nobody tracks how much grain a province
 * holds, and consumption does not move a mundane good: a thousand travellers
 * buying meals does not cause a famine. **A famine causes the meals to stop.**
 *
 * So the event is the thing that is stored, and availability is read off it.
 * {@link AreaStatus.stops} is that reading - a list of what is simply not to be
 * had here while this is true - and there is no ledger of millet anywhere
 * behind it. A status is one row per area per thing that is true of it, which
 * is a handful per world; anything needing a row per object is too much.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE DIFFERENT FACTS, AND THEY MUST NOT BE COLLAPSED
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   what is true          the status, and its {@link StatusCause}
 *   what is visible       {@link AreaStatus.signs} - what anybody standing
 *                         here observes, understanding nothing
 *   what anybody has
 *   worked out            `KnowingStage`, in `engine/social/discovery.ts`
 *
 * The third is NOT modelled here and must not be. This module takes a
 * `KnowingStage` as an argument ({@link readStatusAtStage}) and never stores
 * one. There is exactly one knowledge ladder in this repo.
 *
 * The load-bearing consequence, and it is pinned by a test: **what a status
 * DOES does not depend on anybody knowing about it.** {@link stoppedInArea},
 * {@link priceMultiplierInArea} and {@link dangerDeltaInArea} take no stage,
 * because a famine stops the millet for a traveller who has never heard the
 * word. Knowing is what buys you the reason, the warning and the way out.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A STATUS HAS A CAUSE, AND CAUSES ARE OF TWO KINDS WITHOUT A BRANCH
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `BEAST_TIDES` in `data/cultivation/beasts.ts` already insists on this and
 * this generalises it rather than sitting beside it: a tide is a symptom of
 * something that changed on the ground, and the houses that treat one as a
 * monster problem rather than a survey problem are the ones it happens to
 * twice. A status that appeared from nowhere would undo that.
 *
 * A war is the other kind. It is a status on an area exactly as a famine is,
 * and it is caused by somebody choosing rather than by a vein moving. That
 * difference is {@link StatusCause.decidedById} - a value, null for weather and
 * ground - and **nothing in this module branches on it.** A caller that wants
 * to know who to blame reads the field.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * STATUSES END. THE TYPE WILL NOT LET YOU WRITE ONE THAT DOES NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A famine that never lifts is a worse bug than no famine, so
 * {@link makeAreaStatus} refuses a status with no {@link AreaStatus.reviewOnDay}
 * and refuses one whose review is not after its start.
 *
 * `reviewOnDay` is the day the world looks at this again, not a promise about
 * when it stops. A famine has an expected end; a war does not, and a war gets a
 * review date like everything else - whoever reviews it either
 * {@link liftStatus} or {@link extendStatus}. Open-ended is deliberately not
 * representable, because it is the shape the never-lifting bug arrives in.
 *
 * A caller that wants the lift announced in the time digest schedules an
 * ordinary effect for `reviewOnDay` with `makeScheduledEffect` from
 * `world-state.ts`. That machinery already exists and nothing here duplicates
 * it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS ALREADY HERE, AND IS THEREFORE NOT HERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   who is where        `NpcRecord.locationId`. Presence is read, never
 *                       stored again: a second record of who is where goes out
 *                       of agreement with the first the moment anybody moves.
 *                       {@link whoIsInArea} is a query over existing state.
 *   places that shut    `LocationRecord.cycle` with `isOpenOn`,
 *                       `nextOpeningDay` and `nextClosingDay` in
 *                       `locations.ts`. Seasonal opening is already closed-form
 *                       arithmetic, so {@link passageStoppedInArea} CONSULTS it
 *                       rather than restating it as a status.
 *   permanent scars     `LocationChange` in `locations.ts`, with its own
 *                       `causeFactId`, `causeKnown` and `attributedCauses`.
 *                       That layer is for what a place BECAME and is
 *                       deliberately append-only and permanent. This layer is
 *                       for what is true of it for a while. A change that ends
 *                       belongs here; a status that never lifts belongs there.
 *   windows that open   `OpportunityWindow` in `opportunities.ts`, which is the
 *                       same arithmetic with the opposite valence - a thing you
 *                       can take, rather than a thing that is wrong. Recurring
 *                       availability is its business and not this module's.
 *   the province a
 *   place sits in       `regionOf` in `what-people-are-saying.ts`. It answers
 *                       the root of the chain; {@link areaChainOf} answers the
 *                       whole chain, because a district being worked out is
 *                       true of the district and not of the province.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY WITH COUNTED STOCK
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This layer owns what is TRUE of an area. It does not own HOW MUCH MATERIAL
 * is in it, and the two are separate files on purpose:
 *
 *   what a place still has    `what-a-place-still-has-in-the-ground.ts`. One
 *   in the ground             number per place per kind per grade, drawn down
 *                             by taking, regrown on a clock. Its `readingFor`
 *                             already answers 'worked_out' off that number and
 *                             says so in prose.
 *   what is true of it        this file. Not counted, and not derived from any
 *                             count.
 *
 * **A worked-out district is THEIR reading, not a status here.** Do not write
 * a status that restates a count: it would be a second authority on the same
 * fact and the two would disagree the first time anybody foraged. What belongs
 * here is what somebody DECIDED in consequence - a house closing a district, a
 * guild refusing to buy out of it, a blockade - because a decision is not
 * recoverable from a number.
 *
 * The same rule runs the other way: mundane goods are stopped here and counted
 * nowhere, which that file states as its own first distinction.
 *
 * ── No draws ─────────────────────────────────────────────────────────────
 *
 * Nothing in this module is stochastic. There is no RNG import and no call
 * site takes a stream, so no existing draw moves and no seeded world changes
 * because this file exists. Whoever decides that a famine begins does the
 * drawing; this records it.
 */

import type { KnowingStage } from '../social/discovery.js';
import { isAtLeast, stageRank } from '../social/discovery.js';
import { isOpenOn, nextOpeningDay, type LocationRecord } from './locations.js';
import type { NpcRecord } from './npc-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE RECORD
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why a place is like this.
 *
 * `what` is stated whether or not a living soul knows it, which is the same
 * arrangement `LocationChange` makes for permanent events: the world holds the
 * truth, and whether anybody has it is a separate question.
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
 * Something that is true of an area now and will not be forever.
 *
 * `kind` is a free-form word, deliberately not an enum. The world's statuses
 * are content, in the same way `LocationRecord.hazards` are content, and the
 * eleventh kind must cost a row and no branch. Written so far: 'famine',
 * 'beast_tide', 'war', 'blockade', 'siege', 'quarantine',
 * 'closed_to_gathering'. Nothing here reads any of them.
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
     *
     * Generalises `BeastTide.causeKnownLocally`. False is the common and more
     * interesting case, and it is a ceiling on hearsay rather than on truth:
     * see {@link localCeilingFor}.
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
     *
     * Free-form strings, matched by string, in the same way a hazard is. This
     * is the whole of the availability model: the goods are not counted, they
     * are stopped. {@link STOPS_PASSAGE} is the one entry with a constant,
     * because a travel predicate has to match it in another file.
     */
    stops: readonly string[];
    /** What everything still to be had here costs while this is true. */
    priceMultiplier: number;
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
    dangerDelta?: number;
}

/**
 * The only way to make one, and it refuses the two shapes that are bugs.
 *
 * A status with no review date never lifts. A status whose review is at or
 * before its start has already ended and will read as running forever to any
 * caller comparing days the obvious way.
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
 *
 * A status past its review day and never looked at is NOT running. That is the
 * design decision and it is the one that stops a famine outliving the world: an
 * unattended status expires rather than persisting. Whoever wants it to go on
 * has to say so.
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
 *
 * `regionOf` in `what-people-are-saying.ts` answers the last element of this
 * and is the right call when the province is the question. This is the whole
 * chain, because a worked-out district is not a worked-out province.
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
 *
 * Separate from {@link areaChainOf} so a caller asking about every place in the
 * world builds the index once. Walking the whole map per location is the
 * difference between this layer being cheap and being quadratic, and a world
 * carries around a thousand places.
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
 *
 * Read off `NpcRecord.locationId` and nothing else. There is no second record
 * of who is where and there must not be: it would go out of agreement with the
 * first the moment anybody moved.
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
 * What everything still to be had here costs, as a multiplier.
 *
 * Multiplicative across statuses, because two things going wrong at once is
 * worse than either and the arithmetic should say so without a special case
 * for the pair.
 */
export function priceMultiplierInArea(
    statuses: readonly AreaStatus[],
    locations: readonly LocationRecord[],
    locationId: string | null,
    day: number
): number {
    let m = 1;
    for (const s of statusesInArea(statuses, locations, locationId, day)) {
        m *= Math.max(0, s.priceMultiplier);
    }
    return Number(m.toFixed(6));
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
 *
 * The two reasons are of different kinds and are deliberately reported apart.
 * A pass that is shut five months a year is `LocationRecord.cycle` doing what
 * it already does; a blockade is somebody's decision. Both leave a traveller
 * outside, and only one of them lifts because somebody changed their mind.
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
 *
 * `causeKnownLocally` false does not mean the cause is unknowable. It means
 * asking around gets you as far as the signs and no further, so a cultivator
 * who wants the reason has to go and read the ground themselves. That is the
 * survey problem a tide is, stated as a ceiling.
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
 *
 * The ladder is `KnowingStage`'s own, read straight off `STAGE_MEANING`:
 *
 *   whisper       a word got said, and what it refers to cannot be worked out
 *   named         they know it is happening and roughly what it is
 *   placed        they know where, or when - so how long it has been true
 *   encountered   they have been in it, so they have the signs
 *   known         they have the cause
 *
 * Nothing is invented for this ladder and no sixth rung is added to it.
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
 *
 * A place where something is wrong says so in prose. It does not silently
 * return different numbers and leave somebody to work out why the millet cost
 * four times what it cost last year.
 *
 * `stageOf` is supplied by the caller from the social layer's records - one
 * stage per status id. A status the caller has no stage for reads `unaware`,
 * which is the ordinary case and produces no lines at all.
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
