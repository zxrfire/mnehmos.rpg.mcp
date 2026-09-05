/**
 * 护法, played: standing over somebody else's crossing.
 *
 * ── WHAT THIS IS THE FIX FOR ─────────────────────────────────────────────
 *
 * `src/engine/cultivation/standing-guard-over-somebody-elses-crossing.ts` is
 * complete - the weight a protector contributes, the standing the arrangement
 * needs, what the vigil costs the person keeping it - and had **no caller
 * anywhere in `src/`**. `BreakthroughContext.protection` was written for it and
 * nothing ever supplied one. `shielded_crossing` was already a `FavorCause` and
 * nothing ever produced one.
 *
 * A module nothing calls is not a feature, so what is asserted here is that a
 * person typing at the game reaches it: the refusals, the arrangement, the
 * crossing, and the account it opens. Every path goes through `game.act`.
 *
 * Both seeds are pinned. A played test that pins one is pinning a coincidence.
 */

import { describe, expect, it } from 'vitest';

import { npcsAt } from '../../src/engine/world/world-state';
import { upsertRelationship } from '../../src/engine/world/npc-state';
import {
    guideOrdinalFor,
    readyToStrike
} from '../../src/engine/world/an-npc-striking-at-the-next-wall';
import { BOOKLESS_CEILING, reachableCeilingFor } from '../../src/engine/world/manuals';
import { groundRateAt } from '../../src/engine/world/the-ground-somebody-is-actually-standing-on';
import { TIE_MUST_PREDATE_BY_DAYS } from '../../src/engine/cultivation/standing-guard-over-somebody-elses-crossing';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { worldLocationFor } from '../../src/web/entities';
import { makeGameInWorld } from './harness';

const names = (r: { toolCalls: Array<{ name: string }> }) => r.toolCalls.map(c => c.name);
const summaries = (r: { toolCalls: Array<{ summary: string }> }) =>
    r.toolCalls.map(c => c.summary).join(' || ');

function whereTheyAre(game: any) {
    return game.state().cultivator.location;
}

/** Everybody standing where the player is standing, off the world. */
async function peopleHere(game: any) {
    const world = await game.loadWorld();
    const place = worldLocationFor(world, whereTheyAre(game));
    return { world, people: place ? npcsAt(world, place.id) : [] };
}

/**
 * Somebody here who is genuinely at their wall, with an old tie to the player.
 *
 * The readiness is READ rather than arranged - `readyToStrike` is the world's
 * own arithmetic and a quarter of the living population clears it on any given
 * day (measured over three pinned worlds: 108, 103 and 98 of ~437 alive). What
 * is arranged is the TIE, because a fresh run has none and the module's whole
 * argument is that the arrangement is made between people already bound by
 * something older than it.
 */
async function somebodyAtTheirWall(game: any, standing: number) {
    const world = await game.loadWorld();
    const here = worldLocationFor(world, whereTheyAre(game));
    if (!here) return null;
    const day = Math.floor(world.currentDay);
    const byId = new Map(world.npcs.map((n: any) => [n.id, n]));
    const player = game.state().cultivator;

    // Readiness is read on the ground they would be standing on, because that
    // is what the verb reads. Somebody ready in a rich chamber is not
    // necessarily ready in this square, and taking their old answer would be
    // arranging a state the game cannot produce.
    const conditionsHere = (npc: any) => ({
        ambient: here.ambient ?? 'normal',
        rateMultiplier: groundRateAt(here) ?? 1,
        guideOrdinal: guideOrdinalFor(npc, byId as any),
        manualCeiling: reachableCeilingFor(world, npc) || BOOKLESS_CEILING
    });

    for (const candidate of world.npcs) {
        if (candidate.status !== 'alive' || candidate.id === player.id) continue;
        if (!readyToStrike(candidate, day, conditionsHere(candidate)).ready) continue;

        // Two preconditions arranged and nothing else: they are standing here,
        // and the two of you go back a long way. The crossing, its odds, the
        // vigil and the account are all left to the engine.
        const moved = { ...candidate, locationId: here.id };
        const tied = upsertRelationship(moved, {
            targetId: player.id,
            targetName: player.name,
            kind: 'ally',
            standing,
            note: 'Known each other a long time.'
        }, day - TIE_MUST_PREDATE_BY_DAYS - 1);
        world.npcs[world.npcs.findIndex((n: any) => n.id === candidate.id)] = tied;
        return tied;
    }
    return null;
}

