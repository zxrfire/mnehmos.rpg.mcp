/**
 * A player begins something, runs out of material, comes back, and finishes it.
 *
 * `building-a-conveyance-out-of-what-a-hunt-brings-back.ts` was complete, live
 * and reachable only by houses. This is the player's side of it, so what is
 * asserted here is the whole of what makes it a feature rather than a module:
 * that the slip survives a turn, that what the report says went onto it really
 * left the pouch, and that the thing at the end is a row somebody holds.
 *
 * ── THE ONE THAT WOULD BE WORTH FAKING ───────────────────────────────────
 *
 * `materials the report claims are spent really leave the pouch` is the test
 * this file exists for. A craft verb that resolves instantly, or that reports
 * work the engine did not do, is worse than the current absence - so the
 * delivery, the pouch and the engine's own `spent` ledger are checked against
 * one another rather than any one of them being trusted.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';

import { makeGame } from './harness';
import {
    DAYS_AT_THE_BENCH,
    WHY_A_CORE_IS_NOT_YET_SPENDABLE,
    landTheBuild,
    lotsInThePouch,
    planTheBuild,
    readTheStocks,
    whichBillTheyMeant
} from '../../src/web/half-built-craft';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support';
import { getConveyanceRecipe, countedHoldingKey } from '../../src/data/cultivation/what-a-house-moves-its-people-on';
import type { Cultivator } from '../../src/schema/cultivation';

/** Ten mortal-grade pieces off ordinary animals: the drawn carriage's whole bill. */
const HIDE = 'mat-boar-hide';
const SINEW = 'mat-wolf-sinew';

async function aPlayerWithAPouch(seed: string, stock: Record<string, number> = {}) {
    const { db, game, repos } = makeGame({ seed });
    const { cultivator } = await game.newRun('Lin Baoqing');
    for (const [id, n] of Object.entries(stock)) {
        addToPouch(db, cultivator.id, id, 'herb', n);
    }
    const fresh = () => repos.cultivators.getById(cultivator.id) as Cultivator;
    return { db, game, repos, cultivator: fresh(), fresh };
}

const heldCarriages = (db: Database.Database, id: string) =>
    pouchQuantity(db, id, 'conv-carriage-mortal');

describe('which bill somebody meant', () => {
    it('reaches the four bills by the words a player would use', () => {
        expect(whichBillTheyMeant('a boat')?.id).toBe('build-spirit-boat');
        expect(whichBillTheyMeant('a boat from the hides I took')?.id).toBe('build-spirit-boat');
        expect(whichBillTheyMeant('a hull')?.id).toBe('build-spirit-boat');
        expect(whichBillTheyMeant('a cart')?.id).toBe('build-carriage-mortal');
        expect(whichBillTheyMeant('a carriage')?.id).toBe('build-carriage-mortal');
        expect(whichBillTheyMeant('a wagon')?.id).toBe('build-carriage-mortal');
    });

    /** The player must be able to type back what the game printed. */
    it('accepts the catalog names the listing prints', () => {
        expect(whichBillTheyMeant('A drawn carriage')?.id).toBe('build-carriage-mortal');
        expect(whichBillTheyMeant('a shod carriage')?.id).toBe('build-carriage-earth');
        expect(whichBillTheyMeant('a named carriage')?.id).toBe('build-carriage-heaven');
        expect(whichBillTheyMeant('a spirit boat')?.id).toBe('build-spirit-boat');
    });

    it('lifts a carriage onto a deeper bill when a grade word is present', () => {
        expect(whichBillTheyMeant('an earth-grade carriage')?.id).toBe('build-carriage-earth');
        expect(whichBillTheyMeant('a heaven grade cart')?.id).toBe('build-carriage-heaven');
    });

    it('is not a prose scanner', () => {
        expect(whichBillTheyMeant('a pill')).toBeNull();
        expect(whichBillTheyMeant('')).toBeNull();
        expect(whichBillTheyMeant('I build up my foundation')).toBeNull();
    });
});

