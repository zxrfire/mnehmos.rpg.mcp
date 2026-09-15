/**
 * Haggling is a moment, and it had no resolver at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS MEASURED, ON A PINNED WORLD AT OLD RIVER VILLAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `trade` is a member of `INTERACT_INTENTS` and had nothing behind it, so
 * every sentence somebody types while actually haggling fell to the bottom of
 * `interact` and came back as a question. Verbatim, before:
 *
 *   "that's too expensive"        a numbered list of the sixteen people in
 *                                 the square, headed *you had not picked
 *                                 anybody*
 *   "I offer him twenty stones"   *A trade needs the two halves of it named*
 *   "I'll give you my sword       parsed as a GIFT, and refused with *you
 *    instead"                     hold it out and there is nobody to take it*
 *   "how much for the Lesser      *Nothing here prices "Lesser Qi-Gathering
 *    Qi-Gathering Manual"         Manual"*, and then, eleven lines down the
 *                                 same screen, *Lesser Qi-Gathering Manual, 8
 *                                 spirit stones the copy*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE FIX THAT WOULD HAVE BEEN WORSE THAN THE GAP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Adding `trade` to `ATTEMPT_INTENTS` reaches the resolver and is wrong:
 * membership there is what makes an intent PRESS somebody, and pressing
 * somebody spends a day. The ruling is about length - *"would it be a day in
 * d&d? heck no"* - so the whole exchange lives on the free side and only
 * acceptance costs anything, at whatever the purchase already charged.
 *
 * `asking-is-not-doing.test.ts > spends on exactly the intents it says press
 * somebody` holds the other end of this: it plays every interact intent and
 * compares what was spent against the declared set. This file holds the half
 * that one cannot see, which is that the exchange still WORKS while being
 * free, and that it may be repeated.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';

import { makeGameInWorld, type Harness } from './harness';
import { parseIntent } from '../../src/web/actions';
import { npcsAt } from '../../src/engine/world/world-state';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { manualsAStallCarries } from '../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall';
import { readWhatIsOnOfferHere } from '../../src/web/who-here-is-offering-something';
import type { AnOfferStandingHere } from '../../src/engine/world/what-somebody-standing-here-would-part-with';

/**
 * A square with people in it, and a purse that cannot be the reason anything
 * was refused.
 *
 * The world is pinned because everything this file reads comes out of it - who
 * is standing here, what they are carrying, what they are asking. An unpinned
 * `worldEnabled` test mints a world from `randomUUID()` and pins a coincidence.
 */
async function inASquareWithAStall(seed: string): Promise<{
    db: Database.Database;
    game: Harness['game'];
    people: string[];
    /**
     * What is standing on offer here, asked of the engine's own read.
     *
     * Not a reconstruction of it: a helper that rebuilt which of the square's
     * people are selling what would be a second copy of the deal and would
     * disagree with the real one.
     */
    onOffer: AnOfferStandingHere[];
}> {
    resetCultivationWorlds();
    const { db, game } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await game.newRun('Lin Baoqing');

    const world = (await game.loadWorld())!;
    const square = world.locations
        .map(place => ({ place, people: npcsAt(world, place.id) }))
        .filter(row => row.people.length >= 8)
        .sort((a, b) => b.people.length - a.people.length)[0];
    expect(square, 'the pinned world has no square with people in it').toBeDefined();

    db.prepare('UPDATE cultivators SET location = ?, spirit_stones = 500 WHERE id = ?')
        .run(square.place.name, cultivator.id);
    return {
        db,
        game,
        people: square.people.map(person => person.name),
        onOffer: readWhatIsOnOfferHere(game.state().cultivator, world).offers
    };
}

/** A title the stall actually carries, read out of the catalog rather than typed. */
const onTheStall = (): string => {
    const stock = manualsAStallCarries();
    expect(stock.length, 'no stall stock in this build, so nothing can be haggled over')
        .toBeGreaterThan(0);
    return stock[0].name;
};

/** The prose a turn put in front of the player, whichever channel carried it. */
const read = (turn: { narration?: string | null }): string => turn.narration ?? '';

