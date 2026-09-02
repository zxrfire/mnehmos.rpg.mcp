/**
 * What a place still has in the ground, and what taking it does.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * COUNTED STOCK IS A QUANTITY THE WORLD HOLDS, AND IT GOES DOWN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/things/items.md` divides everything a person can hold into three
 * tiers. This module is the whole of tier two's ground half:
 *
 *   a price and nothing else   Mundane goods. A meal, a robe, a night's board.
 *                              Never counted anywhere, no row, no arithmetic.
 *                              What moves them is an event - a famine, a shut
 *                              pass - and never anybody buying one.
 *   an amount somewhere        Cultivator materials. Herbs and beast materials
 *                              are the ground half and are this file. Common
 *                              manuals are the other half: also counted, also
 *                              depleting, but restocked by somebody sitting
 *                              down and copying one. Supply there is LABOUR,
 *                              and `what-a-copy-of-a-manual-costs-at-a-stall.ts`
 *                              already prices it in `monthsToCopy` and
 *                              `copyistMonthlyCash`. Do not model a book as a
 *                              plant.
 *   one thing with a history   A specific object somebody can be asked about.
 *                              `possessions.ts`, and not this file at all.
 *
 * Until this existed, the counted tier was infinite in the only sense that
 * matters: a cultivator foraged, material appeared, forever, and a province
 * could not be picked clean. That is not a resource-management omission. It
 * removes a CAUSE the world already has vocabulary for - a district that has
 * been worked out, a reason for a house to put a party on a longer road, and
 * the reading that `BEAST_TIDES` in `beasts.ts` insists on, where a tide is a
 * symptom of something changing on the ground rather than a monster problem.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE SHAPE, AND WHY IT IS THIS CHEAP ON PURPOSE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * One number per place, per kind, per grade. No ids, no provenance, no
 * individuals - a fungible amount, and any one of it is any other. That is the
 * design owner's own statement of the storage shape and it is the point:
 *
 *   herb   mortal earth heaven immortal chaos
 *   beast  mortal earth heaven immortal chaos
 *
 * Ten bands per place. Fifty-odd places in a seeded world are ground anybody
 * would forage or hunt on, so a fully populated table is hundreds of numbers.
 * Keying on the catalog row instead would be 43 herbs plus 26 materials
 * against every place, which is thousands, and would need re-keying every time
 * either catalog grew. The band is the unit because the band is what fungible
 * MEANS.
 *
 * It is stored on `LocationRecord.data`, which is a flat scalar bag already
 * persisted as JSON on `world_locations.data`. So this costs no migration, no
 * table, no repository change and no new column - two scalars on a row that is
 * already written every time the world is saved, and only on places somebody
 * has actually drawn from.
 *
 * ── CAPACITY IS DERIVED, NEVER STORED ────────────────────────────────────
 *
 * AGENTS.md: prefer deriving to storing where the answer moves. A stored
 * capacity goes stale the moment a catalog row is added and then the row lies
 * with a straight face. So what is stored is only what has been TAKEN and WHEN,
 * and everything else is arithmetic:
 *
 *   capacity  = the band's summed `rarityWeight`, scaled by this ground's qi
 *   remaining = capacity - (what was taken, less what has grown back since)
 *
 * `rarityWeight` is used because it is already the catalog's own measured
 * statement of how much of a band the world holds, and it is not a number
 * anybody chose here. Measured off the catalogs, at ordinary ground:
 *
 *   herb    mortal 2340   earth 565   heaven 116   immortal 24   chaos 6
 *   beast   mortal 1070   earth 405   heaven  57   immortal  8   chaos 2
 *
 * That fall of roughly four to five times a grade is `items.md`'s own claim
 * arriving from the supply side rather than being asserted: only the bottom of
 * the ladder has enough ground to restock indefinitely. Nobody tuned it.
 *
 * The RATIOS between bands are that measurement. How big the numbers are in
 * units a person can carry is a separate decision, and the weights are used
 * raw because raw is where it lands correctly:
 *
 *   a band is sustainable when one hard worker takes less in a year than the
 *   band grows back in a year
 *
 * Mortal grade grows back about ten times what a full-time forager takes, so
 * one person cannot make a dent and ten of them can - which is why nobody has
 * ever heard of a district running out of hare pelts. Earth grade grows back a
 * fifth of what that same person takes, so one person working a district for a
 * couple of years strips it and does not live to see it back. Both of those
 * are pinned in the test file.
 *
 * ── NOTHING HERE DRAWS ───────────────────────────────────────────────────
 *
 * Regrowth is linear in elapsed days and takes no sample. There is no new RNG
 * stream in this module and there must not be one: a draw added to this path
 * would shift every later draw on whatever stream it borrowed, which AGENTS.md
 * treats as a regression until proved byte-identical. The variance a player
 * sees is already in the forage and hunt draws upstream; what the ground has
 * left is arithmetic on top of them.
 *
 * ── AND IT COMES BACK ────────────────────────────────────────────────────
 *
 * A province picked clean that stays clean forever is a worse world than an
 * infinite one, so every band refills. The rate is a design decision and it is
 * pinned by `tests/engine/world/what-a-place-still-has-in-the-ground.test.ts`
 * rather than sitting here as a number nobody reads twice.
 */

