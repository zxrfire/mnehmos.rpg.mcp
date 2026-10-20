/**
 * The FINAL real world boundary used to return the application cached before
 * world effects. Even with an exhausted iterator, a lost carrier must prevent
 * arrival, and actual SQL damage, purse changes and death must reach the caller.
 * These adapter controls use the real repository/apply path and an arranged
 * dated consequence; public/owned transport wiring has its separate played
 * controls. No model, world horizon or accepted fare is simulated here.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { simulateTimeSkipParts } from '../../src/engine/cultivation/time-skip.js';
import { stepsAtWorldBoundaries } from '../../src/web/a-span-spent-at-world-boundaries.js';
import { finishPreparedSpan } from '../../src/web/finishing-a-prepared-span.js';

const spendAtWorldBoundaries = (...args: Parameters<typeof stepsAtWorldBoundaries>) =>
    finishPreparedSpan(stepsAtWorldBoundaries(...args));

/**
 * A passenger reply has already recorded its enclosing action before its lesser
 * clock advances. The old held transport helper counted a second turn at the
 * last checkpoint. Completion is the original action's existing target, not a
 * separate passenger turn. A native boundary resolution may also complete that
 * same action; every body portion still uses its original event turn.
 * These controls retain actual repository/application writes and positive time.
 * Focused09 observed .000342 stored years for .125 day; the old assertion
 * demanded .125/365 at twelve decimal places. Native TimeSkipResult rounds
 * age via roundYears, then apply adds that authoritative delta. Exact elapsed
 * remains .125. Checkpoint age must match the uninterrupted native precise
 * body receipt in this same invocation, without copying rounding or widening
 * tolerance to hide loss.
 * Departure zero-time/death and same-crossing replay need separate played proof.
 */
for (const completionAt of ['not_yet', 'before_span', 'first_boundary'] as const) {
    it('completes positive passenger time once when completion is ' + completionAt, async () => {
        const { game, db } = makeGame({ seed: 'one-enclosing-passenger-turn' });
        try {
            await game.newRun('One action passenger');
            const original = game.currentRun();
            const target = original.run.turn + 1;
            const complete = () => game.freeAction(game.currentRun().run, 'interact',
                { headline: 'An actual reply.', lines: [], structure: [], prose: 'An actual reply.' });
            if (completionAt === 'before_span') complete();
            let boundaries = 0;
            const current = game.currentRun();
            const context = { seed: current.run.seed, turn: original.run.turn, startDay: 0,
                locationId: current.cultivator.location ?? 'road', randomEvents: false,
                autoBreakthrough: false, grainAbstinence: true, options: { focusMultiplier: 0 } };
            const nativeWhole = simulateTimeSkipParts(current.cultivator, .125, context, { preciseDays: true, nextBoundary: () => null });
            let uninterrupted = nativeWhole.next();
            while (!uninterrupted.done) uninterrupted = nativeWhole.next();
            const spent = await spendAtWorldBoundaries(game.repos, current.run, current.cultivator, .125,
                context, {
                    preciseDays: true, resolvesOnTurn: target,
                    nextBoundary: elapsed => elapsed < .0625 ? .0625 : null,
                    advanceWorld: async () => {
                        if (boundaries++ === 0 && completionAt === 'first_boundary') complete();
                    }, whatStopsTheSpan: () => null
                });
            expect(boundaries).toBe(2);
            expect(spent.applied.run.turn).toBe(target);
            expect(spent.applied.run.elapsedDays - original.run.elapsedDays).toBe(.125);
            expect(uninterrupted.value.simulatedDays).toBe(.125);
            expect(spent.skip.deltas.age).toBe(uninterrupted.value.deltas.age);
            expect(spent.applied.cultivator.age).toBeCloseTo(original.cultivator.age + uninterrupted.value.deltas.age, 12);
        } finally { db.close(); }
    });
}


