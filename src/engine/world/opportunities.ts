/**
 * Opportunity windows.
 *
 * Every opportunity in this world carries a temporal window, and the world does
 * not hold it open:
 *
 *   a spirit fruit ripens         12 days
 *   a secret realm opens          every 80 years
 *   an ancient cultivator wakes   once in 300 years
 *   sect recruitment              annually
 *   a war escalates               over 4 years
 *
 * The point of storing this rather than improvising it is that the player can
 * then MISS THINGS - permanently, including things they never heard about.
 * Missing a realm that opens once a century by four months is a legitimate and
 * desirable outcome, and it is only possible if the window was on the books
 * before anyone knew whether the player would be there.
 *
 * ── What this module is not ──────────────────────────────────────────────
 *
 * It is storage and arithmetic. It does not decide that an opportunity should
 * exist, does not decide who takes one, and does not simulate a race for it.
 * The LLM decides those and calls {@link claimOpportunity}. What is here is the
 * schedule, the closed-form window maths, the claim write path, and the query
 * `advanceTime` uses to report windows that opened and shut with nobody there.
 *
 * ── Someone else took it ─────────────────────────────────────────────────
 *
 * `claimedById` is a plain string. A window closing unclaimed and a window
 * closing because a rival got there first are different world states with
 * different consequences, and both are representable without any simulation:
 * the narrator decides a rival took it, records the claim, and the fruit is
 * gone for everybody thereafter.
 *
 * All arithmetic is closed-form on (opensOnDay, durationDays, recurrenceDays),
 * so asking whether a three-hundred-year cycle is open in year 9,000 costs the
 * same as asking about tomorrow.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { makeRequirements, type CapabilityRequirements } from './capability.js';

// ─────────────────────────────────────────────────────────────────────────
// RECORDS
// ─────────────────────────────────────────────────────────────────────────

export type OpportunityKind =
    /** A thing that ripens, surfaces, or is briefly available. */
    | 'resource'
    /** A sealed place that opens on a cycle. */
    | 'realm_opening'
    /** Something that has been asleep and will not be for long. */
    | 'awakening'
    /** A faction taking applicants. */
    | 'recruitment'
    /** A situation escalating on a schedule: a war, a famine, a succession. */
    | 'conflict'
    /** A market, a fair, an auction. */
    | 'market'
    /** Somebody will be somewhere, once. */
    | 'meeting'
    /** An inheritance trial, a grave, a legacy. */
    | 'inheritance'
    | 'other';

export interface OpportunityWindow {
    id: string;
    kind: OpportunityKind;
    name: string;
    /** Factual statement of what is available. The narrator renders it. */
    summary: string;

    locationId: string | null;
    factionIds: string[];

    /** Absolute day the first window opens. */
    opensOnDay: number;
    /** How long each window stands open. */
    durationDays: number;
    /** Days between openings. Null for a one-shot. */
    recurrenceDays: number | null;
    /** Remaining openings after the first. Null for unbounded recurrence. */
    remainingOccurrences: number | null;
    /** Absolute day after which the opportunity does not recur at all. */
    endsAfterDay: number | null;

    /** What it takes to take it. Answered through `capability.ts`. */
    requirements: CapabilityRequirements;

    /**
     * Taken. A one-shot opportunity is over; a recurring one skips the window
     * it was taken in and comes round again.
     */
    claimed: boolean;
    claimedById: string | null;
    claimedOnDay: number | null;

    /** Windows that opened and shut with nobody taking it. */
    missedWindows: number;
    /**
     * Who knows this exists. Empty means nobody does, and a window can open and
     * close with the world entirely unaware - which is the normal case.
     */
    knownToIds: string[];

    tags: string[];
    data: Record<string, string | number | boolean | null>;
}

export function makeOpportunity(
    init: Partial<OpportunityWindow> &
        Pick<OpportunityWindow, 'id' | 'kind' | 'name' | 'summary' | 'opensOnDay' | 'durationDays'>
): OpportunityWindow {
    return {
        locationId: null,
        factionIds: [],
        recurrenceDays: null,
        remainingOccurrences: null,
        endsAfterDay: null,
        requirements: makeRequirements(),
        claimed: false,
        claimedById: null,
        claimedOnDay: null,
        missedWindows: 0,
        knownToIds: [],
        tags: [],
        data: {},
        ...init
    };
}

/** Days for a span given in years. The two clocks are the same clock. */
export function years(n: number): number {
    return Math.round(n * DAYS_PER_YEAR);
}

// ─────────────────────────────────────────────────────────────────────────
// WINDOW ARITHMETIC
// ─────────────────────────────────────────────────────────────────────────

export interface Window {
    opensOnDay: number;
    closesOnDay: number;
    /** 0 for the first opening, 1 for the next, and so on. */
    index: number;
}

/** True when a window is standing open on this day. */
export function isOpportunityOpen(opp: OpportunityWindow, day: number): boolean {
    const w = windowContaining(opp, day);
    return w !== null;
}

