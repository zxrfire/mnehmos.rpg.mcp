/**
 * The food bill for a seclusion, quoted before the player commits to it.
 *
 * Filed from a played run: a cultivator entered seclusion with 54 spirit
 * stones and came out with none, and read about it afterwards - "1 ration came
 * out of the pack, and 27 more was bought for 54 spirit stones". The mechanic
 * is right and nothing here changes it. What changed is the ORDER: the figure
 * is now available at the door.
 *
 * The load-bearing assertion in this file is the last one. A preview is only
 * worth anything if it is the same arithmetic as the charge, so the test does
 * both and compares the purse.
 */

import { describe, it, expect } from 'vitest';

import { makeGame, makeGameInWorld, startHttp } from './harness';
import {
    whatFeedingThisStretchCosts,
    PROVISION_COST_STONES,
    A_PURCHASE_BIG_ENOUGH_TO_ASK_ABOUT
} from '../../src/web/what-feeding-a-stretch-of-seclusion-costs';
import { ACTIONS_PER_FULL_SATIETY } from '../../src/engine/cultivation/survival';
import { SATIETY_MAX } from '../../src/schema/cultivation';

describe('what feeding a stretch costs', () => {
    const full = { satiety: 100, spiritStones: 54 };

    it('charges nothing for a stretch the pack already covers', () => {
        const plan = whatFeedingThisStretchCosts(full, 4, ACTIONS_PER_FULL_SATIETY * 3);
        expect(plan.carried).toBe(3);
        expect(plan.toBuy).toBe(0);
        expect(plan.cost).toBe(0);
        expect(plan.stonesAfter).toBe(54);
        expect(plan.worthAsking).toBe(false);
    });

    it('takes what is in the pack first and buys only the shortfall', () => {
        const plan = whatFeedingThisStretchCosts(full, 1, ACTIONS_PER_FULL_SATIETY * 5);
        expect(plan.wanted).toBe(5);
        expect(plan.carried).toBe(1);
        expect(plan.toBuy).toBe(4);
        expect(plan.cost).toBe(4 * PROVISION_COST_STONES);
        expect(plan.stonesAfter).toBe(54 - 4 * PROVISION_COST_STONES);
    });

    it('reports the shortfall the purse will not stretch to', () => {
        const plan = whatFeedingThisStretchCosts({ satiety: 100, spiritStones: 4 }, 0, 3650);
        expect(plan.toBuy).toBe(2);
        expect(plan.cost).toBe(4);
        expect(plan.stonesAfter).toBe(0);
        expect(plan.short).toBeGreaterThan(0);
        expect(plan.coversTheWholeStretch).toBe(false);
    });

    it('flags a purchase that takes most of the purse, and not one that does not', () => {
        // The whole purse. This is the case the defect was filed against.
        const all = whatFeedingThisStretchCosts({ satiety: 100, spiritStones: 54 }, 0, 3650);
        expect(all.shareOfThePurse).toBe(1);
        expect(all.worthAsking).toBe(true);

        // A year out of a healthy purse. No extra click: the figure in the
        // picker is enough, and asking every time is the tedium the fix was
        // told not to add.
        const ordinary = whatFeedingThisStretchCosts({ satiety: 100, spiritStones: 400 }, 0, 365);
        expect(ordinary.cost).toBeGreaterThan(0);
        expect(ordinary.shareOfThePurse).toBeLessThan(A_PURCHASE_BIG_ENOUGH_TO_ASK_ABOUT);
        expect(ordinary.worthAsking).toBe(false);
    });
});

