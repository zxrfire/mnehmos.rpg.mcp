/**
 * A bill of nought has three different reasons, and the picker used to print
 * one sentence for all of them.
 *
 * ── WHAT WENT WRONG ──────────────────────────────────────────────────────
 *
 * `whatFeedingThisStretchCosts` returns `hungerHasStopped` for a cultivator
 * from Deity Transformation up: `SATIETY_BURN_BY_REALM` is zero there, nothing
 * is bought, nothing comes off the pack, and `covered` is the whole stretch.
 * The picker branched on `p.cost === 0` and then on `p.wanted === 0`, so a
 * forty-year sitting was told **"Short enough that you can eat before you sit.
 * Nothing to buy."** - which is a true bill attached to a false reason. Seen on
 * a served build at ordinal 44.
 *
 * The neighbour was worse. An empty purse also costs nought, so it fell into
 * the same branch and printed **"Nothing to buy; your 1 spirit stones stay
 * where they are"** - and because that branch returned early, the starvation
 * warning underneath it never rendered at all. Ten years asked for, fifty days
 * of belly, and the screen said nothing was wrong.
 *
 * So the three are separated by what the plan actually says:
 *
 * | reason | the plan | what it is |
 * |---|---|---|
 * | the body has stopped taking meals | `hungerHasStopped` | good news, ends it |
 * | the pack already holds the stretch | `cost === 0 && short === 0` | good news, ends it |
 * | the purse will not reach a ration | `toBuy === 0 && short > 0` | starvation |
 *
 * ── WHY THIS TEST IS A SOURCE SLICE ──────────────────────────────────────
 *
 * `web/app.js` is a browser asset with no module boundary, so there is nothing
 * to import. This evaluates the shipped source text of `pickerFoodHtml` and the
 * `FOOD` cache it reads, which means it tests the bytes the page actually
 * serves rather than a copy that can drift. Same approach as
 * `the-ground-panel-says-what-it-measured.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { makeGame, startHttp } from './harness';
import {
    whatFeedingThisStretchCosts,
    type ProvisioningPlan
} from '../../src/web/what-feeding-a-stretch-of-seclusion-costs';

const APP = fileURLToPath(new URL('../../web/app.js', import.meta.url));

/**
 * The picker block as the page defines it, over the `FOOD` cache it reads.
 *
 * `mortalClocks`, `untreatedCount` and the sheet state are stubbed rather than
 * sliced: the warnings they feed are somebody else's subject, and a stub that
 * produces none of them leaves exactly the two things this file is about.
 */
function loadPicker(): {
    FOOD: { days: number | null; plan: unknown; error: string | null };
    S: { cultivator: { satiety?: number }; derived: Record<string, unknown> };
    pickerFoodHtml: (days: number) => { value: string };
    pickerWarnings: (days: number) => string[];
} {
    const src = readFileSync(APP, 'utf8');

    const helpersEnd = src.indexOf('\nfunction titleise');
    expect(helpersEnd, 'the helper block at the head of app.js has moved').toBeGreaterThan(0);

    const start = src.indexOf('const FOOD = {');
    expect(start, 'the FOOD quote cache has been renamed or removed').toBeGreaterThan(0);
    const end = src.indexOf('\nfunction pickerBody', start);
    expect(end, 'pickerBody no longer follows the picker block').toBeGreaterThan(start);

    const stubs = `
        const S = { cultivator: {}, derived: {} };
        function mortalClocks() {
            return { age: 0, lifeLeft: NaN, stag: 0, stagLimit: NaN, pressureFrom: NaN, pressure: 0 };
        }
        function untreatedCount() { return 0; }
        function fmtSignedPct(v) { return String(v); }
    `;

    return new Function(
        `${src.slice(0, helpersEnd)}\n${stubs}\n${src.slice(start, end)}\n`
        + 'return { FOOD, S, pickerFoodHtml, pickerWarnings };'
    )();
}

const { FOOD, S, pickerFoodHtml, pickerWarnings } = loadPicker();

