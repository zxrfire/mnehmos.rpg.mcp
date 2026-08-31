/**
 * Seeded RNG.
 *
 * The whole permadeath contract rests on these properties: same seed means same
 * run, and one system's rolls never move another system's.
 */

import {
    CultivationRNG,
    deriveSeed,
    forStream
} from '../../../src/engine/cultivation/rng.js';

describe('CultivationRNG', () => {
    it('produces an identical sequence for an identical seed', () => {
        const a = new CultivationRNG('run-alpha');
        const b = new CultivationRNG('run-alpha');
        const seqA = Array.from({ length: 50 }, () => a.next());
        const seqB = Array.from({ length: 50 }, () => b.next());
        expect(seqA).toEqual(seqB);
    });

    it('produces a different sequence for a different seed', () => {
        const a = new CultivationRNG('run-alpha');
        const b = new CultivationRNG('run-beta');
        expect(a.next()).not.toBe(b.next());
    });

    it('keeps every sample inside [0, 1)', () => {
        const rng = new CultivationRNG('bounds');
        for (let i = 0; i < 5000; i++) {
            const n = rng.next();
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(1);
        }
    });

    it('int() is inclusive on both ends and never leaves the range', () => {
        const rng = new CultivationRNG('ints');
        const seen = new Set<number>();
        for (let i = 0; i < 5000; i++) {
            const n = rng.int(1, 4);
            expect(Number.isInteger(n)).toBe(true);
            expect(n).toBeGreaterThanOrEqual(1);
            expect(n).toBeLessThanOrEqual(4);
            seen.add(n);
        }
        expect([...seen].sort()).toEqual([1, 2, 3, 4]);
    });

    it('int() rejects an inverted range', () => {
        const rng = new CultivationRNG('ints');
        expect(() => rng.int(5, 1)).toThrow();
    });

    it('chance(0) is never true and chance(1) is always true', () => {
        const rng = new CultivationRNG('chance');
        for (let i = 0; i < 500; i++) {
            expect(rng.chance(0)).toBe(false);
        }
        for (let i = 0; i < 500; i++) {
            expect(rng.chance(1)).toBe(true);
        }
    });

    it('weighted() respects the declared weights', () => {
        const rng = new CultivationRNG('weighted');
        const table = { a: 70, b: 20, c: 10 };
        const counts = { a: 0, b: 0, c: 0 };
        const N = 100_000;
        for (let i = 0; i < N; i++) counts[rng.weighted(table)]++;
        expect(counts.a / N).toBeCloseTo(0.7, 2);
        expect(counts.b / N).toBeCloseTo(0.2, 2);
        expect(counts.c / N).toBeCloseTo(0.1, 2);
    });

    it('weighted() rejects degenerate tables', () => {
        const rng = new CultivationRNG('weighted');
        expect(() => rng.weighted({})).toThrow();
        expect(() => rng.weighted({ a: 0, b: 0 })).toThrow();
    });

    it('pick() rejects an empty list', () => {
        const rng = new CultivationRNG('pick');
        expect(() => rng.pick([])).toThrow();
    });

    it('uuid() is v4-shaped and reproducible from the seed', () => {
        const shape = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        const a = new CultivationRNG('uuid-seed');
        const b = new CultivationRNG('uuid-seed');
        for (let i = 0; i < 20; i++) {
            const id = a.uuid();
            expect(id).toMatch(shape);
            expect(id).toBe(b.uuid());
        }
    });

    it('uuid() does not repeat within a stream', () => {
        const rng = new CultivationRNG('uuid-unique');
        const ids = new Set(Array.from({ length: 2000 }, () => rng.uuid()));
        expect(ids.size).toBe(2000);
    });
});

describe('named sub-streams', () => {
    it('gives different systems independent sequences', () => {
        const breakthrough = forStream('run-1', 'breakthrough', 10);
        const deviation = forStream('run-1', 'deviation', 10);
        expect(breakthrough.next()).not.toBe(deviation.next());
    });

    it('is stable regardless of when or how often it is derived', () => {
        const first = forStream('run-1', 'deviation', 900).next();

        // Consume a great deal of entropy from unrelated streams in between.
        for (let i = 0; i < 100; i++) forStream('run-1', 'encounter', i).next();

        const second = forStream('run-1', 'deviation', 900).next();
        expect(second).toBe(first);
    });

    it('separates coordinates so day 900 and day 901 differ', () => {
        expect(forStream('run-1', 'deviation', 900).next()).not.toBe(
            forStream('run-1', 'deviation', 901).next()
        );
    });

    it('normalises integral numeric coordinates', () => {
        expect(deriveSeed('s', 'stream', 1)).toBe(deriveSeed('s', 'stream', 1.0));
        expect(deriveSeed('s', 'stream', 0)).toBe(deriveSeed('s', 'stream', -0));
    });

    it('cannot be made to collide by punctuation in a coordinate', () => {
        // A separator that appeared in a location id would let two different
        // (stream, coordinate) pairs share a stream. It must not.
        expect(deriveSeed('s', 'a:b', 1)).not.toBe(deriveSeed('s', 'a', 'b:1'));
        expect(deriveSeed('s', 'cave', '1')).not.toBe(deriveSeed('s', 'cave1', ''));
    });

    it('derives the same seed string for the same coordinates', () => {
        expect(deriveSeed('s', 'ambient', 'cave-of-echoes', 30)).toBe(
            deriveSeed('s', 'ambient', 'cave-of-echoes', 30)
        );
    });
});