import type { LocationRecord } from './locations.js';
import { QI_DENSITY_DEFAULT, clampQiDensity } from './qi-scale.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { HERBS } from '../../data/cultivation/herbs.js';
import { BEAST_MATERIALS } from '../../data/cultivation/beasts.js';
import { TechniqueGradeSchema, type TechniqueGrade } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE BANDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What kind of counted stock a band holds.
 *
 * Two, and they are the two things that come out of the ground. A common
 * manual is counted stock as well and is deliberately NOT here: it is restocked
 * by a person copying one, not by a season, and putting it in this table would
 * assert that a book grows.
 */
export type StockKind = 'herb' | 'beast_material';

export const STOCK_KINDS: readonly StockKind[] = ['herb', 'beast_material'];

/** The five grades, in the order the ladder runs. */
export const STOCK_GRADES: readonly TechniqueGrade[] = TechniqueGradeSchema.options;

/**
 * How much of a band untouched ordinary ground holds.
 *
 * Summed `rarityWeight` over the catalog rows of that band. Read off the
 * catalogs at import rather than transcribed, so adding a herb changes what the
 * world holds without anybody editing a constant - which is
 * `items.md`'s "scarcity is measured, not authored" applied to supply.
 */
export const BAND_CAPACITY_AT_ORDINARY_GROUND: Readonly<
    Record<StockKind, Readonly<Record<TechniqueGrade, number>>>
> = {
    herb: sumWeights(HERBS),
    beast_material: sumWeights(BEAST_MATERIALS)
};

function sumWeights(
    rows: readonly { grade: TechniqueGrade; rarityWeight: number }[]
): Record<TechniqueGrade, number> {
    const out = Object.fromEntries(
        STOCK_GRADES.map(g => [g, 0])
    ) as Record<TechniqueGrade, number>;
    for (const row of rows) out[row.grade] += row.rarityWeight;
    return out;
}

/**
 * How long an emptied band takes to come all the way back, in years.
 *
 * THE DESIGN DECISION. Each step is roughly ten to twenty times the one below,
 * and the reason is the one `items.md` already gives for the whole
 * counted/tracked boundary: what restocks quickly is what the bottom of the
 * world can produce in quantity, and the top of the ladder cannot be restocked
 * by anybody living.
 *
 *   mortal    a season and a year. A picked-over hillside is green again next
 *             spring, which is why the culling trade and the herb stalls work
 *             at all and why nobody has ever heard of a district running out of
 *             hare pelts.
 *   earth     a working life is long enough to strip a district and not long
 *             enough to see it back. This is the band a house actually argues
 *             about, and the band that makes sending a party further afield a
 *             decision rather than a preference.
 *   heaven    a century and a half. A heaven-grade bed emptied in your lifetime
 *             is emptied for your student's lifetime too.
 *   immortal  three thousand years, which is to say the world is not making
 *             any more of this on any horizon anybody plans against.
 *   chaos     thirty thousand. Longer than the recorded history the world can
 *             still read. This is the Late Age stated as a rate: what is here
 *             is what was left behind, and taking it is spending principal.
 *
 * The two top bands are deliberately outside every horizon a run reaches. They
 * are not "very slow regrowth" wearing a number - they are the claim that the
 * world is running down, expressed where the engine can enforce it.
 */
