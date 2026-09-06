/**
 * A famine reaches the player, and it reaches food and lodging in opposite
 * directions.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * Two defects, one under the other.
 *
 * `AreaStatus` carried a single `priceMultiplier` over everything on sale, so a
 * failed harvest was a number that raised the millet, the inn bed, the chisel
 * and the letter-writing by the same factor. The design owner, on the second of
 * those: *also why would the famine move the cost of an inn bed. it should DROP
 * it.* The roads empty because nobody is travelling for a reason any more, and
 * a room nobody wants gets cheap.
 *
 * And `GameService.buy` never asked the ground at all. It priced through
 * `localPrice` - what the province is LIKE, a standing constant - and nothing
 * else, while the MCP market board next to it had been reading the ground since
 * `war-on-the-ground.test.ts`. So a province could starve for a century without
 * a counter moving a copper for the one person in the world who types
 * sentences.
 *
 * ── WHAT THESE CASES ARE ─────────────────────────────────────────────────
 *
 * Control arms throughout, and they are the strong kind: the SAME run, the SAME
 * day, the SAME sentence, with only the status pushed onto the ground between
 * the two readings. Nothing here re-seeds, re-rolls or advances anything, so
 * there is no second world for a difference to have come from.
 *
 * The world seed is pinned because `makeGameInWorld` is the only way a played
 * test pins an outcome rather than a coincidence - but nothing below depends on
 * what this world contains. The status is pushed by hand, which is deliberate:
 * `what-goes-wrong-with-a-place-and-what-ends-it.test.ts` owns the question of
 * what the world's own famine is written with, and this file owns what a famine
 * DOES to somebody standing in one.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { worldForRun } from '../../src/server/state/cultivation-world';
import {
    makeAreaStatus,
    type PriceMultiplierByCategory
} from '../../src/engine/world/what-is-true-of-a-place-right-now';
import { worldLocationFor } from '../../src/web/entities';
import { cashToStones, getPrice } from '../../src/data/cultivation/mortal-world';
import { localPrice } from '../../src/data/cultivation/regions';
import { standingOf } from '../../src/server/consolidated/where-a-cultivator-is-standing';

const WORLD = 'famine-on-the-board';

/** The three sentences, and the board row each one reaches. */
const A_CULTIVATORS_MEAL = 'I buy spirit-beast meat';
const A_MONTH_INDOORS = "I buy a month's lodging";
const THE_CHEAP_PILL = 'I buy a lesser healing pill';

async function standingSomewhereOrdinary() {
    const h = await makeGameInWorld({ seed: 'probe-famine', worldSeed: WORLD });
    const { cultivator } = await h.game.newRun('Probe');
    const run = h.repos.runs.getActiveRun(cultivator.id)!;
    const world = await worldForRun(run);
    const place = worldLocationFor(world, cultivator.location)!;

    // Deep enough to buy the pill at three times its price, so the charged case
    // below is a purchase and not a refusal. Arranging a precondition.
    h.db.prepare('UPDATE cultivators SET spirit_stones = 4000 WHERE id = ?').run(cultivator.id);

    return {
        ...h,
        run,
        world,
        place,
        regionId: standingOf(cultivator).regionId,
        day: Math.floor(world.currentDay),
        cultivatorId: cultivator.id,
        purse: () => (h.db
            .prepare('SELECT spirit_stones AS s FROM cultivators WHERE id = ?')
            .get(cultivator.id) as { s: number }).s
    };
}

/**
 * Push one status over the ground under this person.
 *
 * The world's own openers propose these; a played case that waited for one
 * would be measuring the schedule rather than the dial.
 */
function somethingBecomesTrueHere(
    world: { statuses: unknown[] },
    areaId: string,
    day: number,
    id: string,
    kind: string,
    priceMultiplierByCategory: PriceMultiplierByCategory,
    priceMultiplier = 1
): void {
    world.statuses.push(makeAreaStatus({
        id,
        areaId,
        kind,
        statement: 'Something is true of this place.',
        cause: { what: 'It happened.', decidedById: null, factId: null },
        beganOnDay: day - 1,
        reviewOnDay: day + 3650,
        priceMultiplier,
        priceMultiplierByCategory
    }));
}

