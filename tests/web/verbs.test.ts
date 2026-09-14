/**
 * The verbs that turn a spreadsheet back into a life.
 *
 * Every case here was measured as BROKEN by hand-play before it was written:
 * an engine function that was complete, tested and reachable from no sentence
 * anybody could type. The tests are design guards rather than coverage - each
 * one asserts that a specific path from plain English to a database write
 * still exists, because every one of them was severed at some point and
 * nothing caught it.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGame, planned, engineCalls } from './harness';
import { addToPouch, listPouch } from '../../src/server/consolidated/cultivation-support';
import { HERBS } from '../../src/data/cultivation/herbs';
import { quoteSale, BUYER_MARGIN } from '../../src/engine/cultivation/market';
import { ACTIONS_PER_FULL_SATIETY } from '../../src/engine/cultivation/survival';

/** A cheap herb that exists in the catalog, for putting in a pouch. */
const HERB = HERBS.reduce((best, herb) => (herb.value < best.value ? herb : best));

describe('selling, which is the only way a pouch becomes a purse', () => {
    it('reads "I sell a <herb>" as a sale and not as a person', () => {
        const plan = parseIntent(`I sell a ${HERB.name}.`);
        expect(plan.action).toBe('sell');
        // The whole defect this verb exists to fix: before it, the sentence
        // reached the INTERACT table and the engine went looking for somebody
        // by that name.
        expect(plan.target?.toLowerCase()).toContain(HERB.name.split(' ')[0].toLowerCase());
    });

    it('reads a bare "I sell my herbs" with no target, which prices the whole pouch', () => {
        const plan = parseIntent('I sell my herbs.');
        expect(plan.action).toBe('sell');
    });

    it('still lets a question about the board reach the board', () => {
        expect(parseIntent('what is for sale here?').action).toBe('market');
        expect(parseIntent('what are the prices here?').action).toBe('market');
    });

    it('turns a pouch into stones, in one transaction', async () => {
        const { game, db } = makeGame({ seed: 'sell-seed' });
        const { cultivator } = await game.newRun('Lin Que');
        addToPouch(db, cultivator.id, HERB.id, 'herb', 3);

        const before = game.state().cultivator.spiritStones;
        const result = await game.act(`I sell a ${HERB.name}.`);

        expect(planned(result).summary).toContain('sell');
        const after = game.state().cultivator.spiritStones;
        expect(after).toBeGreaterThan(before);

        // The stock genuinely left the pouch. A sale that pays and does not
        // remove is the "prose looks like it worked" failure this whole sweep
        // is about.
        expect(listPouch(db, cultivator.id).find(row => row.itemId === HERB.id)).toBeUndefined();

        // And the number is the engine's, not this layer's.
        const quoted = quoteSale({
            item: HERB,
            listStones: HERB.value,
            quantity: 3,
            seller: { ordinal: game.state().cultivator.realmOrdinal }
        });
        expect(after - before).toBe(quoted.offeredStones);
    });

    it('pays less than list, because a buyer takes a margin', () => {
        const quote = quoteSale({
            item: HERB,
            listStones: 100,
            quantity: 1,
            seller: { ordinal: 0 }
        });
        expect(BUYER_MARGIN).toBeGreaterThan(0);
        expect(quote.offeredStones).toBeLessThan(100);
    });

    it('refuses a thing that is not in the pouch, and says what is', async () => {
        const { game, db } = makeGame({ seed: 'sell-refuse' });
        const { cultivator } = await game.newRun('Lin Que');
        addToPouch(db, cultivator.id, HERB.id, 'herb', 1);

        const result = await game.act('I sell the Nine Heavens Sundering Blade.');
        const call = engineCalls(result).find(c => c.action === 'sell');
        expect(call?.ok).toBe(false);
        expect(game.state().cultivator.spiritStones).toBe(
            (await makeGame({ seed: 'sell-refuse' }).game.newRun('Lin Que')).cultivator.spiritStones
        );
    });

    it('refuses an empty pouch without pretending anything happened', async () => {
        const { game } = makeGame({ seed: 'sell-empty' });
        await game.newRun('Lin Que');
        const before = game.state().cultivator.spiritStones;
        const result = await game.act('I sell my herbs.');
        expect(engineCalls(result).some(c => !c.ok)).toBe(true);
        expect(game.state().cultivator.spiritStones).toBe(before);
    });
});

describe('the pouch, asked about in words', () => {
    it('reads "what am I carrying" as an inventory read', () => {
        expect(parseIntent('what am I carrying?').action).toBe('inventory');
        expect(parseIntent('check my pouch').action).toBe('inventory');
    });

    it('names what is actually in it rather than the last-resort line', async () => {
        const { game, db } = makeGame({ seed: 'inv-seed' });
        const { cultivator } = await game.newRun('Lin Que');
        addToPouch(db, cultivator.id, HERB.id, 'herb', 2);

        const result = await game.act('what am I carrying?');
        expect(result.narration).toContain(HERB.name);
        // The sentence that was reaching players before any of this existed.
        expect(result.narration).not.toContain('Nothing about it drew attention');
    });

    it('passes no time', async () => {
        const { game } = makeGame({ seed: 'inv-free' });
        await game.newRun('Lin Que');
        const before = game.state().run.elapsedDays;
        await game.act('check my pouch');
        expect(game.state().run.elapsedDays).toBe(before);
    });
});

