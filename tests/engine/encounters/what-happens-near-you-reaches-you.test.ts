/**
 * A thing that turned up on somebody was equally likely wherever it happened.
 *
 * `arrivableFromUnheard` filters on magnitude and on whether the digest already
 * reported it, and on nothing else. There is no proximity term anywhere in the
 * arrival path, so a war on the far side of the continent was exactly as likely
 * to land on a cultivator's sitting as two juniors brawling in the next
 * courtyard - and, because `ARRIVAL_INTERRUPT_MAGNITUDE` is read off the raw
 * figure, exactly as likely to STOP it.
 *
 * That is the same missing axis `what-people-are-saying.ts` had, pointed at a
 * different consumer, so it is fixed with the same read. The design owner, on
 * why this half is not gated on standing the way delivery is: two juniors
 * fighting disturbing a senior is a trope, and it is not a fixed list. Nothing
 * here branches on what kind of event it was. Whatever the world produced near a
 * place can reach somebody sitting in it, weighted by how close and how loud.
 *
 * The far end is damped rather than cut: a thing a province away still turns up,
 * and it turns up as something somebody mentions rather than as something that
 * gets you off the mat.
 */

import { describe, it, expect } from 'vitest';

import {
    HOW_MUCH_OF_IT_REACHES,
    asItReachesWhereTheyAre
} from '../../../src/engine/encounters/arrivals.js';
import { ARRIVAL_INTERRUPT_MAGNITUDE } from '../../../src/engine/encounters/window.js';
import type { ArrivableFact } from '../../../src/engine/encounters/types.js';

function waiting(factId: string, magnitude: number): ArrivableFact {
    return { factId, day: 100, magnitude, text: `something ${factId}` };
}

// ─────────────────────────────────────────────────────────────────────────

describe('how close it happened', () => {
    it('lets a small thing in the same place stop a sitting', () => {
        const brawl = waiting('brawl', 0.4);
        expect(brawl.magnitude).toBeLessThan(ARRIVAL_INTERRUPT_MAGNITUDE);
        const [felt] = asItReachesWhereTheyAre([brawl], () => 'here');
        expect(felt.magnitude).toBeGreaterThanOrEqual(ARRIVAL_INTERRUPT_MAGNITUDE);
    });

    it('stops a big thing a province away from getting anybody off the mat', () => {
        const war = waiting('war', 0.75);
        expect(war.magnitude).toBeGreaterThan(ARRIVAL_INTERRUPT_MAGNITUDE);
        const [felt] = asItReachesWhereTheyAre([war], () => 'a region away');
        expect(felt.magnitude).toBeLessThan(ARRIVAL_INTERRUPT_MAGNITUDE);
        // Damped, not cut. It still turns up; it turns up as something said.
        expect(felt.magnitude).toBeGreaterThan(0);
    });

    it('leaves the two bands the engine cannot place any better exactly as they were', () => {
        const row = waiting('row', 0.55);
        expect(asItReachesWhereTheyAre([row], () => 'in the region')[0].magnitude).toBe(0.55);
        expect(asItReachesWhereTheyAre([row], () => 'unplaceable')[0].magnitude).toBe(0.55);
        expect(HOW_MUCH_OF_IT_REACHES['in the region']).toBe(1);
        expect(HOW_MUCH_OF_IT_REACHES.unplaceable).toBe(1);
    });

    it('branches on nothing but where it happened', () => {
        // The ruling is explicitly non-exhaustive, so a kind the engine has
        // never been taught is weighted exactly like one it has.
        const strange = { ...waiting('strange', 0.4), kind: 'a-kind-nobody-has-written-yet' };
        const [felt] = asItReachesWhereTheyAre([strange], () => 'here');
        expect(felt.magnitude).toBeCloseTo(0.4 * HOW_MUCH_OF_IT_REACHES.here, 10);
        expect(felt.kind).toBe('a-kind-nobody-has-written-yet');
    });
});

describe('what comes back', () => {
    it('never lets a thing grow past the top of the scale', () => {
        const [felt] = asItReachesWhereTheyAre([waiting('huge', 0.95)], () => 'here');
        expect(felt.magnitude).toBeLessThanOrEqual(1);
    });

    it('does not touch the list it was handed', () => {
        const row = waiting('row', 0.4);
        asItReachesWhereTheyAre([row], () => 'here');
        expect(row.magnitude).toBe(0.4);
    });

    it('keeps everything else about each thing, because only the reach moved', () => {
        const rows = [waiting('a', 0.4), waiting('b', 0.7)];
        const felt = asItReachesWhereTheyAre(rows, f => f.factId === 'a' ? 'here' : 'a region away');
        expect(felt.map(f => f.factId)).toEqual(['a', 'b']);
        expect(felt.map(f => f.text)).toEqual(rows.map(f => f.text));
        expect(felt.map(f => f.day)).toEqual(rows.map(f => f.day));
    });
});
