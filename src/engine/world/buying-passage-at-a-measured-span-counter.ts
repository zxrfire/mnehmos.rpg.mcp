/**
 * Buying passage at a Measured Span counter: what is on the board, what it
 * costs, and what being sent through does to somebody who could never do it
 * themselves.
 *
 * THE RULING THIS IMPLEMENTS
 * --------------------------
 * The Span can send LOWER-LEVEL cultivators through, and that is why it is a
 * Dao house. Everybody else who folds space does it only for themselves,
 * because a personal fold is your own refinement doing the work and it needs
 * your own rung. The Span's understanding of space does the work instead, so
 * the traveller's rung is not what carries them - a courier at ordinal 10 can
 * be sent, and so can somebody who will never fold in their life.
 *
 * That is not an exception written for one faction. It is
 * `docs/world/houses/dao-houses.md` operating exactly as it says a Dao house
 * operates: what such a house holds is UNDERSTANDING, which
 * `docs/world/climbing/understanding.md` already models as an axis separate
 * from rank, and the house of space is listed there as the one that reaches
 * into travel, portals, territory, formations, storage and barriers. Read both
 * before changing anything here. Neither is restated.
 *
 * ── So the Span's reliable rung is not an embarrassment ──────────────────
 *
 * `reliableOrdinal` 25 sits below {@link FOLD_FLOOR_ORDINAL}, and that is not a
 * house failing at its own trade. Its trade was never "our members fold". Its
 * trade is moving OTHER PEOPLE, which is work a member below the floor does all
 * day, and the accumulated table is what makes it possible rather than anybody's
 * personal rung. The house is in a weak period against its own past and is
 * working its way back up; `faction-character.ts` carries that as a live
 * internal split - the Long Measure against the Freight faction - rather than
 * as a mood.
 *
 * ── The product, and why it is the whole product ─────────────────────────
 *
 * A personal fold needs a fix, and the two that exist are things the folder did
 * themselves: ground they have stood on, or something they have seen. See
 * `how-far-somebody-can-fold-space-and-what-it-costs.ts`.
 *
 * A PASSENGER NEEDS NO FIX OF THEIR OWN. They need the SPAN to have one. That
 * is why the surveyed routes are the asset, why the house sells the fix rather
 * than the fold, and why the sentence that matters about this business is that
 * it takes people TO PLACES THEY HAVE NEVER BEEN. Nothing else in the world
 * does that at any price.
 *
 * ── It is a counter in a city, which makes it the map ────────────────────
 *
 * A branch is somewhere a person can walk up to and read what the house runs.
 * That is a second thing entirely from being fast, and it is the more important
 * one: somebody who has never left their province can stand at a board and find
 * out that there are other provinces, which of them can be reached, and what it
 * would take. Discovery in this world is otherwise a matter of being told by
 * somebody who happens to be near - correct for a farm child and useless as the
 * only channel.
 *
 * WHAT IS ON THE BOARD IS WHAT THE HOUSE HAS SURVEYED, and the absence is the
 * information. A route that is not listed is not a route the Span is hiding; it
 * is where the inherited table runs out. The Late Age, in front of the player,
 * as a price list. See {@link whatTheBoardDoesNotSay}.
 *
 * ── And it is not an automatic win, because no specialisation may be ─────
 *
 * `dao-houses.md` requires a counter to every principle and names this one:
 * space is countered by SPATIAL ANCHORING. The counter is already standing in
 * the catalog rather than needing to be invented - the Anchorhold nails ground
 * shut, and the Span's own stated grievance is that the world calls it public
 * safety. Anywhere anchored is anywhere no fare reaches.
 *
 * PURE. State in, deltas out. No I/O, no DB, no mutation of inputs, and nothing
 * stochastic - a timetable is not a roll.
 */

import { clampOrdinal } from '../cultivation/realms.js';
import { FOLD_FLOOR_ORDINAL } from './how-far-somebody-can-fold-space-and-what-it-costs.js';
import {
    isOpenOn,
    nextOpeningDay,
    type LocationRecord,
    type OpeningCycle
} from './locations.js';