describe('the sentence that started this', () => {
    /**
     * "I build a boat from the hides I took", by a nobody.
     *
     * The honest answer, and it is a refusal that names a route rather than a
     * wall: a hull is heaven-grade work, it wants Void Refinement, and here is
     * the bill this pair of hands could take today.
     */
    it('answers the boat with the rung it wants and a bill within reach', async () => {
        const { db, cultivator } = await aPlayerWithAPouch('boat-refusal', { [HIDE]: 6 });
        const plan = planTheBuild({
            db, cultivator, said: 'a boat from the hides I took', today: 1
        });

        expect(plan.kind).toBe('refused');
        const said = plan.lines.join(' ');
        expect(said).toContain('Void Refinement');
        expect(said).toContain('drawn carriage');
        expect(plan.structure.join(' ')).toContain('requires ordinal');
    });

    /** Anybody may attempt anything: the bar is a price, never a missing verb. */
    it('does not refuse the drawn carriage to somebody at the bottom of the ladder', async () => {
        const { db, cultivator } = await aPlayerWithAPouch('bottom-rung', { [HIDE]: 6, [SINEW]: 4 });
        expect(cultivator.realmOrdinal).toBe(0);
        expect(planTheBuild({ db, cultivator, said: 'a carriage', today: 1 }).kind).toBe('work');
    });
});

