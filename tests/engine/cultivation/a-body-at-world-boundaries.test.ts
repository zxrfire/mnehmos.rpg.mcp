/**
 * A world appointment can wound or advance the played body during a passage.
 * The held simulator used to keep its original sheet and commit toward it after
 * the pause, restoring damage and crediting external grants as breakthroughs.
 * Resume reads the actual sheet; only this span's new quantities are returned.
 * Fractions share one food/mending/calendar frame, including age rounding debt.
 * These are SCRATCH controls, not recorded passing evidence. Red controls should
 * remove the fresh-body reconciliation and the absolute action-day accounting.
 */
import { simulateTimeSkip, simulateTimeSkipParts, type TimeSkipContext } from '../../../src/engine/cultivation/time-skip.js';
import { skipEndState } from '../../../src/server/consolidated/cultivation-support.js';
import { portionOfTimeSkip } from '../../../src/web/a-span-spent-at-world-boundaries.js';
import { simulateTimeSkipBeforeBoundaries } from './time-skip-original-control.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const context: TimeSkipContext = { seed: 'boundary-body-control', locationId: 'road',
    startDay: 0, turn: 2, randomEvents: false, autoBreakthrough: false,
    grainAbstinence: true, options: { focusMultiplier: 0 } };

describe('one body resumes at an actual world boundary', () => {
    it('retains actual damage, qi and purse changes without claiming an external rank as its breakthrough', () => {
        const initial = makeCultivator({ realmOrdinal: 20, hp: 50, maxHp: 50, spiritStones: 30 });
        const parts = simulateTimeSkipParts(initial, .25, context,
            { preciseDays: true, nextBoundary: elapsed => elapsed < .125 ? .125 : null });
        const first = parts.next();
        expect(first.done).toBe(false);
        const fresh = { ...initial, ...skipEndState(initial, first.value), hp: 7, qi: 3,
            spiritStones: 91, realmOrdinal: 21, cultivationProgress: 19, yearsAtCurrentRealm: 0 };
        const final = parts.next({ body: fresh, rations: 0 });
        expect(final.done).toBe(true);
        const newPortion = portionOfTimeSkip(final.value, first.value);
        const end = skipEndState(fresh, newPortion);
        expect(end.hp).toBeLessThan(10);
        expect(end.qi).toBe(3);
        expect(end.spiritStones).toBe(91);
        expect(end.realmOrdinal).toBe(21);
        expect(newPortion.deltas.realmOrdinal).toBe(0);
        expect(final.value.events.filter(event => event.kind === 'breakthrough_success')).toEqual([]);
    });

    it('eight eighth-day checkpoints retain the same food, bleeding, mending and age as a quiet complete day', () => {
        const initial = makeCultivator({ realmOrdinal: 12, hp: 35, maxHp: 50, satiety: 20 });
        const hungry = { ...context, grainAbstinence: false, rations: 2 };
        const whole = simulateTimeSkip(initial, 1, hungry);
        const parts = simulateTimeSkipParts(initial, 1, hungry,
            { preciseDays: true, nextBoundary: elapsed => elapsed < 1 ? Math.min(1, elapsed + .125) : null });
        let sheet = initial;
        let previous = null;
        let next = parts.next();
        while (true) {
            const portion = portionOfTimeSkip(next.value, previous);
            sheet = { ...sheet, ...skipEndState(sheet, portion) };
            if (next.done) break;
            previous = next.value;
            next = parts.next({ body: sheet, rations: next.value.endState.rationsRemaining });
        }
        const actual = skipEndState(sheet, { ...next.value, deltas: { ...next.value.deltas,
            hp: 0, qi: 0, satiety: 0, spiritStones: 0, cultivationProgress: 0, realmOrdinal: 0, age: 0 } });
        const expected = skipEndState(initial, whole);
        expect(actual.age).toBeCloseTo(expected.age, 12);
        expect({ ...actual, age: expected.age }).toEqual(expected);
        expect(next.value.endState.rationsRemaining).toBe(whole.endState.rationsRemaining);
    });
});

/** Both implementations load in ONE invocation. The reference is the independent
 * pre-generator root algorithm, changed only at its exported function name.
 * Full receipts include RNG-dependent events, occurrence counts, tolls, grants,
 * wounds, insight/vision records and terminal state, not only final HP. */
