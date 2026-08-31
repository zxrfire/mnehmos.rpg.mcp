import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { simulateLife } from '../../src/engine/world/origin-odds.js';

describe('vein probe', () => {
    it('prints', () => {
        const out: string[] = [];
        for (const tier of ['thin_county', 'great_house'] as const) {
            const hist = new Array(46).fill(0);
            let veins = 0, deepest = 0, best = 0;
            const N = 120000;
            for (let i = 0; i < N; i++) {
                const life = simulateLife('vein-seed', i, tier);
                hist[life.peakOrdinal]++;
                best = Math.max(best, life.peakOrdinal);
                if (life.foundVein) veins++;
                deepest = Math.max(deepest, life.deepestDegree);
            }
            out.push([tier, 'N', N, 'veins', veins, 'best', best, 'deepestDegree', deepest,
                '>=41', hist.slice(41).reduce((a: number, b: number) => a + b, 0),
                '=45', hist[45], 'tail', JSON.stringify(hist.slice(33))].join(' '));
        }
        writeFileSync('vein-probe.txt', out.join('\n'));
    }, 3600000);
});