describe('beginning something, and coming back to it', () => {
    it('keeps a half-built carriage across turns and finishes it', async () => {
        const { db, fresh } = await aPlayerWithAPouch('one-carriage', { [HIDE]: 6, [SINEW]: 4 });
        const recipe = getConveyanceRecipe('build-carriage-mortal')!;

        // ── TURN ONE: lay the keel, put the pouch on the slip, work a month ──
        const first = planTheBuild({ db, cultivator: fresh(), said: 'a carriage', today: 1 });
        expect(first.kind).toBe('work');
        expect(first.daysToWork).toBe(DAYS_AT_THE_BENCH);
        const one = landTheBuild({
            db, cultivator: fresh(), plan: first, runSeed: 'one-carriage', today: 1,
            mooredAt: 'the yard behind the inn'
        });
        expect(one.slipCleared).toBe(false);

        // The materials really left the pouch, and exactly the ones claimed.
        expect(pouchQuantity(db, fresh().id, HIDE)).toBe(0);
        expect(pouchQuantity(db, fresh().id, SINEW)).toBe(0);

        // And the slip survived the turn with the work on it.
        const stocks = readTheStocks(db, fresh().id);
        expect(stocks).not.toBeNull();
        expect(stocks!.recipeId).toBe('build-carriage-mortal');
        expect(stocks!.workDaysDone).toBe(DAYS_AT_THE_BENCH);
        expect(stocks!.startedOnDay).toBe(1);

        // ── TURN TWO: back to it, and it finishes ────────────────────────
        const second = planTheBuild({ db, cultivator: fresh(), said: '', today: 40 });
        expect(second.kind).toBe('work');
        expect(second.recipe!.id).toBe('build-carriage-mortal');
        // Only the days that are left. The engine caps it, not this file.
        expect(second.daysToWork).toBe(recipe.workDays - DAYS_AT_THE_BENCH);

        const two = landTheBuild({
            db, cultivator: fresh(), plan: second, runSeed: 'one-carriage', today: 40,
            mooredAt: 'the yard behind the inn'
        });
        expect(two.slipCleared).toBe(true);
        expect(readTheStocks(db, fresh().id)).toBeNull();

        // A mortal carriage is a counted thing. There is no object to mint and
        // there must not be: `conveyanceKeptAs` decides the side of the line.
        expect(two.minted).toBeNull();
        expect(two.structure.join(' ')).toContain('launch(build-carriage-mortal)');

        const launched = two.lines.join(' ').includes('Everything that went into it');
        if (launched) {
            expect(heldCarriages(db, fresh().id)).toBe(1);
            expect(two.structure.join(' ')).toContain(countedHoldingKey('conv-carriage-mortal'));
        } else {
            // A failure consumes the materials and leaves nothing, which is the
            // honest price. What must never happen is a carriage appearing
            // anyway.
            expect(heldCarriages(db, fresh().id)).toBe(0);
        }
    }, 60_000);

    it('stalls on a short bill, keeps the slip, and resumes when the material arrives', async () => {
        const { db, fresh } = await aPlayerWithAPouch('short-bill', { [HIDE]: 4 });

        const stalled = planTheBuild({ db, cultivator: fresh(), said: 'a cart', today: 1 });
        // Four pieces against a bill of ten is 40% stocked, which buys 16 of the
        // 40 days. Work may run ahead of the materials that far and no further.
        expect(stalled.kind).toBe('work');
        landTheBuild({
            db, cultivator: fresh(), plan: stalled, runSeed: 'short-bill', today: 1,
            mooredAt: 'a yard'
        });
        expect(pouchQuantity(db, fresh().id, HIDE)).toBe(0);
        const afterOne = readTheStocks(db, fresh().id)!;
        expect(afterOne.workDaysDone).toBe(16);

        // Nothing left to do, and the engine says so rather than charging a day.
        const nothingToDo = planTheBuild({ db, cultivator: fresh(), said: '', today: 20 });
        expect(nothingToDo.kind).toBe('refused');
        expect(nothingToDo.lines.join(' ')).toContain('as far as the materials reach');
        expect(readTheStocks(db, fresh().id)!.workDaysDone).toBe(16);

        // Go and get the rest.
        addToPouch(db, fresh().id, SINEW, 'herb', 6);
        const resumed = planTheBuild({ db, cultivator: fresh(), said: '', today: 30 });
        expect(resumed.kind).toBe('work');
        landTheBuild({
            db, cultivator: fresh(), plan: resumed, runSeed: 'short-bill', today: 30,
            mooredAt: 'a yard'
        });
        // The bill is met and the slip is gone one way or the other.
        expect(readTheStocks(db, fresh().id)).toBeNull();
        expect(pouchQuantity(db, fresh().id, SINEW)).toBe(0);
    }, 60_000);

    it('will not put a second keel down beside the first', async () => {
        const { db, fresh } = await aPlayerWithAPouch('two-keels', { [HIDE]: 6, [SINEW]: 4 });
        const first = planTheBuild({ db, cultivator: fresh(), said: 'a cart', today: 1 });
        landTheBuild({
            db, cultivator: fresh(), plan: first, runSeed: 'two-keels', today: 1, mooredAt: 'a yard'
        });

        const second = planTheBuild({
            db, cultivator: fresh(), said: 'a shod carriage', today: 5
        });
        expect(second.kind).toBe('refused');
        expect(second.headline).toContain('already on the stocks');
        expect(second.lines.join(' ')).toContain('one slip');
        expect(readTheStocks(db, fresh().id)!.recipeId).toBe('build-carriage-mortal');
    }, 60_000);

    it('lets somebody break up what they started, and does not give the material back', async () => {
        const { db, fresh } = await aPlayerWithAPouch('abandon', { [HIDE]: 6, [SINEW]: 4 });
        const begun = planTheBuild({ db, cultivator: fresh(), said: 'a cart', today: 1 });
        landTheBuild({
            db, cultivator: fresh(), plan: begun, runSeed: 'abandon', today: 1, mooredAt: 'a yard'
        });

        const gone = planTheBuild({ db, cultivator: fresh(), said: 'I abandon the cart', today: 9 });
        expect(gone.kind).toBe('abandoned');
        expect(gone.headline).toContain('comes off the stocks');
        // The sentence and the act, together. A report of a cleared slip over a
        // slip that still stands is the exact thing this file is guarding.
        expect(readTheStocks(db, fresh().id)).toBeNull();
        // And nothing comes back. Everything worked into it stays worked in.
        expect(pouchQuantity(db, fresh().id, HIDE)).toBe(0);
        expect(pouchQuantity(db, fresh().id, SINEW)).toBe(0);

        // The yard is free again - the answer is now about the empty pouch
        // rather than about an occupied slip, and no phantom keel is written.
        const again = planTheBuild({ db, cultivator: fresh(), said: 'a cart', today: 10 });
        expect(again.kind).toBe('refused');
        expect(again.lines.join(' ')).toContain('as far as the materials reach');
        expect(readTheStocks(db, fresh().id)).toBeNull();
    }, 60_000);
});

