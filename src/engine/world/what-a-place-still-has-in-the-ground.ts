/**
 * What a place still has in the ground, and what taking it does.
 */

import type { LocationRecord } from './locations.js';
import { QI_DENSITY_DEFAULT, clampQiDensity } from './qi-scale.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { HERBS } from '../../data/cultivation/herbs.js';
import { BEAST_MATERIALS } from '../../data/cultivation/beasts.js';
import { gradeForOrdinal } from '../../data/cultivation/techniques.js';
import { TechniqueGradeSchema, type TechniqueGrade } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE BANDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What kind of counted stock a band holds.
 */
export type StockKind = 'herb' | 'beast_material';

export const STOCK_KINDS: readonly StockKind[] = ['herb', 'beast_material'];

/** The five grades, in the order the ladder runs. */
export const STOCK_GRADES: readonly TechniqueGrade[] = TechniqueGradeSchema.options;

/**
 * How much of a band untouched ordinary ground holds.
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
    /**
     * Whether the taker is of the flower school.
     */
    takenByTheSchool?: boolean;
}

/**
 * What share of an ordinary take the school's hands actually cost the bed.
 */
export const THE_SCHOOL_COSTS_THE_BED = 1 / 3;

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
    // WHAT THE TAKER GETS AND WHAT THE BED PAYS ARE TWO NUMBERS, and this is
    // the only place in the file where they differ. `taken` is the armful and
    // is never touched by who is holding the knife; the cost to the stand is,
    // because a cutting taken by somebody trained to keep a bed is a different
    // wound from the same cutting taken by somebody who is not.
    //
    // `Math.ceil` rather than round or floor, and it is the law rather than a
    // rounding preference: a take always costs the bed at least one. A defence
    // reduces and never zeroes, so there is no amount of skill at which a
    // valley stops being worked.
    const costToTheBed = request.takenByTheSchool
        ? Math.ceil(taken * THE_SCHOOL_COSTS_THE_BED)
        : taken;
    const after = before - costToTheBed;
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
 */
