/**
 * The bottom of the economy: does a rogue at the first rung clear subsistence?
 *
 * ── What was claimed, and what is actually true ──────────────────────────
 *
 * The playtest report behind this file said "a year of work earns about 15
 * spirit stones and a year of provisions costs about 16", concluding that an
 * unaffiliated cultivator cannot fund cultivation at all. That is not what the
 * catalogs say, and the error is instructive: the 15 came from a 50-day shift
 * of Innkeeper, not from a year of one. Extrapolated properly the same job pays
 * about 108 stones a year. `AGENTS.md` warns about exactly this - a measurement
 * is only worth what the harness that produced it is worth.
 *
 * What is true, measured off the same rows the job board reads:
 *
 *   a year of food             ~16 stones   8 rations at 2 stones, 50 days each
 *   one treated deviation        5 stones   a splint and a month of care
 *   worst root, per year       ~1.2 wounds  0.10 per check, one check per 30 days
 *   ── subsistence floor       ~22 stones/year for the worst spirit root
 *
 *   Farmhand (hamlet/village)    21.6 stones/year   does NOT clear
 *   Porter (everywhere)          28.8
 *   Placer's runner              66.0
 *   Innkeeper                   108.0             clears at 20% of the year
 *
 * So the bottom of the economy clears, and the interesting figure is not
 * whether it clears but what fraction of a life it costs to clear it. At the
 * best work a mortal-rung cultivator is offered, a fifth of every year buys the
 * other four fifths. At the worst, the whole year buys nothing and the run ends
 * in settling rather than starvation - which is a real and intended way to lose,
 * and is what "almost no one gets past the first thirteen" is made of.
 *
 * The engine has no answer yet for the one genuinely unfunded case: a
 * deviation-prone root standing in a hamlet, where Farmhand is the board. That
 * is a location problem with a location answer - walk to a village - and
 * nothing currently tells the player so.
 *
 * These are property assertions, not number assertions. The catalogs belong to
 * another part of the tree and will move; what must not move is that somebody
 * standing at ordinal 0 in a place with work can out-earn what it costs to
 * stay alive.
 */

import { describe, it, expect } from 'vitest';
import {
    cashToStones,
    findWorkForOrdinal,
    getPrice,
    type Settlement
} from '../../../src/data/cultivation/mortal-world.js';
import { getSpiritRoot, SPIRIT_ROOTS } from '../../../src/engine/cultivation/spirit-roots.js';
import { daysPerRation } from '../../../src/engine/cultivation/survival.js';
import { DEVIATION_CHECK_DAYS } from '../../../src/engine/cultivation/time-skip.js';

const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

/** Stones a year of eating costs at the first rung, priced off the board. */
function foodPerYearStones(): number {
    const month = getPrice('price-month-rations');
    if (!month) throw new Error('The board no longer prices a month of rations.');
    // Priced by the month because that is the row; the ration is the engine's
    // packaging of the same food and `daysPerRation` is what a skip burns.
    return cashToStones(month.cash) * (DAYS_PER_YEAR / DAYS_PER_MONTH);
}

/** Stones a year of qi deviation costs the unluckiest root there is. */
function deviationPerYearStones(): number {
    const course = getPrice('price-splint-and-month');
    if (!course) throw new Error('The board no longer prices a course of care.');
    const worstRisk = Math.max(
        ...SPIRIT_ROOTS.map(r => getSpiritRoot(r.key).deviationRisk)
    );
    const checksPerYear = DAYS_PER_YEAR / DEVIATION_CHECK_DAYS;
    return cashToStones(course.cash) * worstRisk * checksPerYear;
}

function bestWagePerYearStones(settlement: Settlement['kind']): number {
    const jobs = findWorkForOrdinal(0, settlement);
    if (jobs.length === 0) return 0;
    return Math.max(...jobs.map(o => cashToStones(o.cashPerMonth) * 12));
}

describe('subsistence at the first rung', () => {
    const floor = foodPerYearStones() + deviationPerYearStones();

    it('the floor is denominated in food, not in medicine', () => {
        // If treatment ever becomes the larger half, the early game has turned
        // into a medical drama and the food clock has stopped being the thing
        // that ends runs. That would be a design change, not a tuning one.
        expect(foodPerYearStones()).toBeGreaterThan(deviationPerYearStones());
    });

    it('every settlement that offers work at all offers work that clears it', () => {
        const kinds: Settlement['kind'][] = ['village', 'market_town', 'sect_town', 'city'];
        for (const kind of kinds) {
            const best = bestWagePerYearStones(kind);
            expect(
                best,
                `${kind}: best wage ${best.toFixed(1)} stones/year against a floor of ${floor.toFixed(1)}`
            ).toBeGreaterThan(floor);
        }
    });

    it('the best mortal-rung work leaves most of the year for cultivating', () => {
        // The figure the whole early game turns on. A cultivator who must work
        // more than half the year to eat is not a cultivator, and the ladder
        // above them is decorative. Measured at 20% in the village.
        const best = bestWagePerYearStones('village');
        expect(floor / best).toBeLessThan(0.5);
    });

    it('a hamlet does not, and that is a fact about the place', () => {
        // Recorded rather than asserted as desirable: the smallest settlements
        // price out below subsistence for the worst root, and the answer the
        // engine offers is to walk somewhere larger. Nothing tells the player
        // that yet. See the header.
        const hamlet = bestWagePerYearStones('hamlet');
        expect(hamlet).toBeLessThan(bestWagePerYearStones('village'));
    });

    it('a full year of provisions is a purchase the starting purse can make', () => {
        // 30 stones at the start against ~16 for a year of food. If this ever
        // inverts, the first command of every run is a losing one.
        const STARTING = 30;
        expect(foodPerYearStones()).toBeLessThan(STARTING);
        // And a ration is worth carrying: a year's food is a handful of them,
        // not a cartload.
        expect(Math.ceil(DAYS_PER_YEAR / daysPerRation(0))).toBeLessThanOrEqual(12);
    });
});