describe('standing guard over somebody else\'s crossing', () => {
    /**
     * The free half. A player who cannot see who WOULD stand has no way to tell
     * a mechanic that is closed to them from one that does not exist, and the
     * arrangement is refused far more often than it is made.
     */
    it('answers who would keep a watch, and spends nothing doing it', async () => {
        const { game } = await makeGameInWorld({ seed: 'guard-ask', worldSeed: 'w-guard-ask' });
        await game.newRun('Warden');
        const before = game.state().run.elapsedDays;

        const ask = await game.act('who would stand guard for me');

        expect(names(ask)).toContain('engine.readState');
        // The read answers the question that was asked rather than deflecting
        // into a roster or the weather. Either half of the answer is the
        // answer; a fresh run almost always gets the second.
        expect(ask.narration).toMatch(
            /would stand over your crossing|A protector is the only defence a crossing has/
        );
        expect(game.state().run.elapsedDays).toBe(before);
    }, 180_000);

    /**
     * The refusal, and the reason it is the interesting output.
     *
     * `DAO_PROTECTOR.theBetrayal` says declining to guard somebody is an
     * ordinary, expected, sayable thing. A fresh run holds no ties, so this is
     * what almost every player meets first, and it has to name the fact that
     * would change it rather than restating that it failed.
     */
    it('refuses a stranger, and says what the arrangement would take', async () => {
        const { game } = await makeGameInWorld({ seed: 'guard-no', worldSeed: 'w-guard-no' });
        await game.newRun('Warden');
        await game.act('I look around');
        const { people } = await peopleHere(game);
        const before = game.state().run.elapsedDays;

        const refused = await game.act(`I stand guard while ${people[0].name} crosses`);

        expect(summaries(refused)).toMatch(/wouldStandGuard: reason=/);
        expect(summaries(refused)).toMatch(/Nothing spent/);
        expect(refused.narration).toMatch(/would not (let you|put their crossing in your hands)|too far below/);
        expect(game.state().run.elapsedDays).toBe(before);
    }, 180_000);

    /**
     * And the act itself: the arrangement, the crossing, the vigil and the
     * account. This is the assertion that the module is wired rather than
     * merely present.
     */
    it('stands the watch, folds it into their odds, and opens the account', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'guard-yes', worldSeed: 'w-guard-yes'
        });
        await game.newRun('Warden');
        await game.act('I look around');

        // Somebody who would die for you. The module's bar rises with what is
        // being risked and this is above it at every rung it can reach.
        const them = await somebodyAtTheirWall(game, 0.95);
        expect(them, 'nobody standing here was at their wall').not.toBeNull();

        const before = game.state().run.elapsedDays;
        const stood = await game.act(
            `I stand guard while ${them!.name} crosses, for a hundred days`
        );

        const said = summaries(stood);
        // ── THE MODULE IS REACHED, AND IT IS THE ONE THAT DECIDED ────────
        expect(names(stood)).toContain('engine.wouldStandGuard');
        expect(names(stood)).toContain('engine.protectionBonus');
        expect(names(stood)).toContain('engine.strikeAtTheWall');
        expect(names(stood)).toContain('engine.resolveVigil');
        expect(said).toMatch(/willing at standing 0\.95/);

        // ── AND THE WATCH IS IN THEIR ODDS RATHER THAN BESIDE THEM ───────
        //
        // `protectionBonus` is folded by `strikeAtTheWall` through
        // `BreakthroughContext.protection`, which is the field that module's
        // own header names as its integration point and which nothing had ever
        // supplied.
        expect(said).toMatch(/points on the crossing/);
        expect(said).toMatch(/Folded by strikeAtTheWall, not by this file/);

        // ── THE SPAN WAS ACTUALLY SPENT ──────────────────────────────────
        expect(game.state().run.elapsedDays).toBeGreaterThan(before);

        // ── AND THE ACCOUNT IT OPENS IS WRITTEN, NOT DESCRIBED ───────────
        //
        // Priced by `whatADeedLeaves` at `paidBy: 'actor'`, which is what makes
        // it a favour rather than a grudge, and written through the same
        // `createObligation` a killing goes through.
        const player = game.state().cultivator;
        const ledger = ledgerAbout(db as never, player.id);
        const favour = ledger.find(row =>
            row.kind === 'favor' && row.cause === 'shielded_crossing');
        expect(
            favour,
            `no account was opened. ledger: ${ledger.map(r =>
                `${r.kind}/${r.cause} ${r.holderId}->${r.subjectId}`).join('; ')}`
        ).toBeDefined();
        expect(favour!.holderId).toBe(player.id);
        expect(favour!.subjectId).toBe(them!.id);
    }, 180_000);

    /**
     * WHAT IT COSTS, WHICH IS THE HALF THAT KEEPS IT HONEST.
     *
     * The giving half of the verb surface must not be safer than the taking
     * half. `resolveVigil` rolls one wound per protector against
     * `VIGIL_RISK_AT_FULL_EXPOSURE x whatArrivesAt x vigilExposure`, and this
     * asserts the roll is real and is on the SEEDED stream rather than being
     * decorative - the same watch, twice, costs the same thing.
     */
    it('prices the wound off the exposure, and prices it the same way twice', async () => {
        const run = async () => {
            const { game } = await makeGameInWorld({
                seed: 'guard-cost', worldSeed: 'w-guard-cost'
            });
            await game.newRun('Warden');
            await game.act('I look around');
            const them = await somebodyAtTheirWall(game, 0.95);
            if (!them) return null;
            const stood = await game.act(`I stand guard while ${them.name} crosses`);
            return summaries(stood).match(
                /wound chance ([\d.]+)% at severity (\w+) over (\d+) days; (\d+) taken/
            );
        };

        const first = await run();
        expect(first, 'nobody standing here was at their wall').not.toBeNull();
        // A real chance rather than a nominal one.
        expect(Number(first![1])).toBeGreaterThan(0);
        // The default span, taken from the verb rather than invented by the
        // engine module, which refuses to name a length for a crossing.
        expect(Number(first![3])).toBe(30);

        const second = await run();
        expect(second![0]).toBe(first![0]);
    }, 300_000);
});
