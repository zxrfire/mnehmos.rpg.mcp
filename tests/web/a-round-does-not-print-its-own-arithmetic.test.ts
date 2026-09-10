/**
 * THE RULING HAD ONE HOME, AND IT WAS ADDRESSED TO THE MODEL.
 *
 * `narrationSystemPrompt` has said for a long time: *"Do not restate the numbers
 * as a list. Write it as prose. The interface already shows the arithmetic."*
 * Nothing on the engine side was ever checked against it, so the engine was free
 * to undo it - and did. A combat round marked both its own lines `required`, and
 * `withRequiredLines` appends a required line verbatim whenever the prose does
 * not already contain it. A narrator that OBEYED the ruling therefore never
 * contained them, so the block was appended every single time:
 *
 *     You land 8 on Road Bandit. Road Bandit lands 6 on you.
 *     You are on 36 of 50; Road Bandit is on 74 of 88. 6 rounds before neither
 *     of you can finish it. Breaking off gets you clear 39 times in a hundred...
 *
 * The better the narrator behaved, the more reliably a fight turn ended in a stat
 * block. Measured against a live model over three runs: every fight turn.
 *
 * The design owner's ruling, settling which side gives way: no HP bars in the
 * prose, and the engine result is debug data an operator reads. So the arithmetic
 * stays in `lines`, because a narrator cannot write an exchange without knowing
 * what the exchange did, and it goes to `structure`, which is what the tool-call
 * summary is built from.
 *
 * This is the ratchet on that. It asserts the CHANNEL rather than any wording, so
 * the lines are free to be rewritten and not free to move back into the prose.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { ProviderNarrator, DeterministicNarrator } from '../../src/web/narrator';

/** The shapes the prose must never carry. */
const BARS = /\b\d+\s+of\s+\d+\b/;
const ODDS = /times in a hundred/i;
const DAMAGE = /\blands?\s+\d+\s+on\b/i;

/** A narrator that obeys the ruling: prose, and not one numeral. */
const OBEDIENT = 'He takes the blow and gives back a heavier one. You are breathing short.';

async function aFightTurn(narrator: ProviderNarrator | DeterministicNarrator) {
    process.env.ADMIN_MODE = 'true';
    const { game } = await makeGameInWorld({
        worldSeed: 'arithmetic-channel', seed: 'arithmetic-channel',
        worldEnabled: true, adminMode: true, narrator
    });
    await game.newRun('Wen Qiu');
    await game.act('admin spawn_encounter ordinal=9 name=Road Bandit disposition=hostile');
    return await game.act('I attack Road Bandit');
}

describe('a round does not print its own arithmetic', () => {
    it('leaves the bars, the damage and the odds out of narrated prose', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"attack","target":"Road Bandit"}'],
            narrations: [OBEDIENT]
        });
        const acted = await aFightTurn(new ProviderNarrator(provider, { model: 'm', timeoutMs: 5000 }));

        // The narration is what it was written as, with nothing stapled to it.
        expect(acted.narration).not.toMatch(BARS);
        expect(acted.narration).not.toMatch(ODDS);
        expect(acted.narration).not.toMatch(DAMAGE);
        expect(acted.narration.trim()).toBe(OBEDIENT);
    });

    it('still hands the whole engine result to the operator', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"attack","target":"Road Bandit"}'],
            narrations: [OBEDIENT]
        });
        const acted = await aFightTurn(new ProviderNarrator(provider, { model: 'm', timeoutMs: 5000 }));

        // Dropped from the prose is not dropped. A round that cannot be read
        // back is a round nobody can debug.
        const round = acted.toolCalls.find(call => call.name === 'combat.round');
        expect(round, 'no combat.round call to read the arithmetic off').toBeDefined();
        expect(round!.summary).toMatch(BARS);
        expect(round!.summary).toMatch(ODDS);
        expect(round!.summary).toMatch(DAMAGE);
    });

    it('keeps the arithmetic in the engine\'s own account, where it IS the prose', async () => {
        // With no model there is no narrator to obey anything, and the
        // deterministic account is the only thing a player gets. Taking the
        // numbers out of THAT would be losing them rather than moving them.
        const acted = await aFightTurn(new DeterministicNarrator());
        expect(acted.narration).toMatch(BARS);
        expect(acted.narration).toMatch(DAMAGE);
    });
});