describe('played', () => {
    it('quotes the same figure the seclusion then charges', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Shen Wuyou');

        const days = 750;
        const quoted = game.provisionsForAStretch(days);
        expect(quoted.cost).toBeGreaterThan(0);

        // `anyway` because a cultivator with no manual is refused a stretch
        // that returns nothing, which is a different and correct gate. The
        // food is bought either way, and the food is what this is about.
        const result = await game.cultivate(days, { anyway: true });

        expect(result.state.cultivator.spiritStones).toBe(quoted.stonesAfter);
    });

    it('is a read - asking what a stretch costs spends nothing', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Shen Wuyou');

        const before = game.state();
        game.provisionsForAStretch(365);
        game.provisionsForAStretch(3650);
        const after = game.state();

        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
        expect(after.cultivator.satiety).toBe(before.cultivator.satiety);
    });

    /**
     * ── THE READER THAT TAKES THE MONEY DID NOT KNOW HIGH REALMS DO NOT EAT ──
     *
     * `SATIETY_BURN_BY_REALM` is zero from Deity Transformation up, and
     * `assessProvisioning` has always handled that. This path did not: it
     * divided the stretch by `ACTIONS_PER_FULL_SATIETY` flat, so a Void
     * Refinement cultivator was billed 730 stones for a year of rations she
     * cannot open, and an empty purse got her a starvation warning for a death
     * that cannot occur.
     *
     * Both arms are played, at one ordinal either side of the line, and both
     * assert state - stones, satiety, the starvation counter - rather than
     * prose.
     */
    const WORLD = 'the-pantry-is-not-the-wall';
    const TEN_YEARS = 3650;

    it('sells a cultivator who still eats the food for the stretch', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'below-the-line' });
        const opened = await h.game.newRun('Shen Wuyou');
        // Qi Condensation: one full belly is 50 days, and the flat rate the
        // module uses below the line is exactly right here.
        h.repos.cultivators.update(opened.cultivator.id, {
            realmOrdinal: 0, spiritStones: 1000
        } as never);

        const quoted = h.game.provisionsForAStretch(TEN_YEARS);
        expect(quoted.hungerHasStopped, 'she eats').toBe(false);
        expect(quoted.wanted).toBe(TEN_YEARS / ACTIONS_PER_FULL_SATIETY);
        expect(quoted.cost).toBe(quoted.wanted * PROVISION_COST_STONES);

        const before = h.game.state().cultivator.spiritStones;
        const result = await h.game.cultivate(TEN_YEARS, { anyway: true });
        const after = result.state.cultivator;
        // Food is bought for the span actually LIVED, which an encounter can
        // cut short - so the bill is re-derived from what the skip was handed
        // rather than from the ten years asked for.
        const ts = result.timeSkip!;
        const rations = Math.ceil(ts.requestedDays / ACTIONS_PER_FULL_SATIETY);
        expect(rations).toBeGreaterThan(0);
        expect(after.spiritStones, 'the purse paid for every ration')
            .toBe(before - rations * PROVISION_COST_STONES + ts.deltas.spiritStones);
        // And the belly did what a belly does.
        expect(after.satiety).toBeLessThan(SATIETY_MAX);
    }, 120_000);

    it('sells a cultivator who has stopped eating nothing at all', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'above-the-line' });
        const opened = await h.game.newRun('Shen Wuyou');
        // Void Refinement. `SATIETY_BURN_BY_REALM.void_refinement` is 0.
        h.repos.cultivators.update(opened.cultivator.id, {
            realmOrdinal: 30, spiritStones: 1000
        } as never);

        const quoted = h.game.provisionsForAStretch(TEN_YEARS);
        expect(quoted.hungerHasStopped, 'she does not').toBe(true);
        // Not "cheap" - there is no purchase. The old arithmetic wanted 73
        // rations and 146 stones for this same stretch.
        expect(quoted.wanted).toBe(0);
        expect(quoted.cost).toBe(0);
        expect(quoted.coversTheWholeStretch).toBe(true);
        expect(quoted.covered).toBe(TEN_YEARS);
        expect(quoted.worthAsking).toBe(false);

        const before = h.game.state().cultivator.spiritStones;
        const result = await h.game.cultivate(TEN_YEARS, { anyway: true });
        const after = result.state.cultivator;

        // Not one stone taken for food - the whole purse survives the decade,
        // net of whatever the skip itself earned or spent. The belly never
        // moved either, which is why the starvation warning this used to print
        // was a warning about something that cannot happen.
        const ts = result.timeSkip!;
        expect(ts.requestedDays, 'the whole stretch was provisioned for').toBe(TEN_YEARS);
        expect(after.spiritStones).toBe(before + ts.deltas.spiritStones);
        expect(after.satiety).toBe(SATIETY_MAX);
        expect(after.starvationTurns).toBe(0);
        expect(after.alive, 'and hunger did not end her').toBe(true);
    }, 120_000);

    /**
     * The state the fix had to keep telling apart. An empty purse below the
     * line is still a real shortfall and still ends in starvation - the branch
     * added above must not swallow it.
     */
    it('still warns the cultivator who eats and cannot pay', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'nothing-affordable' });
        const opened = await h.game.newRun('Shen Wuyou');
        h.repos.cultivators.update(opened.cultivator.id, {
            realmOrdinal: 0, spiritStones: 0
        } as never);

        const quoted = h.game.provisionsForAStretch(TEN_YEARS);
        expect(quoted.hungerHasStopped, 'nothing affordable is not nothing to buy').toBe(false);
        expect(quoted.wanted).toBeGreaterThan(0);
        expect(quoted.toBuy).toBe(0);
        expect(quoted.short).toBe(quoted.wanted);
        expect(quoted.coversTheWholeStretch).toBe(false);
        // The belly alone, and no more.
        expect(quoted.covered).toBe(ACTIONS_PER_FULL_SATIETY);
    }, 120_000);

    it('is served over HTTP for the picker to read', async () => {
        const http = await startHttp(makeGame({ worldEnabled: true }).game);
        try {
            await http.post('/api/run/new', { name: 'Shen Wuyou' });
            const res = await http.get('/api/seclusion/provisions?days=365');
            expect(res.status).toBe(200);
            expect(res.body.days).toBe(365);
            expect(typeof res.body.cost).toBe('number');
            expect(typeof res.body.worthAsking).toBe('boolean');
        } finally {
            await http.close();
        }
    });
});
