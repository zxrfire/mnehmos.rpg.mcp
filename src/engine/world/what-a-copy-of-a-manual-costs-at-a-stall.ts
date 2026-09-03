/**
 * What a copy of a manual costs at a stall, and which manuals a stall has.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE SETTING ALREADY SAID
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/things/items.md` is unambiguous and this module is only its arithmetic:
 * below the line things have prices, common manuals sell at a market stall next
 * to the cooking pots, and a poor cultivator's first real decision is whether
 * the money goes on a book or on food. `docs/world/climbing/manuals.md` says the same
 * thing from the other side - common books are copyable by anybody holding one,
 * which is what makes them plentiful, and selling copies is an ordinary living
 * for a cultivator who needs stones and has nothing else to trade.
 *
 * That decision did not exist. It exists now, and it is the first interesting
 * choice in the game.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A NUMBER SOMEBODY PICKED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `AGENTS.md` says a count needs a physical reason and that scarcity is
 * measured rather than authored, so both halves of the price are read off
 * catalogs that already exist and neither is written down here.
 *
 *   WHOSE TIME    A copy is somebody's months. `manuals.md` says only somebody
 *                 who has read a book to its end can write it out again, so the
 *                 copyist stands at or above the book's `requiredOrdinal` - and
 *                 `OCCUPATIONS` already says what work is open to a cultivator
 *                 at that rung and what it pays. The price is what the copyist
 *                 gave up to make the copy, which is why a deeper book costs
 *                 more for a reason rather than by decree.
 *
 *   HOW LONG      One month per realm the book carries a reader through, plus
 *                 one for the copying itself. A primer covering Qi Condensation
 *                 is two months of somebody's life.
 *
 * The MEDIAN wage is deliberate rather than the best one. Pricing off the
 * best-paid work at a rung prices every copy against burn-zone gleaning, which
 * kills one gatherer in nine a season - that is not the alternative somebody
 * sitting with a brush turned down, and measured it made a beginner's primer
 * cost more than the purse a run opens with, which is the soft lock this file
 * is supposed to prevent rather than create.
 *
 * Measured against the catalog as it stands, and both figures are the whole of
 * what a stall carries: the Lesser Qi-Gathering Manual is 780 cash - 8 spirit
 * stones out of a 30-stone opening purse - and the Five-Breath Circulation
 * Scripture is 1,300, or 13. Against a month of rations at 120 cash, the primer
 * is between six and seven months of eating, which is the trade `items.md`
 * names. It is deliberately not ruinous: the guard in `manuals-wired.test.ts`
 * says the first book has to be reachable in every fresh life or the hard
 * ceiling at `BOOKLESS_CEILING` becomes a soft lock on turn one, and a price
 * nobody can pay is the same wall wearing an economy.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHAT A STALL DOES NOT HAVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The two conditions are the two halves of the same line `items.md` draws, and
 * both are required:
 *
 *   WIDELY HELD   `COMMON_HOUSE_COUNT` houses or more teach it. A book one
 *                 house teaches is that house's, however low it carries - the
 *                 Azure Dew Sect's gathering canon opens at 0 and stops at 13
 *                 exactly as the block-printed primer does, and four hundred
 *                 years of Dew teachers have written into it what each of them
 *                 learned working a village. That is what somebody sweeps a
 *                 courtyard for, and a stall selling it would be selling the
 *                 only argument the house has.
 *
 *   BELOW THE     `COMMON_MANUAL_CAP`. Note what this is and is not. The
 *   LINE          counted/tracked line for a book is the FIRST condition alone
 *                 - `significanceOfManual` files a holding as `mundane` where
 *                 `isCommonlyHeld` says nobody owns it - and `items.md` says a
 *                 thing is cash-priced exactly where it is fungible. So a stall
 *                 sells a strict SUBSET of what is counted, and the extra
 *                 condition is about the stall rather than about the book: a
 *                 shared crossing scripture on twenty-four shelves is nobody's
 *                 property and anybody may copy it, and it still does not turn
 *                 up on a trestle beside the cooking pots. It moves house to
 *                 house, between people who can already read it.
 *
 * A manual above that line is not expensive here. It has no price at all, which
 * is what `items.md` means by "not 'expensive' - not for sale", and the refusal
 * for one says so and names the routes that do work.
 */

import { CASH_PER_STONE, OCCUPATIONS } from '../../data/cultivation/mortal-world.js';
import { getTechnique, TECHNIQUES } from '../../data/cultivation/techniques.js';
import { realmForOrdinal } from '../cultivation/realms.js';
import {
    COMMON_HOUSE_COUNT,
    COMMON_MANUAL_CAP,
    housesTeaching,
    type Manual
} from './manuals.js';

/** The shape this module reads off the technique catalog, and nothing more. */
interface CatalogRow {
    id: string;
    name: string;
    class?: string;
    cap?: number | null;
    requiredOrdinal: number;
    element?: string | null;
}

// ─── HOW LONG A COPY TAKES ────────────────────────────────────────────────

/**
 * The month that is the copying itself, on top of the months of coverage.
 *
 * A book carrying a reader through no realm boundary at all is still a physical
 * object somebody sat and wrote, so the floor is one month rather than none.
 * Without it a short bridge manual would be free, which is the defect this
 * file exists to close, in miniature.
 */
export const MONTHS_TO_WRITE_ONE_OUT = 1;