/**
 * The window containing this day, or null.
 *
 * `includeClaimed` is for the miss report: a one-shot that somebody else took
 * still HAD a window, and reporting that window is the difference between "you
 * arrived late" and "a rival got there first".
 */
export function windowContaining(
    opp: OpportunityWindow,
    day: number,
    includeClaimed = false
): Window | null {
    if (opp.claimed && opp.recurrenceDays === null && !includeClaimed) return null;
    if (day < opp.opensOnDay) return null;
    if (opp.endsAfterDay !== null && day > opp.endsAfterDay) return null;

    if (opp.recurrenceDays === null || opp.recurrenceDays <= 0) {
        return day < opp.opensOnDay + opp.durationDays
            ? { opensOnDay: opp.opensOnDay, closesOnDay: opp.opensOnDay + opp.durationDays, index: 0 }
            : null;
    }

    const elapsed = day - opp.opensOnDay;
    const index = Math.floor(elapsed / opp.recurrenceDays);
    if (opp.remainingOccurrences !== null && index > opp.remainingOccurrences) return null;
    const offset = elapsed - index * opp.recurrenceDays;
    if (offset >= opp.durationDays) return null;
    const opens = opp.opensOnDay + index * opp.recurrenceDays;
    return { opensOnDay: opens, closesOnDay: opens + opp.durationDays, index };
}

/** The next window opening at or after `fromDay`, or null when there is none. */
export function nextWindow(
    opp: OpportunityWindow,
    fromDay: number,
    includeClaimed = false
): Window | null {
    if (opp.claimed && opp.recurrenceDays === null && !includeClaimed) return null;

    if (opp.recurrenceDays === null || opp.recurrenceDays <= 0) {
        if (fromDay >= opp.opensOnDay + opp.durationDays) return null;
        const opens = Math.max(fromDay, opp.opensOnDay);
        if (opp.endsAfterDay !== null && opens > opp.endsAfterDay) return null;
        return { opensOnDay: opens, closesOnDay: opp.opensOnDay + opp.durationDays, index: 0 };
    }

    const current = windowContaining(opp, fromDay, includeClaimed);
    if (current) return { ...current, opensOnDay: Math.max(fromDay, current.opensOnDay) };

    const elapsed = fromDay - opp.opensOnDay;
    const index = elapsed < 0 ? 0 : Math.floor(elapsed / opp.recurrenceDays) + 1;
    if (opp.remainingOccurrences !== null && index > opp.remainingOccurrences) return null;
    const opens = opp.opensOnDay + index * opp.recurrenceDays;
    if (opp.endsAfterDay !== null && opens > opp.endsAfterDay) return null;
    return { opensOnDay: opens, closesOnDay: opens + opp.durationDays, index };
}

/**
 * Every window between two days, capped.
 *
 * The cap matters: a caller advancing three centuries over an annual
 * recruitment does not want three hundred rows, and an uncapped list is how a
 * cheap time advance stops being cheap.
 */
export function windowsBetween(
    opp: OpportunityWindow,
    fromDay: number,
    toDay: number,
    limit = 16,
    includeClaimed = false
): Window[] {
    const out: Window[] = [];
    let cursor = fromDay;
    while (out.length < limit) {
        const w = nextWindow(opp, cursor, includeClaimed);
        if (!w || w.opensOnDay > toDay) break;
        out.push(w);
        const step = opp.recurrenceDays && opp.recurrenceDays > 0 ? opp.recurrenceDays : opp.durationDays + 1;
        cursor = w.opensOnDay + Math.max(1, step);
        if (opp.recurrenceDays === null) break;
    }
    return out;
}

/** Days until the next opening, or null when it will never open again. */
export function daysUntilNextWindow(opp: OpportunityWindow, fromDay: number): number | null {
    const w = nextWindow(opp, fromDay);
    return w === null ? null : Math.max(0, w.opensOnDay - fromDay);
}

// ─────────────────────────────────────────────────────────────────────────
// CLAIMS AND MISSES
// ─────────────────────────────────────────────────────────────────────────

export interface ClaimResult {
    opportunity: OpportunityWindow;
    ok: boolean;
    reason: string;
}

/**
 * Somebody took it.
 *
 * The engine does not decide who; the narrator does, and this records it. A
 * claim outside an open window is refused, because "I got there four days
 * late" has to mean something.
 */
export function claimOpportunity(
    opp: OpportunityWindow,
    claimantId: string,
    onDay: number
): ClaimResult {
    if (opp.claimed && opp.recurrenceDays === null) {
        return {
            opportunity: opp,
            ok: false,
            reason: `${opp.name} was already taken by ${opp.claimedById ?? 'someone'}.`
        };
    }
    const window = windowContaining(opp, onDay);
    if (!window) {
        const next = nextWindow(opp, onDay);
        return {
            opportunity: opp,
            ok: false,
            reason:
                next === null
                    ? `${opp.name} is closed and will not open again.`
                    : `${opp.name} is not open. The next window is in ${next.opensOnDay - onDay} days.`
        };
    }
    return {
        opportunity: {
            ...opp,
            claimed: true,
            claimedById: claimantId,
            claimedOnDay: onDay
        },
        ok: true,
        reason: `${claimantId} took ${opp.name}.`
    };
}

