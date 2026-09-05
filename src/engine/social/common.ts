/**
 * Shared primitives for the social memory layer, which is STORAGE and not
 * simulation. Three rules hold across this directory:
 *
 * - Nothing decays, weights or scores. A decay function is the engine judging
 *   how much somebody still cares; records change when an EVENT changes them.
 * - Nothing ranks people by cultivation: no realm ordinal, no power comparison,
 *   no strength import - which is what lets a master surpassed by his own
 *   disciple stay the most important person in that disciple's life.
 * - Randomness is engine-owned. {@link socialRoll} is seeded and reproducible.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream, type CultivationRNG, type StreamPart } from '../cultivation/rng.js';

export { DAYS_PER_YEAR };

/**
 * An absolute day index on the world calendar - the same grid the cultivation
 * time-skip keys to, so "forty years later" is arithmetic and a record written
 * before a thirty-year seclusion compares to one written after it.
 */
export type DayIndex = number;

export function yearsBetween(fromDay: DayIndex, toDay: DayIndex): number {
    return (toDay - fromDay) / DAYS_PER_YEAR;
}

export function daysForYears(years: number): number {
    return Math.round(years * DAYS_PER_YEAR);
}

/**
 * A seeded roll for the rare social question that is genuinely chance - whether
 * a passer-by overheard, which of two couriers arrived first. Exists so no
 * caller is tempted to let the narrating model decide a random outcome; same
 * seed and coordinates replay a saved world exactly.
 */
export function socialRoll(
    runSeed: string,
    stream: string,
    ...coords: StreamPart[]
): CultivationRNG {
    return forStream(runSeed, `social.${stream}`, ...coords);
}

export function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

/**
 * Round to four decimals. Applied to every stored number so a value written,
 * persisted to SQLite and read back compares equal - float drift is a real
 * source of "the record changed and nobody touched it".
 */
export function round4(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1e4) / 1e4;
}

/**
 * FNV-1a, 32-bit. Not cryptographic and not trying to be - it turns a tuple of
 * ids and a day number into a short stable suffix, so two records created from
 * different events on the same day cannot collide.
 */
function fnv1a(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

/**
 * A deterministic id for a stored social record, consuming no PRNG. The tests
 * compare records field by field across save/load, and a random id would make
 * every one of those comparisons vacuously fail.
 */
export function stableId(prefix: string, ...parts: (string | number)[]): string {
    const body = parts.map(p => String(p)).join('');
    return `${prefix}_${fnv1a(`${prefix}${body}`)}`;
}

/** Stable ordering for any list of records that carries an id. */
export function byId<T extends { id: string }>(a: T, b: T): number {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
