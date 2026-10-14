/**
 * The run2 played conservation guard reported 6912 spent/remaining days for
 * 6913 requested days. Flooring both halves of a fractional interruption lost
 * a day. Arrange the already-resolved skip receipt at the fork boundary: its
 * offered remainder and stopping date must preserve the actual duration,
 * including a remainder shorter than one day. No centuries-long walk is needed.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { TimeSkipResultSchema } from '../../src/schema/cultivation.js';
import { observable } from '../../src/web/facts.js';
import { whatTheForkAsks } from '../../src/web/choosing-what-to-do-when-a-seclusion-is-broken.js';

for (const [daysAsked, daysSpent] of [[10, 2.25], [2.5, 2.25], [365, 364.75]]) {
    it(`retains the actual remainder of a ${daysAsked}-day interrupted sitting`, async () => {
        const h = await makeGameInWorld({ seed: 'fractional-fork', worldSeed: 'fractional-fork-ground' });
        try {
            await h.game.newRun('Sitter');
            const current = h.game.currentRun();
            const skip = TimeSkipResultSchema.parse({
                requestedDays: daysAsked, simulatedDays: daysSpent,
                interrupted: true, interruptReason: 'major_encounter', deltas: {},
                events: [{ kind: 'encounter', dayOffset: daysSpent,
                    summary: 'A person interrupted the sitting.', interrupts: true,
                    data: { severity: 'major', canWithdraw: true } }]
            });
            const stoppedOnDay = 4.125 + daysSpent;
            const appliedRun = { ...current.run, turn: current.run.turn + 1, elapsedDays: stoppedOnDay };
            // The former caller supplied a rounded sampling date. The actual
            // post-skip run is the authority for the recorded stopping time.
            const context = { sealed: false, acknowledged: true, daysAsked, startDay: 4 };
            h.game.raiseTheCrossroads(appliedRun, current.cultivator, skip,
                observable('The sitting was interrupted.', [], ''), context);
            const fork = h.game.crossroads;
            expect(fork, 'an actual positive remainder must remain available').not.toBeNull();
            expect(fork!.daysAsked).toBe(daysAsked);
            expect(fork!.daysSpent).toBe(daysSpent);
            expect(fork!.daysRemaining).toBe(daysAsked - daysSpent);
            expect(fork!.daysSpent + fork!.daysRemaining).toBe(daysAsked);
            expect(fork!.stoppedOnDay).toBe(stoppedOnDay);
            const question = whatTheForkAsks(fork!, 'the visitor');
            expect(question).toContain(daysAsked === 365 ? '0.000685 years' : `${daysAsked - daysSpent} days`);
        } finally {
            h.db.close();
        }
    });
}
