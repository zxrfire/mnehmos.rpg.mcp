/**
 * A competition a house holds that anybody may enter, and the day it falls.
 *
 * `gatherings.ts` is the CLOSED competition and is complete: two houses that
 * would sit down with each other, delegations drawn from `chosenOf`, one board
 * per realm. Nothing here rebuilds any of it. What is missing is the other kind
 * a house holds - the one it opens the gate for - and the first thing missing
 * about it is that nobody outside the house could ever find out it was going to
 * happen. `what-people-are-saying.ts` carries a gathering as *"held something
 * and the placings went round afterwards, N years ago"*: past tense, no date.
 * A competition a player cannot hear about before it falls is not built.
 *
 * ── WHY THIS IS A NOTICE AND NOT A CHANNEL OF ITS OWN ────────────────────
 *
 * The discovery layer is already four deep and wired end to end:
 * `noticesOnTheWall` composes what is nailed up, `readTheWall` grants the house
 * through the same `KnowledgeGate.learnIfNew` every other source goes through,
 * `billsOnTheWall` answers the same question without writing, and
 * `whatThereIsToWaitFor` lets a player wait for anything on paper that carries a
 * day. A second announcement channel beside that would be the defect this repo
 * keeps producing - a capability built correctly with nothing routed to it -
 * committed deliberately. So an open competition is a fourth `TheAsk`, and
 * every one of those four reads answers about it without being told it exists.
 *
 * ── A DATE THE WORLD STATES DOES NOT MOVE BECAUSE SOMEBODY LOOKED AT IT ──
 *
 * The day is a function of the seed, the house and the YEAR, so reading the
 * same wall twice a month apart gives one day a month closer rather than two
 * different days. The intake learned this expensively enough that
 * `RecruitingBill.opensOnDay` carries the rule in its own comment; this keeps it
 * the same way and for the same reason.
 *
 * ── WHAT IS NOT READ YET, WRITTEN DOWN RATHER THAN LICENSED ──────────────
 *
 * WHICH house opens its gate is a calendar here and not a reason. The reason
 * exists and is already computed:
 * `whatAContestIsWorthToThePeopleInIt` pays by how far up a board somebody was
 * pushed, so a house whose own field is shallow gets nothing out of a closed
 * board and everything out of a deep one - which is why it would invite anybody.
 * Reading that needs the house's roll, and this layer is handed no world: the
 * wall is derived from the catalog, the seed and the day, which is what lets it
 * answer on a machine with no world open. When an open competition grows
 * entrants it will have a world, and that is where the reason belongs. Until
 * then this is a calendar and says so.
 */

import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

/**
 * How often one house opens its gate, in years.
 *
 * Stated against `GATHERING_YEARS`, which is 15 for a circle of allied houses.
 * A closed gathering is a circle's calendar and this is one house's, so the
 * shorter figure is not a claim that open competitions are commoner than closed
 * ones - a province holding ten houses runs this ten times over.
 *
 * MEASURED on the shipped catalog, every city on the map across three years,
 * and the figure is a property of the PROVINCE rather than of this number: a
 * province holds about ten houses, so what a player standing at a city wall sees
 * is ten calendars pooled.
 *
 *     every 3 years    a competition was pending on 70% of days
 *     every 7 years    36%
 *
 * Seventy per cent is not an occasion, it is furniture - a wall that nearly
 * always has a competition coming teaches a player to stop reading it. A third
 * is a thing that is sometimes happening, and all four cities still met one
 * inside a player's first year. The other dial, {@link A_NOTICE_GOES_UP_DAYS},
 * was left
 * where it is on purpose: it is tied to the intake's horizon for a reason of its
 * own and is not free to be tuned.
 */
export const AN_OPEN_COMPETITION_EVERY_YEARS = 7;

/**
 * How long before it falls the paper goes up.
 *
 * The same horizon `A_BILL_STAYS_UP_FOR_DAYS` gives an intake, so the two dated
 * papers on a wall are dated on one horizon: a player who can plan for an
 * admission day can plan for this, and neither is a date so far out that the
 * sentence "I wait for it" means giving up a season to a rumour.
 */
export const A_NOTICE_GOES_UP_DAYS = 90;

/** A house with a gate it could open. The whole of what deciding needs. */
export interface AHouseWithAGateItCouldOpen {
    id: string;
    name: string;
}

/** One open competition, as the paper about it needs it. */
export interface ACompetitionAnybodyMayEnter {
    hostId: string;
    hostName: string;
    /** Absolute day it falls, on whatever clock the caller keeps. */
    onDay: number;
}

/**
 * The day this house's open competition falls in the given year, or null where
 * it holds none that year.
 *
 * Null is the ordinary answer. A house that held one every year would be
 * running a season rather than an occasion.
 */
export function theDayItFallsIn(
    seed: string,
    house: AHouseWithAGateItCouldOpen,
    year: number
): number | null {
    const rng = forStream(seed, 'open-competition', house.id, year);
    if (!rng.chance(1 / AN_OPEN_COMPETITION_EVERY_YEARS)) return null;
    return year * DAYS_PER_YEAR + rng.int(0, DAYS_PER_YEAR - 1);
}

/**
 * What this house has on paper today, or null where it has nothing.
 *
 * NEVER A DAY THAT HAS PASSED, which is the rule `billsOnTheWall` keeps in so
 * many words - a bill is never advertising something that has already happened.
 * This year is checked first and next year after it, so a competition falling in
 * the first weeks of a year is on the wall before the year turns.
 */
export function whatThisHouseHasOnPaper(
    seed: string,
    house: AHouseWithAGateItCouldOpen,
    onDay: number
): ACompetitionAnybodyMayEnter | null {
    const thisYear = Math.floor(Math.max(0, onDay) / DAYS_PER_YEAR);
    for (const year of [thisYear, thisYear + 1]) {
        const day = theDayItFallsIn(seed, house, year);
        if (day === null) continue;
        if (day < onDay) continue;
        if (day - onDay > A_NOTICE_GOES_UP_DAYS) continue;
        return { hostId: house.id, hostName: house.name, onDay: day };
    }
    return null;
}
