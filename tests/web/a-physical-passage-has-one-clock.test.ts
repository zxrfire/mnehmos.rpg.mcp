/**
 * Accepted transport consumes fractional actual world time. Its previous whole-
 * day adapter lost a .125-day reply and rounded the remaining voyage upward.
 * Legacy displayed noon may be promoted through existing world tasks, but is
 * not an additional requested body span or a rewritten run-origin offset.
 * Save/reopen, real midnight, later ordinary spans and another active life all
 * ask the same stored currentDay through the server's existing world handle.
 * SCRATCH controls: unrun. Direct legacy engine worlds retain their missing-
 * hour default; these assertions exercise actual played clock adapters.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld, prepareWorldClockForPreciseSpan, advanceWorldForCultivator,
    beginRunInWorld, resetCultivationWorlds, worldForRun } from '../../src/server/state/cultivation-world.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { makeCultivator } from '../engine/cultivation/fixtures.js';

it('preserves exact played fractions, true midnight and historic run starts after reopening and another run', async () => {
    const { game, db } = makeGame({ seed: 'precise-clock-run', worldEnabled: true });
    try {
        await createWorld({ seed: 'precise-clock-world', presentYear: 0 });
        await game.newRun('Clock passenger');
        const originalRun = game.currentRun().run;
        const originalBody = game.repos.cultivators.getById(game.state().cultivator.id)!;
        const old = await worldForRun(originalRun);
        const before = old.currentDay;
        old.currentHour = 12;
        const prepared = await prepareWorldClockForPreciseSpan(originalRun, originalBody);
        const origin = prepared.runs.find(one => one.id === originalRun.id)!.startedOnDay;
        expect(prepared.currentDay).toBe(before + .5);
        expect(game.repos.cultivators.getById(originalBody.id)!.age).toBe(originalBody.age);
        expect(game.repos.runs.getById(originalRun.id)!.elapsedDays).toBe(originalRun.elapsedDays);
        const spend = async (days: number, precise: boolean) => {
            const nextRun = game.repos.runs.advanceDays(originalRun.id, days)!;
            const nextBody = game.repos.cultivators.applyDeltas(originalBody.id, { age: days / 365 })!;
            return advanceWorldForCultivator(nextRun, nextBody, days, { preciseDays: precise });
        };
        await spend(.125, true);
        resetCultivationWorlds();
        let restored = await worldForRun(game.repos.runs.getById(originalRun.id)!);
        expect(restored.currentDay).toBe(before + .625);
        expect(routineTime(restored)).toBe(restored.currentDay);
        expect(restored.runs.find(one => one.id === originalRun.id)!.startedOnDay).toBe(origin);
        await spend(.375, true);
        resetCultivationWorlds();
        restored = await worldForRun(game.repos.runs.getById(originalRun.id)!);
        expect(restored.currentDay).toBe(before + 1);
        expect(restored.currentHour).toBe(0);
        expect(routineTime(restored)).toBe(before + 1);
        await spend(1, false);
        expect((await worldForRun(game.repos.runs.getById(originalRun.id)!)).currentDay).toBe(before + 2);

        const secondBody = game.repos.cultivators.create(makeCultivator({ id: 'second-clock-person' }));
        const secondRun = game.repos.runs.startRun({ cultivatorId: secondBody.id, seed: 'second-clock-run' });
        const secondOrigin = await beginRunInWorld(secondRun, secondBody);
        expect(secondOrigin.startedOnDay).toBe(before + 2);
        await prepareWorldClockForPreciseSpan(secondRun, secondBody);
        const secondAfter = game.repos.runs.advanceDays(secondRun.id, .125)!;
        await advanceWorldForCultivator(secondAfter, secondBody, .125, { preciseDays: true });
        resetCultivationWorlds();
        expect((await worldForRun(secondAfter)).currentDay).toBe(before + 2.125);
        expect((await worldForRun(game.repos.runs.getById(originalRun.id)!)).currentDay).toBe(before + 2.125);
    } finally { db.close(); resetCultivationWorlds(); }
});