describe('unchanged legacy no-boundary callers', () => {
    for (const specimen of [
        { body: makeCultivator({ realmOrdinal: 20, hp: 23, maxHp: 50 }), days: 120 },
        { body: makeCultivator({ realmOrdinal: 12, satiety: 2, injuries: makeInjuries(2) }), days: 80 },
        { body: makeCultivator({ age: 99, realmOrdinal: 0 }), days: 1000 }
    ]) it('preserves its complete independently computed receipt for ' + specimen.days + ' days', () => {
        const scene = { ...context, randomEvents: true, autoBreakthrough: true,
            grainAbstinence: false, rations: 3, options: { focusMultiplier: 1 } };
        expect(simulateTimeSkip(specimen.body, specimen.days, scene))
            .toEqual(simulateTimeSkipBeforeBoundaries(specimen.body, specimen.days, scene));
    });
});

it('stops at the actual world death without re-running simulated death or later portions', () => {
    const initial = makeCultivator({ realmOrdinal: 20 });
    const parts = simulateTimeSkipParts(initial, 10, context,
        { preciseDays: true, nextBoundary: elapsed => elapsed < .125 ? .125 : null });
    const first = parts.next();
    const dead = { ...initial, ...skipEndState(initial, first.value), alive: false,
        hp: 0, starvationTurns: 13, bleedingTurns: 4 };
    const last = parts.next({ body: dead, stop: 'The actual carrier was lost.', rations: 0 });
    expect(last.done).toBe(true);
    expect(last.value.simulatedDays).toBe(.125);
    expect(last.value.interrupted).toBe(true);
    expect(last.value.events.filter(event => event.kind === 'death')).toEqual([]);
    expect(last.value.endState.starvationTurns).toBe(13);
    expect(last.value.endState.bleedingTurns).toBe(4);
    expect(portionOfTimeSkip(last.value, first.value).deltas.hp).toBe(0);
});

it('uses a changed body cap and actual healed wounds without restoring the opening injury list', () => {
    const initial = makeCultivator({ realmOrdinal: 20, hp: 35, maxHp: 50, injuries: makeInjuries(2) });
    const parts = simulateTimeSkipParts(initial, .25, context,
        { preciseDays: true, nextBoundary: elapsed => elapsed < .125 ? .125 : null });
    const first = parts.next();
    const changed = { ...initial, ...skipEndState(initial, first.value), hp: 3, maxHp: 10, injuries: [] };
    const last = parts.next({ body: changed });
    const portion = portionOfTimeSkip(last.value, first.value);
    const end = skipEndState(changed, portion);
    expect(end.hp).toBeGreaterThanOrEqual(3);
    expect(end.hp).toBeLessThanOrEqual(10);
    expect(last.value.injuriesSustained).toEqual([]);
    expect(changed.injuries).toEqual([]);
});

/** Environmental exposure is live ground. A pause cannot mint another minimum
 * wound; the original chunk's single minimum and actual positive-damage/death
 * interruption remain authoritative. Separate action-frame exposure is not
 * established by this test and needs an existing cross-command body authority. */
it('one live hostile day split into eighths charges one minimum wound, not one per boundary', () => {
    const initial = makeCultivator({ realmOrdinal: 20, hp: 50, maxHp: 50 });
    const scene = { ...context, hostility: { dailyHpFraction: .01,
        reason: 'The exposed route damages the body.', inert: false } };
    const whole = simulateTimeSkip(initial, 1, scene);
    const held = simulateTimeSkipParts(initial, 1, scene,
        { preciseDays: true, nextBoundary: elapsed => elapsed < 1 ? Math.min(1, elapsed + .125) : null });
    let next = held.next();
    while (!next.done) next = held.next();
    expect(next.value.deltas.hp).toBe(whole.deltas.hp);
    expect(next.value.simulatedDays).toBe(1);
    expect(next.value.interruptReason).toBe('hostile_ground');
    expect(next.value.events.filter(event => event.kind === 'injury_sustained')
        .map(event => event.data.damage)).toEqual([1]);
});

it('actual positive hostile damage still ends a life; fractional checkpoints cannot forgive it', () => {
    const initial = makeCultivator({ realmOrdinal: 20, hp: 1, maxHp: 50 });
    const scene = { ...context, hostility: { dailyHpFraction: .01,
        reason: 'The exposed route damages the body.', inert: false } };
    const held = simulateTimeSkipParts(initial, 1, scene,
        { preciseDays: true, nextBoundary: elapsed => elapsed < 1 ? Math.min(1, elapsed + .125) : null });
    let next = held.next();
    while (!next.done) next = held.next();
    expect(next.value.died).toBe(true);
    expect(next.value.simulatedDays).toBe(1);
    expect(next.value.deltas.hp).toBe(-1);
});
