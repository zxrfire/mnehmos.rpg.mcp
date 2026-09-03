/**
 * Where the Measured Span still keeps a counter somebody can walk up to, and
 * what runs from each of them.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * `buying-passage-at-a-measured-span-counter.ts` prices a passage, builds a
 * board and says what an absence on that board means. It could not be reached,
 * because nothing in the world said WHERE a counter is or WHAT runs from it -
 * `SPAN_COUNTER_CATALOG_GAP` records that in the module itself. This is that
 * table.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * EVERY ROW IS READ OFF THE REGION CATALOG. NOTHING HERE IS INVENTED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Two counters and one road each, and both were already written down in
 * `regions.ts` in the province's own words. They are quoted beside the rows so
 * a reader can check the derivation rather than take it:
 *
 *   FOURHANDS, in the White Stair. The branch entry: *"One of the nine
 *   stations, at the head of the pass, an hour from a station seventeen days'
 *   walk away ... it opens four days in nine."* The White Stair states exactly
 *   one seventeen-day road, and it goes to the Low Fall - so the far end is the
 *   Low Fall's own gate city, which is where that province counts everything
 *   that arrives.
 *
 *   SCARWATER, in the Low Fall. The province's own connection text: *"The
 *   border road from Scarwater to Kettle: eleven days by cart, four by Measured
 *   Span courier where the Span still runs it."* Two named places, a stated
 *   walked distance, and the house named as the thing that shortens it.
 *
 * THE ABSENCES ARE THE INFORMATION and are not a trimmed menu. Three of the
 * five provinces have no counter at all, because the catalog puts the house in
 * two of them and nowhere else. A player standing in the Wide Field is standing
 * where the survey does not reach, and {@link whatTheBoardDoesNotSay} says so in
 * the house's own voice. See the header of the counter module: what is not on a
 * board is where the inherited table stops.
 *
 * ── ONE SCHEDULE, BECAUSE THE CATALOG STATES ONE ─────────────────────────
 *
 * "Four days in nine" is the only Span timetable written down anywhere in this
 * world, so it is the timetable every route here runs on. Giving the second
 * route a different cycle would be authoring content in an engine module, and
 * the phase is offset by nothing: the two counters are on the same clock
 * because nobody has ever said they are not.
 *
 * ── AND WHICH OF THE TWO THE HOUSE DID NOT BUILD ─────────────────────────
 *
 * `SpanRoute.inheritedTerminal` separates Wide Age work the house merely keeps
 * from a span it folds itself, and the two entries answer it differently for a
 * reason each states:
 *
 *   Fourhands is *"one of the nine stations"* and runs on the station's own
 *   cycle. Nine is the count of the terminals the house inherited and cannot
 *   reopen when one stops answering.
 *   Scarwater to Kettle is a COURIER route - *"four by Measured Span courier
 *   where the Span still runs it"* - which is the house's own hand doing the
 *   work, conditionally, and is therefore not a terminal at all.
 *
 * ── THE FARE, AND WHY IT IS HERE RATHER THAN ON THE PRICE BOARD ──────────
 *
 * `quotePassageAtACounter` takes the rate as an argument on purpose, and the
 * catalog quotes the house at *900 per true li* - a figure in a unit nobody
 * outside the house can convert, which is the whole of its pricing position and
 * is not something any caller can turn into a fare. So the rate below is stated
 * in the unit a buyer can check, and is anchored against the line on the price
 * board that prices the same road: caravan passage, 250 per 100 li, *"the border
 * road to Kettle is eleven days and priced as such"*. See {@link
 * SPAN_CASH_PER_WALKED_DAY}.
 *
 * PURE. State in, deltas out. No I/O, no DB, no mutation of inputs, and nothing
 * stochastic - a timetable is not a roll.
 */

import type { SpanRoute } from './buying-passage-at-a-measured-span-counter.js';
import type { OpeningCycle } from './locations.js';
import { PLACE } from '../../data/cultivation/place-names.js';

/** The house whose counters these are. */
export const THE_SPAN_HOUSE_ID = 'house-measured-span';

/**
 * Four days in nine, off the Fourhands Terminal entry, and the only Span
 * timetable this world states.
 *
 * `phaseDay` 0 rather than a per-counter offset: nothing anywhere says the two
 * counters are on different clocks, and staggering them would be a decision
 * nobody has made.
 */
