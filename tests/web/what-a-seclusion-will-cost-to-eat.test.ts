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

import { makeGame, startHttp } from './harness';
import {
    whatFeedingThisStretchCosts,
    PROVISION_COST_STONES,
    A_PURCHASE_BIG_ENOUGH_TO_ASK_ABOUT
} from '../../src/web/what-feeding-a-stretch-of-seclusion-costs';
import { ACTIONS_PER_FULL_SATIETY } from '../../src/engine/cultivation/survival';

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
