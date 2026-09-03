/**
 * A refused crossing says what is missing, and names a way to get it.
 *
 * `refusalText` is the one wording for an ineligible breakthrough - the sheet's
 * `breakthroughBlockedReason` and the refusal the `breakthrough` verb hands back
 * both come out of it, on purpose, so a disabled control and a typed attempt
 * cannot disagree. Its switch had a case for four of the six reasons
 * `canAttemptBreakthrough` produces, and the other two fell to a default that
 * reads like a sentence and says nothing: "The engine refused the attempt."
 *
 * Both of the missing ones are load-bearing:
 *
 *   insufficient_dao   the gate on the upper half of the ladder. Found by
 *                      playing: ordinal 40, accumulator filled to the last
 *                      qi-unit through ADMIN, attempt refused with eleven words
 *                      that named no bar, no figure and no route - and
 *                      `what is stopping me` did not name it either, because
 *                      `GateKind` has no member for it.
 *   barred:<status>    a cracked structure refusing the next REALM crossing.
 *                      The rungs inside the realm are still open, which is the
 *                      whole of what somebody in that state needs to be told,
 *                      and the shrug told them nothing.
 *
 * The bar for these is the one AGENTS.md sets for every tier including the
 * bottom one: a refusal names a route. The engine already holds every fact
 * needed - `daoRequired` and `daoHeld` are on the same `EligibilityCheck` - so
 * nothing here is computed, and the played case below is the witness that the
 * plumbing reaches the surface rather than only the unit call.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { refusalText } from '../../src/web/view';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
async function withAdmin<T>(fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

describe('a refused crossing names what is missing', () => {
    it('the dao gate is named, counted, and routed - played, not stubbed', async () => {
        await withAdmin(async () => {
            const { game } = await makeGameInWorld({ seed: 'dao-gate', worldSeed: 'crossing-refusals' });
            await game.newRun('Reacher');

            // Ordinal 40 is a realm boundary that asks for roads, and a run that
            // has never left the opening turn has walked none. Filling the
            // accumulator is what isolates the dao gate: with the qi short, the
            // engine reports the qi first and this case is unreachable.
            await game.act('ADMIN set_realm ordinal=40');
            await game.act('ADMIN grant_progress fill=true');

            const state = game.state();
            expect(state.cultivator.cultivationProgress).toBe(state.derived.progressRequired);

            const result = await game.act('I attempt the breakthrough');

            // The claim is about what the player is told, so it is asserted on
            // the narration and on the sheet - the two places the sentence
            // surfaces - rather than on the engine call's own summary.
            expect(result.narration).not.toMatch(/The engine refused the attempt/);
            expect(result.narration).toMatch(/understanding/i);
            expect(result.narration).toMatch(/roads besides your own/);
            // The route: things a player can actually type.
            expect(result.narration).toMatch(/arts you could learn/i);
            expect(result.narration).toMatch(/who would teach you/i);

            // The SHEET carries the two figures as well as the route, because
            // `view.ts` hands the whole eligibility check through. The verb's
            // own refusal in `game.ts` still calls the three-argument form and
            // so prints the route without the counts - the sentences agree on
            // what is missing and differ only in whether they quote it, which
            // is the state this landed in and is recorded here rather than
            // asserted away. `game.ts` is another agent's file this session.
            const sheet = game.state().derived.breakthroughBlockedReason ?? '';
            expect(sheet).not.toMatch(/The engine refused the attempt/);
            expect(sheet).toMatch(/asks for \d+ roads? besides your own/);
            expect(sheet).toMatch(/you have walked \d+/);

            // Nothing moved. A refusal is not an attempt.
            expect(game.state().cultivator.realmOrdinal).toBe(40);
        });
    }, 120000);

    it('a cracked structure names the realm boundary and leaves the rungs open', () => {
        const line = refusalText('barred:cracked-core', 100, 100);

        expect(line).not.toBe('The engine refused the attempt.');
        // The break is named the way the engine's own key names it.
        expect(line).toContain('cracked core');
        // And the half that is the actual route: the realm boundary is shut and
        // the rungs inside it are not.
        expect(line).toMatch(/rungs inside this realm are still open/i);
        expect(line).toMatch(/realm boundary/i);
        expect(line).toMatch(/structural repair/i);
    });

    it('the Lid keeps its own sentence and is not read as a structural break', () => {
        // `barred:the_lid_opened_once` shares the prefix and is a different
        // fact. Reading it as a broken structure would tell a False Immortal
        // their core was cracked.
        expect(refusalText('barred:the_lid_opened_once', 0, null))
            .toMatch(/The Lid does not open twice/);
    });

    it('the dao sentence still names a route when the counts are not passed', () => {
        // The three-argument form is what the callers that have not been
        // migrated use. It loses the figures and must not lose the route.
        const line = refusalText('insufficient_dao', 100, 100);
        expect(line).not.toBe('The engine refused the attempt.');
        expect(line).toMatch(/roads besides your own/);
        expect(line).toMatch(/who would teach you/i);
    });

    it('an unknown reason still falls to the shrug, and only then', () => {
        // The default is not being removed - a reason code nobody has written a
        // sentence for should read as unhandled rather than as something else.
        expect(refusalText('some_reason_nobody_has_written', 0, 0))
            .toBe('The engine refused the attempt.');
    });
});
