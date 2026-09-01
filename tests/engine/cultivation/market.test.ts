/**
 * Selling: the buy board, read from the other side.
 *
 * The defect this file guards against is not a wrong number, it is an absent
 * verb. Foraging produced items, the engine priced each one as it went into the
 * pouch, and nothing in the whole codebase converted a pouch back into stones.
 * A player could gather for a lifetime and realise nothing.
 *
 * So the assertions here are mostly about SHAPE - that a sale exists, that it
 * pays less than list, that it never pays more, and that the variation between
 * one sale and another comes out of the same regard table everything else
 * reads rather than out of a rule written for herbs.
 */

import { describe, it, expect } from 'vitest';
import {
    BUYER_MARGIN,
    SALE_CEILING_FRACTION,
    SALE_FLOOR_FRACTION,
    quotePouchSale,
    quoteSale
} from '../../../src/engine/cultivation/market.js';
import { getHerb, HERBS } from '../../../src/data/cultivation/herbs.js';

const QI_GRASS = getHerb('herb-qi-grass');

describe('a sale exists at all', () => {
    it('turns a pouched herb into spirit stones', () => {
        expect(QI_GRASS).toBeDefined();
        const quote = quoteSale({
            item: QI_GRASS,
            listStones: QI_GRASS!.value,
            quantity: 10,
            seller: 0
        });
        expect(quote.offeredStones).toBeGreaterThan(0);
    });

    it('pays nothing for nothing', () => {
        const quote = quoteSale({ listStones: 100, quantity: 0, seller: 0 });
        expect(quote.offeredStones).toBe(0);
        expect(quote.line).toContain('Nothing');
    });
});

describe('the buyer takes a margin, and it is legible', () => {
    it('never pays more than the thing is worth', () => {
        for (const herb of HERBS) {
            for (const ordinal of [0, 5, 13, 25, 40]) {
                const quote = quoteSale({
                    item: herb,
                    listStones: herb.value,
                    quantity: 3,
                    seller: ordinal
                });
                expect(quote.offeredStones).toBeLessThanOrEqual(quote.grossStones);
                expect(quote.offeredFraction).toBeLessThanOrEqual(SALE_CEILING_FRACTION);
                expect(quote.offeredFraction).toBeGreaterThanOrEqual(SALE_FLOOR_FRACTION);
            }
        }
    });

    it('pays the documented ordinary fraction at matched terms', () => {
        // A herb pitched at the seller's own rung: the plain case, and the one
        // the constant is written for.
        const quote = quoteSale({
            item: QI_GRASS,
            listStones: 100,
            quantity: 1,
            seller: QI_GRASS!.harvestOrdinal
        });
        expect(quote.offeredFraction).toBeCloseTo(1 - BUYER_MARGIN, 10);
    });

    it('leaves a real reason to refine or hold rather than sell', () => {
        // If the margin ever shrinks to noise, alchemy stops being an economic
        // decision and becomes a formality.
        expect(BUYER_MARGIN).toBeGreaterThanOrEqual(0.2);
    });
});

describe('the price comes out of regard, not out of a rule about herbs', () => {
    it('gives a seller standing above the ask better terms than one standing at it', () => {
        const at = quoteSale({ item: QI_GRASS, listStones: 100, quantity: 1, seller: 0 });
        const above = quoteSale({ item: QI_GRASS, listStones: 100, quantity: 1, seller: 20 });
        expect(above.offeredFraction).toBeGreaterThan(at.offeredFraction);
    });

    it('prices a thing the seller visibly cannot hold well under ordinary terms', () => {
        // A beginner carrying something pitched many rungs above them. Not a
        // special case: the same table that decides whether a job is offered.
        const steep = HERBS.find(h => h.harvestOrdinal >= 20);
        expect(steep).toBeDefined();
        const quote = quoteSale({
            item: steep,
            listStones: steep!.value,
            quantity: 1,
            seller: 0
        });
        expect(quote.offeredFraction).toBeLessThan(1 - BUYER_MARGIN);
        expect(quote.regard.priceMultiplier).toBeGreaterThan(1);
    });

    it('carries the region multiplier the buy board is quoted through', () => {
        const plain = quoteSale({ item: QI_GRASS, listStones: 100, quantity: 1, seller: 0 });
        const dear = quoteSale({
            item: QI_GRASS, listStones: 100, quantity: 1, seller: 0, localMultiplier: 1.5
        });
        expect(dear.offeredStones).toBeGreaterThan(plain.offeredStones);
    });
});

describe('rounding does not eat the bottom of the economy', () => {
    it('sums the lot before flooring, so cheap things are still worth carrying', () => {
        // Ten Qi Grass at 2 stones each is 20 list; per-unit flooring would pay
        // 10 (1 each), and total flooring pays 12. The difference is the entire
        // margin of a beginner's afternoon.
        const quote = quoteSale({ item: QI_GRASS, listStones: 2, quantity: 10, seller: 0 });
        expect(quote.offeredStones).toBeGreaterThan(10 * Math.floor(2 * (1 - BUYER_MARGIN)));
    });

    it('says so plainly when a lot is worth less than one stone', () => {
        const quote = quoteSale({ item: QI_GRASS, listStones: 1, quantity: 1, seller: 0 });
        expect(quote.offeredStones).toBe(0);
        expect(quote.line).toContain('not much');
    });
});

describe('the whole pouch at once', () => {
    it('prices every lot and sums them', () => {
        const lots = HERBS.slice(0, 4).map(h => ({
            itemId: h.id,
            name: h.name,
            item: h,
            listStones: h.value,
            quantity: 2
        }));
        const quote = quotePouchSale(lots, 0);
        expect(quote.lots).toHaveLength(4);
        expect(quote.offeredStones).toBe(
            quote.lots.reduce((sum, lot) => sum + lot.offeredStones, 0)
        );
        expect(quote.offeredStones).toBeLessThan(quote.grossStones);
    });
});

describe('what selling does to the bottom of the economy', () => {
    /**
     * The reason this module exists. A beginner's realistic afternoon in the
     * hills has to be worth something against a year of food, or gathering is
     * scenery.
     */
    it('makes a handful of common herbs worth a real fraction of a ration', () => {
        const commons = HERBS.filter(h => h.grade === 'mortal' && h.harvestOrdinal === 0);
        expect(commons.length).toBeGreaterThan(0);
        const lots = commons.slice(0, 5).map(h => ({
            itemId: h.id,
            name: h.name,
            item: h,
            listStones: h.value,
            quantity: 3
        }));
        // Against 2 spirit stones a ration - fifty days of eating.
        expect(quotePouchSale(lots, 0).offeredStones).toBeGreaterThanOrEqual(2);
    });
});