/**
 * How many months of somebody's life a copy of this manual is.
 *
 * Counted in realms rather than in rungs because that is what a manual is
 * organised by - `manuals.md`: a realm boundary is a change in kind, and a
 * method that carries somebody across one is a different piece of work from a
 * method that polishes them. So the months follow the sections, not the ladder.
 *
 * THE CAP IS NOT A SECTION. `manuals.md` is explicit that the number in the
 * catalog is where the CROSSING leaves the reader standing rather than where
 * the paper stops - the paper stopped at Perfection, one rung below - which is
 * why complete books cap at 13, 17, 21 and not at 12, 16, 20. Counting the
 * realm the cap lands in charges a primer for a section it does not contain,
 * and it charges every complete book in the world for one.
 */
export function monthsToCopy(requiredOrdinal: number, cap: number): number {
    const lastWritten = Math.max(requiredOrdinal, cap - 1);
    const opens = realmForOrdinal(requiredOrdinal);
    const stops = realmForOrdinal(lastWritten);
    let realms = 1;
    for (let ordinal = opens.ordinalEnd + 1; ordinal <= stops.ordinalStart; ordinal += 1) {
        if (realmForOrdinal(ordinal).ordinalStart === ordinal) realms += 1;
    }
    return MONTHS_TO_WRITE_ONE_OUT + realms;
}

// ─── WHOSE MONTHS THEY ARE ────────────────────────────────────────────────

/**
 * What a cultivator standing at this rung is paid for a month of work.
 *
 * The median of what is actually open to them, off `OCCUPATIONS`, filtered the
 * way the work board filters: cultivator work and the work either sort can
 * take, at or below the rung. Mortal-only rows are excluded because the person
 * who can copy this book is not a mortal.
 *
 * Returns null when the catalog offers somebody at that rung nothing at all,
 * which is the honest answer rather than a fallback: at a height where nobody
 * is hiring, nobody is copying books for a living either.
 */
export function copyistMonthlyCash(requiredOrdinal: number): number | null {
    const open = OCCUPATIONS
        .filter(o => o.kind !== 'mortal' && o.minOrdinal <= requiredOrdinal)
        .map(o => o.cashPerMonth)
        .sort((a, b) => a - b);
    if (open.length === 0) return null;
    const mid = Math.floor(open.length / 2);
    return open.length % 2 === 1
        ? open[mid]
        : Math.round((open[mid - 1] + open[mid]) / 2);
}

// ─── WHAT A STALL HAS ─────────────────────────────────────────────────────

/**
 * Whether a stall would carry this book at all.
 *
 * Both halves of the line `items.md` draws; see the banner for why each is
 * required. Anything that is not a cultivation manual - a combat art, a dao
 * art, anything the catalog gives no cap - is not a road and is not this
 * module's business.
 */
export function isSoldAtAStall(techniqueId: string): boolean {
    const row = getTechnique(techniqueId) as CatalogRow | undefined;
    if (!row || row.class !== 'cultivation' || row.cap == null) return false;
    if (Number(row.cap) > COMMON_MANUAL_CAP) return false;
    return housesTeaching(techniqueId) >= COMMON_HOUSE_COUNT;
}

/**
 * What a copy costs, in cash, or null when nobody sells one.
 *
 * Cash rather than stones, because every other price in the world is quoted in
 * cash and `localPrice` scales cash. The caller converts with the same
 * `cashToStones` the market board uses, so a book and a bowl of millet cannot
 * end up on two different scales.
 */
export function stallPriceCash(techniqueId: string): number | null {
    if (!isSoldAtAStall(techniqueId)) return null;
    const row = getTechnique(techniqueId) as CatalogRow | undefined;
    if (!row) return null;
    const wage = copyistMonthlyCash(row.requiredOrdinal);
    if (wage === null) return null;
    return wage * monthsToCopy(row.requiredOrdinal, Number(row.cap));
}

/** The same figure in spirit stones, rounded the way the market board rounds. */
export function stallPriceStones(techniqueId: string): number | null {
    const cash = stallPriceCash(techniqueId);
    return cash === null ? null : Math.max(1, Math.ceil(cash / CASH_PER_STONE));
}

/**
 * Every book a stall carries, cheapest first, with what it asks.
 *
 * Derived from the technique catalog rather than authored beside it, so a
 * manual added to the content files is on the board the day it lands and
 * nobody has to remember to put it there. Same rule `SITE_PHRASES` and
 * `DUTY_PHRASES` already follow in the parser, and the reason `AGENTS.md`
 * gives for it: no parallel catalogs for important things.
 */
export function manualsAStallCarries(): Array<Manual & { cash: number }> {
    return STALL_STOCK;
}

/**
 * Built once at module load. The catalog does not change inside a process, and
 * `housesTeaching` walks every house's shelf for every question it is asked.
 */
const STALL_STOCK: Array<Manual & { cash: number }> = (TECHNIQUES as unknown as CatalogRow[])
    .filter(row => row.class === 'cultivation' && row.cap != null)
    .map(row => {
        const cash = stallPriceCash(row.id);
        return cash === null ? null : {
            id: row.id,
            name: row.name,
            cap: Number(row.cap),
            requiredOrdinal: row.requiredOrdinal,
            element: (row.element ?? null) as string | null,
            cash
        };
    })
    .filter((row): row is Manual & { cash: number } => row !== null)
    .sort((a, b) => a.cash - b.cash || a.id.localeCompare(b.id));
