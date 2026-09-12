/**
 * Coming out of a long sitting found nothing, because nothing was delivered.
 *
 * The machinery was wired and had no far end. `advanceWorld` builds a digest and
 * pushes what did not reach the player onto `pendingArrivals`, and
 * `pendingArrivals` only ever re-entered as an INTERRUPTION during a LATER
 * sitting. There was no "you came out and found what had arrived". Measured: a
 * one-year sitting came back with the inspector saying *"nothing reached this
 * cultivator. 166 event(s) passed unheard."*
 *
 * THE GATE IS STANDING, NOT DISTANCE, and it is the interesting part rather than
 * a bug being papered over. The ruling: somebody with a disciple, an office or a
 * house gets letters and callers; a rogue cultivator alone on thin ground does
 * not, and that silence is meant. So this file tests a gate that answers ZERO for
 * most of the people in the world, and the first assertion is the zero.
 *
 * It is deliberately separate from whether a thing is near enough to INTERRUPT
 * somebody, which is not gated on standing at all - the world happening next to
 * a person who is trying to concentrate reaches them whoever they are.
 */

import { describe, it, expect } from 'vitest';

import {
    MOST_A_WAKING_DELIVERS,
    howMuchWouldBeDeliveredTo,
    whatWasDeliveredWhileTheyWereSitting
} from '../../../src/engine/world/digest.js';

/** Nobody, nowhere, answering to no one. */
const ROGUE = {
    inAHouse: false,
    tier: null,
    ownFollowing: 0,
    hasASeat: false
} as const;

function arrival(id: string, day: number, magnitude: number) {
    return { factId: id, day, magnitude, text: `something ${id}` };
}

// ─────────────────────────────────────────────────────────────────────────

describe('who the world has a reason to reach', () => {
    it('reaches a rogue with nothing, which is the point', () => {
        expect(howMuchWouldBeDeliveredTo(ROGUE)).toBe(0);
    });

    it('reaches somebody on a roll, because a house posts its notices', () => {
        expect(howMuchWouldBeDeliveredTo({ ...ROGUE, inAHouse: true, tier: 'ordered' }))
            .toBeGreaterThan(0);
    });

    it('reaches an office holder further than an outer disciple', () => {
        const outer = howMuchWouldBeDeliveredTo({ ...ROGUE, inAHouse: true, tier: 'ordered' });
        const elder = howMuchWouldBeDeliveredTo({ ...ROGUE, inAHouse: true, tier: 'elder' });
        const head = howMuchWouldBeDeliveredTo({ ...ROGUE, inAHouse: true, tier: 'head' });
        expect(elder).toBeGreaterThan(outer);
        expect(head).toBeGreaterThan(elder);
    });

    it('reaches somebody whose own people would write, house or no house', () => {
        expect(howMuchWouldBeDeliveredTo({ ...ROGUE, ownFollowing: 3 })).toBeGreaterThan(0);
    });

    it('reaches somebody with a door for a caller to come to', () => {
        expect(howMuchWouldBeDeliveredTo({ ...ROGUE, hasASeat: true })).toBeGreaterThan(0);
    });

    it('never becomes a newsfeed, however much standing piles up', () => {
        expect(howMuchWouldBeDeliveredTo({
            inAHouse: true, tier: 'head', ownFollowing: 40, hasASeat: true
        })).toBeLessThanOrEqual(MOST_A_WAKING_DELIVERS);
    });
});

describe('what is actually handed over', () => {
    it('hands over nothing to somebody nobody delivers to, and keeps the backlog', () => {
        const waiting = [arrival('f1', 10, 0.9), arrival('f2', 20, 0.5)];
        const found = whatWasDeliveredWhileTheyWereSitting(waiting, ROGUE);
        expect(found.delivered).toEqual([]);
        expect(found.stillWaiting).toHaveLength(2);
        expect(found.lines).toEqual([]);
        expect(found.headline).toBe('');
    });

    it('hands over the biggest things first and leaves the rest waiting', () => {
        const waiting = [
            arrival('small', 10, 0.31),
            arrival('huge', 20, 0.95),
            arrival('middling', 30, 0.6)
        ];
        const found = whatWasDeliveredWhileTheyWereSitting(
            waiting, { ...ROGUE, inAHouse: true, tier: 'ordered' }
        );
        expect(found.delivered.length).toBeGreaterThan(0);
        expect(found.delivered[0].factId).toBe('huge');
        expect(found.delivered.length).toBeLessThan(waiting.length);
        expect(found.stillWaiting.map(f => f.factId)).not.toContain('huge');
        expect(found.stillWaiting).toHaveLength(waiting.length - found.delivered.length);
    });

    it('says it in the order it happened, because that is how somebody reads post', () => {
        const waiting = [
            arrival('later', 300, 0.9),
            arrival('earlier', 10, 0.8)
        ];
        const found = whatWasDeliveredWhileTheyWereSitting(
            waiting, { inAHouse: true, tier: 'head', ownFollowing: 5, hasASeat: true }
        );
        expect(found.delivered.map(f => f.factId)).toEqual(['earlier', 'later']);
        expect(found.lines.length).toBe(found.delivered.length);
        expect(found.lines[0]).toContain('something earlier');
        // Counts both ends, because how much is still nobody's business to
        // carry is as much a fact about standing as what arrived.
        expect(found.headline).toContain('2 things had been kept');
        expect(found.headline).toContain('0 had not');
    });

    it('hands over nothing when nothing was waiting', () => {
        const found = whatWasDeliveredWhileTheyWereSitting(
            [], { inAHouse: true, tier: 'head', ownFollowing: 5, hasASeat: true }
        );
        expect(found.delivered).toEqual([]);
        expect(found.lines).toEqual([]);
    });
});
