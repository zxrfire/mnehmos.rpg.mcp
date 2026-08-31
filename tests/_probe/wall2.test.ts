import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { simulateLife } from '../../src/engine/world/origin-odds.js';

describe('wall2', () => {
    it('prints', () => {
        const lines: string[] = [];
        for (let i = 0; i < 120000; i++) {
            const life = simulateLife('vein-seed', i, 'great_house');
            if (life.peakOrdinal >= 39) {
                lines.push(`peak=${life.peakOrdinal} end=${life.end} n=${life.insightCount} degTot=${life.degreeTotal} age=${life.ageAtEnd.toFixed(0)} fdn=${life.foundation} ruins=${life.ruinsEntered} vein=${life.foundVein} rate=${life.debugRate.toFixed(2)} untr=${life.debugUntreated} stones=${life.debugStones.toExponential(1)} amb=${life.debugAmbient}`);
            }
        }
        writeFileSync('wall2.txt', lines.slice(0, 40).join('\n'));
    }, 3600000);
});
