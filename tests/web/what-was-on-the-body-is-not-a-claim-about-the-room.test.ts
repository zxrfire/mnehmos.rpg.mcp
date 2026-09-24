/**
 * "Nobody was there", over a death three people were present for.
 *
 * FOUND BY PLAYING. The player died in front of the man who raised them; he was
 * holding their head, and two others were standing in the room. The engine
 * printed:
 *
 *     Nobody was there. What Shen Wuyou was carrying is at Willow Village,
 *     where they fell: 30 spirit stones.
 *
 * The same shape as `eight-people-were-there-and-nobody-was`, which settled who
 * ENDS UP with what was on the body. This is the sentence, which kept claiming
 * something it is not in a position to know.
 *
 * ── AND `standingOver` IS NOT THE ROOM ───────────────────────────────────
 *
 * It is who is entitled to go through the body, and `settleTheEstateInside`
 * passes an empty list for a death nobody did - so eight people can be standing
 * there and the list still be empty. A line that reads it as the room is
 * reading a different question's answer, which is exactly how a death somebody
 * watched came back as an empty one.
 *
 * What the line says now is what happened to what was on the body. That is the
 * one thing it knows.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';
import { settleWhatTheyWereCarrying } from '../../src/web/estate-settlement';
import { LegacyLedger } from '../../src/web/leaving-things-for-the-next-life';

/** A death with something on the body, settled with the list the caller gives. */
async function whatTheEngineSaid(
    seed: string,
    standingOver: readonly { id: string; name: string }[]
): Promise<string> {
    const { db, game, repos } = makeGame({ seed, adminMode: true });
    const { cultivator } = await game.newRun('Shen Wuyou');
    // Something to still be there afterwards, or the branch under test is not
    // the branch that runs.
    db.prepare('UPDATE cultivators SET spirit_stones = 30 WHERE id = ?').run(cultivator.id);
    repos.cultivators.markDead(cultivator.id, 'combat_defeat', 1, 'Struck down.');

    const settled = settleWhatTheyWereCarrying({
        db,
        world: null,
        ledger: new LegacyLedger(db),
        cultivator: repos.cultivators.getById(cultivator.id)!,
        runId: game.state().run.id,
        causeNote: 'Struck down.',
        standingOver
    });
    return settled.facts.lines.join(' ');
}

describe('what was on the body', () => {
    /**
     * THE PLAYED LINE. An empty list is the case the player met - a death the
     * cause says nobody did - and it is the one that claimed the room.
     */
    it('says what happened to it rather than who was there', async () => {
        const said = await whatTheEngineSaid('estate-room-alone', []);
        expect(said).not.toMatch(/nobody was there/i);
        expect(said).toMatch(/nobody went through it/i);
        expect(said).toContain('30 spirit stones');
    }, 120_000);

    /**
     * AND SOMEBODY ENTITLED TO IT STILL TAKES IT, unchanged. This is the other
     * half of the same sentence and the branch the earlier fix was about: a
     * rewording of the one below it must not quietly empty the one above.
     */
    it('still says who went through it where somebody did', async () => {
        const said = await whatTheEngineSaid('estate-room-taken', [
            { id: 'npc-two', name: 'Lu Nuoming' }
        ]);
        expect(said).toContain('Lu Nuoming');
        expect(said).not.toMatch(/nobody went through it/i);
    }, 120_000);
});