/** Every engine row this turn wrote, which is where `structure` lands. */
function logOf(result: { state: { log: Array<{ role: string; text: string }> } }): string {
    return result.state.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');
}

interface Turn {
    narration: string;
    state: { log: Array<{ role: string; text: string }> };
}

/** Everything the turn put in front of the player, prose and inspector both. */
function saidBy(result: Turn): string {
    return `${result.narration}\n${logOf(result)}`;
}

/** The stones a turn told the player a counter here is asking. */
function quoted(result: Turn): number {
    const said = saidBy(result);
    const found = /which is (?:about )?([0-9,]+) spirit stone/.exec(said);
    expect(found, said.slice(0, 400)).not.toBeNull();
    return Number(found![1].replace(/,/g, ''));
}

/** What `buy` should charge for a row, worked the way `buy` works it. */
function asBuyWouldCharge(regionId: string, priceId: string, ground: number): number {
    const row = getPrice(priceId)!;
    return Math.max(1, Math.ceil(cashToStones(
        Math.max(1, Math.round(localPrice(regionId, row.cash) * ground))
    )));
}

describe('a famine moves the food and does not move the bed the same way', () => {
    /**
     * THE CASE THE WHOLE PER-TYPE DIAL EXISTS FOR.
     *
     * One status, one day, one piece of ground, and the two figures go in
     * opposite directions. A scalar could not have produced this reading at any
     * value it could have been set to.
     */
    it('raises what a meal is quoted at and lowers what a month indoors is quoted at', async () => {
        const at = await standingSomewhereOrdinary();

        const mealBefore = quoted(await at.game.act(A_CULTIVATORS_MEAL));
        const bedBefore = quoted(await at.game.act(A_MONTH_INDOORS));

        somethingBecomesTrueHere(
            at.world, at.place.id, at.day, 'status-test-famine', 'famine',
            { food: 4, lodging: 0.5 }
        );

        const mealAfter = quoted(await at.game.act(A_CULTIVATORS_MEAL));
        const bedAfter = quoted(await at.game.act(A_MONTH_INDOORS));

        // Measured on this world: 8 -> 29 stones and 3 -> 2. Asserted as the
        // arithmetic rather than as the figures, so a catalog or a province
        // multiplier can be retuned without this going stale.
        expect(mealBefore).toBe(asBuyWouldCharge(at.regionId, 'price-spirit-beast-meal', 1));
        expect(mealAfter).toBe(asBuyWouldCharge(at.regionId, 'price-spirit-beast-meal', 4));
        expect(mealAfter).toBeGreaterThan(mealBefore);

        expect(bedBefore).toBe(asBuyWouldCharge(at.regionId, 'price-month-lodging', 1));
        expect(bedAfter).toBe(asBuyWouldCharge(at.regionId, 'price-month-lodging', 0.5));
        expect(bedAfter).toBeLessThan(bedBefore);
    }, 300_000);

    /**
     * And the other half of "per type": a type the famine said nothing about is
     * where it was. Without this the case above passes on a status that simply
     * moved everything, which is the defect wearing the fix as a costume.
     */
    it('leaves a type the famine has no opinion about exactly where it was', async () => {
        const at = await standingSomewhereOrdinary();

        const before = at.purse();
        await at.game.act(THE_CHEAP_PILL);
        const paidQuiet = before - at.purse();
        expect(paidQuiet).toBe(asBuyWouldCharge(at.regionId, 'price-lesser-healing-pill', 1));

        somethingBecomesTrueHere(
            at.world, at.place.id, at.day, 'status-test-famine', 'famine',
            { food: 4, lodging: 0.5 }
        );

        const during = at.purse();
        await at.game.act(THE_CHEAP_PILL);
        expect(during - at.purse()).toBe(paidQuiet);
    }, 300_000);

    /**
     * AND IT COMES OUT OF THE PURSE.
     *
     * The two cases above read a QUOTE, because nothing food-shaped or
     * bed-shaped has a row in this engine to hold - `buy` prices those, says so,
     * and charges nothing. A dial that moved only the sentence and never the
     * balance would pass both of them. So this one is on a good the engine
     * really hands over, under a status shaped like the world's own war: *once
     * two sects fight, you probably want to pay more*, and here everybody who
     * can heal is being paid too much.
     */
    it('takes the moved figure out of the purse, and not merely off the board', async () => {
        const at = await standingSomewhereOrdinary();

        const before = at.purse();
        await at.game.act(THE_CHEAP_PILL);
        const paidQuiet = before - at.purse();

        somethingBecomesTrueHere(
            at.world, at.place.id, at.day, 'status-test-war', 'war',
            { medicine: 3, tool: 3 }
        );

        const during = at.purse();
        const result = await at.game.act(THE_CHEAP_PILL);
        const paidAtWar = during - at.purse();

        expect(paidAtWar).toBe(asBuyWouldCharge(at.regionId, 'price-lesser-healing-pill', 3));
        expect(paidAtWar).toBe(paidQuiet * 3);
        // And the quote and the charge are one number, which is the invariant
        // `what-would-close-this-wound.ts` was rebuilt around. A turn that says
        // one figure and takes another is a lie the player will catch.
        expect(quoted(result)).toBe(paidAtWar);
        // The inspector says which type moved and by how much, because a
        // charged figure with no account of it reads as the board being wrong.
        expect(logOf(result)).toMatch(/ground term of 3 on medicine/);
    }, 300_000);

    /**
     * AND THE ROUNDING IS NOT A BUG TO BE FIXED.
     *
     * A cultivator has no cash balance, only whole spirit stones, and a stone
     * is a hundred cash. So the cheap end of the mortal board rounds up to one
     * stone at any multiplier a famine can reach, and the bulk end does not.
     * That is `docs/world/things/economy.md`'s own line - *nobody at the
     * cultivator end of the ladder should ever feel a mortal price* - falling
     * out of the arithmetic rather than being asserted next to it, and a
     * quadrupled famine is where it either holds or stops holding.
     *
     * This is a claim about the whole board rather than about one run, so it is
     * `buy`'s arithmetic over the catalog rather than a played turn. The played
     * cases above are what prove `buy` does this arithmetic.
     */
    it('is not felt on a bowl of millet at four times the price, and is felt in bulk', async () => {
        const at = await standingSomewhereOrdinary();
        const under = (id: string, ground: number) => asBuyWouldCharge(at.regionId, id, ground);

        // A stone is a hundred cash and the floor of a purchase is one stone,
        // so the whole cheap end of the board is already below the resolution
        // a cultivator's purse has.
        for (const id of ['price-millet', 'price-meal', 'price-inn-night']) {
            expect(under(id, 1), id).toBe(1);
            expect(under(id, 4), id).toBe(1);
        }

        // And the bulk lines, which are what a cultivator actually buys, move.
        for (const id of ['price-month-rations', 'price-month-lodging', 'price-spirit-beast-meal']) {
            expect(under(id, 4), id).toBeGreaterThan(under(id, 1));
        }
        // Both directions: the beds get cheaper by whole stones too, or the
        // owner's inn-bed line is a number nobody can ever be charged.
        expect(under('price-month-lodging', 0.5))
            .toBeLessThan(under('price-month-lodging', 1));
    }, 300_000);

    /**
     * A quoted figure that moved and said nothing about why reads as the board
     * being broken. It is not the board; it is the ground.
     */
    it('says why the bed got cheap rather than letting the figure stand there alone', async () => {
        const at = await standingSomewhereOrdinary();

        expect(saidBy(await at.game.act(A_MONTH_INDOORS))).not.toMatch(/quiet ground/);

        somethingBecomesTrueHere(
            at.world, at.place.id, at.day, 'status-test-famine', 'famine',
            { food: 4, lodging: 0.5 }
        );

        const bed = saidBy(await at.game.act(A_MONTH_INDOORS));
        expect(bed).toMatch(/less than lodging goes for on quiet ground/);
        const meal = saidBy(await at.game.act(A_CULTIVATORS_MEAL));
        expect(meal).toMatch(/more than food goes for on quiet ground/);
    }, 300_000);
});
