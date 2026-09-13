/**
 * The pass that opens doors had never opened one.
 *
 * `applyConvergences` has existed for the life of the project. It asked
 * `nextOpeningDay`, which returns null for anything `sealed` - correct where
 * `sealed` means a door nobody has ever opened, wrong where it means the shut
 * half of a schedule, and on a cycled ruin the column means the second. Every
 * seeded ruin carrying a cycle is sealed, so the test was false for all of
 * them. The `open_now` tag the opening adds is also the gate on the half that
 * shuts them, so both halves were unreachable together.
 *
 * MEASURED over twelve pinned worlds run two hundred years each, both arms in
 * one process (`scripts/probe-how-often-the-world-opens-a-door.ts`):
 *
 *                        doors opened   doors shut   schedule readable at day 0
 *   asking nextOpeningDay           0            0                 0 of 72
 *   asking the schedule            46           46                72 of 72
 *
 *   = 1.92 openings per century per world, against zero. Simulation cost
 *     18.72 ms per simulated year after against 20.18 before, which is machine
 *     noise on a shared box rather than a cost: the pass was already walking
 *     every location every year and the arithmetic is closed form.
 *
 * AND A WINDOW IS NOW SHORTER THAN THE PASS THAT RUNS IT. Windows run 7 to 90
 * days against a yearly pass, so a door can open and shut inside one call. The
 * old shape returned after opening one. Put that `continue` back and the third
 * test below reports a fourteen-day window standing open for **43,814 days** -
 * a hundred and twenty years, because the door stays open until its own next
 * opening comes round. That is the exact failure the design owner named when he
 * said opening on a sixty year cycle does not mean open FOR sixty years.
 *
 * WHAT IS ASSERTED is that doors move and that a window is not outlived. The
 * counts are provenance and no seed is pinned to one.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import { nextOpeningDay } from '../../../src/engine/world/locations.js';
import { whenTheScheduleNextOpens } from '../../../src/engine/world/convergence.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { PressureEvent } from '../../../src/engine/world/the-world-changing-on-its-own.js';

const YEAR = 365;
/** Long enough that a sixty year cycle comes round several times. */
const LONG_ENOUGH = 300;

function world(seed: string): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250 }).state;
}

function run(state: WorldState, years: number): PressureEvent[] {
    const from = state.currentDay;
    return applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 }).events;
}

describe('the world opens a door and shuts it again', () => {
    it('opens doors on their own schedule, where it opened none before', () => {
        const state = world('doors-open');
        const events = run(state, LONG_ENOUGH);

        const opened = events.filter(e => e.kind === 'convergence_opened');
        expect(opened.length).toBeGreaterThan(0);
    });

    it('shuts every door it opens', () => {
        const state = world('doors-shut');
        const events = run(state, LONG_ENOUGH);

        const opened = events.filter(e => e.kind === 'convergence_opened');
        const closed = events.filter(e => e.kind === 'convergence_closed');
        expect(opened.length).toBeGreaterThan(0);
        // Every opening is answered. A door left standing open is a door that
        // was never a door, and it is also what the old `open_now` gate would
        // have produced had the opening half ever fired.
        expect(closed.length).toBe(opened.length);
    });

    it('does not leave a door open longer than its own window', () => {
        const state = world('doors-window');
        const events = run(state, LONG_ENOUGH);

        const cycleOf = new Map(state.locations
            .filter(l => l.cycle)
            .map(l => [l.id, l.cycle!]));
        const openedOn = new Map<string, number>();
        for (const event of [...events].sort((a, b) => a.onDay - b.onDay)) {
            const where = event.fact.locationId;
            if (where === null) continue;
            if (event.kind === 'convergence_opened') openedOn.set(where, event.onDay);
            if (event.kind === 'convergence_closed') {
                const from = openedOn.get(where);
                if (from === undefined) continue;
                const cycle = cycleOf.get(where);
                expect(cycle).toBeDefined();
                expect(event.onDay - from).toBeLessThanOrEqual(cycle!.openDays);
                openedOn.delete(where);
            }
        }
        expect(openedOn.size).toBe(0);
    });

    it('names the day a shut schedule is next due, where the old read could not', () => {
        // The identity check behind the before-number. Both expressions over
        // the same rows in one process, which is what makes "zero" a
        // measurement rather than a second tree.
        const state = world('doors-readable');
        const day = Math.floor(state.currentDay);
        const cycled = state.locations.filter(l => l.cycle && l.kind === 'ruin');

        expect(cycled.length).toBeGreaterThan(0);
        for (const site of cycled) {
            if (!site.sealed) continue;
            expect(nextOpeningDay(site, day)).toBeNull();
            expect(whenTheScheduleNextOpens(site, day)).not.toBeNull();
        }
    });
});
