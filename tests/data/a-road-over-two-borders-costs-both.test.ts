/**
 * A journey over two borders costs both roads. Played: Cold Peak to Iron Ridge is the White
 * Stair, the Jade Gorge and the Buddha Precipice, and it was charged one day.
 */
import { describe, expect, it } from 'vitest';

import { REGIONS, provinceRoadDays } from '../../src/data/cultivation/regions.js';

const direct = (from: string, to: string) => {
    const days = REGIONS.find(region => region.id === from)!.connections
        .filter(link => link.otherRegionId === to).map(link => link.travelDays);
    return days.length > 0 ? Math.min(...days) : null;
};

describe('a road over two borders', () => {
    it('is the sum of the legs, and no shorter than either', () => {
        const days = provinceRoadDays('region-white-stair', 'region-quiet-marches');
        expect(days).not.toBeNull();
        const legs = [direct('region-white-stair', 'region-low-fall'), direct('region-low-fall', 'region-quiet-marches')];
        expect(days!).toBeLessThanOrEqual(legs[0]! + legs[1]!);
        expect(days!).toBeGreaterThan(Math.max(...legs.map(leg => leg!)) - 1);
        expect(days!).toBeGreaterThan(1);
    });

    it('is the direct road where there is one, and the same both ways', () => {
        expect(provinceRoadDays('region-low-fall', 'region-wide-field')).toBe(direct('region-low-fall', 'region-wide-field'));
        expect(provinceRoadDays('region-white-stair', 'region-quiet-marches'))
            .toBe(provinceRoadDays('region-quiet-marches', 'region-white-stair'));
    });
});