/** Tell somebody an opportunity exists. Knowledge is a resource. */
export function revealTo(opp: OpportunityWindow, knowerId: string): OpportunityWindow {
    if (opp.knownToIds.includes(knowerId)) return opp;
    return { ...opp, knownToIds: opp.knownToIds.concat(knowerId).sort() };
}

export interface MissedWindow {
    opportunityId: string;
    name: string;
    kind: OpportunityKind;
    locationId: string | null;
    opensOnDay: number;
    closesOnDay: number;
    /** True when nobody in the world knew this window existed. */
    unknown: boolean;
    /** Set when a rival took it during the window rather than it lapsing. */
    takenById: string | null;
    /** Days until it comes round again, or null when it never will. */
    nextInDays: number | null;
}

/**
 * Windows that opened and shut inside a span without the observer taking them.
 *
 * The `unknown` flag distinguishes the two ways to lose something: arriving
 * four days late, and never having heard of it. Both are correct outcomes and
 * they read completely differently, so they are reported separately.
 */
export function missedWindowsFor(
    opp: OpportunityWindow,
    fromDay: number,
    toDay: number,
    observerId: string | null,
    limit = 8
): MissedWindow[] {
    const out: MissedWindow[] = [];
    // Claimed windows are included: a rival taking it is a miss, and a
    // materially different one from the window simply lapsing.
    for (const w of windowsBetween(opp, fromDay, toDay, limit, true)) {
        // A window still open at the end of the span has not been missed yet.
        if (w.closesOnDay > toDay) continue;
        const takenByObserver =
            opp.claimed &&
            opp.claimedById === observerId &&
            opp.claimedOnDay !== null &&
            opp.claimedOnDay >= w.opensOnDay &&
            opp.claimedOnDay < w.closesOnDay;
        if (takenByObserver) continue;

        const takenByOther =
            opp.claimed &&
            opp.claimedById !== observerId &&
            opp.claimedOnDay !== null &&
            opp.claimedOnDay >= w.opensOnDay &&
            opp.claimedOnDay < w.closesOnDay;

        out.push({
            opportunityId: opp.id,
            name: opp.name,
            kind: opp.kind,
            locationId: opp.locationId,
            opensOnDay: w.opensOnDay,
            closesOnDay: w.closesOnDay,
            unknown: observerId === null || !opp.knownToIds.includes(observerId),
            takenById: takenByOther ? opp.claimedById : null,
            nextInDays: daysUntilNextWindow(opp, toDay)
        });
    }
    return out;
}

/** Record that a window lapsed. Used by the clock; a plain counter. */
export function countMiss(opp: OpportunityWindow, misses = 1): OpportunityWindow {
    return { ...opp, missedWindows: opp.missedWindows + misses };
}

// ─────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────

export interface OpportunityQuery {
    kinds?: readonly OpportunityKind[];
    locationId?: string;
    factionId?: string;
    openOnDay?: number;
    /** Only ones this person knows about. */
    knownToId?: string;
    includeClaimed?: boolean;
    tags?: readonly string[];
    limit?: number;
}

export function queryOpportunities(
    opportunities: readonly OpportunityWindow[],
    q: OpportunityQuery = {}
): OpportunityWindow[] {
    const kinds = q.kinds ? new Set(q.kinds) : null;
    const rows = opportunities.filter(o => {
        if (kinds && !kinds.has(o.kind)) return false;
        if (q.locationId && o.locationId !== q.locationId) return false;
        if (q.factionId && !o.factionIds.includes(q.factionId)) return false;
        if (q.knownToId && !o.knownToIds.includes(q.knownToId)) return false;
        if (!q.includeClaimed && o.claimed && o.recurrenceDays === null) return false;
        if (q.tags && !q.tags.every(t => o.tags.includes(t))) return false;
        if (q.openOnDay !== undefined && !isOpportunityOpen(o, q.openOnDay)) return false;
        return true;
    });
    rows.sort((a, b) => a.opensOnDay - b.opensOnDay || (a.id < b.id ? -1 : 1));
    return q.limit != null ? rows.slice(0, q.limit) : rows;
}

/** Opportunities with a window opening soonest. What a planner reads. */
export function upcoming(
    opportunities: readonly OpportunityWindow[],
    fromDay: number,
    limit = 8
): { opportunity: OpportunityWindow; window: Window }[] {
    const rows: { opportunity: OpportunityWindow; window: Window }[] = [];
    for (const opp of opportunities) {
        const w = nextWindow(opp, fromDay);
        if (w) rows.push({ opportunity: opp, window: w });
    }
    rows.sort(
        (a, b) =>
            a.window.opensOnDay - b.window.opensOnDay ||
            (a.opportunity.id < b.opportunity.id ? -1 : 1)
    );
    return rows.slice(0, limit);
}