describe('what a player may put into a hull', () => {
    /**
     * The line this module refuses to cross, pinned so it cannot be crossed
     * quietly. A core is a tracked object with a chain; nothing in this engine
     * retires such a thing into something else, and spending the pouch row
     * while the object stands in the ledger would be a report of an act that
     * did not happen.
     */
    it('does not deliver a tracked material, and says why', async () => {
        // Earth-grade plate and sinew, and three cores. The shod carriage's bill
        // is 16 + 8 at earth grade and one core, so the earth half is met and
        // the core is the only thing left.
        const { db, fresh } = await aPlayerWithAPouch('core-line', {
            'mat-tiger-fang': 16, 'mat-ox-horn': 8, 'mat-tiger-core': 3
        });
        const lots = lotsInThePouch(db, fresh().id);
        expect(lots.some(l => l.id === 'mat-tiger-core')).toBe(false);
        expect(lots.some(l => l.id === 'mat-tiger-fang')).toBe(true);

        // Lift them to Core Formation so the earth bill is theirs to work, and
        // the only thing standing between them and it is the core.
        db.prepare('UPDATE cultivators SET realm_ordinal = 21 WHERE id = ?').run(fresh().id);
        // Work it as far as it will go, which is 24 pieces of 25 - 96% of the
        // bill, and 144 of the 150 days. The last six days are behind the core.
        const plan = planTheBuild({
            db, cultivator: fresh(), said: 'a shod carriage', today: 1, days: 10_000
        });
        expect(plan.kind).toBe('work');
        landTheBuild({
            db, cultivator: fresh(), plan, runSeed: 'core-line', today: 1, mooredAt: 'a yard'
        });

        const stalled = planTheBuild({ db, cultivator: fresh(), said: '', today: 200 });
        expect(stalled.kind).toBe('refused');
        expect(stalled.lines.join(' ')).toContain(WHY_A_CORE_IS_NOT_YET_SPENDABLE);
        expect(pouchQuantity(db, fresh().id, 'mat-tiger-core')).toBe(3);
    }, 60_000);
});

describe('nothing is reported that did not happen', () => {
    it('spends out of the pouch exactly what the slip records as delivered', async () => {
        const { db, fresh } = await aPlayerWithAPouch('ledger', { [HIDE]: 9 });
        const plan = planTheBuild({ db, cultivator: fresh(), said: 'a carriage', today: 1 });
        expect(plan.kind).toBe('work');

        const claimed = Object.values(plan.toConsume ?? {}).reduce((n, v) => n + v, 0);
        landTheBuild({
            db, cultivator: fresh(), plan, runSeed: 'ledger', today: 1, mooredAt: 'a yard'
        });

        const left = pouchQuantity(db, fresh().id, HIDE);
        const onTheSlip = readTheStocks(db, fresh().id)!.delivered.reduce((n, v) => n + v, 0);
        expect(9 - left).toBe(claimed);
        expect(onTheSlip).toBe(claimed);
    }, 60_000);

    it('never works more days than the materials on the slip allow', async () => {
        const { db, fresh } = await aPlayerWithAPouch('no-running-ahead', { [HIDE]: 5 });
        const plan = planTheBuild({
            db, cultivator: fresh(), said: 'a carriage', today: 1, days: 10_000
        });
        expect(plan.kind).toBe('work');
        landTheBuild({
            db, cultivator: fresh(), plan, runSeed: 'no-running-ahead', today: 1, mooredAt: 'a yard'
        });
        // Half the bill is 20 of the 40 days, whatever was asked for.
        expect(readTheStocks(db, fresh().id)!.workDaysDone).toBe(20);
    }, 60_000);
});
