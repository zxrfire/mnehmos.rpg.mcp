/**
 * Shared primitives for the social memory layer.
 *
 * This layer is STORAGE, not simulation. Four modules sit on top of this file
 * - relationships, the grudge ledger, knowledge, and secrets - and their job
 * is to make sure the world remembers things exactly and durably. The LLM does
 * the reasoning: whether a grudge is worth acting on, whether an NPC is
 * trustworthy, how a faction responds. The engine's job is to guarantee that
 * forty years later the record is still there, unchanged, and queryable.
 *
 * Three consequences shape everything in this directory:
 *
 * ── Nothing here decays, weights, or scores ───────────────────────────────
 * There is no intensity curve, no reputation scalar, no incentive threshold.
 * A grudge does not get quietly smaller because time passed, because a decay
 * function is the engine making a judgement about how much someone still
 * cares. Records change when an EVENT changes them, and events are written
 * down.
 *
 * ── Nothing here ranks people by cultivation ──────────────────────────────
 * There is deliberately no realm ordinal, no power comparison and no strength
 * import anywhere in this module. A character's importance is stored - as a
 * relationship type, a role, a significance - and is never derived from where
 * they stand on the ladder. That is what lets a master who has been surpassed
 * by their own disciple remain the most important person in that disciple's
 * life, and lets a mortal grandmother outrank a Core Formation elder in the
 * only ledger that matters.
 *
 * ── Randomness is engine-owned ────────────────────────────────────────────
 * When something genuinely needs to be random, it comes from
 * {@link socialRoll}, which is seeded and reproducible. The LLM never picks
 * its own roll, consciously or otherwise.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream, type CultivationRNG, type StreamPart } from '../cultivation/rng.js';

export { DAYS_PER_YEAR };

/**
 * An absolute day index on the world calendar - the same grid the cultivation
 * time-skip keys to. Every dated record in this layer uses it, so "forty years
 * later" is arithmetic rather than a date library, and a record written before
 * a thirty-year seclusion is trivially comparable to one written after it.
 */
export type DayIndex = number;

export function yearsBetween(fromDay: DayIndex, toDay: DayIndex): number {
    return (toDay - fromDay) / DAYS_PER_YEAR;
}

export function daysForYears(years: number): number {
    return Math.round(years * DAYS_PER_YEAR);
}

/**
 * A seeded roll for the rare social question that is genuinely chance -
 * whether a passer-by happened to overhear, which of two couriers arrived
 * first.
 *
 * Exists so that no caller is ever tempted to let the narrating model decide a
 * random outcome. Same run seed and same coordinates always produce the same
 * stream, so a replay of a saved world reproduces it exactly.
 */
export function socialRoll(
    runSeed: string,
    stream: string,
    ...coords: StreamPart[]
): CultivationRNG {
    return forStream(runSeed, `social.${stream}`, ...coords);
}

// ─────────────────────────────────────────────────────────────────────────
// NUMBERS
// ─────────────────────────────────────────────────────────────────────────

export function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

/**
 * Round to four decimals.
 *
 * Applied to every stored number so that a value written, persisted to SQLite,
 * read back and compared is the same value. Float drift is a real source of
 * "the record changed and nobody touched it".
 */
export function round4(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1e4) / 1e4;
}

// ─────────────────────────────────────────────────────────────────────────
// IDENTITY
// ─────────────────────────────────────────────────────────────────────────

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
 * A deterministic id for a stored social record.
 *
 * Identical inputs always produce an identical id, on every machine and every
 * replay, with no PRNG consumed. Records are compared field by field across
 * save/load in the tests, and a random id would make every such comparison
 * vacuously fail.
 */
export function stableId(prefix: string, ...parts: (string | number)[]): string {
    const body = parts.map(p => String(p)).join('');
    return `${prefix}_${fnv1a(`${prefix}${body}`)}`;
}

/** Stable ordering for any list of records that carries an id. */
export function byId<T extends { id: string }>(a: T, b: T): number {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