/** The rendered bill as flat text, which is what a player reads. */
function billText(plan: ProvisioningPlan): string {
    FOOD.error = null;
    FOOD.plan = plan;
    FOOD.days = plan.days;
    return String(pickerFoodHtml(plan.days).value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Every plan below comes out of the engine's own function rather than being
// written by hand, so a fixture cannot quietly describe a state the engine
// never produces. Ordinal 30 is Void Refinement; 0 is Qi Condensation.
const FORTY_YEARS = 14_600;
const TEN_YEARS = 3_650;

const stopped = whatFeedingThisStretchCosts(
    { satiety: 100, spiritStones: 1000, realmOrdinal: 30 }, 0, FORTY_YEARS
);
const packCoversIt = whatFeedingThisStretchCosts(
    { satiety: 100, spiritStones: 54, realmOrdinal: 0 }, 4, 150
);
const nothingAffordable = whatFeedingThisStretchCosts(
    { satiety: 100, spiritStones: 1, realmOrdinal: 0 }, 0, TEN_YEARS
);
const someInThePack = whatFeedingThisStretchCosts(
    { satiety: 100, spiritStones: 1, realmOrdinal: 0 }, 5, TEN_YEARS
);
const wholePurse = whatFeedingThisStretchCosts(
    { satiety: 100, spiritStones: 54, realmOrdinal: 0 }, 0, TEN_YEARS
);

describe('the seclusion picker, when the bill comes to nothing', () => {
    it('says the body has stopped taking meals, not that the stretch is short', () => {
        expect(stopped.hungerHasStopped, 'the fixture is the case under test').toBe(true);

        const text = billText(stopped);
        expect(text).toContain('the body has stopped taking meals');
        expect(text).toContain('the pantry is not what stands between you and the far end of this');
        expect(text).not.toContain('Short enough that you can eat before you sit');
    });

    it('does not price forty years differently from a week', () => {
        const week = whatFeedingThisStretchCosts(
            { satiety: 100, spiritStones: 1000, realmOrdinal: 30 }, 0, 7
        );
        expect(billText(week)).toBe(billText(stopped));
    });

    it('stays close to the sentence the engine prints when it charges nothing', () => {
        // `GameService.buyProvisions` prints the engine-side half of this after
        // the stones are not spent. One fact, one wording - the shared clause is
        // asserted verbatim on both sides, so the door and the cave cannot drift
        // into two answers to one question.
        const clause =
            'At this rung the body has stopped taking meals, and the pantry is not what '
            + 'stands between you and the far end of this.';

        expect(billText(stopped)).toContain(clause);

        // `turn-engine.ts` splits the sentence over three concatenated literals, so the
        // joins come out before the whitespace is flattened. Asserted as a
        // boolean because the file is 25,000 lines and a failed `toContain`
        // prints all of it.
        const engineSide = readFileSync(
            fileURLToPath(new URL('../../src/web/turn-engine.ts', import.meta.url)), 'utf8'
        ).replace(/\s+/g, ' ').replace(/' \+ '/g, '');
        expect(
            engineSide.includes(clause),
            'buyProvisions no longer prints this sentence - the two have drifted'
        ).toBe(true);
    });

    it('still says the pack covered it when the pack covered it', () => {
        expect(packCoversIt.cost).toBe(0);
        expect(packCoversIt.short).toBe(0);

        const text = billText(packCoversIt);
        expect(text).toContain('already in your pack');
        expect(text).toContain('stay where they are');
        expect(text).not.toContain('stopped taking meals');
    });
});

/**
 * The neighbouring branch. An empty purse costs nothing too, and that is the
 * one reading of a zero bill that ends in a death.
 */
describe('the seclusion picker, when the purse will not reach the food', () => {
    it('does not call it nothing to buy', () => {
        expect(nothingAffordable.cost).toBe(0);
        expect(nothingAffordable.toBuy).toBe(0);
        expect(nothingAffordable.short).toBeGreaterThan(0);

        const text = billText(nothingAffordable);
        expect(text).not.toContain('Nothing to buy');
        expect(text).not.toContain('stay where they are');
        expect(text).toContain('will not buy');
    });

    it('prints the starvation warning the early return used to swallow', () => {
        expect(nothingAffordable.coversTheWholeStretch).toBe(false);
        expect(billText(nothingAffordable)).toContain('five turns later it is fatal');
        expect(billText(someInThePack)).toContain('five turns later it is fatal');
    });

    it('counts what the pack holds without implying it covers the stretch', () => {
        const text = billText(someInThePack);
        expect(someInThePack.carried).toBe(5);
        expect(text).toContain('5 already in your pack');
        expect(text).toContain(`the other ${someInThePack.short}`);
    });

    it('leaves the ordinary purchase exactly as it was', () => {
        const text = billText(wholePurse);
        expect(wholePurse.toBuy).toBeGreaterThan(0);
        expect(text).toContain('more bought at the door for');
        expect(text).toContain('the purse will not stretch to');
        expect(text).toContain('of everything you have');
    });
});

/**
 * The same fact, one warning over. A frozen low belly is not a clock.
 *
 * Satiety stops moving at the rung where hunger stops, so a cultivator who
 * crossed on an empty stomach keeps that number for the rest of their life.
 * The picker warned them, on every stretch, that this is how runs end - a
 * starvation warning for a death the engine cannot deal them.
 */
describe('the low-belly warning in the picker', () => {
    const warningsWith = (satiety: number, plan: ProvisioningPlan | null, days: number) => {
        S.cultivator = { satiety };
        S.derived = {};
        FOOD.plan = plan;
        FOOD.days = plan ? plan.days : null;
        return pickerWarnings(days);
    };

    const belly = /empty stomach/;

    it('still warns somebody who eats', () => {
        expect(warningsWith(10, nothingAffordable, TEN_YEARS).join(' ')).toMatch(belly);
    });

    it('does not warn somebody whose body has stopped taking meals', () => {
        expect(warningsWith(10, stopped, FORTY_YEARS).join(' ')).not.toMatch(belly);
    });

    it('warns while the quote is still in flight, rather than guessing', () => {
        // Suppressed only on a positive no. An absent or stale plan leaves the
        // warning standing, because the alternative is silence about a real
        // clock on the strength of a race.
        expect(warningsWith(10, null, TEN_YEARS).join(' ')).toMatch(belly);
        S.cultivator = { satiety: 10 };
        FOOD.plan = stopped;
        FOOD.days = FORTY_YEARS;
        expect(pickerWarnings(TEN_YEARS).join(' '), 'a quote for another stretch').toMatch(belly);
    });
});

/**
 * The field has to reach the browser, or the branch above is dead.
 *
 * Asserted over the wire through the real app rather than off the function,
 * because `/api/seclusion/provisions` is the only route by which the picker
 * ever learns any of this.
 */
describe('the served payload', () => {
    it('carries hungerHasStopped, on both sides of the line', async () => {
        const h = makeGame();
        const opened = await h.game.newRun('Shen Wuyou');
        const http = await startHttp(h.game);
        try {
            const eats = await http.get(`/api/seclusion/provisions?days=${TEN_YEARS}`);
            expect(eats.status).toBe(200);
            expect(eats.body.hungerHasStopped).toBe(false);

            h.repos.cultivators.update(opened.cultivator.id, { realmOrdinal: 30 } as never);
            const doesNot = await http.get(`/api/seclusion/provisions?days=${FORTY_YEARS}`);
            expect(doesNot.status).toBe(200);
            expect(doesNot.body.hungerHasStopped).toBe(true);
            expect(doesNot.body.wanted).toBe(0);
        } finally {
            await http.close();
        }
    });
});

/**
 * The offline mock has to agree about the SHAPE, or the client is being
 * exercised against a world that does not exist. Its scenario buttons put the
 * cultivator at ordinals 41 and 44, which is squarely above the line.
 */
describe('the offline mock', () => {
    it('sends hungerHasStopped as well', () => {
        const mock = readFileSync(
            fileURLToPath(new URL('../../web/mock-api.js', import.meta.url)), 'utf8'
        );
        const provisions = mock.slice(
            mock.indexOf('function provisionsFor'),
            mock.indexOf('/* ───────────────────────────── router')
        );
        expect(provisions).toContain('hungerHasStopped: true');
        expect(provisions).toContain('hungerHasStopped: false');
    });
});
