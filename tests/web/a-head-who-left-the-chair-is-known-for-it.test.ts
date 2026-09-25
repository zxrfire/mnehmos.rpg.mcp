/**
 * A head who left the chair sits one rung below it, and only the tag succession writes says they
 * ever held it. The person's card reads that tag back, so the narrator can play a grand elder who
 * was the patriarch forty years ago as that, and knows whether they went or were put out.
 */
import { describe, expect, it } from 'vitest';

import { steppedDownTag, whyTheyLeftTheChair } from '../../src/engine/world/a-house-changes-who-leads-it';
import { REMOVED_FROM_OFFICE } from '../../src/engine/world/bringing-what-you-know-about-somebody-to-the-room';
import { howTheyLeftTheChair, thePeopleHere } from '../../src/web/the-narrator-plays-the-world';
import type { Company } from '../../src/web/facts';

const HOUSE = 'sect-a-house';
const YEAR = 365;

describe('a head who left the chair', () => {
    it('reads back why they went, in the words the pass decided it in', () => {
        const row = { tags: [steppedDownTag(HOUSE, 'to attempt a crossing', 1000)] };
        expect(whyTheyLeftTheChair(row, HOUSE)).toEqual({ why: 'to attempt a crossing', day: 1000, putOut: false });
        expect(whyTheyLeftTheChair(row, 'sect-another-house')).toBeNull();
    });

    it('knows a removal from a retirement by the tag the elders wrote the same day', () => {
        const row = {
            tags: [steppedDownTag(HOUSE, 'no longer fit', 1000), `${REMOVED_FROM_OFFICE}${HOUSE}:1000`],
            factionId: HOUSE
        };
        expect(whyTheyLeftTheChair(row, HOUSE)?.putOut).toBe(true);
        expect(howTheyLeftTheChair(row, 1000 + 40 * YEAR))
            .toBe('once head of their house; the elders put them out of the chair 40 years ago (no longer fit)');
    });

    it('says nothing of somebody who never held it', () => {
        expect(howTheyLeftTheChair({ tags: [], factionId: HOUSE }, 5000)).toBeNull();
        expect(howTheyLeftTheChair({ tags: [steppedDownTag(HOUSE, 'near the end of their span', 1)], factionId: null }, 5000))
            .toBeNull();
    });

    it('is on their card in the scene', () => {
        const row = { tags: [steppedDownTag(HOUSE, 'near the end of their span', 1000)], factionId: HOUSE };
        const company = {
            named: [{
                name: 'Old Gu', ordinal: 20, sex: 'man', age: 900, rank: 'Grand Elder',
                leftTheChair: howTheyLeftTheChair(row, 1000 + 12 * YEAR),
                at: null, looksUp: true, playsToTheRoom: 0, withNames: [], like: null, chewing: null
            }],
            strangers: [],
            total: 1
        } as unknown as Company;
        const said = thePeopleHere(company, 5, [], 'Old Gu').join('\n');
        expect(said).toContain('once head of their house; stepped down 12 years ago (near the end of their span)');
    });
});
