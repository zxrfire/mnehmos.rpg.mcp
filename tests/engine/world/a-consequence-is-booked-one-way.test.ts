/**
 * `schedule()` is the one way a dated consequence goes on the books, and what it
 * guarantees is stated once, on it.
 *
 * Before: four places minted an effect. `schedule()` was copy-on-write with no
 * caller in `src/`; the war template minted its own id through the constructor
 * and pushed; seeding's grant renewals and `scheduleConcurrentEvent` wrote the
 * whole object out literally. And nothing held a date ahead of the clock, which
 * only fires what lies strictly after the day it is read from - so a grant whose
 * first renewal was drawn for the opening day was on the books and never came.
 *
 *   THE ID       one sequence, whoever books
 *   THE DATE     a consequence asked for today or earlier is due tomorrow, and
 *                it then fires
 *   THE STATE    the world handed in is not changed
 *   THE WORLD    a seeded world run forward holds unique ids and no effect
 *                dated behind the day it opened on
 */

import { describe, expect, it } from 'vitest';
import { createWorld, schedule } from '../../../src/engine/world/world-state.js';
import { advanceYears, scheduleConcurrentEvent } from '../../../src/engine/world/time.js';
import { soakedWorld } from '../../support/soaked-world.js';

const YEAR = 365;

function aBareWorld() {
    return createWorld({ seed: 'booked-one-way', skipPriorAges: true, regionCount: 2, presentYear: 0 });
}

describe('booking a consequence', () => {
    it('mints one sequence of ids, whoever books', () => {
        const world = aBareWorld();
        const first = schedule(world, { kind: 'debt_due', dueOnDay: YEAR, summary: 'Owed.' });
        const second = scheduleConcurrentEvent(first.state, { onDay: 2 * YEAR, summary: 'Happened.' });
        expect(first.effect.id).toBe(`e${world.nextEffectSeq}`);
        expect(second.effectId).toBe(`e${world.nextEffectSeq + 1}`);
        expect(second.state.nextEffectSeq).toBe(world.nextEffectSeq + 2);
    });

    it('does not change the world it was handed', () => {
        const world = aBareWorld();
        const before = world.schedule.length;
        schedule(world, { kind: 'debt_due', dueOnDay: YEAR, summary: 'Owed.' });
        expect(world.schedule.length).toBe(before);
    });

    it('books a consequence asked for today or earlier on the next day, and it lands', () => {
        const world = aBareWorld();
        const today = Math.floor(world.currentDay);
        const booked = schedule(world, { kind: 'custom', dueOnDay: today - 10, summary: 'Already due.' });
        expect(booked.effect.dueOnDay).toBe(today + 1);
        const out = advanceYears(booked.state, 1);
        expect(out.fired.map(f => f.effect.id)).toContain(booked.effect.id);
    });
});

describe('a seeded world', () => {
    it('opens with every consequence ahead of it, and keeps one sequence of ids as it runs', async () => {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        const opened = await soakedWorld('booked-one-way', { years: 0 });
        const open = Math.floor(opened.currentDay);
        expect(opened.schedule.length).toBeGreaterThan(0);
        for (const effect of opened.schedule) expect(effect.dueOnDay, effect.id).toBeGreaterThan(open);

        const ran = await soakedWorld('booked-one-way', { years: 40 });
        const ids = ran.schedule.map(effect => effect.id);
        expect(new Set(ids).size).toBe(ids.length);
    }, 300_000);
});
