/**
 * A post pays contribution at full rate for its first year and a tenth of it for each year after.
 * The owner: "sects want people who have done more aspects of the sect", "you get more
 * contribution from breadth of course", and "longer stuff pays MORE as an absolute count, less as
 * a per unit". Stones are paid at the full monthly rate throughout, and short missions spent in
 * one act are untouched.
 *
 * Red-checked by pricing a post's contribution over its whole term again: the breadth test and
 * the per-year test both go red.
 */

import { describe, expect, it } from 'vitest';
import { HOUSE_MISSIONS, type HouseMission } from '../../../src/data/cultivation/what-a-house-posts-for-its-own';
import { aMissionAsAnOffer } from '../../../src/engine/encounters/what-a-house-has-on-its-board';
import { dutyTermsAtAMonthlyRate } from '../../../src/engine/encounters/duties';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation';

const house = { id: 'sect-azure-cloud-pavilion', name: 'Azure Cloud Pavilion' };
/** An inner disciple of a seven-rung house, standing where the vein warding can be done. */
const AN_INNER_DISCIPLE = { factionId: house.id, factionName: house.name, rankIndex: 2, rankCount: 7, contribution: 0 };
const ORDINAL = 21;

const mission = (said: string): HouseMission => HOUSE_MISSIONS.find(row => row.said === said)!;
const terms = (row: HouseMission, days = row.days) => dutyTermsAtAMonthlyRate({
    entry: aMissionAsAnOffer(row, house, 'Azure Cloud Pavilion grounds'),
    cashPerMonth: row.cashPerMonth,
    days,
    ordinal: ORDINAL,
    membership: AN_INNER_DISCIPLE,
    creditsTheHouse: true
});

describe('merit from a post against merit from breadth', () => {
    it('pays more for five years of different tasks than for one five-year pass watch', () => {
        const passWatch = mission('pass watch');
        expect(passWatch.days).toBe(5 * DAYS_PER_YEAR);
        const oneLongPost = terms(passWatch).contribution;

        // The vein warding, an inner post of three years, then the outer rota for the rest.
        let days = 0;
        let merit = 0;
        const take = (row: HouseMission) => { const t = terms(row); days += t.days; merit += t.contribution; };
        take(mission('vein warding'));
        const rota = ['chores', 'messages', 'lamp watch'].map(mission);
        for (let i = 0; days < passWatch.days; i++) take(rota[i % rota.length]!);

        expect(merit).toBeGreaterThan(oneLongPost);
    });

    it('pays a post more in all the longer it runs, and less for each year of it', () => {
        const passWatch = mission('pass watch');
        const years = [1, 2, 5, 10, 50, 100];
        const paid = years.map(n => terms(passWatch, n * DAYS_PER_YEAR).contribution);
        for (let i = 1; i < years.length; i++) {
            expect(paid[i], `${years[i]} years against ${years[i - 1]}`).toBeGreaterThan(paid[i - 1]!);
            expect(paid[i]! / years[i]!, `per year at ${years[i]} against ${years[i - 1]}`)
                .toBeLessThan(paid[i - 1]! / years[i - 1]!);
        }
    });

    it('pays a post\'s stones at the full rate for the whole term', () => {
        const passWatch = mission('pass watch');
        const oneYear = terms(passWatch, DAYS_PER_YEAR).stones;
        expect(terms(passWatch, 5 * DAYS_PER_YEAR).stones).toBeCloseTo(5 * oneYear, -1);
    });

    it('leaves a short mission spent in one act as it was', () => {
        const chores = mission('chores');
        const month = terms(chores, 30).contribution;
        expect(terms(chores, 3 * DAYS_PER_YEAR).contribution).toBeGreaterThan(month * 30);
    });
});
