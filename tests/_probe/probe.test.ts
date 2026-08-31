import { describe, it } from 'vitest';
import { measureOriginOutcomes } from '../../src/engine/world/origin-odds.js';

describe('probe', () => {
    it('prints', () => {
        const r = measureOriginOutcomes('probe-seed', { perTierSampleSize: 800 });
        for (const row of r.rows) {
            console.log(
                row.origin.padEnd(18),
                'median', String(row.medianPeakOrdinal).padStart(3),
                'mean', row.meanPeakOrdinal.toFixed(2).padStart(6),
                '>=13', row.reachedAtLeast[13].toFixed(3),
                '>=21', row.reachedAtLeast[21].toFixed(3), '>=25', row.reachedAtLeast[25].toFixed(4),
                '>=33', row.reachedAtLeast[33].toFixed(4),
                '>=41', row.reachedAtLeast[41].toFixed(4),
                '=45', row.reachedAtLeast[45].toFixed(4),
                'vein', row.veinShare.toFixed(3),
                'ruin', row.ruinShare.toFixed(3),
                'compr', row.comprehendedShare.toFixed(3)
            );
            console.log('   ends', JSON.stringify(row.ends));
        }
        console.log('runLevel', JSON.stringify(r.runLevel));
        console.log('lift', JSON.stringify(r.privilegeLift));
    }, 900000);
});