for (const effect of ['wound_and_credit', 'carrier_loss', 'body_death'] as const) {
    it('reads ' + effect + ' at the final actual boundary before emitting arrival', async () => {
        const { game, db } = makeGame({ seed: 'final-clock-body-control' });
        try {
            await game.newRun('Boundary passenger');
            const id = game.state().cultivator.id;
            game.repos.cultivators.update(id, { realmOrdinal: 20, hp: 50, maxHp: 50, spiritStones: 30 });
            const body = game.repos.cultivators.getById(id)!;
            const run = game.currentRun().run;
            let carrierAvailable = true;
            let clockAdvanced = 0;
            const result = await spendAtWorldBoundaries(game.repos, run, body, .125,
                { seed: run.seed, locationId: body.location ?? 'road', startDay: 0,
                    randomEvents: false, autoBreakthrough: false, grainAbstinence: true,
                    options: { focusMultiplier: 0 } }, {
                    preciseDays: true, nextBoundary: () => null,
                    advanceWorld: async days => {
                        clockAdvanced += days;
                        if (effect === 'wound_and_credit') game.repos.cultivators.update(id, { hp: 7, spiritStones: 91 });
                        if (effect === 'carrier_loss') carrierAvailable = false;
                        if (effect === 'body_death') game.repos.cultivators.markDead(id, 'combat_defeat', run.turn + 1, 'Killed at the actual boundary.');
                    },
                    whatStopsTheSpan: () => carrierAvailable ? null : 'The actual hull left this passage.'
                });
            expect(clockAdvanced).toBe(.125);
            expect(result.applied.run.elapsedDays).toBe(run.elapsedDays + .125);
            expect(result.applied.cultivator).toEqual(game.repos.cultivators.getById(id));
            if (effect === 'wound_and_credit') {
                expect(result.applied.cultivator.hp).toBe(7);
                expect(result.applied.cultivator.spiritStones).toBe(91);
                expect(result.skip.deltas.spiritStones).toBe(0);
            } else {
                expect(result.skip.interrupted).toBe(true);
                expect(result.skip.events.filter(event => event.kind === 'death')).toEqual([]);
                if (effect === 'body_death') expect(result.applied.cultivator.alive).toBe(false);
            }
        } finally { db.close(); }
    });
}

/** The first legacy prepared encounter belongs to this span; a later SQL consequence stays fresh. */
it('commits selected encounter HP and purse once, then preserves a fresh boundary change', async () => {
    const { game, db } = makeGame({ seed: 'selected-encounter-checkpoint' });
    try {
        await game.newRun('Prepared passenger');
        const id = game.currentRun().cultivator.id;
        game.repos.cultivators.update(id, { realmOrdinal: 20, hp: 50, maxHp: 50, spiritStones: 30 });
        const actual = game.repos.cultivators.getById(id)!;
        // Existing shortSkip passes the selected encounter's prepared sheet before applying body time.
        // Selected purse effects must be real debits; apply preserves concurrent money writes.
        game.repos.cultivators.applyDeltas(id, { spiritStones: -3 });
        const prepared = { ...game.repos.cultivators.getById(id)!, hp: actual.hp - 7 };
        const run = game.currentRun().run;
        let boundaries = 0;
        const result = await spendAtWorldBoundaries(game.repos, run, prepared, .125,
            { seed: run.seed, locationId: prepared.location ?? 'road', startDay: 0,
                randomEvents: false, autoBreakthrough: false, grainAbstinence: true,
                options: { focusMultiplier: 0 } }, {
                preciseDays: true, nextBoundary: elapsed => elapsed < .0625 ? .0625 : null,
                advanceWorld: async () => {
                    if (boundaries++ === 0) {
                        expect(game.repos.cultivators.getById(id)?.hp).toBe(43);
                        expect(game.repos.cultivators.getById(id)?.spiritStones).toBe(27);
                        game.repos.cultivators.update(id, { hp: 10, spiritStones: 77 });
                    }
                }, whatStopsTheSpan: () => null
            });
        expect(boundaries).toBe(2);
        expect(result.applied.cultivator.hp).toBe(10);
        expect(result.applied.cultivator.spiritStones).toBe(77);
        expect(result.applied.run.elapsedDays - run.elapsedDays).toBe(.125);
    } finally { db.close(); }
});