/**
 * A schedule presented as the shape the cycle readers take.
 *
 * `isOpenOn` and `nextOpeningDay` read exactly two fields - `cycle` and
 * `sealed` - and a published timetable is the same arithmetic as a ruin's
 * opening cycle. Reusing them rather than writing the modulo again is the
 * point; widening their signature is a change to a shared file for nobody's
 * benefit, so the narrowing happens here, once, where it can be seen.
 */
function asSchedule(cycle: OpeningCycle): LocationRecord {
    return { cycle, sealed: false } as unknown as LocationRecord;
}

// ─────────────────────────────────────────────────────────────────────────
// A ROUTE
//
// The shape is the catalog's own. The Fourhands Terminal in `regions.ts` is
// "one of the nine stations, at the head of the pass, an hour from a station
// seventeen days' walk away ... it opens four days in nine" - which is a pair
// of endpoints, a walked distance the span replaces, and a published schedule.
// Nothing here was invented; it was read off a branch entry that has been in
// the catalog the whole time.
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing the house will sell you at a counter.
 *
 * A route EXISTS in this table only if the Span has surveyed it. There is no
 * `surveyed` flag, deliberately: an unsurveyed route is not a row with a false
 * on it, it is a row that is not there, which is the same discipline
 * `provenance.ts` keeps about a ruin nobody has placed.
 */