describe('the arts, listed and learned', () => {
    it('reads the question form as a listing and not as an attempt', () => {
        expect(parseIntent('what techniques can I learn?').action).toBe('list_techniques');
        expect(parseIntent('what arts can I learn?').action).toBe('list_techniques');
    });

    it('reads the act form as learning', () => {
        const plan = parseIntent('I learn the Azure Ripple Art.');
        expect(plan.action).toBe('learn_technique');
        expect(plan.target).toBeTruthy();
    });

    it('does not read practice as learning', () => {
        expect(parseIntent('I practise the Azure Ripple Art.').action).toBe('train_technique');
    });

    it('lists something a starting cultivator could take up', async () => {
        const { game } = makeGame({ seed: 'tech-seed' });
        await game.newRun('Lin Que');
        const result = await game.act('what arts can I learn?');
        expect(result.narration).not.toContain('Nothing about it drew attention');
        expect(engineCalls(result).every(c => c.ok)).toBe(true);
    });
});

describe('work, which is how somebody with no stones eats', () => {
    it('runs the whole span asked for rather than stopping at a full belly', async () => {
        const { game } = makeGame({ seed: 'work-seed' });
        await game.newRun('Lin Que');

        const result = await game.act('I work as a porter for a year.');
        const worked = engineCalls(result);
        expect(worked.length).toBeGreaterThan(0);

        // The measured defect: a year of work ran fifty days, because a full
        // belly is fifty days long and nobody was buying food. Anything past
        // one belly is the fix working.
        //
        // IT USED TO ASSERT `> 100` AND THAT WAS A COINCIDENCE. The span ends
        // at the first arrival that interrupts it, so the day count is a draw:
        // this seed gives 270 and `work-paid` gives 90 out of the same engine.
        // A hundred is not a rule anything states. One belly is, and it is the
        // number the defect was made of.
        expect(game.state().run.elapsedDays).toBeGreaterThan(ACTIONS_PER_FULL_SATIETY);
    });

    it('leaves the worker better off than they started', async () => {
        const { game } = makeGame({ seed: 'work-paid' });
        const { cultivator } = await game.newRun('Lin Que');
        const before = cultivator.spiritStones;
        await game.act('I work as a porter for a year.');
        const state = game.state();
        // Alive and richer. A year of labour that leaves somebody poorer than
        // a month of it is the thing that made players permanently broke.
        //
        // THE STATUS IS ON THE RUN AND NOT ON THE BODY. This read
        // `state().cultivator.status`, a field a cultivator has never carried,
        // so the guard was false on every run and the assertion inside it had
        // never once been evaluated. It was found when `tests/` was typechecked
        // for the first time, and the first time it ran it went red.
        //
        // ── WHAT IT CAUGHT ──────────────────────────────────────────────
        //
        // Measured by PLAYING the sentence below on five seeds, each from a
        // fresh run holding 30 stones. Board and purse, before then after:
        //
        //   work-paid   90 days   wage  7   board 16 -> 2    21 -> 35
        //   p1         135 days   wage 10   board 16 -> 4    24 -> 36
        //   p3         135 days   wage 10   board 16 -> 4    24 -> 36
        //   p2         240 days   wage 19   board 16 -> 8    33 -> 41
        //   work-seed  270 days   wage 21   board 16 -> 10   35 -> 41
        //
        // The board was 16 in every row and the wage was not, and that is the
        // whole defect. `handleWork` runs the span through the seclusion pass,
        // which takes its provisions up front because a cave has none - so a
        // year of work bought a year of dry rations on day one, an arrival cut
        // the span at ninety days, one ration was opened and the other seven
        // were thrown away. The wage was prorated to the days worked and the
        // board was prorated to nothing.
        //
        // The rate was never wrong: a porter earns 2.3 stones a month against
        // about 1 stone a month of food actually eaten.
        //
        // A YEAR IS STILL NOT A YEAR, and that part is deliberate. The span
        // stops at the first arrival that interrupts - see
        // `interruptedByAnArrival` - which is the turn being handed back. It
        // varies by seed, which is why the sibling test above no longer pins a
        // day count that happened to be drawn.
        //
        // Do not make this green by lowering the bar or by reinstating the
        // broken guard. It is measuring what it was written to measure.
        if (state.run.status === 'active') {
            expect(state.cultivator.spiritStones).toBeGreaterThan(before);
        }
    });
});

/**
 * The ladder consulted, and then obeyed.
 *
 * Measured across 21 positions x 47 asks and scored on database writes: the
 * treasury filed three or more DIFFERENT structured rulings by standing -
 * `not_a_member`, then "opens them at Dew Elder, and not before", then "Azure
 * Dew Sect keeps 54,864 spirit stones in reserve, and Dew Elder can sign for
 * them" - and at EVERY rank the verdict was `wrote: []`. The prose escalated
 * perfectly and nothing ever happened, which is worse than silence because it
 * looks like it worked.
 *
 * The cause was not the handler. `handleSiphon` writes whenever a pace is
 * named and reports the position when one is not, and the parser was reaching
 * the reporting branch for every sentence including "I steal the sect
 * treasury". These guard the separation.
 */
describe('the treasury, which was consulted and never obeyed', () => {
    it('reads a sentence about taking as an act, at the safest pace', () => {
        for (const text of [
            'I steal the sect treasury',
            'I rob the sect vault',
            'I siphon from the sect reserves',
            'I take the sect treasury and leave in the night'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('siphon');
            // Not "no pace". A pace is what makes the handler write, and the
            // default has to be the cheapest branch that is still the verb.
            expect(plan.topic, text).toBe('careful');
        }
    });

    it('still reads a question about the books as a look, which takes nothing', () => {
        for (const text of ['what do the sect reserves hold', 'I check the sect coffers']) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('siphon');
            expect(plan.topic, text).toBeUndefined();
        }
    });

    it('honours a named pace over the default', () => {
        expect(parseIntent('I empty the sect treasury').topic).toBe('greedy');
        expect(parseIntent('I quietly siphon from the reserves').topic).toBe('careful');
        expect(parseIntent('I skim from the sect coffers steadily').topic).toBe('steady');
    });
});
