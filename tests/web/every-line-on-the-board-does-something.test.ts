/**
 * A starving player, a bowl of millet on the board at one cash, and no way to
 * buy it.
 *
 * FOUND BY PLAYING, and it was two defects on one screen.
 *
 *   "I buy food and eat"  ->  "You ask for food and receive a look. It is the
 *                             look reserved for those who ask for things that
 *                             are not sold."  ...and then the same answer
 *                             listed BOWLS OF MILLET among the stock.
 *
 *   "I buy a bowl of millet" -> "Bowl of millet is priced and quoted and there
 *                             is no row in this engine for holding one, so
 *                             nothing was charged."
 *
 * The first was `resolvePrice` scoring only against a row's NAME and never
 * against its `category`, which is a closed enum whose values - food, lodging,
 * transport, medicine, land, service, tool, information - are exactly the words
 * players type. The refusal it produced was then built by mapping over the same
 * array that holds the millet, so one answer refused food and advertised it in
 * the same breath.
 *
 * The second was structural and worse: `Price` was a QUOTE row pretending to be
 * a STOCK row. It carried no field saying what a row IS, so `buy` recovered the
 * missing column by re-resolving the display name against the pill catalog.
 * Measured, that guess succeeded for 8 of 43 rows. The other 35 were priced,
 * quoted and unbuyable.
 *
 * This file is the guard that stops it coming back. The rule it enforces is not
 * "everything must be buyable" - a bounty is collected and not bought, and land
 * changes hands between families over years. The rule is that **every row is an
 * authored decision**, so a row added to the catalog and never thought about
 * fails here instead of dying silently in front of a player.
 */

import { describe, it, expect } from 'vitest';

import { PRICES } from '../../src/data/cultivation/mortal-world';
import { cheapestInCategory, resolvePriceLoosely } from '../../src/web/entities';
import { MARKET_CATEGORIES } from '../../src/web/market-prices';
import { getPill } from '../../src/data/cultivation/pills';
import { getConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on';

describe('every line on the price board does something', () => {
    it('says what buying it does, for all of them', () => {
        // Not a count that can drift: every row, or the test is a lie.
        for (const price of PRICES) {
            expect(price.gives, price.id).toBeTruthy();
            expect(typeof price.gives.kind, price.id).toBe('string');
        }
        expect(PRICES.length).toBeGreaterThan(40);
    });

    it('points every routed row at something that actually exists', () => {
        // The old join was by display string and it silently missed 35 rows.
        // These are id joins, so a typo is a failure rather than a refusal.
        for (const price of PRICES) {
            if (price.gives.kind === 'pill') {
                expect(getPill(price.gives.pillId), price.id).toBeTruthy();
            }
            if (price.gives.kind === 'conveyance') {
                expect(getConveyance(price.gives.conveyanceId), price.id).toBeTruthy();
            }
        }
    });

    it('gives a reason whenever it refuses, rather than falling through a guess', () => {
        for (const price of PRICES) {
            if (price.gives.kind !== 'quoted_only') continue;
            // The refusal has to point at the door that DOES work, or it is the
            // same dead end with better manners.
            expect(price.gives.because.length, price.id).toBeGreaterThan(20);
            expect(price.gives.because, price.id).not.toMatch(/no row in this engine/i);
        }
    });

    it('says what a counter hands over, so the answer is not "you paid for nothing"', () => {
        for (const price of PRICES) {
            if (price.gives.kind !== 'spent_at_the_counter') continue;
            expect(price.gives.what.length, price.id).toBeGreaterThan(10);
        }
    });

    /**
     * AND THE FOOD IS BUYABLE, which is the whole reason this was found.
     *
     * Asserted by category rather than by id, so authoring a new food row that
     * cannot be eaten fails here.
     */
    it('makes every food row something a hungry person can actually get', () => {
        const food = PRICES.filter(price => price.category === 'food');
        expect(food.length).toBeGreaterThan(2);
        for (const price of food) {
            expect(
                ['a_meal', 'rations', 'spent_at_the_counter'],
                `${price.id} is food and cannot be had`
            ).toContain(price.gives.kind);
        }
        // The cheapest thing anybody can eat is reachable, and it is the millet.
        expect(PRICES.filter(p => p.category === 'food')
            .reduce((best, p) => p.cash < best.cash ? p : best).gives.kind).toBe('a_meal');
    });

    /**
     * AND EVERY CATEGORY WORD REACHES THE BOARD.
     *
     * Measured before the fix: six of the eight returned nothing at all, and
     * the two that worked did so by accident of appearing inside a row's name.
     */
    it('answers a category word with the cheapest row in it', () => {
        for (const category of MARKET_CATEGORIES) {
            const found = cheapestInCategory(category);
            expect(found, category).toBeTruthy();
            expect(found!.category, category).toBe(category);
            const rows = PRICES.filter(price => price.category === category);
            const cheapest = rows.reduce((best, price) => price.cash < best.cash ? price : best);
            expect(found!.id, category).toBe(cheapest.id);
        }
    });

    /**
     * A PARAPHRASE STILL HAS TO REACH THE BOARD.
     *
     * FOUND BY PLAYING, and it is a defect of the seam rather than of either
     * side. The player typed "I buy a night at an inn"; the intent reader
     * rewrote the target as "inn stay", which is a fair paraphrase and not a
     * word on the board. `resolvePrice` handles the player's own phrasing
     * perfectly - what it never sees is the player's own phrasing.
     */
    it('reaches the right row from the words people and models actually use', () => {
        const reached = (query: string) =>
            (cheapestInCategory(query) ?? resolvePriceLoosely(query) as { id?: string } | null)?.id
            ?? (resolvePriceLoosely(query)?.id ?? null);
        expect(reached('inn stay')).toBe('price-inn-night');
        expect(reached('a room for the night')).toBe('price-inn-night');
        expect(reached('a bed')).toBe('price-inn-night');
        expect(reached('something to eat')).toBe('price-millet');
        expect(reached('see a doctor')).toBe('price-doctor-visit');
        expect(reached('a ride')).toBe('price-ferry');
    });

    it('reads a category out of a sentence, and does not match half a word', () => {
        expect(cheapestInCategory('food')?.id).toBe('price-millet');
        // The schema word and the word anybody actually says both land.
        expect(cheapestInCategory('something to eat')?.id).toBe('price-millet');
        // Whole word only: a stool is not a tool, and nothing here matches
        // inside a longer word.
        expect(cheapestInCategory('a stool')).toBeNull();
        expect(cheapestInCategory('a tool')?.category).toBe('tool');
        // And a sentence about nothing on the board still reaches nothing.
        expect(cheapestInCategory('a spaceship')).toBeNull();
    });
});