describe('a haggle is not a day', () => {
    /**
     * THE PROPERTY THIS FILE EXISTS FOR, AND THE ONE A FREE ACTION CAN FAKE.
     *
     * Four sentences, none of which may move the clock. The day is read either
     * side of each one rather than once at the end, so the sentence that spent
     * it is named instead of the suite reporting that something did.
     *
     * And each answer must carry a FIGURE. The behaviour these replaced was
     * free as well - it was a numbered list of everybody in the square, headed
     * *you had not picked anybody* - so "nothing was spent" on its own would
     * pass against the defect.
     */
    it('spends no day on any sentence of an exchange, and answers each one', async () => {
        const { game } = await inASquareWithAStall('haggle-costs-nothing');
        const book = onTheStall();

        for (const said of [
            `how much for the ${book}`,
            "that's too expensive",
            'I offer him twenty stones',
            "I'll give you my sword instead"
        ]) {
            const before = game.state().run.elapsedDays;
            const turn = await game.act(said);
            expect(game.state().run.elapsedDays, `"${said}" spent a day`).toBe(before);
            expect(read(turn), `"${said}" came back without a figure in it`)
                .toMatch(/\d+ spirit stones?/);
        }
    }, 180_000);

    /**
     * Free means REPEATABLE. A haggle that cost a tenth of a day would pass the
     * assertion above and still be a mechanic nobody could use twice.
     */
    it('costs nothing however long the back and forth runs', async () => {
        const { game } = await inASquareWithAStall('haggle-repeats');
        const book = onTheStall();
        await game.act(`how much for the ${book}`);

        const before = game.state().run.elapsedDays;
        for (let round = 0; round < 8; round++) {
            await game.act(round % 2 === 0 ? "that's too expensive" : 'I offer three stones');
        }
        expect(game.state().run.elapsedDays, 'eight rounds of haggling spent time').toBe(before);
    }, 180_000);

    /**
     * AND IT HAS TO ANSWER, which is the half a free action can fake.
     *
     * The old behaviour was free too - it was a question put back. So the
     * assertion is that a FIGURE comes back, in the currency the exchange is
     * conducted in, rather than that nothing was spent.
     */
    it('states a figure when asked what a thing costs', async () => {
        const { game } = await inASquareWithAStall('haggle-states-a-price');
        const book = onTheStall();

        const turn = await game.act(`how much for the ${book}`);
        expect(read(turn)).toContain(book);
        expect(read(turn), 'asked a price and was given no figure')
            .toMatch(/\d+ spirit stones?/);
    }, 180_000);

    /**
     * "Yes, no, or tell you to add" - and the add is the one that has to carry
     * a number, because a refusal with no route out of it is the blank look
     * this engine keeps having to be talked out of.
     *
     * A stall rate does not move and correctly says so, so what is pinned here
     * is the half that does: somebody's own thing, at their own figure.
     *
     * ── HOW THE SELLER IS REACHED, AND WHY NOT THE WAY IT WAS ───────────
     *
     * This used to walk the square asking every person in it *how much does X
     * want for what they are carrying* until somebody named a shortfall.
     * Measured on this fixture: the square holds 23 people and exactly one of
     * them, Duan Ankuan, has anything standing on offer, so 22 of those asks
     * reach nobody selling anything - and the first one that misses settles the
     * exchange on a stall book at a quoted rate, which every turn after it then
     * correctly answers with *the rate is the rate*. The walk could not arrive.
     *
     * Naming the thing is what a player does after a board read prints it, and
     * the title is read out of the engine's own account of what is standing
     * here rather than typed. Played against Duan Ankuan's Iron Shirt Tempering
     * at 7 stones, one stone offered: *6 spirit stones more closes it*.
     */
    it('tells a short offer what would close it', async () => {
        const { game, onOffer } = await inASquareWithAStall('haggle-says-what-closes-it');
        const [standing] = onOffer;
        expect(standing, 'nobody in the pinned square is offering anything at all')
            .toBeDefined();
        expect(standing.askStones, 'the thing on offer is free, so nothing can be short of it')
            .toBeGreaterThan(1);

        await game.act(`how much for the ${standing.name}`);
        const offered = await game.act('I offer one stone');

        expect(read(offered), 'a short offer was not told what would close it')
            .toContain(`${standing.askStones - 1} spirit stones more closes it`);
    }, 300_000);

    /**
     * The routing, asserted directly, because a played test only covers the
     * phrasings it happens to use. Every one of these reached `unclear` or a
     * gift before the table was widened.
     */
    it.each([
        'how much',
        "what's your price",
        'that is too expensive',
        'I offer him twenty stones',
        "I'll give you my sword instead",
        'counter-offer',
        'how much do you want for the manual'
    ])('reads %j as a haggle', said => {
        const plan = parseIntent(said);
        expect(plan.action).toBe('interact');
        expect((plan as { intent?: string }).intent).toBe('trade');
    });

    /**
     * AND THE WORDS THAT LOOK LIKE ONE AND ARE NOT.
     *
     * Each of these was a measured misroute on some earlier widening of this
     * branch, and they are here so the next person widening it finds out at
     * once. A gift is the important one: "instead" is the only thing that
     * separates handing somebody your sword from trading it, and reading the
     * plain form as a trade would mean nothing in this game could be given
     * away.
     */
    it.each([
        ['I give him my sword', 'give'],
        ['how much does she have', 'market'],
        ['how much does a manual cost', 'market'],
        ['how much do I have left', 'inventory']
    ])('leaves %j alone', (said, verb) => {
        expect(parseIntent(said).action).toBe(verb);
    });
});
