/**
 * Two engine lines, one screen, flatly opposed - with the killer standing over
 * the body.
 *
 * FOUND BY PLAYING BLIND, into a death. The player picked a fight with somebody
 * stronger and kept swinging until it finished them. The last screen said both
 * of these:
 *
 *     The world has it written down, as a small thing. 8 people were there.
 *
 *     Nobody was there. What Meng Si was carrying is at Cloud Gate, where they
 *     fell: 30 spirit stones.
 *
 * Neither is the narrator's. Both are engine-authored lines in the same turn.
 *
 * ── THE CAUSE ENUM CANNOT ANSWER THE QUESTION IT WAS ASKED ───────────────
 *
 * `somebodyDidThis(cause)` decides who ends up with what was on the body, and
 * its ruling is right: *being in the same town when somebody starves is not
 * standing over them; killing them is.* It returns true for `combat_defeat`
 * alone.
 *
 * The death was `obviously_fatal_choice`, and that value has TWO producers.
 * `evaluateDeathConditions` returns it for forcing a fight while barely able to
 * stand - which is emphatically somebody's doing, and is what happened here -
 * and `alchemy-manage` uses it for a pill detonating in your hands, which is
 * nobody's. One enum value, two deaths, and no way to tell them apart from the
 * cause.
 *
 * The caller has the evidence the enum lacks: whether a fight was standing. It
 * could not read it, because `fight` is cleared before a conclusion runs and
 * the estate settles after that - so the answer is recorded as the fight ends
 * and kept for the turn that produced it.
 *
 * ── AND THE FIELD THE SCHEMA CALLS AUTHORITATIVE ─────────────────────────
 *
 * Found on the same screen. The run came back `status: dead`, `deathCause:
 * obviously_fatal_choice`, `alive: false` - and `existenceState: 'alive'`.
 *
 * `CultivatorSchema` says which to believe, in as many words: *`existenceState`
 * is AUTHORITATIVE: when the two could disagree, trust the state.* `markDead`
 * is the only thing in the game that ends a cultivator, and it moved the
 * convenience boolean and left the authoritative field saying they were alive.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { makeGame } from './harness';
import { somebodyDidThis } from '../../src/engine/world/estate-at-death';

let adminBefore: string | undefined;
beforeAll(() => {
    adminBefore = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
});
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

describe('the cause enum, on its own', () => {
    /**
     * PINNED AS THE REASON THE CALLER CANNOT USE IT ALONE. If a later change
     * makes `obviously_fatal_choice` mean only one of its two deaths, this is
     * where somebody finds out that the caller's extra evidence became
     * redundant.
     */
    it('says a fatal choice was nobody in particular', () => {
        expect(somebodyDidThis('combat_defeat')).toBe(true);
        expect(somebodyDidThis('obviously_fatal_choice')).toBe(false);
        expect(somebodyDidThis('starvation')).toBe(false);
        expect(somebodyDidThis('lifespan_exhausted')).toBe(false);
    });
});

describe('what death writes on the row', () => {
    /**
     * PLAYED, because the defect was in the one function that ends a run and a
     * unit test of the schema would have passed against it all along.
     */
    it('moves the authoritative field and not only the convenience one', async () => {
        const { game, db, repos } = makeGame({ adminMode: true, seed: 'a-death' });
        const { cultivator } = await game.newRun('Shen Yuan');
        // Straight at the one function that ends a cultivator, because that is
        // what the defect was in and every play route reaches it.
        repos.cultivators.markDead(cultivator.id, 'combat_defeat', 1, 'Cut down at the ford.');

        const row = db
            .prepare('SELECT alive, existence_state, death_cause FROM cultivators WHERE id = ?')
            .get(cultivator.id) as {
                alive: number;
                existence_state: string;
                death_cause: string | null;
            };
        expect(row.death_cause).toBe('combat_defeat');
        expect(row.alive).toBe(0);
        // The one the schema tells every reader to trust.
        expect(row.existence_state).toBe('physically_dead');
    }, 120_000);
});
