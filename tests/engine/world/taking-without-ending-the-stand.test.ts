/**
 * What the flower road buys, measured on the ground it is about.
 *
 * The sword road buys flight, and its consumer is `couldFlyOnTheirOwnBlade`.
 * This is the other one: a taker of the school gets the same armful and the
 * bed loses less. Without a consumer the road is a tag on twelve rows, so this
 * file is the half that makes it a road.
 *
 * TWO NUMBERS THAT MUST NOT COLLAPSE INTO ONE. `taken` is what the taker
 * carries away and is never touched by who is holding the knife. The cost to
 * the stand is, and it is the whole grant. A test that only checked `taken`
 * would pass on a no-op.
 *
 * AND IT REDUCES WITHOUT EVER ZEROING, which is AGENTS.md's law about
 * defences pointed at a bed instead of a body. There is no amount of skill at
 * which a valley stops being worked, and the last test here is the one that
 * would catch somebody "improving" this into immunity.
 */

import { describe, it, expect } from 'vitest';

import {
    THE_SCHOOL_COSTS_THE_BED,
    capacityFor,
    drawFromTheGround,
    applyGroundDraw,
    standingStock
} from '../../../src/engine/world/what-a-place-still-has-in-the-ground.js';
import { makeLocation } from '../../../src/engine/world/locations.js';

function bed() {
    return makeLocation({
        id: 'loc-a-bed',
        name: 'a bed',
        kind: 'site',
        description: 'ground with something growing on it',
        qiDensity: 60
    });
}

const DAY = 1_000;

describe('the school takes the same armful', () => {
    it('hands over exactly what anybody else would', () => {
        const ordinary = drawFromTheGround(bed(), { kind: 'herb', grade: 'earth', wanted: 9, onDay: DAY });
        const school = drawFromTheGround(bed(), {
            kind: 'herb', grade: 'earth', wanted: 9, onDay: DAY, takenByTheSchool: true
        });
        expect(school.taken).toBe(ordinary.taken);
        expect(school.taken).toBe(9);
        expect(school.shortfall).toBe(ordinary.shortfall);
    });

    it('is still limited by what is standing there, school or not', () => {
        const place = bed();
        const capacity = capacityFor(place, 'herb', 'earth');
        const greedy = drawFromTheGround(place, {
            kind: 'herb', grade: 'earth', wanted: capacity + 500, onDay: DAY, takenByTheSchool: true
        });
        expect(greedy.taken).toBe(capacity);
        expect(greedy.shortfall).toBe(500);
    });
});

describe('and the bed pays less for it', () => {
    it('costs the stand a third of what an ordinary take costs', () => {
        const ordinary = drawFromTheGround(bed(), { kind: 'herb', grade: 'earth', wanted: 30, onDay: DAY });
        const school = drawFromTheGround(bed(), {
            kind: 'herb', grade: 'earth', wanted: 30, onDay: DAY, takenByTheSchool: true
        });
        expect(ordinary.before - ordinary.after).toBe(30);
        expect(school.before - school.after).toBe(Math.ceil(30 * THE_SCHOOL_COSTS_THE_BED));
        expect(school.after).toBeGreaterThan(ordinary.after);
    });

    it('writes the smaller depletion down, so the saving survives the round trip', () => {
        // The grant is only real if it reaches the row. `patchFor` writes
        // `capacity - after`, so a saving that existed only in the returned
        // object would be a no-op the next time anybody read the ground.
        const start = bed();
        const capacity = capacityFor(start, 'herb', 'earth');

        const ordinaryDraw = drawFromTheGround(start, { kind: 'herb', grade: 'earth', wanted: 30, onDay: DAY });
        const afterOrdinary = applyGroundDraw(start, ordinaryDraw);

        const schoolDraw = drawFromTheGround(start, {
            kind: 'herb', grade: 'earth', wanted: 30, onDay: DAY, takenByTheSchool: true
        });
        const afterSchool = applyGroundDraw(start, schoolDraw);

        const left = (p: ReturnType<typeof applyGroundDraw>) =>
            standingStock(p, 'herb', 'earth', DAY).remaining;
        expect(left(afterSchool)).toBeGreaterThan(left(afterOrdinary));
        expect(left(afterOrdinary)).toBe(capacity - 30);
    });

    it('lets the same bed be worked about three times as long', () => {
        // The observable form of the claim the Orchid Court's entry makes:
        // it has worked the same beds for centuries and they still set.
        const run = (school: boolean) => {
            let place = bed();
            let takes = 0;
            for (let i = 0; i < 500; i++) {
                const draw = drawFromTheGround(place, {
                    kind: 'herb', grade: 'earth', wanted: 10, onDay: DAY, takenByTheSchool: school
                });
                if (draw.taken < 10) break;
                place = applyGroundDraw(place, draw);
                takes++;
            }
            return takes;
        };
        const ordinary = run(false);
        const school = run(true);
        expect(ordinary).toBeGreaterThan(0);
        expect(school).toBeGreaterThan(ordinary * 2);
    });
});

describe('a defence reduces and never zeroes', () => {
    it('always costs the bed at least one, however small the take', () => {
        // THE ASSERTION THAT CATCHES SOMEBODY IMPROVING THIS INTO IMMUNITY.
        // A take of one that rounded to nothing would make a valley
        // inexhaustible by anybody patient enough to take it one at a time.
        for (const wanted of [1, 2, 3]) {
            const draw = drawFromTheGround(bed(), {
                kind: 'herb', grade: 'earth', wanted, onDay: DAY, takenByTheSchool: true
            });
            expect(draw.taken).toBe(wanted);
            expect(draw.before - draw.after, `a take of ${wanted} cost the bed nothing`)
                .toBeGreaterThanOrEqual(1);
        }
    });

    it('still runs the bed out if the school works it hard enough', () => {
        let place = bed();
        const capacity = capacityFor(place, 'herb', 'earth');
        for (let i = 0; i < 5_000; i++) {
            const draw = drawFromTheGround(place, {
                kind: 'herb', grade: 'earth', wanted: 50, onDay: DAY, takenByTheSchool: true
            });
            place = applyGroundDraw(place, draw);
            if (draw.taken === 0) break;
        }
        expect(standingStock(place, 'herb', 'earth', DAY).remaining).toBe(0);
        expect(capacity).toBeGreaterThan(0);
    });

    it('creates nothing: the school never finds more than is there', () => {
        const place = bed();
        const capacity = capacityFor(place, 'herb', 'earth');
        const draw = drawFromTheGround(place, {
            kind: 'herb', grade: 'earth', wanted: capacity * 3, onDay: DAY, takenByTheSchool: true
        });
        expect(draw.taken).toBeLessThanOrEqual(capacity);
    });
});

describe('everybody who is not of the school is unchanged', () => {
    it('reads the same as it did before the field existed when it is absent', () => {
        const withFlag = drawFromTheGround(bed(), {
            kind: 'herb', grade: 'earth', wanted: 12, onDay: DAY, takenByTheSchool: false
        });
        const without = drawFromTheGround(bed(), { kind: 'herb', grade: 'earth', wanted: 12, onDay: DAY });
        expect(withFlag).toEqual(without);
    });
});
