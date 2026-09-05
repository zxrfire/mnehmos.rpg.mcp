/**
 * Letting somebody go, played, and what it leaves behind.
 *
 * ── WHY THIS TEST AND NOT "SPARING WORKS" ────────────────────────────────
 *
 * AGENTS.md's epigraph: heaven does not reward a good act. A mercy mechanic
 * that ends a fight and leaves nothing is the engine handing out an opinion -
 * it says the spared person goes away, which is the one thing this genre never
 * does. So the assertions here are about the COST and the exposure, not about
 * the act succeeding:
 *
 *   - offering mercy to somebody still fighting spends the round and buys
 *     nothing;
 *   - sparing somebody leaves them ALIVE, which is the whole of the risk;
 *   - the grave grudge `seedObligations` has always opened for
 *     `humiliation` - *"beaten and deliberately let go"* - is opened and is
 *     not softened for the sparing;
 *   - and the FAVOUR side, which nothing anywhere produced before, is written
 *     through the one pricer.
 *
 * Both seeds are pinned - the run seed and the world seed - because a played
 * test that pins one is pinning a coincidence.
 */

import { describe, expect, it } from 'vitest';

import { npcsAt } from '../../src/engine/world/world-state';
import { bodyTaken, maxBodyOf } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/web/entities';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';

import { makeGameInWorld } from './harness';

const names = (r: { toolCalls: Array<{ name: string }> }) => r.toolCalls.map(c => c.name);

/**
 * Somebody standing here, worn down to `share` of what their rung buys them.
 *
 * The same instrument `a-fight-you-can-answer.test.ts` uses to prove an
 * opponent is met worn rather than whole, pointed at arranging a fight the
 * player is winning. Nothing about the fight itself is arranged.
 */
async function somebodyAlreadyBeaten(game: any, share: number) {
    const world = await game.loadWorld();
    const where = game.state().cultivator.location;
    const place = worldLocationFor(world, where);
    const people = place ? npcsAt(world, place.id) : [];
    // The lowest rung standing here, so the gap does not settle it before a
    // round is thrown.
    const them = [...people]
        .sort((a, b) => a.cultivation.realmOrdinal - b.cultivation.realmOrdinal)[0];
    if (!them) return null;

    const day = Math.floor(world.currentDay);
    const whole = maxBodyOf(them);
    const worn = bodyTaken(them, Math.floor(whole * (1 - share)), day);
    world.npcs[world.npcs.findIndex((n: any) => n.id === them.id)] = worn;
    return worn;
}

describe('mercy is a decision with a price on it', () => {
    /**
     * The half that is easy to get wrong, and the one that would make mercy
     * free. Somebody who is still standing and still coming has nothing to be
     * spared FROM, so the offer is a round spent on your guard while they
     * swing - which is a real cost paid for a real choice, and not a penalty.
     */
    it('costs a round when they have not finished with you', async () => {
        const { game } = await makeGameInWorld({ seed: 'mercy-early', worldSeed: 'w-mercy-early' });
        await game.newRun('Duellist');
        await game.act('I look around');
        await somebodyAlreadyBeaten(game, 1);

        const opened = await game.act('I attack someone of my own rank');
        expect(names(opened)).toContain('combat.round');

        const offered = await game.act('I spare him');

        // The fight did NOT end - they were nowhere near beaten.
        expect(names(offered)).not.toContain('combat_manage.resolve');
        expect(names(offered)).toContain('combat.round');
        // And the round was spent. The line says why nothing came of it, and
        // it is on the PROSE rather than only in the log: a cost a player
        // cannot see is not being charged.
        expect(offered.narration).toMatch(/is not beaten, so there is nothing yet to spare/);
    }, 180_000);

    /**
     * The half the whole task was about.
     *
     * `parseIntent` reached a verb for 15 of 20 of the genre's TAKING tropes
     * and 3 of 10 of its GIVING ones, and `I spare him` was one of the seven
     * that reached nothing at all - inside a fight and out of one - while
     * `combat.ts` had carried the ending the whole time.
     */
    it('leaves them alive, owing you, and holding what was done to them', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'mercy-late', worldSeed: 'w-mercy-late'
        });
        await game.newRun('Duellist');
        await game.act('I look around');

        // Worn, but not so worn that `theGapDecidesItAlone` settles it before a
        // round is thrown - a one-sided beating is not a fight and is not held
        // open, which is correct and is not this test's subject.
        const them = await somebodyAlreadyBeaten(game, 0.6);
        expect(them, 'nobody was standing here to fight').not.toBeNull();

        const opened = await game.act('I attack someone of my own rank');
        expect(names(opened), opened.narration).toContain('combat.round');

        let ended: any = null;
        for (let round = 0; round < 8 && ended === null; round++) {
            const answer = await game.act('I spare him');
            if (names(answer).includes('combat_manage.resolve')) ended = answer;
            // A fight that got away from us is not this test's subject.
            if (!game.state().cultivator.alive) break;
        }
        expect(ended, 'the fight never ended in a sparing').not.toBeNull();

        // ── THEY ARE ALIVE, WHICH IS THE ENTIRE RISK ─────────────────────
        const after = await game.loadWorld();
        const survivor = after.npcs.find((n: any) => n.id === them!.id);
        expect(survivor.status).toBe('alive');

        // ── AND BOTH SIDES OF THE ACCOUNT ARE OPEN ───────────────────────
        //
        // The player's row is the one this build can read from either end, and
        // `ledgerAbout` returns everything they hold and everything held about
        // them.
        const player = game.state().cultivator;
        const ledger = ledgerAbout(db as never, player.id);

        const favour = ledger.find(row =>
            row.kind === 'favor' && row.holderId === player.id && row.cause === 'spared');
        expect(
            favour,
            `no favour was opened. ledger: ${ledger.map(r =>
                `${r.kind}/${r.cause} ${r.holderId}->${r.subjectId}`).join('; ')}`
        ).toBeDefined();

        // The grudge is NOT softened for the sparing and must never be. The
        // engine's own words for this ending are "beaten and deliberately let
        // go", and `seedObligations` has always answered it with a grave
        // grudge held BY the loser ABOUT the winner.
        const grudge = ledger.find(row =>
            row.kind === 'grudge' && row.holderId === them!.id && row.subjectId === player.id);
        expect(
            grudge,
            `the spared party holds nothing. ledger: ${ledger.map(r =>
                `${r.kind}/${r.cause}/${r.severity} ${r.holderId}->${r.subjectId}`).join('; ')}`
        ).toBeDefined();
        expect(grudge!.severity).toBe('grave');
        expect(grudge!.status).toBe('open');

        // ── AND THE PLAYER IS TOLD, RATHER THAN LEFT TO FIND OUT ─────────
        expect(ended.narration).toMatch(/alive and owes you for it/);
        expect(ended.narration).toMatch(/not the same as being forgiven/);
    }, 180_000);
});