export const SPAN_SCHEDULE: OpeningCycle = Object.freeze({
    periodDays: 9,
    openDays: 4,
    phaseDay: 0
});

/**
 * What a fare costs, per walked day the span replaces, in cash.
 *
 * FOUR HUNDRED, and it is derived rather than picked. The price board carries
 * caravan passage at 250 per 100 li and says in its own note that the eleven-day
 * border road to Kettle is priced by it, which puts an ordinary crossing of that
 * road somewhere near 1,400 cash with food and company thrown in. A Span fare
 * has to sit well above that, because what it sells is not speed on the road -
 * it is not being on the road, and the one journey nothing else in the world
 * offers at any price.
 *
 * What that produces, and it is the figure worth checking: the eleven-day
 * Scarwater road costs 4,400 cash, which is forty-four spirit stones - half
 * again the whole starting purse of a new cultivator. So the ticket is out of
 * reach of somebody who has just arrived and comfortably inside a season of
 * wages, which is where a thing that saves eleven days of a life ought to sit.
 * The seventeen-day pass costs 6,800, and it is the only way over that pass in
 * the five months a year the road is shut.
 *
 * Multiplied by the province's own `priceMultiplier` at the point of sale, like
 * every other line on the board. A rate is content; a caller sets the local one.
 */
export const SPAN_CASH_PER_WALKED_DAY = 400;

/**
 * Every counter the catalog puts the house at, and what runs from it.
 *
 * Both directions of each road are listed as separate rows, because a board is
 * read at a counter and `boardAt` filters on `fromPlace`. A route that existed
 * in only one direction would be a counter you can arrive at and not leave.
 */
export const SPAN_ROUTES: readonly SpanRoute[] = Object.freeze([
    // ── The White Stair, and the pass ────────────────────────────────────
    //
    // "An hour from a station seventeen days' walk away." The seventeen-day
    // road out of the White Stair is the one to the Low Fall, and it is shut
    // five months a year, which is the whole reason this station is paid for.
    {
        id: 'span-fourhands-low-fall',
        fromPlace: PLACE.FOURHANDS,
        toPlace: PLACE.LOW_FALL,
        walkedDaysItReplaces: 17,
        schedule: SPAN_SCHEDULE,
        inheritedTerminal: true
    },
    {
        id: 'span-low-fall-fourhands',
        fromPlace: PLACE.LOW_FALL,
        toPlace: PLACE.FOURHANDS,
        walkedDaysItReplaces: 17,
        schedule: SPAN_SCHEDULE,
        inheritedTerminal: true
    },
    // ── The Low Fall, and the border road ────────────────────────────────
    //
    // "Eleven days by cart, four by Measured Span courier where the Span still
    // runs it." The conditional is the house's weak period showing on a
    // timetable, and it is why this row is a folded route rather than a
    // terminal: a terminal answers or it does not, and a courier route is
    // somebody's hand.
    {
        id: 'span-scarwater-kettle',
        fromPlace: PLACE.SCARWATER,
        toPlace: PLACE.KETTLE,
        walkedDaysItReplaces: 11,
        schedule: SPAN_SCHEDULE,
        inheritedTerminal: false
    },
    {
        id: 'span-kettle-scarwater',
        fromPlace: PLACE.KETTLE,
        toPlace: PLACE.SCARWATER,
        walkedDaysItReplaces: 11,
        schedule: SPAN_SCHEDULE,
        inheritedTerminal: false
    }
]);

/** Loose comparison, so a place typed with an article still finds its counter. */
function key(name: string): string {
    return name.trim().replace(/^the\s+/i, '').toLowerCase();
}

/** True where the house keeps a counter at this place. */
export function thereIsACounterAt(place: string): boolean {
    return SPAN_ROUTES.some(route => key(route.fromPlace) === key(place));
}

/** The counter's own name for this place, or null where there is no counter. */
export function counterPlaceNameAt(place: string): string | null {
    const found = SPAN_ROUTES.find(route => key(route.fromPlace) === key(place));
    return found?.fromPlace ?? null;
}

/** Everywhere the house will sell a passage to from here. */
export function routesFrom(place: string): readonly SpanRoute[] {
    return SPAN_ROUTES.filter(route => key(route.fromPlace) === key(place));
}

/** One line on a board, by the name a player would type back at it. */
export function routeTo(place: string, destination: string): SpanRoute | null {
    return routesFrom(place).find(route => key(route.toPlace) === key(destination)) ?? null;
}
