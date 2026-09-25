/**
 * A killing somebody hid can come out, and mostly does not.
 *
 * `why-one-cultivator-kills-another.ts` produces killings made to look like
 * something else, written as deeds nobody has worked out. Nothing in the world
 * ever turned one up: every disguised killing in a five-thousand-year world
 * stayed disguised, which made hiding one free.
 *
 * What is pinned: the four terms that decide it, that a found-out killing lands
 * as the open fact and the grudge an open killing would have left, and the rate
 * - measured on `afford-a`, 15% of hidden killings came out within a century of
 * being done and 21% within a millennium.
 *
 * RED-CHECKED. Setting `WHAT_COMES_OUT_IN_A_YEAR` to zero turns the world test
 * red. "Nobody is asking" is written twice - the early return and the `looking`
 * term - so each alone still holds the unit test; both have to go for it to turn
 * red, which is what a guard and the factor it guards should look like.
 */
import { describe, it, expect } from 'vitest';

import { soakedWorld } from '../../support/soaked-world.js';
import {
    CAME_TO_LIGHT,
    HOW_LONG_A_THING_CAN_COME_OUT,
    whetherItComesOut
} from '../../../src/engine/world/what-comes-to-light-about-a-killing.js';

describe('what would turn one up', () => {
    const fresh = { yearsSince: 1, onOpenGround: false, asking: 4, victimOrdinal: 40 };

    it('is nothing at all where nobody is left to ask', () => {
        expect(whetherItComesOut({ ...fresh, asking: 0 })).toBe(0);
        expect(whetherItComesOut(fresh)).toBeGreaterThan(0);
    });

    it('fades with the years, and stops when nobody is asking any more', () => {
        expect(whetherItComesOut({ ...fresh, yearsSince: 100 }))
            .toBeLessThan(whetherItComesOut(fresh));
        expect(whetherItComesOut({ ...fresh, yearsSince: HOW_LONG_A_THING_CAN_COME_OUT + 1 })).toBe(0);
    });

    it('is smaller where it was done away from everybody, and for somebody nobody knew', () => {
        expect(whetherItComesOut({ ...fresh, onOpenGround: true }))
            .toBeLessThan(whetherItComesOut(fresh));
        expect(whetherItComesOut({ ...fresh, victimOrdinal: 2 }))
            .toBeLessThan(whetherItComesOut(fresh));
    });
});

describe('and in a world that runs', () => {
    it('turns up a few of them and leaves most of them hidden', async () => {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        const state = await soakedWorld('afford-a', { years: 300 });

        const hidden = state.history.facts.filter(f => f.data?.hidden === true);
        expect(hidden.length, 'nobody hid a killing in three centuries').toBeGreaterThan(5);
        const cameOut = hidden.filter(f => typeof f.data?.[CAME_TO_LIGHT] === 'number');
        expect(cameOut.length, 'nothing ever came out').toBeGreaterThan(0);
        expect(cameOut.length / hidden.length, 'most of them should stay hidden').toBeLessThan(0.5);

        // What coming out lands as: the row is no longer secret, the world says
        // it out loud, and the people who were asking hold it against them.
        const one = cameOut[0]!;
        expect(one.visibility).not.toBe('secret');
        expect(one.causeKnown).toBe(true);
        const said = state.history.facts.find(f => f.data?.cameToLightAbout === one.id);
        expect(said, 'nothing was said about it').toBeDefined();
        const killerId = one.actors.find(a => a.role === 'killer')!.id;
        const holdsIt = state.npcs.some(n => n.relationships.some(r =>
            r.targetId === killerId && r.standing <= -0.8 && /hid it/.test(r.note)));
        expect(holdsIt, 'nobody held it against the killer').toBe(true);
    }, 600_000);
});