export interface SpanRoute {
    id: string;
    /** The counter you are standing at. */
    fromPlace: string;
    /** Where it puts you. A place, never a region: a span joins two points. */
    toPlace: string;
    /**
     * What the same journey costs on foot.
     *
     * The figure a buyer can check, and the reason it is the one used here. The
     * house itself quotes per li of TRUE distance off a table nobody outside it
     * can verify, which is its whole pricing position and is not something this
     * module is in a position to compute.
     */
    walkedDaysItReplaces: number;
    /**
     * The published schedule. A span is held open at a cost and is not standing
     * open all year.
     *
     * An `OpeningCycle`, which is the field a ruin's convergence already uses -
     * so `isOpenOn` and `nextOpeningDay` answer "is there a departure today"
     * and "when is the next one" with no new machinery at all.
     */
    schedule: OpeningCycle;
    /**
     * Whether this is one of the inherited terminals rather than a route the
     * house folds down itself.
     *
     * A terminal is Wide Age work, it runs in both directions permanently, and
     * the Span did not build it and cannot reopen a closed one. A folded route
     * is the house's own method and needs a Span hand to work it. The
     * distinction matters to the fiction and not to the fare.
     */
    inheritedTerminal: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PASSENGER'S RUNG CHANGES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Days a passenger at the very bottom of the ladder spends settling afterwards.
 *
 * Three, which over the seventeen-day span the catalog actually describes still
 * leaves fourteen days saved. That margin is deliberate and is the whole
 * feasibility of the feature: **the ticket has to be decisively worth buying
 * for the people who cannot fold**, because they are who it is for.
 */
export const PASSENGER_SETTLING_AT_THE_BOTTOM = 3;

/**
 * What being sent through costs the passenger, in days.
 *
 * THE EXPLICIT ANSWER to what a passenger's rung changes, because leaving it
 * implied would let it be read three different ways:
 *
 *   IT DOES NOT CARRY THEM        the house's understanding does that. This is
 *                                 the ruling, and it is why a mortal can be
 *                                 sent at all.
 *   IT DOES NOT GATE THEM         nobody is refused for being too low. Agency:
 *                                 the engine says what a thing costs, never who
 *                                 may attempt it. The only honest noes here are
 *                                 the schedule and the survey, and neither is
 *                                 about the person.
 *   IT SETS WHAT IT COSTS THEM    being moved through space you do not
 *                                 understand is rough, and how rough is how
 *                                 little you understand. That is this function.
 *
 * Note the direction, because it is the exact inverse of a personal fold. There,
 * standing high buys you further. Here, standing low costs you more - and the
 * people it costs most are the people it is worth most to. Somebody at or above
 * the folding floor rides it easily and pays nothing but the fare, which is why
 * a Void Refinement cultivator buys a ticket only for somewhere they have no fix
 * on.
 *
 * Never lethal, and nothing here decides that anybody dies. It returns days.
 */
export function settlingDaysForPassenger(ordinal: number): number {
    const o = clampOrdinal(ordinal);
    if (o >= FOLD_FLOOR_ORDINAL) return 0;
    return Math.ceil(
        PASSENGER_SETTLING_AT_THE_BOTTOM * (FOLD_FLOOR_ORDINAL - o) / FOLD_FLOOR_ORDINAL
    );
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS
// ─────────────────────────────────────────────────────────────────────────

export interface PassageQuoteAtACounter {
    routeId: string;
    toPlace: string;
    /** Departures today, or not. */
    openToday: boolean;
    /** Absolute day of the next departure. Null when it is running today. */
    nextDepartureDay: number | null;
    heads: number;
    fareCash: number;
    /** Days the party loses settling afterwards, worst passenger first. */
    settlingDays: number;
    /** Everything the passage costs in days, waiting for a departure included. */
    daysSpent: number;
    daysSavedAgainstWalking: number;
    /** What the fare does not cover, because it is every passenger's complaint. */
    notCovered: string;
}

/**
 * Price one passage.
 *
 * The rate is passed in rather than held here, exactly as `quotePassage` in
 * `what-a-sea-crossing-costs.ts` takes its per-head-per-day figure: a rate is
 * content, it sits in the price table with the ferry and the caravan, it varies
 * by region multiplier, and a body that sets it is a body somebody can bargain
 * with.
 *
 * `worstPassengerOrdinal` rather than an average, because a party arrives
 * together and waits for the person the crossing was hardest on.
 */
export function quotePassageAtACounter(
    route: SpanRoute,
    input: {
        heads: number;
        worstPassengerOrdinal: number;
        cashPerWalkedDayReplaced: number;
        onDay: number;
    }
): PassageQuoteAtACounter {
    const heads = Math.max(1, Math.floor(input.heads));
    const schedule = asSchedule(route.schedule);
    const openToday = isOpenOn(schedule, input.onDay);
    const next = openToday ? null : nextOpeningDay(schedule, input.onDay);
    const waitDays = openToday ? 0 : Math.max(0, (next ?? input.onDay) - input.onDay);
    const settlingDays = settlingDaysForPassenger(input.worstPassengerOrdinal);
    const walked = Math.max(0, Math.ceil(route.walkedDaysItReplaces));

    // The crossing itself is an hour. It is counted as no days at all rather
    // than as one, which is the single place this engine departs from the
    // "a road is a road, round it to a day" rule everywhere else - because the
    // entire product is that no day was spent on the road, and rounding it up
    // to one would price away the thing being bought.
    const daysSpent = waitDays + settlingDays;

    return {
        routeId: route.id,
        toPlace: route.toPlace,
        openToday,
        nextDepartureDay: next,
        heads,
        fareCash: Math.round(walked * heads * Math.max(0, input.cashPerWalkedDayReplaced)),
        settlingDays,
        daysSpent,
        daysSavedAgainstWalking: Math.max(0, walked - daysSpent),
        notCovered:
            'Anything at the far end. A fare buys the crossing and a place in the queue for it; '
            + 'it does not buy a bed, a guide, or anybody who will admit knowing you when you '
            + 'arrive somewhere you have never been.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE BOARD, WHICH IS THE MAP
// ─────────────────────────────────────────────────────────────────────────

export interface BoardLine {
    routeId: string;
    toPlace: string;
    walkedDaysItReplaces: number;
    fareCash: number;
    openToday: boolean;
    nextDepartureDay: number | null;
    inheritedTerminal: boolean;
}

export interface CounterBoard {
    place: string;
    lines: BoardLine[];
    /** Zero is a real answer: a counter with nothing running is a counter. */
    running: number;
    /** The sentence a clerk would actually say about what is not up there. */
    limits: string;
}

/**
 * Everything this counter will sell today, with what each costs and when it goes.
 *
 * THE DISCOVERABILITY HALF. A board is a map somebody can read without owning a
 * map: a list of places, a distance to each in the unit every road in the world
 * is quoted in, and a price. Somebody who has never left their province learns
 * from it that there are other provinces.
 *
 * This module returns the DATA and does no telling. What a clerk will actually
 * say to this particular person, and what standing at a board does to what they
 * then know, is the knowledge layer's question and is asked where it is already
 * asked - a place read off a board is a place heard about, not a place stood
 * in, and those must stay different facts.
 *
 * Sorted nearest first, because somebody choosing is choosing on what they can
 * afford, and stable so the same board reads the same way twice.
 */
export function boardAt(
    place: string,
    routes: readonly SpanRoute[],
    cashPerWalkedDayReplaced: number,
    onDay: number
): CounterBoard {
    const here = routes.filter(r => r.fromPlace === place);
    const lines: BoardLine[] = here.map(route => {
        const quote = quotePassageAtACounter(route, {
            heads: 1,
            worstPassengerOrdinal: FOLD_FLOOR_ORDINAL,
            cashPerWalkedDayReplaced,
            onDay
        });
        return {
            routeId: route.id,
            toPlace: route.toPlace,
            walkedDaysItReplaces: route.walkedDaysItReplaces,
            fareCash: quote.fareCash,
            openToday: quote.openToday,
            nextDepartureDay: quote.nextDepartureDay,
            inheritedTerminal: route.inheritedTerminal
        };
    }).sort((a, b) =>
        a.walkedDaysItReplaces - b.walkedDaysItReplaces
        || (a.routeId < b.routeId ? -1 : 1)
    );

    return {
        place,
        lines,
        running: lines.length,
        limits: whatTheBoardDoesNotSay(lines.length)
    };
}

/**
 * What the absence on a board means, said plainly.
 *
 * The board is not a menu the designer trimmed. It is the reach of an inherited
 * table, and the places that are not on it are where that table stops. A player
 * reading a short board has been told something true about the age they are
 * living in, and it should be said rather than left as a gap they read as a
 * missing feature.
 */
export function whatTheBoardDoesNotSay(running: number): string {
    if (running === 0) {
        return 'Nothing runs from here. The house keeps a counter because a counter is worth '
            + 'keeping, and everything it could once sell from this one went with the spans '
            + 'that stopped answering.';
    }
    return `${running} route${running === 1 ? '' : 's'}, and that is the whole of it. What is `
        + 'not on the board is not withheld and is not for sale at a better price: it is where '
        + 'the survey ends. Nobody now living has extended it, and the house says so.';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS NEEDS FROM FILES THIS MODULE DOES NOT OWN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recorded rather than quietly left, the way `SEA_CROSSING_ENGINE_GAP` is.
 *
 * A `RegionBranch` in `regions.ts` carries `parentSectId`, `localName` and
 * `doesHere` and nothing else, so the Fourhands Terminal's far end, its
 * seventeen days and its four-days-in-nine schedule exist only as prose in a
 * description. Everything above reads structured fields that the catalog does
 * not yet have.
 */
export const SPAN_COUNTER_CATALOG_GAP = {
    what: 'No Span route in the catalog is machine-readable, so no board can be built for a live world yet.',
    whereItWouldGo: 'RegionBranchSchema in src/data/cultivation/regions.ts, whose Fourhands Terminal entry already states a far end, a walked distance and a schedule in prose.',
    whatItWouldTake: 'Optional structured fields on a branch - the far place, the walked days the span replaces, and periodDays/openDays/phaseDay - plus a branch in each major city. The Fourhands entry is the worked example and needs no new prose.',
    whyItIsNotDoneHere: 'regions.ts is a shared catalog owned by somebody else, and a schema field is exactly the shared contract that conflicts badly when two agents touch it at once.'
} as const;
