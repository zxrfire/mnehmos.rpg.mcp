import { describe, expect, it } from 'vitest';
import {
    COMMODITY_YEARS_OF_INCOME,
    cashRefusalReason,
    commodityMarketCeiling,
    commodityProgressPills,
    gradeTradeTier,
    pillCashPrice,
    pillStorageModel,
    pillTradeTier,
    purchasedQiPerYear,
    stonesPerQiUnitAt,
    yearsOfIncomeFor
} from '../../../src/engine/cultivation/buying-and-bartering-pills.js';
import { PILLS, getPill } from '../../../src/data/cultivation/pills.js';
import { netEarningsPerYear, earningsPerYear } from '../../../src/engine/cultivation/origin.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import type { TechniqueGrade } from '../../../src/schema/cultivation.js';

const GRADES: TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

describe('the line between a pill you buy and a pill you owe somebody for', () => {
    it('splits the catalog between earth and heaven, and does it by arithmetic', () => {
        expect(gradeTradeTier('mortal')).toBe('commodity');
        expect(gradeTradeTier('earth')).toBe('commodity');
        expect(gradeTradeTier('heaven')).toBe('barter');
        expect(gradeTradeTier('immortal')).toBe('barter');
        expect(gradeTradeTier('chaos')).toBe('barter');
    });

    it('puts the threshold inside a real gap rather than on top of a row', () => {
        // The dearest commodity pill and the cheapest barter grade's dearest
        // pill must straddle the threshold with room, so that a catalog edit
        // has to be deliberate to move the line.
        const dearestIn = (g: TechniqueGrade) =>
            Math.max(...PILLS.filter(p => p.grade === g).map(yearsOfIncomeFor));
        expect(dearestIn('earth')).toBeLessThan(COMMODITY_YEARS_OF_INCOME / 1.5);
        expect(dearestIn('heaven')).toBeGreaterThan(COMMODITY_YEARS_OF_INCOME * 1.5);
    });

    it('is decided by the grade, not by the row - a cheap barter pill is still not for sale', () => {
        // The Boundless Source Pill is the cheapest heaven-grade row and is
        // 8.1 years of a Nascent Soul cultivator's income, which is UNDER the
        // threshold. A per-row rule would put it on a stall; the grade rule
        // does not, and that is the point.
        const cheapHeaven = PILLS
            .filter(p => p.grade === 'heaven')
            .reduce((a, b) => (a.value < b.value ? a : b));
        expect(yearsOfIncomeFor(cheapHeaven)).toBeLessThan(COMMODITY_YEARS_OF_INCOME);
        expect(pillTradeTier(cheapHeaven)).toBe('barter');
        expect(pillCashPrice(cheapHeaven)).toBeNull();
    });

    it('never reads a pill id', () => {
        // Every pill of a grade agrees with its grade. If this ever fails the
        // module has grown a special case.
        for (const pill of PILLS) {
            expect(pillTradeTier(pill)).toBe(gradeTradeTier(pill.grade));
        }
    });
});

describe('what a price is and is not', () => {
    it('quotes list for a commodity pill and refuses to quote at all above it', () => {
        expect(pillCashPrice(getPill('pill-foundation-guiding')!)).toBe(75);
        expect(pillCashPrice(getPill('pill-golden-core-guiding')!)).toBe(650);
        expect(pillCashPrice(getPill('pill-nascent-soul-guiding')!)).toBeNull();
        expect(pillCashPrice(getPill('pill-tribulation-guiding')!)).toBeNull();
    });

    it('gives a reason exactly where it gives no price', () => {
        for (const pill of PILLS) {
            const priced = pillCashPrice(pill) !== null;
            expect(cashRefusalReason(pill) === null).toBe(priced);
        }
    });

    it('never offers a fallback price a caller could mistake for one', () => {
        const barter = PILLS.filter(p => pillTradeTier(p) === 'barter');
        expect(barter.length).toBeGreaterThan(0);
        for (const pill of barter) expect(pillCashPrice(pill)).toBeNull();
    });
});

describe('one threshold, two consequences', () => {
    it('stores what it prices and rows what it does not', () => {
        for (const pill of PILLS) {
            expect(pillStorageModel(pill))
                .toBe(pillTradeTier(pill) === 'commodity' ? 'count' : 'row');
        }
    });

    it('keeps the two lines from drifting apart across every grade', () => {
        for (const grade of GRADES) {
            const inGrade = PILLS.filter(p => p.grade === grade);
            const models = new Set(inGrade.map(pillStorageModel));
            expect(models.size).toBe(1);
        }
    });
});

describe('what money actually buys, and where it stops buying it', () => {
    it('stops at the end of the last realm anybody sells for stones', () => {
        const coreFormation = REALM_TIERS.find(t => t.key === 'core_formation')!;
        expect(commodityMarketCeiling()).toBe(coreFormation.ordinalEnd);
    });

    it('has no price at all above that, which is not the same as a high one', () => {
        expect(Number.isFinite(stonesPerQiUnitAt(20))).toBe(true);
        expect(Number.isFinite(stonesPerQiUnitAt(21))).toBe(false);
        expect(purchasedQiPerYear(100_000, 21)).toBe(0);
        expect(purchasedQiPerYear(100_000, 44)).toBe(0);
    });

    it('gets dearer as the buyer outgrows the band, never cheaper', () => {
        let previous = 0;
        for (let o = 0; o <= commodityMarketCeiling(); o++) {
            const price = stonesPerQiUnitAt(o);
            expect(price).toBeGreaterThanOrEqual(previous - 1e-9);
            previous = price;
        }
    });

    it('offers only pills anybody can actually buy', () => {
        const pills = commodityProgressPills();
        expect(pills.length).toBeGreaterThan(0);
        for (const p of pills) {
            expect(p.effect).toBe('advance_progress');
            expect(pillTradeTier(p)).toBe('commodity');
        }
    });

    it('buys nothing for somebody with nothing', () => {
        expect(purchasedQiPerYear(0, 12)).toBe(0);
        expect(purchasedQiPerYear(-50, 12)).toBe(0);
        expect(purchasedQiPerYear(Number.NaN, 12)).toBe(0);
    });
});

describe('the income curve every price is quoted against', () => {
    it('leaves a farm child very nearly nothing and a Foundation cultivator a budget', () => {
        // The whole reason the bottom of the ladder is untouched by any of
        // this: 2.7 stones a year against an upkeep of sixty.
        expect(netEarningsPerYear(0)).toBeCloseTo(2.7, 5);
        expect(netEarningsPerYear(13)).toBeGreaterThan(100);
    });

    it('climbs with rank and then stops, so no fortune outruns the ladder', () => {
        expect(earningsPerYear(0)).toBeLessThan(earningsPerYear(12));
        expect(earningsPerYear(24)).toBe(earningsPerYear(44));
    });

    it('is what the bottom of the ladder cannot buy a crossing pill out of', () => {
        // At ordinal zero one pill is over a century of everything left over.
        expect(500 / netEarningsPerYear(0)).toBeGreaterThan(100);
    });
});
