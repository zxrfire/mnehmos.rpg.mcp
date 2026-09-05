/**
 * Seeded RNG for the cultivation engine.
 */

import seedrandom from 'seedrandom';

// STREAM DERIVATION

/**
 * Separator between seed components. A control character rather than ':' so a
 * location id containing punctuation can never collide with a different
 * (stream, coordinate) pair - `('a:b', 1)` and `('a', 'b:1')` must not derive
 * the same stream.
 */
const STREAM_SEPARATOR = '\u001f';

/** A stream coordinate: a name, an ordinal, a day index, a turn number. */
export type StreamPart = string | number;

/**
 * Build the derived seed string for a named sub-stream.
 */
export function deriveSeed(runSeed: string, stream: string, ...parts: StreamPart[]): string {
    const tail = parts.map(normalizePart).join(STREAM_SEPARATOR);
    return parts.length === 0
        ? `${runSeed}${STREAM_SEPARATOR}${stream}`
        : `${runSeed}${STREAM_SEPARATOR}${stream}${STREAM_SEPARATOR}${tail}`;
}

/**
 * Numbers are normalised so that `1` and `1.0` and `'1'` all produce the same
 * stream - day indices arrive from arithmetic and must not depend on whether a
 * caller happened to hand us an integer-valued float.
 */
function normalizePart(part: StreamPart): string {
    if (typeof part === 'number') {
        if (!Number.isFinite(part)) return 'nan';
        // Normalise -0 to 0 so `-0` and `0` cannot derive different streams.
        return String(part === 0 ? 0 : part);
    }
    return part;
}

/**
 * Get a fresh, independent RNG for a named sub-stream of a run.
 *
 * @example
 *   const rng = forStream(run.seed, 'breakthrough', turn, ordinal);
 */
export function forStream(runSeed: string, stream: string, ...parts: StreamPart[]): CultivationRNG {
    return new CultivationRNG(deriveSeed(runSeed, stream, ...parts));
}

// THE RNG

export class CultivationRNG {
    /** The exact seed string this stream was built from. Useful in audit logs. */
    readonly seed: string;
    private readonly rng: seedrandom.PRNG;

    constructor(seed: string) {
        this.seed = seed;
        this.rng = seedrandom(seed);
    }

    /** Uniform sample in [0, 1). The primitive everything else is built on. */
    next(): number {
        return this.rng();
    }

    /** Uniform float in [min, max). */
    float(min: number, max: number): number {
        return min + this.rng() * (max - min);
    }

    /** Uniform integer in [min, max], inclusive on both ends. */
    int(min: number, max: number): number {
        if (max < min) throw new Error(`int(${min}, ${max}): max is below min`);
        return min + Math.floor(this.rng() * (max - min + 1));
    }

    /**
     * True with probability `p`. Uses strict `<` so `chance(0)` is never true
     * and `chance(1)` is always true - the boundary behaviour breakthrough
     * clamping relies on.
     */
    chance(p: number): boolean {
        return this.rng() < p;
    }

    /** Uniform choice from a non-empty list. */
    pick<T>(items: readonly T[]): T {
        if (items.length === 0) throw new Error('pick() from an empty list');
        return items[Math.floor(this.rng() * items.length)];
    }

    /**
     * Weighted choice over a record of key -> weight.
     */
    weighted<K extends string>(weights: Record<K, number>): K {
        const keys = Object.keys(weights) as K[];
        if (keys.length === 0) throw new Error('weighted() over an empty table');
        const total = keys.reduce((sum, k) => sum + Math.max(0, weights[k]), 0);
        if (total <= 0) throw new Error('weighted() over a table with no positive weight');
        let cursor = this.rng() * total;
        for (const key of keys) {
            cursor -= Math.max(0, weights[key]);
            if (cursor < 0) return key;
        }
        // Float drift at the very top of the range; the last key is correct.
        return keys[keys.length - 1];
    }

    /**
     * A v4-shaped UUID drawn from this stream.
     */
    uuid(): string {
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(this.rng() * 256);
        }
        // RFC 4122 version 4 / variant 10xx.
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32)
        ].join('-');
    }
}
