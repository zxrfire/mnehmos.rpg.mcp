/**
 * A ruling that names a price names the remainder too.
 *
 * Played: the engine ruled *"bought for 8 spirit stones"*, the narration said
 * *"leaving you with eight spirit stones"*, and the purse held **16**. The model
 * reached for a number the facts did not carry and used the price as the
 * balance.
 *
 * That is one of the four failures whose output-side check was written,
 * measured and withdrawn on the design owner's ruling that this class is fixed
 * in what the turn TELLS the narrator - "a price and a balance assigned the
 * wrong way round" is named in `narrator.ts` by that exact description. This is
 * that fix rather than a fifth checker: there is no number to invent when the
 * number is there.
 *
 * ── WHERE THE GAP WAS, AND WHY IT WAS THE WORSE BRANCH ───────────────────
 *
 * Every other money ruling already states the balance - a stall purchase says
 * "6 spirit stones of the 30 you had, and the copy is yours. 24 left", a
 * provisioning says "22 left in the purse", a sale says "N in the purse now",
 * an inventory read says it outright. Swept, and only one did not.
 *
 * Provisioning for a stretch of seclusion printed the remainder ONLY on the
 * branch where the food covered the whole stretch. On the SHORT branch - where
 * somebody is about to run out and most needs to know whether they can afford
 * more - it stated a price and stopped.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import type { LLMProvider } from '../../src/agent/provider/types';

function recording(seen: string[], plan: Record<string, unknown>): LLMProvider {
    return {
        name: 'recording',
        async call(req: { messages: Array<{ role: string; content: string }> }) {
            const user = req.messages.find(m => m.role === 'user')?.content ?? '';
            const isIntent = user.includes('Respond with the JSON object only');
            if (!isIntent) seen.push(user);
            return { text: isIntent ? JSON.stringify(plan) : 'PROSE.' };
        }
    } as unknown as LLMProvider;
}

/** The facts block phase 3 was handed, with nothing else around it. */
function ruledIn(seen: string[]): string {
    const block = seen[seen.length - 1] ?? '';
    const from = block.indexOf('WHAT THE ENGINE RULED');
    const to = block.indexOf('\n\nWrite two');
    return from === -1 ? '' : block.slice(from, to === -1 ? undefined : to);
}

/**
 * A method, written straight onto the row.
 *
 * A cultivator practising nothing has the stretch refused before a single
 * ration is bought - "365 days were refused before anything was spent: no
 * provisioning" - so the provisioning line this file is about never runs.
 * Buying a copy is not enough either: owning a manual and practising it are
 * separate facts by design.
 */
function practising(db: import('better-sqlite3').Database, id: string): void {
    db.prepare('UPDATE cultivators SET known_techniques = ? WHERE id = ?')
        .run(JSON.stringify(['lesser-qi-gathering-manual']), id);
}

describe('a ruling that names a price names the balance', () => {
    /**
     * The demonstrated branch: a stretch the purse cannot feed.
     *
     * Asked for long enough that the food runs short whatever the run rolled,
     * so the assertion does not depend on a particular starting purse - which
     * is what makes this a guard rather than a fixture.
     */
    it('says what is left even when the food does not cover the stretch', async () => {
        const seen: string[] = [];
        const { db, game } = await makeGameInWorld({
            worldSeed: 'a-price-is-not-a-balance',
            provider: recording(seen, { action: 'seclude', days: 3650 })
        });
        const { cultivator } = await game.newRun('Mo Qianshu');
        practising(db, cultivator.id);

        await game.act('I go into closed-door seclusion for ten years');
        const ruled = ruledIn(seen);
        const after = await game.state();

        // The short branch is the one under test. If a future change makes ten
        // years affordable this stops testing anything, so it is asserted.
        expect(ruled, 'the stretch was fully provisioned; pick a longer one')
            .toMatch(/food for about/i);

        // The balance is stated, and it is the real one.
        expect(ruled).toMatch(/stones left/i);
        expect(ruled).toContain(`${after.cultivator!.spiritStones} stones left`);
    }, 120_000);

    /**
     * The branch that already worked, kept so the fix cannot be "both branches
     * now say the same wrong thing".
     */
    it('still says what is left when the food does cover it', async () => {
        const seen: string[] = [];
        const { db, game } = await makeGameInWorld({
            worldSeed: 'a-price-is-not-a-balance',
            provider: recording(seen, { action: 'seclude', days: 30 })
        });
        const { cultivator } = await game.newRun('Mo Qianshu');
        practising(db, cultivator.id);

        await game.act('I go into seclusion for a month');
        const ruled = ruledIn(seen);
        const after = await game.state();

        expect(ruled).toContain(`${after.cultivator!.spiritStones} stones left`);
    }, 120_000);

    /**
     * The sweep behind the fix, so the claim "only one ruling was missing it"
     * is checked rather than asserted in a comment. Each of these is a money
     * ruling reachable from an ordinary sentence.
     */
    it('every money ruling states the balance it leaves', async () => {
        const cases: Array<[string, Record<string, unknown>, string]> = [
            ['stall purchase', { action: 'buy', target: 'Lesser Qi-Gathering Manual' }, 'I buy the Lesser Qi-Gathering Manual'],
            ['provisioning', { action: 'provision' }, 'I buy a month of rations'],
            ['inventory', { action: 'inventory' }, 'what am I carrying'],
            ['market read', { action: 'market' }, 'what is for sale']
        ];

        for (const [label, plan, said] of cases) {
            const seen: string[] = [];
            const { game } = await makeGameInWorld({
                worldSeed: 'a-price-is-not-a-balance',
                provider: recording(seen, plan)
            });
            await game.newRun('Mo Qianshu');
            await game.act(said);

            const ruled = ruledIn(seen);
            const after = await game.state();
            // The number itself has to appear. A model that is given it does not
            // have to derive it, which is the whole mechanism.
            expect(ruled, `${label} named no balance`)
                .toContain(String(after.cultivator!.spiritStones));
        }
    }, 300_000);
});