export function recordGroundDraw(place: LocationRecord, draw: GroundDraw): boolean {
    const patch = patchFor(draw);
    if (!patch) return false;
    Object.assign(place.data, patch);
    return true;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PEOPLE STANDING ON IT TAKE
//
// THE DRAW-DOWN IS POPULATION PRESSURE. IT IS NOT ANYBODY'S POUCH.
//
// Measured before this existed, and it is the reason this section is here at
// all. Every call site asks for ONE unit:
//
//   herb  mortal  capacity 2340 | regrows 44.88 over the 7 days a gather takes
//                               | takes 1 -> net +43.88
//   beast mortal  capacity 1070 | regrows 29.32 over the 10 days a hunt takes
//                               | takes 1 -> net +28.32
//
// So mortal stock could not fall, ever, by any actor, and a thousand
// world-years produced no worked-out band anywhere. The `drawn` column read as
// a working depletion model over an input that was three orders of magnitude
// too small to move it - the shape AGENTS.md calls a field nothing writes, one
// size up: a field written only with a rounding error.
//
// The fix is the design owner's own diagnosis: **everyone gathers it, not just
// one person.** A cultivator's pouch is a rounding error against a district's
// year and is SUPPOSED to be. What draws a band down is the people who live
// there doing what people who live there do, every year, whether or not
// anybody is playing.
//
// ── NOBODY COMPETES OUTSIDE THEIR OWN BAND ───────────────────────────────
//
// A person works the grade their rung opens, and `GRADE_ORDINAL_BANDS` already
// says which that is for every rung in the world - 0, 13, 21, 29, 37. So the
// pressure on a band is the people whose OWN band it is, read off
// `gradeForOrdinal`, and a Core Formation cultivator does not spend their year
// among the mortal-grade beds any more than a villager can reach past them.
//
// That is the population pyramid arriving on the supply side without anybody
// restating it: there are hundreds in the mortal band and a handful in the
// heaven band, so mortal ground holds up under a whole province and heaven
// ground near anywhere people live was picked over generations ago. Nothing
// here chose that; it is the pyramid multiplied by a regrowth clock.
//
// ── AND NO DRAW ──────────────────────────────────────────────────────────
//
// Arithmetic on a headcount and a clock. This section adds no RNG stream and
// takes none, so no seeded world's draws move because it exists.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What one person standing on this ground takes out of it in a year.
 */
export const TAKEN_PER_PERSON_PER_YEAR = 12 * 20;

/**
 * How the year's take divides between the two kinds, at one grade.
 */
export function shareOfTheYearSpentOn(kind: StockKind, grade: TechniqueGrade): number {
    let total = 0;
    for (const k of STOCK_KINDS) total += BAND_CAPACITY_AT_ORDINARY_GROUND[k][grade];
    if (total <= 0) return 0;
    return BAND_CAPACITY_AT_ORDINARY_GROUND[kind][grade] / total;
}

/**
 * How many people this ground can carry at a grade without losing it.
 */
export function peopleThisGroundCanCarry(
    place: LocationRecord,
    grade: TechniqueGrade
): number {
    let capacity = 0;
    for (const kind of STOCK_KINDS) capacity += capacityFor(place, kind, grade);
    const perYear = capacity / REGROWTH_YEARS_BY_GRADE[grade];
    return perYear / TAKEN_PER_PERSON_PER_YEAR;
}

/**
 * How many people are working each grade, off the rungs they stand at.
 */
export function whoWorksEachBand(
    ordinals: Iterable<number>
): ReadonlyMap<TechniqueGrade, number> {
    const out = new Map<TechniqueGrade, number>();
    for (const ordinal of ordinals) {
        const grade = gradeForOrdinal(ordinal);
        out.set(grade, (out.get(grade) ?? 0) + 1);
    }
    return out;
}

/**
 * What the people standing here take out of one band over a span of days.
 */
export function pressureOverDays(input: {
    workers: number;
    kind: StockKind;
    grade: TechniqueGrade;
    days: number;
}): number {
    const workers = Math.max(0, input.workers);
    const days = Math.max(0, input.days);
    return workers
        * TAKEN_PER_PERSON_PER_YEAR
        * shareOfTheYearSpentOn(input.kind, input.grade)
        * (days / DAYS_PER_YEAR);
}

export interface GroundPressure {
    /** One draw per band the people here actually press on. */
    draws: readonly GroundDraw[];
    /** Bands that went from holding something to holding nothing this pass. */
    workedOut: readonly GroundDraw[];
}

/**
 * A span of a place's own people working the ground under them, applied.
 */
export function whatThePeopleHereTake(
    place: LocationRecord,
    input: { ordinals: readonly number[]; days: number; onDay: number }
): GroundPressure {
    const draws: GroundDraw[] = [];
    const workedOut: GroundDraw[] = [];
    if (input.ordinals.length === 0 || input.days <= 0) return { draws, workedOut };

    const bands = whoWorksEachBand(input.ordinals);
    // A working copy, because each band writes its own two cells and a later
    // band must not read a stale record. Bands do not share cells, so this is
    // belt and braces rather than load-bearing - and it is cheap.
    let cursor = place;
    for (const [grade, workers] of bands) {
        for (const kind of STOCK_KINDS) {
            const wanted = Math.floor(
                pressureOverDays({ workers, kind, grade, days: input.days })
            );
            if (wanted <= 0) continue;
            const before = standingStock(cursor, kind, grade, input.onDay);
            if (before.capacity <= 0) continue;
            const draw = drawFromTheGround(cursor, { kind, grade, wanted, onDay: input.onDay });
            if (draw.taken <= 0 && draw.after >= draw.capacity) continue;
            draws.push(draw);
            if (before.reading !== 'worked_out' && draw.reading === 'worked_out') {
                workedOut.push(draw);
            }
            cursor = applyGroundDraw(cursor, draw);
        }
    }
    return { draws, workedOut };
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