export const REGROWTH_YEARS_BY_GRADE: Readonly<Record<TechniqueGrade, number>> = {
    mortal: 1,
    earth: 12,
    heaven: 150,
    immortal: 3_000,
    chaos: 30_000
};

// ─────────────────────────────────────────────────────────────────────────
// THE ROW
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two scalars a band keeps on `LocationRecord.data`.
 *
 * `drawn` is how far below capacity this band was at `day`, and NOT the current
 * shortfall - regrowth is applied on read. Storing the current figure would
 * mean touching every band of every place on every world tick to keep it true,
 * which is the expensive version of the same answer.
 */
export function drawnKey(kind: StockKind, grade: TechniqueGrade): string {
    return `ground.${kind}.${grade}.drawn`;
}

export function drawnOnDayKey(kind: StockKind, grade: TechniqueGrade): string {
    return `ground.${kind}.${grade}.day`;
}

function numberAt(place: LocationRecord, key: string): number {
    const raw = place.data[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * What untouched ground of this kind holds here.
 *
 * Geology, not usability: `qiDensity` is what the vein under a place holds, and
 * what grows on a place is a function of that rather than of what somebody
 * standing there can currently draw. A sealed pocket at 100 has had something
 * growing in it undisturbed, which is exactly the fact `beastsOnThisGround`
 * already reads for its own purposes.
 */
export function capacityFor(
    place: LocationRecord,
    kind: StockKind,
    grade: TechniqueGrade
): number {
    const base = BAND_CAPACITY_AT_ORDINARY_GROUND[kind][grade];
    const ground = clampQiDensity(place.qiDensity) / QI_DENSITY_DEFAULT;
    return Math.round(base * ground);
}

/** How far a band has actually been drawn down, as of a day. */
function shortfallOn(
    place: LocationRecord,
    kind: StockKind,
    grade: TechniqueGrade,
    onDay: number
): number {
    const drawn = numberAt(place, drawnKey(kind, grade));
    if (drawn <= 0) return 0;

    const since = numberAt(place, drawnOnDayKey(kind, grade));
    // A clock that has not moved, or has been asked about backwards, grows
    // nothing back. Never negative elapsed time.
    const elapsed = Math.max(0, onDay - since);
    const capacity = capacityFor(place, kind, grade);
    if (capacity <= 0) return 0;

    const perDay = capacity / (REGROWTH_YEARS_BY_GRADE[grade] * DAYS_PER_YEAR);
    return Math.max(0, Math.min(capacity, drawn - perDay * elapsed));
}

/**
 * How a band reads to somebody who works this ground.
 *
 * Four states, and the boundaries are what a person would notice rather than
 * round numbers: you cannot tell untouched ground from lightly worked ground,
 * you can tell when a place is going, and there is a point past which the
 * honest sentence is that it is finished for now.
 */
export type GroundReading = 'untouched' | 'worked' | 'thinning' | 'worked_out';

export function readingFor(share: number): GroundReading {
    if (share >= 0.95) return 'untouched';
    if (share >= 0.5) return 'worked';
    if (share > 0.05) return 'thinning';
    return 'worked_out';
}

export interface GroundBand {
    kind: StockKind;
    grade: TechniqueGrade;
    /** What untouched ground here would hold. Derived, never stored. */
    capacity: number;
    /** What is still in the ground on this day. */
    remaining: number;
    /** `remaining / capacity`, 0..1. 1 where the band was never touched. */
    share: number;
    reading: GroundReading;
}

export function standingStock(
    place: LocationRecord,
    kind: StockKind,
    grade: TechniqueGrade,
    onDay: number
): GroundBand {
    const capacity = capacityFor(place, kind, grade);
    const remaining = Math.max(0, capacity - shortfallOn(place, kind, grade, onDay));
    const share = capacity > 0 ? remaining / capacity : 0;
    return { kind, grade, capacity, remaining, share, reading: readingFor(share) };
}

/**
 * Every band this place holds, for a caller that wants the whole answer.
 *
 * Bands with no capacity at all are omitted: ground that never held anything of
 * a grade has not been worked out, and saying "worked out" about it would be a
 * lie in the shape of a measurement.
 */
export function whatTheGroundStillHas(
    place: LocationRecord,
    onDay: number,
    kind?: StockKind
): readonly GroundBand[] {
    const kinds = kind ? [kind] : STOCK_KINDS;
    const out: GroundBand[] = [];
    for (const k of kinds) {
        for (const grade of STOCK_GRADES) {
            const band = standingStock(place, k, grade, onDay);
            if (band.capacity > 0) out.push(band);
        }
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// TAKING FROM IT
// ─────────────────────────────────────────────────────────────────────────

export interface GroundDrawRequest {
    kind: StockKind;
    grade: TechniqueGrade;
    /** What the draw upstream says the taker found. Never negative. */
    wanted: number;
    onDay: number;
}

export interface GroundDraw extends GroundDrawRequest {
    /** What the ground could actually give up. At most `wanted`. */
    taken: number;
    /** `wanted - taken`. Non-zero means the ground is the limit, not the taker. */
    shortfall: number;
    /** Standing stock before and after, on this day. */
    before: number;
    after: number;
    capacity: number;
    /** How the band reads AFTER the take. */
    reading: GroundReading;
    /**
     * What to say about the ground, or null when there is nothing worth saying.
     * A place that has been worked out must say so in prose rather than by
     * quietly handing back less.
     */
    line: string | null;
}

/**
 * Take from a band, and say what the ground had to say about it.
 *
 * Pure. Returns the draw; `applyGroundDraw` produces the patched record and the
 * caller upserts it. Nothing here mutates the location it was handed.
 */
export function drawFromTheGround(
    place: LocationRecord,
    request: GroundDrawRequest
): GroundDraw {
    const { kind, grade, onDay } = request;
    const wanted = Math.max(0, Math.floor(request.wanted));
    const capacity = capacityFor(place, kind, grade);
    const before = Math.max(0, capacity - shortfallOn(place, kind, grade, onDay));
    const taken = Math.min(wanted, Math.floor(before));
    const after = before - taken;
    const share = capacity > 0 ? after / capacity : 0;
    const reading = readingFor(share);

    return {
        kind, grade, wanted, onDay,
        taken,
        shortfall: wanted - taken,
        before, after, capacity,
        reading,
        line: lineFor(place, kind, grade, wanted, taken, reading)
    };
}

/**
 * The two cells a draw writes, or null when it writes nothing.
 *
 * A draw that took nothing and found the ground full leaves no trace, so
 * walking over a place without working it does not touch the row.
 */
function patchFor(draw: GroundDraw): Record<string, number> | null {
    if (draw.taken <= 0 && draw.after >= draw.capacity) return null;
    return {
        [drawnKey(draw.kind, draw.grade)]: draw.capacity - draw.after,
        [drawnOnDayKey(draw.kind, draw.grade)]: draw.onDay
    };
}

/** The new location record, with the band written down. Pure. */
export function applyGroundDraw(place: LocationRecord, draw: GroundDraw): LocationRecord {
    const patch = patchFor(draw);
    if (!patch) return place;
    return { ...place, data: { ...place.data, ...patch } };
}

/**
 * The same write, into a location record a caller is holding live.
 *
 * For the persistence edge only. `worldForRun` hands back the world handle's
 * own state and `saveWorldForRun` writes that same object, so a caller there
 * cannot swap in a new record and have it persist - it has to write into the
 * one the graph is holding. Both entry points go through `patchFor`, so there
 * is one definition of what a draw stores.
 *
 * Returns whether anything was written, which is what a caller needs to decide
 * about marking the world dirty.
 */
export function recordGroundDraw(place: LocationRecord, draw: GroundDraw): boolean {
    const patch = patchFor(draw);
    if (!patch) return false;
    Object.assign(place.data, patch);
    return true;
}

// ─────────────────────────────────────────────────────────────────────────
// SAYING IT
// ─────────────────────────────────────────────────────────────────────────

const KIND_NOUN: Readonly<Record<StockKind, string>> = {
    herb: 'growing',
    beast_material: 'living'
};

/**
 * What a place says about itself after somebody has worked it.
 *
 * Silent while the ground is holding up, because a sentence every turn about
 * a district that is fine is noise a player learns to skip, and then the one
 * that matters is skipped with it.
 */
function lineFor(
    place: LocationRecord,
    kind: StockKind,
    grade: TechniqueGrade,
    wanted: number,
    taken: number,
    reading: GroundReading
): string | null {
    const what = kind === 'herb' ? `${grade}-grade beds` : `${grade}-grade quarry`;
    if (taken < wanted) {
        return taken === 0
            ? `There is nothing ${grade}-grade left ${KIND_NOUN[kind]} around ${place.name}. `
              + 'It has been worked out, and it will be somebody else\'s lifetime before it is not.'
            : `You take what is there and it runs out under your hands. The ${what} around `
              + `${place.name} are down to the last of themselves.`;
    }
    if (reading === 'worked_out') {
        return `That was the last of the ${what} around ${place.name}. Whatever comes here next `
            + 'will find bare ground.';
    }
    if (reading === 'thinning') {
        return `The ${what} around ${place.name} are noticeably thinner than they were. Somebody `
            + 'who works this ground for a living would already be walking further out.';
    }
    return null;
}

/**
 * One sentence answering "what does this place still have".
 *
 * The player-facing read, and the reason this module is not a simulation
 * nobody can see. Reports only what is worth reporting: a place holding
 * everything it ever held says so in one clause, and a place that has been
 * stripped names the bands it has lost.
 */
export function howTheGroundReads(place: LocationRecord, onDay: number): string {
    const bands = whatTheGroundStillHas(place, onDay);
    const gone = bands.filter(b => b.reading === 'worked_out');
    const thin = bands.filter(b => b.reading === 'thinning');

    if (gone.length === 0 && thin.length === 0) {
        return `The ground around ${place.name} carries what it has always carried. Nothing here `
            + 'has been worked hard enough to show it.';
    }

    const say = (b: GroundBand) =>
        `${b.grade}-grade ${b.kind === 'herb' ? 'herbs' : 'beast material'}`;
    const parts: string[] = [];
    if (gone.length > 0) {
        parts.push(`worked out for ${gone.map(say).join(', ')}`);
    }
    if (thin.length > 0) {
        parts.push(`thinning for ${thin.map(say).join(', ')}`);
    }
    return `The ground around ${place.name} is ${parts.join(', and ')}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT DEPLETION CAUSES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether the ordinary animals are gone from this ground.
 *
 * The consequence worth having, and the reason a falling number is a cause
 * rather than a chore. Hunt a district hard enough and what you have removed is
 * the bottom of its food chain - so what is left out there is the thing that
 * was eating them, and it is still eating.
 *
 * This is not an item changing what it is. Nothing in this world moves up a
 * grade and nothing crosses from counted to tracked: `possessions.ts`'s
 * `shardPower` is the only movement there is and it goes downward. What changes
 * is which beast the ground offers, which is a fact about the PLACE.
 *
 * Said out loud by the hunt, because a player who is suddenly meeting worse
 * things deserves to know they did it.
 *
 * NOT YET READ BY THE DRAW. `whatIsOnThisGround` still offers the whole
 * reachable pool whatever this says, so the sentence is currently ahead of the
 * mechanic: the district reports that it has been hunted out and then turns up
 * a hare anyway. Closing that means `GroundForBeasts` carrying the fact, which
 * is `hunting-a-spirit-beast.ts`'s call to make.
 */
export function theOrdinaryAnimalsAreGone(place: LocationRecord, onDay: number): boolean {
    return standingStock(place, 'beast_material', 'mortal', onDay).reading === 'worked_out';
}

/**
 * What to say when it has happened. Null when it has not.
 */
export function whatIsLeftOutThere(place: LocationRecord, onDay: number): string | null {
    if (!theOrdinaryAnimalsAreGone(place, onDay)) return null;
    return `Nothing ordinary lives around ${place.name} any more. It was hunted out, and what is `
        + 'still here is what was eating it.';
}
